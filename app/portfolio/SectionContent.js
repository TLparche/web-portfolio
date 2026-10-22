'use client';

import { useState } from 'react';

import { assetUrl } from './config.mjs';
import SceneArt, { ContentReveal, selectKey } from './SceneArt';
import styles from './SectionContent.module.css';

export function Tags({ items = [] }) {
  return items.length > 0 && <ul className={styles.tags} aria-label="관련 분야와 도구">{items.map((tag) => <li key={tag}>{tag}</li>)}</ul>;
}

function ActivityBody({item}) {
  return <div className={styles.activityBody}><p>{item.detail || '담당한 역할과 활동 과정, 배운 점을 작성할 공간입니다.'}</p>{item.role&&<p>역할: {item.role}</p>}{item.result&&<p>기여: {item.result}</p>}{item.bullets&&<ul>{item.bullets.map(text=><li key={text}>{text}</li>)}</ul>}{item.links?.filter(link=>link.url).map(link=><a key={link.url} href={link.url}>{link.label} ↗</a>)}</div>;
}

function Activities({section, onSelect, item: controlledItem, onChange, instant: controlledInstant, reading = false, inline = false}) {
  const [selected, setSelected] = useState(0);
  const [instant, setInstant] = useState(false);
  const index = reading ? Math.max(0, section.items.findIndex(item=>item.id===controlledItem?.id)) : selected;
  const current = section.items[index] || section.items[0];
  const immediate = reading ? controlledInstant : instant;
  const prefix = inline ? `${section.id}-inline` : reading ? `${section.id}-reading` : section.id;
  function choose(index, keyboard = false) {
    if (reading) onChange(section.items[index], keyboard);
    else { setSelected(index); setInstant(keyboard); onSelect?.(section, section.items[index]); }
  }
  if (!current) return <p className={styles.placeholder}>활동 기록을 준비하고 있습니다.</p>;
  return <div className={`${styles.selection} ${reading?styles.activityReading:''}`} data-widget="activities" data-inline={inline} data-instant={immediate}>
    <div className={styles.tabs} data-enter="left" role="tablist" aria-label="활동 선택" onKeyDown={event => selectKey(event, index, section.items.length, choose)}>
      {section.items.map((item, index) => <button key={item.id} role="tab" id={`${prefix}-tab-${item.id}`} aria-controls={`${prefix}-panel-${item.id}`} aria-selected={item === current} tabIndex={item === current ? 0 : -1} onClick={event => choose(index, event.detail === 0)}><span><small>{String(index + 1).padStart(2, '0')}</small>{item.label || item.title}</span></button>)}
    </div>
    <div className={styles.projectStage} data-enter="diagonal-right">
      <ContentReveal value={current.id} instant={immediate}>
        {section.items.map((item, index) => <div key={item.id} role="tabpanel" id={`${prefix}-panel-${item.id}`} aria-labelledby={`${prefix}-tab-${item.id}`} hidden={item !== current} tabIndex={0}>
          <article className={styles.project}><div className={styles.kicker}><span>{item.tag || '활동 기록'}</span><span>{String(index + 1).padStart(2, '0')} / {String(section.items.length).padStart(2, '0')}</span></div>{reading&&item===current?(inline?<h3 id={`${prefix}-title`}>{item.title}</h3>:<h2 id="detail-title">{item.title}</h2>):<h4>{item.title}</h4>}<p className={styles.meta}>{[item.period,item.meta].filter(Boolean).join(' · ')}</p><p className={styles.description}>{item.description}</p><Tags items={item.tags}/>
            {reading?<ActivityBody item={item}/>:<details className={styles.activity} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary').focus(); } }}><summary className={styles.textButton}>활동 기록 <span aria-hidden="true">＋</span></summary><ActivityBody item={item}/></details>}
          </article>
        </div>)}
      </ContentReveal>
      <div className={styles.projectPreview}><SceneArt artwork={current.artwork || (current.image ? { src: current.image, alt: `${current.title} 이미지` } : undefined)} instant={immediate}/><div className={styles.previewCaption}><span>{current.label || current.tag || current.title}</span><span>{current.period}</span></div></div>
    </div>
    <div className={styles.thumbnails} data-enter="ticket" aria-label="활동 썸네일" style={{ gridTemplateColumns: `repeat(${section.items.length}, minmax(0, 1fr))` }}>
      {section.items.map((item, index) => <button key={item.id} aria-label={`${item.title} 선택`} aria-pressed={item === current} onClick={event => choose(index, event.detail === 0)}>{(item.artwork?.src||item.image)&&<img src={assetUrl(item.artwork?.src||item.image)} alt="" width="160" height="90" loading="lazy"/>}<span>{String(index + 1).padStart(2, '0')}</span></button>)}
    </div>
    <noscript><div className={styles.staticItems}>{section.items.map(item => <article key={item.id}><h4>{item.title}</h4><p>{item.period}</p><p>{item.description}</p><p>{item.detail}</p>{item.links?.filter(link => link.url).map(link => <a key={link.url} href={link.url}>{link.label}</a>)}</article>)}</div></noscript>
  </div>;
}

export function ActivityReading({section,item,onChange,instant,inline=false}) {
  return <Activities section={section} item={item} onChange={onChange} instant={instant} inline={inline} reading/>;
}

/** The content widgets have no dependency on scene order or scroll state. */
export default function SectionContent({ section, onSelect, profile }) {
  switch (section.kind) {
    case 'intro':
      return <dl className={styles.facts}>{section.facts?.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>;

    case 'activities':
      return <Activities section={section} onSelect={onSelect}/>;
    default:
      return null;
  }
}


