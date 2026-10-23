import test from 'node:test';
import assert from 'node:assert/strict';
import { followPointer, pointerCoordinate } from '../app/portfolio/entrance-motion.mjs';

test('the pointer target stays at the edge, including scrollbar space',()=>{
  assert.equal(pointerCoordinate(632.5,1265),0);
  assert.equal(pointerCoordinate(1265,1265),.5);
  assert.equal(pointerCoordinate(1278,1265),.5);
  assert.equal(pointerCoordinate(-15,1265),-.5);
  assert.ok(pointerCoordinate(1258,1265)>.49);
});

test('following converges without overshoot and preserves position when reversing',()=>{
  let value=0;
  assert.ok(Math.abs(followPointer(0,1,1000/60)-.05)<1e-12);
  for(const target of [.5,-.5,.3,0]){
    for(let frame=0;frame<180;frame++){
      const next=followPointer(value,target,1000/60);
      assert.ok(next>=Math.min(value,target)&&next<=Math.max(value,target));
      assert.ok(Math.abs(next-value)<=Math.abs(target-value)*.051);
      value=next;
    }
    assert.ok(Math.abs(value-target)<.0001);
  }
});

test('60Hz and 120Hz have the same response; a suspended frame cannot jump to the target',()=>{
  const advance=hz=>{let value=0;for(let frame=0;frame<hz;frame++)value=followPointer(value,.5,1000/hz);return value;};
  assert.ok(Math.abs(advance(60)-advance(120))<1e-12);
  assert.ok(followPointer(0,.5,5000)<.08);
  assert.equal(followPointer(.2,.5,0),.2);
});
