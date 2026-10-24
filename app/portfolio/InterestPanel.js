'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { assetUrl } from './config.mjs';
import styles from './InterestPanel.module.css';

const modulo = (value, count) => ((value % count) + count) % count;
const sourceFor = item => item?.artwork?.src || item?.image;

function ExplorationNotes({ item }) {
  return <dl className={styles.notes}>
    <div><dt>관심 이유</dt><dd>{item.why || '관심을 갖게 된 계기를 작성할 공간입니다.'}</dd></div>
    <div><dt>직접 해본 것</dt><dd>{item.approach || '살펴볼 자료와 실험 방법을 작성할 공간입니다.'}</dd></div>
    <div><dt>앞으로의 질문</dt><dd>{item.where || '탐구의 활용 방향을 작성할 공간입니다.'}</dd></div>
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
  const [expanded, setExpanded] = useState(false);
  const [explorationInstant, setExplorationInstant] = useState(false);
  const surface = useRef(null);
  const plate = useRef(null);
  const expandButton = useRef(null);
  const hoverDismissed = useRef(false);
  const hovered = useRef(false), focused = useRef(false);
  const shownRef = useRef(shown);
  const requestedRef = useRef(requested);
  const active = useRef(false);
  const viewport = useRef(null);
  const railAnimation = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const clickTimer = useRef(null);
  const x = useMotionValue(-300);
  const reduced = useReducedMotion();
  const item = section.items[shown.index] || section.items[0];
  shownRef.current = shown;
  requestedRef.current = requested;

  useEffect(() => {
    if (!visible) { setExpanded(false); hoverDismissed.current = false; hovered.current = focused.current = false; }
  }, [visible]);

  function hoverPlate(event) {
    if (event.pointerType !== 'mouse' || !matchMedia('(min-width:901px) and (hover:hover) and (pointer:fine)').matches || surface.current.closest('[data-dissolving=true]')) return;
    const regions = [plate.current, surface.current.querySelector('[data-interest-hero]'), expandButton.current];
    const inside = regions.some(node => { const rect=node.getBoundingClientRect(); return event.clientX>=rect.left && event.clientX<=rect.right && event.clientY>=rect.top && event.clientY<=rect.bottom; });
    hovered.current = inside;
    if (!inside) hoverDismissed.current = false;
    setExplorationInstant(Boolean(reduced));
    setExpanded((inside || focused.current) && !hoverDismissed.current);
  }

  function dismissPlate(keyboard = false) {
    hoverDismissed.current = true;
    focused.current = false;
    setExplorationInstant(keyboard || Boolean(reduced)); setExpanded(false);
    if (keyboard) expandButton.current?.focus({ preventScroll: true });
  }

  function leavePlate(event) {
    if (event.pointerType !== 'mouse' || !matchMedia('(min-width:901px) and (hover:hover) and (pointer:fine)').matches || surface.current.closest('[data-dissolving=true]')) return;
    hovered.current = false; hoverDismissed.current = false;
    if (!focused.current) { setExplorationInstant(Boolean(reduced)); setExpanded(false); }
  }

  function focusPlate(event) {
    if (!event.target.closest('[data-interest-expand],[data-interest-reading],[data-interest-exploration-reading]') || !event.target.matches(':focus-visible') || hoverDismissed.current) return;
    focused.current = true; setExplorationInstant(true); setExpanded(true);
  }

  function blurPlate(event) {
    if (surface.current.closest('[data-dissolving=true]') || event.relatedTarget?.closest('[data-interest-expand],[data-interest-reading],[data-interest-exploration-reading]')) return;
    focused.current = false;
    setExpanded(hovered.current && !hoverDismissed.current);
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
    const immediate = !visible || enteringStage || requested.instant || Boolean(reduced);
    if (!count || (!visible && shownRef.current.committed)) {
      railAnimation.current?.stop();
      drag.current = null;
      if (shownRef.current.committed) setLoadState(shownRef.current.src ? 'ready' : 'error');
      setInstant(true);
      setPhase('idle');
      return;
    }
    if (shownRef.current.committed && shownRef.current.src && shownRef.current.index === requested.index) {
      setLoadState('ready'); setInstant(immediate); setPhase('idle');
      return;
    }
    const target = section.items[requested.index];
    const timers = [];
    const frames = [];
    let cancelled = false;
    setInstant(immediate);
    setLoadState('loading');
    setPhase('idle');
    async function decode() {
      for (const src of [...new Set([sourceFor(target), target.image].filter(Boolean))]) {
        try {
          const image = new Image(); image.src = assetUrl(src);
          let timeout;
          try { await Promise.race([image.decode(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Image timeout')),8000);})]); }
          finally { clearTimeout(timeout); }
          return src;
        } catch {}
      }
      return null;
    }
    const commit = src => {
      if (cancelled) return;
      const nowInstant = immediate || Boolean(surface.current.closest('[data-dissolving=true]'));
      setInstant(nowInstant);
      setShown({ index: requested.index, src, committed: true });
      setLoadState(src ? 'ready' : 'error');
      surface.current.querySelectorAll('[data-interest-reading],[data-interest-exploration-reading]').forEach(node => { node.scrollTop = 0; });
      setPhase(nowInstant ? 'idle' : 'entering');
      if (!nowInstant) frames.push(requestAnimationFrame(() => {
        frames.push(requestAnimationFrame(() => { if (!cancelled) setPhase('idle'); }));
      }));
    };
    decode().then(src => {
      if (cancelled) return;
      if (immediate || surface.current.closest('[data-dissolving=true]')) { commit(src); return; }
      setPhase('exiting');
      timers.push(setTimeout(() => commit(src), 500));
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); frames.forEach(cancelAnimationFrame); };
  }, [requested, visible, reduced, section.items, count]);

  function centerRail(index, immediately) {
    railAnimation.current?.stop();
    let position = 2 - x.get() / step;
    let destination = Math.round((position - index) / count) * count + index;
    if (destination < 2) { position += count; destination += count; x.set(-(position - 2) * step); }
    if (destination > count * 3 - 3) { position -= count; destination -= count; x.set(-(position - 2) * step); }
    const normalized = -(count + index - 2) * step;
    if (immediately) { x.set(normalized); return; }
    railAnimation.current = animate(x, -(destination - 2) * step, { duration: .3, ease: [.25, .1, .25, 1], onComplete: () => x.set(normalized) });
  }

  function choose(value, keyboard = false) {
    if (!count) return;
    const index = modulo(value, count);
    const immediately = keyboard || Boolean(reduced);
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
    if (cancelled) centerRail(requestedRef.current.index, Boolean(reduced));
    else choose(Math.round(2 - x.get() / step));
  }

  return <div ref={surface} className={styles.interest} data-widget="interests" data-copy data-instant={instant} data-interest-expanded={expanded} data-exploration-instant={explorationInstant} data-requested-id={section.items[requested.index]?.id} data-shown-id={item?.id} data-interest-state={loadState} data-interest-phase={phase} onPointerMove={hoverPlate} onPointerLeave={leavePlate} onFocusCapture={focusPlate} onBlurCapture={blurPlate} onKeyDown={event => { if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); dismissPlate(true); } }} style={{ '--card-step': `${step}px` }}>
    <Heading id={`${section.id}-title`} className={styles.sectionTitle} data-reveal="0" data-reveal-kind="line">{section.title}</Heading>
    <div className={styles.backdrop} data-reveal="0" data-reveal-kind="ticket" data-reveal-phase="surface" data-interest-backdrop aria-hidden="true"><div className={styles.backdropWipe} data-interest-wipe><div className={styles.backdropFrame}><div key={item?.id} className={styles.backdropMotion}>{shown.src && <img src={assetUrl(shown.src)} alt="" data-visible="true" style={{ objectPosition: item.artwork?.backdrop?.position || '50% 0%', scale: item.artwork?.backdrop?.scale || 3.2 }}/>}</div></div></div></div>
    <button ref={expandButton} className={styles.expandButton} data-interest-expand aria-label={expanded ? '탐구 노트 닫기' : '탐구 노트 보기'} aria-expanded={expanded} aria-controls={`${section.id}-exploration-${item?.id}`} onClick={event => { if (expanded) dismissPlate(event.detail === 0); else { hoverDismissed.current = false; setExplorationInstant(event.detail === 0 || Boolean(reduced)); setExpanded(true); } }}><span className={styles.expandLabel} data-reveal="3">{expanded ? '탐구 노트 닫기' : '탐구 노트 보기'}</span><span data-reveal="3" aria-hidden="true">{expanded ? '×' : '↗'}</span></button>
    <div className={styles.copy} data-interest-column aria-busy={loadState === 'loading'}>
      {section.items.map((topic, index) => <article key={topic.id} className={styles.topic} role="tabpanel" id={`${section.id}-panel-${topic.id}`} aria-labelledby={`${section.id}-tab-${topic.id}`} hidden={index !== shown.index}>
        <h3 className={styles.name} data-reveal=".5" data-reveal-kind="title"><span data-interest-text="title">{topic.displayName || topic.label || topic.title}</span></h3>
        <div className={styles.metadata} data-reveal="1"><div data-interest-text="metadata"><p><span>관심 주제</span><strong>{topic.title}</strong></p><p><span>분야</span><strong>{topic.tags?.join(' · ') || topic.tag}</strong></p></div></div>
        <p className={styles.question} data-reveal="1.5" data-reveal-kind="record" data-reveal-phase="surface"><span data-reveal="1.5"><span data-interest-text="metadata">{topic.description}</span></span></p>
        <p className={styles.subtitle} data-reveal="1.5"><span data-interest-text="subtitle"><i aria-hidden="true">◆</i>{topic.title}</span></p>
        <div id={`${section.id}-reading-${topic.id}`} className={styles.reading} data-reveal="2" data-interest-reading data-scene-scroll tabIndex={0} aria-label={`${topic.displayName || topic.label || topic.title} 요약`}><p data-interest-text="body">{topic.summary || section.body}</p></div>
      </article>)}
    </div>
    <div ref={plate} className={styles.plate} data-reveal="0" data-reveal-kind="ticket" data-reveal-phase="surface" data-interest-plate>
      <div id={`${section.id}-illustration`} className={styles.illustration} aria-hidden="true"><div className={styles.illustrationMotion}>{shown.src && <img src={assetUrl(shown.src)} alt=""/>}</div></div>
      <div className={styles.patternTop} aria-hidden="true"/><div className={styles.patternBottom} aria-hidden="true"/><div className={styles.stamp} aria-hidden="true">✧</div><div className={styles.colorStripe} aria-hidden="true"/>
    </div>
    <div className={styles.extension}>
      {item && <div id={`${section.id}-exploration-${item.id}`} className={styles.explorationReading} data-interest-exploration-reading data-scene-scroll aria-label={`${item.displayName || item.label || item.title} 탐구 노트`} aria-hidden={!expanded} inert={!expanded} tabIndex={0}><div data-interest-text="body"><p className={styles.noteLabel}>탐구 노트</p><h4>{item.title}</h4><ExplorationNotes item={item}/></div></div>}
    </div>
    <figure className={styles.hero} data-reveal=".5" data-reveal-kind="diagonal" data-reveal-phase="surface" data-interest-hero data-art-src={shown.src || ''} data-art-state={loadState}><div className={styles.heroFrame}><div key={item?.id} className={styles.heroMotion}>
      {shown.src ? <img src={assetUrl(shown.src)} alt={item?.artwork?.alt || `${item?.title} 대표 이미지`} data-visible="true" style={{ objectPosition: item?.artwork?.hero?.position || '50% 0%', scale: item?.artwork?.hero?.scale || 1 }}/> : <span className={styles.fallback}>{loadState === 'error' ? '이미지를 불러오지 못했습니다.' : '이미지를 준비하고 있습니다.'}</span>}
    </div></div></figure>
    {count > 0 && <div className={styles.selector} data-reveal="3" data-reveal-kind="controls" data-reveal-phase="surface" data-interest-controls data-scene-gesture>
      <button className={`${styles.arrow} ${styles.previous}`} data-reveal="3" aria-label="이전 관심분야" onClick={event => choose(requestedRef.current.index - 1, event.detail === 0)}><svg viewBox="0 0 28 46" aria-hidden="true"><path d="M26 2 2 23l24 21Z"/></svg></button>
      <div ref={viewport} className={styles.cards} role="tablist" aria-label="관심분야 선택" onKeyDown={chooseKey} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)} onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}>
        <motion.div className={styles.track} data-interest-track data-selected-index={requested.index} style={{ x }}>
          {Array.from({ length: 3 }, (_, cycle) => section.items.map((topic, index) => {
            const thumbnail = topic.artwork?.thumbnail || sourceFor(topic);
            const content = <><span className={styles.thumb}>{thumbnail && <img src={assetUrl(thumbnail)} alt="" draggable="false" loading="lazy" style={{ objectPosition: topic.artwork?.card?.position || '50% 0%', scale: topic.artwork?.card?.scale || 3 }} onError={event => { event.currentTarget.style.opacity = '0'; }}/>}</span><span className={styles.label} data-reveal="3">{topic.displayName || topic.label || topic.title}</span></>;
            return cycle === 1 ? <button key={`${cycle}-${topic.id}`} id={`${section.id}-tab-${topic.id}`} className={styles.card} type="button" role="tab" data-topic-index={index} data-selected={index === requested.index} aria-controls={`${section.id}-panel-${topic.id}`} aria-selected={index === shown.index} tabIndex={index === shown.index ? 0 : -1} onClick={event => choose(index, event.detail === 0)}>{content}</button> : <span key={`${cycle}-${topic.id}`} className={styles.card} data-interest-clone data-selected={index === requested.index} aria-hidden="true" onClick={() => choose(index)}>{content}</span>;
          }))}
        </motion.div>
      </div>
      <button className={`${styles.arrow} ${styles.next}`} data-reveal="3" aria-label="다음 관심분야" onClick={event => choose(requestedRef.current.index + 1, event.detail === 0)}><svg viewBox="0 0 28 46" aria-hidden="true"><path d="m2 2 24 21L2 44Z"/></svg></button>
      <p className={styles.status} role="status">{loadState === 'error' ? '이미지를 불러오지 못했습니다. 설명은 계속 읽을 수 있습니다.' : ''}</p>
    </div>}
    <noscript><style>{'[data-widget=interests]{height:auto!important;min-height:100svh!important;overflow:visible!important;padding:110px 24px 60px!important}[data-interest-column],[data-interest-controls],[data-interest-hero],[data-interest-backdrop],[data-interest-plate],[data-interest-expand]{display:none!important}[data-interest-static]{display:block!important}'}</style><div className={styles.staticNotes} data-interest-static>{section.items.map(topic => <article key={topic.id}><h3>{topic.displayName || topic.title}</h3><h4>{topic.title}</h4><p>{topic.description}</p><p>{topic.summary || section.body}</p><p>{topic.tags?.join(' · ') || topic.tag}</p><ExplorationNotes item={topic}/></article>)}</div></noscript>
  </div>;
}
