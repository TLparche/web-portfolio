import test from 'node:test';
import assert from 'node:assert/strict';
import { followScroll } from '../app/portfolio/scroll-response.mjs';

function response(from,to,rate=60){
  let value=from;
  return Array.from({length:rate*2},()=>value=followScroll(value,to,1000/rate));
}
test('a single scroll step produces intermediate frames, settles exactly, and never overshoots',()=>{
  for(const distance of [8,120,480,1440]){
    const frames=response(0,distance);
    assert.ok(frames.filter(value=>value>0&&value<distance).length>15);
    assert.ok(frames.every((value,index)=>value>=0&&value<=distance&&(!index||value>=frames[index-1])));
    assert.equal(frames.at(-1),distance);
  }
});
test('an interrupted gesture follows the new target immediately and stops without finishing a chapter',()=>{
  const current=response(0,1440)[5];
  assert.ok(followScroll(current,0,1000/60)<current);
  assert.ok(followScroll(current,1000,1000/60)>current);
  assert.equal(followScroll(current,current,1000/60),current);
  assert.equal(response(current,0).at(-1),0);
  assert.equal(response(current,730).at(-1),730);
});

test('the same elapsed time gives the same response at 30, 60 and 120Hz',()=>{
  const positions=[30,60,120].map(rate=>response(0,1440,rate)[rate/2-1]);
  positions.forEach(value=>assert.ok(Math.abs(value-positions[0])<1e-8));
  const split=followScroll(followScroll(0,1440,11),1440,22);
  assert.ok(Math.abs(split-followScroll(0,1440,33))<1e-8);
  assert.equal(followScroll(0,1440,0),0);
});

test('large inputs have a gradual tail instead of a fixed completion deadline',()=>{
  const small=response(0,8),large=response(0,1440);
  assert.equal(small[59],8);
  assert.ok(large[59]<1440);
  assert.ok(large[5]>0&&large[5]<1440*.5);
});
