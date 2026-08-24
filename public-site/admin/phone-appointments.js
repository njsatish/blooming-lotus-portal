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
/* BLOOMING_PHONE_EXACT_AVAILABILITY_V21_48_START */
(() => {
  'use strict';
  if (window.__BL_PHONE_EXACT_AVAILABILITY_V21_48__) return;
  window.__BL_PHONE_EXACT_AVAILABILITY_V21_48__ = true;
  const API='https://d697dcip2i.execute-api.us-east-1.amazonaws.com/availability';
  const $=id=>document.getElementById(id);
  let validSelection=false;
  function minutes(v){if(!/^\d{2}:\d{2}$/.test(v||''))return null;const [h,m]=v.split(':').map(Number);return h*60+m;}
  function notice(text,error=false){let n=$('ph-availability-v21-48');if(!n){n=document.createElement('div');n.id='ph-availability-v21-48';n.style.cssText='margin:10px 0;padding:10px 12px;border-radius:9px;font-weight:700';$('ph-therapist')?.insertAdjacentElement('afterend',n);}n.textContent=text;n.style.background=error?'#fff0f0':'#f1f9eb';n.style.color=error?'#8d2929':'#3d6830';}
  function setTherapists(names,current=''){const s=$('ph-therapist');if(!s)return;s.innerHTML='<option value="">Select therapist available at this exact time</option>'+names.map(x=>`<option value="${x}">${x}</option>`).join('');if(names.includes(current))s.value=current;}
  async function validateExact(){
    validSelection=false;
    const service=$('ph-service')?.value,date=$('ph-date')?.value,time=$('ph-time')?.value,length=$('ph-length')?.value,current=$('ph-therapist')?.value||'';
    const mm=minutes(time);
    if(mm!==null&&mm%15!==0){setTherapists([]);notice('Appointment time must be on a 15-minute interval, such as 12:15 or 12:30.',true);return;}
    if(!service||!date||!time||!length){setTherapists([]);notice('Select service, date, time, and session length to load exact therapist availability.',true);return;}
    const duration=(length.match(/\d+/)||['60'])[0];
    try{
      const r=await fetch(`${API}?${new URLSearchParams({date,duration,service})}`,{cache:'no-store'}),d=await r.json();
      if(!r.ok||d.closed)throw Error(d.message||'Availability lookup failed');
      const slot=(d.slots||[]).find(x=>x.time===time);
      const names=slot&&!slot.fullyBooked?(slot.therapists||[]):[];
      setTherapists(names,current);
      validSelection=names.length>0;
      notice(names.length?`Available at ${time}: ${names.join(', ')}`:'No therapist is available for this service, duration, and exact time.',!names.length);
    }catch(e){setTherapists([]);notice(e.message||'Availability lookup failed.',true);}
  }
  function enhance(){const form=document.querySelector('#phone-booking-v6 form');if(!form||form.dataset.exactV2148)return;form.dataset.exactV2148='true';const time=$('ph-time');if(time){time.step='900';time.min='10:00';time.max='19:45';}['ph-service','ph-date','ph-time','ph-length'].forEach(id=>$(id)?.addEventListener('change',validateExact));form.addEventListener('submit',e=>{const therapist=$('ph-therapist')?.value;if(!validSelection||!therapist){e.preventDefault();e.stopImmediatePropagation();notice('Choose a therapist returned for the exact selected time before saving.',true);alert('Please select service, date, a 15-minute time, session length, and an available therapist.');}},true);validateExact();}
  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target?.id==='new-phone-v6')setTimeout(enhance,0)});enhance();
})();
/* BLOOMING_PHONE_EXACT_AVAILABILITY_V21_48_END */
/* BLOOMING_PHONE_AVAILABILITY_ORDER_V21_51_START */
(() => {
  'use strict';
  if (window.__BL_PHONE_AVAILABILITY_ORDER_V21_51__) return;
  window.__BL_PHONE_AVAILABILITY_ORDER_V21_51__ = true;
  const API='https://d697dcip2i.execute-api.us-east-1.amazonaws.com/availability';
  const $=id=>document.getElementById(id);
  let availability=null,valid=false,serial=0;
  const toMin=v=>{if(!/^\d{2}:\d{2}$/.test(v||''))return null;const [h,m]=v.split(':').map(Number);return h*60+m;};
  const hhmm=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const label=v=>{let [h,m]=v.split(':').map(Number),ap=h>=12?'PM':'AM';h=h%12||12;return `${h}:${String(m).padStart(2,'0')} ${ap}`;};
  function note(text,error=false){let n=$('ph-order-note-v21-51');if(!n){n=document.createElement('div');n.id='ph-order-note-v21-51';n.style.cssText='margin:10px 0;padding:10px 12px;border-radius:9px;font-weight:700';$('ph-time')?.insertAdjacentElement('afterend',n);}n.textContent=text;n.style.background=error?'#fff0f0':'#f1f9eb';n.style.color=error?'#8d2929':'#3d6830';}
  function moveField(id,beforeId){const field=$(id),before=$(beforeId);if(!field||!before)return;const labelNode=field.previousElementSibling;if(labelNode?.tagName==='LABEL')before.parentNode.insertBefore(labelNode,before);before.parentNode.insertBefore(field,before);}
  function replaceSelect(id,placeholder,opts=[]){const old=$(id);if(!old)return null;const s=document.createElement('select');s.id=id;s.required=true;s.innerHTML=`<option value="">${placeholder}</option>`+opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');old.replaceWith(s);return s;}
  function clearTimes(message='Select session length, service, therapist, and date to view available times.') {const time=$('ph-time');if(time?.tagName==='SELECT')time.innerHTML='<option value="">Select available time</option>';valid=false;note(message,true);}
  function setTherapists(names,current=''){const s=$('ph-therapist');if(!s)return;s.innerHTML='<option value="">Select therapist</option>'+names.map(x=>`<option value="${x}">${x}</option>`).join('');if(names.includes(current))s.value=current;}
  function source(){return $('ph-source')?.value||'PHONE';}
  async function loadBase(){
    const run=++serial;availability=null;valid=false;
    const length=$('ph-length')?.value,service=$('ph-service')?.value,date=$('ph-date')?.value,current=$('ph-therapist')?.value||'';
    setTherapists([]);clearTimes();
    if(!length||!service){note('Select session length and service first.',true);return;}
    if(!date){note('Select a date to load therapists and available times.',true);return;}
    const duration=(length.match(/\d+/)||['60'])[0];
    try{const r=await fetch(`${API}?${new URLSearchParams({date,duration,service})}`,{cache:'no-store'}),d=await r.json();if(run!==serial)return;if(!r.ok||d.closed)throw Error(d.message||'Availability lookup failed');availability=d;const names=(d.therapists||[]).filter(name=>(d.slots||[]).some(slot=>(slot.therapists||[]).includes(name)));setTherapists(names,current);note(names.length?'Select a therapist to view available times.':'No therapist is available for this service and session length.',!names.length);if(current&&names.includes(current))buildTimes();}catch(e){note(e.message||'Availability lookup failed.',true);}}
  function buildTimes(){
    const therapist=$('ph-therapist')?.value,time=$('ph-time'),length=$('ph-length')?.value,date=$('ph-date')?.value;if(!availability||!therapist||!time)return clearTimes('Select an available therapist to load times.');
    const duration=Number((length.match(/\d+/)||['60'])[0]);
    if(source()==='WALK_IN'){const input=document.createElement('input');input.id='ph-time';input.type='time';input.required=true;input.step='60';input.min='10:00';input.max=`${String(Math.floor((1200-duration)/60)).padStart(2,'0')}:${String((1200-duration)%60).padStart(2,'0')}`;time.replaceWith(input);input.addEventListener('change',validateWalkIn);note('Enter the actual walk-in start time. The full session will be checked.',false);return;}
    if(time.tagName!=='SELECT'){replaceSelect('ph-time','Select available time');}
    const s=$('ph-time');const options=(availability.slots||[]).filter(slot=>!slot.fullyBooked&&(slot.therapists||[]).includes(therapist)).map(slot=>[slot.time,label(slot.time)]);
    s.innerHTML='<option value="">Select available time</option>'+options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');s.addEventListener('change',()=>{valid=!!s.value;note(valid?`${therapist} is available at ${label(s.value)} for the selected session.`:'Select an available time.',!valid);});valid=false;note(options.length?`Available times for ${therapist}: ${options.length}`:`No available times remain for ${therapist} on this date.`,!options.length);
  }
  function validateWalkIn(){const time=$('ph-time')?.value,therapist=$('ph-therapist')?.value,length=$('ph-length')?.value;if(!availability||!time||!therapist)return;const start=toMin(time),duration=Number((length.match(/\d+/)||['60'])[0]),first=Math.floor(start/15)*15,last=Math.ceil((start+duration)/15)*15,slots=(availability.slots||[]).filter(x=>{const m=toMin(x.time);return m>=first&&m<last;});valid=slots.length>0&&slots.every(x=>(x.therapists||[]).includes(therapist));note(valid?`${therapist} is available for the complete walk-in session.`:'The selected therapist is not available for the complete walk-in session.',!valid);}
  function reorder(){const form=document.querySelector('#phone-booking-v6 form');if(!form||form.dataset.orderV2151)return;form.dataset.orderV2151='true';moveField('ph-length','ph-service');moveField('ph-service','ph-therapist');moveField('ph-therapist','ph-date');moveField('ph-date','ph-time');if($('ph-time')?.tagName!=='SELECT')replaceSelect('ph-time','Select available time');['ph-length','ph-service','ph-date'].forEach(id=>$(id)?.addEventListener('change',loadBase));$('ph-therapist')?.addEventListener('change',buildTimes);$('ph-source')?.addEventListener('change',()=>{if($('ph-time')?.tagName!=='SELECT')replaceSelect('ph-time','Select available time');availability?buildTimes():loadBase();});form.addEventListener('submit',e=>{if(!valid||!$('ph-time')?.value||!$('ph-therapist')?.value){e.preventDefault();e.stopImmediatePropagation();alert('Please select session length, service, therapist, date, and an available time.');}},true);clearTimes();}
  new MutationObserver(reorder).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('click',e=>{if(e.target?.id==='new-phone-v6')setTimeout(reorder,0)});reorder();
})();
/* BLOOMING_PHONE_AVAILABILITY_ORDER_V21_51_END */
