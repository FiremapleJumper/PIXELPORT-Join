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
 out.invertTilt=value?.invertTilt===true;return out;
}
export function readWiiGamepadInput(pad,mapping=defaultWiiPadMapping()){
 const config=normalizeWiiPadMapping(mapping),buttons=Array.from({length:17},()=>({pressed:false,value:0}));
 for(const [name,,virtual] of WII_ACTIONS){const physical=config.buttons[name];if(physical>=0&&pad?.buttons?.[physical])buttons[virtual]=pad.buttons[physical]}
 const axis=index=>index<0?0:Math.max(-1,Math.min(1,Number(pad?.axes?.[index])||0));
 const result=readGamepadInput({buttons,axes:[axis(config.moveX),axis(config.moveY),axis(config.tiltX)*(config.invertTilt?-1:1),0]});
 if(buttons[16].pressed){result.pressed.add('HOME');result.state.mask|=1<<20}
 return result;
}

export function createWiiControls(){
 if(!WII_PROFILE)return null;
 let deviceId=null,mapping=defaultWiiPadMapping(),device=null;
 const panel=document.createElement('details');panel.id='pixelportWiiControls';
 panel.innerHTML=`<summary>Wii keyboard & 8BitDo / gamepad controls</summary><p><strong>Sideways Wii Remote · Player 1</strong> — arrows or WASD move; X jumps (2); Z runs (1); V bubbles (A); Enter pauses (+); Shift is −; Q shakes; J / L tilt. Click the game first.</p><p data-device role="status">Press a button on your controller to detect it.</p><p class="wii-small">Default gamepad: bottom face button jumps, left face button runs, right face button bubbles, left shoulder shakes, right stick tilts. Layouts vary by 8BitDo model and mode. Remap below if needed. Motion here is generated from buttons and sticks; physical gyroscope, pointer and original Wii Remote pairing are not supported.</p><div class="wii-map-grid" data-map></div><p data-live class="wii-small" aria-live="off"></p><label class="wii-invert"><input type="checkbox" data-invert> Reverse tilt direction</label><button type="button" data-reset>Reset controller mapping</button>`;
 const style=document.createElement('style');style.textContent='#pixelportWiiControls{flex:0 0 auto;max-height:65vh;overflow:auto;color:#dce5ef;background:#17202d;border:1px solid #3a485d;border-radius:8px;padding:12px;margin:8px 0 14px;font:12px/1.6 system-ui}#pixelportWiiControls summary{cursor:pointer;font-weight:650}#pixelportWiiControls p{color:#ced7e6;margin:9px 0}.wii-small{font-size:11px}.wii-map-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px}.wii-map-grid label{display:flex;flex-direction:column;gap:3px}.wii-map-grid select{background:#f5f7fb;color:#182338;padding:7px;border:1px solid #b9c4d5;border-radius:5px;max-width:100%;font:12px system-ui}.wii-invert{display:flex;align-items:center;gap:8px;margin:12px 0}#pixelportWiiControls button{background:#e1e9fa;color:#17273e;border:1px solid #aebbd1;padding:8px 11px;border-radius:5px}';document.head.append(style);
 document.querySelector('.play-area').prepend(panel);
 const controls=panel.querySelector('[data-map]'),deviceLabel=panel.querySelector('[data-device]'),live=panel.querySelector('[data-live]'),invert=panel.querySelector('[data-invert]');
 function save(){if(deviceId)try{localStorage.setItem('pixelport-wii-pad:'+deviceId,JSON.stringify(mapping))}catch{}}
 function select(label,value,max,onChange,prefix='Button'){
  const row=document.createElement('label'),name=document.createElement('span'),input=document.createElement('select');name.textContent=label;input.setAttribute('aria-label',label+' mapping');
  for(let number=-1;number<max;number++){const option=document.createElement('option');option.value=String(number);option.textContent=number<0?'None':prefix+' '+number;input.append(option)}
  input.value=String(value);input.onchange=()=>{onChange(Number(input.value));save()};row.append(name,input);controls.append(row);
 }
 function render(){
  controls.replaceChildren();
  for(const [name,label] of WII_ACTIONS)select(label,mapping.buttons[name],Math.max(device?.buttons?.length||18,18),value=>mapping.buttons[name]=value);
  for(const [name,label] of [['moveX','Move horizontal'],['moveY','Move vertical'],['tiltX','Tilt horizontal']])select(label,mapping[name],Math.max(device?.axes?.length||4,4),value=>mapping[name]=value,'Axis');
  invert.checked=mapping.invertTilt;
 }
 function usePad(pad){
  const nextId=pad?.id||null;device=pad;
  if(nextId!==deviceId){deviceId=nextId;let stored;try{stored=JSON.parse(localStorage.getItem('pixelport-wii-pad:'+deviceId))}catch{}mapping=normalizeWiiPadMapping(stored);render()}
 }
 invert.onchange=()=>{mapping.invertTilt=invert.checked;save()};panel.querySelector('[data-reset]').onclick=()=>{mapping=defaultWiiPadMapping();save();render()};
 setInterval(()=>{
  const pad=selectPreferredGamepad(navigator.getGamepads?.()||[]);usePad(pad);
  deviceLabel.textContent=pad?'Detected: '+pad.id+(pad.mapping==='standard'?' · standard layout':' · remap the detected layout below'):'Press a button on your controller to detect it.';
  live.textContent=pad?'Pressed buttons: '+(Array.from(pad.buttons).flatMap((button,index)=>button.pressed?[index]:[]).join(', ')||'none')+' · Axes: '+Array.from(pad.axes).map((value,index)=>index+': '+value.toFixed(2)).join(' / '):'Connect an 8BitDo or another USB/Bluetooth gamepad. Keyboard controls also work.';
 },250);
 render();
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
 return {read(pad){usePad(pad);return readWiiGamepadInput(pad,mapping)},panel};
}
