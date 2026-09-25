'use client';

import { useState } from 'react';
import { ContentReveal } from './SceneArt';
import styles from './EvidenceScenes.module.css';

function HeadingBlock({ section, Heading, chapter }) {
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

function EvidenceSymbol({ kind }) {
  return <svg viewBox="0 0 240 240" fill="none" aria-hidden="true" className={styles.evidenceSymbol}>
    <path className={styles.symbolFrame} d="M30 76V30h46M164 30h46v46M210 164v46h-46M76 210H30v-46"/>
    <circle className={styles.symbolOrbit} cx="120" cy="120" r="94"/>
    {kind==='education' ? <><path d="m42 102 78-39 78 39-78 39-78-39Z"/><path d="M66 117v45l54 27 54-27v-45M120 141v48M198 102v58"/><path className={styles.symbolAccent} d="m75 83 45-23 45 23-45 23-45-23Z"/></> :
      kind==='credentials' ? <><path d="M66 40h108v151H66V40ZM88 70h63M88 91h45"/><circle cx="120" cy="133" r="24"/><path d="m102 151-9 54 27-16 27 16-9-54"/><path className={styles.symbolAccent} d="m108 132 9 9 18-21"/></> :
      kind==='awards' ? <><path d="m120 51 21 43 48 7-35 34 8 48-42-23-42 23 8-48-35-34 48-7 21-43Z"/><path className={styles.symbolAccent} d="M52 156c10 33 34 50 68 52 34-2 58-19 68-52M41 129l14 17M185 146l14-17"/></> :
      <><path d="m89 74-46 46 46 46M151 74l46 46-46 46M138 58l-36 124"/><path className={styles.symbolAccent} d="M72 43h96M72 197h96"/></>}
  </svg>;
}

const proficiency = item => `숙련도 ${Number.isFinite(item.level) ? `${Math.max(0,Math.min(100,item.level))}%` : '입력 전'}`;

function RecordDetails({ item, skills }) {
  return <>{item.group && <span className={styles.recordGroup}>{item.group}</span>}<h4>{item.title}</h4>{item.period && <p>{item.period}</p>}<p>{item.description}</p>{item.detail && <p>{item.detail}</p>}
    {item.bullets?.length > 0 && <ul>{item.bullets.map(text=><li key={text}>{text}</li>)}</ul>}
    {skills ? <span className={styles.recordStatus}>{proficiency(item)}</span> : item.badge && <span className={styles.recordStatus}>{item.badge}</span>}
    {item.links?.filter(link=>link.url).map(link=><a key={link.url} href={link.url}>{link.label} <span aria-hidden="true">↗</span></a>)}
  </>;
}

function EvidenceRecords({ section, Heading, chapter, compact=false }) {
  const records = section.groups?.flatMap(group=>group.items.map(item=>({...item,group:group.title}))) || section.items || [];
  const [selected,setSelected] = useState(records[0]?.id);
  const [instant,setInstant] = useState(false);
  const current = records.find(item=>item.id===selected) || records[0];
  const skills = section.kind==='skills';
  const select = (item,event) => {setSelected(item.id);setInstant(event.detail===0);};
  return <div className={styles.recordScene} data-copy data-evidence={section.kind} data-compact={compact}>
    <header className={styles.recordIdentity}>
      {!compact && <div className={styles.chapter}><span>{chapter}</span><Heading id={`${section.id}-title`}>{section.title}</Heading></div>}
      <h3 id={`${section.id}-content-title`} className={styles.recordTitle}>{section.title}</h3>
      <div className={styles.symbolField}><EvidenceSymbol kind={section.kind}/></div>
      <strong className={styles.recordHeadline}>{section.headline}</strong>
      <p className={styles.recordIntro}>{section.body}</p>
      <span className={styles.identityRule} aria-hidden="true"/>
    </header>
    <div className={styles.recordContent} data-scene-scroll>
      <section className={styles.recordIndex} data-record-list aria-label={`${section.title} 기록`}>
        <div className={styles.recordColumns} aria-hidden="true" data-skills={skills}>
          {skills ? <><span>분야</span><span>도구</span><span>숙련도</span></> : <><span>기간</span><span>기관</span><span>명칭</span></>}
        </div>
        <div className={styles.recordRows}>
          {records.map(item=><button key={item.id} className={styles.recordRow} data-record-id={item.id} data-skills={skills} aria-pressed={item.id===current?.id} aria-controls={`${section.id}-record-detail`} onClick={event=>select(item,event)}>
            {skills ? <><strong>{item.title}</strong><span className={styles.recordTools}>{item.description}</span><span className={styles.recordPeriod}>{proficiency(item)}</span></> : <><span className={styles.recordPeriod}>{item.period || item.date || item.year || '입력 전'}</span><span className={styles.recordOrganization}>{item.organization || item.institution || item.issuer || '입력 전'}</span><strong>{item.title}</strong></>}
            <span className={styles.recordSelected} aria-hidden="true">{item.id===current?.id?'✓':'+'}</span>
          </button>)}
          {!records.length && <p className={styles.empty}>기록을 준비하고 있습니다.</p>}
        </div>
      </section>
      {current && <article id={`${section.id}-record-detail`} className={styles.recordDetail} data-record-detail={current.id} aria-live="polite" aria-atomic="true">
        <ContentReveal value={current.id} instant={instant}><RecordDetails item={current} skills={skills}/></ContentReveal>
      </article>}
      {section.stats?.length > 0 && <dl className={styles.recordStats}>{section.stats.map(stat=><div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}<small>{stat.suffix}</small></dd></div>)}</dl>}
      {section.toolbox?.length > 0 && <section className={styles.recordToolbox}><h4>사용 도구</h4><ul>{section.toolbox.map(tool=><li key={tool}>{tool}</li>)}</ul></section>}
    </div>
    <noscript><style>{'[data-evidence] [data-record-detail],[data-evidence] [data-record-list]{display:none!important}'}</style><div className={styles.staticRecords} data-evidence-static>{records.map(item=><article key={item.id}><RecordDetails item={item} skills={skills}/></article>)}</div></noscript>
  </div>;
}

export function CredentialsPanel(props) { return <EvidenceRecords {...props}/>; }
export function EducationPanel(props) { return <EvidenceRecords {...props}/>; }
export function AwardsPanel(props) { return <EvidenceRecords {...props}/>; }
export function SkillRecordsPanel(props) { return <EvidenceRecords {...props}/>; }

