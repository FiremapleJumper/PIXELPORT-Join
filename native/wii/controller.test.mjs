import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultWiiPadMapping,normalizeWiiPadMapping,readWiiGamepadInput,WII_KEYS,beginWiiCapture,sampleWiiCapture} from '../../play/dolphin/src/pixelport-wii-controls.js';
import {inputStateFromPressed,resolveKeyboardButton} from '../../play/dolphin/src/input.js';
import {readWiiRendererPreference,rememberWiiRenderer} from '../../play/dolphin/src/pixelport-wii-renderer.js';
import {readSettingsFromSearch,buildSettingsHref} from '../../play/dolphin/src/settings.js';
const pad=()=>({buttons:Array.from({length:20},()=>({pressed:false,value:0})),axes:[0,0,0,0]});
test('8BitDo-style standard face buttons and shoulder produce jump, run and shake',()=>{
 const controller=pad();for(const button of [0,2,4])controller.buttons[button]={pressed:true,value:1};
 const result=readWiiGamepadInput(controller);
 assert.equal(result.state.mask&0x23,0x23);assert.equal(result.pressed.has('X'),false);
 controller.buttons=pad().buttons;assert.equal(readWiiGamepadInput(controller).state.mask,0);
});
test('custom button numbers support nonstandard controller layouts and release cleanly',()=>{
 const controller=pad(),mapping=defaultWiiPadMapping();mapping.buttons.two=7;mapping.buttons.one=6;
 controller.buttons[7]={pressed:true,value:1};assert.equal(readWiiGamepadInput(controller,mapping).state.mask&1,1);
 controller.buttons[7]={pressed:false,value:0};assert.equal(readWiiGamepadInput(controller,mapping).state.mask&1,0);
});
test('movement, analog tilt, inversion and disabled axes are independent',()=>{
 const controller=pad(),mapping=defaultWiiPadMapping();controller.axes=[1,-1,1,0];
 const result=readWiiGamepadInput(controller,mapping);assert.ok(result.state.stickX>176);assert.ok(result.state.stickY>176);assert.ok(result.state.cStickX>176);
 mapping.invertTilt=true;assert.ok(readWiiGamepadInput(controller,mapping).state.cStickX<80);
 mapping.tiltX=-1;assert.equal(readWiiGamepadInput(controller,mapping).state.cStickX,128);
});
test('keyboard Wii mappings cover 1 + 2, pause, shake, tilt and Home',()=>{
 const controls=new Set(['KeyX','KeyZ','Enter','KeyQ','KeyJ','Home'].map(code=>resolveKeyboardButton(code,WII_KEYS)));
 const state=inputStateFromPressed(controls);assert.equal(state.mask&0x100033,0x100033);assert.equal(state.cStickX,0x20);
 assert.equal(resolveKeyboardButton('Escape',WII_KEYS),null);
});
test('invalid saved mapping fields cannot produce invalid controller slots',()=>{
 const safe=normalizeWiiPadMapping({buttons:{two:10000,one:-9},tiltX:100,moveX:-1,invertTilt:'yes'});
 assert.equal(safe.buttons.two,0);assert.equal(safe.buttons.one,2);assert.equal(safe.tiltX,2);assert.equal(safe.moveX,-1);assert.equal(safe.invertTilt,false);
});
test('Wii renderer changes survive apply/restart and future game launches',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 assert.equal(readWiiRendererPreference(storage),'software');
 const settings=readSettingsFromSearch('?controls=wii&core=upstream&video=ogl');
 const applied=new URL(buildSettingsHref('https://example.test/play/dolphin/?controls=wii',settings));
 assert.equal(applied.searchParams.get('video'),'ogl');
 assert.equal(applied.searchParams.get('controls'),'wii');
 rememberWiiRenderer(settings.video,storage);
 assert.equal(readWiiRendererPreference(storage),'ogl');
 rememberWiiRenderer('software',storage);
 assert.equal(readWiiRendererPreference(storage),'software');
});
test('unsupported Wii WebGPU links select OpenGL; GameCube renderer choices are preserved',()=>{
 assert.equal(readSettingsFromSearch('?controls=wii&video=wgpu').video,'ogl');
 assert.equal(readSettingsFromSearch('?video=wgpu').video,'wgpu');
 const settings=readSettingsFromSearch('?video=wgpu');
 assert.equal(new URL(buildSettingsHref('https://example.test/?controls=wii',settings)).searchParams.get('video'),'ogl');
});

test('press-to-map waits for release and learns the raw chosen button',()=>{
 const controller={...pad(),id:'test pad',index:0};controller.buttons[2]={pressed:true,value:1};
 const capture=beginWiiCapture('button',controller,0);
 assert.equal(sampleWiiCapture(capture,controller,1).status,'release');
 controller.buttons=pad().buttons;
 assert.equal(sampleWiiCapture(capture,controller,2).status,'listening');
 controller.buttons[7]={pressed:true,value:1};
 const result=sampleWiiCapture(capture,controller,3);
 assert.equal(result.status,'captured');assert.equal(result.button,7);
 const mapping=defaultWiiPadMapping();mapping.buttons.two=result.button;
 assert.equal(readWiiGamepadInput(controller,mapping).state.mask&1,1);
});
test('connecting a controller does not assign the wake-up button',()=>{
 const capture=beginWiiCapture('button',null,0);
 assert.equal(sampleWiiCapture(capture,null,1).status,'connect');
 const controller={...pad(),id:'new pad',index:0};controller.buttons[0]={pressed:true,value:1};
 assert.equal(sampleWiiCapture(capture,controller,2).status,'release');
 controller.buttons[0]={pressed:false,value:0};
 assert.equal(sampleWiiCapture(capture,controller,3).status,'listening');
 controller.buttons[3]={pressed:true,value:1};
 assert.equal(sampleWiiCapture(capture,controller,4).button,3);
});
test('a timeout or controller change cannot produce an assignment',()=>{
 const controller={...pad(),id:'test pad',index:0};
 assert.equal(sampleWiiCapture(beginWiiCapture('button',controller,0),controller,15000).status,'timeout');
 assert.equal(sampleWiiCapture(beginWiiCapture('button',controller,0),null,1).status,'disconnected');
 assert.equal(sampleWiiCapture(beginWiiCapture('button',controller,0),{...controller,index:1},1).status,'disconnected');
});
test('stick learning ignores drift and held axes, and can preserve reversed movement',()=>{
 const controller={...pad(),id:'test pad',index:0,axes:[1,0,-1,0]};
 const capture=beginWiiCapture('axis',controller,0);
 assert.equal(sampleWiiCapture(capture,controller,1).status,'listening');
 controller.axes[0]=0.1;assert.equal(sampleWiiCapture(capture,controller,2).status,'listening');
 controller.axes[0]=-0.9;const result=sampleWiiCapture(capture,controller,3);
 assert.equal(result.status,'captured');assert.equal(result.axis,0);
 const mapping=defaultWiiPadMapping();mapping.moveX=result.axis;mapping.invertMoveX=result.value<0;
 assert.ok(readWiiGamepadInput(controller,mapping).state.stickX>176);
});
