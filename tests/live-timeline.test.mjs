import test from 'node:test';
import assert from 'node:assert/strict';
import {sections,activeSections,sectionForAnchor} from '../app/portfolio/config.mjs';
import {sectionTransition,samplePage,transitionCues,videoFrameTime} from '../app/portfolio/timeline.mjs';

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
  assert.deepEqual(workChapters.map(section=>section.title),['프로젝트','경험','연구','활동']);
  assert.deepEqual(active.find(section=>section.id==='education').chapters.map(section=>section.id),['education','certifications','awards','skills']);
  const records=active.flatMap(section=>section.chapters||[section]);
  assert.deepEqual(records.map(section=>section.id).sort(),sections.map(section=>section.id).sort());
  for(const original of sections)assert.deepEqual(records.find(section=>section.id===original.id),original);
  for(const [id,owner] of [['experience','projects'],['activities','projects'],['publications','projects'],['certifications','education'],['awards','education'],['skills','education']])assert.equal(sectionForAnchor(active,id).id,owner);
  const withoutParent=activeSections(sections.map(section=>({...section,enabled:section.id!=='projects'})));
  for(const id of ['experience','activities','publications'])assert.ok(withoutParent.some(section=>section.id===id));
});

test('twenty-four showcase drafts preserve the original work records and fallback images',()=>{
  const originals={
    projects:['portfolio','project-02','project-03','project-04'],
    experience:['experience-01','experience-02','experience-next'],
    publications:['mmn-study','paper-next'],
    activities:['seminars','entrepreneurship','exchange'],
  };
  const sourceIds=new Set(sections.flatMap(section=>section.items.map(item=>item.id)));
  const showcaseIds=[];
  for(const [id,expectedIds] of Object.entries(originals)){
    const section=sections.find(section=>section.id===id);
    assert.deepEqual(section.items.map(item=>item.id),expectedIds);
    assert.notEqual(section.showcaseItems,section.items);
    assert.equal(section.showcaseItems.length,6);
    assert.equal(new Set(section.showcaseItems.map(item=>item.artwork.src)).size,6);
    section.showcaseItems.forEach((item,index)=>{
      showcaseIds.push(item.id);
      assert.ok(!sourceIds.has(item.id));
      assert.equal(item.title,`${section.title} ${String(index+1).padStart(2,'0')}`);
      assert.equal(item.placeholder,true);
      for(const field of ['period','role','result','description','detail'])assert.match(item[field],/입력/);
      assert.match(item.artwork.src,/^\/art\/works\/character-0[1-6]\.png$/);
      assert.equal(item.artwork.temporary,true);
      assert.match(item.artwork.alt,/임시 성인 여성 캐릭터/);
      assert.match(item.image,/^\/art\/concepts\/.+\.webp$/);
    });
  }
  assert.equal(showcaseIds.length,24);
  assert.equal(new Set(showcaseIds).size,24);
});

test('the shared six representatives resolve to distinct draft characters across work chapters',()=>{
  const work=activeSections(sections).find(section=>section.id==='projects');
  assert.deepEqual(work.featuredItemIds,['showcase-project-01','showcase-experience-01','showcase-research-01','showcase-activity-01','showcase-project-02','showcase-research-02']);
  const drafts=work.chapters.flatMap(chapter=>chapter.showcaseItems);
  const representatives=work.featuredItemIds.map(id=>drafts.find(item=>item.id===id));
  assert.ok(representatives.every(Boolean));
  assert.equal(new Set(work.featuredItemIds).size,6);
  assert.deepEqual(representatives.map(item=>item.artwork.src),Array.from({length:6},(_,index)=>`/art/works/character-0${index+1}.png`));
});

test('five interest portraits retain the original fallback illustrations',()=>{
  const topics=sections.find(section=>section.id==='interests').items;
  assert.deepEqual(topics.map(item=>item.id),['bci','eeg-fmri','alignment','representation','speech']);
  assert.deepEqual(topics.map(item=>item.displayName),['BCI','EEG·fMRI','AI 정렬','표현 학습','음성·언어']);
  for(const item of topics){
    assert.equal(item.artwork.src,`/art/interests/${item.id}.png`);
    assert.equal(item.artwork.temporary,false);
    assert.match(item.artwork.alt,/성인 여성 캐릭터/);
    assert.match(item.image,/^\/bg\/morph\/scene-\d+-still\.webp$/);
    for(const layer of ['hero','card','backdrop']){
      assert.equal(item.artwork[layer].position,'50% 0%');
      assert.ok(Number.isFinite(item.artwork[layer].scale)&&item.artwork[layer].scale>0);
    }
  }
});

test('reference screens use page transitions while the final fade follows native scroll',()=>{
  const active=activeSections(sections);let offset=0;
  const starts=active.map((_,index)=>{const start=offset;offset+=1000+sectionTransition(active,index).length*10;return start;});
  assert.deepEqual(active.map((_,index)=>{const cue=sectionTransition(active,index);return [cue.effect,cue.length];}),[['page',0],['showcase',0],['showcase',0],['fade',45],['none',0]]);
  active.forEach((item,index)=>{
    const cue=sectionTransition(active,index);
    const y=starts[index]+(cue.length?1000+cue.length*5:500);
    const a=samplePage(y,starts,active,1000);
    samplePage(offset,starts,active,1000);
    assert.deepEqual(samplePage(y,starts,active,1000),a);
    assert.equal(a.effect,cue.effect);assert.equal(a.transition,cue.length ? .5 : 0);
    assert.equal(samplePage(starts[index]+500,starts,active,1000).transition,0);
    if(!cue.length)assert.equal(samplePage(starts[index]+999,starts,active,1000).transition,0);
  });
  assert.equal(transitionCues.length,4);
});
test('reordering, removal and lone/empty lists do not inherit ordinal effects',()=>{
  assert.equal(sectionTransition([sections[0],sections[2]],0).effect,'none');
  assert.equal(sectionTransition([sections[1],sections[0]],0).effect,'none');
  assert.equal(sectionTransition([sections[0]],0).length,0);
  assert.equal(samplePage(2000,[0],[sections[0]],1000).transition,0);
  assert.equal(samplePage(0,[],[],1000).index,-1);
  const reordered=['education','contact','about','interests'].map(id=>sections.find(section=>section.id===id));
  assert.equal(sectionTransition(reordered,0).effect,'fade');assert.equal(sectionTransition(reordered,2).effect,'page');
});
