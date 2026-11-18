(()=>{
// ===== VERSION: bump V here and in the frh-change-rescues loader on any change =====
// No organization values live in this code: tags, recipients, cancel reasons and the org id are read from the page.
// A team's shortcuts are optional and live in this browser only: localStorage.frhTeam = JSON {name, vols:[[short name, FRH name, user_id]], vehicles:[tag names], baseTag, plus any lists the team's own skills read from frh.cfg}
const V=9;
let team={}; try{ team=JSON.parse(localStorage.frhTeam||'{}')||{}; }catch(e){}
const cfg={...team,team:team.name||'',vols:team.vols||[],vehicles:team.vehicles||[],baseTag:team.baseTag||''};
// ===== LIB =====
const drop=(k,v)=>v==null||v===''||(Array.isArray(v)&&!v.length)?undefined:v;
const j=o=>JSON.stringify(o,drop).replace(/=/g,' : ').replace(/&/g,'+').replace(/\?/g,'');
const norm=s=>String(s??'').toLowerCase().replace(/\s+/g,' ').trim(), stopOf=a=>(String(a).match(/route_stops\/(\d+)/)||[])[1];
const nm=(s,v)=>[...(s?.options||[])].find(o=>o.value==v)?.textContent.trim();
const parseHTML=t=>new DOMParser().parseFromString(t,'text/html');
// a rescue is its number; a template is 'T' + its number (T6514)
const isT=R=>/^T\d+$/i.test(String(R)), num=R=>String(R).replace(/^T/i,''), base=R=>(isT(R)?'/route_templates/':'/routes/')+num(R);
const load=async R=>parseHTML(await (await fetch(base(R))).text());
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const mins=t=>{const m=String(t).trim().toUpperCase().replace(/\s+/g,'').match(/^(\d{1,2})(?::(\d\d))?([AP])M?$/); if(!m) return null; return (+m[1]%12+(m[3]==='P'?12:0))*60+(+(m[2]||0));};
const fmtT=n=>{const h=Math.floor(n/60)%24,m=n%60; return ((h+11)%12+1)+':'+String(m).padStart(2,'0')+' '+(h<12?'AM':'PM');};
const fmtD=s=>{let m=String(s).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), y,mo,d; if(m){y=+m[1];mo=+m[2];d=+m[3];} else if((m=String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))){mo=+m[1];d=+m[2];y=+m[3]<100?2000+ +m[3]:+m[3];} else { const x=new Date(s); if(isNaN(x)) return null; y=x.getFullYear();mo=x.getMonth()+1;d=x.getDate(); }
  const dt=new Date(y,mo-1,d); if(dt.getMonth()!==mo-1) return null; return MON[mo-1]+' '+String(d).padStart(2,'0')+', '+y;};
const REP={weekly:/^1:/,'every other week':/^2:/,monthly:/month/}, repOf=v=>Object.keys(REP).find(k=>REP[k].test(v))||'', repKind=r=>r?norm(r).replace(/^bi-?weekly$/,'every other week'):'';
const state=d=>{const a=[...d.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Volunteer')?.closest('.well')?.querySelector('a[href^="/users/"][href$="/edit"]');
  return {status:d.querySelector('#new-state')?.textContent.trim()||[...d.querySelectorAll('.status-pill-container .current-status')].map(e=>e.textContent.trim()).join(' '),tags:[...d.querySelectorAll('.remove-tag')].map(b=>+b.dataset.tagId),vol:a?.textContent.replace(/\s+/g,' ').trim()||'none',volId:+(a?.getAttribute('href').match(/\d+/)?.[0]||0)};};
const items=d=>[...d.querySelectorAll('form[id^=edit_route_stop_item_]')].map(f=>{const id=f.id.split('_').pop(), x=p=>d.querySelector('[id^="'+p+'-'+id+'-"]:is(input,select)'), q=x('number-field'), ft=x('food-type'), un=x('unit');
  const est=[...(q?.parentElement.querySelectorAll('[name="route_stop_item[estimated]"]')||[])].filter(e=>!e.disabled).map(e=>e.value).pop();
  const defs=JSON.parse((ft?.getAttribute('onchange')||'').match(/\[\[.*?\]\]/)?.[0]||'[]');
  return {id,stop:stopOf(f.getAttribute('action')),action:f.getAttribute('action'),qn:q?.name,qty:q?.value,est,food:ft?.value,unit:un?.value,desc:x('description')?.value,lbs:x('unit-weight')?.value,type:nm(ft,ft?.value)+' / '+nm(un,un?.value),ft,un,defs};});
const info=d=>({totals:(d.body.textContent.replace(/\s+/g,' ').match(/Total Donation Weight [\d,.]+ lbs/g)||[]).map(s=>s.slice(22)),
  split:[...d.querySelectorAll('*')].filter(e=>!e.children.length&&/^\s*Food:/.test(e.textContent)).map(e=>e.closest('tr')?.textContent.replace(/\s+/g,' ').trim())});
const tok=d=>d.querySelector('meta[name=csrf-token]').content;
const ajax=()=>({'X-CSRF-Token':tok(document),'X-Requested-With':'XMLHttpRequest','Accept':'application/json, text/javascript, */*; q=0.01'});
const FORM={'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'};
// names -> ids from cfg
const volId=u=>{ if(u==null||u==='') return null; if(/^\d+$/.test(String(u))) return +u; const n=norm(u), m=[...new Set(cfg.vols.filter(v=>norm(v[0])===n||norm(v[1])===n).map(v=>v[2]))]; return m.length===1?m[0]:null; };
const tagMap=d=>{ const m={}; d.querySelectorAll('.tag-select option').forEach(o=>{ if(o.value) m[o.value]=o.textContent.trim(); });
  d.querySelectorAll('.remove-tag').forEach(b=>{ const n=(b.parentElement?.textContent||'').replace(/\u00d7/g,'').replace(/\s+/g,' ').trim(); if(n) m[b.dataset.tagId]=n; }); return m; };
const tn=s=>norm(s).replace(/ \(\d+\)$/,'');
const tagId=(M,t)=>/^\d+$/.test(String(t))?+t:(x=>x?+x[0]:null)(Object.entries(M).find(([,n])=>tn(n)===tn(t)));
const tagName=(M,id)=>M[id]?M[id].replace(/ \(\d+\)$/,''):String(id);
const short=n=>String(n||'').replace(/\s*\(.*$/,'').trim();

// ===== FIND: search list, all pages, one compact row per rescue =====
const mdy=s=>{const x=String(s).trim(); let m=x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if(m) return m[2].padStart(2,'0')+'/'+m[3].padStart(2,'0')+'/'+m[1];
  m=x.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/); if(m){const y=m[3]?(m[3].length===2?'20'+m[3]:m[3]):String(new Date().getFullYear()); return m[1].padStart(2,'0')+'/'+m[2].padStart(2,'0')+'/'+y;} return x;};
const find=async(text='',from,to,type='all')=>{ to??=from; const rows=[]; let url='/?rescue_search_text='+encodeURIComponent(text)+'&rescue_type='+type+'&rescue_date_range='+encodeURIComponent(mdy(from)+' - '+mdy(to))+'&rescue_sort=pickup_time+ASC', pages=0;
  while(url&&pages<10){ const d=parseHTML(await (await fetch(url)).text()); pages++; const rf=d.querySelector('[name=rescue_date_range]');
    if(pages===1&&rf&&!rf.value) return {n:0,errs:['FRH did not accept the date range '+mdy(from)+' - '+mdy(to)+' (the end date is too far ahead, more than about 7 weeks out). Search a shorter range.'],rows:[]};
    d.querySelectorAll('.data-row.delivery-row[data-href]').forEach(r=>{ const c=[...r.children], t=i=>(c[i]?.textContent||'').replace(/\s+/g,' ').trim();
      const list=i=>{const a=[...(c[i]?.querySelectorAll('li a')||[])].map(x=>short(x.textContent)); return a.length?a.join(' + '):short(t(i));};
      const qty=(t(5).match(/\d+(\.\d+)? \w+/g)||[]).reduce((m,s)=>{const [n,u]=s.split(' '); m[u]=(m[u]||0)+ +n; return m;},{});
      rows.push([(/route_templates/.test(r.dataset.href)?'T':'')+r.dataset.href.split('?')[0].split('/').pop(), t(6).replace(/(\d{2}\/\d{2})\s*(\d)/,'$1 $2').replace(/ - /,'-'), t(7), list(3), list(4), Object.entries(qty).map(([u,n])=>n+' '+u).join(','), t(8)].join(' | ')); });
    url=d.querySelector('.pagination li.next:not(.disabled) a')?.getAttribute('href'); }
  return {n:rows.length,cols:'R | pickup | state | donors | recipients | items | volunteer',rows}; };

// ===== WHO: live lookup of a volunteer not in cfg =====
const who=async(name,R)=>{ let t=await (await fetch('/users?search_terms='+encodeURIComponent(name)+'&div_name=user-search-results&partial_name=routes/user_list&background_check_enabled=false&states[]=0&states[]=1&states[]=2&states[]=3&route_id='+R,{headers:{'X-Requested-With':'XMLHttpRequest','Accept':'text/javascript, */*; q=0.01'}})).text();
  t=t.replace(/\\n/g,'\n').replace(/\\\//g,'/').replace(/\\"/g,'"').replace(/\\'/g,"'");
  const hits=[...parseHTML(t).querySelectorAll('[onclick]')].map(e=>({id:+((decodeURIComponent(e.getAttribute('onclick')).match(/user_id\]=(\d+)/)||[])[1]||0),txt:e.textContent.replace(/\s+/g,' ').trim().slice(0,70)})).filter(x=>x.id);
  const ok=hits.filter(x=>!/#admin/i.test(x.txt)), ex=ok.filter(x=>norm(x.txt).startsWith(norm(name)+' ')), cnt=x=>+(x.txt.match(/(\d+) rescues/)||[0,0])[1]; return {name,exact:ex.length,hits:(ex.length?ex:ok).sort((a,b)=>cnt(b)-cnt(a)).slice(0,5).map(x=>x.id+' '+x.txt)}; };

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

// ===== S: schedule. SET = {date?, start?, end?, hours?} or a 'from' string; templates (T…) also take repeat: 'weekly' | 'every other week' | 'monthly' =====
const S=async(R,S={},DRY=true)=>{
  const day=s=>{if(!s) return 'bad date'; const x=new Date(s.replace(/,/g,'')); return x.toLocaleDateString('en-US',{weekday:'short'})+' '+x.toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'});};
  if(typeof S==='string'){ const m=S.replace(/^[A-Za-z]{3},? /,'').match(/^(\S+) (.+?) - (.+)$/); S=m?{date:m[1],start:m[2],end:m[3]}:{date:S}; }
  const tp=isT(R), parse=d=>{const f=d.getElementById(tp?'route-template-reschedule':'route-reschedule'); if(!f) return null; const v=n=>f.querySelector('[name="'+(tp?n:'route['+n+']')+'"]');
    const sel=x=>[...x.options].find(o=>o.selected)?.value??x.value, dv=[...v('duration_in_hours').options].map(o=>o.value);
    const date=fmtD(v('start_date').getAttribute('value').replace(/^(\w+), (\d+)/,'$1 $2,')), start=sel(v('start_time')), dur=+sel(v('duration_in_hours'));
    return {f,date,start,dur,rep:tp?sel(v('repetition')):'',M:tagMap(d),org:(d.documentElement.innerHTML.match(/BusinessHours\.fetch\((\d+)\)/)||[])[1],end:fmtT(mins(start)+dur*60),starts:[...v('start_time').options].map(o=>o.value),durs:dv.map(Number),durv:dv,...state(d),
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
  const kind=S.repeat!=null?repKind(S.repeat):repOf(P.rep); if(S.repeat!=null&&!tp) errs.push('repeat is for templates: to make a rescue recurring, copy it with repeat (frh-create-rescues)'); else if(tp&&!REP[kind]) errs.push('repeat must be weekly, every other week or monthly'); else if(tp&&kind==='monthly'&&!(repOf(P.rep)==='monthly'&&date===P.date)) errs.push('a monthly repeat on a new date is set in the page (its choices depend on the date)');
  const want={date,start,end:sm!=null&&!errs.length?fmtT(sm+dur*60):'-',dur,rep:!tp?'':kind===repOf(P.rep)?P.rep:kind==='weekly'?'1:':'2:'};
  if(!errs.length&&window.TimeValidation){ try{ window.frhBH??=window.BusinessHours&&P.org?await BusinessHours.fetch(+P.org):[]; }catch(e){ window.frhBH=[]; }
    TimeValidation.validateScheduleTimes({startDate:date,startTime:start,duration:dur},window.frhBH||[]).issues.forEach(i=>(i.type==='blocker'?errs:warn).push(i.message)); }
  const claimed=/Claimed|In Progress/.test(P.status)?'FRH may notify '+P.vol:'';
  if(DRY||errs.length) return {errs,warn,status:P.status,from:row(P),to:row(want),note:claimed,undo:{date:P.date,start:P.start,hours:P.dur,...(tp?{repeat:repOf(P.rep)}:{})}};
  const r=await fetch(P.f.getAttribute('action'),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(tp?{authenticity_token:P.tok,create_current_instance:'false',start_date:date,repetition:want.rep,start_time:start,duration_in_hours:P.durv[P.durs.indexOf(dur)]}:{authenticity_token:P.tok,'route[start_date]':date,'route[start_time]':start,'route[duration_in_hours]':P.durv[P.durs.indexOf(dur)]}).toString()});
  const Q=parse(await load(R)), ok=r.status<400&&Q.date===want.date&&Q.start===want.start&&Q.dur===want.dur&&Q.rep===want.rep&&Q.status===P.status;
  return {ok,saved:row(Q),status:Q.status,tagsChanged:P.tags.join(',')!==Q.tags.join(',')?P.tags.map(t=>tagName(P.M,t))+' -> '+Q.tags.map(t=>tagName(Q.M,t)):'',log:ok?'':Q.log.concat('http '+r.status)}; };

// ===== R: recipients. PLAN = complete final list of drop-offs [{to, from?, qty?}] =====
const Rcp=async(R,PLAN,DRY=true)=>{
  const label=q=>{let p=q; while(p.parentElement&&!p.parentElement.querySelector('select,button,a')&&p.parentElement.querySelectorAll('input[name$="[quantity_estimated]"]').length===1) p=p.parentElement; return p.textContent.replace(/\s+/g,' ').replace(/\(Est\)/,'').trim();};
  const parse=d=>{const f=d.getElementById('update-dropoffs'); if(!f) return null;
    const tpl=parseHTML(f.querySelector('a.add_fields')?.getAttribute('data-association-insertion-template')||'');
    const opts=[...(tpl.querySelector('select')?.options||[])].filter(o=>o.value).map(o=>({id:o.value,name:o.textContent.trim()}));
    const its=[...tpl.querySelectorAll('input[name$="[quantity_estimated]"]')].map(q=>({did:q.parentElement.querySelector('[name$="[donation_item_id]"]').value,name:label(q)}));
    let pi=JSON.parse(([...d.scripts].map(s=>s.textContent).find(t=>t.includes('pickupItemsArray'))||'').match(/\[\[.*\]\]/)?.[0]||'[]').map(x=>[String(x[0]),+x[1]]);
    if(!pi.length){ const pf=[...d.querySelectorAll('form[id^=edit_route_stop_item_]')].map(x=>{const id=x.id.split('_').pop(), g=p=>d.querySelector('[id^="'+p+'-'+id+'-"]:is(input,select)')?.value; return {q:+g('number-field'),desc:(g('description')||'').replace(/\s+/g,' ').trim()};});
      if(pf.length===its.length&&pf.every((p,i)=>its[i].name.includes(p.desc))) pi=its.map((it,i)=>[it.did,pf[i].q]); }
    const status={}; d.querySelectorAll('.dropoff-details .list-group-item').forEach(x=>{const id=x.querySelector('a[href*="recipient_locations/"]')?.getAttribute('href').match(/recipient_locations\/(\d+)/)?.[1]; if(id) status[id]=x.querySelector('.current-status')?.textContent.trim();});
    const stops={};
    for(const e of f.elements){ const m=e.name?.match(/^route(?:_template)?\[route_stops_attributes\]\[(\d+)\]\[(\w+)\]$/), mi=e.name?.match(/^route(?:_template)?\[route_stops_attributes\]\[(\d+)\]\[route_stop_items_attributes\]\[(\d+)\]\[(\w+)\]$/);
      if(m){ const s=(stops[m[1]]??={f:{},items:{}}); s.f[m[2]]=e.value; if(m[2]==='location_id') s.f.swappable=e.tagName==='SELECT'; }
      else if(mi) ((stops[mi[1]]??={f:{},items:{}}).items[mi[2]]??={})[mi[3]]=e.value; }
    const list=Object.entries(stops).map(([k,s])=>({k,...s.f,loc:opts.find(o=>o.id==s.f.location_id)?.name,st:status[s.f.location_id],items:Object.values(s.items)})).sort((a,b)=>a.order-b.order);
    return {f,opts,pi,items:its,list,tok:tok(d)};};
  const P=parse(await load(R)); if(!P) return {errs:['no recipients form on '+base(R)]};
  const errs=[], sh=n=>(n||'').split(' - ')[0];
  if(!Array.isArray(PLAN)) return {errs:[],cols:'order | recipient | status | qty',now:P.list.map(s=>[s.order,s.location_id+' '+sh(s.loc),s.st||'-',s.items.map(i=>+i.quantity_estimated).join(',')].join(' | '))};
  const findLoc=v=>{ const h=/^\d+$/.test(String(v))?P.opts.filter(o=>o.id==v):P.opts.filter(o=>o.name.toLowerCase().includes(String(v).toLowerCase()));
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
  P.items.forEach((it,i)=>{const pk=P.pi.find(x=>x[0]==it.did)?.[1]; if(pk!=null&&tot[i]>pk) errs.push('over-distributed: '+it.name+' '+tot[i]+' of '+pk);});
  if(!out.length) errs.push('plan leaves no recipients');
  const row=s=>[s.order,s.location_id+' '+sh(s.loc),s.st||'-',s.items.map(i=>+i.quantity_estimated).join(','),s.tag||''].join(' | ').replace(/ \| $/,'');
  if(DRY||errs.length) return {errs,cols:'order | recipient | status | qty: '+P.items.map(i=>i.name.replace(/^Pallets (of )?Assorted /,'')).join(','),plan:out.map(row),removed:removed.map(row),
    totals:tot.map((t,i)=>t+'/'+(P.pi.find(x=>x[0]==P.items[i].did)?.[1]??'?')).join(','),
    undo:P.list.map(s=>({to:+s.location_id,qty:Object.fromEntries(s.items.map(i=>[i.donation_item_id,+i.quantity_estimated]))}))};
  const pf=isT(R)?'route_template':'route', b=new URLSearchParams({_method:'patch',authenticity_token:P.tok,...(isT(R)?{}:{'route[edit_drop_offs_admin]':'true'}),[pf+'[id]']:num(R)});
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

// ===== C: create one rescue through the New Rescue wizard (/urc/new, a fresh page per rescue). Saves only as Draft.
// frh.C(spec) fills and checks (saves nothing) -> frh.Cpreview() -> frh.Cstatus() until ready -> frh.Csave()
// spec = {donor, date, start, end?|hours?, to: recipient, items:[{food, unit, qty, lbs?, desc, est?}], repeat?: 'weekly' | 'every other week' | 'monthly'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,ms=15000)=>{const t=Date.now(); while(Date.now()-t<ms){ try{const v=f(); if(v) return v;}catch(e){} await sleep(300);} return null;};
const fire=(e,t='change')=>e.dispatchEvent(new Event(t,{bubbles:true}));
const pick=(sel,v)=>{ if(v==null||v==='') return {errs:['missing']}; const os=[...sel.options].filter(o=>o.value); let h=os.filter(o=>o.value==v); if(!h.length) h=os.filter(o=>norm(o.textContent)===norm(v)); if(!h.length) h=os.filter(o=>norm(o.textContent).includes(norm(v)));
  return h.length===1?{o:h[0]}:{errs:[h.length+' match '+v+(h.length?': '+h.slice(0,5).map(o=>o.value+' '+o.textContent.trim()).join(' / '):'')]}; };
const NI=k=>[...document.querySelectorAll('[name="route[donation_attributes][donation_items_attributes][]['+k+']"]')];
const nav=()=>[...document.querySelectorAll('[id^=step][id$=_item]')].map(l=>l.id[4]+(/step-completed/.test(l.className)?'+':/active/.test(l.className)?'*':'-')).join(' ');
const box=()=>{let p=document.getElementById('step1'); while(p&&!(p.scrollHeight>p.clientHeight+10&&/auto|scroll/.test(getComputedStyle(p).overflowY))) p=p.parentElement; return p||document.scrollingElement;};
const step=async n=>{ const b=box(), e=document.getElementById('step'+n), ok=()=>new RegExp(n+'[*+]').test(nav()); document.getElementById('step'+(n-1)).scrollIntoView(); await sleep(800);
  b.scrollBy(0,e.getBoundingClientRect().top-b.getBoundingClientRect().top-150); await sleep(600); for(let i=0;i<60&&!ok();i++){ b.scrollBy(0,25); await sleep(300); } return ok(); };
// date and window on the wizard; returns the page's values
const sched=async(spec,errs)=>{ const g=i=>document.getElementById(i), sd=g('route_start_date'), st=g('route_start_time'), du=g('route_duration_in_hours');
  if(spec.date){ const d=fmtD(spec.date); if(!d) errs.push('bad date '+spec.date); else { $(sd).val(d).trigger('change'); await sleep(1000); } }
  if(spec.start){ const s=mins(spec.start), o=s==null?null:[...st.options].find(o=>o.value===fmtT(s)); if(!o) errs.push('start '+spec.start+' not an option (15-min steps)'); else $(st).val(o.value).trigger('change'); }
  const hrs=errs.some(e=>/^start/.test(e))?null:spec.hours!=null?+spec.hours:spec.end?(mins(spec.end)-mins(st.value))/60:null;
  if(hrs!=null){ const o=[...du.options].find(o=>+o.value===hrs); if(!o) errs.push('window '+hrs+' h not allowed'); else $(du).val(o.value).trigger('change'); }
  return {date:$(sd).val(),window:()=>$(sd).val()+' '+st.value+', '+du.value+' h'}; };
// the Recurring switch, set last (after the items are distributed). Returns 'off' or the repeat line with the first dates
const recur=async(rep,errs)=>{ const g=i=>document.getElementById(i), rc=g('recurrence_checkbox'), rp=g('repetition'), kind=repKind(rep);
  if(kind&&!REP[kind]){ errs.push('repeat must be weekly, every other week or monthly'); return ''; }
  if(!!kind!==rc.checked){ rc.click(); await sleep(1200); } if(!!kind!==rc.checked){ errs.push('Recurring would not turn '+(kind?'on':'off')); return ''; }
  if(!kind) return 'off';
  const o=[...rp.options].find(o=>REP[kind].test(o.value)); if(!o){ errs.push('no '+kind+' choice for that date'); return ''; } $(rp).val(o.value).trigger('change'); await sleep(1000);
  return o.textContent.trim()+'; first dates: '+g('sample-dates').innerText.replace(/\*/g,'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,3).join(' / '); };
const C=async(spec)=>{
  if(!location.pathname.startsWith('/urc/new')||window.frhC) return {errs:['navigate to /urc/new first (a fresh page for every rescue)']};
  const errs=[];
  const ds=await until(()=>{const s=document.getElementById('donor_location_id'); return s&&s.options.length>1&&s;}); if(!ds) return {errs:['page not ready']};
  const d=pick(ds,spec.donor); if(d.errs) return {errs:d.errs.map(e=>'donor: '+e)};
  $(ds).val(d.o.value).trigger('change'); if(!await until(()=>Object.values(donors_list).map(String).includes(d.o.value))) return {errs:['donor did not load: reload /urc/new and run again']};
  const its=spec.items||[]; if(!its.length) return {errs:['no items']};
  while(NI('quantity').length<its.length){ [...document.querySelectorAll('a.add-item-button')].pop().click(); await sleep(400); }
  const q=NI('quantity'),ft=NI('food_type_id'),un=NI('donation_item_unit_id'),w=NI('weight'),de=NI('description'),es=NI('estimated'),dl=NI('donor_location_id'), rows=[];
  for(let i=0;i<its.length;i++){ const a=its[i], n='#'+(i+1);
    if(dl[i]&&dl[i].value!=d.o.value){ dl[i].value=d.o.value; fire(dl[i]); }
    const f=pick(ft[i],a.food), u=pick(un[i],a.unit); if(f.errs){errs.push(n+' category: '+f.errs[0]);continue;} if(u.errs){errs.push(n+' pack: '+u.errs[0]);continue;}
    if(!(+a.qty>=1)) errs.push(n+': qty must be 1 or more'); if(!a.desc) errs.push(n+': description required');
    q[i].value=String(a.qty); fire(q[i],'input'); fire(q[i]);
    ft[i].value=f.o.value; fire(ft[i]); await sleep(150); un[i].value=u.o.value; fire(un[i]); await sleep(150);
    const own=a.lbs!=null&&a.lbs!==''; if(own){ w[i].value=String(Math.ceil(+a.lbs)); fire(w[i],'input'); fire(w[i]); } else if(!(+w[i].value>0)) errs.push(n+': no default weight for '+f.o.textContent.trim()+' / '+u.o.textContent.trim()+', give lbs');
    de[i].value=a.desc||''; fire(de[i],'input'); fire(de[i]); if(es[i]&&!!a.est!==es[i].checked) es[i].click();
    rows.push((i+1)+': '+a.qty+' x '+w[i].value+' lbs tot '+(+a.qty*+w[i].value)+' | '+f.o.textContent.trim()+' / '+u.o.textContent.trim()+' | '+a.desc+(own?(+a.lbs!==Math.ceil(+a.lbs)?' ('+a.lbs+' rounded up)':''):' (default)')); }
  const sc=await sched(spec,errs);
  if(errs.length) return {errs,items:rows};
  if(!await step(2)||!await step(3)||!await step(4)) return {errs:['wizard did not advance ('+nav()+'): reload /urc/new and run again']};
  const rs=await until(()=>{const s=document.getElementById('recipient_location_id_'); return s&&s.options.length>1&&![...document.querySelectorAll('#step4 .recommendation-loader-content')].some(e=>e.offsetParent)&&document.querySelector('#step4 .rec-selector')?.offsetParent&&s;},45000); await sleep(1500); if(!rs) return {errs:['recipient list did not load: reload /urc/new and run again']};
  const to=[].concat(spec.to||[]); if(to.length!==1) return {errs:['give exactly one recipient: add more stops and splits afterwards with frh-change-rescues']};
  const p=pick(rs,to[0]); if(p.errs) return {errs:['recipient: '+p.errs[0]]}; const rn=p.o.textContent.trim();
  $(rs).val(p.o.value).trigger('change'); if(!await until(()=>[...document.querySelectorAll('#step4 a,#step4 h3,#step4 h4,#step4 h5,#step4 span,#step4 div')].some(e=>e.offsetParent&&!e.closest('.select2-container,select')&&!e.children.length&&norm(e.textContent)===norm(rn)),10000)) return {errs:['details did not open for '+rn]}; await sleep(500);
  const b=await until(()=>[...document.querySelectorAll('#step4 .rec-selector')].find(b=>b.offsetParent&&b.textContent.trim()==='Select'),8000); if(!b) return {errs:['no Select button for '+rn]}; b.click(); await sleep(800);
  if(!(document.querySelector('[name=non_profits_selected]')?.value||'').split(',').includes(p.o.value)) return {errs:['recipient not selected: '+rn]};
  if(!await step(5)) return {errs:['distribution step did not open ('+nav()+')']};
  if(!await until(()=>/All items have been distributed/.test(document.getElementById('step5').textContent),10000)) return {errs:['the distribution step did not load: reload /urc/new and run again']};
  const rec=await recur(spec.repeat,errs); if(errs.length) return {errs};
  window.frhC={date:sc.date,repeat:repKind(spec.repeat)};
  return {errs,donor:d.o.value+' '+d.o.textContent.trim(),window:sc.window(),recurring:rec,items:rows,total:rows.reduce((a,r)=>a+ +(r.match(/tot (\d+)/)||[0,0])[1],0)+' lbs',to:p.o.value+' '+rn,next:'confirm with the Requester, then frh.Cpreview()'}; };
// ===== K: copy an existing rescue (FRH's Actions > Copy) = frh.copy. On /urc/new?mode=copy&route_id=<R>: frh.copy({date, start?, end?|hours?, repeat?, items?:{'#n'|'<description>':{qty?, lbs?}}})
// fills and checks (saves nothing); then frh.Cpreview() -> frh.Cstatus() -> frh.Csave() as for C. FRH keeps donor, items, recipients + split and the window time;
// the date resets to today, the volunteer and added tags are not copied, every item comes back Estimated. With repeat, the copy is saved as a recurring template.
const K=async(spec={})=>{
  const qs=new URLSearchParams(location.search), R=qs.get('route_id');
  if(!location.pathname.startsWith('/urc/new')||qs.get('mode')!=='copy'||!R) return {errs:['navigate to /urc/new?mode=copy&route_id=<R> first (a fresh page for every copy)']};
  if(window.frhC) return {errs:['already filled on this page: reload the copy page to start over']};
  const errs=[];
  const sq=()=>[...document.querySelectorAll('input[id^=stop_quantity_]')];
  if(!await until(()=>NI('quantity').length&&sq().length&&/All items have been distributed/.test(document.getElementById('step5')?.textContent||''),20000)) return {errs:['copy did not load (no items or distribution): reload the page']};
  const q=NI('quantity'),ft=NI('food_type_id'),un=NI('donation_item_unit_id'),w=NI('weight'),de=NI('description'),es=NI('estimated');
  const stops=sq().map(e=>{const p=e.id.split('_'); return {e,rec:p[p.length-3],i:+p[p.length-1]};}), recs=[...new Set(stops.map(s=>s.rec))], changed=new Set();
  for(const [k,v] of Object.entries(spec.items||{})){ let i; const m=String(k).match(/^#?(\d+)$/);
    if(m) i=+m[1]-1; else { const h=de.map((d,x)=>norm(d.value)===norm(k)?x:-1).filter(x=>x>=0); if(h.length!==1){errs.push('item "'+k+'": '+h.length+' match by description; use #n'); continue;} i=h[0]; }
    if(!q[i]){errs.push('item '+k+': no such item'); continue;}
    if(v.qty!=null&&v.qty!==''){ const st=stops.filter(s=>s.i===i+1);
      if(!(+v.qty>=1)){errs.push('item '+k+': qty must be 1 or more (zero it afterwards with frh-change-rescues)'); continue;}
      if(recs.length!==1||st.length!==1){errs.push('item '+k+': the original splits items between recipients; copy without this change, then fix qty and split with frh-change-rescues'); continue;}
      q[i].value=String(+v.qty); fire(q[i],'input'); fire(q[i]); $(q[i]).trigger('change');
      st[0].e.value=String(+v.qty); ['input','change','keyup','blur'].forEach(t=>fire(st[0].e,t)); $(st[0].e).trigger('change'); changed.add(i); }
    if(v.lbs!=null&&v.lbs!==''){ if(!(+v.lbs>0)){errs.push('item '+k+': lbs must be above 0'); continue;} w[i].value=String(Math.ceil(+v.lbs)); fire(w[i],'input'); fire(w[i]); changed.add(i); } }
  if(!spec.date) errs.push('date required (Copy resets it to today)'); const sc=await sched(spec,errs);
  q.forEach((e,i)=>{ const tot=stops.filter(s=>s.i===i+1).reduce((a,s)=>a+ +s.e.value,0); if(tot!==+e.value) errs.push('#'+(i+1)+': '+e.value+' on the pickup but '+tot+' distributed'); });
  const rows=q.map((e,i)=>(i+1)+': '+e.value+' x '+w[i].value+' lbs tot '+(+e.value*+w[i].value)+' | '+nm(ft[i],ft[i].value)+' / '+nm(un[i],un[i].value)+' | '+de[i].value+(es[i]?.checked?' | est':'')+(changed.has(i)?' (changed)':''));
  const rsel=document.getElementById('recipient_location_id_'), donor=[...(document.querySelector('[name="selected_donors[]"]')?.selectedOptions||[])].map(o=>o.textContent.trim()).join(', ');
  const rec=errs.length?'':await recur(spec.repeat,errs);
  if(!errs.length) window.frhC={date:sc.date,repeat:repKind(spec.repeat),copy:R,want:q.map(e=>String(+e.value))};
  return {errs,copyOf:R,donor,window:sc.window(),recurring:rec,items:rows,total:rows.reduce((a,r)=>a+ +(r.match(/tot (\d+)/)||[0,0])[1],0)+' lbs',
    to:recs.map(r=>r+' '+(nm(rsel,r)||'')+' ('+stops.filter(s=>s.rec===r).map(s=>s.e.value).join(',')+')'),notCopied:'volunteer and added tags (add with frh-change-rescues)',next:errs.length?'':'confirm with the Requester, then frh.Cpreview()'}; };
const Cbg=spec=>{ if(window.frhCjob) return {errs:['already filled on this page: navigate to a fresh /urc/new to start over']}; const j=window.frhCjob={t:Date.now()}; C(spec).then(r=>j.res=r,e=>j.res={errs:['helper error: '+e.message]}); return {started:true,next:'frh.Cstatus() in about 30 s'}; };
const Cpreview=()=>{ if(!window.frhC) return {errs:['run frh.C(spec) first']}; if(document.getElementById('recurrence_checkbox').checked!==!!window.frhC.repeat) return {errs:['the Recurring switch does not match the plan: reload the page and start over']};
  if(window.frhC.preview) return {errs:['preview already started: never start a second one on this page (stale previews save empty rescues). Use frh.Cstatus(); if it never finishes, reload /urc/new and start over']};
  window.frhC.preview=Date.now(); generateRoute(); return {started:true,next:'frh.Cstatus() every 20-30 s; previews can take 2 min'}; };
const Cstatus=()=>{ const c=window.frhC, j=window.frhCjob; if(!c?.preview){ if(!j) return {errs:['nothing started: frh.C(spec)']}; return j.res||{filling:true,secs:Math.round((Date.now()-j.t)/1000),hint:Date.now()-j.t>120000?'over 2 min: navigate to a fresh /urc/new and start over':''}; }
  const r=typeof computedRoutes!=='undefined'&&computedRoutes?.routes; const secs=Math.round((Date.now()-c.preview)/1000);
  if(!r) return {ready:false,secs,hint:secs>240?'over 4 min: reload /urc/new and start over':''};
  const used=JSON.stringify(computedRoutes).match(/donation_item_\d+_\d+/g)||[], pq=r[0]?.route_stops_attributes.find(s=>s.stop_type==='pickup')?.route_stop_items_attributes?.donation_item_attributes||[];
  const match=c.copy?r.length===1&&String(pq.map(i=>+i.quantity_estimated))===String(c.want)&&new Date(r[0].pickup_window_start).toDateString()===new Date(c.date).toDateString()
    :(()=>{const have=new Set((cachedDonationItems||[]).map(i=>i.temporary_donation_item_id)); return used.length>0&&used.every(x=>have.has(x));})();
  return {ready:true,secs,match,rescues:r.length,stops:r.map(x=>x.pickup_window_start.slice(0,16)+' '+x.route_stops_attributes.map(s=>s.stop_type[0]+s.location_id).join('>')),
    errs:!match?['preview does not match the items (stale): do NOT save; reload /urc/new and start over']:r.length!==1?['preview builds '+r.length+' rescues; expected 1']:[],next:match&&r.length===1?'frh.Csave()':''}; };
const Csave=()=>{ const s=Cstatus(); if(!s.ready||s.errs?.length) return {errs:['not ready to save',...(s.errs||[])]}; if(window.frhC.saved) return {errs:['already saving']};
  window.frhC.saved=Date.now(); publishRoutes({publish:false}); return {saving:'Draft',next:'wait; the tab opens the new rescue, /routes/<R>, or for a recurring one its template, /route_templates/<T> (can take 1-3 min). If it never does, find it from a new tab: frh.find(donor, date) or frh.find(donor, date, date, "template")'}; };

// ===== X: export rescues as Rescue CSV rows (one per item). X([R,...]) -> {cols, rows}; values are %-encoded for & = ? % | (decode with unquote)
const XC=['R','item_id','date','start','end','donor','category','pack','qty','lbs_each','description','estimated','to','volunteer','vehicle','status'];
const X=async(Rs)=>{ Rs=(Array.isArray(Rs)?Rs:[Rs]).map(String); const enc=v=>String(v??'').replace(/%/g,'%25').replace(/&/g,'%26').replace(/=/g,'%3D').replace(/\?/g,'%3F').replace(/\|/g,'%7C'), rows=[], errs=[];
  for(const R of Rs){ try{ if(isT(R)){ errs.push(R+': templates are not exported'); continue; }
    const d=await load(R), s=state(d), M=tagMap(d), its=items(d), f=d.getElementById('route-reschedule'), v=n=>f?.querySelector('[name="route['+n+']"]');
    const sel=x=>x?([...x.options].find(o=>o.selected)?.value??x.value):'';
    const dt=v('start_date')?.getAttribute('value')||'', jd=new Date(dt.replace(/^(\w+), (\d+)/,'$1 $2,')), date=isNaN(jd)?dt:(jd.getMonth()+1)+'/'+jd.getDate()+'/'+jd.getFullYear();
    const st=sel(v('start_time')), dur=+sel(v('duration_in_hours')), sm=mins(st), end=sm==null?'':fmtT(sm+dur*60);
    const donor=[...d.querySelectorAll('a[href*="donor_locations/"]')].map(a=>a.textContent.replace(/\s+/g,' ').trim()).find(Boolean)||'';
    const vol=s.volId?(cfg.vols.find(x=>x[2]==s.volId)?.[0]||s.vol):'', veh=s.tags.map(t=>tagName(M,t)).filter(t=>cfg.vehicles.some(v=>tn(v)===tn(t))).join(' ');
    const rc=await Rcp(R), stops=(rc.now||[]).map(r=>{const c=r.split(' | '); return {name:c[1].replace(/^\d+ /,''),q:c[3].split(',').map(Number)};});
    const bad=stops.some(x=>x.q.length!==its.length); if(bad) errs.push(R+': drop-off items do not line up with pickup items; to left blank');
    its.forEach((it,k)=>{ const tos=bad?'':stops.length===1?stops[0].name:stops.filter(x=>x.q[k]>0).map(x=>x.name+':'+x.q[k]).join('; ');
      const first=k===0, [cat,pack]=(it.type||'').split(' / ');
      rows.push([R,it.id,first?date:'',first?st:'',first?end:'',first?donor:'',cat,pack,it.qty,it.lbs,String(it.desc||'').trim(),/^(true|1)$/.test(it.est)?'Y':'',tos,first?vol:'',first?veh:'',first?s.status:''].map(enc)); });
    if(!its.length) rows.push([R,'',date,st,end,donor,'','','','','','','',vol,veh,s.status].map(enc));
  }catch(e){ errs.push(R+': '+e.message); } }
  return {errs,cols:XC.join(','),rows:rows.map(r=>r.join('|'))}; };

// ===== CANCEL / UNCANCEL. cancel: one of the page's reasons (its label, part of it, or its code). uncancel (rescues only): the new pickup {date, start, end?|hours?} =====
const Cn=async(R,reason,DRY=true)=>{ const tp=isT(R), d=await load(R), s=state(d), errs=[], k=x=>norm(x).replace(/_/g,' ');
  const opts=[...new Map([...d.querySelectorAll('#cancelRouteModal [data-reason]')].map(b=>[b.dataset.reason,b.textContent.trim()]))], f=d.getElementById(tp?'cancel-route-template-form':'cancel-route-form');
  let h=opts.filter(o=>k(o[0])===k(reason)||k(o[1])===k(reason)); if(!h.length&&reason) h=opts.filter(o=>k(o[1]).includes(k(reason)));
  if(!f) errs.push('no cancel form on '+base(R)); if(/cancel/i.test(s.status)) errs.push('already '+s.status);
  if(h.length!==1) errs.push((h.length?h.length+' reasons match '+reason:'give a reason')+': '+opts.map(o=>o[1]).join(' / '));
  const sf=d.getElementById('route-reschedule'), v=n=>sf?.querySelector('[name="route['+n+']"]'), sel=x=>x?([...x.options].find(o=>o.selected)?.value??x.value):'';
  const undo=tp?'reactivate the template in the page (Actions, Activate)':{date:fmtD((v('start_date')?.getAttribute('value')||'').replace(/^(\w+), (\d+)/,'$1 $2,')),start:sel(v('start_time')),hours:+sel(v('duration_in_hours'))};
  if(DRY||errs.length) return {errs,status:s.status,reason:h.length===1?h[0][1]:'',note:s.volId?'FRH notifies '+s.vol+' (they do not see the reason)':'',undo,undoAs:'uncancel'};
  const r=await fetch(f.getAttribute('action'),{method:'POST',headers:FORM,body:new URLSearchParams({authenticity_token:tok(d),[(tp?'route_template':'route')+'[cancellation_reason]']:h[0][0]}).toString()});
  const e=state(await load(R)); return {ok:r.status<400&&/cancel/i.test(e.status),status:e.status,reason:h[0][1]}; };
const Un=async(R,SET={},DRY=true)=>{ if(isT(R)) return {errs:['a canceled template is republished in the page, not here']};
  const d=await load(R), s=state(d), f=d.getElementById('uncancel-route-form'), errs=[], v=n=>f.querySelector('[name="route['+n+']"]');
  if(!/cancel/i.test(s.status)||!f) return {errs:['not canceled ('+s.status+')']};
  const date=fmtD(SET.date??''), sm=mins(SET.start??''), start=sm==null?null:fmtT(sm), em=SET.end!=null?mins(SET.end):null, dur=SET.hours!=null?+SET.hours:em!=null&&sm!=null?(em-sm)/60:1;
  const dv=[...v('duration_in_hours').options].map(o=>o.value), di=dv.map(Number).indexOf(dur);
  if(!date) errs.push('uncancel needs the new pickup date'); if(!start||![...v('start_time').options].some(o=>o.value===start)) errs.push('uncancel needs a start time in 15-min steps'); if(di<0) errs.push('window '+dur+' h not allowed');
  if(DRY||errs.length) return {errs,status:s.status,to:date+' '+start+', '+dur+' h',undo:'unknown',undoAs:'cancel'};
  const r=await fetch(f.getAttribute('action'),{method:'POST',headers:FORM,body:new URLSearchParams({authenticity_token:tok(d),'route[start_date]':date,'route[start_time]':start,'route[duration_in_hours]':dv[di]}).toString()});
  const e=state(await load(R)); return {ok:r.status<400&&!/cancel/i.test(e.status),status:e.status}; };

// ===== PUBLISH: true = without notifications, 'notify' = with FRH's notifications, 'draft' = back to Drafting. Template: true publishes it (its rescues are made as Drafting), 'draft' unpublishes =====
const Pb=async(R,how,DRY=true)=>{ const tp=isT(R), d=await load(R), s=state(d), errs=[], m=how===true||how==='quiet'?'quiet':String(how).toLowerCase(), drafting=/drafting/i.test(s.status);
  if(!['quiet','notify','draft'].includes(m)) errs.push('use true (no notifications), "notify" or "draft"');
  if(/cancel|complete|progress/i.test(s.status)) errs.push('not on a '+s.status+(tp?' template':' rescue'));
  if(m!=='draft'&&!drafting) errs.push('already published ('+s.status+')'); if(m==='draft'&&drafting) errs.push('already Drafting');
  if(tp&&m==='notify') errs.push('a template makes its rescues as Drafting; publish the template, then each rescue');
  const note=m==='notify'?'FRH notifies volunteers about this rescue':m==='quiet'?(tp?'the template makes its upcoming rescues as Drafting (nobody notified): publish them one by one':'no notifications; volunteers can see and claim it in the app'):'back to Drafting: volunteers can no longer see or claim it';
  if(DRY||errs.length) return {errs,status:s.status,to:m,note,undo:m==='draft'?true:'draft'};
  const body=new URLSearchParams({authenticity_token:tok(d)}); let url;
  if(tp) url='/route_templates/'+num(R)+(m==='draft'?'/drafting':'/reactivate');
  else if(m==='draft'){ url='/routes/'+num(R)+'/change_status'; body.set('route[event]','to_drafting'); body.set('route[status]','drafting'); }
  else url='/routes/'+num(R)+'/publish'+(m==='quiet'?'?send_notifications=false':'');
  const r=await fetch(url,{method:'POST',headers:FORM,body:body.toString()}), e=state(await load(R));
  return {ok:r.status<400&&(m==='draft'?/drafting/i.test(e.status):!/drafting/i.test(e.status)),status:e.status,note}; };

// ===== PLAN / APPLY: one entry point, fixed save order. R = rescue number, or 'T' + template number =====
// C = {uncancel: Un SET, items: W SET, add: I ADD, recips: R PLAN, vol: name|id|0, window: S SET, tags: {add,del} | {vehicle}, publish: true|'notify'|'draft', cancel: reason}
const ORDER=[['uncancel',Un],['items',W],['add',I],['recips',Rcp],['vol',(R,c,D)=>A(R,c,true,D)],['window',S],['tags',T],['publish',Pb],['cancel',Cn]];
const one=async(R,C,D)=>{ const out={R}, errs=[], undo={};
  for(const [k,f] of ORDER){ if(C[k]==null) continue;
    let x; try{ x=await f(R,C[k],true); }catch(e){ x={errs:['helper error: '+e.message]}; }
    (x.errs||[]).forEach(e=>errs.push(k+': '+e)); if(x.undo!=null) undo[x.undoAs||k]=x.undo; out[k]=x; ['undo','undoAs','errs','donors','split','totals'].forEach(z=>delete x[z]); }
  if(D||errs.length) return {...out,errs,undo};
  const res={R}; let ok=true;
  for(const [k,f] of ORDER){ if(C[k]==null) continue;
    let x; try{ x=await f(R,C[k],false); }catch(e){ x={ok:false,err:'helper error: '+e.message}; }
    delete x.donors; delete x.split; res[k]=x; if(!x.ok){ ok=false; res.stoppedAt=k; break; } }
  return {...res,ok,undo}; };
const plan=async(R,C)=>Array.isArray(R)?{rescues:await Promise.all(R.map(([r,c])=>one(r,c,true)))}:one(R,C,true);
const apply=async(R,C)=>{ if(!Array.isArray(R)) return one(R,C,false); const out=[]; for(const [r,c] of R){ const x=await one(r,c,false); out.push(x); if(!x.ok) break; } return {ok:out.length===R.length&&out.every(x=>x.ok),rescues:out}; };
const read=async R=>{ const d=await load(R), s=state(d), M=tagMap(d), t=isT(R)?'':d.querySelector('a[href*="/route_templates/"]')?.getAttribute('href').match(/route_templates\/(\d+)/)?.[1]; return {R,status:s.status,vol:s.vol+' '+s.volId,tags:s.tags.map(x=>tagName(M,x)).join(','),template:t?'T'+t:'',...info(d)}; };

// output is paged at 900 chars (javascript_tool cuts at ~1,000): frh.more() returns the next page; frh.last is the full last result
let buf=[];
const page=s=>{ buf=[]; for(let i=0;i<s.length;i+=900) buf.push(s.slice(i,i+900)); const n=buf.length, first=buf.shift()||''; return n>1?first+' ...[page 1/'+n+': frh.more()]':first; };
const more=()=>buf.length?buf.shift()+(buf.length?' ...[frh.more()]':' [end]'):'[end]';
const wrap=f=>async(...a)=>{ const o=await f(...a); window.frh.last=o; return page(j(o)); };
window.frh={v:V,cfg,more,last:null,find:wrap(find),who:wrap(who),read:wrap(read),plan:wrap(plan),apply:wrap(apply),
  S:wrap(S),R:wrap(Rcp),W:wrap(W),I:wrap(I),C:wrap(Cbg),copy:wrap(K),X:wrap(X),Cpreview:wrap(Cpreview),Cstatus:wrap(Cstatus),Csave:wrap(Csave)};
})()