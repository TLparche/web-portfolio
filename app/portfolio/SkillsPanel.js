'use client';

import { useEffect, useRef, useState } from 'react';
import { assetUrl } from './config.mjs';
import SceneArt, { ContentReveal, selectKey } from './SceneArt';
import { Tags } from './SectionContent';
import styles from './SkillsPanel.module.css';

function Proficiency({ item }) {
  const level = Number.isFinite(item.level) ? Math.max(0, Math.min(100, item.level)) : null;
  return <div className={styles.proficiency}><span>PROFICIENCY <b>{level === null ? '입력 전' : `${level}%`}</b></span>{level === null ? <div className={styles.unsetTrack} aria-label={`${item.title} 숙련도 입력 전`}/> : <meter min="0" max="100" value={level} aria-label={`${item.title} 숙련도`}>{level}%</meter>}</div>;
}

/** The original portrait-card plate, retained in the skills chapter. */
export default function SkillsPanel({ section, index, Heading, visible, onSelect }) {
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const closeTimer = useRef(null);
  const toggle = useRef(null);
  const item = section.items[selected] || section.items[0];
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => { if (!visible) { clearTimeout(closeTimer.current); setOpen(false); } }, [visible]);
  function choose(value, keyboard = false) {
    const next = (value + section.items.length) % section.items.length;
    setSelected(next); setInstant(keyboard); onSelect?.(section, section.items[next]);
  }
  function enter(event) {
    if (event.pointerType !== 'mouse' || !matchMedia('(min-width:901px) and (hover:hover) and (pointer:fine)').matches) return;
    clearTimeout(closeTimer.current); setInstant(false); setOpen(true);
  }
  function leave(event) {
    if (event.currentTarget.contains(document.activeElement)) return;
    clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 120);
  }
  function close(keyboard = false) {
    clearTimeout(closeTimer.current); setInstant(keyboard); setOpen(false); toggle.current?.focus({ preventScroll: true });
  }
  return <div className={styles.skills} data-widget="skills" data-instant={instant} style={{ '--interest-accent': item?.accent || '#226DFF' }}>
    <div className={styles.shade} aria-hidden="true"/><div className={styles.glow} aria-hidden="true"/>
    <div className={styles.plate} data-skill-plate data-open={open} onPointerEnter={() => clearTimeout(closeTimer.current)} onPointerLeave={leave} onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(true); } }}>
      <button className={styles.close} aria-label="기술 확장 패널 닫기" onClick={event => close(event.detail === 0)} tabIndex={open ? 0 : -1} aria-hidden={!open}>×</button>
      <div className={styles.column} data-copy data-skill-column data-enter="left" onPointerEnter={enter}>
        <div className={styles.kicker}>{String(index + 1).padStart(2, '0')} · SKILLS<span>{section.title}</span></div>
        <Heading id={`${section.id}-title`} className={styles.name}>{section.display}</Heading>
        {!item ? <p className={styles.description}>기술 정보를 준비하고 있습니다.</p> : <>
          <ContentReveal value={item.id} instant={instant}>
            {section.items.map(skill => <div key={skill.id} role="tabpanel" id={`${section.id}-panel-${skill.id}`} aria-labelledby={`${section.id}-tab-${skill.id}`} hidden={skill !== item} tabIndex={0}>
              <h3 className={styles.bubble}>{skill.title}</h3><p className={styles.stack}>{skill.description}</p>
              <Proficiency item={skill}/><p className={styles.description}>{section.body}</p>
              {skill.links?.length > 0 && <div className={styles.links}>{skill.links.filter(link => link.url).map(link => <a key={link.url} href={link.url}>{link.label} ↗</a>)}</div>}
            </div>)}
          </ContentReveal>
          <div className={styles.rail}>
            <button className={styles.arrow} aria-label="이전 기술 분야" onClick={event => choose(selected - 1, event.detail === 0)}>◂</button>
            <div className={styles.cards} role="tablist" aria-label="기술 분야 선택" onKeyDown={event => selectKey(event, selected, section.items.length, choose)} style={{ gridTemplateColumns: `repeat(${section.items.length}, minmax(0, 1fr))`, width: `${section.items.length * 72 - 10}px` }}>
              {section.items.map((skill, number) => <button key={skill.id} role="tab" id={`${section.id}-tab-${skill.id}`} aria-controls={`${section.id}-panel-${skill.id}`} aria-selected={skill === item} tabIndex={skill === item ? 0 : -1} onClick={event => choose(number, event.detail === 0)} style={{ '--card-accent': skill.accent || '#226DFF' }}>
                <span className={styles.thumb} aria-hidden="true">{skill.image && <img src={assetUrl(skill.image)} alt="" loading="lazy"/>}<span>{String(number + 1).padStart(2, '0')}</span></span><span className={styles.label}>{skill.label || skill.title}</span>
              </button>)}
            </div>
            <button className={styles.arrow} aria-label="다음 기술 분야" onClick={event => choose(selected + 1, event.detail === 0)}>▸</button>
          </div>
          <div className={styles.ruleRow}><span className={styles.stripe} aria-hidden="true"/><button ref={toggle} className={styles.toggle} aria-expanded={open} aria-controls={`${section.id}-extension`} onClick={event => { clearTimeout(closeTimer.current); setInstant(event.detail === 0); setOpen(!open); }}>TOOLBOX <span aria-hidden="true">＋</span></button></div>
        </>}
      </div>
      {item && <aside className={styles.extension} id={`${section.id}-extension`} aria-label="기술 도구 모음" aria-hidden={!open} inert={!open} onPointerEnter={enter}>
        <div className={styles.divider} aria-hidden="true"/>
        <div className={styles.extensionBody}><h3>TOOLBOX</h3><p>{section.headline}</p><ContentReveal value={item.id} instant={instant}><dl><div><dt>{item.title}</dt><dd>{item.description}</dd></div><div><dt>적용 경험</dt><dd>{item.detail || '이 도구로 만든 작업과 적용 과정을 작성할 공간입니다.'}</dd></div></dl></ContentReveal><Tags items={section.toolbox}/></div>
        <SceneArt artwork={item.image ? { src: item.image, alt: '' } : undefined} className={styles.extensionImage} instant={instant}/>
      </aside>}
      <noscript><style>{'[data-skill-plate]{position:relative!important;inset:auto!important;width:100%!important;clip-path:none!important;overflow:visible!important;display:block!important}[data-skill-column]{position:relative!important;inset:auto!important;width:auto!important;padding:32px!important}[data-skill-plate] aside,[data-skill-plate] button,[data-skill-plate] [role=tabpanel]{display:none!important}'}</style><div className={styles.noScript}>{section.items.map(skill => <article key={skill.id}><h3>{skill.title}</h3><p>{skill.description}</p><Proficiency item={skill}/>{skill.links?.filter(link => link.url).map(link => <a key={link.url} href={link.url}>{link.label}</a>)}</article>)}<h3>TOOLBOX</h3><Tags items={section.toolbox}/></div></noscript>
    </div>
  </div>;
}
