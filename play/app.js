import {createPatcher} from './patcher.js';
import {readWiiRendererPreference} from './dolphin/src/pixelport-wii-renderer.js';
import {createMultiplayer} from './multiplayer.js';
import {SYSTEMS,systemById,detectSystem,gameId} from './systems.js';
import {icon,hydrateIcons,consoleArt,CARTRIDGE} from './art.js';
const $=id=>document.getElementById(id);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selected=systemById(read('pixelport-system','nes')),filter='all',recent=read('pixelport-recent',[]),prefs=read('pixelport-prefs',{volume:.7,video:'crisp'}),currentFile=null,biosFile=null,frame=null,loadSequence=0,bootTimer;
hydrateIcons();$('emptyArt').innerHTML=CARTRIDGE;
function feedback(message,error=false){$('feedback').textContent=message;$('feedback').classList.toggle('error',error);$('feedback').hidden=!message}
function renderNav(){
 $('systemsNav').innerHTML=SYSTEMS.map(s=>`<button class="system-link ${s.id===selected.id?'selected':''}" data-system="${s.id}" aria-pressed="${s.id===selected.id}"><span class="console-dot" style="background:${s.color}"></span>${s.nav}${s.experimental?'<span class="nav-lab">LAB</span>':''}</button>`).join('');
}
function renderGrid(){
 $('consoleGrid').innerHTML=SYSTEMS.filter(s=>filter==='all'||s.type===filter).map(s=>`<button class="console-card ${selected.id===s.id?'selected':''}" data-system="${s.id}" aria-pressed="${selected.id===s.id}" aria-label="Select ${s.name}${s.experimental?', experimental':''}" style="--tint:${s.tint}"><div class="console-visual">${consoleArt(s.id)}</div><strong>${s.short}</strong><small>${s.caption}</small><div class="card-bottom"><span class="card-status ${s.experimental?'lab':''}">${s.experimental?'Experimental':'Browser core'}</span><span class="card-arrow">↗</span></div></button>`).join('');
}
function updateSelection(){
 write('pixelport-system',selected.id);$('selectedName').textContent=selected.name;$('selectedBadge').textContent=selected.short;$('selectedDot').style.background=selected.color;
 $('formatLabel').textContent=selected.ext.map(e=>'.'+e).join(' · ')+(selected.core==='dolphin'?'':' · .zip · .7z');
 $('systemNote').textContent=selected.note||'';$('systemNote').hidden=!selected.note;
 $('emptyTitle').textContent=selected.experimental?'A new generation. A little experimental.':'Your next adventure is one file away.';
 $('emptyDescription').textContent=selected.core==='dolphin'?'Drop a disc image here or open one from your device.':'Drop a game here or open one from your device.';
 $('breadcrumbSystem').textContent=selected.short;renderNav();renderGrid();
}
function selectSystem(id){
 const next=systemById(id);if(next.id!==selected.id&&currentFile)stopGame();selected=next;feedback('');updateSelection();
}
function stopGame(){
 multiplayer.end();
 loadSequence++;clearTimeout(bootTimer);if(frame)frame.remove();frame=null;currentFile=null;$('runnerWrap').hidden=true;$('emptyState').hidden=false;$('screenStatus').textContent='READY WHEN YOU ARE';$('screenBottom').hidden=false;$('changeFileButton').hidden=true;
}
function remember(file,system){
 recent=[{name:file.name,system:system.id,size:file.size,opened:Date.now()},...recent.filter(r=>!(r.name===file.name&&r.system===system.id&&r.size===file.size))].slice(0,6);write('pixelport-recent',recent);renderRecent();
}
function renderRecent(){
 $('recentSection').hidden=!recent.length;
 $('recentList').innerHTML=recent.map((r,i)=>`<button class="recent-item" data-recent="${i}"><span class="console-dot" style="background:${systemById(r.system).color}"></span><span>${escape(r.name)}</span><small>${systemById(r.system).short}</small><span>↗</span></button>`).join('');
}
function openFilePicker(){if($('infoDialog').open)$('infoDialog').close();$('gameInput').value='';$('gameInput').click()}
async function launch(file,compatibilityCore=false){
 const sequence=++loadSequence;feedback('');multiplayer.end();$('openGameButton').disabled=true;
 try{
   if(!file||!file.size)throw new Error('Choose a complete, nonempty game file.');
   const system=await detectSystem(file,selected.id);if(sequence!==loadSequence)return;
   if(system.requiresThreads){
     await window.pixelPortIsolation;
     if(!crossOriginIsolated||typeof SharedArrayBuffer==='undefined')throw new Error('3DS needs browser isolation and shared memory. Open the published site in a regular desktop Chrome or Edge tab, reload once, then reopen the game.');
     if(!document.createElement('canvas').getContext('webgl2'))throw new Error('3DS requires WebGL 2. Enable graphics acceleration or use a compatible desktop browser.');
   }
   if(system.core==='dolphin'){
     await window.pixelPortIsolation;
     if(!crossOriginIsolated||typeof SharedArrayBuffer==='undefined')throw new Error('GameCube and Wii need browser isolation. Reload this page once, then open your game again. Use a regular Chrome or Edge tab.');
     if(!navigator.gpu)throw new Error('This experimental GameCube/Wii core needs WebGPU. Try current desktop Chrome or Edge with graphics acceleration enabled.');
     if(!await navigator.gpu.requestAdapter())throw new Error('WebGPU could not find a graphics adapter. Enable graphics acceleration or try another device.');
   }
   if(sequence!==loadSequence)return;
   clearTimeout(bootTimer);if(frame)frame.remove();selected=system;currentFile=file;updateSelection();
   $('emptyState').hidden=true;$('screenBottom').hidden=true;$('runnerWrap').hidden=false;$('changeFileButton').hidden=false;$('screenStatus').textContent='LOADING '+system.short.toUpperCase();
   const dolphinVideo=system.id==='wii'?readWiiRendererPreference():'software';
   frame=document.createElement('iframe');frame.title=`${system.name} game player`;frame.allow='autoplay; fullscreen; gamepad; cross-origin-isolated';frame.allowFullscreen=true;frame.src=system.core==='dolphin'?'dolphin/index.html?core=upstream&video='+dolphinVideo+'&presenter=webgpu'+(system.id==='wii'?'&controls=wii':''):system.id==='nes'&&file.name.toLowerCase().endsWith('.nes')&&!compatibilityCore?'nes-runner.html':'runner.html';$('runnerWrap').replaceChildren(frame);
   const activeFrame=frame;
   frame.addEventListener('load',()=>{if(frame!==activeFrame)return;frame.contentWindow.postMessage({type:'pixelport-load',file,system:system.id,core:system.core,dataPath:system.dataPath,threads:!!system.requiresThreads,players:system.localPlayers||1,gameID:gameId(file.name,system.id,file.size),prefs,bios:biosFile},location.origin)});
   remember(file,system);
   bootTimer=setTimeout(()=>{if(frame===activeFrame)feedback('Still loading? Some cores take a moment on their first launch. Check the player for a Start button or an error. You can change the game above.');},45000);
 }catch(error){feedback(error.message||'The game could not be opened.',true)}
 finally{$('openGameButton').disabled=false}
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||!frame||event.source!==frame.contentWindow)return;
 const message=event.data||{};
 if(message.type==='pixelport-started'){clearTimeout(bootTimer);feedback('');$('screenStatus').textContent='NOW PLAYING · '+selected.short.toUpperCase();}
 if(message.type==='pixelport-ready'){$('screenStatus').textContent='PRESS START IN THE PLAYER';}
 if(message.type==='pixelport-fallback'&&currentFile)launch(currentFile,true);
 if(message.type==='pixelport-error'){clearTimeout(bootTimer);feedback(message.message||'This game could not start.',true);$('screenStatus').textContent='CHECK GAME FILE';}
});
document.addEventListener('click',event=>{
 const consoleButton=event.target.closest('[data-system]');if(consoleButton)selectSystem(consoleButton.dataset.system);
 const filterButton=event.target.closest('[data-filter]');if(filterButton){filter=filterButton.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===filterButton);b.setAttribute('aria-pressed',String(b===filterButton))});renderGrid()}
 const recentButton=event.target.closest('[data-recent]');if(recentButton){selectSystem(recent[Number(recentButton.dataset.recent)].system);feedback('Choose the original game file to play again. Game files are not stored in your history.');openFilePicker()}
});
$('openGameButton').onclick=openFilePicker;$('changeFileButton').onclick=openFilePicker;
$('gameInput').onchange=e=>{const file=e.target.files[0];if(file)launch(file)};
$('homeButton').onclick=()=>{filter='all';document.querySelector('[data-filter="all"]').click();$('breadcrumbSystem').textContent='All consoles';window.scrollTo({top:0,behavior:'smooth'})};
$('clearRecent').onclick=()=>{recent=[];write('pixelport-recent',recent);renderRecent()};
$('fullscreenButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('playerCard').requestFullscreen()}catch{feedback('Fullscreen is not available in this browser. Try opening the site in its own tab.')}};
let dragDepth=0;
document.addEventListener('dragenter',e=>{if(!e.dataTransfer.types.includes('Files'))return;e.preventDefault();dragDepth++;$('dropOverlay').hidden=false});
document.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy'}});
document.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('dropOverlay').hidden=true});
document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('dropOverlay').hidden=true;if(e.dataTransfer.files.length)launch(e.dataTransfer.files[0])});
function dialog(title,body){$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;hydrateIcons($('infoDialog'));$('infoDialog').showModal()}
$('closeDialog').onclick=()=>$('infoDialog').close();$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const r=$('infoDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('infoDialog').close()}});
function showControls(){
 if(selected.id==='wii'){
  dialog('Wii keyboard & 8BitDo controls',`<p>Experimental <strong>sideways Wii Remote</strong> emulation for Player 1, designed for games such as New Super Mario Bros. Wii. Click inside the game first.</p><p>To change rendering, open <strong>PANEL → Settings → Renderer</strong>, choose <strong>OpenGL GPU</strong> or Software, then click <strong>Apply restart</strong>. Your Wii renderer choice is remembered.</p><table><thead><tr><th>Wii action</th><th>Keyboard</th></tr></thead><tbody><tr><td>Move</td><td>Arrow keys or WASD</td></tr><tr><td>2 · Jump</td><td>X</td></tr><tr><td>1 · Run</td><td>Z</td></tr><tr><td>A · Bubble</td><td>V</td></tr><tr><td>+ · Pause / −</td><td>Enter / Shift</td></tr><tr><td>Shake</td><td>Q</td></tr><tr><td>Tilt left / right</td><td>J / L</td></tr><tr><td>Home</td><td>Home</td></tr></tbody></table><p>Connect an 8BitDo or another USB/Bluetooth gamepad and press a button. Open <strong>Wii keyboard & 8BitDo / gamepad controls</strong> inside the player to see detected buttons and save a custom mapping.</p><p>Default gamepad: bottom face button jumps, left face button runs, right face button bubbles, left shoulder shakes, right stick tilts. Layouts vary by model and mode.</p><p>Gameplay with your game still needs testing. Nunchuk, IR pointer, physical gyro and original Wii Remote pairing are not implemented. Wii online rooms are not supported.</p>`);return;
 }
 const dolphin=selected.core==='dolphin';
 dialog('A few buttons. A lot of adventure.',`<p>Controls for <strong>${escape(selected.name)}</strong>. Click inside the game first to give it keyboard focus.</p><table><thead><tr><th>Action</th><th>Keyboard</th></tr></thead><tbody><tr><td>${dolphin?'Main stick':'Move / D-pad'}</td><td>${dolphin?'<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>':'<kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd>'}</td></tr><tr><td>A / B</td><td><kbd>X</kbd> / <kbd>Z</kbd></td></tr><tr><td>X / Y</td><td><kbd>S</kbd> / <kbd>A</kbd></td></tr><tr><td>Start / Select</td><td><kbd>Enter</kbd> / <kbd>Shift</kbd></td></tr><tr><td>L / R${dolphin?' / Z':''}</td><td><kbd>Q</kbd> / <kbd>E</kbd>${dolphin?' / <kbd>C</kbd>':''}</td></tr>${selected.id==='n64'?'<tr><td>Analog stick / C buttons</td><td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / <kbd>I</kbd> <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd></td></tr>':''}${dolphin?'<tr><td>D-pad</td><td><kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd></td></tr>':''}</tbody></table><h3>Gamepads & touch</h3><p>Connect a standard USB or Bluetooth controller, then press one of its buttons. ${dolphin?'The Dolphin player includes its own controller settings. Wii Remote input is not implemented.':'Open the controller icon inside the player to remap buttons. Touch controls are available on supported cores; DS uses touch or a mouse for its bottom screen.'}</p><h3>Keep your progress</h3><p>${selected.id==='nes'?'Use Save state and Load state in the player for a browser save slot. Export state downloads a backup; Import state restores it. ':''}${dolphin?'Use the player’s save and load buttons for session states, or its state download and upload controls for a backup.':'Use the toolbar inside the player to save and load states or export your save files. Browser saves stay in this browser; download backups before clearing site data.'}</p>`);
}
$('controlsButton').onclick=showControls;
$('helpButton').onclick=()=>dialog('Your browser. Your play room.',`<p><strong>1.</strong> Pick a console below the player.</p><p><strong>2.</strong> Click <strong>Open game</strong> or drag your own ROM or disc image onto the page. Common file extensions are detected automatically. For an archive, pick its console first.</p><p><strong>3.</strong> Press Start in the player if prompted. Click inside the game to use the keyboard, or connect a standard gamepad.</p><p>Emulator cores download on the first launch, so you need an internet connection. Your game file is read locally. No commercial games or Nintendo BIOS files are included.</p><h3>GameCube & Wii</h3><p>These use an experimental browser Dolphin build and need a powerful desktop browser with WebGPU. Experimental sideways Wii Remote input is available from keyboard/gamepads, including generated shake and tilt. Nunchuk, IR pointer and original Wii Remote pairing are not available. For full Wii support, use <a href="https://dolphin-emu.org/" target="_blank" rel="noopener noreferrer">desktop Dolphin</a>.</p>`);
function showCompatibility(){dialog('Eleven consoles. Know your player.',`<table><thead><tr><th>Console</th><th>Core</th><th>Support</th></tr></thead><tbody>${SYSTEMS.map(s=>`<tr><td>${s.short}</td><td>${s.core==='dolphin'?'WASM Dolphin':{nes:'JSNES / FCEUmm',snes:'Snes9x',gb:'Gambatte',gba:'mGBA',n64:'Mupen64Plus',nds:'melonDS',azahar:'Azahar (nightly)',vb:'Beetle VB'}[s.core]}</td><td>${s.id==='wii'?'Experimental; sideways Wii Remote':s.id==='3ds'?'Experimental; WebGL 2 + threads':s.experimental?'Experimental; desktop WebGPU':s.id==='n64'||s.id==='nds'?'Game / device dependent':'Browser core'}</td></tr>`).join('')}</tbody></table><p>Core availability does not guarantee every game will work. N64, DS, GameCube and Wii performance depends on your device and the game. Wii input currently emulates one sideways Wii Remote. Games that need a Nunchuk or IR pointer are not supported.</p><p>Compressed disc images such as RVZ should be opened after selecting GameCube or Wii. Extract ZIP/7Z archives for those systems first.</p>`)}
$('compatibilityButton').onclick=showCompatibility;
$('settingsButton').onclick=()=>{
 dialog('Make yourself at home.',`<label class="setting-row"><span>Picture style</span><select id="videoSetting"><option value="crisp" ${prefs.video==='crisp'?'selected':''}>Crisp pixels</option><option value="smooth" ${prefs.video==='smooth'?'selected':''}>Smooth</option></select></label><label class="setting-row"><span>Starting volume</span><input id="volumeSetting" type="range" min="0" max="1" step=".05" value="${Number(prefs.volume)||0}" aria-label="Starting volume"></label><p class="tiny-text">Preferences apply the next time you open a game. You can change volume in the player while playing.</p><h3>Optional BIOS file</h3><p>Some cores or games need a BIOS. Choose your own BIOS file or archive before opening the game. The file stays in memory until you leave this page.</p><div class="bios-name" id="biosName">${biosFile?escape(biosFile.name):'No BIOS selected'}</div><button class="primary-button" id="chooseBios">${icon('folder')}Choose BIOS</button>${biosFile?'<button class="text-button" id="clearBios">Remove BIOS</button>':''}`);
 $('videoSetting').onchange=e=>{prefs.video=e.target.value;write('pixelport-prefs',prefs)};$('volumeSetting').oninput=e=>{prefs.volume=Number(e.target.value);write('pixelport-prefs',prefs)};
 $('chooseBios').onclick=()=>$('biosInput').click();if($('clearBios'))$('clearBios').onclick=()=>{biosFile=null;$('biosName').textContent='No BIOS selected';$('clearBios').remove()};
};
$('biosInput').onchange=e=>{if(e.target.files[0]){biosFile=e.target.files[0];if($('biosName'))$('biosName').textContent=biosFile.name}};
$('aboutButton').onclick=()=>dialog('Built on a love of play.',`<p>PixelPort brings open-source emulators together in one browser arcade. It is an independent project and is not affiliated with Nintendo.</p><p>NES games use JSNES; other older consoles use <a href="https://emulatorjs.org/" target="_blank" rel="noopener noreferrer">EmulatorJS</a> and its RetroArch cores. GameCube and Wii use <a href="https://github.com/dougchansan/wasm-dolphin" target="_blank" rel="noopener noreferrer">wasm-dolphin</a>, based on Dolphin.</p><a class="dialog-link" href="licenses/index.html" target="_blank" rel="noopener">Open-source licenses & source code ↗</a><p>Your game files are read locally and are never uploaded. Emulator code is downloaded from the site and the EmulatorJS CDN. History remembers filenames on your device.</p>`);
window.addEventListener('gamepadconnected',updateGamepads);window.addEventListener('gamepaddisconnected',updateGamepads);
function updateGamepads(){const pads=navigator.getGamepads?.()||[];const pad=Array.from(pads).find(Boolean);$('gamepadLabel').textContent=pad?'Gamepad connected':'Keyboard ready';$('gamepadStatus').style.color=pad?'#709064':''}
const multiplayer=createMultiplayer({container:$('multiplayerSection'),getSession:()=>({frame,system:selected,file:currentFile}),onStatus:feedback});
$('multiplayerButton').onclick=()=>{multiplayer.toggle();};
const patcher=createPatcher({container:$('patcherSection'),getFile:()=>currentFile,play:launch});
$('patcherButton').onclick=()=>patcher.toggle();
updateSelection();renderRecent();updateGamepads();

$("demoButton").onclick=async()=>{try{feedback("");const response=await fetch("demo/pixelport-controller.nes");if(!response.ok)throw new Error("Demo could not be loaded.");await launch(new File([await response.arrayBuffer()],"PixelPort Controller Demo.nes",{type:"application/octet-stream"}));}catch(error){feedback(error.message,true)}};
