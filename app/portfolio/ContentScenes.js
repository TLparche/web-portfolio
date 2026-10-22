'use client';

import { useState } from 'react';
import SceneArt, { ContentReveal, selectKey } from './SceneArt';
import { Tags } from './SectionContent';
import styles from './ContentScenes.module.css';

function ItemList({ section, selected, choose, className }) {
  return <div className={className} data-enter={section.kind === 'projects' ? 'left' : undefined} role="tablist" aria-orientation="vertical" aria-label={`${section.title} 선택`} onKeyDown={event => selectKey(event, selected, section.items.length, choose)}>
    {section.items.map((item, index) => <button key={item.id} type="button" role="tab" id={`${section.id}-tab-${item.id}`} aria-controls={`${section.id}-panel-${item.id}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={event => choose(index, event.detail === 0)}><span className={styles.listMark} aria-hidden="true">{section.kind === 'publications' ? '▤' : '↗'}</span><span><small>{item.label || (item.placeholder ? '준비 중' : '연구 기록')}</small><strong>{item.title}</strong></span></button>)}
  </div>;
}

function Facts({ item }) {
  return <dl className={styles.facts}>{[['기간', item.period || '기간 입력 예정'], ['역할', item.role], ['결과', item.result]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function ProjectPanel({ section, Heading, onDetail, onSelect }) {
  const [selected, setSelected] = useState(0);
  const [instant, setInstant] = useState(false);
  const item = section.items[selected] || section.items[0];
  function choose(index, keyboard = false) { setSelected(index); setInstant(keyboard); onSelect?.(section, section.items[index]); }
  return <div className={styles.projects} data-widget="projects" data-copy data-instant={instant}>
    <header className={styles.projectHeading} data-enter="title"><Heading id={`${section.id}-title`}>Selected works<span>프로젝트</span></Heading><p>{section.headline}</p></header>
    {!item ? <p className={styles.empty}>프로젝트 기록을 준비하고 있습니다.</p> : <>
      <ItemList section={section} selected={selected} choose={choose} className={styles.workList}/>
      <div className={styles.showcase} data-showcase>
        <SceneArt artwork={item.artwork} className={styles.poster} enter="poster" instant={instant}/>
        <span className={styles.posterLabel} aria-hidden="true">{item.label}</span>
        <div className={styles.ticket} data-enter="ticket">
          <ContentReveal value={item.id} instant={instant}>
            {section.items.map(work => <article key={work.id} role="tabpanel" id={`${section.id}-panel-${work.id}`} aria-labelledby={`${section.id}-tab-${work.id}`} hidden={work.id !== item.id} tabIndex={0}>
              <div className={styles.ticketTop}><span>{work.tag}</span><span>{String(selected + 1).padStart(2, '0')} / {String(section.items.length).padStart(2, '0')}</span></div>
              <h3>{work.title}</h3><p>{work.description}</p>{work.meta && <p className={styles.workMeta}>{work.meta}</p>}<Tags items={work.tags}/><Facts item={work}/>
              <button className={styles.openWork} onClick={event => onDetail(work, event.currentTarget, event.detail === 0)} aria-label={`${work.title} 상세 보기`}>작품 기록 열기 <span aria-hidden="true">↗</span></button>
            </article>)}
          </ContentReveal>
        </div>
      </div>
      <noscript><style>{'[data-copy]>noscript{display:contents}'}</style><StaticRecords section={section}/></noscript>
    </>}
  </div>;
}

export function PublicationPanel({ section, Heading, onDetail }) {
  const [selected, setSelected] = useState(0);
  const [instant, setInstant] = useState(false);
  const item = section.items[selected] || section.items[0];
  function choose(index, keyboard = false) { setSelected(index); setInstant(keyboard); }
  return <div className={styles.publications} data-widget="publications" data-copy data-instant={instant}>
    <aside className={styles.documentShelf} data-enter="left"><Heading id={`${section.id}-title`}>논문<span>Research<br/>{' '}journal.</span></Heading><p>{section.headline}</p><ItemList section={section} selected={selected} choose={choose} className={styles.documentList}/></aside>
    {!item ? <p className={styles.empty}>연구 기록을 준비하고 있습니다.</p> : <div className={styles.documentStage} data-enter="paper">
      <div className={styles.paperTab}>연구 기록</div>
      <div className={styles.document}>
        <ContentReveal value={item.id} instant={instant}>
          {section.items.map(paper => <article key={paper.id} role="tabpanel" id={`${section.id}-panel-${paper.id}`} aria-labelledby={`${section.id}-tab-${paper.id}`} hidden={paper.id !== item.id} tabIndex={0}>
            <div className={styles.documentTop}><span>{paper.tag || '준비 중'}</span><span>문서 {String(selected + 1).padStart(2, '0')}</span></div>
            <h3>{paper.title}</h3><p className={styles.authors}>{paper.meta}</p>
            <div className={styles.researchQuestion}><span>연구 질문</span><p>{paper.question || paper.description}</p></div>
            {paper.placeholder ? <div className={styles.blankPaper}><span aria-hidden="true">＋</span><p>{paper.description}</p></div> : <>
              <SceneArt artwork={paper.artwork} className={styles.researchArt} instant={instant}/>
              <div className={styles.documentFoot}><Tags items={paper.tags}/><button className={styles.readPaper} onClick={event => onDetail(paper, event.currentTarget, event.detail === 0)} aria-label={`${paper.title} 상세 보기`}>연구 기록 읽기 <span aria-hidden="true">↗</span></button></div>
            </>}
          </article>)}
        </ContentReveal>
      </div>
    </div>}
    <noscript><style>{'[data-copy]>noscript{display:contents}'}</style><StaticRecords section={section}/></noscript>
  </div>;
}

function Links({ items = [] }) {
  return items.some(item => item.url) && <nav className={styles.links} aria-label="관련 자료">{items.filter(item => item.url).map(item => <a key={item.url} href={item.url} target="_blank" rel="noreferrer">{item.label} ↗</a>)}</nav>;
}

function StaticRecords({ section }) {
  return <div className={styles.staticRecords}>{section.items.map(item => <article key={item.id}><h3>{item.title}</h3><p>{item.description}</p><p>{item.detail}</p>{item.detailSections?.map(part => <section key={part.title}><h4>{part.title}</h4><p>{part.body}</p></section>)}<Links items={item.links}/></article>)}</div>;
}

export function ProjectReading({ item }) {
  return <div className={styles.projectRecord} data-reading="project">
    <div className={styles.recordCover}><SceneArt artwork={item.artwork} className={styles.recordArt}/><span>{item.label}</span></div>
    <div className={styles.recordIntro}><span className={styles.recordType}>작품 기록</span><h2 id="detail-title">{item.title}</h2><p>{item.description}</p><Tags items={item.tags}/><Facts item={item}/></div>
    <div className={styles.recordBody}><p>{item.detail}</p>{item.bullets?.length > 0 && <ul>{item.bullets.map(text => <li key={text}>{text}</li>)}</ul>}<div className={styles.recordSteps}>{item.detailSections?.map(part => <section key={part.title}><h3>{part.title}</h3><p>{part.body}</p></section>)}</div><Links items={item.links}/></div>
  </div>;
}

export function PaperReading({ item }) {
  const parts = item.detailSections || [];
  return <div className={styles.paperReading} data-reading="paper">
    <nav className={styles.contents} aria-label="논문 목차"><strong>목차</strong>{parts.map((part, index) => <a key={part.title} href={`#paper-part-${item.id}-${index}`}>{part.title}</a>)}{item.links?.some(link => link.url) && <a href={`#paper-links-${item.id}`}>관련 자료</a>}</nav>
    <article className={styles.readingColumn}>
      <header><span className={styles.recordType}>{item.tag}</span><h2 id="detail-title">{item.title}</h2><p>{item.meta}</p><div className={styles.researchQuestion}><span>연구 질문</span><p>{item.question || item.description}</p></div></header>
      <SceneArt artwork={item.artwork} className={styles.paperReadingArt}/><p>{item.detail}</p><Tags items={item.tags}/>
      {item.bullets?.length > 0 && <ul>{item.bullets.map(text => <li key={text}>{text}</li>)}</ul>}
      {parts.map((part, index) => <section key={part.title} id={`paper-part-${item.id}-${index}`} tabIndex={-1}><h3>{part.title}</h3><p>{part.body}</p></section>)}
      <div id={`paper-links-${item.id}`}><Links items={item.links}/></div>
    </article>
  </div>;
}

