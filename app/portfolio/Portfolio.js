'use client';

import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { assetUrl, sectionForAnchor } from './config.mjs';
import { clamp, smooth, samplePage, sectionTransition, textOpacity, contentEnterStart, contentExitEnd } from './timeline.mjs';
import SectionContent, { Tags, ActivityReading } from './SectionContent';
import InterestPanel from './InterestPanel';
import SkillsPanel from './SkillsPanel';
import { ContentReveal, contentTiming } from './SceneArt';
import { PublicationPanel, ProjectReading, PaperReading } from './ContentScenes';
import { ExperiencePanel, CredentialsPanel, EducationPanel, AwardsPanel } from './EvidenceScenes';
import ChapterGroup from './ChapterGroup';
import WorkGallery from './WorkGallery';
import ContactPanel from './ContactPanel';
import useSceneEntrance from './useSceneEntrance';
import useSectionNavigation from './useSectionNavigation';
import { dissolveEase, dissolveForPanel, dissolveTransform } from './dissolve.mjs';
import DissolveScene from './DissolveScene';
import styles from './Portfolio.module.css';


function DetailReading({item}) {
  return <><div className={styles.detailBody}>{item.detail}{item.bullets && <ul>{item.bullets.map(text=><li key={text}>{text}</li>)}</ul>}{item.detailSections?.map(part=><section key={part.title}><h3>{part.title}</h3><p>{part.body}</p></section>)}</div>{item.links?.length>0 && <nav className={styles.detailLinks} aria-label="관련 자료">{item.links.filter(link=>link.url).map(link=><a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</nav>}</>;
}

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function ProfilePreview({ profile, sections, firstId, progress, enhanced }) {
  const opacity = useTransform(progress, value => enhanced ? 1 - smooth(.1, .9, value) : 1);
  const transform = useTransform(progress, value => enhanced ? `translateY(${-24 * value}px) scale(${1 - .015 * value})` : 'none');
  const [visible, setVisible] = useState(true);
  useMotionValueEvent(opacity, 'change', value => setVisible(value > .05));
  useEffect(() => { setVisible(!enhanced || opacity.get() > .05); }, [enhanced, opacity]);
  const artwork = sections.find(section => section.kind === 'interests')?.items[0]?.artwork;
  return <section id="preview" className={styles.preview} aria-labelledby="preview-name" data-preview>
    <motion.div className={styles.previewStage} data-preview-stage data-scene-scroll style={{ opacity }} inert={enhanced && !visible} aria-hidden={enhanced && !visible ? true : undefined}>
      <motion.div className={styles.nameCard} style={{ transform }}>
        <div className={styles.cardTop}><span>Personal portfolio</span><span>관심과 경험의 기록</span></div>
        <div className={styles.coverSpread}>
          <div className={styles.cardIdentity}>
            <p className={styles.cardRole}>{profile.role || '직무 · 전공 · 관심 분야'}</p>
            <h1 id="preview-name">{profile.name || '이름 / 닉네임'}</h1>
            <p className={styles.cardTagline}>{profile.tagline || '나를 소개하는 한 문장을 적어주세요.'}</p>
            <dl className={styles.cardDetails}>
              <div><dt>소속</dt><dd>{profile.affiliation || '소속을 입력하세요'}</dd></div>
              <div><dt>이메일</dt><dd>{profile.email ? <a href={`mailto:${profile.email}`}>{profile.email}</a> : '이메일을 입력하세요'}</dd></div>
              <div><dt>링크</dt><dd>{profile.links.length > 0 ? profile.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>) : '공개할 링크를 입력하세요'}</dd></div>
            </dl>
          </div>
          <div className={styles.coverArt} aria-hidden="true">
            <div className={styles.coverArtBackdrop}/>
            {artwork?.src && <img className={styles.coverPortrait} src={assetUrl(artwork.src)} alt="" width="1024" height="1536" decoding="async"/>}
          </div>
        </div>
        <div className={styles.coverBottom}><span>작은 질문과 시도를 한곳에.</span><a className={styles.previewEnter} href={`#${firstId}`}><span>포트폴리오 살펴보기</span><span className={styles.previewArrow} aria-hidden="true">↗</span></a></div>
      </motion.div>
    </motion.div>
  </section>;
}

function Panel({ section, index, count, state, navigation, coverProgress, enhanced, onDetail, onSelect, scene, firstId, projectId, researchId, profile, cue, poster }) {
  const reduced = useReducedMotion();
  const dissolve = useTransform([state, navigation], ([value, move]) => enhanced && !reduced ? dissolveForPanel(index, value, move) : null);
  const imageTransform = useTransform(dissolve, value => value ? dissolveTransform(value.progress,value.incoming) : 'none');
  const opacity = useTransform([state, coverProgress, navigation], ([value, cover, move]) => {
    if (!enhanced) return 1;
    const cut = dissolveForPanel(index, value, move);
    // The live DOM remains an accessible fallback if graphics cannot initialize.
    if (cut && !reduced) return cut.incoming ? dissolveEase(cut.progress) : 1-dissolveEase(cut.progress);
    if (move) {
      if (index !== move.from && index !== move.to) return 0;
      if (move.effect === 'page') return 1;
      return index === move.from ? 1 - clamp(move.elapsed / 100) : Number(move.elapsed >= 100);
    }
    if (value.effect === 'dissolve' && reduced) return Number(index === (value.transition < .5 ? value.index : value.next));
    return textOpacity(index, value) * smooth(.55, 1, cover);
  });
  const transform = useTransform([opacity, navigation, dissolve], ([value, move, cut]) => {
    if (!enhanced) return 'none';
    if (move?.effect === 'page') {
      const offset = index === move.from ? -move.progress : 1 - move.progress;
      return `translateY(${offset * move.direction * 100}vh)`;
    }
    return move || cut ? 'none' : `translateY(${(1 - value) * 8}px)`;
  });
  const panel = useRef(null);
  useSceneEntrance(panel, enhanced);
  const [visible, setVisible] = useState(true);
  const [cutting, setCutting] = useState(false);
  useMotionValueEvent(opacity, 'change', (value) => setVisible(value > .01));
  useEffect(() => {
    const update = () => setCutting(Boolean(enhanced && !reduced && dissolveForPanel(index, state.get(), navigation.get())));
    const a = state.on('change', update), b = navigation.on('change', update);
    update(); return () => { a(); b(); };
  }, [state, navigation, index, enhanced, reduced]);
  useEffect(() => { setVisible(!enhanced || opacity.get() > .01); }, [enhanced, opacity]);
  const Heading = 'h2';
  const chapter = `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
  return <section id={section.id} className={styles.section} style={{'--section-length':`${100+cue.length}vh`}} data-section data-transition-effect={cue.effect} data-transition-length={cue.length} data-kind={section.kind} data-side={section.framing.side} aria-labelledby={`${section.id}-title`}>
    <motion.div ref={panel} className={styles.panel} data-panel data-dissolving={cutting} style={{ opacity, transform, '--scene-image-transform':imageTransform }} inert={enhanced && (!visible || cutting)} aria-hidden={enhanced && !visible ? true : undefined}>
      {section.kind === 'contact' ? <ContactPanel section={section} Heading={Heading} chapter={chapter} profile={profile} firstId={firstId}/> : section.kind === 'projects' ? <WorkGallery section={section} Heading={Heading} chapter={chapter} onDetail={onDetail} visible={visible}/> : section.chapters ? <ChapterGroup section={section} Heading={Heading} chapter={chapter} onDetail={onDetail} profile={profile}/> : section.kind === 'interests' ? <InterestPanel section={section} Heading={Heading} chapter={chapter} visible={visible}/> : section.kind === 'skills' ? <SkillsPanel section={section} index={index} Heading={Heading} visible={visible}/> : section.kind === 'publications' ? <PublicationPanel section={section} Heading={Heading} onDetail={onDetail}/> : section.kind === 'experience' ? <ExperiencePanel section={section} Heading={Heading} chapter={chapter} onDetail={onDetail}/> : section.kind === 'credentials' ? <CredentialsPanel section={section} Heading={Heading} chapter={chapter}/> : section.kind === 'education' ? <EducationPanel section={section} Heading={Heading} chapter={chapter}/> : section.kind === 'awards' ? <AwardsPanel section={section} Heading={Heading} chapter={chapter}/> : <div className={styles.copy} data-copy data-enter={section.kind === 'activities' ? undefined : 'title'}>
        <div className={styles.chapter}><span>{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span><span>{section.title}</span></div>
        <Heading id={`${section.id}-title`} className={styles.display}>{section.kind==='intro' ? section.headline : section.display}</Heading>
        <h3 className={styles.headline}>{section.kind==='intro' ? section.display.replace('\n',' ') : section.headline}</h3>
        <p className={styles.body}>{section.body}</p>
        <SectionContent section={section} onDetail={onDetail} onSelect={onSelect} profile={profile} />
        {section.kind === 'intro' && projectId && <a href={`#${projectId}`} className={styles.primary}>작업 보기 <span aria-hidden="true">↗</span></a>}
        {section.kind === 'intro' && researchId && <a href={`#${researchId}`} className={styles.secondary}>연구 보기</a>}
      </div>}
      {scene && <figure className={styles.still} aria-hidden="true"><picture>{poster && <source media="(min-width:901px) and (prefers-reduced-motion:no-preference)" srcSet={assetUrl(poster)}/>}<img src={assetUrl(scene.still)} alt="" width="960" height="540" loading={index === 0 ? 'eager' : 'lazy'} /></picture><figcaption>형태를 넘어, 다음 가능성으로.</figcaption></figure>}
    </motion.div>
  </section>;
}

export default function Portfolio({ sections, scenes, tracks, profile }) {
  const root = useRef(null);
  const prepareTransition = useRef(null);
  const starts = useRef([]);
  const viewportPosition = useRef({ height: 0, scroll: 0 });
  const { scrollY } = useScroll();
  const coverProgress = useMotionValue(0);
  const contentProgress = useMotionValue(0);
  const [onCover, setOnCover] = useState(true);
  const state = useMotionValue({ index: 0, next: Math.min(1, sections.length - 1), hold: 0, transition: 0, effect:sectionTransition(sections,0).effect });
  const navigation = useMotionValue(null);
  const [staged, setStaged] = useState(false);
  const [moving, setMoving] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [Scene, setScene] = useState(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailInstant, setDetailInstant] = useState(false);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const dialog = useRef(null);
  const menuDialog = useRef(null);
  const trigger = useRef(null);
  const alignedHash = useRef(false);
  const fail = useCallback(() => { setReady(false); setEnhanced(false); }, []);
  useEffect(() => { setStaged(true); }, []);
  const update = useCallback((value) => {
    if (!viewportPosition.current.height || viewportPosition.current.height === window.innerHeight) viewportPosition.current = { height: window.innerHeight, scroll: value };
    const contentStart = starts.current[0] || window.innerHeight;
    coverProgress.set(clamp(value / contentStart));
    // The cover is outside the content chapters and their video timeline.
    const contentEnd = starts.current.at(-1) || contentStart;
    contentProgress.set(clamp((value - contentStart) / Math.max(1, contentEnd - contentStart)));
    setOnCover(value < contentStart * .94);
    const next = samplePage(value, starts.current, sections, window.innerHeight);
    // Native scroll events and the navigator share the browser's rounded
    // position without publishing the same transition frame twice.
    const previous = state.get();
    if (next.index !== previous.index || next.next !== previous.next || next.hold !== previous.hold || next.transition !== previous.transition || next.effect !== previous.effect) state.set(next);
    root.current?.setAttribute('data-transitioning',String(next.effect==='fade' && next.transition>contentExitEnd(next.effect) && next.transition<contentEnterStart(next.effect)));
    setActive(next.transition > (next.effect === 'dissolve' ? .5 : contentEnterStart(next.effect)) ? next.next : next.index);
  }, [state, sections, coverProgress, contentProgress]);
  useMotionValueEvent(scrollY, 'change', update);
  useSectionNavigation({ root, starts, sections, navigation, staged, reducedMotion, update, setMoving, viewportPosition, prepareTransition });

  useEffect(() => {
    const query = matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)');
    let cancelled = false;
    let generation = 0;
    async function configure() {
      const current = ++generation;
      if (!query.matches || !sections.length) { setEnhanced(false); setReady(false); return; }
      const canvas = document.createElement('canvas');
      // Software WebGL decoding competes with the CPU dissolve. Keep the
      // prepared still background when hardware acceleration is unavailable.
      const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat:true });
      if (!context) return;
      context.getExtension('WEBGL_lose_context')?.loseContext();
      try {
        // No preload: small screens never request the 3D chunk or video.
        const module = await import('./VideoScene');
        if (!cancelled && current === generation && query.matches) { setScene(() => module.default); setEnhanced(true); }
      } catch { fail(); }
    }
    configure(); query.addEventListener('change', configure);
    return () => { cancelled = true; query.removeEventListener('change', configure); };
  }, [sections.length, fail]);

  useEffect(() => {
    const measure = () => {
      if (!root.current) return;
      const previous = viewportPosition.current;
      const resized = staged && previous.height && previous.height !== window.innerHeight && starts.current.length;
      const index = resized ? starts.current.findLastIndex(top => top <= previous.scroll + 1) : -1;
      const oldStart = starts.current[index] || 0;
      const oldEnd = starts.current[index + 1] ?? oldStart + previous.height;
      const offset = resized ? (previous.scroll - oldStart) / Math.max(1, oldEnd - oldStart) : 0;
      starts.current = [...root.current.querySelectorAll('[data-section]')].map((node) => node.getBoundingClientRect().top + window.scrollY);
      if (resized) {
        // Mobile browser chrome can resize innerHeight without changing 100vh
        // section spacing. Preserve the actual interval, including the cover.
        const start = starts.current[index] || 0;
        const end = starts.current[index + 1] ?? start + window.innerHeight;
        const position = start + offset * (end - start);
        window.scrollTo({ top: position, behavior: 'instant' });
        viewportPosition.current = { height: window.innerHeight, scroll: position };
      }
      update(window.scrollY);
    };
    measure();
    let alignmentFrame;
    const align = () => {
      alignmentFrame = requestAnimationFrame(() => {
        alignedHash.current = true;
        const id = window.location.hash.slice(1);
        const owner = sectionForAnchor(sections,id);
        if (owner) document.getElementById(owner.id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
        measure();
      });
    };
    if (staged && !alignedHash.current) {
      // Native reload restoration can run after hydration; align after load/layout.
      if (document.readyState === 'complete') align();
      else window.addEventListener('load', align, { once: true });
    }

    if(!staged) alignmentFrame=requestAnimationFrame(()=>{
      const id=window.location.hash.slice(1), owner=sectionForAnchor(sections,id);
      if(owner && owner.id!==id)document.getElementById(owner.id)?.scrollIntoView({behavior:'instant',block:'start'});
    });
    const observer = new ResizeObserver(measure); observer.observe(root.current);
    window.addEventListener('resize', measure);
    document.fonts.ready.then(measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('load', align); cancelAnimationFrame(alignmentFrame); };
  }, [staged, update, sections, reducedMotion]);

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
  return <div ref={root} className={styles.portfolio} data-enhanced={enhanced} data-staged={staged} data-transition-renderer="auto" data-moving={moving} data-ready={ready} data-paused={paused} data-cover={onCover} data-active-kind={sections[active]?.kind}>
    <a className={styles.skip} href={`#${firstId}`}>본문으로 건너뛰기</a>
    <header className={styles.header}>
      <a className={styles.brand} href="#preview" aria-label="포트폴리오 처음으로"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 10 16 4l11 6v12l-11 6L5 22Z M5 10l11 6 11-6M16 16v12M16 4v12M5 22l11-6 11 6" /></svg><span>{profile.name || 'Portfolio'}<small>Ideas in motion</small></span></a>
      <nav className={styles.quickNav} aria-label="주요 메뉴">{sections.filter((section) => ['about','projects','contact'].includes(section.id)).map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>
      {enhanced && <button className={styles.playback} onClick={()=>setPaused(value=>!value)} aria-label={paused?'배경 스크롤 연동 켜기':'배경 프레임 고정'} aria-pressed={paused}><span aria-hidden="true">{paused?'▷':'Ⅱ'}</span><span>{paused?'연동 꺼짐':'스크롤 연동'}</span></button>}
      <button className={styles.menuButton} onClick={event => { menuDialog.current.dataset.instant = String(event.detail === 0); setMenu(true); }} aria-haspopup="dialog" aria-expanded={menu}>전체 메뉴 <span aria-hidden="true">☰</span></button>
    </header>
    {enhanced && Scene && tracks.length>0 && <div className={styles.canvas} aria-hidden="true"><SceneBoundary onFailure={fail}><Scene sections={sections} tracks={tracks} timeline={state} progress={contentProgress} paused={paused} onReady={setReady} onFailure={fail} /></SceneBoundary></div>}
    <main id="main" className={styles.main}>
      <ProfilePreview profile={profile} sections={sections} firstId={firstId} progress={coverProgress} enhanced={staged}/>
      <noscript><style>{'[data-section],[data-section] [data-panel]{height:auto!important;min-height:100svh;overflow:visible!important}[data-section] [data-panel]{position:relative!important}[data-kind=interests] [data-panel],[data-kind=projects] [data-panel]{padding:0!important}'}</style><nav className={styles.noScriptNav} aria-label="전체 섹션">{sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav></noscript>
      {sections.map((section, index) => <Panel key={section.id} section={section} index={index} count={sections.length} state={state} navigation={navigation} coverProgress={coverProgress} enhanced={staged} onDetail={openDetail} cue={sectionTransition(sections,index)} poster={tracks[0]?.poster} scene={scenes.find((scene) => scene.id === section.sceneId)} firstId="preview" projectId={sections.find((item) => item.kind === 'projects')?.id} researchId={contentSections.find(item=>item.kind==='publications')?.id} profile={profile} />)}
      {!sections.length && <p className={styles.empty}>새로운 이야기를 준비하고 있습니다.</p>}
    </main>
    {staged && <DissolveScene root={root} state={state} navigation={navigation} reduced={reducedMotion} prepareTransition={prepareTransition}/>}
    <nav className={styles.rail} aria-label="섹션 탐색">{sections.map((section, index) => <a key={section.id} href={`#${section.id}`} aria-label={section.title} aria-current={active === index ? 'location' : undefined}><span>{section.title}</span><i /></a>)}</nav>
    <div className={styles.bottomBar}><span>Scroll to explore <span aria-hidden="true">↓</span></span><nav className={styles.stepNav} aria-label="이전 다음 섹션">{active > 0 ? <a href={`#${sections[active - 1].id}`} aria-label={`이전 섹션: ${sections[active - 1].title}`}>↑</a> : <span aria-hidden="true">↑</span>}<span>{sections[active]?.title} <b>{String(active + 1).padStart(2,'0')}</b><span className={styles.total}> / {String(sections.length).padStart(2,'0')}</span></span>{active < sections.length - 1 ? <a href={`#${sections[active + 1].id}`} aria-label={`다음 섹션: ${sections[active + 1].title}`}>↓</a> : <span aria-hidden="true">↓</span>}</nav></div>
    <motion.div className={styles.progress} style={{ scaleX: contentProgress }} />
    <footer className={styles.footer}><span>{profile.name || 'Portfolio'} / 계속 만들어가는 기록</span><div>{profile.email && <a href={`mailto:${profile.email}`}>이메일</a>}{profile.cv && <a href={assetUrl(profile.cv)}>CV 다운로드</a>}{profile.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</div><span>콘텐츠 초안</span></footer>
    <dialog ref={menuDialog} className={styles.menuDialog} onCancel={event=>{event.preventDefault();closeMenu(event);}} onClose={() => setMenu(false)} aria-labelledby="menu-title" onClick={(event) => { if (event.target === event.currentTarget) closeMenu(event); }}>
      <div className={styles.menuContent}><div className={styles.dialogTop}><h2 id="menu-title">Explore the portfolio.</h2><button onClick={closeMenu} aria-label="메뉴 닫기">×</button></div>
        <nav aria-label="전체 섹션">{sections.map((section, index) => <a key={section.id} href={`#${section.id}`} onClick={closeMenu} style={{ transitionDelay: `${Math.min(index, 5) * 30}ms` }}><span>{String(index + 1).padStart(2,'0')}</span>{section.title}<span aria-hidden="true">↗</span></a>)}</nav>
      </div>
    </dialog>
    <dialog ref={dialog} className={styles.detailDialog} data-detail-kind={detailSection?.kind} data-instant={detailInstant} aria-labelledby="detail-title" onCancel={event=>{event.preventDefault();closeDetail(event);}} onClose={() => { setDetail(null); trigger.current?.focus({preventScroll:true}); }} onClick={(event) => { if (event.target === event.currentTarget) closeDetail(event); }}>
      {detail && <><div className={styles.dialogTop}><span>{detail.tag}</span><button onClick={closeDetail} aria-label="상세 정보 닫기">×</button></div>{detailSection?.kind==='activities' ? <ActivityReading section={detailSection} item={detail} onChange={changeActivity} instant={detailInstant}/> : <ContentReveal value={detail.id} instant={detailInstant}>{detailSection?.kind === 'projects' ? <ProjectReading item={detail}/> : detailSection?.kind === 'publications' ? <PaperReading item={detail}/> : <div className={styles.detailGrid}><div className={styles.detailMedia}>{detail.image && <img src={assetUrl(detail.image)} alt="" width="960" height="540" />}<span>{String(detailIndex + 1).padStart(2, '0')}</span></div><div aria-live="polite" aria-atomic="true"><h2 id="detail-title">{detail.title}</h2><small className={styles.detailMeta}>{detail.meta}</small><p>{detail.description}</p><Tags items={detail.tags} /><DetailReading item={detail}/></div></div>}</ContentReveal>}<div className={styles.detailBottom}><span>DETAIL {String(detailIndex + 1).padStart(2, '0')} / {String(details.length).padStart(2, '0')}</span>{details.length > 1 && <div><button onClick={event => moveDetail(-1, event)} aria-label="이전 상세 정보">←</button><button onClick={event => moveDetail(1, event)} aria-label="다음 상세 정보">→</button></div>}</div></>}
    </dialog>
  </div>;
}

