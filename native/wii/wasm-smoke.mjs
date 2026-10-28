import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

try{
 const filename=path.resolve(process.argv[2]);
 const factory=(await import(pathToFileURL(filename))).default;
 const module=await factory({wasmBinary:new Uint8Array(await readFile(filename.replace(/\.js$/,'.wasm'))),print:()=>{},printErr:message=>console.error(message)});
 assert.equal(module._PixelPortWiiInputVersion(),1);
 const backend=process.argv[3] || 'Software Renderer';
 assert.equal(module.ccall('SetVideoBackend','number',['string'],[backend]),1);
 assert.equal(module._CoreInit(),1);
 let generation=1;
 const input=mask=>module._SetInputState(mask,128,128,128,128,0,0,0,0,generation++);
 input(0);assert.equal(module._PixelPortWiimoteButtons(),0);
 input(1);assert.equal(module._PixelPortWiimoteButtons(),0x100);
 input(3);assert.equal(module._PixelPortWiimoteButtons(),0x300);
 input(1<<4);assert.equal(module._PixelPortWiimoteButtons(),0x10);
 input(1<<7);assert.equal(module._PixelPortWiimoteButtons(),0x1000);
 input(1<<8);assert.equal(module._PixelPortWiimoteButtons(),0x02);
 input(1<<11);assert.equal(module._PixelPortWiimoteButtons(),0x04);
 input(0);assert.equal(module._PixelPortWiimoteButtons(),0);
 console.log('PASS ('+backend+'): rebuilt WASM initializes an emulated sideways Wii Remote; 1+2, pause, minus, rotated D-pad and release reach Dolphin.');
 process.exit(0);
}catch(error){console.error(error);process.exit(1)}
