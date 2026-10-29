'use client';

import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { assetUrl } from './config.mjs';
import { InitialChapterAnchorContext } from './ScrollPanel';
import { lockPageScroll } from './scroll-lock.mjs';
import { catalogItems, workDomains, platformCategories, filterWorks, workCover } from './work-catalog.mjs';
import { selectKey } from './SceneArt';
import WorkShowcase from './WorkShowcase';
import DomainGallery from './DomainGallery';
import styles from './WorkGallery.module.css';

export default function WorkGallery({ section, Heading, chapter, visible = true }) {
  const restoreAnchor = useContext(InitialChapterAnchorContext);
  const chapters = section.chapters || [section], all = catalogItems(chapters);
  const [domain, setDomain] = useState(''), [category, setCategory] = useState(''), [selected, setSelected] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const root = useRef(null), reader = useRef(null);
  const view = domain ? 'gallery' : 'domains';
  const listed = filterWorks(all, { domain, category });
  const item = listed.find(work => work.id === selected) || listed[0];
  const index = listed.indexOf(item);
  const field = workDomains.find(work => work.id === domain);
  const heading = field?.title;

  useEffect(() => {
    const read = () => {
      const id = location.hash.slice(1);
      if (!chapters.some(part => part.id === id)) return;
      setDomain(''); setCategory(''); setSelected(null);
    };
    if (restoreAnchor) read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [section, restoreAnchor]);

  useEffect(() => {
    if (view === 'domains' || !visible) return;
    const release = lockPageScroll(document);
    const wheel = event => { if (!event.ctrlKey) event.stopPropagation(); };
    const node = root.current;
    node.addEventListener('wheel', wheel, { passive: true });
    return () => { release(); node.removeEventListener('wheel', wheel); };
  }, [view, visible]);

  useLayoutEffect(() => {
    reader.current?.scrollTo(0, 0);
    if (domain && item) document.getElementById('work-open-' + item.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    if (focusId) { if (!focusId.startsWith('work-domain-')) document.getElementById(focusId)?.focus({ preventScroll: true }); setFocusId(null); }
  }, [item?.id, domain, category]);

  function chooseDomain(id) {
    setDomain(id); setCategory(''); setSelected(null); setFocusId('work-summary-title');
    history.replaceState(null, '', '#projects');
  }
  function chooseWork(index) { setSelected(listed[index].id); if (index === 0 || index === listed.length - 1) setFocusId('work-open-' + listed[index].id); }
  function back() {
    setDomain(''); setCategory(''); setSelected(null); setFocusId('work-domain-' + domain);
  }
  return <div ref={root} className={styles.works} data-copy data-widget="works" data-view={view} data-category={domain} data-visible={visible} data-scene-gesture={view !== 'domains' || undefined} onKeyDown={event => { if (event.key === 'Escape' && view !== 'domains') { event.preventDefault(); event.stopPropagation(); back(); } }}>
    <header className={styles.heading} data-reveal="0" data-reveal-kind="ticket"><span>{chapter}</span><Heading id="projects-title" tabIndex={-1}>{section.title}</Heading></header>
    {view === 'domains' && <a className={styles.entryAllWorks} href={assetUrl('/works/')}>전체 경험 목록</a>}
    {view === 'domains' ? <div className={styles.content}><DomainGallery items={all} onOpen={chooseDomain} returnFocus={focusId}/></div> : <>
      <div className={styles.breadcrumb}>
        <button data-work-back onClick={back}>← 분야 선택으로</button>
        {domain === 'platform' && <div className={styles.filters} aria-label="플랫폼·도구 분류">{[{ id: '', title: '모두' }, ...platformCategories].map(part => <button key={part.id} aria-pressed={category === part.id} onClick={() => { setCategory(part.id); setSelected(null); }}>{part.title}</button>)}</div>}
        <label><span className={styles.srOnly}>분야 변경</span><select value={domain} onChange={event => chooseDomain(event.target.value)}>{workDomains.map(field => <option key={field.id} value={field.id}>{field.title}</option>)}</select></label>
        <a href={assetUrl('/works/')}>전체 경험 목록</a>
      </div>
      <div ref={reader} id="work-display" className={styles.content} data-scene-scroll role={item ? 'tabpanel' : undefined} aria-labelledby={item ? 'work-open-' + item.id : undefined} aria-label={item ? undefined : '경험 탐색'} data-work-detail-active={visible}>
        {item ? <WorkShowcase key={item.id} item={item} onSectionChange={() => reader.current?.scrollTo(0, 0)}/> : <p>아직 등록된 기록이 없습니다. 다른 분류를 살펴보세요.</p>}
      </div>
      {item && <footer className={styles.filmstrip}>
        <div className={styles.stripHeading}><span>{heading}<small>다른 기록 살펴보기 · <span aria-live="polite">{index + 1} / {listed.length}</span></small></span><div className={styles.recordControls}><button aria-label="이전 기록" disabled={index === 0} onClick={() => chooseWork(index - 1)}>←</button><button aria-label="다음 기록" disabled={index === listed.length - 1} onClick={() => chooseWork(index + 1)}>→</button></div></div>
        <div className={styles.recordList} role="tablist" aria-label="분야 기록 선택" onKeyDown={event => selectKey(event, index, listed.length, chooseWork)}>
          {listed.map(work => {
            const cover = workCover(work), active = item.id === work.id;
            return <button key={work.id} id={'work-open-' + work.id} className={styles.record} role="tab" aria-controls="work-display" aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => setSelected(work.id)}>
              <span className={styles.recordImage}>{cover?.src && <img src={assetUrl(cover.thumbnail || cover.src)} alt="" loading="lazy" decoding="async"/>}</span><span className={styles.recordTitle}>{work.title}</span>
            </button>;
          })}
        </div>
      </footer>}
    </>}
    <noscript><style>{'[data-widget=works]{height:auto!important;min-height:60vh!important}[data-widget=works]>header,[data-widget=works]>a,[data-widget=works]>nav,[data-widget=works]>div{display:none!important}'}</style><p className={styles.noScript}><a href={assetUrl('/works/')}>전체 경험 목록에서 프로젝트·연구·활동을 읽을 수 있습니다.</a></p></noscript>
  </div>;
}
