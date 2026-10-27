/* Patch files stay in this worker. Upstream parsers are unmodified classic scripts. */
importScripts('vendor/rompatcher/modules/BinFile.js','vendor/rompatcher/modules/HashCalculator.js','vendor/rompatcher/modules/RomPatcher.format.ips.js','vendor/rompatcher/modules/RomPatcher.format.bps.js','vendor/fflate-0.8.2.js');
self.onmessage=async({data:{rom,patch,preset,gameName}})=>{
 try{
  if(!rom?.size||rom.size>128*1024*1024)throw new Error('Choose an extracted game file up to 128 MB.');
  if(!patch?.size||patch.size>32*1024*1024)throw new Error('Choose an extracted IPS or BPS patch up to 32 MB.');
  const original=new BinFile(await rom.arrayBuffer()),patchFile=new BinFile(await patch.arrayBuffer());
  if(preset){
   if(patchFile.hashMD5()!==preset.patchMD5)throw new Error('Built-in patch integrity check failed. Reload the page and try again.');
   const crc=original.hashCRC32().toString(16).padStart(8,'0');
   if(original.fileSize!==preset.sourceSize||!preset.sourceCRC32.includes(crc))throw new Error('This file does not match the selected mod. Required: '+preset.base+' Your file: '+original.fileSize+' bytes, CRC32 '+crc.toUpperCase()+'.');
  }
  const magic=String.fromCharCode(...patchFile._u8array.slice(0,5));
  let mod,format;
  if(magic.startsWith('BPS1')){format='BPS';mod=BPS.fromFile(patchFile)}
  else if(magic==='PATCH'){format='IPS';mod=IPS.fromFile(patchFile)}
  else throw new Error('Unsupported patch. Extract a .bps or .ips file first; ZIPs, executables and desktop mod packs cannot be applied here.');
  const max=256*1024*1024;
  if(format==='BPS'&&mod.targetSize>max)throw new Error('The patched game would exceed the 256 MB limit.');
  const output=mod.apply(original,true);
  if(output.fileSize>max)throw new Error('The patched game would exceed the 256 MB limit.');
  const safe=n=>n.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,110)||'game';
  const base=safe(rom.name),dot=base.lastIndexOf('.');
  const name=(dot>0?base.slice(0,dot):base)+'-modded'+(preset?.extension||(dot>0?base.slice(dot):'.rom'));
  const stem=name.replace(/\.[^.]+$/,'');
  const manifest={selectedGame:gameName||null,mod:preset?{id:preset.id,title:preset.title,author:preset.author,source:preset.source,requirements:preset.base,notes:preset.notes}:null,game:rom.name,patch:patch.name,format,originalSize:rom.size,patchedSize:output.fileSize,originalCRC32:original.hashCRC32().toString(16).padStart(8,'0'),patchedCRC32:output.hashCRC32().toString(16).padStart(8,'0'),validation:preset&&format==='IPS'?'Built-in base game checksum and patch integrity validated. Gameplay is experimental.':format==='BPS'?'Source, target and patch checksums validated.':'IPS has no source checksum. Verify the required game version with the mod author.'};
  const readme='PixelPort mod export\n\n'+(preset?preset.title+' by '+preset.author+'\n'+preset.source+'\nRequired game: '+preset.base+'\n'+preset.notes+'\n\n':'')+manifest.validation+'\n\nThis export uses a selected built-in patch or a patch supplied by the player. Applying a patch does not automatically add multiplayer. Use a mod specifically built for your game revision and emulator. Browser rooms currently send one guest to controller 2 (beta); mods with their own networking need their own client. Zelda64 Online requires desktop ModLoader64. SM64 Coop DX is a desktop port, not a patched N64 ROM. Built-in patches contain no base game ROMs. Mod gameplay and online play are unverified.\n\nPlay patched game opens the result directly. Otherwise extract the game ZIP before opening the patched ROM. Patch-only ZIPs contain no game ROM; each player supplies their own matching base file.\n';
  const common={'README.txt':fflate.strToU8(readme),'patch-info.json':fflate.strToU8(JSON.stringify(manifest,null,2))};
  const bytes=output._u8array.slice();
  const zip=fflate.zipSync({...common,[name]:bytes},{level:1});
  const kit=fflate.zipSync({...common,[safe(patch.name)]:patchFile._u8array},{level:1});
  self.postMessage({ok:true,name,zipName:stem+'.zip',kitName:stem+'-patch-kit.zip',manifest,zip:zip.buffer,kit:kit.buffer,rom:bytes.buffer},[zip.buffer,kit.buffer,bytes.buffer]);
 }catch(error){self.postMessage({ok:false,error:error.message||'The patch could not be applied. Check the required game revision.'})}
};
