'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { assetUrl } from './config.mjs';
import { galleryLayout, galleryPointerPreview } from './work-gallery-layout.mjs';
import { workDomains } from './work-catalog.mjs';
import styles from './DomainGallery.module.css';

const polygon = (points, size) => `polygon(${points.map(([x,y]) => `${x / size.width * 100}% ${y / size.height * 100}%`).join(',')})`;

export default function DomainGallery({ items, onOpen, returnFocus }) {
  const [preview, setPreview] = useState(null), [keyboard, setKeyboard] = useState(false), [size, setSize] = useState({ width: 1920, height: 800 }), [switching, setSwitching] = useState(false);
  const rail = useRef(null), current = useRef(null), leaveTimer = useRef(null), restoring = useRef(false), pointer = useRef(null);
  const layout = galleryLayout(preview, size);
  useLayoutEffect(() => {
    const node = rail.current.parentElement;
    const measure = () => setSize({ width: Math.max(node.clientWidth, 320), height: Math.max(node.clientHeight, 280) });
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!returnFocus?.startsWith('work-domain-')) return;
    restoring.current = true;
    const button = document.getElementById(returnFocus);
    button?.focus({ preventScroll: true });
    if (getComputedStyle(rail.current).overflowX === 'auto') button?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
    restoring.current = false;
  }, [returnFocus]);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  function expand(index, fromKeyboard = false) {
    clearTimeout(leaveTimer.current);
    if (current.current === index && keyboard === fromKeyboard) return;
    setKeyboard(fromKeyboard); setSwitching(current.current !== null);
    current.current = index; setPreview(index);
  }
  function leave(event) {
    if (event) {
      const bounds = rail.current.parentElement.getBoundingClientRect();
      if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) return;
    }
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      if (rail.current?.closest('[data-dissolving=true]') || (event && rail.current?.parentElement.matches(':hover'))) return;
      current.current = null; pointer.current = null; setPreview(null);
    }, keyboard ? 0 : 100);
  }
  function move(event) {
    clearTimeout(leaveTimer.current);
    if (event.pointerType !== 'mouse' || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    const card = event.target.closest('[data-work-domain]');
    const target = card ? workDomains.findIndex(field => field.id === card.dataset.workDomain) : null;
    const point = { x: event.clientX, y: event.clientY };
    const next = galleryPointerPreview(current.current, pointer.current, point, target);
    pointer.current = point;
    if (next !== null && (next !== current.current || keyboard)) expand(next);
  }
  function key(event) {
    const buttons = [...rail.current.querySelectorAll('[data-work-domain]')], index = buttons.indexOf(document.activeElement);
    const next = { ArrowRight: (index + 1) % workDomains.length, ArrowDown: (index + 1) % workDomains.length, ArrowLeft: (index + workDomains.length - 1) % workDomains.length, ArrowUp: (index + workDomains.length - 1) % workDomains.length, Home: 0, End: workDomains.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault(); expand(next, true); buttons[next]?.focus({ preventScroll: true });
    if (getComputedStyle(rail.current).overflowX === 'auto') buttons[next]?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }
  function imageError(event, fallback) {
    const image = event.currentTarget;
    if (fallback && image.dataset.fallback !== 'true' && image.getAttribute('src') !== assetUrl(fallback)) { image.dataset.fallback = 'true'; image.src = assetUrl(fallback); }
    else image.style.visibility = 'hidden';
  }
  return <div className={styles.listView} data-work-list data-instant={keyboard} data-switching={switching} onPointerEnter={() => clearTimeout(leaveTimer.current)} onPointerMove={move} onPointerLeave={event => { if (event.pointerType === 'mouse') leave(event); }}>
    <div ref={rail} className={styles.ribbons} role="list" aria-label="경험 분야 6개" onKeyDown={key} >
      {workDomains.map((field, index) => {
        const works = items.filter(work => work.domain === field.id), art = { src: field.image };
        const active = preview === index, placement = layout[index], points = placement.points;
        return <div key={field.id} className={styles.ribbon} role="listitem" data-preview={active} data-reveal={.5 + index * .55} data-reveal-kind={index % 2 ? 'ribbon-down' : 'ribbon-up'} data-reveal-phase="surface">
          <div className={styles.ribbonShift} >
            <button id={'work-domain-' + field.id} className={styles.card} data-work-card data-work-domain={field.id} aria-label={`${field.title} 분야 · ${works.length}개의 기록`} aria-expanded={active} aria-controls={'work-domain-preview-' + field.id} style={{ clipPath:polygon(points, size) }} onFocus={event => { if (!restoring.current && event.currentTarget.matches(':focus-visible')) expand(index, true); }} onBlur={event => { if (keyboard && !rail.current?.contains(event.relatedTarget)) leave(); }} onClick={() => onOpen(field.id)}>
              <span className={styles.stripSurface} aria-hidden="true"/>
              {art?.src && <img className={styles.stripArt} src={assetUrl(art.thumbnail || art.src)} alt="" loading="lazy" decoding="async" style={{ left:Math.min(...points.map(point=>point[0])),top:Math.min(...points.map(point=>point[1])),width:Math.max(...points.map(point=>point[0]))-Math.min(...points.map(point=>point[0])),height:Math.max(...points.map(point=>point[1]))-Math.min(...points.map(point=>point[1])),objectPosition:art.card?.position || '50% 50%' }} onError={event => imageError(event, art.src)}/>}
              <span className={styles.stripLabel} data-reveal={.5 + index * .55} style={{left:placement.labelLeft,top:placement.labelTop,width:placement.labelWidth}}>{field.title}</span>
              <span id={'work-domain-preview-' + field.id} className={styles.preview} aria-hidden={!active}>
                  <span className={styles.caption} style={{left:placement.captionLeft,top:placement.captionTop,width:placement.captionWidth}}><small>{works.length}개의 기록</small><strong>{field.title}</strong><span className={styles.previewResult}>{field.description}</span><span className={styles.previewAction}>분야의 기록 보기 ↗</span></span>
              </span>
            </button>
          </div>
        </div>;
      })}
    </div>
  </div>;
}
