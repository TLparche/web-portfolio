import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER_DISTANCE, DISSOLVE_START, READING_POSITION, sampleChapter, revealAt, readingOffset, visualFor } from '../app/portfolio/chapter-timeline.mjs';
import { videoFrameTime } from '../app/portfolio/timeline.mjs';
import { validateContent } from '../scripts/validate-content.mjs';
import content from '../content/portfolio.json' with {type:'json'};

const extent=CHAPTER_DISTANCE*1000;
const starts=Array.from({length:6},(_,index)=>index*extent);
test('native distance is proportional, reversible, and has no automatic finishing',()=>{
  const small=sampleChapter(100,starts,extent),large=sampleChapter(400,starts,extent);
  assert.equal(large.progress,small.progress*4);
  const route=[0,360,900,1500,1700,1800,2200,1700,1500,900,0];
  const frames=route.map(position=>sampleChapter(position,starts,extent));
  assert.deepEqual(frames[3],frames[8]);assert.deepEqual(frames[4],frames[7]);
  assert.deepEqual(frames[2],frames[9]);assert.equal(frames[4].index,0);
  assert.ok(frames[4].dissolve>0&&frames[4].dissolve<1);
});
test('each chapter reveals in order and holds its composed content throughout the dissolve',()=>{
  assert.equal(revealAt(.26/CHAPTER_DISTANCE),0);
  assert.ok(revealAt(.36/CHAPTER_DISTANCE,0)>revealAt(.36/CHAPTER_DISTANCE,1));
  for(const group of [0,1,2])assert.equal(revealAt(.56/CHAPTER_DISTANCE,group),1);
  assert.equal(revealAt(DISSOLVE_START),1);
  assert.equal(sampleChapter(1440,starts,extent).dissolve,0);
  const next=sampleChapter(extent,starts,extent);
  assert.equal(next.index,1);assert.equal(next.media,0);assert.equal(next.progress,0);
  assert.equal(revealAt(next.progress),0);
  assert.equal(revealAt(1,2),1);
});
test('direct links and resized viewports resolve to the reading position',()=>{
  for(let index=0;index<starts.length;index++){
    const a=sampleChapter(readingOffset(index,starts,extent),starts,extent);
    const resized=starts.map(value=>value/2);
    const b=sampleChapter(readingOffset(index,resized,extent/2),resized,extent/2);
    assert.ok(Math.abs(a.progress-READING_POSITION)<1e-8);assert.deepEqual(a,b);
  }
});
test('chapter media has independent zero and last valid video frames',()=>{
  assert.equal(videoFrameTime(sampleChapter(extent,starts,extent).media,10,30),0);
  assert.equal(videoFrameTime(sampleChapter(1440,starts,extent).media,10,30),299/30);
  assert.equal(videoFrameTime(1,0,30),0);
  assert.equal(visualFor(content.profile,'preview').src,content.profile.visuals.landing.src);
});
test('dissolve takes a full viewport without shortening the reading passage',()=>{
  const begin=sampleChapter(1440,starts,extent), middle=sampleChapter(1940,starts,extent);
  assert.equal(begin.dissolve,0);assert.equal(begin.media,1);
  assert.ok(Math.abs(middle.dissolve-.5)<1e-8);
  assert.equal(sampleChapter(2440,starts,extent).index,1);
  assert.ok(Math.abs(readingOffset(0,starts,extent)-810)<1e-8);
  for (const position of [1600,1940,2300]) {
    assert.ok(sampleChapter(position,starts,extent).dissolve>0);
    for(const group of [0,1,2])assert.equal(revealAt(sampleChapter(position,starts,extent).progress,group),1);
  }
});
test('CMS accepts optional video settings and rejects invalid media and framing',()=>{
  const data=structuredClone(content);data.profile.visuals.about.videoSrc='/bg/bg.mp4';data.profile.visuals.about.fps=30;
  assert.doesNotThrow(()=>validateContent(data));
  data.profile.visuals.about.fps=-1;assert.throws(()=>validateContent(data));
  data.profile.visuals.about.fps=30;data.profile.visuals.about.videoSrc='/videos/missing.mp4';assert.throws(()=>validateContent(data));
  delete data.profile.visuals.about.videoSrc;data.profile.visuals.about.mobilePosition='500% 50%';assert.throws(()=>validateContent(data));
});
