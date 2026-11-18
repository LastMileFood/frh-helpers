(()=>{
// frh core v10: shared code (session, page parsing, dates, tags, paging), find, who, read, and the module loader.
// Modules (rescues, templates, create) are stored separately and loaded on demand: frh.use('rescues','templates') -> 10 when ready.
// ===== VERSION: bump V and MODS here, in each module's frh._reg line, and in the skills' loaders on any change =====
// No organization values live in this code: tags, recipients, cancel reasons and the org id are read from the page.
// A team's shortcuts are optional and live in this browser only: localStorage.frhTeam = JSON {name, vols:[[short name, FRH name, user_id]], vehicles:[tag names], baseTag, plus any lists the team's own skills read from frh.cfg}
const V=10, MODS={rescues:10,templates:10,create:10};
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
// only: '' (all) | 'unclaimed' (no volunteer, not canceled/completed/in progress; Drafting included) | 'available' (published and unclaimed) | 'claimed'
const find=async(text='',from,to,type='all',only='')=>{ to??=from; const rows=[]; let url='/?rescue_search_text='+encodeURIComponent(text)+'&rescue_type='+type+'&rescue_date_range='+encodeURIComponent(mdy(from)+' - '+mdy(to))+'&rescue_sort=pickup_time+ASC', pages=0;
  while(url&&pages<10){ const d=parseHTML(await (await fetch(url)).text()); pages++; const rf=d.querySelector('[name=rescue_date_range]');
    if(pages===1&&rf&&!rf.value&&!find.retried){ find.retried=1; const r=await find(text,from,to,type,only); find.retried=0; return r; } find.retried=0;
    if(pages===1&&rf&&!rf.value) return {n:0,errs:['FRH did not accept the date range '+mdy(from)+' - '+mdy(to)+' (the end date is too far ahead, more than about 7 weeks out). Search a shorter range.'],rows:[]};
    d.querySelectorAll('.data-row.delivery-row[data-href]').forEach(r=>{ const c=[...r.children], t=i=>(c[i]?.textContent||'').replace(/\s+/g,' ').trim();
      const list=i=>{const a=[...(c[i]?.querySelectorAll('li a')||[])].map(x=>short(x.textContent)); return a.length?a.join(' + '):short(t(i));};
      const qty=(t(5).match(/\d+(\.\d+)? \w+/g)||[]).reduce((m,s)=>{const [n,u]=s.split(' '); m[u]=(m[u]||0)+ +n; return m;},{});
      rows.push([(/route_templates/.test(r.dataset.href)?'T':'')+r.dataset.href.split('?')[0].split('/').pop(), t(6).replace(/(\d{2}\/\d{2})\s*(\d)/,'$1 $2').replace(/ - /,'-'), t(7), list(3), list(4), Object.entries(qty).map(([u,n])=>n+' '+u).join(','), t(8)].join(' | ')); });
    url=d.querySelector('.pagination li.next:not(.disabled) a')?.getAttribute('href'); }
  const C=r=>r.split(' | '), noVol=r=>!C(r)[6]||/^(none|unassigned|-)$|^unclaimed|placeholder/i.test(C(r)[6]), live=r=>!/cancel|complete|progress/i.test(C(r)[2]);
  const keep={'':()=>true,unclaimed:r=>noVol(r)&&live(r),available:r=>noVol(r)&&live(r)&&!/drafting/i.test(C(r)[2]),claimed:r=>!noVol(r)}[only];
  if(!keep) return {n:0,errs:['only must be unclaimed, available or claimed'],rows:[]};
  const out=rows.filter(keep); return {n:out.length,...(only?{of:rows.length,only}:{}),cols:'R | pickup | state | donors | recipients | items | volunteer',rows:out,...(pages>=10&&url?{warn:'more than 10 pages: narrow the search'}:{})}; };

// ===== WHO: live lookup of a volunteer not in cfg =====
const who=async(name,R)=>{ let t=await (await fetch('/users?search_terms='+encodeURIComponent(name)+'&div_name=user-search-results&partial_name=routes/user_list&background_check_enabled=false&states[]=0&states[]=1&states[]=2&states[]=3&route_id='+R,{headers:{'X-Requested-With':'XMLHttpRequest','Accept':'text/javascript, */*; q=0.01'}})).text();
  t=t.replace(/\\n/g,'\n').replace(/\\\//g,'/').replace(/\\"/g,'"').replace(/\\'/g,"'");
  const hits=[...parseHTML(t).querySelectorAll('[onclick]')].map(e=>({id:+((decodeURIComponent(e.getAttribute('onclick')).match(/user_id\]=(\d+)/)||[])[1]||0),txt:e.textContent.replace(/\s+/g,' ').trim().slice(0,70)})).filter(x=>x.id);
  const ok=hits.filter(x=>!/#admin/i.test(x.txt)), ex=ok.filter(x=>norm(x.txt).startsWith(norm(name)+' ')), cnt=x=>+(x.txt.match(/(\d+) rescues/)||[0,0])[1]; return {name,exact:ex.length,hits:(ex.length?ex:ok).sort((a,b)=>cnt(b)-cnt(a)).slice(0,5).map(x=>x.id+' '+x.txt)}; };

const read=async R=>{ const d=await load(R), s=state(d), M=tagMap(d), t=isT(R)?'':d.querySelector('a[href*="/route_templates/"]')?.getAttribute('href').match(/route_templates\/(\d+)/)?.[1]; return {R,status:s.status,vol:s.vol+' '+s.volId,tags:s.tags.map(x=>tagName(M,x)).join(','),template:t?'T'+t:'',...info(d)}; };
// output is paged at 900 chars (javascript_tool cuts at ~1,000): frh.more() returns the next page; frh.last is the full last result
let buf=[];
const page=s=>{ buf=[]; for(let i=0;i<s.length;i+=900) buf.push(s.slice(i,i+900)); const n=buf.length, first=buf.shift()||''; return n>1?first+' ...[page 1/'+n+': frh.more()]':first; };
const more=()=>buf.length?buf.shift()+(buf.length?' ...[frh.more()]':' [end]'):'[end]';
const wrap=f=>async(...a)=>{ const o=await f(...a); window.frh.last=o; return page(j(o)); };
// ===== MODULES: each is its own stored file (localStorage.frhSrc_<name>), evaluated only when a job asks for it =====
const _m={}, KEY=n=>'frhSrc_'+n;
const reg=(n,v,pub={},api={})=>{ _m[n]={v,...api}; Object.entries(pub).forEach(([k,f])=>window.frh[k]=wrap(f)); };
const use=(...names)=>{ const miss=[];
  for(const n of names){ if(!MODS[n]){ miss.push(n+' (no such module)'); continue; } if(_m[n]?.v===MODS[n]) continue;
    const src=localStorage[KEY(n)]; if(!src){ miss.push(n+' (not installed)'); continue; }
    try{ (0,eval)(src); }catch(e){ miss.push(n+' ('+e.message+')'); continue; }
    if(_m[n]?.v!==MODS[n]) miss.push(n+' (stored v'+(_m[n]?.v??'?')+', need v'+MODS[n]+')'); }
  return miss.length?'missing: '+miss.join(', ')+': reinstall (frh-change-rescues/references/helpers.md)':V; };
const had=Object.keys(window.frh?.mods?.()||{}); // modules already loaded on this page come back when the core is evaluated again (e.g. a team add-on's setup line)
window.frh={v:V,cfg,more,last:null,use,mods:()=>Object.fromEntries(Object.entries(_m).map(([k,x])=>[k,x.v])),find:wrap(find),who:wrap(who),read:wrap(read),
  _:{cfg,drop,j,norm,stopOf,nm,parseHTML,isT,num,base,load,MON,mins,fmtT,fmtD,REP,repOf,repKind,state,items,info,tok,ajax,FORM,volId,tagMap,tn,tagId,tagName,short,mdy,who,wrap,reg,m:_m}};
if(had.length) use(...had);
})()