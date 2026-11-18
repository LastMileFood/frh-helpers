(()=>{
// frh rescues module v10: edit, publish, cancel and export rescues; plan/apply engine; frh.diff for filled Rescue CSVs.
// Templates (T<number>) need the templates module too: frh.use('rescues','templates').
const {cfg,j,norm,stopOf,nm,parseHTML,isT,num,base,load,mins,fmtT,fmtD,REP,repOf,repKind,state,items,info,tok,ajax,FORM,volId,tagMap,tn,tagId,tagName,short,who,reg,m:_m}=frh._;
const NOTPL='this is a template: load the templates module first, frh.use("rescues","templates")', TP=()=>_m.templates;
// ===== A: volunteer =====
const A=async(R,U0,PUBLISH=true,DRY=true)=>{
  if(isT(R)) return {errs:['the volunteer on a template is changed in the page, not here']};
  let U=volId(U0), uname=cfg.vols.find(v=>v[2]==U)?.[1]||''; const errs=[], F=FORM, H=ajax(), t0=tok(document);
  if(U==null&&U0!=null&&U0!==''){ const w=await who(U0,R); if(w.exact===1){ U=+w.hits[0].split(' ')[0]; uname=w.hits[0].replace(/^\d+ /,'').replace(/ \d.*$/,''); } else errs.push('volunteer '+U0+': '+(w.hits.length?'which one? '+w.hits.join(' / '):'nobody found')+' (give the user_id; 0 removes)'); }
  else if(U==null) errs.push('give a volunteer name or user_id; 0 removes');
  const req=(u,b)=>fetch(u,{method:'POST',headers:b?{...H,...F}:H,body:b&&new URLSearchParams(b).toString()}).then(r=>r.status);
  const st=async()=>{const {status,vol,volId}=state(await load(R)); return {status,vol,volId};};
  const s0=await st(), pub=PUBLISH&&U>0;
  if(DRY||errs.length) return {errs,status:s0.status,vol:s0.vol+' '+s0.volId,to:U>0?(uname||'user')+' '+U:'none',publish:pub&&s0.status==='Drafting'?'yes, no notifications':'',undo:s0.volId};
  const log=[];
  if(s0.volId&&s0.volId!=U) log.push(['unassign',await req('/routes/'+R+'/unassign',{reason:'Reassigning / reorganizing',from_template:'false'})]);
  if(U>0&&s0.volId!=U&&log.every(x=>x[1]<300)) log.push(['assign',await req('/routes/'+R+'/assign_volunteer?route%5Buser_id%5D='+U)]);
  if(pub&&log.every(x=>x[1]<300)&&(await st()).status==='Drafting') log.push(['publish',(await fetch('/routes/'+R+'/publish?send_notifications=false',{method:'POST',headers:F,body:new URLSearchParams({authenticity_token:t0}).toString()})).status]);
  const e=await st(), ok=log.every(x=>x[1]<300)&&e.volId==U&&(!pub||e.status!=='Drafting');
  return {ok,status:e.status,vol:e.vol,log:ok?'':log.map(x=>x.join(' '))}; };

// ===== T: tags. spec = {add:[], del:[]} by name or id, or {vehicle:'NAME'} (team setups: the team's base tag + exactly that vehicle) =====
const T=async(R,spec={},DRY=true)=>{
  const H={...ajax(),...FORM}, req=(m,u,b)=>fetch(u,{method:m,headers:H,body:new URLSearchParams(b).toString()}).then(r=>r.status);
  const st=async()=>{const d=await load(R); return {tags:state(d).tags,M:tagMap(d),type:d.querySelector('.tag-list')?.dataset.itemType||(isT(R)?'RouteTemplate':'Route')};};
  const s0=await st(), M=s0.M, id=t=>tagId(M,t), errs=[]; let ADD=(spec.add||[]).map(id), DEL=(spec.del||[]).map(id);
  if(spec.vehicle!=null){ const vs=cfg.vehicles.map(id), v=id(spec.vehicle);
    if(!cfg.vehicles.length) errs.push('no vehicle tags are set up in this browser: use {add:[..], del:[..]} with tag names');
    else if(v==null||!vs.includes(v)) errs.push('unknown vehicle '+spec.vehicle+' ('+cfg.vehicles.join(', ')+')');
    else { ADD=[...(cfg.baseTag?[id(cfg.baseTag)]:[]),v]; DEL=vs.filter(x=>x!==v); } }
  [...(spec.add||[]),...(spec.del||[])].forEach(x=>{ if(id(x)==null) errs.push('unknown tag '+x+' (tags: '+Object.values(M).join(', ')+')'); });
  const add=ADD.filter(t=>t!=null&&!s0.tags.includes(t)), del=DEL.filter(t=>t!=null&&s0.tags.includes(t)), names=a=>a.map(t=>tagName(M,t)).join(',');
  if(DRY||errs.length) return {errs,tags:names(s0.tags),add:names(add),del:names(del),undo:{add:del,del:add}};
  const log=[];
  for(const t of del) log.push(['-'+tagName(M,t),await req('DELETE','/tags/'+t+'/remove_from_item',{item_type:s0.type,item_id:num(R),cascade:'false'})]);
  for(const t of add) log.push(['+'+tagName(M,t),await req('POST','/tags/'+t+'/add_to_item',{item_type:s0.type,item_id:num(R)})]);
  const e=await st(), ok=log.every(x=>x[1]<300)&&ADD.every(t=>e.tags.includes(t))&&!DEL.some(t=>e.tags.includes(t));
  return {ok,tags:names(e.tags),log:ok?'':log.map(x=>x.join(' '))}; };

// rescue side of the schedule form; the template side (repeat) is in the templates module
const RS={form:'route-reschedule',name:n=>'route['+n+']',rep:()=>'',undo:()=>({}),
  check:(S,P,date,errs)=>{ if(S.repeat!=null) errs.push('repeat is for templates: to make a rescue recurring, copy it with repeat (frh-create-rescues)'); return ''; },
  body:(P,date,start,rep,dv)=>({authenticity_token:P.tok,'route[start_date]':date,'route[start_time]':start,'route[duration_in_hours]':dv})};
// ===== S: schedule. SET = {date?, start?, end?, hours?} or a 'from' string; templates (T…) also take repeat: 'weekly' | 'every other week' | 'monthly' =====
const S=async(R,S={},DRY=true)=>{
  const day=s=>{if(!s) return 'bad date'; const x=new Date(s.replace(/,/g,'')); return x.toLocaleDateString('en-US',{weekday:'short'})+' '+x.toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'});};
  if(typeof S==='string'){ const m=S.replace(/^[A-Za-z]{3},? /,'').match(/^(\S+) (.+?) - (.+)$/); S=m?{date:m[1],start:m[2],end:m[3]}:{date:S}; }
  const tp=isT(R); if(tp&&!TP()) return {errs:[NOTPL]}; const A_=tp?TP().S:RS, parse=d=>{const f=d.getElementById(A_.form); if(!f) return null; const v=n=>f.querySelector('[name="'+A_.name(n)+'"]');
    const sel=x=>[...x.options].find(o=>o.selected)?.value??x.value, dv=[...v('duration_in_hours').options].map(o=>o.value);
    const date=fmtD(v('start_date').getAttribute('value').replace(/^(\w+), (\d+)/,'$1 $2,')), start=sel(v('start_time')), dur=+sel(v('duration_in_hours'));
    return {f,date,start,dur,rep:A_.rep(v,sel),M:tagMap(d),org:(d.documentElement.innerHTML.match(/BusinessHours\.fetch\((\d+)\)/)||[])[1],end:fmtT(mins(start)+dur*60),starts:[...v('start_time').options].map(o=>o.value),durs:dv.map(Number),durv:dv,...state(d),
      log:[...d.querySelectorAll('.activity-log .data-row')].slice(0,1).map(r=>r.lastElementChild.textContent.replace(/\s+/g,' ').trim().slice(0,120)),tok:tok(d)};};
  const P=parse(await load(R)); if(!P) return {errs:['no schedule form on '+base(R)]};
  const errs=[], warn=[], row=x=>day(x.date)+' '+x.start+' - '+x.end+(x.rep?', '+repOf(x.rep):'');
  if(S.end!=null&&S.hours!=null) errs.push('give end or hours, not both');
  const date=S.date!=null?fmtD(S.date):P.date; if(!date) errs.push('bad date '+S.date);
  const sm=S.start!=null?mins(S.start):mins(P.start); if(sm==null) errs.push('bad start '+S.start);
  const start=sm!=null?fmtT(sm):null; if(start&&!P.starts.includes(start)) errs.push('start '+start+' not an option (15-min steps)');
  const em=S.end!=null?mins(S.end):null; if(S.end!=null&&em==null) errs.push('bad end '+S.end);
  const dur=S.hours!=null?+S.hours:em!=null&&sm!=null?(em-sm)/60:P.dur;
  if(sm!=null&&sm+dur*60>24*60) errs.push('window crosses midnight');
  else if(!P.durs.includes(dur)) errs.push('window '+dur+' h not allowed ('+P.durs[0]+' to '+P.durs[P.durs.length-1]+' h, 15-min steps)');
  const wrep=A_.check(S,P,date,errs);
  const want={date,start,end:sm!=null&&!errs.length?fmtT(sm+dur*60):'-',dur,rep:wrep};
  if(!errs.length&&window.TimeValidation){ try{ window.frhBH??=window.BusinessHours&&P.org?await BusinessHours.fetch(+P.org):[]; }catch(e){ window.frhBH=[]; }
    TimeValidation.validateScheduleTimes({startDate:date,startTime:start,duration:dur},window.frhBH||[]).issues.forEach(i=>(i.type==='blocker'?errs:warn).push(i.message)); }
  const claimed=/Claimed|In Progress/.test(P.status)?'FRH may notify '+P.vol:'';
  if(DRY||errs.length) return {errs,warn,status:P.status,from:row(P),to:row(want),note:claimed,undo:{date:P.date,start:P.start,hours:P.dur,...A_.undo(P)}};
  const r=await fetch(P.f.getAttribute('action'),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(A_.body(P,date,start,want.rep,P.durv[P.durs.indexOf(dur)])).toString()});
  const Q=parse(await load(R)), ok=r.status<400&&Q.date===want.date&&Q.start===want.start&&Q.dur===want.dur&&Q.rep===want.rep&&Q.status===P.status;
  return {ok,saved:row(Q),status:Q.status,tagsChanged:P.tags.join(',')!==Q.tags.join(',')?P.tags.map(t=>tagName(P.M,t))+' -> '+Q.tags.map(t=>tagName(Q.M,t)):'',log:ok?'':Q.log.concat('http '+r.status)}; };

// ===== R: recipients. PLAN = complete final list of drop-offs [{to, from?, qty?}] =====
const label=q=>{let p=q; while(p.parentElement&&!p.parentElement.querySelector('select,button,a')&&p.parentElement.querySelectorAll('input[name$="[quantity_estimated]"]').length===1) p=p.parentElement; return p.textContent.replace(/\s+/g,' ').replace(/\(Est\)/,'').trim();};
const parse=d=>{const f=d.getElementById('update-dropoffs'); if(!f) return null;
    const tpl=parseHTML(f.querySelector('a.add_fields')?.getAttribute('data-association-insertion-template')||'');
    const opts=[...(tpl.querySelector('select')?.options||[])].filter(o=>o.value).map(o=>({id:o.value,name:o.textContent.trim()}));
    const its=[...tpl.querySelectorAll('input[name$="[quantity_estimated]"]')].map(q=>({did:q.parentElement.querySelector('[name$="[donation_item_id]"]').value,name:label(q)}));
    let pi=JSON.parse(([...d.scripts].map(s=>s.textContent).find(t=>t.includes('pickupItemsArray'))||'').match(/\[\[.*\]\]/)?.[0]||'[]').map(x=>[String(x[0]),+x[1]]);
    if(!pi.length){ const pf=[...d.querySelectorAll('form[id^=edit_route_stop_item_]')].map(x=>{const id=x.id.split('_').pop(), g=p=>d.querySelector('[id^="'+p+'-'+id+'-"]:is(input,select)')?.value; return {q:+g('number-field'),desc:(g('description')||'').replace(/\s+/g,' ').trim()};});
      if(pf.length===its.length&&pf.every((p,i)=>its[i].name.includes(p.desc))) pi=its.map((it,i)=>[it.did,pf[i].q]); }
    const status={}, lname={}; d.querySelectorAll('.dropoff-details .list-group-item').forEach(x=>{const a=x.querySelector('a[href*="recipient_locations/"]'), id=a?.getAttribute('href').match(/recipient_locations\/(\d+)/)?.[1]; if(id){ status[id]=x.querySelector('.current-status')?.textContent.trim(); lname[id]=a.textContent.replace(/\s+/g,' ').trim(); }});
    const stops={};
    for(const e of f.elements){ const m=e.name?.match(/^route(?:_template)?\[route_stops_attributes\]\[(\d+)\]\[(\w+)\]$/), mi=e.name?.match(/^route(?:_template)?\[route_stops_attributes\]\[(\d+)\]\[route_stop_items_attributes\]\[(\d+)\]\[(\w+)\]$/);
      if(m){ const s=(stops[m[1]]??={f:{},items:{}}); s.f[m[2]]=e.value; if(m[2]==='location_id') s.f.swappable=e.tagName==='SELECT'; }
      else if(mi) ((stops[mi[1]]??={f:{},items:{}}).items[mi[2]]??={})[mi[3]]=e.value; }
    const list=Object.entries(stops).map(([k,s])=>({k,...s.f,loc:opts.find(o=>o.id==s.f.location_id)?.name||lname[s.f.location_id],st:status[s.f.location_id],items:Object.values(s.items)})).sort((a,b)=>a.order-b.order);
    return {f,opts,pi,items:its,list,tok:tok(d)};};
// d0: an already loaded page (export and diff pass it, so a rescue is fetched once)
const Rcp=async(R,PLAN,DRY=true,d0,PI)=>{ if(isT(R)&&!TP()) return {errs:[NOTPL]};
  const P=parse(d0||await load(R)); if(!P) return {errs:['no recipients form on '+base(R)]};
  const errs=[], sh=n=>(n||'').split(' - ')[0];
  if(!Array.isArray(PLAN)) return {errs:[],cols:'order | recipient | status | qty',now:P.list.map(s=>[s.order,s.location_id+' '+sh(s.loc),s.st||'-',s.items.map(i=>+i.quantity_estimated).join(',')].join(' | '))};
  const pool=[...P.opts,...P.list.filter(s=>s.loc&&!P.opts.some(o=>o.id==s.location_id)).map(s=>({id:s.location_id,name:s.loc}))];
  const findLoc=v=>{ let h=/^\d+$/.test(String(v))?pool.filter(o=>o.id==v):pool.filter(o=>o.name.toLowerCase()===String(v).toLowerCase()); if(!h.length&&!/^\d+$/.test(String(v))) h=pool.filter(o=>o.name.toLowerCase().includes(String(v).toLowerCase()));
    if(h.length!==1){errs.push(h.length+' recipients match '+v+(h.length?': '+h.slice(0,5).map(o=>o.id+' '+o.name).join(' / '):''));return null;} return h[0]; };
  const keyItem={}; for(const k of new Set(PLAN.flatMap(p=>Object.keys(p.qty||{})))){ if(k==='*') continue;
    const h=P.items.filter(i=>i.did==k||i.name.toLowerCase().includes(k.toLowerCase())); if(h.length!==1) errs.push('item key '+k+' matches '+h.length+(h.length?': '+h.map(i=>i.name).join(' / '):'')); else keyItem[k]=h[0].did; }
  const qtyFor=(q,did,cur)=>{ if(!q) return cur; const k=Object.keys(q).find(k=>keyItem[k]===did); return k!=null?String(q[k]):('*' in q?String(q['*']):cur); };
  const used=new Set(), out=[];
  PLAN.forEach((p,i)=>{ const to=findLoc(p.to); if(!to) return; let s=null;
    if(p.from!=null){ const fr=findLoc(p.from); s=fr&&P.list.find(x=>x.location_id==fr.id&&!used.has(x.k)); if(fr&&!s) errs.push('no current stop at '+fr.name); if(s&&!s.swappable) errs.push(sh(s.loc)+' is '+(s.st||'locked')+': cannot swap; remove it and add the new one'); }
    else s=P.list.find(x=>x.location_id==to.id&&!used.has(x.k));
    const base={location_id:to.id,loc:to.name,order:String(i+2),_destroy:'0'};
    if(s){ used.add(s.k); out.push({...s,...base,tag:p.from!=null?'swap':'',items:s.items.map(it=>({...it,quantity_estimated:qtyFor(p.qty,it.donation_item_id,it.quantity_estimated)}))}); }
    else out.push({k:String(Date.now()+i),id:'',location_type:'RecipientLocation',stop_type:'dropoff',...base,tag:'new',items:P.items.map(it=>({id:'',donation_item_id:it.did,quantity_estimated:qtyFor(p.qty,it.did,'0')}))}); });
  const removed=P.list.filter(s=>!used.has(s.k)).map(s=>({...s,_destroy:'1'}));
  const tot=P.items.map(it=>out.reduce((a,s)=>a+(+(s.items.find(x=>x.donation_item_id==it.did)?.quantity_estimated||0)),0));
  P.items.forEach((it,i)=>{const pk=PI?.[it.did]??P.pi.find(x=>x[0]==it.did)?.[1]; if(pk!=null&&tot[i]>pk) errs.push('over-distributed: '+it.name+' '+tot[i]+' of '+pk);});
  if(!out.length) errs.push('plan leaves no recipients');
  const row=s=>[s.order,s.location_id+' '+sh(s.loc),s.st||'-',s.items.map(i=>+i.quantity_estimated).join(','),s.tag||''].join(' | ').replace(/ \| $/,'');
  if(DRY||errs.length) return {errs,cols:'order | recipient | status | qty: '+P.items.map(i=>i.name.replace(/^Pallets (of )?Assorted /,'')).join(','),plan:out.map(row),removed:removed.map(row),
    totals:tot.map((t,i)=>t+'/'+(P.pi.find(x=>x[0]==P.items[i].did)?.[1]??'?')).join(','),
    undo:P.list.map(s=>({to:+s.location_id,qty:Object.fromEntries(s.items.map(i=>[i.donation_item_id,+i.quantity_estimated]))}))};
  const pf=isT(R)?TP().pf:'route', b=new URLSearchParams({_method:'patch',authenticity_token:P.tok,...(isT(R)?{}:{'route[edit_drop_offs_admin]':'true'}),[pf+'[id]']:num(R)});
  for(const s of [...out,...removed]){ const pre=pf+'[route_stops_attributes]['+s.k+']';
    for(const f of ['id','location_type','stop_type','original_location_id','location_id']) if(s[f]) b.append(pre+'['+f+']',s[f]);
    s.items.forEach((it,n)=>{ const ip=pre+'[route_stop_items_attributes]['+n+']'; b.append(ip+'[quantity_estimated]',it.quantity_estimated); if(it.id) b.append(ip+'[id]',it.id); b.append(ip+'[donation_item_id]',it.donation_item_id); });
    b.append(pre+'[_destroy]',s._destroy); b.append(pre+'[order]',s.order); }
  b.append('format','json');
  const r=await fetch(P.f.getAttribute('action'),{method:'POST',headers:{...FORM,'X-CSRF-Token':P.tok,'X-Requested-With':'XMLHttpRequest','Accept':'application/json'},body:b.toString()});
  const txt=await r.text(), Q=parse(await load(R)), key=s=>s.location_id+'|'+s.items.map(i=>+i.quantity_estimated).join(',');
  const lost=out.filter(s=>s.st&&Q.list.find(a=>a.location_id==s.location_id)?.st!==s.st).map(s=>sh(s.loc)+' '+s.st+' -> '+Q.list.find(a=>a.location_id==s.location_id)?.st);
  const ok=r.status<300&&/"success":true/.test(txt)&&out.map(key).join('/')===Q.list.map(key).join('/')&&!lost.length;
  return {ok,saved:Q.list.map(row),statusChanged:lost,resp:ok?'':r.status+' '+txt.slice(0,200)}; };

// ===== W: edit existing donation items. SET = {'<item id>': {qty?, est?, food?, unit?, desc?, lbs?}} =====
const W=async(R,SET,DRY=true)=>{
  const K=['qty','est','food','unit','desc','lbs'];
  const its=d=>items(d).map(i=>({...i,name:(a,b)=>nm(i.ft,a)+' / '+nm(i.un,b),val:(k,v)=>{const s=k==='food'?i.ft:i.un; return v==null?v:([...s.options].find(o=>o.value==v||norm(o.textContent)===norm(v))?.value??'!'+v);},def:(a,b)=>i.defs.find(r=>r[0]==a&&r[1]==b)?.[2]??null}));
  const show=i=>i.id+': '+i.qty+' x '+i.lbs+' lbs tot '+i.qty*i.lbs+' | '+i.type+' | '+i.desc+(/^(true|1)$/.test(i.est)?' | est':'');
  const d0=await load(R), before=its(d0), t0=tok(d0), plan=[], errs=[], undo={};
  if(!SET||!Object.keys(SET).length) return {errs,items:before.map(show),...info(d0)};
  for(const [id,ch] of Object.entries(SET)){ const it=before.find(i=>i.id===String(id)); if(!it){errs.push(id+': not found');continue;}
    const c={...ch}; for(const k of ['food','unit']) if(k in c) c[k]=it.val(k,c[k]);
    const v={qty:it.qty,est:it.est,food:it.food,unit:it.unit,desc:it.desc,lbs:it.lbs,...c}, def=it.def(v.food,v.unit);
    if(String(v.food+v.unit).includes('!')) errs.push(id+': unknown food or unit'); else if(v.lbs===''&&def==null) errs.push(id+': no default weight, give lbs');
    undo[id]=Object.fromEntries(Object.keys(c).map(k=>[k,it[k]]));
    const diff=Object.keys(c).map(k=>k+' '+(k==='food'||k==='unit'?nm(k==='food'?it.ft:it.un,it[k]):it[k])+' -> '+(k==='food'||k==='unit'?nm(k==='food'?it.ft:it.un,v[k]):v[k])).join(', ');
    plan.push({id,v,def,row:id+': '+diff+' | total '+it.qty*it.lbs+' -> '+(v.lbs===''?'default '+def+' each':v.qty*v.lbs)+(c.food!=null||c.unit!=null?' | default lbs '+def:'')}); }
  if(DRY||errs.length) return {errs,plan:plan.map(p=>p.row),undo};
  for(const p of plan){ const it=before.find(i=>i.id===p.id), v=p.v;
    const r=await fetch(it.action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_method:'patch',authenticity_token:t0,[it.qn]:v.qty,'route_stop_item[estimated]':v.est,'route_stop_item[food_type]':v.food,'route_stop_item[item_unit_id]':v.unit,'route_stop_item[description]':v.desc,'route_stop_item[weight]':v.lbs}).toString()});
    p.http=r.status; p.want={...v,lbs:v.lbs===''?String(p.def):v.lbs}; }
  const d1=await load(R), after=its(d1), n=(k,x)=>k==='est'?/^(true|1)$/.test(x):k==='desc'?String(x).trim():+x;
  const bad=plan.map(p=>{const a=after.find(i=>i.id===p.id); return [p.id,K.filter(k=>n(k,a?.[k])!==n(k,p.want[k]))];}).filter(x=>x[1].length);
  return {ok:!bad.length,bad:bad.map(x=>x[0]+': '+x[1].join(',')),items:after.filter(i=>SET[i.id]).map(show),...info(d1)}; };

// ===== I: add new donation items. ADD = [{donor?, qty, food, unit, desc, lbs?, est?, dupOk?}] =====
const I=async(R,ADD=[],DRY=true)=>{
  const val=(s,v)=>v==null||v===''?'':([...(s?.options||[])].find(o=>o.value&&(o.value==v||norm(o.textContent)==norm(v)))?.value??'!'+v);
  const donors=d=>{const Tx=[...d.body.querySelectorAll('*')].filter(e=>!e.children.length).map(e=>e.textContent.replace(/\s+/g,' ').trim()).filter(Boolean), names=[];
    Tx.forEach((s,i)=>{const m=s.match(/^Donors? (\d+)$/); if(m) names[m[1]-1]=Tx[i+1];});
    return [...d.querySelectorAll('form[id^=new-item-form-]')].map(f=>{const k=+f.id.split('-').pop(), ft=d.getElementById('food-type-new-item-'+k), un=d.getElementById('unit-new-item-'+k);
      return {n:k+1,name:names[k],action:f.getAttribute('action'),stop:stopOf(f.getAttribute('action')),ft,un,defs:JSON.parse((ft?.getAttribute('onchange')||'').match(/\[\[.*?\]\]/)?.[0]||'[]')};});};
  const view=(D,X)=>D.map(t=>'Donor '+t.n+' '+t.name+': '+X.filter(x=>x.stop===t.stop).map(x=>x.id+' '+x.qty+'x'+x.lbs+' '+x.desc).join('; '));
  const d0=await load(R), D=donors(d0), I0=items(d0), errs=[], plan=[];
  if(!D.length) errs.push('no Add New Item form on this rescue');
  ADD.forEach((a,i)=>{ let m;
    if(a.donor==null){ if(D.length===1) m=D; else {errs.push('#'+i+': '+D.length+' donors, name one');return;} }
    else m=typeof a.donor==='number'?D.filter(x=>x.n===a.donor):D.filter(x=>norm(x.name).includes(norm(a.donor)));
    if(m.length!==1){errs.push('#'+i+': donor '+a.donor+' matches '+m.length);return;}
    const t=m[0], food=val(t.ft,a.food), unit=val(t.un,a.unit), def=t.defs.find(r=>r[0]==food&&r[1]==unit)?.[2]??null, lbs=a.lbs==null||a.lbs===''?(def==null?'':String(def)):String(a.lbs), qty=String(a.qty??1);
    if(!food||!unit||String(food+unit).includes('!')) errs.push('#'+i+': unknown or missing food or unit');
    if(!a.desc) errs.push('#'+i+': desc required');
    if(lbs==='') errs.push('#'+i+': no default weight, give lbs');
    if(!(+qty>=1)) errs.push('#'+i+': qty must be 1 or more');
    const dup=I0.filter(x=>x.stop===t.stop&&x.food==food&&x.unit==unit&&norm(x.desc)===norm(a.desc));
    if(dup.length&&!a.dupOk) errs.push('#'+i+': same item already on donor '+t.n+' ('+dup.map(x=>x.id).join(',')+'), pass dupOk true if intended');
    plan.push({stop:t.stop,qty,est:a.est?'1':'0',food,unit,desc:a.desc,lbs,row:'NEW donor '+t.n+' '+short(t.name)+': '+qty+' x '+lbs+' lbs tot '+(+qty*+lbs)+' | '+nm(t.ft,food)+' / '+nm(t.un,unit)+' | '+a.desc+(a.lbs==null?' (default lbs)':'')});});
  if(DRY||errs.length||!plan.length) return {errs,donors:view(D,I0),plan:plan.map(p=>p.row),...info(d0)};
  const t0=tok(d0), H={'Content-Type':'application/x-www-form-urlencoded'}, done=[];
  for(const p of plan){ const t=D.find(x=>x.stop===p.stop), seen=new Set(items(await load(R)).map(x=>x.id));
    const b=new URLSearchParams([['authenticity_token',t0],['route_stop_item[route_stop_id]',p.stop],...(isT(R)?[]:[['button','instance']]),['route_stop_item[quantity_estimated]',p.qty],['route_stop_item[estimated]','0'],...(p.est==='1'?[['route_stop_item[estimated]','1']]:[]),['route_stop_item[food_type]',p.food],['route_stop_item[item_unit_id]',p.unit],['route_stop_item[description]',p.desc],['route_stop_item[weight]',p.lbs]]);
    const http=(await fetch(t.action,{method:'POST',headers:H,body:b.toString()})).status;
    const nw=items(await load(R)).filter(x=>!seen.has(x.id)&&x.stop===p.stop);
    if(nw.length!==1){done.push({ok:false,bad:'http '+http+', found '+nw.length+' new items'});break;}
    let it=nw[0], qtyFix='';
    if(+it.qty!==+p.qty){ await fetch(it.action,{method:'POST',headers:H,body:new URLSearchParams({_method:'patch',authenticity_token:t0,[it.qn]:p.qty,'route_stop_item[estimated]':it.est,'route_stop_item[food_type]':it.food,'route_stop_item[item_unit_id]':it.unit,'route_stop_item[description]':it.desc,'route_stop_item[weight]':it.lbs}).toString()});
      qtyFix=it.qty+' to '+p.qty; it=items(await load(R)).find(x=>x.id===nw[0].id); }
    const bad=['qty','food','unit','lbs'].filter(k=>+it?.[k]!==+p[k]).concat(norm(it?.desc)===norm(p.desc)?[]:['desc']);
    done.push({id:nw[0].id,ok:!bad.length,bad:bad.join(','),qtyFix}); if(bad.length) break; }
  const d2=await load(R); return {ok:done.length===plan.length&&done.every(x=>x.ok),added:done,donors:view(donors(d2),items(d2)),...info(d2)}; };

// ===== SNAP: one fetch of a rescue page -> everything the export and diff need (FRH-46: was two fetches per rescue) =====
const snap=async R=>{ const d=await load(R), s=state(d), M=tagMap(d), its=items(d), f=d.getElementById('route-reschedule'), v=n=>f?.querySelector('[name="route['+n+']"]');
  const sel=x=>x?([...x.options].find(o=>o.selected)?.value??x.value):'';
  const dt=v('start_date')?.getAttribute('value')||'', jd=new Date(dt.replace(/^(\w+), (\d+)/,'$1 $2,')), date=isNaN(jd)?dt:(jd.getMonth()+1)+'/'+jd.getDate()+'/'+jd.getFullYear();
  const st=sel(v('start_time')), dur=+sel(v('duration_in_hours')), sm=mins(st), end=sm==null?'':fmtT(sm+dur*60);
  const donor=[...d.querySelectorAll('a[href*="donor_locations/"]')].map(a=>a.textContent.replace(/\s+/g,' ').trim()).find(Boolean)||'';
  const vol=s.volId?(cfg.vols.find(x=>x[2]==s.volId)?.[0]||s.vol):'', veh=s.tags.map(t=>tagName(M,t)).filter(t=>cfg.vehicles.some(v=>tn(v)===tn(t))).join(' ');
  const P=parse(d), sh=n=>(n||'').split(' - ')[0], stops=(P?.list||[]).map(x=>({name:sh(x.loc),q:x.items.map(i=>+i.quantity_estimated)}));
  const bad=stops.some(x=>x.q.length!==its.length);
  const to=k=>bad?'':stops.length===1?stops[0].name:stops.filter(x=>x.q[k]>0).map(x=>x.name+':'+x.q[k]).join('; ');
  return {s,its,date,st,end,donor,vol,veh,stops,bad,to,dids:(P?.items||[]).map(i=>i.did)}; };
// ===== X: export rescues as Rescue CSV rows (one per item). X([R,...]) -> {cols, rows}; values are %-encoded for & = ? % | (decode with unquote); empty cells at the end of a row are left off
const XC=['R','item_id','date','start','end','donor','category','pack','qty','lbs_each','description','estimated','to','volunteer','vehicle','status'];
const X=async(Rs)=>{ Rs=(Array.isArray(Rs)?Rs:[Rs]).map(String); const enc=v=>String(v??'').replace(/%/g,'%25').replace(/&/g,'%26').replace(/=/g,'%3D').replace(/\?/g,'%3F').replace(/\|/g,'%7C'), rows=[], errs=[];
  for(const R of Rs){ try{ if(isT(R)){ errs.push(R+': templates are not exported'); continue; }
    const {s,its,date,st,end,donor,vol,veh,bad,to}=await snap(R); if(bad) errs.push(R+': drop-off items do not line up with pickup items; to left blank');
    its.forEach((it,k)=>{ const first=k===0, [cat,pack]=(it.type||'').split(' / ');
      rows.push([R,it.id,first?date:'',first?st:'',first?end:'',first?donor:'',cat,pack,it.qty,it.lbs,String(it.desc||'').trim(),/^(true|1)$/.test(it.est)?'Y':'',to(k),first?vol:'',first?veh:'',first?s.status:''].map(enc)); });
    if(!its.length) rows.push([R,'',date,st,end,donor,'','','','','','','',vol,veh,s.status].map(enc));
  }catch(e){ errs.push(R+': '+e.message); } }
  return {errs,cols:XC.join(','),rows:rows.map(r=>r.join('|').replace(/\|+$/,''))}; };

// ===== DIFF: a filled Rescue CSV against FRH -> ready plan entries (FRH-46). rows = [{R, item_id, date, ..., publish}] as read from the file (headers in any case; the usual aliases)
// Returns {plan:[[R,C],...] for frh.plan, unchanged, newRescues (keys for frh-create-rescues), notes, errs}. Saves nothing. A blank cell never changes anything.
const DK={'rescue #':'r','rescue id':'r','food type':'category','packaged in':'pack','pack type':'pack','unit':'pack','weight':'lbs_each','lbs':'lbs_each','recipient':'to','driver':'volunteer'};
const diff=async(rows=[])=>{ const plan=[], unchanged=[], newRescues=[], notes=[], errs=[], G=new Map();
  rows.forEach((r,i)=>{ const o={_row:i+2}; for(const [k,v] of Object.entries(r||{})){ const x=norm(k); o[DK[x]||x]=String(v??'').trim(); } if(!o.r&&o.rescue) o.r=o.rescue;
    const key=(o.r||'').replace(/^#/,''); if(!key){ if(Object.keys(o).some(k=>k!=='_row'&&k!=='notes'&&o[k])) errs.push('row '+o._row+': no R'); return; } (G.get(key)||G.set(key,[]).get(key)).push(o); });
  const one1=(g,f,R)=>{ const v=[...new Set(g.map(o=>o[f]).filter(Boolean))]; if(v.length>1) errs.push(R+': two values for '+f+' ('+v.join(' / ')+')'); return v[0]||''; };
  const nq=x=>x===''||x==null?null:+x, same=(a,b)=>norm(a)===norm(b), sameTo=(a,b)=>same(a,b)||same(short(a),short(b))||same(a,short(b))||same(short(a),b);
  const splitTo=(cell,qty)=>{ const m=new Map(); String(cell).split(';').map(x=>x.trim()).filter(Boolean).forEach(x=>{ const k=x.lastIndexOf(':'); if(k>0&&/^\s*\d+(\.\d+)?\s*$/.test(x.slice(k+1))) m.set(x.slice(0,k).trim(),+x.slice(k+1)); else m.set(x,qty); }); return m; };
  for(const [R,g] of G){
    if(isT(R)){ errs.push(R+': templates are not changed from a CSV'); continue; }
    if(!/^\d+$/.test(R)){ newRescues.push(R); continue; }
    let S0; try{ S0=await snap(R); }catch(e){ errs.push(R+': '+e.message); continue; }
    const C={}, f=k=>one1(g,k,R), canceled=/cancel/i.test(S0.s.status);
    const cn=f('cancel'); if(cn){ if(canceled) notes.push(R+': already '+S0.s.status); else { plan.push([R,{cancel:cn}]); if(g.some(o=>['date','start','end','volunteer','vehicle','publish','qty','to'].some(k=>o[k]))) notes.push(R+': canceled, so its other cells are ignored'); } continue; }
    if(canceled){ notes.push(R+': '+S0.s.status+', left alone (uncancel it by name in the chat)'); continue; }
    const W_={}, dt=f('date'), st=f('start'), en=f('end');
    if(dt&&fmtD(dt)!==fmtD(S0.date)) W_.date=dt; if(st&&mins(st)!==mins(S0.st)) W_.start=st; if(en&&mins(en)!==mins(S0.end)) W_.end=en;
    if(Object.keys(W_).length){ if(W_.end&&!W_.start&&st) W_.start=st; C.window=W_; }
    const vo=f('volunteer'); if(vo&&!same(vo,S0.vol)&&!same(vo,S0.s.vol)) C.vol=vo;
    const ve=f('vehicle'); if(ve&&!same(ve,S0.veh)) C.tags={vehicle:ve};
    const pb=f('publish'); if(pb){ const how=/^y(es)?$/i.test(pb)?true:/^notify$/i.test(pb)?'notify':null; if(how==null) errs.push(R+': publish must be Y or notify');
      else if(!/drafting/i.test(S0.s.status)) notes.push(R+': already '+S0.s.status+', publish ignored'); else if(S0.s.volId) notes.push(R+': has a volunteer, publish ignored'); else C.publish=how; }
    const items={}, add=[], dist=new Map(); let toChanged=false;
    for(const o of g){
      if(o.item_id){ const k=S0.its.findIndex(i=>i.id===o.item_id); if(k<0){ errs.push(R+' row '+o._row+': item '+o.item_id+' is not on this rescue'); continue; }
        const it=S0.its[k], [cat,pack]=(it.type||'').split(' / '), ch={};
        if(o.category&&!same(o.category,cat)) ch.food=o.category; if(o.pack&&!same(o.pack,pack)) ch.unit=o.pack;
        if(o.qty!==''&&o.qty!=null&&+o.qty!==+it.qty) ch.qty=+o.qty; if(o.lbs_each&&Math.ceil(+o.lbs_each)!==+it.lbs) ch.lbs=Math.ceil(+o.lbs_each);
        if(o.description&&o.description!==String(it.desc||'').trim()) ch.desc=o.description;
        if(o.estimated){ const y=/^y(es)?$/i.test(o.estimated), now=/^(true|1)$/.test(it.est); if(y!==now) ch.est=/^(true|false)$/.test(it.est)?String(y):(y?'1':'0'); }
        if(Object.keys(ch).length) items[it.id]=ch;
        if(o.to&&!S0.bad){ const want=splitTo(o.to,ch.qty??+it.qty), cur=splitTo(S0.to(k),+it.qty);
          const eq=want.size===cur.size&&[...want].every(([n,q])=>[...cur].some(([m,p])=>sameTo(m,n)&&p===q)); if(!eq){ toChanged=true; dist.set(k,want); } }
        else if(o.to&&S0.bad) errs.push(R+': its drop-offs do not line up with its items; change recipients by name in the chat'); }
      else if(o.category||o.qty||o.description){ if(!o.category||!o.pack||!o.description) { errs.push(R+' row '+o._row+': a new item needs category, pack, qty and description'); continue; }
        add.push({qty:nq(o.qty)??1,food:o.category,unit:o.pack,desc:o.description,...(o.lbs_each?{lbs:Math.ceil(+o.lbs_each)}:{}),...(/^y/i.test(o.estimated||'')?{est:true}:{})}); if(o.to) notes.push(R+' row '+o._row+': a new item\'s to is not split automatically; split it after it is added'); } }
    if(Object.keys(items).length) C.items=items; if(add.length) C.add=add;
    if(toChanged){ const names=[]; const per=S0.its.map((it,k)=>{ const m=dist.get(k)||splitTo(S0.to(k),+it.qty); for(const n of m.keys()) if(!names.some(x=>sameTo(x,n))) names.push(S0.stops.find(x=>sameTo(x.name,n))?.name||n); return m; });
      const recips=names.map(n=>({to:n,qty:Object.fromEntries(S0.its.map((it,k)=>[S0.dids[k],[...per[k]].find(([m])=>sameTo(m,n))?.[1]||0]))})).filter(x=>Object.values(x.qty).some(q=>q>0));
      const dropped=S0.stops.map(x=>x.name).filter(n=>!recips.some(r=>sameTo(r.to,n))); if(dropped.length) notes.push(R+': the file moves everything away from '+dropped.join(', ')+', so the plan drops that stop');
      C.recips=recips; }
    if(Object.keys(C).length) plan.push([R,C]); else unchanged.push(R); }
  return {plan,unchanged,newRescues,notes,errs,next:plan.length?'show the parsed file back, then frh.plan(frh.last.plan)':''}; };

// ===== CANCEL / UNCANCEL. cancel: one of the page's reasons (its label, part of it, or its code). uncancel (rescues only): the new pickup {date, start, end?|hours?} =====
const Cn=async(R,reason,DRY=true)=>{ const tp=isT(R); if(tp&&!TP()) return {errs:[NOTPL]}; const d=await load(R), s=state(d), errs=[], k=x=>norm(x).replace(/_/g,' ');
  const opts=[...new Map([...d.querySelectorAll('#cancelRouteModal [data-reason]')].map(b=>[b.dataset.reason,b.textContent.trim()]))], f=d.getElementById(tp?TP().Cn.form:'cancel-route-form');
  let h=opts.filter(o=>k(o[0])===k(reason)||k(o[1])===k(reason)); if(!h.length&&reason) h=opts.filter(o=>k(o[1]).includes(k(reason)));
  if(!f) errs.push('no cancel form on '+base(R)); if(/cancel/i.test(s.status)) errs.push('already '+s.status);
  if(h.length!==1) errs.push((h.length?h.length+' reasons match '+reason:'give a reason')+': '+opts.map(o=>o[1]).join(' / '));
  const sf=d.getElementById('route-reschedule'), v=n=>sf?.querySelector('[name="route['+n+']"]'), sel=x=>x?([...x.options].find(o=>o.selected)?.value??x.value):'';
  const undo=tp?TP().Cn.undo:{date:fmtD((v('start_date')?.getAttribute('value')||'').replace(/^(\w+), (\d+)/,'$1 $2,')),start:sel(v('start_time')),hours:+sel(v('duration_in_hours'))};
  if(DRY||errs.length) return {errs,status:s.status,reason:h.length===1?h[0][1]:'',note:s.volId?'FRH notifies '+s.vol+' (they do not see the reason)':'',undo,undoAs:'uncancel'};
  const r=await fetch(f.getAttribute('action'),{method:'POST',headers:FORM,body:new URLSearchParams({authenticity_token:tok(d),[(tp?TP().pf:'route')+'[cancellation_reason]']:h[0][0]}).toString()});
  const e=state(await load(R)); return {ok:r.status<400&&/cancel/i.test(e.status),status:e.status,reason:h[0][1]}; };
// FRH (11/18/26) restores a canceled rescue with Actions > Uncancel Route (POST /routes/<n>/uncancel): same pickup, comes back as Drafting (tested on a Drafting-before-cancel rescue). Older pages had a date form (#uncancel-route-form); both work.
// SET {date, start, end?|hours?} optional: a new pickup, saved with the window step right after. Uncancel never publishes: if FRH brings it back published and SET.publish is not given, it goes back to Drafting.
const Un=async(R,SET={},DRY=true)=>{ if(isT(R)) return {errs:[TP()?TP().Un:NOTPL]}; SET=SET===true?{}:SET||{};
  const d=await load(R), s=state(d), f=d.getElementById('uncancel-route-form'), link=d.querySelector('a[href$="/uncancel"][data-method="post"],a[href$="/uncancel"]'), errs=[];
  if(!/cancel/i.test(s.status)) return {errs:['not canceled ('+s.status+')']}; if(!f&&!link) return {errs:['no Uncancel control on '+base(R)]};
  const want=SET.date||SET.start; if(want&&!(SET.date&&SET.start)) errs.push('a new pickup needs both date and start');
  if(DRY||errs.length) return {errs,status:s.status,to:want?fmtD(SET.date)+' '+SET.start+(SET.end?'-'+SET.end:SET.hours?', '+SET.hours+' h':''):'same pickup as before it was canceled',note:'comes back as Drafting (not published)',undo:([...d.querySelectorAll('.activity-log .data-row')].map(r=>(r.textContent.replace(/\s+/g,' ').match(/Canceled, reason: (.+?)\s*$/)||[])[1]).find(Boolean))||'ask the Requester for the cancel reason',undoAs:'cancel'};
  let r; if(f&&want){ const v=n=>f.querySelector('[name="route['+n+']"]'), sm=mins(SET.start), em=SET.end!=null?mins(SET.end):null, dur=SET.hours!=null?+SET.hours:em!=null?(em-sm)/60:1, dv=[...v('duration_in_hours').options].map(o=>o.value), di=dv.map(Number).indexOf(dur);
      if(di<0) return {errs:['window '+dur+' h not allowed']};
      r=await fetch(f.getAttribute('action'),{method:'POST',headers:FORM,body:new URLSearchParams({authenticity_token:tok(d),'route[start_date]':fmtD(SET.date),'route[start_time]':fmtT(sm),'route[duration_in_hours]':dv[di]}).toString()}); }
  else r=await fetch(f?f.getAttribute('action'):link.getAttribute('href'),{method:'POST',headers:FORM,body:new URLSearchParams({authenticity_token:tok(d),...(f?{}:{_method:'post'})}).toString()});
  let e=state(await load(R)), out={ok:r.status<400&&!/cancel/i.test(e.status),status:e.status};
  if(out.ok&&!/drafting/i.test(e.status)&&SET.publish==null&&!/claimed|assigned/i.test(e.status)){ await fetch('/routes/'+num(R)+'/change_status',{method:'POST',headers:FORM,body:new URLSearchParams({authenticity_token:tok(await load(R)),'route[event]':'to_drafting','route[status]':'drafting'}).toString()}); e=state(await load(R)); out.status=e.status; out.note='FRH brought it back '+out.status+'; set back to Drafting'; }
  if(out.ok&&want&&!f){ const w=await S(R,{date:SET.date,start:SET.start,...(SET.end?{end:SET.end}:{}),...(SET.hours?{hours:SET.hours}:{})},false); out.window=w; }
  return out; };

// ===== PUBLISH: true = without notifications, 'notify' = with FRH's notifications, 'draft' = back to Drafting. Template: true publishes it (its rescues are made as Drafting), 'draft' unpublishes =====
const Pb=async(R,how,DRY=true)=>{ const tp=isT(R); if(tp&&!TP()) return {errs:[NOTPL]}; const d=await load(R), s=state(d), errs=[], m=how===true||how==='quiet'?'quiet':String(how).toLowerCase(), drafting=/drafting/i.test(s.status);
  if(!['quiet','notify','draft'].includes(m)) errs.push('use true (no notifications), "notify" or "draft"');
  if(/cancel|complete|progress/i.test(s.status)) errs.push('not on a '+s.status+(tp?' template':' rescue'));
  if(m!=='draft'&&!drafting) errs.push('already published ('+s.status+')'); if(m==='draft'&&drafting) errs.push('already Drafting');
  if(tp) TP().Pb.check(m,errs);
  const note=m==='notify'?'FRH notifies volunteers about this rescue':m==='quiet'?(tp?TP().Pb.note:'no notifications; volunteers can see and claim it in the app'):'back to Drafting: volunteers can no longer see or claim it';
  if(DRY||errs.length) return {errs,status:s.status,to:m,note,undo:m==='draft'?true:'draft'};
  const body=new URLSearchParams({authenticity_token:tok(d)}); let url;
  if(tp) url=TP().Pb.url(R,m);
  else if(m==='draft'){ url='/routes/'+num(R)+'/change_status'; body.set('route[event]','to_drafting'); body.set('route[status]','drafting'); }
  else url='/routes/'+num(R)+'/publish'+(m==='quiet'?'?send_notifications=false':'');
  const r=await fetch(url,{method:'POST',headers:FORM,body:body.toString()}), e=state(await load(R));
  return {ok:r.status<400&&(m==='draft'?/drafting/i.test(e.status):!/drafting/i.test(e.status)),status:e.status,note}; };

// ===== PLAN / APPLY: one entry point, fixed save order. R = rescue number, or 'T' + template number =====
// C = {uncancel: Un SET, items: W SET, add: I ADD, recips: R PLAN, vol: name|id|0, window: S SET, tags: {add,del} | {vehicle}, publish: true|'notify'|'draft', cancel: reason}
const ORDER=[['uncancel',Un],['items',W],['add',I],['recips',Rcp],['vol',(R,c,D)=>A(R,c,true,D)],['window',S],['tags',T],['publish',Pb],['cancel',Cn]];
const one=async(R,C,D)=>{ const out={R}, errs=[], undo={}; if(isT(R)&&!TP()) return {R,ok:false,errs:[NOTPL],undo};
  let PI; if(C.items&&C.recips&&!isT(R)){ try{ const sn=await snap(R); PI=Object.fromEntries(sn.its.map((it,k)=>[sn.dids[k],C.items[it.id]?.qty]).filter(x=>x[1]!=null)); }catch(e){} } // a plan checks drop-offs against the planned pickup quantities
  for(const [k,f] of ORDER){ if(C[k]==null) continue;
    let x; try{ x=k==='recips'?await Rcp(R,C[k],true,undefined,PI):await f(R,C[k],true); }catch(e){ x={errs:['helper error: '+e.message]}; }
    (x.errs||[]).forEach(e=>errs.push(k+': '+e)); if(x.undo!=null) undo[x.undoAs||k]=x.undo; out[k]=x; ['undo','undoAs','errs','donors','split','totals'].forEach(z=>delete x[z]); }
  if(D||errs.length) return {...out,errs,undo};
  const res={R}; let ok=true;
  for(const [k,f] of ORDER){ if(C[k]==null) continue;
    let x; try{ x=await f(R,C[k],false); }catch(e){ x={ok:false,err:'helper error: '+e.message}; }
    delete x.donors; delete x.split; res[k]=x; if(!x.ok){ ok=false; res.stoppedAt=k; break; } }
  return {...res,ok,undo}; };
const plan=async(R,C)=>Array.isArray(R)?{rescues:await Promise.all(R.map(([r,c])=>one(r,c,true)))}:one(R,C,true);
const apply=async(R,C)=>{ if(!Array.isArray(R)) return one(R,C,false); const out=[]; for(const [r,c] of R){ const x=await one(r,c,false); out.push(x); if(!x.ok) break; } return {ok:out.length===R.length&&out.every(x=>x.ok),rescues:out}; };
// templates only through plan/apply (or the reads below) and with the templates module loaded
const G_=f=>async(R,...a)=>isT(R)&&!TP()?{errs:[NOTPL]}:f(R,...a);
reg('rescues',10,{plan,apply,S:G_(S),R:G_(Rcp),W:G_(W),I:G_(I),X,diff},{snap,Rcp,S,Pb,Cn,one});
})()