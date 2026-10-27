import {normalizeState} from './controller.js';
/* PixelPort bridge to EmulatorJS. A fresh iframe owns each core's lifecycle. */
let loaded=false,romUrl,biosUrl;
const send=(type,extra={})=>parent.postMessage({type,...extra},location.origin);
function fail(message){const status=document.getElementById('status');status.style.display='grid';status.textContent=message;send('pixelport-error',{message})}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='pixelport-load'||loaded)return;
 const {file,core,prefs,gameID,bios,dataPath,threads}=event.data;if(!(file instanceof File))return;loaded=true;
 romUrl=URL.createObjectURL(file);if(bios)biosUrl=URL.createObjectURL(bios);
 if(prefs.video==='smooth')document.body.classList.add('smooth');
 Object.assign(window,{
  EJS_player:'#game',EJS_core:core,EJS_gameUrl:romUrl,EJS_gameName:file.name,EJS_gameID:gameID,
  EJS_pathtodata:dataPath||'https://cdn.emulatorjs.org/4.2.3/data/',EJS_biosUrl:biosUrl||'',
  EJS_color:'#344bec',EJS_backgroundColor:'#090b12',EJS_startOnLoaded:false,
  EJS_startButtonName:'Start game',EJS_volume:Number(prefs.volume),EJS_threads:!!threads,
  EJS_language:'en-US',EJS_disableAutoLang:true,EJS_defaultControls:{0:{
    0:{value:'x',value2:'BUTTON_2'},1:{value:'z',value2:'BUTTON_4'},2:{value:'shift',value2:'SELECT'},3:{value:'enter',value2:'START'},
    4:{value:'up arrow',value2:'DPAD_UP'},5:{value:'down arrow',value2:'DPAD_DOWN'},6:{value:'left arrow',value2:'DPAD_LEFT'},7:{value:'right arrow',value2:'DPAD_RIGHT'},
    8:{value:'s',value2:'BUTTON_1'},9:{value:'a',value2:'BUTTON_3'},10:{value:'q',value2:'LEFT_TOP_SHOULDER'},11:{value:'e',value2:'RIGHT_TOP_SHOULDER'},12:{value:'r',value2:'LEFT_BOTTOM_SHOULDER'},13:{value:'t',value2:'RIGHT_BOTTOM_SHOULDER'},
    16:{value:'d',value2:'LEFT_STICK_X:+1'},17:{value:'a',value2:'LEFT_STICK_X:-1'},18:{value:'s',value2:'LEFT_STICK_Y:+1'},19:{value:'w',value2:'LEFT_STICK_Y:-1'},20:{value:'l',value2:'RIGHT_STICK_X:+1'},21:{value:'j',value2:'RIGHT_STICK_X:-1'},22:{value:'k',value2:'RIGHT_STICK_Y:+1'},23:{value:'i',value2:'RIGHT_STICK_Y:-1'}
  },1:{0:{value:'f',value2:'BUTTON_2'},1:{value:'g',value2:'BUTTON_4'},2:{value:'r',value2:'SELECT'},3:{value:'t',value2:'START'},4:{value:'i',value2:'DPAD_UP'},5:{value:'k',value2:'DPAD_DOWN'},6:{value:'j',value2:'DPAD_LEFT'},7:{value:'l',value2:'DPAD_RIGHT'},8:{value:'v',value2:'BUTTON_1'},9:{value:'b',value2:'BUTTON_3'},10:{value:'c',value2:'LEFT_TOP_SHOULDER'},11:{value:'n',value2:'RIGHT_TOP_SHOULDER'},16:{value:'l',value2:'LEFT_STICK_X:+1'},17:{value:'j',value2:'LEFT_STICK_X:-1'},18:{value:'k',value2:'LEFT_STICK_Y:+1'},19:{value:'i',value2:'LEFT_STICK_Y:-1'}},2:{},3:{}},
  EJS_ready:()=>{document.getElementById('status').style.display='none';send('pixelport-ready')},
  EJS_onGameStart:()=>{document.getElementById('status').style.display='none';send('pixelport-started')}
 });
 if(threads)window.EJS_defaultOptions={ejs_threads:'enabled',webgl2Enabled:'enabled'};
 for(const p of [2,3])for(const [key,control] of Object.entries(window.EJS_defaultControls[0]))window.EJS_defaultControls[p][key]={value2:control.value2};
 const script=document.createElement('script');script.src=window.EJS_pathtodata+'loader.js';script.crossOrigin='anonymous';script.onerror=()=>fail('The emulator engine could not be downloaded. Check your connection or content blocker, then reopen the game.');document.body.appendChild(script);
});
window.addEventListener('error',event=>{if(event.message&&event.message!=='Script error.')fail('Player error: '+event.message)});
window.addEventListener('unhandledrejection',event=>fail('The emulator could not start: '+(event.reason?.message||String(event.reason))));
window.addEventListener('pagehide',()=>{if(romUrl)URL.revokeObjectURL(romUrl);if(biosUrl)URL.revokeObjectURL(biosUrl)});

new MutationObserver(()=>{const text=document.getElementById("game").textContent;if(/Failed to start game|Error loading|Failed to load/.test(text))send("pixelport-error",{message:"This core could not start. Check your game file, and make sure graphics acceleration and WebGL are available in your browser."})}).observe(document.getElementById("game"),{subtree:true,childList:true,characterData:true});

let remotePrevious=Array(24).fill(0);
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='pixelport-remote-input')return;
 const state=normalizeState(event.data.state),emulator=window.EJS_emulator;if(!state||!emulator?.gameManager)return;
 for(let b=0;b<24;b++)if(state[b]!==remotePrevious[b])emulator.gameManager.simulateInput(1,b,state[b]);remotePrevious=state;
});
window.pixelPortCapture=()=>{
 const emulator=window.EJS_emulator,canvas=emulator?.canvas||document.querySelector('#game canvas');
 if(!emulator?.started||!canvas?.captureStream)throw new Error('Start the game in the player before hosting.');
 const stream=canvas.captureStream(30),context=emulator.Module?.AL?.currentCtx;let destination;
 if(context?.audioCtx&&context?.gain?.connect){destination=context.audioCtx.createMediaStreamDestination();context.gain.connect(destination);for(const track of destination.stream.getAudioTracks())stream.addTrack(track)}
 return {stream,release:()=>{if(destination)try{context.gain.disconnect(destination)}catch{}}};
};
