'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { assetUrl } from './config.mjs';
import styles from './InterestPanel.module.css';

const modulo = (value, count) => ((value % count) + count) % count;
const sourceFor = item => item?.artwork?.src || item?.image;

function ExplorationNotes({ item }) {
  return <dl className={styles.notes}>
    <div><dt>관심 이유</dt><dd>{item.why || '관심을 갖게 된 계기를 작성할 공간입니다.'}</dd></div>
    <div><dt>접근 방법</dt><dd>{item.approach || '살펴볼 자료와 실험 방법을 작성할 공간입니다.'}</dd></div>
    <div><dt>활용 방향</dt><dd>{item.where || '탐구의 활용 방향을 작성할 공간입니다.'}</dd></div>
  </dl>;
}

export default function InterestPanel({ section, Heading, visible }) {
  const count = section.items.length;
  const [requested, setRequested] = useState({ index: 0, instant: false });
  const [shown, setShown] = useState({ index: 0, src: null, committed: false });
  const [phase, setPhase] = useState('idle');
  const [loadState, setLoadState] = useState('loading');
  const [instant, setInstant] = useState(true);
  const [step, setStep] = useState(100);
  const [scrollStep, setScrollStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [explorationInstant, setExplorationInstant] = useState(false);
  const surface = useRef(null);
  const plate = useRef(null);
  const expandButton = useRef(null);
  const hoverDismissed = useRef(false);
  const shownRef = useRef(shown);
  const requestedRef = useRef(requested);
  const active = useRef(false);
  const viewport = useRef(null);
  const readings = useRef(null);
  const railAnimation = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const clickTimer = useRef(null);
  const x = useMotionValue(-300);
  const item = section.items[shown.index] || section.items[0];
  shownRef.current = shown;
  requestedRef.current = requested;

  useEffect(() => {
    if (!visible) {
      setScrollStep(0); setExpanded(false); hoverDismissed.current = false;
      return;
    }
    const node = surface.current;
    let current = 0, distance = 0, lastWheel = 0, lockedUntil = 0;
    setScrollStep(0);
    const wheel = event => {
      if (event.defaultPrevented || event.ctrlKey || innerWidth <= 900 || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.target.closest?.('[data-scene-scroll]')) return;
      const direction = Math.sign(event.deltaY);
      if (!direction) return;
      const now = performance.now(), previous = lastWheel;
      lastWheel = now;
      if (now < lockedUntil) {
        event.preventDefault(); event.stopPropagation();
        lockedUntil = Math.max(lockedUntil, now + 100);
        return;
      }
      if (current + direction < 0 || current + direction > 4) return;
      event.preventDefault(); event.stopPropagation();
      if (now - previous > 180 || Math.sign(distance) !== direction) distance = 0;
      distance += event.deltaY;
      if (Math.abs(distance) < 10) return;
      current += direction; distance = 0; lockedUntil = now + 300;
      setExplorationInstant(false); setScrollStep(current);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [visible]);

  function hoverPlate(event) {
    if (event.pointerType !== 'mouse' || !matchMedia('(min-width:901px) and (hover:hover) and (pointer:fine)').matches) return;
    if (event.target.closest?.('[data-interest-expand]')) return;
    const rect = plate.current.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) hoverDismissed.current = false;
    setExplorationInstant(false);
    setExpanded(inside && !hoverDismissed.current);
  }

  function dismissPlate(keyboard = false) {
    hoverDismissed.current = true;
    setExplorationInstant(keyboard); setExpanded(false);
    if (keyboard) expandButton.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const rail = viewport.current;
    if (!rail || !count) return;
    const resize = () => {
      const width = rail.clientWidth / 5;
      if (!width) return;
      railAnimation.current?.stop();
      setStep(width);
      x.set(-(count + requestedRef.current.index - 2) * width);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(rail);
    return () => { observer.disconnect(); railAnimation.current?.stop(); clearTimeout(clickTimer.current); };
  }, [count, x]);

  useEffect(() => {
    const enteringStage = !active.current;
    active.current = visible;
    if (!visible || !count) {
      railAnimation.current?.stop();
      drag.current = null;
      setPhase('idle');
      return;
    }
    const target = section.items[requested.index];
    const immediate = requested.instant;
    const changing = !enteringStage && shownRef.current.committed && shownRef.current.index !== requested.index;
    const timers = [];
    let cancelled = false;
    let releaseDelay;
    setInstant(immediate);
    setLoadState('loading');
    setPhase(changing && !immediate ? 'exiting' : 'idle');
    if (changing && !immediate) timers.push(setTimeout(() => { if (!cancelled) setPhase('waiting'); }, 500));
    const delay = changing && !immediate ? new Promise(resolve => { releaseDelay = resolve; timers.push(setTimeout(resolve, 1000)); }) : Promise.resolve();
    async function decode() {
      for (const src of [...new Set([sourceFor(target), target.image].filter(Boolean))]) {
        try { const image = new Image(); image.src = assetUrl(src); await image.decode(); return src; } catch {}
      }
      return null;
    }
    Promise.all([decode(), delay]).then(([src]) => {
      if (cancelled) return;
      setShown({ index: requested.index, src, committed: true });
      setLoadState(src ? 'ready' : 'error');
      readings.current?.querySelectorAll('[data-interest-reading]').forEach(node => { node.scrollTop = 0; });
      setPhase(immediate ? 'idle' : 'entering');
      if (!immediate) timers.push(setTimeout(() => { if (!cancelled) setPhase('idle'); }, 1100));
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); releaseDelay?.(); };
  }, [requested, visible, section.items, count]);

  function centerRail(index, immediately) {
    railAnimation.current?.stop();
    let position = 2 - x.get() / step;
    let destination = Math.round((position - index) / count) * count + index;
    if (destination < 2) { position += count; destination += count; x.set(-(position - 2) * step); }
    if (destination > count * 3 - 3) { position -= count; destination -= count; x.set(-(position - 2) * step); }
    const normalized = -(count + index - 2) * step;
    if (immediately) { x.set(normalized); return; }
    railAnimation.current = animate(x, -(destination - 2) * step, { duration: .3, ease: [.23, 1, .32, 1], onComplete: () => x.set(normalized) });
  }

  function choose(value, keyboard = false) {
    if (!count) return;
    const index = modulo(value, count);
    const immediately = keyboard;
    centerRail(index, immediately);
    if (index !== requestedRef.current.index || loadState === 'error') setRequested({ index, instant: immediately });
  }

  function chooseKey(event) {
    const index = requestedRef.current.index;
    const destination = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: count - 1 }[event.key];
    if (destination === undefined || !count) return;
    event.preventDefault(); event.stopPropagation();
    choose(destination, true);
    viewport.current.querySelector(`[data-topic-index="${modulo(destination, count)}"]`)?.focus({ preventScroll: true });
  }

  function startDrag(event) {
    if (event.button !== 0 || !count) return;
    railAnimation.current?.stop();
    drag.current = { pointer: event.pointerId, start: event.clientX, base: x.get(), moved: false };
  }

  function moveDrag(event) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const movement = event.clientX - current.start;
    if (!current.moved && Math.abs(movement) < 6) return;
    current.moved = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    let next = current.base + movement;
    while (2 - next / step < 2) { next -= count * step; current.base -= count * step; }
    while (2 - next / step > count * 3 - 3) { next += count * step; current.base += count * step; }
    x.set(next);
  }

  function finishDrag(event, cancelled = false) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current.moved) return;
    suppressClick.current = true;
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 0);
    if (cancelled) centerRail(requestedRef.current.index, false);
    else choose(Math.round(2 - x.get() / step));
  }

  return <div ref={surface} className={styles.interest} data-widget="interests" data-copy data-instant={instant} data-interest-scroll-step={scrollStep} data-interest-expanded={expanded} data-exploration-instant={explorationInstant} data-requested-id={section.items[requested.index]?.id} data-shown-id={item?.id} data-interest-state={loadState} data-interest-phase={phase} onPointerMove={hoverPlate} onPointerLeave={() => { hoverDismissed.current = false; setExpanded(false); }} onKeyDown={event => { if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); dismissPlate(true); } }} style={{ '--interest-accent': item?.accent || '#ffa0b0', '--card-step': `${step}px`, '--interest-wipe': `${scrollStep * 25}%` }}>
    <Heading id={`${section.id}-title`} className={styles.sectionTitle}>{section.title}</Heading>
    <div className={styles.backdrop} data-interest-backdrop aria-hidden="true"><div className={styles.backdropWipe} data-interest-wipe><div className={styles.backdropFrame}><div className={styles.backdropMotion}>{shown.src && <img src={assetUrl(shown.src)} alt="" data-visible="true" style={{ objectPosition: item.artwork?.backdrop?.position || '50% 0%', scale: item.artwork?.backdrop?.scale || 3.2 }}/>}</div></div></div></div>
    <div ref={plate} className={styles.plate} data-interest-plate>
      <div id={`${section.id}-illustration`} className={styles.illustration} aria-hidden="true"><div className={styles.heroMotion}>{shown.src && <img src={assetUrl(shown.src)} alt=""/>}</div></div>
      <div className={styles.patternTop} aria-hidden="true"/><div className={styles.patternBottom} aria-hidden="true"/><div className={styles.stamp} aria-hidden="true">✧</div><div className={styles.colorStripe} aria-hidden="true"/>
    </div>
    <button ref={expandButton} className={styles.expandButton} data-interest-expand aria-label={expanded ? '관심 일러스트 접기' : '관심 일러스트 펼치기'} aria-expanded={expanded} aria-controls={`${section.id}-illustration`} onClick={event => { if (expanded) dismissPlate(event.detail === 0); else { hoverDismissed.current = false; setExplorationInstant(event.detail === 0); setExpanded(true); } }}><span aria-hidden="true">{expanded ? '×' : '+'}</span></button>
    <div ref={readings} className={styles.copy} data-interest-column aria-busy={loadState === 'loading'}>
      {section.items.map((topic, index) => <article key={topic.id} className={styles.topic} role="tabpanel" id={`${section.id}-panel-${topic.id}`} aria-labelledby={`${section.id}-tab-${topic.id}`} hidden={index !== shown.index}>
        <h3 className={styles.name} data-interest-text="title">{topic.displayName || topic.label || topic.title}</h3>
        <div className={styles.metadata} data-interest-text="metadata"><p><span>관심 주제</span><strong>{topic.title}</strong></p><p><span>분야</span><strong>{topic.tags?.join(' · ') || topic.tag}</strong></p></div>
        <p className={styles.question} data-interest-text="metadata">{topic.description}</p>
        <p className={styles.subtitle} data-interest-text="subtitle"><span aria-hidden="true">◆</span>{topic.title}</p>
        <div className={styles.reading} data-interest-reading data-scene-scroll tabIndex={0} aria-label={`${topic.displayName || topic.label || topic.title} 설명`} data-interest-text="body"><p>{topic.summary || section.body}</p><ExplorationNotes item={topic}/></div>
      </article>)}
    </div>
    <figure className={styles.hero} data-interest-hero data-art-src={shown.src || ''} data-art-state={loadState}><div className={styles.heroMotion}>
      {shown.src ? <img src={assetUrl(shown.src)} alt={item?.artwork?.alt || `${item?.title} 대표 이미지`} data-visible="true" style={{ objectPosition: item?.artwork?.hero?.position || '50% 0%', scale: item?.artwork?.hero?.scale || 1 }}/> : <span className={styles.fallback}>{loadState === 'error' ? '이미지를 불러오지 못했습니다.' : '캐릭터 이미지를 준비하고 있습니다.'}</span>}
    </div></figure>
    {count > 0 && <div className={styles.selector} data-interest-controls data-scene-gesture>
      <button className={`${styles.arrow} ${styles.previous}`} aria-label="이전 관심분야" onClick={event => choose(requestedRef.current.index - 1, event.detail === 0)}><svg viewBox="0 0 28 46" aria-hidden="true"><path d="M26 2 2 23l24 21Z"/></svg></button>
      <div ref={viewport} className={styles.cards} role="tablist" aria-label="관심분야 선택" onKeyDown={chooseKey} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)} onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}>
        <motion.div className={styles.track} data-interest-track data-selected-index={requested.index} style={{ x }}>
          {Array.from({ length: 3 }, (_, cycle) => section.items.map((topic, index) => {
            const content = <><span className={styles.thumb}>{sourceFor(topic) && <img src={assetUrl(sourceFor(topic))} alt="" draggable="false" loading="lazy" style={{ objectPosition: topic.artwork?.card?.position || '50% 0%', scale: topic.artwork?.card?.scale || 3 }} onError={event => { event.currentTarget.style.opacity = '0'; }}/>}</span><span className={styles.label}>{topic.displayName || topic.label || topic.title}</span></>;
            return cycle === 1 ? <button key={`${cycle}-${topic.id}`} id={`${section.id}-tab-${topic.id}`} className={styles.card} type="button" role="tab" data-topic-index={index} data-selected={index === requested.index} aria-controls={`${section.id}-panel-${topic.id}`} aria-selected={index === shown.index} tabIndex={index === shown.index ? 0 : -1} onClick={event => choose(index, event.detail === 0)}>{content}</button> : <span key={`${cycle}-${topic.id}`} className={styles.card} data-interest-clone data-selected={index === requested.index} aria-hidden="true" onClick={() => choose(index)}>{content}</span>;
          }))}
        </motion.div>
      </div>
      <button className={`${styles.arrow} ${styles.next}`} aria-label="다음 관심분야" onClick={event => choose(requestedRef.current.index + 1, event.detail === 0)}><svg viewBox="0 0 28 46" aria-hidden="true"><path d="m2 2 24 21L2 44Z"/></svg></button>
      <p className={styles.status} role="status">{loadState === 'error' ? '이미지를 불러오지 못했습니다. 설명은 계속 읽을 수 있습니다.' : ''}</p>
    </div>}
    <noscript><style>{'[data-widget=interests]{height:auto!important;min-height:100svh!important;overflow:visible!important;padding:110px 24px 60px!important}[data-interest-column],[data-interest-controls],[data-interest-hero],[data-interest-backdrop],[data-interest-plate],[data-interest-expand]{display:none!important}[data-interest-static]{display:block!important}'}</style><div className={styles.staticNotes} data-interest-static>{section.items.map(topic => <article key={topic.id}><h3>{topic.displayName || topic.title}</h3><h4>{topic.title}</h4><p>{topic.description}</p><p>{topic.summary || section.body}</p><p>{topic.tags?.join(' · ') || topic.tag}</p><ExplorationNotes item={topic}/></article>)}</div></noscript>
  </div>;
}
