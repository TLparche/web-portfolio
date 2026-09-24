'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { assetUrl } from './config.mjs';
import { selectKey } from './SceneArt';
import { Tags } from './SectionContent';
import { useChapterSelection } from './ChapterGroup';
import styles from './WorkGallery.module.css';

const artwork = item => typeof item.artwork === 'string' ? { src: item.artwork } : item.artwork || (item.image ? { src: item.image } : {});
const records = section => section.showcaseItems ?? section.items ?? [];
const english = { projects: 'PROJECT', experience: 'EXPERIENCE', publications: 'RESEARCH', activities: 'ACTIVITY' };
const displayWord = { projects: 'PRO\nJECT', experience: 'EXPER\nIENCE', publications: 'RE\nSEARCH', activities: 'ACTI\nVITY' };
const ease = [.23, 1, .32, 1];
function imageError(event, item) {
  const image = event.currentTarget;
  if (item.image && image.dataset.fallback !== 'true' && item.image !== artwork(item).src) { image.dataset.fallback = 'true'; image.src = assetUrl(item.image); }
  else image.style.visibility = 'hidden';
}
// Six independent cuts measured against the reference's 1920 × 1080 composition.
const pieces = [
  { points: [[664,139],[804,139],[594,569],[454,569]], enter: 'translate(168px,-345px)', duration: .733, art: [240,140,880,1000] },
  { points: [[747,264],[836,370],[557,941],[418,941]], enter: 'translate(-166px,339px)', duration: .833, art: [230,430,900,960] },
  { points: [[987,71],[1076,178],[712,923],[625,816]], enter: 'translate(248px,-487px)', duration: .5, art: [455,220,920,1100] },
  { points: [[1044,252],[1186,252],[890,863],[747,863]], enter: 'translate(-166px,339px)', duration: .833, art: [525,510,820,1000] },
  { points: [[1146,344],[1233,453],[928,1080],[788,1080]], enter: 'translate(-170px,348.5px)', duration: .5, art: [630,430,950,1150] },
  { points: [[1338,252],[1478,252],[1168,885],[1081,780]], enter: 'translate(-166px,339px)', duration: .833, art: [965,365,700,850] },
];
const polygon = points => `polygon(${points.map(([x,y]) => `${x / 19.2}% ${y / 10.8}%`).join(',')})`;

function RecordText({ item }) {
  return <><p>{item.description}</p>
    {(item.period || item.role || item.result) && <dl className={styles.facts}>{[['기간',item.period],['역할',item.role],['기여',item.result]].filter(([,value]) => value).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {item.meta && <small>{item.meta}</small>}<Tags items={item.tags}/>
    {item.detail && <p>{item.detail}</p>}{item.bullets && <ul>{item.bullets.map(text => <li key={text}>{text}</li>)}</ul>}
    {item.detailSections?.map(part => <section key={part.title}><h4>{part.title}</h4><p>{part.body}</p></section>)}
    {item.links?.filter(link => link.url).map(link => <a key={link.url} href={link.url}>{link.label} ↗</a>)}
  </>;
}

function FeaturedList({ items, open, instant, reduced, onIntent, visible, returnFocus }) {
  const [preview, setPreview] = useState(null), [keyboard, setKeyboard] = useState(false);
  const current = useRef(null), lockedUntil = useRef(0), leaveTimer = useRef(null), restoring = useRef(false), rail = useRef(null);
  const present = useIsPresent(), immediate = instant || keyboard;
  useEffect(() => {
    if (returnFocus) { restoring.current = true; document.getElementById(returnFocus)?.focus({ preventScroll: true }); restoring.current = false; }
    return () => clearTimeout(leaveTimer.current);
  }, [returnFocus]);
  function expand(index, fromKeyboard = false) {
    clearTimeout(leaveTimer.current);
    onIntent(fromKeyboard); setKeyboard(fromKeyboard);
    if (current.current === index) return;
    current.current = index; lockedUntil.current = performance.now() + (reduced || fromKeyboard ? 0 : 500);
    setKeyboard(fromKeyboard); setPreview(index);
  }
  function leave() {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => { current.current = null; setPreview(null); }, instant ? 0 : 100);
  }
  function click(event, index) {
    if (event.detail === 0) { open(items[index], true, event.currentTarget.id); return; }
    if (current.current !== index) { expand(index); return; }
    if (performance.now() < lockedUntil.current) return;
    open(items[index], false, event.currentTarget.id);
  }
  function key(event) {
    const buttons = [...rail.current.querySelectorAll('[data-work-card]')], index = buttons.indexOf(document.activeElement);
    const next = { ArrowRight: (index + 1) % items.length, ArrowDown: (index + 1) % items.length, ArrowLeft: (index + items.length - 1) % items.length, ArrowUp: (index + items.length - 1) % items.length, Home: 0, End: items.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault(); expand(next, true); buttons[next]?.focus({ preventScroll: true });
    if (rail.current.scrollWidth > rail.current.clientWidth) buttons[next]?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }
  return <motion.div className={styles.listView} data-work-list data-instant={immediate} aria-hidden={!present} inert={!present} exit={{ opacity: 0 }} transition={{ duration: immediate ? 0 : .16 }}>
    <div ref={rail} className={styles.ribbons} role="list" aria-label="대표 작업 6개" onKeyDown={key}>
      {items.map((record, index) => {
        const piece = pieces[index % pieces.length], active = preview === index, art = artwork(record.item);
        const shift = preview !== null && index > preview ? 285 : 0;
        const expanded = polygon([[694 + index * 142,0],[1118 + index * 142,0],[632 + index * 142,1080],[207 + index * 142,1080]]);
        return <motion.div key={record.item.id} className={styles.ribbon} role="listitem" data-preview={active} data-piece={index + 1} initial={immediate || !visible ? false : { opacity: 0, transform: piece.enter }} animate={{ opacity: 1, transform: 'translate(0px,0px)' }} transition={{ transform: { duration: immediate ? 0 : piece.duration, delay: immediate ? 0 : (index + 1) / 15, ease }, opacity: { duration: immediate ? 0 : .3, delay: immediate ? 0 : (index + 1) / 15 } }}>
          <div className={styles.ribbonShift} style={{ transform: `translateX(${shift}px)` }}>
            <button id={`projects-work-${record.item.id}`} className={styles.card} data-work-card data-item-id={record.item.id} aria-label={`${record.item.title} 자세히 보기`} aria-expanded={active} aria-controls="projects-showcase-detail" style={{ clipPath: active ? expanded : polygon(piece.points) }} onPointerEnter={event => { if (event.pointerType === 'mouse' && matchMedia('(hover:hover) and (pointer:fine)').matches) expand(index); }} onPointerLeave={leave} onFocus={event => { if (!restoring.current && event.currentTarget.matches(':focus-visible')) expand(index, true); }} onBlur={event => { if (!rail.current?.contains(event.relatedTarget)) leave(); }} onClick={event => click(event, index)}>
              <span className={styles.stripSurface} data-dark={index % 2 === 0}/>
              {art.src && <img className={styles.stripArt} src={assetUrl(art.src)} alt="" loading="lazy" style={{ left: piece.art[0], top: piece.art[1], width: piece.art[2], height: piece.art[3] }} onError={event => imageError(event, record.item)}/>}
              <span className={styles.stripLabel} style={{ left: piece.points[3][0] + 65, top: piece.points[3][1] - 95 }}>{record.item.title}</span>
            </button>
            {art.src && <img className={styles.floatingArt} src={assetUrl(art.src)} alt="" aria-hidden="true" style={{ left: 50 + index * 142 }} onError={event => imageError(event, record.item)}/>}
            <span className={styles.caption} aria-hidden="true" style={{ left: 292 + index * 142 }}><strong>{record.item.title}</strong><small>{english[record.category.id]}</small><i aria-hidden="true">◇</i><span>더보기</span></span>
          </div>
        </motion.div>;
      })}
    </div>
  </motion.div>;
}

function DetailScene({ item, category, entry, instant }) {
  const present = useIsPresent(), art = artwork(item);
  return <motion.div className={styles.detailScene} data-work-detail-item={item.id} aria-hidden={!present} inert={!present} exit={{ opacity: 0 }} transition={{ duration: instant ? 0 : .167 }}>
    <motion.div className={styles.ghost} aria-hidden="true" initial={instant ? false : { opacity: 0, transform: entry ? 'translateX(-816px) scale(1.64)' : 'translateX(-120px)' }} animate={{ opacity: 1, transform: 'translateX(0px) scale(1)' }} transition={{ opacity: { duration: instant ? 0 : .333 }, transform: { duration: instant ? 0 : .633, delay: instant ? 0 : .033, ease } }}>{art.src && <img src={assetUrl(art.src)} alt="" onError={event => imageError(event, item)}/>}</motion.div>
    <motion.figure className={styles.detailArt} data-work-hero initial={instant ? false : { opacity: 0, transform: entry ? 'translate(-392px,-66px)' : 'translateY(310.8px)' }} animate={{ opacity: 1, transform: 'translate(0px,0px)' }} transition={{ opacity: { duration: instant ? 0 : entry ? .333 : .233 }, transform: { duration: instant ? 0 : entry ? .5 : .767, ease } }}>
      {art.src ? <img src={assetUrl(art.src)} alt={art.alt || `${item.title} 대표 이미지`} onError={event => imageError(event, item)}/> : <span>대표 이미지를 준비하고 있습니다.</span>}
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
        {items.map((work,index) => <button key={work.id} id={`projects-detail-${work.id}`} role="tab" data-work-thumbnail aria-label={work.title} aria-controls="projects-showcase-detail" aria-selected={index === selected} tabIndex={index === selected ? 0 : -1} onClick={event => select(index, event.detail === 0)}>{artwork(work).src && <img src={assetUrl(artwork(work).src)} alt="" loading="lazy" onError={event => imageError(event, work)}/>}<span>{String(index + 1).padStart(2,'0')}</span></button>)}
      </div></div>
      <div className={styles.pages} aria-label={`${category.title} 페이지`}>{items.map((work,index) => <button key={work.id} data-work-page aria-label={`${work.title} 페이지`} aria-pressed={index === selected} onClick={event => select(index, event.detail === 0)}/>)}</div>
    </motion.div></AnimatePresence>
  </motion.section>;
}

export default function WorkGallery({ section, Heading, chapter, visible = true }) {
  const state = useChapterSelection(section), reduced = useReducedMotion();
  const [view,setView] = useState('list'), [selected,setSelected] = useState(0), [instant,setInstant] = useState(false), [entry,setEntry] = useState(true), [scale,setScale] = useState(1), [returnFocus,setReturnFocus] = useState(null), [focusOnEntry,setFocusOnEntry] = useState(false);
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
    const measure = () => { const bounds = root.current.getBoundingClientRect(); setScale(Math.min(bounds.width / 1920, bounds.height / 1080)); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(root.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const read = () => {
      const index = state.chapters.findIndex(part => part.id === location.hash.slice(1));
      if (index < 0) return;
      setView(index === 0 ? 'list' : 'detail'); setSelected(0); setEntry(true); setInstant(false); setFocusOnEntry(false); setReturnFocus(null); origin.current = `projects-category-${state.chapters[index].id}`;
    };
    read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
  }, [section]);
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
  return <div ref={root} className={styles.works} data-copy data-widget="works" data-view={view} data-category={category.id} data-instant={immediate} data-visible={visible} style={{ '--scene-scale': scale, '--category-font': `${Math.max(20, 12 / Math.max(scale,.1))}px` }} onKeyDown={event => { if (event.key === 'Escape' && view === 'detail') { event.preventDefault(); event.stopPropagation(); back(true); } }}>
    <div className={styles.canvas}>
      <header className={styles.heading}><span>{chapter}</span><Heading id="projects-title">작업·경험</Heading></header>
      <div className={styles.categories} role="tablist" aria-label="작업·경험 분류" onKeyDown={event => selectKey(event, state.selected, state.chapters.length, chooseCategory)}>
        {state.chapters.map((part,index) => <button key={part.id} id={`projects-category-${part.id}`} role="tab" aria-controls="projects-showcase-detail" aria-selected={view === 'detail' && index === state.selected} tabIndex={index === state.selected ? 0 : -1} onClick={event => chooseCategory(index,event.detail === 0)}><i aria-hidden="true">◇</i><span>{part.title}</span><small>{english[part.id]}</small></button>)}
      </div>
      <AnimatePresence initial={false}>
        {view === 'list' ? <FeaturedList key="list" items={featured} open={open} instant={immediate} reduced={Boolean(reduced)} onIntent={setInstant} visible={visible} returnFocus={returnFocus}/> : <DetailView key="detail" category={category} selected={selected} select={select} back={back} instant={immediate} entry={entry} focusOnEntry={focusOnEntry} onSwipe={cycle}/>}
      </AnimatePresence>
      <span className={styles.signature} aria-hidden="true">Selected<br/>works</span>
    </div>
    <noscript><style>{'[data-widget=works]{height:auto!important;overflow:visible!important}[data-widget=works]>div:first-child{display:none!important}[data-work-static]{display:block!important}'}</style><div className={styles.staticRecords} data-work-static>{state.chapters.map(part => <section key={part.id} id={part.id === section.id ? undefined : part.id}><h2>{part.title}</h2>{records(part).map(work => <article key={work.id}><h3>{work.title}</h3><RecordText item={work}/></article>)}</section>)}</div></noscript>
  </div>;
}
