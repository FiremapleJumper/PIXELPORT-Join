import {bindLocalControllers,normalizeState} from './controller.js';
/* PixelPort NES player. JSNES supplies the CPU/PPU/APU; this file supplies UI. */
const $=id=>document.getElementById(id);const send=(type,extra={})=>parent.postMessage({type,...extra},location.origin);
let localControls;
let input,player,paused=false,started=false,muted=false,volume=.7,stateKey,romData;
function notice(text){$('notice').textContent=text}
function error(message){$('start').hidden=false;$('startButton').hidden=true;$('fallback').hidden=false;$('startText').textContent=message;send('pixelport-error',{message})}
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='pixelport-load'||input)return;
 input=event.data;stateKey='pixelport-nes-state-'+input.gameID;volume=Number(input.prefs.volume);
 if(input.prefs.video==='smooth')document.body.classList.add('smooth');
 try{romData=new Uint8Array(await input.file.arrayBuffer());send('pixelport-ready')}catch(e){error(e.message)}
});
$('startButton').onclick=()=>{
 if(!romData)return;
 try{
  player=new jsnes.Browser({container:$('display'),onError:e=>error('This NES game could not run: '+e.message)});
  // Keep the controls consistent with PixelPort and allow keyboard alongside a gamepad.
  player.keyboard.keys={};
  player._gamepadPolling.stop();
  localControls=bindLocalControllers({players:2,dispatch:(p,b,v)=>{if(b<8){v?player.nes.buttonDown(p,b):player.nes.buttonUp(p,b)}}});
  const sample=player.nes.opts.onAudioSample;player.nes.opts.onAudioSample=(l,r)=>sample(l*(muted?0:volume),r*(muted?0:volume));
  if(!window.isSecureContext||typeof AudioWorkletNode==='undefined'){player._speakers.start=()=>{};player._speakers.stop=()=>{};notice('Audio needs HTTPS and AudioWorklet. Playing silently.');}
  player.loadROM(romData);started=true;$('start').hidden=true;send('pixelport-started');
 }catch(e){player?.destroy();error('This NES game could not run: '+e.message)}
};
$('pause').onclick=()=>{if(!started)return;paused=!paused;paused?player.stop():player.start();$('pause').textContent=paused?'Resume':'Pause';notice(paused?'Paused':'Playing')};
$('reset').onclick=()=>{if(!started)return;player.loadROM(romData);paused=false;$('pause').textContent='Pause';notice('Console reset')};
function getState(){return JSON.stringify({format:'pixelport-nes-v1',gameID:input.gameID,name:input.file.name,state:player.nes.toJSON()})}
function loadState(text){const data=JSON.parse(text);if(data.format!=='pixelport-nes-v1'||data.gameID!==input.gameID)throw new Error('Choose a PixelPort state for this exact game file.');player.nes.fromJSON(data.state);notice('State loaded')}
$('save').onclick=()=>{if(!started)return;try{localStorage.setItem(stateKey,getState());notice('State saved in this browser')}catch{notice('Browser storage is full or unavailable. Use Export state.')}};
$('load').onclick=()=>{if(!started)return;try{const text=localStorage.getItem(stateKey);if(!text)throw new Error('No saved state for this game yet.');loadState(text)}catch(e){notice(e.message)}};
$('export').onclick=()=>{if(!started)return;const url=URL.createObjectURL(new Blob([getState()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=input.file.name+'.pixelport-state.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);notice('State exported')};
$('import').onclick=()=>{if(started)$('stateFile').click()};$('stateFile').onchange=async e=>{try{if(e.target.files[0])loadState(await e.target.files[0].text())}catch(error){notice(error.message)}};
$('mute').onclick=()=>{muted=!muted;$('mute').textContent=muted?'Unmute':'Mute'};
$('fallback').onclick=()=>send('pixelport-fallback');
const touchState=Array(24).fill(0);
function updateTouch(b,value){touchState[b]=value;localControls?.mux.set('touch',[touchState,Array(24).fill(0)])}
document.querySelectorAll('[data-nes]').forEach(button=>{
 button.onpointerdown=e=>{if(!started)return;e.preventDefault();button.setPointerCapture(e.pointerId);updateTouch(Number(button.dataset.nes),1)};
 const up=e=>{e.preventDefault();if(started)updateTouch(Number(button.dataset.nes),0)};button.onpointerup=up;button.onpointercancel=up;
});
window.addEventListener('resize',()=>player?.fitInParent());

window.addEventListener('pagehide',()=>{localControls?.destroy();player?.destroy()});

window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||!localControls)return;
 if(event.data?.type==='pixelport-remote-input'){
  const state=normalizeState(event.data.state);if(state)localControls.mux.set('remote',[Array(24).fill(0),state]);
 }
});
window.pixelPortCapture=()=>{
 if(!started||!player)throw new Error('Start the game before hosting.');
 const canvas=document.querySelector('#display canvas');if(!canvas?.captureStream)throw new Error('This browser cannot stream the game canvas.');
 const stream=canvas.captureStream(30),node=player._speakers.node,ctx=player._speakers.audioCtx;let destination;
 if(node&&ctx){destination=ctx.createMediaStreamDestination();node.connect(destination);for(const track of destination.stream.getAudioTracks())stream.addTrack(track)}
 return {stream,release:()=>{if(destination)try{node.disconnect(destination)}catch{}}};
};
