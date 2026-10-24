'use client';
import { lockPageScroll } from './scroll-lock.mjs';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { frame, cancelFrame } from 'motion';
import { assetUrl, sectionForAnchor } from './config.mjs';
import { clamp } from './timeline.mjs';
import { CHAPTER_DISTANCE, sampleChapter, readingOffset } from './chapter-timeline.mjs';
import { advanceReveal, followScroll, revealContinuation } from './scroll-response.mjs';
import { ScenePreparationContext } from './LoadingGate';
import ScrollPanel from './ScrollPanel';
import ScrollRail from './ScrollRail';
import SceneBackdrop from './SceneBackdrop';
import SectionContent, { Tags, ActivityReading, DetailFigure } from './SectionContent';
import InterestPanel from './InterestPanel';
import SkillsPanel from './SkillsPanel';
import { ContentReveal, contentTiming } from './SceneArt';
import { PublicationPanel, ProjectReading, PaperReading } from './ContentScenes';
import { ExperiencePanel, CredentialsPanel, EducationPanel, AwardsPanel } from './EvidenceScenes';
import ChapterGroup from './ChapterGroup';
import WorkGallery from './WorkGallery';
import { ArchiveCover, ArchiveIntro, ArchiveEducation, ArchiveContact as ContactPanel } from './ArchiveScenes';
import useChapterNavigation from './useChapterNavigation';
import styles from './Portfolio.module.css';


function DetailReading({item}) {
  return <><div className={styles.detailBody}>{item.detail}{item.bullets && <ul>{item.bullets.map(text=><li key={text}>{text}</li>)}</ul>}{item.detailSections?.map(part=><section key={part.title}><h3>{part.title}</h3><p>{part.body}</p><DetailFigure part={part}/></section>)}</div>{item.links?.length>0 && <nav className={styles.detailLinks} aria-label="관련 자료">{item.links.filter(link=>link.url).map(link=><a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</nav>}</>;
}

function Panel({ section, index, count, state, staged, reduced, onDetail, onSelect, profile, projectId, researchId }) {
  const Heading = 'h2';
  const chapter = String(index).padStart(2,'0') + ' / ' + String(count).padStart(2,'0');
  const firstId = 'preview';
  return <section id={section.id} className={styles.section} data-section data-chapter data-kind={section.kind} data-side={section.framing.side} aria-labelledby={section.id+'-title'}>
    <ScrollPanel index={index} state={state} staged={staged} reduced={reduced} className={styles.panel}>{visible => <>
{section.kind === 'intro' ? <ArchiveIntro section={section} chapter={chapter} profile={profile} projectId={projectId} researchId={researchId}/> : section.kind === 'education' ? <ArchiveEducation section={section} chapter={chapter} profile={profile}/> : section.kind === 'contact' ? <ContactPanel section={section} Heading={Heading} chapter={chapter} profile={profile} firstId={firstId}/> : section.kind === 'projects' ? <WorkGallery section={section} Heading={Heading} chapter={chapter} onDetail={onDetail} visible={visible}/> : section.chapters ? <ChapterGroup section={section} Heading={Heading} chapter={chapter} onDetail={onDetail} profile={profile}/> : section.kind === 'interests' ? <InterestPanel section={section} Heading={Heading} chapter={chapter} visible={visible}/> : section.kind === 'skills' ? <SkillsPanel section={section} index={index} Heading={Heading} visible={visible}/> : section.kind === 'publications' ? <PublicationPanel section={section} Heading={Heading} onDetail={onDetail}/> : section.kind === 'experience' ? <ExperiencePanel section={section} Heading={Heading} chapter={chapter} onDetail={onDetail}/> : section.kind === 'credentials' ? <CredentialsPanel section={section} Heading={Heading} chapter={chapter}/> : section.kind === 'education' ? <EducationPanel section={section} Heading={Heading} chapter={chapter}/> : section.kind === 'awards' ? <AwardsPanel section={section} Heading={Heading} chapter={chapter}/> : <div className={styles.copy} data-copy data-enter={section.kind === 'activities' ? undefined : 'title'}>
        <div className={styles.chapter}><span>{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span><span>{section.title}</span></div>
        <Heading id={`${section.id}-title`} className={styles.display}>{section.kind==='intro' ? section.headline : section.display}</Heading>
        <h3 className={styles.headline}>{section.kind==='intro' ? section.display.replace('\n',' ') : section.headline}</h3>
        <p className={styles.body}>{section.body}</p>
        <SectionContent section={section} onDetail={onDetail} onSelect={onSelect} profile={profile} />
        {section.kind === 'intro' && projectId && <a href={`#${projectId}`} className={styles.primary}>작업 보기 <span aria-hidden="true">↗</span></a>}
        {section.kind === 'intro' && researchId && <a href={`#${researchId}`} className={styles.secondary}>연구 보기</a>}
      </div>}
    </>}</ScrollPanel>
  </section>;
}

export default function Portfolio({ sections, profile }) {
  const root = useRef(null), starts = useRef([]), extent = useRef(1), alignedHash = useRef(false);
  const ids = useMemo(() => ['preview',...sections.map(section=>section.id)], [sections]);
  const { scrollY } = useScroll();
  const visualY = useMotionValue(0);
  const automatic = useRef(null), navigationTarget = useRef(null);
  const { entranceOpening } = useContext(ScenePreparationContext);
  const state = useMotionValue({index:0,next:Math.min(1,sections.length),progress:0,media:0,nextMedia:0,dissolve:0});
  const contentProgress = useMotionValue(0);
  const [staged,setStaged] = useState(false), [chapterIndex,setChapterIndex] = useState(0);
  const [menu,setMenu] = useState(false), [detail,setDetail] = useState(null), [detailInstant,setDetailInstant] = useState(false);
  const [paused,setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const dialog = useRef(null), menuDialog = useRef(null), trigger = useRef(null);
  const active = Math.max(0,chapterIndex-1), onCover = chapterIndex === 0;
  useEffect(()=>{setStaged(!reducedMotion);},[reducedMotion]);
  const update = useCallback(value => {
    const next = sampleChapter(value,starts.current,extent.current);
    const changed = state.get().index !== next.index;
    state.set(next); if (changed) setChapterIndex(next.index);
    if (root.current) root.current.dataset.visualScroll = value.toFixed(2);
    contentProgress.set(clamp((next.index+next.progress)/ids.length));
  },[state,contentProgress,ids.length]);
  useEffect(() => {
    let held = false, touchY = null, forward = true;
    const interrupt = () => {
      if (automatic.current) window.scrollTo({top:visualY.get(),behavior:'instant'});
      else if (navigationTarget.current !== null) window.scrollTo({top:window.scrollY,behavior:'instant'});
      automatic.current = null; navigationTarget.current = null;
    };
    const follow = ({delta}) => {
      let target = window.scrollY;
      const blocked = menu || detail || document.documentElement.style.overflow === 'hidden';
      if (blocked) automatic.current = null;
      if (forward && !held && !automatic.current && navigationTarget.current === null && !blocked) {
        automatic.current = revealContinuation(visualY.get(),target,starts.current,extent.current);
      }
      const continuation = automatic.current;
      if (continuation && !held) {
        continuation.position = advanceReveal(continuation.position,continuation.target,extent.current,delta);
        window.scrollTo({top:continuation.position,behavior:'instant'});
        target = window.scrollY;
      }
      const next = followScroll(visualY.get(),target,delta);
      visualY.set(next);
      if (continuation && continuation.position === continuation.target && next === target) automatic.current = null;
      if (navigationTarget.current !== null && Math.abs(next-navigationTarget.current)<1) navigationTarget.current = null;
      if (root.current) root.current.dataset.autoReveal = String(Boolean(automatic.current));
      if (next === target && (!automatic.current || held)) cancelFrame(follow);
    };
    if (reducedMotion || !staged) visualY.jump(scrollY.get());
    const unsubscribe = scrollY.on('change',value => {
      if (reducedMotion || !staged) visualY.jump(value);
      else frame.update(follow,true);
    });
    const wheel = event => {
      if (event.ctrlKey) return;
      if (automatic.current) { event.preventDefault(); event.stopPropagation(); return; }
      if (!event.deltaY) return;
      if (event.deltaY < 0 || navigationTarget.current !== null) interrupt();
      forward = event.deltaY > 0;
    };
    const press = event => {
      if (event.pointerType !== 'mouse') return;
      interrupt(); held = true; forward = true;
    };
    const release = () => { held = false; touchY = null; if (automatic.current) frame.update(follow,true); };
    const touchStart = event => { interrupt(); held = true; forward = true; touchY = event.touches[0]?.clientY ?? null; };
    const touchMove = event => {
      const y = event.touches[0]?.clientY;
      if (touchY !== null && y !== undefined && y !== touchY) {
        forward = y < touchY;
        if (!forward) interrupt();
      }
      touchY = y ?? null;
    };
    const key = event => { interrupt(); forward = !event.shiftKey && ['ArrowDown','PageDown','End',' '].includes(event.key); };
    const hidden = () => { if (document.hidden) { interrupt(); cancelFrame(follow); } };
    window.addEventListener('wheel',wheel,{capture:true,passive:false});
    window.addEventListener('pointerdown',press,{passive:true}); window.addEventListener('pointerup',release,{passive:true});
    window.addEventListener('touchstart',touchStart,{passive:true}); window.addEventListener('touchmove',touchMove,{passive:true}); window.addEventListener('touchend',release,{passive:true}); window.addEventListener('touchcancel',release,{passive:true});
    window.addEventListener('keydown',key); document.addEventListener('visibilitychange',hidden);
    return () => {
      unsubscribe(); cancelFrame(follow); automatic.current = null;
      if (root.current) delete root.current.dataset.autoReveal;
      window.removeEventListener('wheel',wheel,true); window.removeEventListener('pointerdown',press); window.removeEventListener('pointerup',release);
      window.removeEventListener('touchstart',touchStart); window.removeEventListener('touchmove',touchMove); window.removeEventListener('touchend',release); window.removeEventListener('touchcancel',release);
      window.removeEventListener('keydown',key); document.removeEventListener('visibilitychange',hidden);
    };
  },[scrollY,visualY,reducedMotion,staged,state,menu,detail]);
  useMotionValueEvent(visualY,'change',update);
  const syncScroll = useCallback(value => { automatic.current = null; navigationTarget.current = null; visualY.jump(value); update(value); },[visualY,update]);
  const onNavigate = useCallback(top => { automatic.current = null; navigationTarget.current = top; },[]);
  useChapterNavigation({root,starts,extent,sections,staged,reducedMotion,state,syncScroll,onNavigate});
  useEffect(()=>{
    if (!entranceOpening) return;
    const top = staged ? readingOffset(0,starts.current,extent.current) : 0;
    window.scrollTo({top,behavior:'instant'}); syncScroll(top);
  },[entranceOpening,staged,syncScroll]);
  useEffect(()=>{
    let frame;
    const measure = () => {
      if(!root.current)return;
      const previous=state.get(), oldExtent=extent.current;
      const markers=[...root.current.querySelectorAll('[data-chapter]')];
      starts.current=markers.map(node=>node.getBoundingClientRect().top+window.scrollY);
      extent.current=starts.current[1]-starts.current[0] || markers[0]?.offsetHeight || innerHeight;
      if(alignedHash.current && staged && Math.abs(oldExtent-extent.current)>1){
        window.scrollTo({top:(starts.current[previous.index]||0)+previous.progress*extent.current,behavior:'instant'});
      }
      syncScroll(window.scrollY);
    };
    measure();
    const align = () => {
      frame=requestAnimationFrame(()=>{
        if(!alignedHash.current){
          const id=location.hash.slice(1), owner=sectionForAnchor(sections,id);
          const index=id==='preview'?0:owner?sections.indexOf(owner)+1:-1;
          if(index>=0 && staged)window.scrollTo({top:id==='preview'?0:readingOffset(index,starts.current,extent.current),behavior:'instant'});
          else if(owner && !staged)document.getElementById(owner.id)?.scrollIntoView({behavior:'instant'});
          alignedHash.current=true;
        }
        syncScroll(window.scrollY);
      });
    };
    if(staged||reducedMotion===true){if(document.readyState==='complete')align();else window.addEventListener('load',align,{once:true});}
    const observer=new ResizeObserver(measure);observer.observe(root.current);
    window.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('load',align);cancelAnimationFrame(frame);};
  },[staged,reducedMotion,sections,state,syncScroll]);

  useEffect(() => { if (menu || detail) return lockPageScroll(document); }, [menu, detail]);
  useEffect(() => { if (detail && !dialog.current.open) dialog.current.showModal(); }, [detail]);
  useEffect(() => {
    if (menu && !menuDialog.current.open) menuDialog.current.showModal();
    if (!menu && menuDialog.current.open) closeAnimated(menuDialog.current);
  }, [menu]);

  function openDetail(item, button, keyboard = false) { trigger.current = button; setDetailInstant(keyboard); setDetail(item); }
  function closeAnimated(node, instant = false) {
    if (!node?.open || node.dataset.closing) return;
    if (reducedMotion || instant || node.dataset.instant === 'true') { node.close(); return; }
    node.dataset.closing='true';
    const current = getComputedStyle(node);
    const animation=node.animate([{opacity:current.opacity,transform:current.transform},{opacity:0,transform:'translateY(12px) scale(.98)'}],contentTiming(current));
    animation.onfinish=()=>{delete node.dataset.closing;node.close();};
  }
  function closeDetail(event) { closeAnimated(dialog.current, event?.type === 'cancel' || event?.detail === 0); }
  function closeMenu(event) { if (event?.type === 'cancel' || event?.detail === 0) menuDialog.current.dataset.instant = 'true'; setMenu(false); }
  const contentSections = sections.flatMap(section => section.chapters || [section]);
  const detailSection = contentSections.find(section => section.items.some(item => item.id === detail?.id));
  const details = detailSection?.items.filter(item => !item.placeholder && (detailSection.kind==='activities' || item.detail || item.detailSections?.length)) || [];
  const detailIndex = detail ? details.findIndex((item) => item.id === detail.id) : -1;
  function changeActivity(item, keyboard = false) { setDetail(item); setDetailInstant(keyboard); }
  function moveDetail(direction, event) { setDetailInstant(event.detail === 0); setDetail(details[(detailIndex + direction + details.length) % details.length]); dialog.current.scrollTop = 0; }
  const firstId = sections[0]?.id || 'main';
  return <div ref={root} className={styles.portfolio} style={{'--chapter-length':`${CHAPTER_DISTANCE*100/4}svh`}} data-enhanced={staged} data-staged={staged} data-native-scroll="true" data-ready={staged} data-paused={paused} data-cover={onCover} data-active-kind={sections[active]?.kind}>
    <a className={styles.skip} href={`#${firstId}`}>본문으로 건너뛰기</a>
    <header className={styles.header}>
      <a className={styles.brand} href="#preview" aria-label="포트폴리오 처음으로"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><path d="M16 1v7m0 16v7M1 16h7m16 0h7M11 21l10-10"/></svg><span>{profile.name || 'Portfolio'}</span></a>
      <div className={styles.headerActions}>
        {staged && <button className={styles.playback} onClick={()=>setPaused(value=>!value)} aria-label={paused?'배경 움직임 재생':onCover?'배경 움직임 멈춤':'배경 프레임 고정'} aria-pressed={paused}><svg viewBox="0 0 24 24" aria-hidden="true">{paused ? <path d="m9 6 9 6-9 6Z"/> : <path d="M9 6v12M15 6v12"/>}</svg><span className={styles.controlHint}>{paused?'배경 움직임 재생':'배경 움직임 멈춤'}</span></button>}
        <button className={styles.menuButton} onClick={event => { menuDialog.current.dataset.instant = String(event.detail === 0); setMenu(true); }} aria-label="전체 메뉴" aria-haspopup="dialog" aria-expanded={menu}>목차 <svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 5h24M2 15h16"/></svg></button>
      </div>
    </header>
    {staged && <ScrollRail container={root} position={visualY} onScroll={syncScroll}/>}
    {staged && <SceneBackdrop profile={profile} ids={ids} state={state} paused={paused} reduced={reducedMotion}/>}
    <main id="main" className={styles.main}>
      <section id="preview" className={styles.preview} aria-labelledby="preview-name" data-preview data-chapter>
        <ScrollPanel index={0} state={state} staged={staged} reduced={reducedMotion} className={styles.previewStage}><ArchiveCover profile={profile} firstId={firstId}/></ScrollPanel>
      </section>
      <noscript><style>{'[data-section],[data-section] [data-panel]{height:auto!important;min-height:100svh;overflow:visible!important}[data-section] [data-panel]{position:relative!important}[data-kind=interests] [data-panel],[data-kind=projects] [data-panel]{padding:0!important}'}</style><nav className={styles.noScriptNav} aria-label="전체 섹션">{sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav></noscript>
      {sections.map((section,index)=><Panel key={section.id} section={section} index={index+1} count={sections.length} state={state} staged={staged} reduced={reducedMotion} onDetail={openDetail} profile={profile} projectId={sections.find(item=>item.kind==='projects')?.id} researchId={contentSections.find(item=>item.kind==='publications')?.id}/>)}
      {!sections.length && <p className={styles.empty}>새로운 이야기를 준비하고 있습니다.</p>}
    </main>

    <nav className={styles.chapterNav} aria-label="이전 다음 섹션">
      <div className={styles.chapterPosition}><span className={styles.chapterNumber}>{String(chapterIndex).padStart(2,'0')}<small> / {String(sections.length).padStart(2,'0')}</small></span><span className={styles.chapterName}>{onCover ? '프롤로그' : sections[active]?.title}</span><span className={styles.chapterProgress} aria-hidden="true"><motion.i style={{ scaleX: contentProgress }}/></span></div>
      <div className={styles.chapterArrows}>
        {onCover ? <button disabled aria-label="이전 섹션 없음">↑</button> : <a href={`#${active > 0 ? sections[active - 1].id : 'preview'}`} aria-label={`이전 섹션: ${active > 0 ? sections[active - 1].title : '프롤로그'}`}>↑</a>}
        {chapterIndex < sections.length ? <a href={`#${onCover ? firstId : sections[active + 1].id}`} aria-label={`다음 섹션: ${onCover ? sections[0].title : sections[active + 1].title}`}>↓</a> : <button disabled aria-label="다음 섹션 없음">↓</button>}
      </div>
    </nav>
    <footer className={styles.footer}><span>{profile.name || 'Portfolio'} / 계속 만들어가는 기록</span><div>{profile.email && <a href={`mailto:${profile.email}`}>이메일</a>}{profile.cv && <a href={assetUrl(profile.cv)}>CV 다운로드</a>}{profile.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</div><span>AI · DATA DEVELOPMENT</span></footer>
    <dialog ref={menuDialog} className={styles.menuDialog} onCancel={event=>{event.preventDefault();closeMenu(event);}} onClose={() => setMenu(false)} aria-labelledby="menu-title" onClick={(event) => { if (event.target === event.currentTarget) closeMenu(event); }}>
      <div className={styles.menuContent}><div className={styles.dialogTop}><h2 id="menu-title">목차</h2><button onClick={closeMenu} aria-label="메뉴 닫기">×</button></div>
        <nav aria-label="전체 섹션">{[{id:'preview',title:'프롤로그'},...sections].map((section, index) => <a key={section.id} href={`#${section.id}`} onClick={closeMenu} aria-current={chapterIndex === index ? 'location' : undefined} style={{ transitionDelay: `${Math.min(index, 5) * 30}ms` }}><span>{String(index).padStart(2,'0')}</span>{section.title}<span aria-hidden="true">↗</span></a>)}</nav>
      </div>
    </dialog>
    <dialog ref={dialog} className={styles.detailDialog} data-detail-kind={detailSection?.kind} data-instant={detailInstant} aria-labelledby="detail-title" onCancel={event=>{event.preventDefault();closeDetail(event);}} onClose={() => { setDetail(null); trigger.current?.focus({preventScroll:true}); }} onClick={(event) => { if (event.target === event.currentTarget) closeDetail(event); }}>
      {detail && <><div className={styles.dialogTop}><span>{detail.tag}</span><button onClick={closeDetail} aria-label="상세 정보 닫기">×</button></div>{detailSection?.kind==='activities' ? <ActivityReading section={detailSection} item={detail} onChange={changeActivity} instant={detailInstant}/> : <ContentReveal value={detail.id} instant={detailInstant}>{detailSection?.kind === 'projects' ? <ProjectReading item={detail}/> : detailSection?.kind === 'publications' ? <PaperReading item={detail}/> : <div className={styles.detailGrid}><div className={styles.detailMedia}>{detail.image && <img src={assetUrl(detail.image)} alt="" width="960" height="540" />}<span>{String(detailIndex + 1).padStart(2, '0')}</span></div><div aria-live="polite" aria-atomic="true"><h2 id="detail-title">{detail.title}</h2><small className={styles.detailMeta}>{detail.meta}</small><p>{detail.description}</p><Tags items={detail.tags} /><DetailReading item={detail}/></div></div>}</ContentReveal>}<div className={styles.detailBottom}><span>DETAIL {String(detailIndex + 1).padStart(2, '0')} / {String(details.length).padStart(2, '0')}</span>{details.length > 1 && <div><button onClick={event => moveDetail(-1, event)} aria-label="이전 상세 정보">←</button><button onClick={event => moveDetail(1, event)} aria-label="다음 상세 정보">→</button></div>}</div></>}
    </dialog>
  </div>;
}

