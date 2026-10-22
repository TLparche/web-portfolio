'use client';

import { useState } from 'react';
import { ContentReveal } from './SceneArt';
import styles from './EvidenceScenes.module.css';

function HeadingBlock({ section, Heading, chapter, compact }) {
  if(compact) return <header className={styles.compactHeading}><h3 id={`${section.id}-content-title`}>{section.title}</h3><p>{section.body}</p></header>;
  return <header className={styles.heading} data-enter="title"><div className={styles.chapter}><span>{chapter}</span><span>{section.title}</span></div><Heading id={`${section.id}-title`}>{section.display}</Heading><strong>{section.headline}</strong><p>{section.body}</p></header>;
}

export function ExperiencePanel({ section, Heading, chapter, onDetail }) {
  const [selected, setSelected] = useState(section.items.find(item => !item.placeholder)?.id);
  const [instant, setInstant] = useState(false);
  const current = section.items.find(item => item.id === selected);
  return <div className={styles.journey} data-copy data-evidence="experience" data-widget="experience">
    <HeadingBlock section={section} Heading={Heading} chapter={chapter}/>
    <div className={styles.journeyRail} data-enter="right">
      {section.items.map(item => item.placeholder ? <div key={item.id} className={styles.nextStop}><span aria-hidden="true">＋</span><strong>{item.title}</strong><p>{item.description}</p></div> : <button key={item.id} className={styles.journeyStop} aria-pressed={item.id === current?.id} onClick={event => { setSelected(item.id); setInstant(event.detail === 0); }}><span className={styles.period}>{item.period}<small>{item.tag}</small></span><span><strong>{item.title}</strong><span>{item.description}</span></span><span className={styles.stopArrow} aria-hidden="true">↗</span></button>)}
      {!section.items.length && <p className={styles.empty}>경험 기록을 준비하고 있습니다.</p>}
    </div>
    {current && <aside className={styles.journeyNote} data-enter="diagonal-left"><ContentReveal value={current.id} instant={instant}><span className={styles.noteLabel}>{current.meta}</span><h3>{current.title}</h3><p>{current.detail}</p>{current.bullets && <ul>{current.bullets.map(text => <li key={text}>{text}</li>)}</ul>}<button className={styles.readMore} onClick={event => onDetail(current, event.currentTarget, event.detail === 0)}>경험 자세히 <span aria-hidden="true">↗</span></button></ContentReveal></aside>}
    <noscript><div className={styles.staticRecords}>{section.items.map(item => <article key={item.id}><h3>{item.title}</h3><p>{item.meta}</p><p>{item.detail}</p>{item.bullets?.map(text => <p key={text}>{text}</p>)}</article>)}</div></noscript>
  </div>;
}

export function CredentialsPanel({ section, Heading, chapter, compact=false }) {
  return <div className={styles.credentials} data-copy data-evidence="credentials" data-compact={compact}>
    <HeadingBlock section={section} Heading={Heading} chapter={chapter} compact={compact}/>
    <div className={styles.credentialsDeck}>
      {section.groups?.map((group, index) => <section key={group.title} className={styles.certificate} data-enter={index % 2 ? 'diagonal-right' : 'diagonal-left'}>
        <header><h3>{group.title}</h3></header>
        <ul>{group.items.map(item => <li key={item.id}><div><h4>{item.title}</h4><p>{item.description}</p></div><span className={styles.badge}>{item.badge}</span></li>)}</ul>
      </section>)}
      {!section.groups?.length && <p className={styles.empty}>자격 정보를 준비하고 있습니다.</p>}
    </div>
  </div>;
}

export function EducationPanel({ section, Heading, chapter, compact=false }) {
  return <div className={styles.education} data-copy data-evidence="education" data-compact={compact}>
    <HeadingBlock section={section} Heading={Heading} chapter={chapter} compact={compact}/>
    <div className={styles.studyBook}>
      <div className={styles.schoolPage} data-enter="book-left">
        {section.items.map(item => <article key={item.id}><span className={styles.noteLabel}>{item.tag}</span><h3>{item.title}</h3><p className={styles.period}>{item.period}</p><p>{item.description}</p></article>)}
        {!section.items.length && <p className={styles.empty}>교육 과정을 준비하고 있습니다.</p>}
      </div>
      <div className={styles.scoresPage} data-enter="book-right"><span className={styles.noteLabel}>학업 기록</span><dl>{section.stats?.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}<small>{stat.suffix}</small></dd></div>)}</dl></div>
    </div>
  </div>;
}

export function AwardsPanel({ section, Heading, chapter, compact=false }) {
  const records = section.groups?.flatMap(group => group.items) || [];
  const [selected, setSelected] = useState(records[0]?.id);
  const [instant, setInstant] = useState(false);
  const current = records.find(item => item.id === selected) || records[0];
  const category = section.groups?.find(group => group.items.includes(current));
  return <div className={styles.awards} data-copy data-evidence="awards" data-compact={compact}>
    <HeadingBlock section={section} Heading={Heading} chapter={chapter} compact={compact}/>
    {current ? <article className={styles.awardFeature} data-enter="award"><ContentReveal value={current.id} instant={instant}><span className={styles.noteLabel}>{category?.title}</span><h3>{current.title}</h3><p>{current.description}</p><span className={styles.badge}>{current.badge}</span>{current.detail && <p>{current.detail}</p>}{current.links?.filter(link => link.url).map(link => <a key={link.url} href={link.url}>{link.label} ↗</a>)}</ContentReveal></article> : <p className={styles.empty}>수상 기록을 준비하고 있습니다.</p>}
    <div className={styles.honors} data-enter="diagonal-right">{section.groups?.map(group => <section key={group.title}><h3>{group.title}</h3><div>{group.items.map(item => <button key={item.id} aria-pressed={item === current} onClick={event => {setSelected(item.id);setInstant(event.detail === 0);}}><span><strong>{item.title}</strong><small>{item.description}</small></span><span className={styles.badge}>{item.badge}</span></button>)}</div></section>)}</div>
    <noscript><div className={styles.staticRecords}>{records.filter(item=>item.detail || item.links?.some(link=>link.url)).map(item=><article key={item.id}><h3>{item.title}</h3>{item.detail && <p>{item.detail}</p>}{item.links?.filter(link=>link.url).map(link=><a key={link.url} href={link.url}>{link.label}</a>)}</article>)}</div></noscript>
  </div>;
}

export function SkillRecordsPanel({ section, Heading, chapter, compact=false }) {
  return <div className={styles.skills} data-copy data-evidence="skills" data-compact={compact}>
    <HeadingBlock section={section} Heading={Heading} chapter={chapter} compact={compact}/>
    <dl className={styles.skillList}>{section.items.map(item=><div key={item.id}><dt>{item.title}</dt><dd><p>{item.description}</p>{item.detail && <p>{item.detail}</p>}<span className={styles.skillLevel}>숙련도 {Number.isFinite(item.level) ? `${Math.max(0,Math.min(100,item.level))}%` : '입력 전'}</span>{item.links?.filter(link=>link.url).map(link=><a key={link.url} href={link.url}>{link.label}</a>)}</dd></div>)}</dl>
    {section.toolbox?.length > 0 && <section className={styles.toolbox}><h3>사용 도구</h3><ul>{section.toolbox.map(tool=><li key={tool}>{tool}</li>)}</ul></section>}
  </div>;
}
