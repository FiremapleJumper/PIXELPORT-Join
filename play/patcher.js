import {MOD_GAMES,BUILTIN_MODS,modsForGame} from './mod-catalog.js';
export function createPatcher({container,getFile,play}){
 container.innerHTML=`<div class="section-heading"><h2>Multiplayer mods & ZIP export</h2><button class="text-button" data-close>Close ×</button></div><div class="patch-grid"><div><p>Pick your game and a built-in multiplayer mod. Add your own original game file to create a patched ZIP, right on your device.</p><label class="room-label" for="patchGame">1 · WHAT GAME IS IT?</label><select id="patchGame" class="patch-select">${MOD_GAMES.map(game=>`<option value="${game.id}">${game.name}</option>`).join('')}</select><label class="room-label" for="patchMod">2 · MULTIPLAYER MOD</label><select id="patchMod" class="patch-select"></select><div class="patch-mod-info" data-info></div><div data-custom hidden><label class="room-label" for="patchFile">YOUR EXTRACTED .BPS OR .IPS PATCH</label><input id="patchFile" type="file" accept=".bps,.ips"><p class="tiny-text">Use the exact revision required by the mod. Custom IPS patches cannot check your base game.</p></div><label class="room-label" for="patchBase">3 · ORIGINAL GAME FILE</label><input id="patchBase" type="file"><button class="text-button" data-current>Use currently opened game</button><p class="tiny-text" data-base>No game selected.</p><button class="primary-button" data-build>Apply patch & build ZIPs</button><p role="status" aria-live="polite" data-status></p><div class="patch-results" data-results hidden><button class="secondary-button" data-game>Download my game ZIP</button><button class="secondary-button" data-kit>Download patch-only ZIP</button><button class="primary-button" data-play>Play patched game</button><p class="tiny-text">The game ZIP contains your patched ROM. Friends can use the patch-only ZIP with their own matching game.</p></div></div><div class="patch-guidance"><span class="multiplayer-label">PICK · PATCH · PLAY</span><h3>Three built-in multiplayer mods</h3><p>Super Mario 64 split-screen, Ocarina of Time split-screen, and Super Mario Bros. 3 simultaneous play. The game dropdown filters the mod list. You can still choose your own IPS/BPS patch.</p><h3>Playing with a friend</h3><p>Build the ZIP, choose <strong>Play patched game</strong>, then open <strong>Online rooms</strong> to host. One guest controls player 2 through the existing beta room system. Both players share the host’s game screen.</p><h3>Check the game version</h3><p>Built-in mods check the original file’s size and checksum before applying. A filename or game selection alone cannot identify a ROM revision. Extract archives first; N64 patches require .z64 byte order.</p><h3>Experimental gameplay</h3><p>These are real ROM patches, but gameplay with them and live online play have not been verified here. N64 split-screen requires 8 MB RAM and can run slowly.</p><p class="tiny-text">Zelda64 Online and SM64 Coop DX need their desktop clients. Built-ins contain patch data only; original games are supplied by you. Limits: 128 MB base, 32 MB patch, 256 MB result.</p></div></div>`;
 const $=s=>container.querySelector(s),base=$('#patchBase'),patch=$('#patchFile'),game=$('#patchGame'),mod=$('#patchMod'),status=$('[data-status]'),results=$('[data-results]'),build=$('[data-build]');
 let original=null,worker=null,result=null;
 const preset=()=>BUILTIN_MODS.find(entry=>entry.id===mod.value);
 function tell(message,error=false){status.textContent=message;status.classList.toggle('patch-error',error)}
 function clear(){result=null;results.hidden=true;tell('')}
 function showMod(){
  clear();const selected=preset();$('[data-custom]').hidden=!!selected;
  const info=$('[data-info]');info.replaceChildren();
  if(selected){
   const requirement=document.createElement('p');requirement.textContent='Required game: '+selected.base;
   const notes=document.createElement('p');notes.textContent=selected.notes;notes.className='tiny-text';
   const link=document.createElement('a');link.href=selected.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Mod by '+selected.author+' ↗';
   info.append(requirement,notes,link);
  }else info.textContent='Choose your own multiplayer ROM patch below.';
 }
 function showGame(){mod.replaceChildren();for(const entry of modsForGame(game.value)){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.title;mod.append(option)}const custom=document.createElement('option');custom.value='custom';custom.textContent='Use my own IPS / BPS patch';mod.append(custom);showMod()}
 game.onchange=showGame;mod.onchange=showMod;showGame();
 function setBase(file){original=file;clear();$('[data-base]').textContent=file?file.name:'No game selected.'}
 base.onchange=()=>setBase(base.files[0]);patch.onchange=clear;
 $('[data-current]').onclick=()=>{const file=getFile();if(file)setBase(file);else tell('Open a game first, or choose its original file above.',true)};
 $('[data-close]').onclick=()=>{container.hidden=true};
 build.onclick=async()=>{
  const selected=preset();
  if(!original||(!selected&&!patch.files[0])){tell('Choose your original game'+(!selected?' and a .bps or .ips patch':'')+' first.',true);return}
  clear();const controls=[build,base,patch,game,mod,$('[data-current]')];controls.forEach(control=>control.disabled=true);
  const abort=new AbortController();let settled=false;
  const finish=()=>{settled=true;clearTimeout(timer);abort.abort();worker?.terminate();worker=null;controls.forEach(control=>control.disabled=false)};
  const timer=setTimeout(()=>{finish();tell('The patch took too long. Check the files and try again.',true)},45000);
  try{
   let patchFile=patch.files[0];
   if(selected){tell('Loading built-in mod…');const response=await fetch(new URL(selected.file,import.meta.url),{signal:abort.signal});if(!response.ok)throw new Error('The built-in patch could not be loaded. Please reload and try again.');patchFile=new File([await response.arrayBuffer()],selected.file.split('/').pop())}
   if(settled)return;
   tell('Checking game version, applying patch and building ZIPs…');
   worker=new Worker(new URL('./patch-worker.js',import.meta.url));
   worker.onmessage=({data})=>{finish();if(!data.ok){tell(data.error,true);return}result=data;results.hidden=false;tell('ZIPs ready. '+data.manifest.validation)};
   worker.onerror=()=>{finish();tell('The patch could not be processed. Check the required game revision.',true)};
   worker.postMessage({rom:original,patch:patchFile,preset:selected||null,gameName:MOD_GAMES.find(entry=>entry.id===game.value)?.name});
  }catch(error){if(settled)return;finish();tell(error.message,true)}
 };
 function download(buffer,name){const url=URL.createObjectURL(new Blob([buffer],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
 $('[data-game]').onclick=()=>result&&download(result.zip,result.zipName);
 $('[data-kit]').onclick=()=>result&&download(result.kit,result.kitName);
 $('[data-play]').onclick=()=>{if(result)play(new File([result.rom],result.name,{type:'application/octet-stream'}))};
 return {toggle(){container.hidden=!container.hidden;if(!container.hidden)container.scrollIntoView({behavior:'smooth',block:'start'})}};
}
