import test from 'node:test';
import assert from 'node:assert/strict';
import {activeSections,sectionForAnchor} from '../app/portfolio/config.mjs';
import {sectionTransition,samplePage,transitionCues,videoFrameTime} from '../app/portfolio/timeline.mjs';
import {dissolveForPanel} from '../app/portfolio/dissolve.mjs';

// Engine checks use fixed records so legitimate CMS edits cannot break them.
const chapterOrders={projects:['experience','publications','activities'],education:['certifications','awards','skills']};
const sections=['about','interests','projects','experience','certifications','education','awards','publications','skills','activities','contact'].map(id=>({
  id,enabled:true,title:id,items:[{id:`${id}-record`}],
  mergeInto:Object.keys(chapterOrders).find(parent=>chapterOrders[parent].includes(id)),
  chapterOrder:chapterOrders[id],
  groupTitle:chapterOrders[id] ? `${id}-group` : undefined,
}));

test('scroll maps deterministically to valid video frames in either direction',()=>{
  assert.equal(videoFrameTime(0,17.6),0);
  assert.equal(videoFrameTime(.5,17.6),8.8);
  assert.equal(videoFrameTime(1,17.6),527/30);
  for(const p of [.8,.2,.9,.2])assert.equal(videoFrameTime(p,17.6),Math.floor(p*528)/30);
  assert.equal(videoFrameTime(-2,17.6),0);
  assert.equal(videoFrameTime(2,17.6),527/30);
  assert.equal(videoFrameTime(.5,NaN),0);
  assert.equal(videoFrameTime(NaN,17.6),0);
  assert.equal(videoFrameTime(1,1/24,24),0);
});

test('merged chapters retain their records and old anchors',()=>{
  const active=activeSections(sections);
  assert.deepEqual(active.map(section=>section.id),['about','interests','projects','education','contact']);
  const workChapters=active.find(section=>section.id==='projects').chapters;
  assert.deepEqual(workChapters.map(section=>section.id),['projects','experience','publications','activities']);
  assert.deepEqual(workChapters.map(section=>section.title),['projects','experience','publications','activities']);
  assert.equal(active.find(section=>section.id==='projects').title,'projects-group');
  assert.deepEqual(active.find(section=>section.id==='education').chapters.map(section=>section.id),['education','certifications','awards','skills']);
  const records=active.flatMap(section=>section.chapters||[section]);
  assert.deepEqual(records.map(section=>section.id).sort(),sections.map(section=>section.id).sort());
  for(const original of sections)assert.deepEqual(records.find(section=>section.id===original.id),original);
  for(const [id,owner] of [['experience','projects'],['activities','projects'],['publications','projects'],['certifications','education'],['awards','education'],['skills','education']])assert.equal(sectionForAnchor(active,id).id,owner);
  const withoutParent=activeSections(sections.map(section=>({...section,enabled:section.id!=='projects'})));
  for(const id of ['experience','activities','publications'])assert.ok(withoutParent.some(section=>section.id===id));
});

test('reference transitions and video share scroll positions, including stopped and reversed dissolves',()=>{
  const active=activeSections(sections);let offset=0;
  const starts=active.map((_,index)=>{const start=offset;offset+=1000+sectionTransition(active,index).length*10;return start;});
  assert.deepEqual(active.map((_,index)=>{const cue=sectionTransition(active,index);return [cue.effect,cue.length];}),[['dissolve',0],['dissolve',0],['dissolve',0],['dissolve',0],['none',0]]);
  active.forEach((item,index)=>{
    const cue=sectionTransition(active,index);
    const y=starts[index]+(cue.length?1000+cue.length*5:500);
    const a=samplePage(y,starts,active,1000);
    samplePage(offset,starts,active,1000);
    assert.deepEqual(samplePage(y,starts,active,1000),a);
    assert.equal(a.effect,cue.effect);assert.equal(a.transition,cue.length || cue.effect==='dissolve' ? .5 : 0);
    assert.equal(samplePage(starts[index]+500,starts,active,1000).transition,cue.effect==='dissolve' ? .5 : 0);
    if(!cue.length && cue.effect!=='dissolve')assert.equal(samplePage(starts[index]+999,starts,active,1000).transition,0);
  });
  assert.equal(transitionCues.length,4);
});
test('complete-scene transition preserves reversed menu direction and rounded endpoints',()=>{
  assert.deepEqual(dissolveForPanel(1,{}, {from:2,to:1,effect:'dissolve',progress:.3,direction:-1}),{progress:.7,incoming:false});
  assert.equal(dissolveForPanel(0,{index:1,next:2,effect:'dissolve',transition:.4},null),null);
  assert.equal(samplePage(1999,[1000,2000,3000],activeSections(sections),1000).index,1);
  assert.equal(samplePage(1999,[1000,2000,3000],activeSections(sections),1000).transition,0);
});
test('mobile browser chrome cannot change progress inside unchanged section bounds',()=>{
  const items=activeSections(sections), starts=[724,1568,2412,3256,4100];
  for(const scroll of [724,1146,1484,1568,1980]) {
    assert.deepEqual(samplePage(scroll,starts,items,724),samplePage(scroll,starts,items,844));
  }
  assert.equal(samplePage(1146,starts,items,724).transition,.5);
  assert.equal(samplePage(1484,starts,items,724).index,0);
  assert.ok(samplePage(1484,starts,items,724).transition<1);
});
test('reordering, removal and lone/empty lists do not inherit ordinal effects',()=>{
  assert.equal(sectionTransition([sections[0],sections[2]],0).effect,'none');
  assert.equal(sectionTransition([sections[1],sections[0]],0).effect,'none');
  assert.equal(sectionTransition([sections[0]],0).length,0);
  assert.equal(samplePage(2000,[0],[sections[0]],1000).transition,0);
  assert.equal(samplePage(0,[],[],1000).index,-1);
  const reordered=['education','contact','about','interests'].map(id=>sections.find(section=>section.id===id));
  assert.equal(sectionTransition(reordered,0).effect,'dissolve');assert.equal(sectionTransition(reordered,2).effect,'dissolve');
});
