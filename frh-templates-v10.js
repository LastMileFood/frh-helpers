(()=>{
// frh templates module v10: what only recurring templates (T<number>) do. Load with the rescues module: frh.use('rescues','templates').
// The rescue edits (items, drop-offs, tags) use the same forms on a template; this module adds the template schedule and repeat, publish/unpublish and cancel.
const {norm,num,REP,repOf,repKind,reg}=frh._;
const S={form:'route-template-reschedule',name:n=>n,rep:(v,sel)=>sel(v('repetition')),undo:P=>({repeat:repOf(P.rep)}),
  // repeat: 'weekly' | 'every other week' | 'monthly' (monthly only on the current date: its choices depend on the date)
  check:(S,P,date,errs)=>{ const kind=S.repeat!=null?repKind(S.repeat):repOf(P.rep);
    if(!REP[kind]) errs.push('repeat must be weekly, every other week or monthly');
    else if(kind==='monthly'&&!(repOf(P.rep)==='monthly'&&date===P.date)) errs.push('a monthly repeat on a new date is set in the page (its choices depend on the date)');
    return kind===repOf(P.rep)?P.rep:kind==='weekly'?'1:':'2:'; },
  // create_current_instance=false: rescues the template already made are not changed (ask the Requester whether to change those too)
  body:(P,date,start,rep,dv)=>({authenticity_token:P.tok,create_current_instance:'false',start_date:date,repetition:rep,start_time:start,duration_in_hours:dv})};
const Pb={note:'the template makes its upcoming rescues as Drafting (nobody notified): publish them one by one',
  check:(m,errs)=>{ if(m==='notify') errs.push('a template makes its rescues as Drafting; publish the template, then each rescue'); },
  // reactivate = Published (FRH makes about 7 weeks of Drafting rescues, nobody notified); drafting = back to Drafting (FRH deletes those Drafting rescues)
  url:(R,m)=>'/route_templates/'+num(R)+(m==='draft'?'/drafting':'/reactivate')};
const Cn={form:'cancel-route-template-form',undo:'reactivate the template in the page (Actions, Activate)'};
reg('templates',10,{},{pf:'route_template',S,Pb,Cn,Un:'a canceled template is republished in the page, not here'});
})()