/* BLOOMING_PHONE_APPOINTMENTS_V6 */
(()=>{'use strict';const $=id=>document.getElementById(id);let cache=[];function token(){return sessionStorage.getItem('bl_access')}function apiBase(){let s=[...document.scripts].map(x=>x.textContent).join('\n'),m=s.match(/api:\s*["']([^"']+)/);return m?m[1]:null}async function call(body){let r=await fetch(apiBase()+'/admin/appointments',{method:'POST',headers:{authorization:'Bearer '+token(),'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok){let e=Error(d.message||'Request failed');e.data=d;throw e}return d}function field(label,id,type='text',required=false){return `<label>${label}</label><input id="ph-${id}" type="${type}" ${required?'required':''}>`}function open(){let old=$('phone-booking-v6');if(old)old.remove();let d=document.createElement('div');d.id='phone-booking-v6';d.innerHTML=`<div class="ph-back"><form class="ph-box"><h2>New Phone Appointment</h2><label>Booking source</label><select id="ph-source"><option>PHONE</option><option>WALK_IN</option><option>EMAIL</option></select>${field('Customer name','name','text',true)}${field('Phone number','phone','tel',true)}${field('Email address','email','email')}${field('Service','service','text',true)}${field('Therapist','therapist')}${field('Appointment date','date','date',true)}${field('Appointment time','time','time',true)}${field('Session length','length')}${field('Customer request notes','notes')}${field('Private front-desk notes','private')}<label>Initial status</label><select id="ph-status"><option>REQUESTED</option><option>CONFIRMED</option></select><label><input id="ph-notify" type="checkbox"> Send confirmation email if available</label><div class="ph-actions"><button type="button" id="ph-cancel">Cancel</button><button class="primary">Save appointment</button></div></form></div>`;document.body.appendChild(d);$('ph-cancel').onclick=()=>d.remove();d.querySelector('form').onsubmit=async e=>{e.preventDefault();let b={bookingSource:$('ph-source').value,customerName:$('ph-name').value,phone:$('ph-phone').value,email:$('ph-email').value,service:$('ph-service').value,therapist:$('ph-therapist').value,appointmentDate:$('ph-date').value,appointmentTime:$('ph-time').value,sessionLength:$('ph-length').value,notes:$('ph-notes').value,frontDeskNotes:$('ph-private').value,status:$('ph-status').value,notifyCustomer:$('ph-notify').checked,customerMessage:'Your Blooming Lotus appointment details have been recorded.'};try{let x=await call(b);alert('Appointment '+x.appointment.appointmentId+' created.'+(x.notification?.sent?' Confirmation email sent.':''));location.reload()}catch(err){if(err.data?.possibleDuplicates?.length&&confirm('Possible duplicate found. Create anyway?')){b.forceCreate=true;let x=await call(b);alert('Appointment '+x.appointment.appointmentId+' created.');location.reload()}else alert(err.message)}}}function enhance(){if($('new-phone-v6'))return;let toolbar=document.querySelector('.toolbar');if(!toolbar)return;let b=document.createElement('button');b.id='new-phone-v6';b.className='primary';b.textContent='New Phone Appointment';b.onclick=open;toolbar.appendChild(b);let f=document.createElement('select');f.id='source-filter-v6';f.innerHTML='<option value="">All sources</option><option>WEB</option><option>PHONE</option><option>WALK_IN</option><option>EMAIL</option>';toolbar.appendChild(f);f.onchange=()=>document.querySelectorAll('.card').forEach(c=>{let badge=c.querySelector('.source-badge');c.style.display=!f.value||badge?.textContent==f.value?'':'none'});decorate()}function decorate(){document.querySelectorAll('.card').forEach(c=>{if(c.querySelector('.source-badge'))return;let id=c.dataset.id,item=cache.find(x=>x.appointmentId==id),src=item?.bookingSource||'WEB',s=document.createElement('span');s.className='source-badge';s.textContent=src;c.querySelector('div')?.appendChild(s)})}const css=document.createElement('style');css.textContent='.ph-back{position:fixed;inset:0;background:#21151db8;z-index:200;display:grid;place-items:center;padding:20px}.ph-box{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:24px}.ph-box label{display:block;margin-top:10px;font-weight:700}.ph-box input,.ph-box select{width:100%;padding:10px;border:1px solid #ddd0c5;border-radius:8px}.ph-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.source-badge{display:inline-block;margin:7px 0 0;padding:4px 8px;border-radius:999px;background:#eee5f0;color:#5b163f;font-size:11px;font-weight:800}';document.head.appendChild(css);let orig=window.fetch;window.fetch=async(...a)=>{let r=await orig(...a);try{if(String(a[0]).endsWith('/admin/appointments')&&(!a[1]||!a[1].method||a[1].method==='GET')){let d=await r.clone().json();cache=d.appointments||[];setTimeout(()=>{enhance();decorate()},0)}}catch{}return r};new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});enhance()})();
/* BLOOMING_PHONE_FIELD_OPTIONS_V21_47_1_START */
(() => {
  'use strict';
  if (window.__BL_PHONE_FIELD_OPTIONS_V21_47_1__) return;
  window.__BL_PHONE_FIELD_OPTIONS_V21_47_1__ = true;

  const AVAILABILITY_API = 'https://d697dcip2i.execute-api.us-east-1.amazonaws.com/availability';
  const SERVICES = [
    ['Deep Tissue Massage', 'Deep Tissue Massage'],
    ['Hot Stone Massage', 'Hot Stone Massage'],
    ['Relaxing / Full Body Massage', 'Relaxation / Full Body Massage'],
    ['Foot Massage / Reflexology', 'Foot Massage / Reflexology'],
    ['Acupressure / Cupping', 'Cupping / Acupressure'],
    ['Other / Ask front desk', 'Other / Ask front desk']
  ];
  const LENGTHS = ['30 Minutes', '45 Minutes', '60 Minutes', '75 Minutes', '90 Minutes', '120 Minutes'];
  const FALLBACK_THERAPISTS = ['Jack', 'Rose', 'Mike', 'No preference'];

  function replaceWithSelect(id, choices, placeholder) {
    const old = document.getElementById(id);
    if (!old || old.tagName === 'SELECT') return old;
    const select = document.createElement('select');
    select.id = id;
    select.required = old.required;
    select.innerHTML = `<option value="">${placeholder}</option>` + choices.map(([value,label]) =>
      `<option value="${value}">${label}</option>`).join('');
    old.replaceWith(select);
    return select;
  }

  function setTherapists(names, preserveValue) {
    const select = document.getElementById('ph-therapist');
    if (!select) return;
    const unique = [...new Set((names || []).filter(Boolean))];
    if (!unique.includes('No preference')) unique.push('No preference');
    select.innerHTML = '<option value="">Select available therapist</option>' +
      unique.map(name => `<option value="${name}">${name}</option>`).join('');
    if (preserveValue && unique.includes(preserveValue)) select.value = preserveValue;
  }

  async function refreshTherapists() {
    const service = document.getElementById('ph-service')?.value;
    const date = document.getElementById('ph-date')?.value;
    const length = document.getElementById('ph-length')?.value;
    const current = document.getElementById('ph-therapist')?.value;
    if (!service) { setTherapists(FALLBACK_THERAPISTS, current); return; }
    if (!date || !length) { setTherapists(FALLBACK_THERAPISTS, current); return; }
    const duration = (length.match(/\d+/) || ['60'])[0];
    const params = new URLSearchParams({date, duration, service});
    const select = document.getElementById('ph-therapist');
    if (select) select.innerHTML = '<option value="">Loading available therapists...</option>';
    try {
      const response = await fetch(`${AVAILABILITY_API}?${params}`, {cache:'no-store'});
      const data = await response.json();
      if (!response.ok || data.closed) throw new Error(data.message || 'Availability lookup failed');
      const names = data.therapists?.length ? data.therapists : FALLBACK_THERAPISTS;
      setTherapists(names, current);
    } catch (error) {
      console.warn('Phone appointment therapist lookup:', error);
      setTherapists(FALLBACK_THERAPISTS, current);
    }
  }

  function enhance() {
    const form = document.querySelector('#phone-booking-v6 .ph-box');
    if (!form || form.dataset.optionsV2147 === 'true') return;
    form.dataset.optionsV2147 = 'true';
    const service = replaceWithSelect('ph-service', SERVICES, 'Select service');
    const therapist = replaceWithSelect('ph-therapist', FALLBACK_THERAPISTS.map(x=>[x,x]), 'Select available therapist');
    const length = replaceWithSelect('ph-length', LENGTHS.map(x=>[x,x]), 'Select session length');
    if (service) service.required = true;
    if (therapist) therapist.required = true;
    if (length) length.required = true;
    ['ph-service','ph-date','ph-length'].forEach(id => document.getElementById(id)?.addEventListener('change', refreshTherapists));
    setTherapists(FALLBACK_THERAPISTS, '');
  }

  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click', event => {
    if (event.target?.id === 'new-phone-v6') setTimeout(enhance, 0);
  });
  enhance();
})();
/* BLOOMING_PHONE_FIELD_OPTIONS_V21_47_1_END */
/* BLOOMING_SOURCE_AWARE_PHONE_TIMES_V21_49_START */
(() => {
  'use strict';
  if (window.__BL_SOURCE_AWARE_PHONE_TIMES_V21_49__) return;
  window.__BL_SOURCE_AWARE_PHONE_TIMES_V21_49__ = true;
  const API='https://d697dcip2i.execute-api.us-east-1.amazonaws.com/availability';
  const $=id=>document.getElementById(id);
  let valid=false, requestSerial=0;
  const toMinutes=value=>{if(!/^\d{2}:\d{2}$/.test(value||''))return null;const [h,m]=value.split(':').map(Number);return h*60+m;};
  const hhmm=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  const label=value=>{let [h,m]=value.split(':').map(Number),suffix=h>=12?'PM':'AM';h=h%12||12;return `${h}:${String(m).padStart(2,'0')} ${suffix}`;};
  const scheduledOptions=()=>{let out=[];for(let m=600;m<1200;m+=15)out.push([hhmm(m),label(hhmm(m))]);return out;};
  function msg(text,error=false){let n=$('ph-availability-v21-49');if(!n){n=document.createElement('div');n.id='ph-availability-v21-49';n.style.cssText='margin:10px 0;padding:10px 12px;border-radius:9px;font-weight:700';$('ph-therapist')?.insertAdjacentElement('afterend',n);}n.textContent=text;n.style.background=error?'#fff0f0':'#f1f9eb';n.style.color=error?'#8d2929':'#3d6830';}
  function therapists(names,current=''){const s=$('ph-therapist');if(!s)return;s.innerHTML='<option value="">Select therapist available for the full session</option>'+names.map(x=>`<option value="${x}">${x}</option>`).join('');if(names.includes(current))s.value=current;}
  function source(){return $('ph-source')?.value||'PHONE';}
  function scheduled(){return source()!=='WALK_IN';}
  function replaceTime(){
    const old=$('ph-time');if(!old)return;
    const current=old.value;
    const replacement=document.createElement(scheduled()?'select':'input');
    replacement.id='ph-time';replacement.required=true;
    if(scheduled()) replacement.innerHTML='<option value="">Select appointment time</option>'+scheduledOptions().map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    else {replacement.type='time';replacement.step='60';replacement.min='10:00';replacement.max='19:59';replacement.value=current||new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});}
    if(scheduled()&&scheduledOptions().some(([v])=>v===current))replacement.value=current;
    old.replaceWith(replacement);replacement.addEventListener('change',check);
    valid=false;therapists([]);
    msg(scheduled()?'Select a 15-minute appointment time.':'Walk-ins may use the actual start minute; availability is checked for the full session.',false);
  }
  async function check(){
    const serial=++requestSerial;valid=false;
    const service=$('ph-service')?.value,date=$('ph-date')?.value,time=$('ph-time')?.value,length=$('ph-length')?.value,current=$('ph-therapist')?.value||'';
    if(!service||!date||!time||!length){therapists([]);msg('Select service, date, time, and session length to load therapist availability.',true);return;}
    const start=toMinutes(time),duration=Number((length.match(/\d+/)||['60'])[0]),end=start+duration;
    if(start===null||start<600||end>1200){therapists([]);msg('The complete session must fit between 10:00 AM and 8:00 PM.',true);return;}
    if(scheduled()&&start%15!==0){therapists([]);msg('Scheduled phone and email appointments use 15-minute times.',true);return;}
    try{
      const r=await fetch(`${API}?${new URLSearchParams({date,duration,service})}`,{cache:'no-store'}),d=await r.json();
      if(serial!==requestSerial)return;if(!r.ok||d.closed)throw Error(d.message||'Availability lookup failed');
      let covered;
      if(scheduled()) covered=(d.slots||[]).filter(x=>x.time===time);
      else {const first=Math.floor(start/15)*15,last=Math.ceil(end/15)*15;covered=(d.slots||[]).filter(x=>{const m=toMinutes(x.time);return m>=first&&m<last;});}
      if(!covered.length){therapists([]);msg('No availability data exists for the selected interval.',true);return;}
      let names=[...(covered[0].therapists||[])];for(const slot of covered.slice(1))names=names.filter(x=>(slot.therapists||[]).includes(x));
      therapists(names,current);valid=names.length>0;
      msg(names.length?`${scheduled()?'Available':'Walk-in available'} for the full ${duration}-minute session: ${names.join(', ')}`:'No therapist is available for the complete selected session.',!names.length);
    }catch(error){therapists([]);msg(error.message||'Availability lookup failed.',true);}
  }
  function enhance(){
    const form=document.querySelector('#phone-booking-v6 form');if(!form||form.dataset.sourceTimesV2149)return;form.dataset.sourceTimesV2149='true';
    $('ph-source')?.addEventListener('change',replaceTime);['ph-service','ph-date','ph-length'].forEach(id=>$(id)?.addEventListener('change',check));
    form.addEventListener('submit',event=>{if(!valid||!$('ph-therapist')?.value){event.preventDefault();event.stopImmediatePropagation();msg('Select a therapist verified for the complete appointment interval before saving.',true);alert('Please choose a therapist available for the full session.');return;}if(source()==='WALK_IN')$('ph-status').value='CONFIRMED';},true);
    replaceTime();
  }
  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target?.id==='new-phone-v6')setTimeout(enhance,0)});enhance();
})();
/* BLOOMING_SOURCE_AWARE_PHONE_TIMES_V21_49_END */
/* BLOOMING_HIDE_PAST_PHONE_TIMES_V21_50_START */
(() => {
  'use strict';
  if (window.__BL_HIDE_PAST_PHONE_TIMES_V21_50__) return;
  window.__BL_HIDE_PAST_PHONE_TIMES_V21_50__ = true;
  const $=id=>document.getElementById(id);
  const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const localMinutes=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());const value=Object.fromEntries(parts.map(x=>[x.type,x.value]));return Number(value.hour)*60+Number(value.minute);};
  const toMinutes=value=>{if(!/^\d{2}:\d{2}$/.test(value||''))return null;const [h,m]=value.split(':').map(Number);return h*60+m;};
  function notice(text){let n=$('ph-past-time-v21-50');if(!n){n=document.createElement('div');n.id='ph-past-time-v21-50';n.style.cssText='margin:10px 0;padding:10px 12px;border-radius:9px;font-weight:700;background:#fff8e8;color:#6b592f';$('ph-time')?.insertAdjacentElement('afterend',n);}n.textContent=text;}
  function apply(){
    const form=document.querySelector('#phone-booking-v6 form'),date=$('ph-date'),time=$('ph-time'),source=$('ph-source');
    if(!form||!date||!time||!source)return;
    const today=localDate();date.min=today;
    if(date.value && date.value<today){date.value=today;time.value='';}
    const isToday=date.value===today;
    if(time.tagName==='SELECT'){
      let visible=0,first='';const current=time.value,now=localMinutes();
      [...time.options].forEach((option,index)=>{if(index===0)return;const future=!isToday||toMinutes(option.value)>now;option.hidden=!future;option.disabled=!future;if(future){visible++;if(!first)first=option.value;}});
      if(current&&[...time.options].some(o=>o.value===current&&o.disabled)){time.value='';time.dispatchEvent(new Event('change',{bubbles:true}));}
      notice(isToday?(visible?`Past times are hidden. Select a remaining time for today.`:'No appointment times remain today. Please choose a future date.'):'All business-hour times are available to check for this future date.');
    } else {
      const now=localMinutes(),current=toMinutes(time.value);
      time.min=isToday?`${String(Math.floor(now/60)).padStart(2,'0')}:${String(now%60).padStart(2,'0')}`:'10:00';
      if(isToday&&current!==null&&current<now){time.value=time.min;time.dispatchEvent(new Event('change',{bubbles:true}));}
      notice(isToday?'Walk-in time cannot be earlier than the current Roanoke time.':'Walk-in time must fit within business hours.');
    }
  }
  function enhance(){const form=document.querySelector('#phone-booking-v6 form');if(!form)return;if(!form.dataset.pastTimesV2150){form.dataset.pastTimesV2150='true';['ph-date','ph-source'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(apply,0)));}apply();}
  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target?.id==='new-phone-v6')setTimeout(enhance,0)});enhance();
})();
/* BLOOMING_HIDE_PAST_PHONE_TIMES_V21_50_END */
