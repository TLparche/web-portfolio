import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER_DISTANCE, DISSOLVE_START, READING_POSITION, sampleChapter, revealAt, componentReveal, readingOffset, visualFor } from '../app/portfolio/chapter-timeline.mjs';
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
  assert.equal(revealAt(.01/CHAPTER_DISTANCE),0);
  assert.ok(revealAt(.2/CHAPTER_DISTANCE,0)>revealAt(.2/CHAPTER_DISTANCE,1));
  assert.equal(componentReveal(.2/CHAPTER_DISTANCE,0,'title').opacity,'0');
  assert.ok(Number(componentReveal(.2/CHAPTER_DISTANCE,0,'diagonal',false,'surface').opacity)>0);
  for(const group of [0,1,2])assert.equal(revealAt(.65/CHAPTER_DISTANCE,group),1);
  assert.equal(revealAt(DISSOLVE_START),1);
  assert.ok(sampleChapter(1440,starts,extent).dissolve<1e-8);
  const next=sampleChapter(extent,starts,extent);
  assert.equal(next.index,1);assert.ok(next.media>0);assert.equal(next.progress,0);
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

test('component entrances reverse exactly and release their styles before reading and dissolving',()=>{
  const rest = {opacity:'', translate:'', clipPath:''};
  for(const kind of ['title','text','line','diagonal','ribbon-up','ribbon-down','ticket','record','controls']) {
    for(const group of [0,.5,1,2,3.25,3.5,4]) {
      for(const phase of ['surface','content']) {
        assert.equal(componentReveal(0,group,kind,false,phase).opacity,'0');
        const distances=[.26,.42,.6,.67,.72,.81];
        const forward=distances.map(distance=>componentReveal(distance/CHAPTER_DISTANCE,group,kind,false,phase));
        const reverse=distances.toReversed().map(distance=>componentReveal(distance/CHAPTER_DISTANCE,group,kind,false,phase)).reverse();
        assert.deepEqual(forward,reverse);
        for(const progress of [READING_POSITION,DISSOLVE_START,.85,1])assert.deepEqual(componentReveal(progress,group,kind,false,phase),rest);
        assert.deepEqual(componentReveal(0,group,kind,true,phase),rest);
      }
    }
  }
});

test('shape reveals stagger without replacing the original silhouette or hover transform',()=>{
  const progress=.45/CHAPTER_DISTANCE;
  assert.ok(Number(componentReveal(progress,.5,'ribbon-up',false,'surface').opacity)>Number(componentReveal(progress,3.25,'ribbon-down',false,'surface').opacity));
  const up=componentReveal(progress,.5,'ribbon-up',false,'surface'), down=componentReveal(progress,.5,'ribbon-down',false,'surface');
  assert.deepEqual(up.translate.split(' ').map(parseFloat), down.translate.split(' ').map(value=>-parseFloat(value)));
  assert.match(componentReveal(progress,0,'title').clipPath,/^inset/);
  assert.match(componentReveal(progress,0,'diagonal').clipPath,/^polygon/);
  for(const kind of ['ticket','ribbon-up','ribbon-down','controls']) {
    const style=componentReveal(progress,0,kind);
    assert.equal(style.clipPath,'');
    assert.equal(Object.hasOwn(style,'transform'),false);
  }
});

test('each surface reveals its own content immediately after settling, without waiting for later surfaces',()=>{
  const groups=[0,.5,1,2,3,3.5,4];
  for(let distance=0;distance<=.81;distance+=.001) {
    const progress=distance/CHAPTER_DISTANCE;
    for(const group of groups) {
      const content=componentReveal(progress,group,'text');
      if(content.opacity==='' || Number(content.opacity)>0)
        assert.equal(componentReveal(progress,group,'record',false,'surface').opacity,'');
    }
  }
  for(const group of groups) {
    const settled=.04 + group*.035 + .55;
    assert.equal(componentReveal(settled/CHAPTER_DISTANCE,group,'text').opacity,'0');
    assert.ok(Number(componentReveal((settled+.001)/CHAPTER_DISTANCE,group,'text').opacity)>0);
    assert.equal(componentReveal((settled+.071)/CHAPTER_DISTANCE,group,'text').opacity,'');
  }
  const overlapping=.63/CHAPTER_DISTANCE;
  assert.ok(Number(componentReveal(overlapping,0,'title').opacity)>0);
  assert.ok(Number(componentReveal(overlapping,3.5,'record',false,'surface').opacity)<1);
  assert.equal(componentReveal(overlapping,3.5,'controls').opacity,'0');
});
test('media starts in the preceding dissolve and reaches the last valid frame at its own end',()=>{
  assert.equal(videoFrameTime(sampleChapter(1440,starts,extent).nextMedia,10,30),0);
  assert.equal(videoFrameTime(sampleChapter(extent-.001,starts,extent).media,10,30),299/30);
  assert.equal(videoFrameTime(sampleChapter(starts.at(-1)+extent,starts,extent).media,10,30),299/30);
  assert.equal(videoFrameTime(1,0,30),0);
  assert.equal(visualFor(content.profile,'preview').src,content.profile.visuals.landing.src);
});
test('dissolve advances at half speed over two viewports without shortening the reading passage',()=>{
  const begin=sampleChapter(1440,starts,extent), middle=sampleChapter(2440,starts,extent);
  assert.ok(begin.dissolve<1e-8);assert.ok(begin.media<1);
  assert.ok(middle.media>begin.media);assert.ok(middle.nextMedia>begin.nextMedia);
  assert.ok(Math.abs(middle.dissolve-.5)<1e-8);
  assert.ok(Math.abs(sampleChapter(1940,starts,extent).dissolve-.25)<1e-8);
  assert.equal(sampleChapter(3440,starts,extent).index,1);
  assert.ok(Math.abs(readingOffset(0,starts,extent)-810)<1e-8);
  for (const position of [1600,2440,3300]) {
    assert.ok(sampleChapter(position,starts,extent).dissolve>0);
    for(const group of [0,1,2])assert.equal(revealAt(sampleChapter(position,starts,extent).progress,group),1);
  }
});
test('overlapping media keeps its position and speed across every chapter boundary in both directions',()=>{
  for(const markers of [starts,[0,2440,4640,7640,10000,12440]]){
    for(let index=1;index<markers.length;index++){
      const boundary=markers[index], step=.1;
      const before=sampleChapter(boundary-step,markers,extent);
      const at=sampleChapter(boundary,markers,extent);
      const after=sampleChapter(boundary+step,markers,extent);
      assert.ok(at.media>0&&at.media<1);
      assert.ok(Math.abs(at.media-before.nextMedia)<.0001);
      assert.ok(Math.abs((at.media-before.nextMedia)-(after.media-at.media))<1e-10);
      assert.equal(videoFrameTime(at.media,10,30),videoFrameTime(before.nextMedia,10,30));
      assert.deepEqual(sampleChapter(boundary-step,markers,extent),before);
    }
  }
  assert.ok(sampleChapter(starts.at(-1)+extent-1000,starts,extent).media<1);
  const last=sampleChapter(starts.at(-1)+extent,starts,extent);
  assert.equal(last.dissolve,0);assert.equal(revealAt(last.progress,2),1);
  assert.equal(last.media,1);assert.equal(last.nextMedia,1);
});

test('CMS accepts optional video settings and rejects invalid media and framing',()=>{
  const data=structuredClone(content);data.profile.visuals.about.videoSrc='/bg/bg.mp4';data.profile.visuals.about.fps=30;
  assert.doesNotThrow(()=>validateContent(data));
  data.profile.visuals.about.fps=-1;assert.throws(()=>validateContent(data));
  data.profile.visuals.about.fps=30;data.profile.visuals.about.videoSrc='/videos/missing.mp4';assert.throws(()=>validateContent(data));
  delete data.profile.visuals.about.videoSrc;data.profile.visuals.about.mobilePosition='500% 50%';assert.throws(()=>validateContent(data));
});
