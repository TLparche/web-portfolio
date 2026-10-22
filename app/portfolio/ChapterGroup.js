'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { selectKey } from './SceneArt';
import SectionContent from './SectionContent';
import { ExperiencePanel, CredentialsPanel, EducationPanel, AwardsPanel, SkillRecordsPanel } from './EvidenceScenes';
import styles from './ChapterGroup.module.css';

export function useChapterSelection(section) {
  const chapters = section.chapters || [section];
  const [selected, setSelected] = useState(0);
  const [instant, setInstant] = useState(false);
  useEffect(() => {
    const read = () => {
      const index = chapters.findIndex(item => item.id === window.location.hash.slice(1));
      if(index >= 0) {setSelected(index);setInstant(true);}
    };
    read(); window.addEventListener('hashchange',read);
    return () => window.removeEventListener('hashchange',read);
  }, [section]);
  function choose(index, keyboard = false) {
    setSelected(index);setInstant(keyboard);
    history.replaceState(null,'',`#${chapters[index].id}`);
  }
  return {chapters,selected,instant,choose};
}

export function ChapterTabs({section,chapters,selected,choose,className='',instant=false,vertical=false}) {
  const tabs = useRef(null);
  const [narrow,setNarrow] = useState(false);
  const [indicator,setIndicator] = useState({left:0,width:0});
  const reduced = useReducedMotion();
  useEffect(() => {
    if(!vertical) return;
    const query = matchMedia('(max-width:480px)');
    const update = () => setNarrow(query.matches);
    update();query.addEventListener('change',update);
    return () => query.removeEventListener('change',update);
  }, [vertical]);
  useEffect(() => {
    const measure = () => {
      const button = tabs.current?.querySelector('[aria-selected="true"]');
      if(button) setIndicator({left:button.offsetLeft,width:button.offsetWidth});
    };
    measure();
    const rail = tabs.current;
    const button = rail.querySelector('[aria-selected="true"]');
    if(button && rail.scrollWidth > rail.clientWidth) {
      const left = button.offsetLeft;
      const right = left + button.offsetWidth;
      const destination = left < rail.scrollLeft ? left - 8 : right > rail.scrollLeft + rail.clientWidth ? right - rail.clientWidth + 8 : rail.scrollLeft;
      if(destination !== rail.scrollLeft) rail.scrollTo({left:destination,behavior:instant || reduced ? 'instant' : 'smooth'});
    }
    const observer = new ResizeObserver(measure);
    observer.observe(tabs.current);
    return () => observer.disconnect();
  }, [selected,section,instant,reduced]);
  return <div ref={tabs} className={`${styles.tabs} ${className}`} data-instant={instant} role="tablist" aria-orientation={vertical&&!narrow?'vertical':'horizontal'} aria-label={`${section.title} 분류`} onKeyDown={event=>selectKey(event,selected,chapters.length,choose)}>
    {chapters.map((part,index)=><button key={part.id} role="tab" id={`${section.id}-category-${part.id}`} aria-controls={`${section.id}-category-panel-${part.id}`} aria-selected={selected===index} tabIndex={selected===index?0:-1} onClick={event=>choose(index,event.detail===0)}>{part.title}<span className={styles.count}>{String(part.showcaseItems?.length ?? (part.items?.length || part.groups?.reduce((sum,group)=>sum+group.items.length,0) || 0)).padStart(2,'0')}</span></button>)}
    <span className={styles.indicator} aria-hidden="true" style={{transform:`translateX(${indicator.left}px) scaleX(${indicator.width/100})`}}/>
  </div>;
}

export default function ChapterGroup({section,Heading,chapter,onDetail,onSelect,profile}) {
  const state = useChapterSelection(section);
  const {chapters,selected,instant} = state;
  const content = useRef(null);
  const reduced = useReducedMotion();
  const isProfile = section.kind==='education';
  useEffect(() => {
    if(instant || reduced) return;
    const animation = content.current?.animate([{opacity:.4},{opacity:1}],{duration:240,easing:'cubic-bezier(.23,1,.32,1)'});
    return () => animation?.cancel();
  }, [selected,instant,reduced]);
  return <div className={styles.group} data-chapter-group={section.id} data-profile={isProfile} data-copy>
    {isProfile && <header className={styles.heading}><span>{chapter}</span><Heading id={`${section.id}-title`}>이력·역량</Heading></header>}
    <ChapterTabs section={section} {...state} vertical={isProfile}/>
    <div ref={content} className={styles.content} data-content-reveal>
      {chapters.map((part,index)=><div key={part.id} id={`${section.id}-category-panel-${part.id}`} className={styles.part} data-part={part.kind} role="tabpanel" aria-labelledby={`${section.id}-category-${part.id}`} hidden={index!==selected} tabIndex={0}>
        {part.id !== section.id && <span id={part.id} className={styles.anchor}/>}
        {part.kind==='experience'?<ExperiencePanel section={part} Heading={Heading} chapter={chapter} onDetail={onDetail}/>:
          part.kind==='education'?<EducationPanel section={part} Heading={Heading} chapter={chapter} compact={isProfile}/>:
          part.kind==='credentials'?<CredentialsPanel section={part} Heading={Heading} chapter={chapter} compact={isProfile}/>:
          part.kind==='awards'?<AwardsPanel section={part} Heading={Heading} chapter={chapter} compact={isProfile}/>:
          part.kind==='skills'?<SkillRecordsPanel section={part} Heading={Heading} chapter={chapter} compact={isProfile}/>:
          <div className={styles.activity}><header><span>{chapter} / {part.title}</span><Heading id={`${part.id}-title`}>{part.display}</Heading><p>{part.body}</p></header><SectionContent section={part} onSelect={(_,item)=>onSelect?.(section,item)} profile={profile}/></div>}
      </div>)}
    </div>
    <noscript><style>{'[data-chapter-group] [role=tablist]{display:none!important}[data-chapter-group] [role=tabpanel][hidden]{display:block!important}[data-chapter-group],[data-chapter-group] [data-content-reveal],[data-chapter-group] [data-part]{height:auto!important;overflow:visible!important}[data-chapter-group]>[data-content-reveal]{grid-column:1/-1}[data-chapter-group] [data-part]{margin-bottom:64px}'}</style></noscript>
  </div>;
}
