/* BLOOMING_FRONT_DESK_DATE_FILTERS_V10 */
(() => {
  'use strict';
  if (window.__BL_DATE_FILTER_V10__) return;
  window.__BL_DATE_FILTER_V10__ = true;

  let appointments = [];
  let scheduled = false;
  const nativeFetch = window.fetch.bind(window);
  const byId = id => document.getElementById(id);
  const localDate = value => {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const plus = (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
  const dateOf = x => x?.confirmedDate || x?.proposedDate || x?.preferredDate || x?.date || '';
  const active = s => ['REQUESTED','CONTACTED','CONFIRMED','RESCHEDULE_NEEDED'].includes(s || 'REQUESTED');

  function bounds(mode) {
    const now = day(new Date());
    if (mode === 'today') return [now,now];
    if (mode === 'tomorrow') { const d=plus(now,1); return [d,d]; }
    if (mode === 'week') { const d=plus(now,-now.getDay()); return [d,plus(d,6)]; }
    if (mode === 'next7') return [now,plus(now,6)];
    if (mode === 'month') return [new Date(now.getFullYear(),now.getMonth(),1),new Date(now.getFullYear(),now.getMonth()+1,0)];
    if (mode === 'next30') return [now,plus(now,29)];
    if (mode === 'upcoming') return [now,null];
    if (mode === 'custom') return [localDate(byId('date-from-v10')?.value),localDate(byId('date-to-v10')?.value)];
    return [null,null];
  }
  function matches(x,mode) {
    if (mode === 'all') return true;
    const d=localDate(dateOf(x)); if (!d) return false;
    const now=day(new Date());
    if (mode === 'overdue') return d<now && ['REQUESTED','CONTACTED','RESCHEDULE_NEEDED'].includes(x.status||'REQUESTED');
    const [a,b]=bounds(mode);
    return !(a&&d<a) && !(b&&d>b) && !(mode==='upcoming'&&!active(x.status));
  }
  function install() {
    if (byId('date-range-v10')) return;
    const toolbar=document.querySelector('.toolbar'); if (!toolbar) return;
    const box=document.createElement('div'); box.id='date-controls-v10';
    box.innerHTML='<label for="date-range-v10">Date range</label><select id="date-range-v10"><option value="upcoming">Upcoming active</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">This week (Sun-Sat)</option><option value="next7">Next 7 days</option><option value="month">This month</option><option value="next30">Next 30 days</option><option value="overdue">Overdue requests</option><option value="custom">Custom range</option><option value="all">All dates</option></select><span id="custom-v10" hidden><label>From <input id="date-from-v10" type="date"></label><label>To <input id="date-to-v10" type="date"></label></span>';
    toolbar.appendChild(box);
    const summary=document.createElement('div'); summary.id='date-summary-v10'; toolbar.insertAdjacentElement('afterend',summary);
    ['date-range-v10','date-from-v10','date-to-v10'].forEach(id=>byId(id).addEventListener('change',schedule));
  }
  function apply() {
    scheduled=false; install();
    const selector=byId('date-range-v10'); if (!selector) return;
    const mode=selector.value; const custom=byId('custom-v10'); if(custom) custom.hidden=mode!=='custom';
    const visible=[];
    document.querySelectorAll('.card[data-id]').forEach(card=>{
      const item=appointments.find(x=>String(x.appointmentId)===String(card.dataset.id));
      const show=Boolean(item&&matches(item,mode));
      card.classList.toggle('date-hidden-v10',!show);
      if(show)visible.push(item);
    });
    const count={}; visible.forEach(x=>{let s=x.status||'REQUESTED';count[s]=(count[s]||0)+1});
    const value=`Displayed: ${visible.length} | Requested: ${count.REQUESTED||0} | Contacted: ${count.CONTACTED||0} | Confirmed: ${count.CONFIRMED||0} | Reschedule: ${count.RESCHEDULE_NEEDED||0}`;
    const summary=byId('date-summary-v10');
    if(summary && summary.textContent!==value) summary.textContent=value;
  }
  function schedule(){ if(scheduled)return; scheduled=true; requestAnimationFrame(apply); }

  window.fetch=async(...args)=>{
    const response=await nativeFetch(...args);
    try {
      const url=String(args[0]||''),opt=args[1]||{};
      if(url.endsWith('/admin/appointments')&&(!opt.method||opt.method==='GET')){
        const data=await response.clone().json(); appointments=data.appointments||[]; schedule();
      }
    } catch(error){ console.warn('Date-filter response inspection failed.',error); }
    return response;
  };
  new MutationObserver(mutations=>{
    if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.card,.toolbar')||n.querySelector?.('.card,.toolbar'))))) schedule();
  }).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
