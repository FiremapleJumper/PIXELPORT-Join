export const SYSTEMS = [
  {id:'nes',name:'Nintendo Entertainment System',short:'NES',nav:'NES / Famicom',year:'1983',type:'home',core:'nes',ext:['nes','fds'],color:'#d56c5d',tint:'#f3e9e1',caption:'The one that started it all.',localPlayers:2},
  {id:'snes',name:'Super Nintendo',short:'SNES',nav:'Super Nintendo',year:'1990',type:'home',core:'snes',ext:['sfc','smc'],color:'#9683c0',tint:'#eeebf4',caption:'A world in 16 bits.',localPlayers:2},
  {id:'n64',name:'Nintendo 64',short:'N64',nav:'Nintendo 64',year:'1996',type:'home',core:'n64',ext:['z64','n64','v64'],color:'#75977b',tint:'#eaf0e4',caption:'A whole new dimension.',localPlayers:4,note:'N64 performance varies by game and device. Use a standard gamepad for analog controls, and the emulator settings for controller mapping.'},
  {id:'gamecube',name:'Nintendo GameCube',short:'GameCube',nav:'GameCube',year:'2001',type:'home',core:'dolphin',ext:['gcm','iso','rvz','ciso','dol','elf'],color:'#7e74af',tint:'#e9e7f4',caption:'Small cube. Big adventures.',experimental:true,note:'Experimental Dolphin browser port. Best on desktop Chrome or Edge with WebGPU. Speed and game compatibility vary. Keyboard and standard gamepads supported.'},
  {id:'wii',name:'Nintendo Wii',short:'Wii',nav:'Wii',year:'2006',type:'home',core:'dolphin',ext:['iso','rvz','wbfs','ciso','dol','elf'],color:'#6fadc0',tint:'#e5eff1',caption:'A different way to play.',experimental:true,note:'Experimental sideways Wii Remote input for Player 1: keyboard and USB/Bluetooth gamepads, including 8BitDo layouts with remapping. Generated shake and tilt are available; Nunchuk, IR pointer, physical gyro and original Wii Remote pairing are not implemented. Gameplay and performance need testing on your device.'},
  {id:'gb',name:'Nintendo Game Boy',short:'Game Boy',nav:'Game Boy',year:'1989',type:'handheld',core:'gb',ext:['gb'],color:'#9ca764',tint:'#edf0df',caption:'Pocket-sized possibilities.'},
  {id:'gbc',name:'Game Boy Color',short:'GB Color',nav:'Game Boy Color',year:'1998',type:'handheld',core:'gb',ext:['gbc'],color:'#c59c56',tint:'#f4eddc',caption:'A little more colorful.'},
  {id:'gba',name:'Game Boy Advance',short:'GBA',nav:'Game Boy Advance',year:'2001',type:'handheld',core:'gba',ext:['gba'],color:'#9181b0',tint:'#ece8f3',caption:'Great games on the go.'},
  {id:'nds',name:'Nintendo DS',short:'DS',nav:'Nintendo DS',year:'2004',type:'handheld',core:'nds',ext:['nds'],color:'#858e9a',tint:'#e9ecef',caption:'Two screens. Endless ideas.',note:'Use a mouse or touch for the bottom screen. DS is more demanding than older systems; performance varies. You can optionally load your own BIOS archive in Preferences before opening a game.'},
  {id:'3ds',name:'Nintendo 3DS',short:'3DS',nav:'Nintendo 3DS',year:'2011',type:'handheld',core:'azahar',ext:['3ds','cci','cxi','3dsx','app','axf'],color:'#608bae',tint:'#e1eaf3',caption:'A new dimension in your pocket.',experimental:true,requiresThreads:true,dataPath:'https://cdn.emulatorjs.org/nightly/data/',note:'Experimental Azahar browser core. Requires a desktop browser with WebGL 2, shared memory and enough RAM. Open a decrypted game dump or homebrew; encrypted games and installable CIA packages are not supported here. Performance varies. 3DS wireless/local-network multiplayer is not implemented.'},
  {id:'vb',name:'Virtual Boy',short:'Virtual Boy',nav:'Virtual Boy',year:'1995',type:'home',core:'vb',ext:['vb','vboy'],color:'#c46e70',tint:'#f2e6e4',caption:'A curious piece of history.'}
];
export function systemById(id){return SYSTEMS.find(s=>s.id===id)||SYSTEMS[0]}
export async function detectSystem(file,selected='nes'){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='cia')throw new Error('CIA files are installation packages. Open a compatible decrypted 3DS game dump or homebrew file instead.');
  if(ext==='elf'&&selected==='3ds')return systemById('3ds');
  if(['zip','7z'].includes(ext)){
    const s=systemById(selected);
    if(s.core==='dolphin')throw new Error('Extract this archive first, then open the disc image. GameCube and Wii archives cannot be played directly.');
    return s;
  }
  if(['iso','gcm','rvz','ciso','wbfs','dol','elf'].includes(ext)){
    if(ext==='wbfs')return systemById('wii');
    if(ext==='gcm')return systemById('gamecube');
    if(ext==='iso'){
      const buffer=await file.slice(0,32).arrayBuffer();
      if(buffer.byteLength>=32){const view=new DataView(buffer);if(view.getUint32(24)===0x5d1c9ea3)return systemById('wii');if(view.getUint32(28)===0xc2339f3d)return systemById('gamecube')}
    }
    if(!['gamecube','wii'].includes(selected))throw new Error('Select GameCube or Wii first, then open this disc image. The console could not be detected from its header.');
    return systemById(selected);
  }
  const result=SYSTEMS.find(s=>s.ext.includes(ext));
  if(!result)throw new Error('That file type is not supported. Open a Nintendo ROM or disc image listed for a console below.');
  if(file.size===0)throw new Error('This file is empty. Choose a complete game file.');
  return result;
}
export function gameId(name,system,size){let h=2166136261;for(const c of `${system}:${name}:${size}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
