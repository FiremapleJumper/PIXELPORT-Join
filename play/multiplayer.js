import {OnlineSession} from './net-session.js';
import {bindLocalControllers} from './controller.js';
export function createMultiplayer({container,getSession,onStatus}){
 let session,guestControls,guestState=Array(24).fill(0),sendFrame,guestVideo;
 function render(){
  container.innerHTML=`<div class="section-heading"><h2>Your room. Your friends.</h2><button class="text-button" id="closeMultiplayer">Close ×</button></div><div class="multiplayer-columns"><div><div class="multiplayer-label">WITH A FRIEND ONLINE · BETA</div><h3>Your game. Their Player 2.</h3><p>The host runs a NES, SNES or N64 game and shares its video and available game audio. Your friend controls Player 2. Game files stay with the host.</p><div class="multiplayer-actions"><button class="primary-button" id="hostOnline">Host game</button><button class="secondary-button" id="endOnline" hidden>End session</button></div><div id="roomShare" hidden><label class="room-label" for="roomCode">YOUR ROOM CODE</label><div class="room-input-row"><input id="roomCode" readonly aria-label="Your room code"><button class="secondary-button" id="copyRoom">Copy</button></div></div><div class="join-row"><label class="room-label" for="joinCode">OR JOIN A FRIEND</label><div class="room-input-row"><input id="joinCode" placeholder="Paste room code" autocomplete="off" spellcheck="false"><button class="secondary-button" id="joinOnline">Join</button></div></div><p id="onlineStatus" class="online-status" role="status">No online session.</p><p class="tiny-text">Beta: live gameplay has not been verified in the test browser. The host must keep the game open. Online play uses PeerJS for connection setup and a direct WebRTC stream; some restricted networks can block the connection.</p><a class="guest-download" href="pixelport-guest.html" download="PixelPort-Guest.html">Download guest page ↗</a><p class="tiny-text">This site is private. A friend without access can open the downloaded guest HTML in Chrome or Edge, then enter your room code. Send them the HTML file and code yourself.</p></div><div><div class="multiplayer-label">ON THE SAME DEVICE</div><h3>Two controllers. One screen.</h3><p>NES and SNES: 2 players. N64: up to 4 gamepads, when the game supports it. Connect controllers and press a button on each, or use the keyboard.</p><table class="player-keys"><tr><th>Player 1</th><th>Player 2</th></tr><tr><td>Arrows · X / Z</td><td>I J K L · F / G</td></tr><tr><td>Enter / Shift</td><td>T / R</td></tr></table><p class="tiny-text">Start the game’s own 2-player mode. Game Boy link cables and DS / 3DS wireless play are not implemented. GameCube / Wii browser controls currently support one player.</p></div></div><div id="remotePlayer" hidden><video id="remoteVideo" autoplay muted playsinline tabindex="0" aria-label="Remote game video"></video><div class="remote-toolbar"><button id="enableRemoteSound" class="secondary-button">Enable game sound</button><span>PLAYER 2 · Arrows / X Z / Enter / Shift · Gamepad supported</span></div></div>`;
  const $=id=>container.querySelector('#'+id);
  $('closeMultiplayer').onclick=()=>container.hidden=true;
  $('hostOnline').onclick=host;$('joinOnline').onclick=join;$('endOnline').onclick=()=>end();
  $('copyRoom').onclick=async()=>{try{await navigator.clipboard.writeText($('roomCode').value);$('onlineStatus').textContent='Room code copied.'}catch{$('roomCode').select();$('onlineStatus').textContent='Select and copy the room code.'}};
  $('enableRemoteSound').onclick=()=>{guestVideo.muted=false;guestVideo.play().catch(()=>{});$('enableRemoteSound').textContent='Game sound enabled'};
 }
 function status(text){const el=container.querySelector('#onlineStatus');if(el)el.textContent=text}
 function remoteInput(state){const active=getSession();if(active.frame)active.frame.contentWindow.postMessage({type:'pixelport-remote-input',state},location.origin)}
 function makeSession(){return new OnlineSession({status,room:code=>{container.querySelector('#roomShare').hidden=false;container.querySelector('#roomCode').value=code},input:remoteInput,stream:stream=>{container.querySelector('#remotePlayer').hidden=false;guestVideo=container.querySelector('#remoteVideo');guestVideo.srcObject=stream;guestVideo.play().catch(()=>{});guestVideo.onclick=()=>guestVideo.focus()},closed:()=>{guestControls?.destroy();guestControls=null;cancelAnimationFrame(sendFrame);container.querySelector('#endOnline').hidden=true;container.querySelector('#hostOnline').disabled=false;container.querySelector('#joinOnline').disabled=false},connected:()=>status('Connected. Player 2 is ready.')})}
 async function host(){
  end(false);const active=getSession();
  if(!active.file||!active.frame){status('Open and start a game first, then choose Host game.');return}
  if(!['nes','snes','n64'].includes(active.system.id)){status('Online Player 2 is available for NES, SNES and N64 couch-multiplayer games. Handheld wireless play is not implemented.');return}
  try{
   const capture=await active.frame.contentWindow.pixelPortCapture?.();if(!capture)throw new Error('Start the game inside the player before hosting.');
   session=makeSession();container.querySelector('#hostOnline').disabled=true;container.querySelector('#joinOnline').disabled=true;container.querySelector('#endOnline').hidden=false;status('Opening a room…');await session.host({...capture,system:active.system.short});
  }catch(error){status(error.message);session?.close(false)}
 }
 async function join(){
  const code=container.querySelector('#joinCode').value;end(false);session=makeSession();
  try{container.querySelector('#hostOnline').disabled=true;container.querySelector('#joinOnline').disabled=true;container.querySelector('#endOnline').hidden=false;
   await session.join(code);
   guestControls=bindLocalControllers({players:1,analog:true,dispatch:(_p,b,v)=>{guestState[b]=v}});
   let previous='',tick=0;const send=()=>{if(!session||session.role!=='guest')return;const key=guestState.join(',');if(key!==previous||++tick%6===0){session.send(guestState);previous=key}sendFrame=requestAnimationFrame(send)};send();
  }catch(error){status(error.message);session.close(false)}
 }
 function end(announce=true){session?.close(announce);session=null;guestControls?.destroy();guestControls=null;cancelAnimationFrame(sendFrame);guestState.fill(0);remoteInput(guestState);if(guestVideo){guestVideo.srcObject=null;guestVideo=null}const share=container.querySelector('#roomShare'),remote=container.querySelector('#remotePlayer');if(share)share.hidden=true;if(remote)remote.hidden=true}
 render();window.addEventListener('pagehide',()=>end(false));
 return {end:()=>end(false),toggle(){container.hidden=!container.hidden;if(!container.hidden)container.scrollIntoView({behavior:'smooth',block:'nearest'})}};
}
