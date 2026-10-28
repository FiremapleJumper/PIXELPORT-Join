import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultWiiPadMapping,normalizeWiiPadMapping,readWiiGamepadInput,WII_KEYS} from '../../play/dolphin/src/pixelport-wii-controls.js';
import {inputStateFromPressed,resolveKeyboardButton} from '../../play/dolphin/src/input.js';
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
