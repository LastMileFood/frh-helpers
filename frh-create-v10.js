(()=>{
// frh create module v10: new rescues through FRH's New Rescue wizard (frh.C), copies (frh.copy), preview and save as Draft.
// Load with frh.use('create'); checking the saved rescue afterwards uses the rescues module (frh.use('create','rescues')).
const {norm,nm,mins,fmtT,fmtD,REP,repKind,reg}=frh._;
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
reg('create',10,{C:Cbg,copy:K,Cpreview,Cstatus,Csave});
})()