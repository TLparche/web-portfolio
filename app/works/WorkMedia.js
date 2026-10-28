'use client';

import { useRef, useState } from 'react';
import { assetUrl } from '../portfolio/config.mjs';
import { mediaFocusStyle } from '../portfolio/work-catalog.mjs';
import styles from './Works.module.css';

export function WorkMediaCaption({ media, showFocus = true }) {
  return <>{showFocus && media.focus && <strong className={styles.focusCaption}>{media.focus.caption}<small>부분 화면</small></strong>}{media.caption}</>;
}

export default function WorkMedia({ media, eager = false, diagonal = false, overview = false, captionId }) {
  const dialog = useRef(null);
  const [zoomed, setZoomed] = useState(false), [detail, setDetail] = useState(false);
  const video = media.type === 'video';
  const focused = Boolean(media.focus && !overview);
  const companion = Boolean(overview && media.focus && !video);
  function openDetail() { setDetail(true); setZoomed(false); dialog.current.showModal(); }
  const selection = companion ? { left: `${media.focus.x / media.width * 100}%`, top: `${media.focus.y / media.height * 100}%`, width: `${media.focus.width / media.width * 100}%`, height: `${media.focus.height / media.height * 100}%` } : undefined;
  return <figure className={styles.figure} aria-describedby={captionId} data-focused={focused} data-overview={overview} data-has-focus={companion} data-diagonal={diagonal} style={{ '--media-ratio': `${media.width || 16} / ${media.height || 10}`, ...mediaFocusStyle(media) }}>
    {video ? <div className={styles.mediaFrame} data-media-frame><video width={media.width} height={media.height} controls playsInline preload="none" poster={media.poster ? assetUrl(media.poster) : undefined} aria-label={media.alt} src={assetUrl(media.src)}/></div> : <button className={styles.imageButton} onClick={() => dialog.current.showModal()} aria-label={`${media.alt} 확대`}><span className={styles.mediaFrame} data-media-frame><span className={styles.imageViewport} data-media-viewport><img width={media.width} height={media.height} src={assetUrl(media.src)} alt={focused ? `${media.alt} — ${media.focus.caption} (부분 화면)` : media.alt} loading={eager ? 'eager' : 'lazy'} decoding="async"/>{companion && <span className={styles.focusSelection} style={selection} aria-hidden="true"/>}</span></span><span className={styles.imageAction}>{focused ? '전체 화면 보기' : '원본 확대'} ↗</span></button>}
    {companion && <aside className={styles.focusAside} data-focus-companion><button className={styles.focusButton} onClick={openDetail} aria-label={`${media.focus.caption} 핵심 확대`}><span className={styles.focusViewport} data-focus-preview><img src={assetUrl(media.src)} alt={`${media.focus.caption} — 부분 확대`} loading={eager ? 'eager' : 'lazy'}/></span><span className={styles.focusAction}>핵심 확대 <span aria-hidden="true">↗</span></span></button><p>{media.focus.caption}</p></aside>}
    {!captionId && (media.caption || media.focus) && <figcaption><WorkMediaCaption media={media}/></figcaption>}
    {!video && <dialog ref={dialog} className={styles.lightbox} aria-label={media.alt} onClose={() => { setZoomed(false); setDetail(false); }} onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }} onClick={event => { if (event.target === event.currentTarget) dialog.current.close(); }}><div className={styles.lightboxTools}><button aria-pressed={zoomed} onClick={() => { setDetail(false); setZoomed(!zoomed); }}>{zoomed ? '너비에 맞추기' : '원본 크기로 보기'}</button>{companion && <button aria-pressed={detail} onClick={() => { setDetail(!detail); setZoomed(false); }}>{detail ? '전체 이미지 보기' : '핵심 확대 보기'}</button>}<button autoFocus onClick={() => dialog.current.close()}>닫기 ×</button></div><div className={detail ? styles.lightboxFocus : styles.lightboxImage} data-zoomed={zoomed} data-detail={detail} tabIndex={0} role="region" aria-label="확대 이미지 스크롤 영역"><img width={media.width} height={media.height} src={assetUrl(media.src)} alt={media.alt} loading="lazy"/></div>{(detail || media.caption) && <p>{detail ? media.focus.caption : media.caption}</p>}</dialog>}
  </figure>;
}
