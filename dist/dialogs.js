'use strict';
let webDialog=null;
function dialogActive(){return !!webDialog}
function openWebDialog({title,message='',body='',confirmLabel='ยืนยัน',danger=false,read=()=>true,focus='#web-cancel'}){
 if(webDialog)return Promise.resolve(null);
 const previous=document.activeElement;
 return new Promise(resolve=>{
  webDialog={resolve,previous};
  document.querySelector('#dialog-overlay').innerHTML=`<div class="web-dialog-backdrop"><section class="web-dialog" role="dialog" aria-modal="true" aria-labelledby="web-title" aria-describedby="web-message"><header><h2 id="web-title">${esc(title)}</h2><button id="web-close" class="ghost" aria-label="ปิดหน้าต่าง">${icon('close')}</button></header><form id="web-dialog-form" novalidate><div class="web-dialog-body"><p id="web-message">${esc(message)}</p>${body}<div id="web-error" class="error" role="alert"></div></div><footer><button type="button" id="web-cancel">ยกเลิก</button><button type="submit" id="web-accept" class="primary ${danger?'destructive':''}">${esc(confirmLabel)}</button></footer></form></section></div>`;
  const finish=value=>{
   const active=webDialog;if(!active)return;
   document.querySelector('#dialog-overlay').innerHTML='';webDialog=null;syncNavigation();
   const overlay=document.querySelector('#overlay');if(overlay)overlay.inert=false;
   if(active.previous?.isConnected&&!active.previous.closest('[inert]'))active.previous.focus();
   active.resolve(value);
  };
  webDialog.finish=finish;
  document.querySelector('#web-cancel').onclick=()=>finish(null);
  document.querySelector('#web-close').onclick=()=>finish(null);
  document.querySelector('.web-dialog-backdrop').onclick=e=>{if(e.target===document.querySelector('.web-dialog-backdrop'))finish(null)};
  document.querySelector('#web-dialog-form').onsubmit=e=>{e.preventDefault();try{finish(read())}catch(error){document.querySelector('#web-error').textContent=error.message}};
  syncNavigation();document.querySelector('#overlay').inert=true;
  setTimeout(()=>(document.querySelector(focus)||document.querySelector('#web-cancel'))?.focus(),0);
 });
}
async function askConfirm(title,message,confirmLabel='ยืนยัน',danger=false){return await openWebDialog({title,message,confirmLabel,danger})===true}
function askProject(){return openWebDialog({title:'เพิ่มโปรเจกต์',message:'ตั้งชื่อโปรเจกต์เพื่อจัดกลุ่มงานของคุณ',confirmLabel:'เพิ่มโปรเจกต์',focus:'#project-name',body:'<label for="project-name">ชื่อโปรเจกต์</label><input id="project-name" autocomplete="off" placeholder="เช่น งานเว็บไซต์">',read:()=>{const name=document.querySelector('#project-name').value.trim();if(!name)throw Error('กรุณาระบุชื่อโปรเจกต์');return name}})}
document.addEventListener('keydown',e=>{
 if(!webDialog)return;
 e.stopImmediatePropagation();
 if(e.key==='Escape'){e.preventDefault();webDialog.finish(null)}
 if(e.key==='Tab'){
  const root=document.querySelector('.web-dialog'),els=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(el=>el.getClientRects().length);
  if(!els.length)return;
  if(!root.contains(document.activeElement)||e.shiftKey&&document.activeElement===els[0]){e.preventDefault();(e.shiftKey?els.at(-1):els[0]).focus()}
  else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus()}
 }
});
function formError(form,selector){
 const invalid=[...form.elements].find(el=>!el.disabled&&el.willValidate&&!el.validity.valid);
 if(!invalid)return false;
 const label=invalid.labels?.[0]?.textContent.replace('*','').trim()||'ช่องนี้';
 let message=invalid.validity.valueMissing?'กรุณาระบุ'+label:invalid.validity.typeMismatch?'กรุณากรอก'+label+'ให้ถูกต้อง':'กรุณาตรวจสอบ'+label;
 if(invalid.validity.rangeUnderflow)message=label+'ต้องไม่น้อยกว่า '+invalid.min;
 const error=document.querySelector(selector);error.className='error';error.textContent=message;
 const extras=document.querySelector('#extra-fields');if(extras)extras.hidden=false;
 (invalid.hidden?invalid.nextElementSibling:invalid)?.focus();return true;
}
// Keep form values and change events on the source controls; all choice UI belongs to the app.
function pickerCaption(control,kind,label){if(kind==='select')return [...control.selectedOptions].map(o=>o.textContent).join(', ');if(!control.value)return 'เลือก'+label;if(kind==='date')return fmtDate(control.value,true);if(kind==='datetime-local')return fmtDate(control.value.slice(0,10),true)+' · '+control.value.slice(11);return control.value}
function enhancePickers(){
 if(!document.body)return;
 document.querySelectorAll('select:not(:disabled),input[type=date]:not(:disabled),input[type=time]:not(:disabled),input[type=datetime-local]:not(:disabled)').forEach(control=>{
  if(control.dataset.webPicker)return;control.dataset.webPicker='true';
  const kind=control.tagName==='SELECT'?'select':control.type;
  const label=control.getAttribute('aria-label')||control.labels?.[0]?.textContent.replace('*','').trim()||'เลือกค่า';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='picker-trigger';trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML=`<span>${esc(pickerCaption(control,kind,label))}</span>${icon(kind==='select'?'down':kind==='time'?'clock':'calendar')}`;
  control.hidden=true;control.insertAdjacentElement('afterend',trigger);
  for(const fieldLabel of control.labels||[])fieldLabel.onclick=e=>{e.preventDefault();trigger.click()};
  trigger.onclick=async()=>{
   trigger.setAttribute('aria-expanded','true');
   let value;
   if(kind==='select')value=await chooseOptions(control,label);
   else value=await chooseDateTime(control,label,kind);
   trigger.setAttribute('aria-expanded','false');
   if(value===null||value===undefined)return;
   if(kind==='select'&&control.multiple){[...control.options].forEach(o=>o.selected=value.includes(o.value))}else control.value=value;
   trigger.querySelector('span').textContent=pickerCaption(control,kind,label);
   control.dispatchEvent(new Event('change',{bubbles:true}));
  };
 });
}
function chooseOptions(control,label){
 const options=[...control.options];
 const body=`<div class="web-options">${options.map((o,i)=>`<label><input type="${control.multiple?'checkbox':'radio'}" name="web-option" value="${i}" ${o.selected?'checked':''} ${o.disabled?'disabled':''}><span>${esc(o.textContent)}</span></label>`).join('')}</div>`;
 return openWebDialog({title:label,body,confirmLabel:'ใช้ตัวเลือก',focus:'.web-options input:checked',read:()=>{const selected=[...document.querySelectorAll('.web-options input:checked')].map(el=>options[Number(el.value)].value);return control.multiple?selected:selected[0]??''}});
}
function chooseDateTime(control,label,kind){
 let picked=control.value.slice(0,10),shown=(picked&&validDate(picked)?picked:today()).slice(0,7);
 const hasDate=kind!=='time',hasTime=kind!=='date',time=kind==='time'?control.value:control.value.slice(11);
 const body=`${hasDate?'<div class="web-calendar"></div>':''}${hasTime?`<div class="web-time"><label>ชั่วโมง<input id="web-hour" inputmode="numeric" type="number" min="0" max="23" value="${esc(time.slice(0,2)||'09')}"></label><span>:</span><label>นาที<input id="web-minute" inputmode="numeric" type="number" min="0" max="59" value="${esc(time.slice(3,5)||'00')}"></label></div>`:''}<div class="web-picker-actions">${hasDate?'<button type="button" id="web-today">วันนี้</button>':''}<button type="button" id="web-clear">ล้างค่า</button></div>`;
 const promise=openWebDialog({title:label,body,confirmLabel:'ใช้ค่า',focus:hasTime?'#web-hour':'#web-accept',read:()=>{
  if(hasDate&&!validDate(picked))throw Error('กรุณาเลือกวันที่');
  let clock='';if(hasTime){const h=document.querySelector('#web-hour').value,m=document.querySelector('#web-minute').value;if(!/^\d{1,2}$/.test(h)||!/^\d{1,2}$/.test(m)||Number(h)>23||Number(m)>59)throw Error('กรุณาระบุเวลา 00:00–23:59');clock=h.padStart(2,'0')+':'+m.padStart(2,'0')}
  return kind==='date'?picked:kind==='time'?clock:picked+'T'+clock;
 }});
 const paint=()=>{
  if(!hasDate)return;
  const first=shown+'-01',start=addDays(first,-((new Date(first+'T12:00:00Z').getUTCDay()+6)%7));
  document.querySelector('.web-calendar').innerHTML=`<div class="web-month"><button type="button" id="web-month-prev" aria-label="เดือนก่อน">←</button><strong>${new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(first+'T12:00:00Z'))}</strong><button type="button" id="web-month-next" aria-label="เดือนถัดไป">→</button></div><div class="web-days">${['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'].map(d=>`<span>${d}</span>`).join('')}${Array.from({length:42},(_,i)=>{const date=addDays(start,i);return `<button type="button" data-web-date="${date}" aria-label="${fmtDate(date,true)}" aria-pressed="${date===picked}" class="${date.slice(0,7)!==shown?'other-month':''}">${Number(date.slice(8))}</button>`}).join('')}</div><p class="web-selected">${picked?'เลือก: '+fmtDate(picked,true):'ยังไม่ได้เลือกวันที่'}</p>`;
  document.querySelectorAll('[data-web-date]').forEach(b=>b.onclick=()=>{picked=b.dataset.webDate;paint();document.querySelector(`[data-web-date="${picked}"]`)?.focus()});
  for(const [id,n]of [['web-month-prev',-1],['web-month-next',1]])document.querySelector('#'+id).onclick=()=>{const d=new Date(shown+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);shown=d.toISOString().slice(0,7);paint();document.querySelector('#'+id).focus()};
 };
 paint();if(hasDate)document.querySelector('#web-today').onclick=()=>{picked=today();shown=picked.slice(0,7);paint()};
 document.querySelector('#web-clear').onclick=()=>webDialog.finish('');
 return promise;
}
