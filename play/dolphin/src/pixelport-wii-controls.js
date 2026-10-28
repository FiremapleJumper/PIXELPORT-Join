// SPDX-License-Identifier: GPL-2.0-or-later
import {readGamepadInput,selectPreferredGamepad} from './input.js';

export const WII_PROFILE=new URLSearchParams(globalThis.location?.search||'').get('controls')==='wii';
export const WII_KEYS=Object.freeze({
 ArrowUp:'D_UP',ArrowDown:'D_DOWN',ArrowLeft:'D_LEFT',ArrowRight:'D_RIGHT',
 KeyW:'D_UP',KeyS:'D_DOWN',KeyA:'D_LEFT',KeyD:'D_RIGHT',
 KeyX:'A',KeyZ:'B',KeyV:'X',KeyB:'Y',Enter:'START',
 ShiftLeft:'Z',ShiftRight:'Z',KeyQ:'L',KeyJ:'C_STICK_LEFT',KeyL:'C_STICK_RIGHT',Home:'HOME'
});
export const WII_ACTIONS=Object.freeze([
 ['two','2 · Jump',0,0],['one','1 · Run',1,2],['a','A · Bubble',2,1],
 ['b','B',3,3],['plus','+ · Pause',9,9],['minus','−',8,8],
 ['shake','Shake',4,4],['home','Home',16,16],
 ['up','D-pad up',12,12],['down','D-pad down',13,13],
 ['left','D-pad left',14,14],['right','D-pad right',15,15]
]);
export function defaultWiiPadMapping(){return {buttons:Object.fromEntries(WII_ACTIONS.map(([name,,,button])=>[name,button])),moveX:0,moveY:1,tiltX:2,invertTilt:false}}
export function normalizeWiiPadMapping(value){
 const out=defaultWiiPadMapping();
 for(const [name] of WII_ACTIONS){const number=value?.buttons?.[name];if(Number.isInteger(number)&&number>=-1&&number<64)out.buttons[name]=number}
 for(const name of ['moveX','moveY','tiltX']){const number=value?.[name];if(Number.isInteger(number)&&number>=-1&&number<16)out[name]=number}
 out.invertTilt=value?.invertTilt===true;out.invertMoveX=value?.invertMoveX===true;out.invertMoveY=value?.invertMoveY===true;return out;
}
export function readWiiGamepadInput(pad,mapping=defaultWiiPadMapping()){
 const config=normalizeWiiPadMapping(mapping),buttons=Array.from({length:17},()=>({pressed:false,value:0}));
 for(const [name,,virtual] of WII_ACTIONS){const physical=config.buttons[name];if(physical>=0&&pad?.buttons?.[physical])buttons[virtual]=pad.buttons[physical]}
 const axis=index=>index<0?0:Math.max(-1,Math.min(1,Number(pad?.axes?.[index])||0));
 const result=readGamepadInput({buttons,axes:[axis(config.moveX)*(config.invertMoveX?-1:1),axis(config.moveY)*(config.invertMoveY?-1:1),axis(config.tiltX)*(config.invertTilt?-1:1),0]});
 if(buttons[16].pressed){result.pressed.add('HOME');result.state.mask|=1<<20}
 return result;
}

const CAPTURE_TIMEOUT_MS=15000;
const buttonDown=button=>Boolean(button?.pressed)||(Number(button?.value)||0)>=0.65;
const buttonsReleased=pad=>Array.from(pad?.buttons||[]).every(button=>!button?.pressed&&(Number(button?.value)||0)<0.25);

// Capture raw input before mapping it, so a remap never depends on its old binding.
export function beginWiiCapture(kind,pad,now=0){
 return {kind,started:now,id:pad?.id??null,index:pad?.index??null,armed:false,axes:new Set()};
}
export function sampleWiiCapture(state,pad,now=0){
 if(now-state.started>=CAPTURE_TIMEOUT_MS)return {status:'timeout'};
 if(!pad||pad.connected===false)return {status:state.id===null?'connect':'disconnected'};
 if(state.id===null){state.id=pad.id??'';state.index=pad.index??null}
 if(state.id!==(pad.id??'')||state.index!==(pad.index??null))return {status:'disconnected'};
 if(state.kind==='button'){
  if(!state.armed){if(!buttonsReleased(pad))return {status:'release'};state.armed=true;return {status:'listening'}}
  const button=Array.from(pad.buttons||[]).findIndex(buttonDown);
  return button<0?{status:'listening'}:{status:'captured',button};
 }
 for(let index=0;index<(pad.axes?.length||0);index++){
  const value=Number(pad.axes[index])||0;
  if(Math.abs(value)<0.25)state.axes.add(index);
  if(state.axes.has(index)&&Math.abs(value)>=0.65)return {status:'captured',axis:index,value};
 }
 return {status:'listening'};
}
const STANDARD_BUTTON_NAMES=['Bottom face button','Right face button','Left face button','Top face button','Left shoulder','Right shoulder','Left trigger','Right trigger','Back / Select','Start / Menu','Left stick click','Right stick click','D-pad up','D-pad down','D-pad left','D-pad right','Home'];
const AXIS_ACTIONS=[['moveX','Move horizontal','Move your stick right.'],['moveY','Move vertical','Move your stick down.'],['tiltX','Tilt horizontal','Move the stick you want to use for tilt to the right.']];

export function createWiiControls({getGamepads=()=>navigator.getGamepads?.()||[]}={}){
 if(!WII_PROFILE)return null;
 let deviceId=null,mapping=defaultWiiPadMapping(),device=null,capture=null,blocked=null;
 const panel=document.createElement('details');panel.id='pixelportWiiControls';
 panel.innerHTML=`<summary>Wii keyboard & 8BitDo / gamepad controls</summary><p><strong>Sideways Wii Remote · Player 1</strong> — arrows or WASD move; X jumps (2); Z runs (1); V bubbles (A); Enter pauses (+); Shift is −; Q shakes; J / L tilt. Click the game first.</p><p data-device role="status">Press a button on your controller to connect it.</p><p><strong>Click Set, then press your chosen controller button.</strong> For a stick assignment, move the stick in the requested direction. Your choices save automatically for this controller.</p><div class="wii-map-grid" data-map></div><p data-live role="status" aria-live="polite" aria-atomic="true"></p><button type="button" data-cancel hidden>Cancel assignment</button><label class="wii-invert"><input type="checkbox" data-invert> Reverse tilt direction</label><button type="button" data-reset>Reset controller mapping</button><p class="wii-small">Motion is generated from buttons and sticks. Physical gyroscope, pointer and original Wii Remote pairing are not supported.</p>`;
 const style=document.createElement('style');style.textContent='#pixelportWiiControls{flex:0 0 auto;max-height:65vh;overflow:auto;color:#dce5ef;background:#17202d;border:1px solid #3a485d;border-radius:8px;padding:12px;margin:8px 0 14px;font:12px/1.6 system-ui}#pixelportWiiControls summary{cursor:pointer;font-weight:650}#pixelportWiiControls p{color:#ced7e6;margin:9px 0}.wii-small{font-size:11px}.wii-map-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:9px}.wii-map-row{display:flex;flex-direction:column;gap:5px;padding:8px;border:1px solid #3a485d;border-radius:6px}.wii-map-row small{min-height:18px;color:#c3d1e5}.wii-map-buttons{display:flex;gap:5px}.wii-invert{display:flex;align-items:center;gap:8px;margin:12px 0}#pixelportWiiControls button{background:#e1e9fa;color:#17273e;border:1px solid #aebbd1;padding:7px 10px;border-radius:5px;min-height:34px;font:12px system-ui}#pixelportWiiControls button:focus-visible{outline:3px solid #7dcfff;outline-offset:2px}#pixelportWiiControls button[aria-pressed=true]{background:#91dcff;color:#102139}#pixelportWiiControls button[data-clear]{background:#26364b;color:#dce5ef}#pixelportWiiControls [data-live]{min-height:22px;font-weight:600}#pixelportWiiControls [hidden]{display:none!important}';document.head.append(style);
 document.querySelector('.play-area').prepend(panel);
 const controls=panel.querySelector('[data-map]'),deviceLabel=panel.querySelector('[data-device]'),live=panel.querySelector('[data-live]'),invert=panel.querySelector('[data-invert]'),cancel=panel.querySelector('[data-cancel]');
 function status(message){if(live.textContent!==message)live.textContent=message}
 function save(){if(deviceId)try{localStorage.setItem('pixelport-wii-pad:'+deviceId,JSON.stringify(mapping))}catch{}}
 function stopCapture(message){
  if(capture&&device)blocked={id:device.id,index:device.index,axis:null};
  capture=null;cancel.hidden=true;status(message);render();
 }
 function startCapture(name,label,kind,prompt){
  capture={name,label,prompt,state:beginWiiCapture(kind,device,performance.now())};
  blocked=null;cancel.hidden=false;render();
  status(device?(kind==='button'?'Release all buttons, then press the button for '+label+'.':prompt):'Press any button to connect your controller, release it, then choose your input.');
 }
 function row(name,label,kind,prompt){
  const box=document.createElement('div');box.className='wii-map-row';
  const title=document.createElement('strong');title.textContent=label;
  const binding=document.createElement('small');const number=kind==='button'?mapping.buttons[name]:mapping[name];
  binding.textContent=number<0?'Not assigned':kind==='axis'?'Stick movement assigned':device?.mapping==='standard'?(STANDARD_BUTTON_NAMES[number]||'Custom button assigned'):'Button assigned';
  const buttons=document.createElement('div');buttons.className='wii-map-buttons';
  const set=document.createElement('button');set.type='button';set.dataset.assign=name;set.textContent=capture?.name===name?'Listening…':'Set';set.setAttribute('aria-label','Set '+label);set.setAttribute('aria-pressed',String(capture?.name===name));set.onclick=()=>startCapture(name,label,kind,prompt);
  const clear=document.createElement('button');clear.type='button';clear.dataset.clear=name;clear.textContent='Clear';clear.setAttribute('aria-label','Clear '+label);clear.onclick=()=>{capture=null;cancel.hidden=true;if(kind==='button')mapping.buttons[name]=-1;else mapping[name]=-1;save();status(label+' cleared.');render()};
  buttons.append(set,clear);box.append(title,binding,buttons);controls.append(box);
 }
 function render(){
  const focused=document.activeElement?.dataset?.assign;
  controls.replaceChildren();
  for(const [name,label] of WII_ACTIONS)row(name,label,'button','Press the controller button for '+label+'.');
  for(const [name,label,prompt] of AXIS_ACTIONS)row(name,label,'axis',prompt);
  invert.checked=mapping.invertTilt;
  if(focused)controls.querySelector('[data-assign="'+focused+'"]')?.focus({preventScroll:true});
 }
 function usePad(pad){
  const nextId=pad?.id||null;device=pad;
  if(nextId!==deviceId){deviceId=nextId;let stored;try{stored=JSON.parse(localStorage.getItem('pixelport-wii-pad:'+deviceId))}catch{}mapping=normalizeWiiPadMapping(stored);render()}
 }
 function updatePad(pad){
  usePad(pad);
  if(capture){
   const current=capture,result=sampleWiiCapture(current.state,pad,performance.now());
   if(result.status==='captured'){
    if(current.state.kind==='button')mapping.buttons[current.name]=result.button;
    else{mapping[current.name]=result.axis;mapping[current.name==='moveX'?'invertMoveX':current.name==='moveY'?'invertMoveY':'invertTilt']=result.value<0}
    blocked={id:pad.id,index:pad.index,axis:result.axis??null};capture=null;cancel.hidden=true;save();status(current.label+' assigned. Release your input to play.');render();
   }else if(result.status==='timeout')stopCapture('Assignment timed out. Your previous mapping was kept.');
   else if(result.status==='disconnected')stopCapture('Controller disconnected or changed. Your previous mapping was kept.');
   else if(result.status==='release')status('Release all buttons, then press the button for '+current.label+'.');
   else if(result.status==='connect')status('Press any button to connect your controller, then release it.');
   else status(current.prompt);
  }
  if(blocked){
   if(!pad||pad.id!==blocked.id||pad.index!==blocked.index)blocked=null;
   else if(buttonsReleased(pad)&&(blocked.axis===null||Math.abs(pad.axes?.[blocked.axis]||0)<0.25))blocked=null;
  }
 }
 invert.onchange=()=>{mapping.invertTilt=invert.checked;save()};
 cancel.onclick=()=>stopCapture('Assignment cancelled. Your previous mapping was kept.');
 panel.querySelector('[data-reset]').onclick=()=>{capture=null;blocked=null;cancel.hidden=true;mapping=defaultWiiPadMapping();save();status('Default controller mapping restored.');render()};
 panel.addEventListener('toggle',()=>{if(!panel.open&&capture)stopCapture('Assignment cancelled. Your previous mapping was kept.')});
 window.addEventListener('blur',()=>{if(capture)stopCapture('Assignment cancelled. Your previous mapping was kept.')});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&capture){event.preventDefault();stopCapture('Assignment cancelled. Your previous mapping was kept.')}});
 setInterval(()=>{
  const pad=selectPreferredGamepad(getGamepads());updatePad(pad);
  const label=pad?'Detected: '+pad.id:'Press a button on your controller to connect it.';
  if(deviceLabel.textContent!==label)deviceLabel.textContent=label;
 },100);
 render();status('Choose Set next to an action to assign a controller button or stick.');
 const picker=document.querySelector('#romInput');if(picker){picker.setAttribute('aria-label','Open a Wii disc image');picker.closest('[data-tip]')?.setAttribute('data-tip','Open a Wii disc image')}
 const screen=document.querySelector('#screen');screen.tabIndex=0;screen.addEventListener('pointerdown',()=>screen.focus());
 const renderer=document.getElementById('settingVideo');
 if(renderer){
  renderer.disabled=false;
  const webgpu=renderer.querySelector('option[value="wgpu"]');
  if(webgpu){webgpu.disabled=true;webgpu.textContent='WebGPU hardware (unavailable for Wii)'}
  const note=document.createElement('small');note.id='wiiRendererHelp';note.textContent='OpenGL GPU uses hardware rendering. Software is also available; hardware WebGPU is unavailable in this Wii core.';note.className='muted compact';note.style.gridColumn='1 / -1';renderer.closest('label').after(note);renderer.setAttribute('aria-describedby',note.id);
 }
 const autoProfile=document.getElementById('settingAutoProfile');if(autoProfile){autoProfile.disabled=true;autoProfile.checked=false}
 return {read(pad){updatePad(pad);return capture||blocked?readWiiGamepadInput(null):readWiiGamepadInput(pad,mapping)},panel};
}
