(()=>{
// frhRec v1: read, plan and save FRH record forms (donors, recipients, volunteers, their sites) by field label.
// Generic: any admin page whose edit sections are plain forms. Holds no organization values.
const V=1;
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
// output is cut near 1,000 characters by the browser tool: page it
let buf='',pos=0; const page=s=>{buf=(typeof s==='string'?s:JSON.stringify(s)).replace(/[?&=]/g,m=>({'?':'¿','&':'+','=':' : '}[m])); pos=0; return more();};
const more=()=>{const c=buf.slice(pos,pos+900); pos+=900; return c+(pos<buf.length?' ...[frhRec.more()]':' [end]');};
const wrap=fn=>async(...a)=>{try{const r=await fn(...a); window.frhRec.last=r; return page(r);}catch(e){return 'error: '+e.message;}};
window.frhRec={v:V,read:wrap(read),plan:wrap(plan),apply:wrap(apply),fill:wrap(async(...a)=>fill(...a)),status:wrap(status),list:wrap(async()=>list(document)),more,last:null};
})()