/* PixelPort integration; GPL-2.0-or-later, matching the Dolphin host. */
import './src/app.js';
const send=(type,extra={})=>parent.postMessage({type,...extra},location.origin);
let mounted=false;
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='pixelport-load'||mounted)return;
 const {file,prefs}=event.data;if(!(file instanceof File))return;mounted=true;
 try{
   await window.pixelPortDolphinReady;
   if(!crossOriginIsolated)throw new Error('Browser isolation is unavailable. Open PixelPort in a regular Chrome or Edge tab.');
   document.querySelector('#volumeDial').value=String(prefs.volume);
   document.querySelector('#volumeDial').dispatchEvent(new Event('input',{bubbles:true}));
   document.querySelector('#screen').style.imageRendering=prefs.video==='smooth'?'auto':'pixelated';
   await window.pixelPortMount(file);
   if(window.__host.mode!=='dolphin')throw new Error('Dolphin could not load this disc image.');
   send('pixelport-started');
 }catch(error){send('pixelport-error',{message:error.message||String(error)})}
});
const status=document.querySelector('#statusPill');
new MutationObserver(()=>{if(status.classList.contains('error'))send('pixelport-error',{message:status.textContent})}).observe(status,{attributes:true,childList:true,subtree:true});
window.addEventListener('unhandledrejection',e=>send('pixelport-error',{message:e.reason?.message||String(e.reason)}));
if(document.querySelector('#panelToggle').getAttribute('aria-expanded')==='true')document.querySelector('#panelToggle').click();
document.querySelector('#screenHud').hidden=true;
document.querySelector('#overlayToggle').setAttribute('aria-pressed','false');
