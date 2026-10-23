import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceReveal, followScroll, revealContinuation, SCROLL_RESPONSE } from '../app/portfolio/scroll-response.mjs';
import { CHAPTER_DISTANCE, sampleChapter, readingOffset, componentReveal } from '../app/portfolio/chapter-timeline.mjs';

const extent = CHAPTER_DISTANCE * 900;
const starts = Array.from({length:6},(_,index)=>index*extent);
const scene = scroll => sampleChapter(scroll,starts,extent);
const continuation = (from,to) => revealContinuation(from,to,starts,extent);

test('continuation begins only after the forward dissolve boundary, including the final chapter',()=>{
  for (const boundary of starts.slice(1)) {
    assert.equal(continuation(boundary-20,boundary-.1),null);
    assert.deepEqual(continuation(boundary-.1,boundary),{position:boundary,target:readingOffset(scene(boundary).index,starts,extent)});
    assert.equal(continuation(boundary,boundary-1),null);
    assert.equal(continuation(boundary+10,boundary+20),null);
  }
  assert.equal(continuation(0,100),null);
});

test('large first inputs stop at the first crossed chapter and retain the full reveal duration',()=>{
  const from=readingOffset(1,starts,extent), boundary=starts[2], target=readingOffset(2,starts,extent);
  for(const native of [boundary,boundary+1,target-1,target,target+100,starts[5]+100]) {
    const reveal=continuation(from,native);
    assert.deepEqual(reveal,{position:boundary,target});
    const halfway=advanceReveal(reveal.position,reveal.target,extent,SCROLL_RESPONSE.revealDuration/2);
    assert.equal(halfway,(boundary+target)/2);
    assert.equal(advanceReveal(halfway,reveal.target,extent,SCROLL_RESPONSE.revealDuration/2),target);
  }
  assert.equal(continuation(starts[4]+100,starts[3]+50),null);
  assert.equal(continuation(target,target),null);
  assert.equal(continuation(starts.at(-1)+10,starts.at(-1)+extent),null);
  assert.equal(revealContinuation(0,100,[],extent),null);
});

test('native boundary starts a continuous reveal while the visible dissolve is still moving',()=>{
  const boundary=starts[1], native=boundary+1, visual=boundary-180;
  assert.ok(scene(visual).dissolve>0);
  assert.equal(continuation(visual,native).target,readingOffset(1,starts,extent));
  assert.ok(advanceReveal(native,readingOffset(1,starts,extent),extent,1000/60)>native);
});

test('the one-second reveal stays continuous at every frame rate',()=>{
  for(const rate of [30,60,120]) {
    const target=readingOffset(1,starts,extent);
    let visual=starts[1]-180, position=starts[1]+1, native=Math.round(position), revealedAt=null, firstVisibleAt=null, contentStartedAt=null;
    let boundarySpeed=null;
    for(let frame=0;frame<rate*6;frame++) {
      position=advanceReveal(position,target,extent,1000/rate);
      native=Math.round(position);
      const before=visual;
      visual=followScroll(visual,native,1000/rate);
      if(before<starts[1]&&visual>=starts[1])boundarySpeed=(visual-before)*rate;
      if(scene(visual).index!==1)continue;
      if(firstVisibleAt===null && Number(componentReveal(scene(visual).progress,0,'diagonal',false,'surface').opacity)>.05)firstVisibleAt=frame/rate;
      if(contentStartedAt===null && Number(componentReveal(scene(visual).progress,3.5,'controls').opacity)>.05)contentStartedAt=frame/rate;
      if(revealedAt===null && componentReveal(scene(visual).progress,3.5,'controls').opacity==='')revealedAt=frame/rate;
      if(frame===rate-1)assert.equal(native,Math.round(target));
    }
    assert.ok(boundarySpeed>200, `boundary velocity ${boundarySpeed}px/s at ${rate}Hz`);
    assert.ok(revealedAt>1 && revealedAt<1.5, `components finish at ${revealedAt}s at ${rate}Hz`);
    assert.ok(revealedAt-firstVisibleAt>.6);
    assert.ok(revealedAt-contentStartedAt>.04 && revealedAt-contentStartedAt<.2);
    assert.equal(position,target);
    assert.equal(native,Math.round(target));
    assert.equal(visual,native);
    assert.equal(scene(visual).index,1);
    assert.equal(scene(visual).dissolve,0);
    assert.deepEqual(componentReveal(scene(visual).progress,3.5,'controls'),{opacity:'',translate:'',clipPath:''});
  }
});

test('continuation never overshoots after a late frame and scales its pace with the viewport',()=>{
  const target=readingOffset(1,starts,extent);
  assert.equal(advanceReveal(target-1,target,extent,1000),target);
  assert.equal(advanceReveal(0,1000,extent,0),0);
  assert.equal(advanceReveal(0,1000,extent/2,500),advanceReveal(0,1000,extent,500)/2);
  assert.ok(Math.abs(advanceReveal(advanceReveal(0,1000,extent,15),1000,extent,25)-advanceReveal(0,1000,extent,40))<1e-10);
});
