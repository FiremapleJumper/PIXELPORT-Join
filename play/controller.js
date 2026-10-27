/* Shared controller states: NES/RetroArch button numbers, then analog directions. */
export const BUTTON_COUNT=24;
export function normalizeState(value){
 if(!Array.isArray(value)||value.length!==BUTTON_COUNT)return null;
 return value.map((v,i)=>Number.isFinite(v)?Math.max(0,Math.min(i>=16?32767:1,Math.round(v))):0);
}
export function makeInputMux(players,dispatch){
 const sources=new Map(),last=Array.from({length:players},()=>Array(BUTTON_COUNT).fill(0));
 function flush(){for(let p=0;p<players;p++)for(let b=0;b<BUTTON_COUNT;b++){
   let value=0;for(const states of sources.values())value=Math.max(value,states[p]?.[b]||0);
   if(value!==last[p][b]){last[p][b]=value;dispatch(p+1,b,value)}
 }}
 return {set(source,states){sources.set(source,states);flush()},remove(source){sources.delete(source);flush()},clear(){sources.clear();flush()}};
}
export const P1_KEYS={ArrowUp:4,ArrowDown:5,ArrowLeft:6,ArrowRight:7,KeyX:0,KeyZ:1,ShiftLeft:2,ShiftRight:2,Enter:3,KeyS:8,KeyA:9,KeyQ:10,KeyE:11,KeyR:12,KeyT:13};
export const P2_KEYS={KeyI:4,KeyK:5,KeyJ:6,KeyL:7,KeyF:0,KeyG:1,KeyR:2,KeyT:3,KeyV:8,KeyB:9,KeyC:10,KeyN:11};
export function gamepadState(pad,analog=false){
 const out=Array(BUTTON_COUNT).fill(0);if(!pad)return out;
 const map={0:0,1:1,2:9,3:8,4:10,5:11,6:12,7:13,8:2,9:3,12:4,13:5,14:6,15:7};
 for(const [physical,button] of Object.entries(map))out[button]=pad.buttons[physical]?.pressed?1:0;
 if(analog){
  for(let axis=0;axis<4;axis++){const value=pad.axes[axis]||0,index=16+axis*2;if(Math.abs(value)>.16)out[index+(value<0?1:0)]=Math.round(Math.abs(value)*32767)}
  if(pad.axes[0]<-.5)out[6]=1;if(pad.axes[0]>.5)out[7]=1;if(pad.axes[1]<-.5)out[4]=1;if(pad.axes[1]>.5)out[5]=1;
 }else{if(pad.axes[0]<-.5)out[6]=1;if(pad.axes[0]>.5)out[7]=1;if(pad.axes[1]<-.5)out[4]=1;if(pad.axes[1]>.5)out[5]=1}
 return out;
}
export function bindLocalControllers({players=2,analog=false,dispatch}){
 const mux=makeInputMux(players,dispatch),keySets=Array.from({length:players},()=>new Set()),maps=[P1_KEYS,P2_KEYS];
 let alive=true,raf;
 const keyState=()=>keySets.map(set=>{const state=Array(BUTTON_COUNT).fill(0);for(const b of set){state[b]=1;if(analog&&b>=4&&b<=7)state[{4:19,5:18,6:17,7:16}[b]]=32767}return state});
 const key=e=>{
   if(e.target?.matches?.('input,textarea,select'))return;
   let handled=false;
   maps.slice(0,players).forEach((map,p)=>{const b=map[e.code];if(b!==undefined){e.type==='keydown'?keySets[p].add(b):keySets[p].delete(b);handled=true}});
   if(handled){e.preventDefault();mux.set('keyboard',keyState())}
 };
 const release=()=>{for(const set of keySets)set.clear();mux.remove('keyboard')};
 document.addEventListener('keydown',key);document.addEventListener('keyup',key);window.addEventListener('blur',release);
 function poll(){if(!alive)return;const pads=Array.from(navigator.getGamepads?.()||[]).filter(Boolean).slice(0,players);mux.set('gamepads',Array.from({length:players},(_,p)=>gamepadState(pads[p],analog)));raf=requestAnimationFrame(poll)}
 poll();
 return {mux,destroy(){alive=false;cancelAnimationFrame(raf);document.removeEventListener('keydown',key);document.removeEventListener('keyup',key);window.removeEventListener('blur',release);mux.clear()}};
}
