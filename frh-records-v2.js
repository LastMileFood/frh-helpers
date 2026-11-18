(()=>{
// frhRec v2: read, plan and save FRH record forms (donors, recipients, volunteers, their sites) by field label;
// v2 adds the weekly hours table (one site or many), location photos on special instructions, and a duplicate check before creating.
// Generic: any admin page whose edit sections are plain forms. Holds no organization values.
const V=2;
const norm=s=>String(s??'').toLowerCase().replace(/[*:]/g,'').replace(/\s+/g,' ').trim();
const SKIP=/^(authenticity_token|utf8|_method|commit|button)$/;
const parse=t=>new DOMParser().parseFromString(t,'text/html');
const load=async p=>{const r=await fetch(p,{credentials:'same-origin'}); return {doc:parse(await r.text()),url:r.url,status:r.status};};
const txt=e=>(e?.textContent||'').replace(/\*/g,'').replace(/\s+/g,' ').trim();
const human=n=>{const k=(String(n).match(/\[([^\[\]]+)\](?:\[\])?$/)||[,n])[1].replace(/_ids?$/,'').replace(/_/g,' '); return k.charAt(0).toUpperCase()+k.slice(1);};
const lab=e=>{let t=txt(e.labels?.[0]);
  if(!t&&e.id){const l=e.ownerDocument.querySelector('label[for="'+CSS.escape(e.id)+'"]'); t=txt(l);}
  if(!t){const g=e.closest('.form-group,.field,.input-group,td,li,.row,.col-sm-6,.col-md-6'); t=txt(g?.querySelector('label'));}
  return t;};
const optLab=e=>txt(e.labels?.[0])||txt(e.closest('label'))||txt(e.nextElementSibling)||e.value;
const method=F=>(F.querySelector('[name=_method]')?.value||F.method||'').toLowerCase();
// section name: the form's Save button, made unique (new vs existing entries, instruction type)
const sec0=F=>{const b=F.querySelector('[type=submit]'); let s=(b?.value||txt(b)||F.id||'form').trim();
  const att=[...F.elements].find(e=>/\[\w+_attributes\]\[\d+\]/.test(e.name)&&!/^(hidden|submit)$/.test(e.type));
  if(att){ const ent=att.name.match(/\[(\w+?)s?_attributes\]\[\d+\]/)[1].replace(/_/g,' ');
    if(!F.querySelector('[name*="_attributes]["][name$="[id]"]')) s='New '+ent;
    else { const fn=F.querySelector('[name$="[first_name]"]'), v=fn?(fn.value+' '+(F.querySelector('[name$="[last_name]"]')?.value||'')).trim():([...F.elements].find(e=>/text/.test(e.type)&&e.value)?.value||''); s=s+(v?': '+v.slice(0,25):''); } }
  if(/^(save|update|submit)$/i.test(s)){const ds=F.querySelector('[name$="[delivery_state]"]')?.value||F.querySelector('textarea[id^="text_"]')?.id.replace(/^text_/,''); if(ds) s=/^travel/.test(ds)?'Traveling instructions':/^arriv/.test(ds)?'Arrival instructions':'Instructions '+ds;}
  return s;};
const sec=F=>{const s=sec0(F), d=F.ownerDocument, twins=[...d.forms].filter(G=>G!==F&&sec0(G)===s); if(!twins.length) return s;
  if(method(F)==='post'&&!/\/\d+$/.test(F.getAttribute('action')||'')) return 'New '+s.replace(/^(Save|Add|Create)\s+/i,'').toLowerCase();
  const v=[...F.elements].find(e=>e.name&&!SKIP.test(e.name)&&e.type!=='hidden'&&e.value&&/text/.test(e.type))?.value||'';
  return s+(v?': '+v.slice(0,25):' #'+[...d.forms].filter(G=>sec0(G)===s).indexOf(F));};
const fields=F=>{const by=new Map();
  for(const e of F.elements){ if(!e.name||SKIP.test(e.name)||/^(hidden|submit|button|file)$/.test(e.type)) continue;
    if(!by.has(e.name)) by.set(e.name,{name:e.name,label:lab(e),type:e.type,els:[]}); by.get(e.name).els.push(e);}
  const S=sec(F).replace(/^(Save|Update)\s+/i,'');
  return [...by.values()].map(f=>{const e=f.els[0];
    if(e.tagName==='SELECT'){f.options=[...e.options].map(txt).filter(Boolean); f.value=e.multiple?[...e.selectedOptions].map(txt):txt(e.selectedOptions[0]);}
    else if(e.type==='checkbox'){ if(f.els.length>1||/\[\]$/.test(f.name)){f.type='checkboxes'; f.label=human(f.name); f.options=f.els.map(optLab); f.value=f.els.filter(x=>x.checked).map(optLab);} else {f.value=e.checked; f.label=f.label||optLab(e);} }
    else if(e.type==='radio'){f.options=f.els.map(optLab); const c=f.els.find(x=>x.checked); f.value=c?optLab(c):'';}
    else f.value=e.value;
    f.alias=[human(f.name), S]; if(!f.label) f.label=human(f.name);
    return f;});};
const forms=d=>[...d.forms].filter(F=>/^(post|patch|put)$/.test(method(F))&&!/session|search/i.test(F.getAttribute('action')||'')&&fields(F).length);
const pick=(opts,v)=>{const n=norm(v); let i=opts.findIndex(o=>norm(o)===n); if(i<0){const m=opts.map((o,j)=>norm(o).startsWith(n)?j:-1).filter(j=>j>=0); if(m.length===1) i=m[0];} if(i<0){const m=opts.map((o,j)=>norm(o).includes(n)?j:-1).filter(j=>j>=0); if(m.length===1) i=m[0];} return i;};
const truthy=v=>v===true||/^(y|yes|true|1|on)$/i.test(String(v));
const setF=(f,v)=>{const e=f.els[0];
  if(e.tagName==='SELECT'){ const opts=[...e.options], L=opts.map(txt);
    if(e.multiple){ const want=[].concat(v).map(x=>pick(L,x)); if(want.some(i=>i<0)) return 'no option '+JSON.stringify(v)+' in '+f.label+' ('+L.slice(0,15).join(' | ')+')'; opts.forEach((o,i)=>o.selected=want.includes(i)); }
    else { let i=pick(L,v); if(i<0) i=opts.findIndex(o=>o.value==v); if(i<0) return 'no option "'+v+'" in '+f.label+' ('+L.slice(0,15).join(' | ')+')'; e.selectedIndex=i; } }
  else if(f.type==='checkboxes'){ const L=f.els.map(optLab), want=[].concat(v).map(x=>pick(L,x)); if(want.some(i=>i<0)) return 'no choice '+JSON.stringify(v)+' in '+f.label+' ('+L.join(' | ')+')'; f.els.forEach((x,i)=>x.checked=want.includes(i)); }
  else if(e.type==='checkbox') e.checked=truthy(v);
  else if(e.type==='radio'){ const L=f.els.map(optLab), i=pick(L,v); if(i<0) return 'no choice "'+v+'" in '+f.label+' ('+L.join(' | ')+')'; f.els.forEach((x,j)=>x.checked=j===i); }
  else e.value=v;
  ['input','change'].forEach(t=>e.dispatchEvent(new Event(t,{bubbles:true}))); return '';};
const show=v=>Array.isArray(v)?v.join(', '):v===true?'yes':v===false?'no':String(v??'');
// key: 'Label' or 'Section > Label' (label, else the field name in words, else the section name)
const locate=(d,key)=>{let [s,l]=String(key).includes('>')?String(key).split('>').map(x=>x.trim()):[null,key];
  const all=forms(d).flatMap(F=>{const S=sec(F); return fields(F).map(f=>({...f,F,section:S}));}).filter(f=>!s||norm(f.section)===norm(s)||norm(f.section).includes(norm(s)));
  let m=all.filter(f=>norm(f.label)===norm(l)); if(!m.length) m=all.filter(f=>f.alias.some(a=>norm(a)===norm(l))); if(!m.length) m=all.filter(f=>norm(f.label).includes(norm(l))); if(!m.length) m=all.filter(f=>f.alias.some(a=>norm(a).includes(norm(l)))); if(!m.length) m=all.filter(f=>f.name===l||f.name.includes('['+l+']'));
  const dep=f=>(f.name.match(/\[/g)||[]).length;
  for(const t of [f=>f.name.endsWith('['+norm(l).replace(/ /g,'_')+']'), f=>/^(text|textarea|tel|email|number|date|time)$/.test(f.els[0].type), f=>dep(f)===Math.min(...m.map(dep)), f=>show(f.value)!=='']){ if(m.length<2) break; const n=m.filter(t); if(n.length) m=n; }
  return m;};
const list=d=>forms(d).map(F=>'['+sec(F)+'] '+fields(F).map(f=>f.label+(f.options&&f.options.length<13?' {'+f.options.join('|')+'}':'')+': '+show(f.value)).join(' · ')).join('\n');
const read=async p=>list(p?(await load(p)).doc:document);
// dry run: one line per change (section | label: old -> new), undo, errs. Saves nothing
const plan=async(p,C)=>{const {doc}=await load(p); const out=[],undo={},errs=[];
  for(const [k,v] of Object.entries(C)){ const m=locate(doc,k);
    if(m.length!==1){ errs.push(k+': '+(m.length?m.length+' fields match ('+m.map(f=>f.section+' > '+f.label).join(' | ')+'): use "Section > Label"':'no field. Fields: '+forms(doc).flatMap(F=>fields(F).map(f=>sec(F)+' > '+f.label)).join(', ').slice(0,500))); continue; }
    const f=m[0], e=setF(f,v); if(e){errs.push(e); continue;}
    out.push(f.section+' | '+f.label+': '+show(f.value)+' -> '+show(fields(f.F).find(x=>x.name===f.name).value)); if(!/^new /i.test(f.section)) undo[f.section+' > '+f.label]=f.value; }
  return {page:p,plan:out,undo,errs};};
// save: each touched section is sent as its own form (same as pressing that section's Save), then the page is re-read
const apply=async(p,C)=>{const {doc}=await load(p), by=new Map(), errs=[];
  for(const [k,v] of Object.entries(C)){ const m=locate(doc,k); if(m.length!==1){errs.push(k+': '+m.length+' matches'); continue;} const e=setF(m[0],v); if(e){errs.push(e);continue;} by.set(m[0].F,1); }
  if(errs.length) return {ok:false,errs,saved:[]};
  const saved=[];
  for(const F of by.keys()){ const fd=new FormData(F), b=F.querySelector('[type=submit]'); if(b?.name) fd.set(b.name,b.value);
    const r=await fetch(F.getAttribute('action'),{method:'POST',body:new URLSearchParams(fd),credentials:'same-origin',headers:{'X-CSRF-Token':document.querySelector('meta[name=csrf-token]')?.content||''}});
    const d=parse(await r.text()), bad=[...d.querySelectorAll('.alert-danger,.has-error .help-block,.error_explanation li,.invalid-feedback')].map(txt).filter(Boolean);
    saved.push(sec(F)+': HTTP '+r.status+(bad.length?' ERR '+bad.join('; ').slice(0,200):''));
    if(!r.ok||bad.length) return {ok:false,stoppedAt:sec(F),saved,errs:bad}; }
  const {doc:d2}=await load(p);
  const good=v=>got=>Array.isArray(got)?[].concat(v).every(x=>got.some(g=>norm(g)===norm(x)))&&got.length===[].concat(v).length:typeof got==='boolean'?got===truthy(v):norm(got)===norm(v)||(String(v).trim()!==''&&!isNaN(v)&&!isNaN(got)&&+got===+v)||(norm(v).length>1&&norm(got).startsWith(norm(v)))||(/\d{3}/.test(v)&&String(got).replace(/\D/g,'').endsWith(String(v).replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'')));
  const check=Object.entries(C).map(([k,v])=>{
    if(/^new /i.test(k)){const hit=forms(d2).filter(F=>!/^new /i.test(sec(F))).some(F=>fields(F).some(f=>norm(show(f.value))===norm(show(v)))); return (hit?'ok ':'DIFF ')+k+(hit?' (now on the page)':' (not found after save)');}
    const ms=locate(d2,k), f=ms.find(x=>good(v)(x.value))||ms[0]; return (f&&good(v)(f.value)?'ok ':'DIFF ')+k+' = '+show(f?.value);});
  return {ok:check.every(x=>x.startsWith('ok')),saved,check};};
// create wizards: fill the live page's form by label; submit:true presses its Save/Next (the page then moves on)
const fill=(C,{submit=false}={})=>{const errs=[],done=[]; let F0=null;
  for(const [k,v] of Object.entries(C)){ const m=locate(document,k); if(m.length!==1){errs.push(k+': '+(m.length?m.map(f=>f.section+' > '+f.label).join(' | '):'no field')); continue;}
    const e=setF(m[0],v); if(e){errs.push(e); continue;} done.push(m[0].label+' = '+show(v)); F0=m[0].F; if(window.jQuery) jQuery(m[0].els[0]).trigger('change'); }
  if(submit&&!errs.length&&F0){ F0.requestSubmit(F0.querySelector('[type=submit]')); done.push('submitted: '+sec(F0)); }
  return {done,errs};};
// status pill (Active / Inactive / Pending...): the page's Change Status form
const status=async(p,v)=>{const {doc}=await load(p), F=doc.getElementById('change-status-form')||[...doc.forms].find(G=>G.querySelector('input[type=hidden][name$="[status]"]'));
  if(!F) return {ok:false,errs:['no Change Status on this page']};
  const h=F.querySelector('[name$="[status]"],[name$="[active]"]'), opts=[...doc.querySelectorAll('a[data-status]')].map(a=>[txt(a),a.dataset.status]), old=h.value;
  if(v==null) return {status:old,options:opts.map(o=>o[0])};
  const i=pick(opts.map(o=>o[0]),v); if(i<0) return {ok:false,errs:['no status "'+v+'" ('+opts.map(o=>o[0]).join(' | ')+')']};
  h.value=opts[i][1]; const r=await fetch(F.getAttribute('action'),{method:'POST',body:new URLSearchParams(new FormData(F)),credentials:'same-origin',headers:{'X-CSRF-Token':document.querySelector('meta[name=csrf-token]')?.content||''}});
  const {doc:d2}=await load(p), now=(d2.getElementById('change-status-form')||[...d2.forms].find(G=>G.querySelector('input[type=hidden][name$="[status]"]')))?.querySelector('[name$="[status]"],[name$="[active]"]')?.value;
  return {ok:now===opts[i][1],http:r.status,status:old+' -> '+now,undo:old};};
// ===== HOURS (recipient sites: Site Information > Hours). spec = {type?, mon..sun | monday..sunday | weekdays | weekend | all: '9:00 AM-5:00 PM' | 'closed', alt?: true|false}
// type: 'regular' (set by giving any day), '24-7', 'unknown', 'complicated'. alt = "Willing to receive donations at other times if necessary". Days not named keep their hours.
const DAYS=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], D3=d=>d.slice(0,3), HT={'24/7':'24-7','24-7':'24-7',regular:'regular',unknown:'unknown',complicated:'complicated',"it's complicated":'complicated'};
const tmin=t=>{const m=String(t).trim().toUpperCase().replace(/\s+/g,'').match(/^(\d{1,2})(?::(\d\d))?([AP])M?$/); return m?(+m[1]%12+(m[3]==='P'?12:0))*60+(+(m[2]||0)):null;};
const tfmt=n=>((Math.floor(n/60)+11)%12+1)+':'+String(n%60).padStart(2,'0')+' '+(n<720?'AM':'PM');
const hform=d=>[...d.forms].find(F=>F.querySelector('[name*="[recurrence_rules_attributes]"][name$="[day]"]'));
const hread=F=>{ const g=n=>F.querySelector('[name="'+n+'"]'), t=g(F.querySelector('[name$="[hours_type]"]')?.name)?.value||'', days={};
  F.querySelectorAll('[name$="[day]"][name*="recurrence_rules_attributes"]').forEach(e=>{ const pre=e.name.slice(0,-5), ft=x=>{const n=tmin(x||''); return n==null?'':tfmt(n);}, a=ft(g(pre+'[start_seconds]')?.value), b=ft(g(pre+'[end_seconds]')?.value); days[D3(e.value)]={pre,v:a&&b?a+'-'+b:'closed'}; });
  const alt=[...F.querySelectorAll('input[type=checkbox][name$="[donation_alternate_times]"]')][0];
  return {type:t,days,alt:alt?alt.checked:null};};
const hshow=h=>(h.type||'?')+(h.type==='regular'?': '+DAYS.map(d=>D3(d)+' '+h.days[D3(d)]?.v).join(', '):'')+(h.alt!=null?' | other times: '+(h.alt?'yes':'no'):'');
const hspec=(h,spec,errs)=>{ const want={type:h.type,days:Object.fromEntries(Object.entries(h.days).map(([k,x])=>[k,x.v])),alt:h.alt}; let dayGiven=false;
  for(const [k0,v] of Object.entries(spec||{})){ const k=norm(k0);
    if(k==='type'){ const t=HT[norm(v)]; if(!t) errs.push('type must be regular, 24-7, unknown or complicated'); else want.type=t; continue; }
    if(k==='alt'||k.startsWith('other')||k.startsWith('willing')){ want.alt=v===true||/^(y|yes|true|1)$/i.test(String(v)); continue; }
    const ds=k==='all'?DAYS:k==='weekdays'?DAYS.slice(0,5):k==='weekend'||k==='weekends'?DAYS.slice(5):DAYS.filter(d=>d===k||D3(d)===k.slice(0,3)&&k.length>=3&&d.startsWith(k));
    if(!ds.length){ errs.push('unknown key '+k0+' (use type, alt, mon..sun, weekdays, weekend, all)'); continue; }
    let val; if(/^(closed|none|-|)$/i.test(String(v).trim())) val='closed';
    else { const m=String(v).split(/\s*(?:-|–|to)\s*/i), a=tmin(m[0]||''), b=tmin(m[1]||'');
      if(m.length!==2||a==null||b==null){ errs.push(k0+': give hours as 9:00 AM-5:00 PM or closed'); continue; } if(b<=a){ errs.push(k0+': closes before it opens'); continue; } val=tfmt(a)+'-'+tfmt(b); }
    ds.forEach(d=>want.days[D3(d)]=val); dayGiven=true; }
  if(dayGiven&&!spec.type) want.type='regular';
  if(want.type==='regular'&&DAYS.every(d=>want.days[D3(d)]==='closed')) errs.push('regular hours with every day closed: use type unknown instead');
  return want;};
const hdiff=(h,w)=>[...(w.type!==h.type?['Hours type: '+h.type+' -> '+w.type]:[]),...(w.type==='regular'?DAYS.filter(d=>w.days[D3(d)]!==h.days[D3(d)]?.v||h.type!=='regular').map(d=>D3(d)+': '+(h.type==='regular'?h.days[D3(d)]?.v:'('+h.type+')')+' -> '+w.days[D3(d)]):[]),...(w.alt!==h.alt&&h.alt!=null?['Other times: '+(h.alt?'yes':'no')+' -> '+(w.alt?'yes':'no')]:[])];
const hundo=h=>({type:h.type,...Object.fromEntries(Object.entries(h.days).map(([k,x])=>[k,x.v])),...(h.alt!=null?{alt:h.alt}:{})});
const hone=async(p,spec,save)=>{ const {doc}=await load(p), F=hform(doc); if(!F) return {page:p,errs:['no hours table on this page (donor sites have none; use a recipient site\'s site_information page)']};
  const h=hread(F); if(spec==null) return {page:p,hours:hshow(h)};
  const errs=[], w=hspec(h,spec,errs), ch=hdiff(h,w); if(errs.length) return {page:p,errs};
  if(!save||!ch.length) return {page:p,plan:ch.length?ch:['no change'],undo:hundo(h)};
  const fd=new FormData(F), ht=F.querySelector('[name$="[hours_type]"]').name; fd.set(ht,w.type);
  ['unknown','24-7','regular','complicated'].forEach(n=>fd.delete(n)); fd.set(w.type,'true');
  // as in the page: only "Regular hours" sends the day rows and the other-times box
  const reg=[...F.querySelectorAll('[name*="[recurrence_attributes]"],[name$="[donation_alternate_times]"]')].map(e=>e.name); // incl. the recurrence id: sending it without its rules is an HTTP 500
  if(w.type!=='regular') new Set(reg).forEach(n=>fd.delete(n));
  else { DAYS.forEach(d=>{ const x=h.days[D3(d)]; if(!x) return; const [a,b]=w.days[D3(d)]==='closed'?['','']:w.days[D3(d)].split('-'); fd.set(x.pre+'[start_seconds]',a); fd.set(x.pre+'[end_seconds]',b); });
    const an=F.querySelector('[name$="[donation_alternate_times]"]')?.name; if(an&&w.alt!=null){ fd.delete(an); fd.append(an,'0'); if(w.alt) fd.append(an,'1'); } }
  const b=F.querySelector('[type=submit]'); if(b?.name) fd.set(b.name,b.value);
  const r=await fetch(F.getAttribute('action'),{method:'POST',body:new URLSearchParams(fd),credentials:'same-origin',headers:{'X-CSRF-Token':document.querySelector('meta[name=csrf-token]')?.content||''}});
  const {doc:d2}=await load(p), h2=hread(hform(d2)), left=hdiff(h2,w).filter(x=>!/^Other times/.test(x)||w.type==='regular');
  return {page:p,ok:r.ok&&!left.length,http:r.status,saved:ch,now:hshow(h2),...(left.length?{diff:left}:{}),undo:hundo(h)};};
// one site: hours(P[, spec[, {save:true}]]); several: hours([[P1,spec1],[P2,spec2]][, {save:true}]) plans all, or saves in order and stops at the first failure
const hours=async(p,spec,o={})=>{ if(Array.isArray(p)){ const save=!!(spec&&spec.save), out=[];
    for(const [q,sp] of p){ const x=await hone(q,sp,save); out.push(x); if(save&&!x.ok&&!x.plan) break; }
    return {sites:out.length,of:p.length,ok:out.every(x=>x.ok||x.plan&&!save),results:out,undo:out.filter(x=>x.undo).map(x=>[x.page,x.undo])}; }
  return hone(p,spec,!!o.save);};

// ===== PHOTO: a site's location photo on its Special Instructions (Traveling to / Arrived at). The file comes from the Requester (attached in the chat),
// put into this tab's photo input (#photo_image) with the browser's file upload; this helper never fetches a picture from anywhere else.
// photo(P) reads; photo(P, {for:'arrived'|'traveling'}) plans with the file in the input; {save:true} uploads it and assigns it; {for, photoId} assigns a photo already on the site ('' clears)
const sip=p=>p.replace(/\/(site_information|contacts|special_instructions|notes|food|documents|activity_log|rescues)\/?$/,'').replace(/\/$/,'')+'/special_instructions';
const sforms=d=>[...d.forms].filter(F=>F.querySelector('[name="special_instruction[delivery_state]"]')&&F.querySelector('[name="special_instruction[photo_id]"]')).map(F=>({F,state:F.querySelector('[name="special_instruction[delivery_state]"]').value,photo:F.querySelector('[name="special_instruction[photo_id]"]').value,isNew:!/\/\d+$/.test(F.getAttribute('action')||'')}));
const gallery=d=>[...new Set([...d.querySelectorAll('.si-photo-option,[onclick*="selectPhoto"]')].map(e=>e.dataset.photoId||(String(e.getAttribute('onclick')||'').match(/(\d+)\s*\)\s*;?\s*$/)||[])[1]).filter(Boolean))];
const pick2=(S,w)=>{ const k=norm(w||''); return S.filter(x=>!x.isNew&&(k.startsWith('arriv')?/^arriv/.test(x.state):k.startsWith('travel')?/^travel/.test(x.state):false)); };
const photo=async(p,spec,o={})=>{ const q=sip(p), {doc}=await load(q), S=sforms(doc), G=gallery(doc);
  if(!S.length&&!doc.getElementById('new_photo')) return {page:q,errs:['no special instructions on this page']};
  const now=S.filter(x=>!x.isNew).map(x=>(/^arriv/.test(x.state)?'Arrived at':'Traveling to')+': '+(x.photo?'photo '+x.photo:'no photo'));
  if(!spec) return {page:q,instructions:now,photosOnSite:G.length,ids:G};
  const t=pick2(S,spec.for); if(t.length!==1) return {page:q,errs:[t.length?'two instructions match':'say for: "arrived" or "traveling"; that instruction must already have text ('+now.join(' | ')+')']};
  const I=t[0], lab=/^arriv/.test(I.state)?'Arrived at':'Traveling to';
  if(spec.photoId!=null){ const id=String(spec.photoId); if(id&&!G.includes(id)) return {page:q,errs:['photo '+id+' is not on this site ('+G.join(', ')+')']};
    if(!o.save) return {page:q,plan:[lab+' photo: '+(I.photo||'none')+' -> '+(id||'none')],undo:{for:spec.for,photoId:I.photo}};
    return assign(q,I,id,lab); }
  if(!location.pathname.endsWith(q)) return {page:q,errs:['open '+q+' in this tab and put the file in its photo input first']};
  const inp=document.getElementById('photo_image')||document.querySelector('form#new_photo input[type=file]'), f=inp?.files?.[0];
  if(!f) return {page:q,errs:['no file in the photo input: upload the Requester\'s attached photo into it first']};
  if(!/^image\/(jpeg|png)$/.test(f.type)) return {page:q,errs:['FRH takes JPEG or PNG only (this is '+(f.type||'unknown')+')']};
  const plan=[lab+' photo: '+(I.photo?'photo '+I.photo+' (stays on the site, unassigned)':'none')+' -> new photo '+f.name+' ('+Math.round(f.size/1024)+' KB)'];
  if(!o.save) return {page:q,plan,undo:{for:spec.for,photoId:I.photo}};
  const F=document.getElementById('new_photo'), fd=new FormData(F); fd.set('photo[image]',f,f.name);
  const r=await fetch(F.getAttribute('action'),{method:'POST',body:fd,credentials:'same-origin',headers:{'X-CSRF-Token':document.querySelector('meta[name=csrf-token]')?.content||''}});
  const {doc:d2}=await load(q), nw=gallery(d2).filter(x=>!G.includes(x));
  if(nw.length!==1) return {page:q,ok:false,http:r.status,errs:['upload: found '+nw.length+' new photos on the site'],undo:{for:spec.for,photoId:I.photo}};
  const I2=sforms(d2).find(x=>x.state===I.state&&!x.isNew); const a=await assign(q,I2,nw[0],lab); return {...a,uploaded:nw[0],undo:{for:spec.for,photoId:I.photo}};};
const assign=async(q,I,id,lab)=>{ const fd=new FormData(I.F); fd.set('special_instruction[photo_id]',id); const b=I.F.querySelector('[type=submit]'); if(b?.name) fd.set(b.name,b.value);
  const r=await fetch(I.F.getAttribute('action'),{method:'POST',body:new URLSearchParams(fd),credentials:'same-origin',headers:{'X-CSRF-Token':document.querySelector('meta[name=csrf-token]')?.content||''}});
  const {doc}=await load(q), now=sforms(doc).find(x=>x.state===I.state&&!x.isNew)?.photo;
  return {page:q,ok:r.ok&&String(now||'')===String(id||''),http:r.status,saved:lab+' photo: '+(I.photo||'none')+' -> '+(now||'none')};};

// ===== DUPES: before creating a donor or recipient, list sites whose name is close (Active and Inactive). kind: 'donor' | 'recipient'
const dupes=async(kind,name)=>{ const t=/^don/i.test(kind)?'DonorLocation':/^(rec|non|npp)/i.test(kind)?'RecipientLocation':null; if(!t) return {errs:['kind must be donor or recipient']};
  const w=norm(name).split(' ').filter(x=>x.length>=2); if(!w.length) return {errs:['give a name']};
  const r=await fetch('/api/search/results?type='+t+'&query='+encodeURIComponent(name)+'&status=all',{credentials:'same-origin',headers:{Accept:'application/json'}}); if(!r.ok) return {errs:['search failed: HTTP '+r.status]};
  const all=(await r.json()).all||[], sc=x=>{ const n=norm((x.donor?.name||x.recipient?.name||'')+' '+(x.name||'')+' '+(x.full_name||'')); return (norm(x.full_name)===norm(name)||norm(x.donor?.name||x.recipient?.name)===norm(name)?100:0)+w.filter(z=>n.includes(z)).length*10-(n.length/100); };
  const hits=all.map(x=>({x,s:sc(x)})).filter(h=>h.s>=Math.min(w.length,2)*10-1).sort((a,b)=>b.s-a.s).slice(0,8);
  return {name,searched:all.length,exact:hits.filter(h=>h.s>=100).length,close:hits.map(h=>h.x.id+' '+h.x.full_name+' ['+(h.x.status||'?')+'] '+(h.x.url||''))};};
// output is cut near 1,000 characters by the browser tool: page it
let buf='',pos=0; const page=s=>{buf=(typeof s==='string'?s:JSON.stringify(s)).replace(/[?&=]/g,m=>({'?':'¿','&':'+','=':' : '}[m])); pos=0; return more();};
const more=()=>{const c=buf.slice(pos,pos+900); pos+=900; return c+(pos<buf.length?' ...[frhRec.more()]':' [end]');};
const wrap=fn=>async(...a)=>{try{const r=await fn(...a); window.frhRec.last=r; return page(r);}catch(e){return 'error: '+e.message;}};
window.frhRec={v:V,read:wrap(read),plan:wrap(plan),apply:wrap(apply),fill:wrap(async(...a)=>fill(...a)),status:wrap(status),hours:wrap(hours),photo:wrap(photo),dupes:wrap(dupes),list:wrap(async()=>list(document)),more,last:null};
})()