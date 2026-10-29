'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { assetUrl } from './config.mjs';
import { selectKey } from './SceneArt';
import { workGallerySections, mediaShape } from './work-catalog.mjs';
import WorkMedia, { WorkMediaCaption } from '../works/WorkMedia';
import styles from './WorkShowcase.module.css';

const sectionLabels = {
  '평가·서비스 연동': '평가·연동', '학습 어댑터 추론': '어댑터 추론', '데이터 파이프라인': '데이터 흐름',
  '한계와 다음 검증': '한계·검증', '검증 범위와 자산의 경계': '검증 범위', '새 시연과 원본의 구분': '시연·원본',
  '정적 배포와 로딩': '배포·로딩', '개발 대상과 담당 범위': '담당 범위', '업무를 데이터 구조로 옮기기': '업무 구조화',
  '운영까지 이어진 대표 사례': '운영 사례', '프로젝트 수상과 개인 역할': '수상·역할', '함께 만드는 환경': '협업 환경',
  '배운 내용을 설명하기': '지식 공유', '행사를 뒷받침하는 일': '행사 운영', '다른 업무 방식을 이해하기': '업무 이해',
};

export default function WorkShowcase({ item, onSectionChange }) {
  const parts = workGallerySections(item);
  const [selected, setSelected] = useState(0), [mediaIndex, setMediaIndex] = useState(0);
  const tabs = useRef(null), mobileMenu = useRef(null), reader = useRef(null), mediaTabs = useRef(null), visual = useRef(null), caption = useRef(null);
  const part = parts[selected];
  const mediaList = part.media.length ? part.media : parts[0].media;
  const media = mediaList[mediaIndex];
  const [title, ...subtitle] = item.title.split(/\s[—·]\s/);
  const body = <div className={styles.prose}>{(part.body || '').split('\n\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
  useLayoutEffect(() => {
    const node = caption.current;
    if (!node) return;
    const measure = () => node.parentElement.style.setProperty('--caption-height', `${node.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [media]);
  function choose(index, keyboard = false) {
    setSelected(index); setMediaIndex(0); reader.current?.scrollTo(0, 0); visual.current?.scrollTo(0, 0); onSectionChange();
    if (mobileMenu.current?.open) { mobileMenu.current.open = false; mobileMenu.current.querySelector('summary').focus({ preventScroll: true }); }
    if (keyboard) tabs.current?.querySelectorAll('[role=tab]')[index]?.scrollIntoView({ block: 'nearest' });
  }
  function chooseMedia(index) {
    setMediaIndex(index);
    visual.current?.scrollTo(0, 0);
    if (index === 0 || index === mediaList.length - 1) mediaTabs.current?.querySelectorAll('button')[index]?.focus({ preventScroll: true });
  }
  return <article className={styles.gallery} data-work-detail data-item-id={item.id} data-work-detail-item={item.id}>
    <aside className={styles.sidebar}>
      <p className={styles.contentsTitle}>내용 살펴보기</p>
      <div ref={tabs} className={styles.tabs} role="tablist" aria-label="경험 상세 목차" aria-orientation="vertical" onKeyDown={event => selectKey(event, selected, parts.length, choose)}>
        {parts.map((entry, index) => <button key={entry.id} id={`work-tab-${item.id}-${entry.id}`} role="tab" aria-label={entry.title} title={entry.title} aria-controls={`work-panel-${item.id}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => choose(index)}><span>{sectionLabels[entry.title.split(' · ')[0]] || entry.title.split(' · ')[0]}</span></button>)}
      </div>
      <details ref={mobileMenu} className={styles.mobileMenu}><summary>내용 살펴보기 · {part.title}</summary><nav aria-label="경험 상세 목차">{parts.map((entry, index) => <button key={entry.id} aria-current={selected === index ? 'true' : undefined} onClick={() => choose(index)}>{entry.title}</button>)}</nav></details>
      <a className={styles.readMore} href={assetUrl('/works/' + item.slug + '/')}>자세한 기록 읽기 <span aria-hidden="true">↗</span></a>
    </aside>
    <section id={`work-panel-${item.id}`} className={styles.panel} role="tabpanel" aria-labelledby={`work-tab-${item.id}-${part.id}`} data-gallery-section={part.id} data-has-media={Boolean(media)} data-media-shape={mediaShape(media && { ...media, focus: undefined })}>
      <div className={styles.copyColumn} data-work-intro>
      <header className={styles.projectHeading} data-work-heading>
        <h3 id="work-summary-title" tabIndex={-1} aria-label={item.title}>{title}</h3>
        {subtitle.length > 0 && <p className={styles.subtitle}>{subtitle.join(' · ')}</p>}
        <p className={styles.status}>{item.status || item.period}</p>
      </header>
      <div className={styles.storyFrame}>
        <div ref={reader} className={styles.story} data-work-copy data-scene-scroll tabIndex={0} role="region" aria-label={`${part.title} 설명`}>
          <h4 className={styles.partTitle}>{part.title}</h4>
          {body}
          {selected === 0 && <><dl className={styles.facts}>{item.role && <div><dt>담당 범위</dt><dd>{item.role}</dd></div>}{item.result && <div><dt>핵심 결과</dt><dd>{item.result}</dd></div>}</dl>{item.evidence && <details className={styles.evidence}><summary>자료 범위</summary><p>{item.evidence}</p></details>}</>}
        </div>
      </div>
      </div>
      {media && <div className={styles.visualColumn}>
        <div ref={visual} className={styles.stage} data-gallery-media={mediaIndex} data-media-source={part.media.length ? 'section' : 'cover'} data-scene-scroll tabIndex={0} role="region" aria-label="프로젝트 화면 자료"><WorkMedia key={`${part.id}-${mediaIndex}`} media={media} eager diagonal overview captionId={`work-caption-${item.id}`}/></div>
      <footer ref={caption} className={styles.mediaFooter} data-media-footer>
        <div id={`work-caption-${item.id}`} className={styles.caption} data-media-caption><WorkMediaCaption media={media} showFocus={false}/>{selected > 0 && !part.media.length && <p className={styles.mediaContext}>대표 화면</p>}</div>
        {mediaList.length > 1 && <div className={styles.mediaPicker}>
          <div className={styles.controls} aria-label="자료 넘기기"><button aria-label="이전 자료" disabled={mediaIndex === 0} onClick={() => chooseMedia(mediaIndex - 1)}>←</button><span aria-live="polite">{mediaIndex + 1} / {mediaList.length}</span><button aria-label="다음 자료" disabled={mediaIndex === mediaList.length - 1} onClick={() => chooseMedia(mediaIndex + 1)}>→</button></div>
          <div ref={mediaTabs} className={styles.thumbnails} aria-label="자료 선택">{mediaList.map((entry, index) => <button key={`${entry.src}-${index}`} aria-pressed={mediaIndex === index} aria-label={`${index + 1}. ${entry.alt}`} onClick={() => chooseMedia(index)}>{(entry.type !== 'video' || entry.poster) && <img src={assetUrl(entry.type === 'video' ? entry.poster : entry.src)} alt="" loading="lazy"/>}<span>{entry.type === 'video' ? '영상' : '화면'} {index + 1}</span></button>)}</div>
        </div>}
      </footer>
      </div>}
    </section>

  </article>;
}
