'use client';
import { lockPageScroll } from './scroll-lock.mjs';

import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { assetUrl } from './config.mjs';
import { selectKey } from './SceneArt';
import { DetailFigure, Tags } from './SectionContent';
import { useChapterSelection } from './ChapterGroup';
import { InitialChapterAnchorContext } from './ScrollPanel';
import { pieces, galleryLayout } from './work-gallery-layout.mjs';
import styles from './WorkGallery.module.css';

const artwork = item => typeof item.artwork === 'string' ? { src: item.artwork } : item.artwork || (item.image ? { src: item.image } : {});
const records = section => section.showcaseItems ?? section.items ?? [];
const english = { projects: 'PROJECT', experience: 'EXPERIENCE', publications: 'RESEARCH', activities: 'ACTIVITY' };
const displayWord = { projects: 'PRO\nJECT', experience: 'EXPER\nIENCE', publications: 'RE\nSEARCH', activities: 'ACTI\nVITY' };
const ease = [.23, 1, .32, 1];
const polygon = points => `polygon(${points.map(([x,y]) => `${x / 19.2}% ${y / 10.8}%`).join(',')})`;
function imageError(event, item, fallback = item.image) {
  const image = event.currentTarget;
  if (fallback && image.dataset.fallback !== 'true' && image.getAttribute('src') !== assetUrl(fallback)) { image.dataset.fallback = 'true'; image.src = assetUrl(fallback); }
  else image.style.visibility = 'hidden';
}

function RecordText({ item }) {
  return <><p>{item.description}</p>
    {(item.period || item.role || item.result) && <dl className={styles.facts}>{[['기간',item.period],['역할',item.role],['기여',item.result]].filter(([,value]) => value).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {item.meta && <small>{item.meta}</small>}<Tags items={item.tags}/>
    {item.detail && <p>{item.detail}</p>}{item.bullets && <ul>{item.bullets.map(text => <li key={text}>{text}</li>)}</ul>}
    {item.detailSections?.map(part => <section key={part.title}><h4>{part.title}</h4><p>{part.body}</p><DetailFigure part={part}/></section>)}
    {item.links?.filter(link => link.url).map(link => <a key={link.url} href={link.url.startsWith('/') ? assetUrl(link.url) : link.url} target={/^https?:/.test(link.url) ? '_blank' : undefined} rel="noreferrer">{link.label} ↗</a>)}
  </>;
}

function FeaturedList({ items, open, instant, onIntent, returnFocus }) {
  const [preview, setPreview] = useState(null), [keyboard, setKeyboard] = useState(false), [scale, setScale] = useState(1), [switching, setSwitching] = useState(false);
  const current = useRef(null), leaveTimer = useRef(null), restoring = useRef(false), rail = useRef(null);
  const present = useIsPresent(), immediate = instant || keyboard, layout = galleryLayout(preview);
  useLayoutEffect(() => {
    const node = rail.current.parentElement;
    const measure = () => setScale(Math.min(node.clientWidth / 1920, node.clientHeight / 1080));
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (returnFocus) { restoring.current = true; document.getElementById(returnFocus)?.focus({ preventScroll: true }); restoring.current = false; }
    return () => clearTimeout(leaveTimer.current);
  }, [returnFocus]);
  function expand(index, fromKeyboard = false) {
    clearTimeout(leaveTimer.current);
    if (current.current === index && keyboard === fromKeyboard) return;
    onIntent(fromKeyboard); setKeyboard(fromKeyboard);
    setSwitching(current.current !== null);
    current.current = index;
    setPreview(index);
  }
  function leave() {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      if (rail.current?.closest('[data-dissolving=true]')) return;
      current.current = null; setPreview(null);
    }, instant ? 0 : 100);
  }
  function click(event, index) {
    if (event.detail !== 0 && current.current !== index) { expand(index); return; }
    open(items[index], event.detail === 0, event.currentTarget.id);
  }
  function key(event) {
    const buttons = [...rail.current.querySelectorAll('[data-work-card]')], index = buttons.indexOf(document.activeElement);
    const next = { ArrowRight: (index + 1) % items.length, ArrowDown: (index + 1) % items.length, ArrowLeft: (index + items.length - 1) % items.length, ArrowUp: (index + items.length - 1) % items.length, Home: 0, End: items.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault(); expand(next, true); buttons[next]?.focus({ preventScroll: true });
    if (rail.current.scrollWidth > rail.current.clientWidth) buttons[next]?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }
  return <motion.div className={styles.listView} data-work-list data-instant={immediate} data-switching={switching} aria-hidden={!present} inert={!present} exit={{ opacity: 0 }} transition={{ duration: immediate ? 0 : .16 }} onPointerEnter={() => clearTimeout(leaveTimer.current)} onPointerMove={() => clearTimeout(leaveTimer.current)} onPointerLeave={event => { if (event.pointerType === 'mouse') leave(); }}>
    <div ref={rail} className={styles.ribbons} role="list" aria-label="대표 작업 6개" onKeyDown={key} style={{ transform:`translate(-50%,-50%) scale(${scale}) translateX(${layout.offset}px)` }}>
      {items.map((record, index) => {
        const active = preview === index, art = artwork(record.item);
        const points = pieces[index % pieces.length];
        const placement = active ? layout : galleryLayout(index);
        return <div key={record.item.id} className={styles.ribbon} role="listitem" data-preview={active} data-reveal={.5 + index * .55} data-reveal-kind={index % 2 ? 'ribbon-down' : 'ribbon-up'} data-reveal-phase="surface">
          <div className={styles.ribbonShift} style={{ transform:`translateX(${layout.shifts[index]}px)` }}>
            <button id={`projects-work-${record.item.id}`} className={styles.card} data-work-card data-item-id={record.item.id} aria-label={`${record.item.title} 자세히 보기`} aria-expanded={active} aria-controls={`projects-preview-${record.item.id}`} style={{ clipPath:polygon(active ? layout.expanded : points) }} onPointerMove={event => { if (event.pointerType === 'mouse' && matchMedia('(hover:hover) and (pointer:fine)').matches) expand(index); }} onFocus={event => { if (!restoring.current && event.currentTarget.matches(':focus-visible')) expand(index, true); }} onBlur={event => { if (keyboard && !rail.current?.contains(event.relatedTarget)) leave(); }} onClick={event => click(event, index)}>
              <span className={styles.stripSurface} aria-hidden="true"/>
              {art.src && <img className={styles.stripArt} src={assetUrl(art.thumbnail || art.src)} alt="" loading="lazy" style={{ left:Math.min(...points.map(point=>point[0])),top:Math.min(...points.map(point=>point[1])),width:Math.max(...points.map(point=>point[0]))-Math.min(...points.map(point=>point[0])),height:Math.max(...points.map(point=>point[1]))-Math.min(...points.map(point=>point[1])),objectPosition:art.card?.position || '50% 50%' }} onError={event => imageError(event, record.item, art.src)}/>}
              <span className={styles.stripLabel} data-reveal={.5 + index * .55} style={{left:points[3][0] + 40,top:points[3][1] - 95}}>{record.item.label || record.item.title}</span>
              <span id={`projects-preview-${record.item.id}`} className={styles.preview} aria-hidden={!active}>
                {art.src && <img className={styles.previewArt} src={assetUrl(art.src)} alt="" loading="lazy" style={{left:placement.artLeft}} onError={event => imageError(event, record.item)}/>}
                <span className={styles.caption} style={{left:placement.captionLeft}}><small>{String(index + 1).padStart(2,'0')} / {english[record.category.id]}</small><strong>{record.item.title}</strong><span className={styles.previewResult}>{record.item.result || record.item.description}</span><span className={styles.previewAction}>상세 기록 보기 ↗</span></span>
              </span>
            </button>
          </div>
        </div>;
      })}
    </div>
  </motion.div>;
}

function DetailScene({ item, category, entry, instant }) {
  const present = useIsPresent(), art = artwork(item);
  const fullImage = item.detailSections?.find(part => part.image)?.image || art.src;
  return <motion.div className={styles.detailScene} data-work-detail-item={item.id} aria-hidden={!present} inert={!present} exit={{ opacity: 0 }} transition={{ duration: instant ? 0 : .167 }}>
    <motion.div className={styles.ghost} aria-hidden="true" initial={instant ? false : { opacity: 0, transform: entry ? 'translateX(-816px) scale(1.64)' : 'translateX(-120px)' }} animate={{ opacity: 1, transform: 'translateX(0px) scale(1)' }} transition={{ opacity: { duration: instant ? 0 : .333 }, transform: { duration: instant ? 0 : .633, delay: instant ? 0 : .033, ease } }}>{art.src && <img src={assetUrl(art.src)} alt="" onError={event => imageError(event, item)}/>}</motion.div>
    <motion.figure className={styles.detailArt} data-work-hero initial={instant ? false : { opacity: 0, transform: entry ? 'translate(-392px,-66px)' : 'translateY(310.8px)' }} animate={{ opacity: 1, transform: 'translate(0px,0px)' }} transition={{ opacity: { duration: instant ? 0 : entry ? .333 : .233 }, transform: { duration: instant ? 0 : entry ? .5 : .767, ease } }}>
      {art.src ? <a className={styles.artLink} href={assetUrl(fullImage)} target="_blank" rel="noreferrer" aria-label={`${item.label || item.title} 자료 크게 보기 (새 탭)`}><img src={assetUrl(art.src)} alt={art.alt || `${item.title} 대표 이미지`} style={{ objectPosition: art.hero?.position || '50% 50%' }} onError={event => imageError(event, item)}/><span>자료 크게 보기 ↗</span></a> : <span>본문에서 작업 기록을 확인해 주세요.</span>}
    </motion.figure>
    <motion.div className={styles.detailCopy} initial={instant ? false : { opacity: 0, transform: entry ? 'translateX(-296px)' : 'translateX(-179px)' }} animate={{ opacity: 1, transform: 'translateX(0px)' }} transition={{ opacity: { duration: instant ? 0 : entry ? .333 : .37, delay: instant ? 0 : entry ? .033 : .1 }, transform: { duration: instant ? 0 : entry ? .7 : .67, delay: instant ? 0 : .033, ease } }}>
      <span className={styles.word} aria-hidden="true">{displayWord[category.id]}</span>
      <h3 id={`${item.id}-showcase-title`}>{item.title}</h3>
      <article className={styles.detailText} data-scene-scroll tabIndex={0} aria-label={`${item.title} 설명`}><RecordText item={item}/></article>
    </motion.div>
  </motion.div>;
}

function DetailView({ category, selected, select, back, instant, entry, focusOnEntry, onSwipe }) {
  const items = records(category), item = items[selected] || items[0], present = useIsPresent();
  const node = useRef(null), touch = useRef(null);
  useEffect(() => { if (focusOnEntry) node.current?.focus({ preventScroll: true }); }, [focusOnEntry]);
  if (!item) return null;
  return <motion.section ref={node} id="projects-showcase-detail" className={styles.detail} data-work-detail data-work-detail-active={present} data-scene-gesture data-item-id={item.id} data-selected-index={selected} aria-labelledby={`${item.id}-showcase-title`} aria-hidden={!present} inert={!present} tabIndex={-1} exit={{ opacity: 0 }} transition={{ duration: instant ? 0 : .16 }} onPointerDown={event => { if (event.pointerType !== 'mouse' && !event.target.closest('[data-scene-scroll]')) touch.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={event => { const start = touch.current; touch.current = null; if (start && Math.abs(event.clientX - start.x) > 45 && Math.abs(event.clientX - start.x) > Math.abs(event.clientY - start.y) * 1.2) onSwipe(event.clientX < start.x ? 1 : -1); }} onPointerCancel={() => { touch.current = null; }}>
    <motion.div className={styles.detailSlab} aria-hidden="true" initial={instant ? false : { transform: 'translateX(-68.5px)' }} animate={{ transform: 'translateX(0px)' }} transition={{ duration: instant ? 0 : .667, ease }}/>
    <AnimatePresence><DetailScene key={item.id} item={item} category={category} entry={entry} instant={instant}/></AnimatePresence>
    <button className={styles.back} data-work-back onClick={event => back(event.detail === 0)}><span aria-hidden="true">‹</span> 돌아가기</button>
    <AnimatePresence><motion.div key={category.id} className={styles.thumbnailArea} data-work-thumbnails initial={instant ? false : { opacity: 0, transform: 'translateX(587px)' }} animate={{ opacity: 1, transform: 'translateX(0px)' }} exit={{ opacity: 0 }} transition={{ opacity: { duration: instant ? 0 : .2, delay: instant ? 0 : .067 }, transform: { duration: instant ? 0 : entry ? .467 : .667, delay: instant ? 0 : .033, ease } }}>
      <div className={styles.thumbnailHeading}><span>{category.title}</span><span>{String(selected + 1).padStart(2,'0')} / {String(items.length).padStart(2,'0')}</span></div>
      <div className={styles.thumbnailWindow}><div className={styles.thumbnails} data-work-thumbnail-track data-offset={Math.min(selected, Math.max(0, items.length - 2))} role="tablist" aria-label={`${category.title} 상세 항목`} style={{ transform: `translateX(calc(var(--thumb-step) * -${Math.min(selected, Math.max(0, items.length - 2))}))` }} onKeyDown={event => selectKey(event, selected, items.length, select)}>
        {items.map((work,index) => <button key={work.id} id={`projects-detail-${work.id}`} role="tab" data-work-thumbnail aria-label={work.title} aria-controls="projects-showcase-detail" aria-selected={index === selected} tabIndex={index === selected ? 0 : -1} onClick={event => select(index, event.detail === 0)}>{artwork(work).src && <img src={assetUrl(artwork(work).src)} alt="" loading="lazy" onError={event => imageError(event, work)}/>}<span>{String(index + 1).padStart(2,'0')}</span><strong>{work.label || work.title}</strong></button>)}
      </div></div>
      <div className={styles.pages} aria-label={`${category.title} 페이지`}>{items.map((work,index) => <button key={work.id} data-work-page aria-label={`${work.title} 페이지`} aria-pressed={index === selected} onClick={event => select(index, event.detail === 0)}/>)}</div>
    </motion.div></AnimatePresence>
  </motion.section>;
}

export default function WorkGallery({ section, Heading, chapter, visible = true }) {
  const restoreAnchor = useContext(InitialChapterAnchorContext);
  const state = useChapterSelection(section), reduced = useReducedMotion();
  const [view,setView] = useState('list'), [selected,setSelected] = useState(0), [instant,setInstant] = useState(false), [entry,setEntry] = useState(true), [returnFocus,setReturnFocus] = useState(null), [focusOnEntry,setFocusOnEntry] = useState(false);
  const root = useRef(null), origin = useRef(null), categoryTime = useRef(-Infinity), wheelTime = useRef(-Infinity), interaction = useRef(null);
  const category = state.chapters[state.selected] || state.chapters[0], items = records(category);
  const all = state.chapters.flatMap(part => records(part).map(item => ({ item, category: part })));
  const featured = (section.featuredItemIds || state.chapters[0].featuredItemIds || all.slice(0,6).map(record => record.item.id)).map(id => all.find(record => record.item.id === id)).filter(Boolean).slice(0,6);
  const immediate = instant || Boolean(reduced);
  function select(index, keyboard = false) { if (!items.length) return; setSelected((index + items.length) % items.length); setEntry(false); setInstant(keyboard); }
  function open(record, keyboard = false, source) {
    state.choose(state.chapters.findIndex(part => part.id === record.category.id), keyboard);
    setSelected(records(record.category).findIndex(item => item.id === record.item.id)); setView('detail'); setEntry(true); setInstant(keyboard); setReturnFocus(null); setFocusOnEntry(true); origin.current = source;
  }
  function chooseCategory(index, keyboard = false) {
    if (!keyboard && !reduced && performance.now() - categoryTime.current < 700) return;
    categoryTime.current = performance.now();
    origin.current = `projects-category-${state.chapters[index].id}`; state.choose(index, keyboard); setSelected(0); setEntry(view !== 'detail'); setView('detail'); setInstant(keyboard); setReturnFocus(null); setFocusOnEntry(false);
  }
  function back(keyboard = false) { setReturnFocus(origin.current); state.choose(0, keyboard); setView('list'); setInstant(keyboard); setEntry(true); setFocusOnEntry(false); }
  function cycle(direction) { if (performance.now() - wheelTime.current < 500) return; wheelTime.current = performance.now(); select(selected + direction); }
  interaction.current = { view, visible, cycle };
  useEffect(() => {
    if (view !== 'detail' || !visible) return;
    const releaseScroll = lockPageScroll(document);
    const stopTouch = event => {
      if (!event.target.closest('[data-scene-scroll]')) event.preventDefault();
    };
    const key = event => {
      if (['PageDown','PageUp','Home','End',' '].includes(event.key) && !event.target.closest('button,[data-scene-scroll]')) event.preventDefault();
    };
    const node = root.current;
    node.addEventListener('touchmove',stopTouch,{passive:false}); window.addEventListener('keydown',key);
    return () => { releaseScroll(); node.removeEventListener('touchmove',stopTouch); window.removeEventListener('keydown',key); };
  }, [view,visible]);
  useEffect(() => {
    const read = () => {
      const index = state.chapters.findIndex(part => part.id === location.hash.slice(1));
      if (index < 0) return;
      setView(index === 0 ? 'list' : 'detail'); setSelected(0); setEntry(true); setInstant(false); setFocusOnEntry(false); setReturnFocus(null); origin.current = `projects-category-${state.chapters[index].id}`;
    };
    if (restoreAnchor) read();
    window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
  }, [section,restoreAnchor]);
  useEffect(() => {
    const node = root.current;
    const wheel = event => {
      const current = interaction.current;
      if (!current.visible || current.view !== 'detail' || event.ctrlKey) return;
      event.stopPropagation();
      const reading = event.target.closest?.('[data-scene-scroll]');
      if (reading) return;
      event.preventDefault();
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(delta) > 4) current.cycle(Math.sign(delta));
    };
    node.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => node.removeEventListener('wheel', wheel, true);
  }, []);
  return <div ref={root} className={styles.works} data-copy data-widget="works" data-view={view} data-category={category.id} data-instant={immediate} data-visible={visible} onKeyDown={event => { if (event.key === 'Escape' && view === 'detail') { event.preventDefault(); event.stopPropagation(); back(true); } }}>
    <div className={styles.canvas}>
      <header className={styles.heading} data-reveal="0" data-reveal-kind="ticket" data-reveal-phase="surface"><span data-reveal="0">{chapter}</span><Heading id="projects-title" data-reveal="0" data-reveal-kind="title">작업·경험</Heading></header>
      <div className={styles.categories} data-reveal="3.5" data-reveal-kind="controls" role="tablist" aria-label="작업·경험 분류" onKeyDown={event => selectKey(event, state.selected, state.chapters.length, chooseCategory)}>
        {state.chapters.map((part,index) => <button key={part.id} id={`projects-category-${part.id}`} role="tab" aria-controls="projects-showcase-detail" aria-selected={view === 'detail' && index === state.selected} tabIndex={index === state.selected ? 0 : -1} onClick={event => chooseCategory(index,event.detail === 0)}><i aria-hidden="true">◇</i><span>{part.title}</span><small>{english[part.id]}</small></button>)}
      </div>
      <AnimatePresence initial={false}>
        {view === 'list' ? <FeaturedList key="list" items={featured} open={open} instant={immediate} onIntent={setInstant} returnFocus={returnFocus}/> : <DetailView key="detail" category={category} selected={selected} select={select} back={back} instant={immediate} entry={entry} focusOnEntry={focusOnEntry} onSwipe={cycle}/>}
      </AnimatePresence>
      <span className={styles.signature} aria-hidden="true">Selected<br/>works</span>
    </div>
    <noscript><style>{'[data-widget=works]{height:auto!important;overflow:visible!important}[data-widget=works]>div:first-child{display:none!important}[data-work-static]{display:block!important}'}</style><div className={styles.staticRecords} data-work-static>{state.chapters.map(part => <section key={part.id} id={part.id === section.id ? undefined : part.id}><h2>{part.title}</h2>{records(part).map(work => <article key={work.id}><h3>{work.title}</h3><RecordText item={work}/></article>)}</section>)}</div></noscript>
  </div>;
}
