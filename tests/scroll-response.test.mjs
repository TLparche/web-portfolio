import test from 'node:test';
import assert from 'node:assert/strict';
import { spring } from 'motion';
import { SCROLL_RESPONSE } from '../app/portfolio/scroll-response.mjs';

function response(from,to){
  const animation=spring({keyframes:[from,to],...SCROLL_RESPONSE});
  return Array.from({length:31},(_,frame)=>({...animation.next(frame*1000/60)}));
}
test('a single scroll step produces intermediate frames, settles exactly, and never overshoots',()=>{
  for(const distance of [8,120,480]){
    const frames=response(0,distance);
    assert.ok(frames.filter(frame=>frame.value>0&&frame.value<distance).length>15);
    assert.ok(frames.every((frame,index)=>frame.value>=0&&frame.value<=distance&&(!index||frame.value>=frames[index-1].value)));
    assert.deepEqual(frames.at(-1),{value:distance,done:true});
  }
});
test('reverse response settles at the requested earlier point without completing the chapter',()=>{
  const forward=response(0,120),reverse=response(120,0);
  forward.forEach((frame,index)=>assert.ok(Math.abs(frame.value+reverse[index].value-120)<1e-7));
  assert.deepEqual(reverse.at(-1),{value:0,done:true});
});
