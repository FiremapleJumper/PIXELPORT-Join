/* PeerJS signaling + WebRTC video/controller transport. No ROM bytes are sent. */
import {normalizeState} from './controller.js';
export function normalizeRoom(code){const result=String(code).replace(/[\s-]/g,'').toLowerCase();return /^[a-f0-9]{24}$/.test(result)?result:null}
export function newRoom(){return Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('')}
export function displayRoom(code){return code.match(/.{1,4}/g).join('-').toUpperCase()}
let peerPromise;
export function loadPeer(){
 if(window.Peer)return Promise.resolve(window.Peer);
 if(!peerPromise)peerPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('./vendor/peerjs-1.5.5.min.js',import.meta.url).href;s.onload=()=>resolve(window.Peer);s.onerror=()=>{peerPromise=null;reject(new Error('The connection library could not load.'))};document.head.append(s)});
 return peerPromise;
}
export class OnlineSession{
 constructor(callbacks={}){this.callbacks=callbacks;this.closed=true;this.outSequence=0;this.inSequence=-1;this.pendingState=null}
 say(text){this.callbacks.status?.(text)}
 async open(id){
  const Peer=await loadPeer();this.closed=false;this.peer=new Peer(id,{debug:0,secure:true});
  this.peer.on('error',error=>{if(this.closed)return;this.say(error.type==='peer-unavailable'?'Room not found. Check the code and keep the host’s page open.':'Connection error: '+error.message);if(!this.connection?.open)this.close(false)});
  this.peer.on('disconnected',()=>{if(!this.closed)this.say('The connection service disconnected. End this session and try again if your friend cannot join.')});
  return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{this.abortOpen=null;reject(new Error('The connection service did not respond. Check your internet connection.'));this.close(false)},20000);this.abortOpen=()=>{clearTimeout(timeout);reject(new Error('Session cancelled.'))};this.peer.once('open',()=>{clearTimeout(timeout);this.abortOpen=null;resolve()});this.peer.once('error',e=>{clearTimeout(timeout);this.abortOpen=null;reject(e)})});
 }
 async host({stream,release,system}){
  const code=newRoom();this.role='host';this.stream=stream;this.releaseCapture=release;await this.open('pixelport-'+code);
  this.code=code;this.callbacks.room?.(displayRoom(code));this.say('Room open. Share the room code with one friend.');
  this.peer.on('connection',connection=>{
    if(this.closed||this.connection||connection.metadata?.protocol!=='pixelport-v1'){connection.on('open',()=>connection.close());return}
    this.say('Friend found. Negotiating the connection…');this.connection=connection;this.bindConnection(connection);
    this.pendingTimer=setTimeout(()=>{if(this.connection===connection&&!connection.open){this.connection=null;clearInterval(this.heartbeat);connection.close();this.say('Your friend could not connect. They can try again with this code, or use a different network.')}},35000);
    connection.on('open',()=>{if(this.closed)return;clearTimeout(this.pendingTimer);connection.send({type:'welcome',system,protocol:'pixelport-v1'});this.call=this.peer.call(connection.peer,this.stream,{metadata:{protocol:'pixelport-v1'}});this.call.on('error',e=>this.say('Video connection error: '+e.message));this.say('Friend connected as Player 2.');this.callbacks.connected?.()});
  });
 }
 async join(code){
  code=normalizeRoom(code);if(!code)throw new Error('Enter the complete room code from the host.');
  this.role='guest';await this.open();if(this.closed)return;
  const expected='pixelport-'+code;
  this.peer.on('call',call=>{if(call.peer!==expected||call.metadata?.protocol!=='pixelport-v1'){call.close();return}this.call=call;call.answer();call.on('stream',stream=>{this.callbacks.stream?.(stream);this.say('Connected as Player 2. Click the video, then use arrows and X / Z.');});call.on('close',()=>{if(!this.closed)this.say('The host ended the video stream.')})});
  const connection=this.peer.connect(expected,{reliable:true,metadata:{protocol:'pixelport-v1'}});this.say('Friend found. Negotiating the connection…');this.connection=connection;this.bindConnection(connection);
    this.pendingTimer=setTimeout(()=>{if(this.connection===connection&&!connection.open){this.connection=null;clearInterval(this.heartbeat);connection.close();this.say('Your friend could not connect. They can try again with this code, or use a different network.')}},35000);this.say('Finding the host…');
  this.connectTimer=setTimeout(()=>{if(!connection.open){this.say('Could not reach the host. Some school, VPN or mobile networks block direct WebRTC connections.');this.close(false)}},30000);
 }
 bindConnection(connection){
  if(this.role==='host')this.heartbeat=setInterval(()=>{if(this.lastInput&&performance.now()-this.lastInput>1200){this.callbacks.input?.(Array(24).fill(0));this.lastInput=0}},250);
  connection.on('data',message=>{
   if(!message||typeof message!=='object')return;
   if(this.role==='host'&&message.type==='buttons'){
    const state=normalizeState(message.state);if(!state||!Number.isSafeInteger(message.sequence)||message.sequence<=this.inSequence)return;
    this.lastInput=performance.now();this.inSequence=message.sequence;this.pendingState=state;
    if(!this.inputFrame)this.inputFrame=requestAnimationFrame(()=>{this.inputFrame=null;if(this.pendingState&&!this.closed)this.callbacks.input?.(this.pendingState)});
   }
   if(this.role==='guest'&&message.type==='welcome'){clearTimeout(this.connectTimer);this.callbacks.connected?.(message.system);this.say('Connected. Waiting for the game video…')}
  });
  connection.on('close',()=>{if(!this.closed&&this.connection===connection){this.say('The other player disconnected.');this.close(false)}});
  connection.on('error',e=>this.say('Connection failed: '+e.message));
 }
 send(state){if(this.role==='guest'&&this.connection?.open)this.connection.send({type:'buttons',sequence:++this.outSequence,state:state.slice()})}
 close(announce=true){
  this.closed=true;this.abortOpen?.();this.abortOpen=null;clearInterval(this.heartbeat);clearTimeout(this.pendingTimer);clearTimeout(this.connectTimer);cancelAnimationFrame(this.inputFrame);this.inputFrame=null;this.callbacks.input?.(Array(24).fill(0));
  this.call?.close();this.connection?.close();this.peer?.destroy();this.stream?.getTracks().forEach(track=>track.stop());this.releaseCapture?.();
  this.call=null;this.connection=null;this.peer=null;this.stream=null;this.releaseCapture=null;this.callbacks.closed?.();if(announce)this.say('Session ended.');
 }
}
