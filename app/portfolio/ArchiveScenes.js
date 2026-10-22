'use client';

import { ArrowUpRight, ArrowDown, ArrowUp, Eye, Atom, Sparkle } from '@phosphor-icons/react';
import { assetUrl } from './config.mjs';
import { ChapterTabs, useChapterSelection } from './ChapterGroup';
import styles from './ArchiveScenes.module.css';

const paper = { backgroundImage: `url("${assetUrl('/art/archive/paper.webp')}")` };

function Artwork({ visual, className = '', eager = false }) {
  return <figure className={`${styles.artwork} ${className}`}>
    {visual?.src && <img src={assetUrl(visual.src)} alt={visual.alt || ''} width="1200" height="1400" loading={eager ? 'eager' : 'lazy'} decoding="async" style={{ objectPosition: visual.position || '50% 50%', objectFit: visual.fit === 'contain' ? 'contain' : 'cover' }}/>}
  </figure>;
}

function ChapterLabel({ chapter, children }) {
  return <div className={styles.chapter}><span>{chapter}</span><div>{children}</div></div>;
}

export function ArchiveCover({ profile, firstId }) {
  return <div className={`${styles.scene} ${styles.cover}`} style={paper}>
    <Artwork visual={profile.visuals?.landing} className={styles.coverArt} eager/>
    <div className={styles.coverCopy}>
      <p className={styles.eyebrow}>{profile.role || 'Personal portfolio'}</p>
      <h1 id="preview-name" data-reveal="0">{profile.name || '이름 / 닉네임'}</h1>
      <p className={styles.tagline} data-reveal="1">{profile.tagline || '생각을 움직이는 경험으로.'}</p>
      <a className={styles.action} data-reveal="2" href={`#${firstId}`}>포트폴리오 살펴보기<ArrowUpRight size={22} weight="light" aria-hidden="true"/></a>
    </div>
    <p className={styles.coverNote}>작은 질문과 시도, 그 안에서 발견한 가능성.</p>
  </div>;
}

export function ArchiveIntro({ section, chapter, profile, projectId, researchId }) {
  const symbols = [Eye, Atom, Sparkle];
  return <div className={`${styles.scene} ${styles.intro}`} style={paper} data-copy data-archive-scene="intro">
    <Artwork visual={profile.visuals?.about}/>
    <div className={styles.editorial} data-scene-scroll>
      <ChapterLabel chapter={chapter}>{section.title}</ChapterLabel>
      <h2 id={`${section.id}-title`} className={styles.title} data-reveal="0">{section.headline}</h2>
      <p className={styles.body} data-reveal="1">{section.body}</p>
      {section.facts?.length > 0 && <dl className={styles.facts} data-reveal="2">{section.facts.map((fact, index) => {
        const Symbol = symbols[index % symbols.length];
        return <div key={fact.label}><Symbol size={32} weight="thin" aria-hidden="true"/><dt>{fact.label}</dt><dd>{fact.value}</dd></div>;
      })}</dl>}
      <nav className={styles.textLinks} data-reveal="2" aria-label="작업과 연구">{projectId && <a href={`#${projectId}`}>작업·경험 보기<ArrowUpRight size={19} aria-hidden="true"/></a>}{researchId && <a href={`#${researchId}`}>연구 보기<ArrowUpRight size={19} aria-hidden="true"/></a>}</nav>
    </div>
  </div>;
}

function Records({ section }) {
  const records = section.groups?.flatMap(group => group.items.map(item => ({ ...item, group: group.title }))) || section.items;
  const stats = section.stats?.filter(stat => stat.value && stat.value !== '—');
  return <>
    <div className={styles.records} data-reveal="1">
      {records.map(item => <article className={styles.record} key={item.id}>
        {item.group && <p className={styles.recordGroup}>{item.group}</p>}
        <h4>{item.title}</h4>
        {(item.period || item.date || item.year) && <p className={styles.recordPeriod}>{item.period || item.date || item.year}</p>}
        <p>{item.description}</p>
        {(item.organization || item.institution || item.issuer) && <p>{item.organization || item.institution || item.issuer}</p>}
        {(item.detail || item.bullets?.length) && <details><summary>기록 더 보기</summary>{item.detail && <p>{item.detail}</p>}{item.bullets?.length > 0 && <ul>{item.bullets.map(text => <li key={text}>{text}</li>)}</ul>}</details>}
        {Number.isFinite(item.level) && <p>숙련도 {Math.max(0, Math.min(100, item.level))}%</p>}
        {item.badge && item.badge !== '—' && <small className={styles.badge}>{item.badge}</small>}
        {item.links?.filter(link => link.url).map(link => <a className={styles.recordLink} key={link.url} href={link.url.startsWith('/') ? assetUrl(link.url) : link.url} target={/^https?:/.test(link.url) ? '_blank' : undefined} rel="noreferrer">{link.label}<ArrowUpRight size={16} aria-hidden="true"/></a>)}
      </article>)}
      {!records.length && <p className={styles.body} data-reveal="1">기록을 준비하고 있습니다.</p>}
    </div>
    {stats?.length > 0 && <dl className={styles.stats}>{stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value} <small>{stat.suffix}</small></dd></div>)}</dl>}
    {section.toolbox?.length > 0 && <p className={styles.toolbox}>{section.toolbox.join(' · ')}</p>}
  </>;
}

export function ArchiveEducation({ section, chapter, profile }) {
  const state = useChapterSelection(section);
  const labels = { education: '배움의 기록', credentials: '배움을 확인하는 이정표', awards: '노력의 발자취', skills: '가능성을 만드는 도구' };
  return <div className={`${styles.scene} ${styles.archive}`} style={paper} data-copy data-archive-scene="education" data-chapter-group={section.id}>
    <Artwork visual={profile.visuals?.education} className={styles.archiveArt}/>
    <ChapterTabs section={section} {...state} vertical className={styles.archiveTabs}/>
    <p className={styles.archiveWord} aria-hidden="true">ARCHIVE</p>
    <div className={styles.archiveContent}>
      <ChapterLabel chapter={chapter}><h2 id={`${section.id}-title`}>이력·역량</h2></ChapterLabel>
      {state.chapters.map((part, index) => <section key={part.id} id={`${section.id}-category-panel-${part.id}`} role="tabpanel" aria-labelledby={`${section.id}-category-${part.id}`} hidden={index !== state.selected} tabIndex={0} className={styles.recordPanel} data-scene-scroll>
        {part.id !== section.id && <span id={part.id}/>}
        <h3 className={styles.recordTitle} data-reveal="0">{labels[part.kind] || part.title}</h3>
        <p className={styles.recordIntro}>{part.body}</p>
        <Records section={part}/>
      </section>)}
    </div>
    <noscript><style>{'[data-archive-scene=education] [role=tablist]{display:none!important}[data-archive-scene=education] [role=tabpanel][hidden]{display:block!important}'}</style></noscript>
  </div>;
}

export function ArchiveContact({ section, chapter, profile, firstId }) {
  const email = profile.email?.trim(), cv = profile.cv?.trim();
  const links = profile.links.filter(link => link.url?.trim());
  return <div className={`${styles.scene} ${styles.contact}`} style={paper} data-copy data-contact-panel data-archive-scene="contact">
    <Artwork visual={profile.visuals?.contact}/>
    <div className={styles.editorial} data-scene-scroll>
      <ChapterLabel chapter={chapter}>{section.title}</ChapterLabel>
      <h2 id={`${section.id}-title`} className={styles.title} data-reveal="0">{section.display}</h2>
      <p className={styles.body} data-reveal="1">{section.headline}<br/>{section.body}</p>
      {email ? <a className={styles.action} data-reveal="2" href={`mailto:${email}`}>이메일 보내기<ArrowUpRight size={22} weight="light" aria-hidden="true"/></a> : <div className={`${styles.action} ${styles.pending}`}><span>이메일</span><small>준비 중</small></div>}
      {email && <p className={styles.email}>{email}</p>}
      <div className={styles.contactLinks}>
        {cv ? <a href={assetUrl(cv)}>이력서 보기<ArrowDown size={17} aria-hidden="true"/></a> : <span>이력서 <small>준비 중</small></span>}
        {links.length ? links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}<ArrowUpRight size={17} aria-hidden="true"/></a>) : <span>공개 채널 <small>준비 중</small></span>}
      </div>
      <a className={styles.back} href={`#${firstId}`}>처음으로<ArrowUp size={17} aria-hidden="true"/></a>
    </div>
    <p className={styles.contactWord} aria-hidden="true">CONTACT</p>
  </div>;
}
