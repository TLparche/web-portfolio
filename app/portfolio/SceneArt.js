'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { assetUrl } from './config.mjs';
import styles from './SceneArt.module.css';

/** Keep the displayed illustration until the latest requested image decodes. */
export default function SceneArt({ artwork, className = '', instant = false, enter }) {
  const [layers, setLayers] = useState(() => artwork?.src ? [artwork] : []);
  const [shown, setShown] = useState(artwork?.src);
  const [failed, setFailed] = useState(null);
  const requested = artwork?.src;
  useEffect(() => {
    if (!requested) { setShown(null); return; }
    let cancelled = false;
    const image = new Image();
    image.src = assetUrl(requested);
    image.decode().then(() => {
      if (cancelled) return;
      setLayers(previous => previous.some(layer => layer.src === requested) ? previous : [...previous, artwork]);
      setShown(requested); setFailed(null);
    }).catch(() => { if (!cancelled) setFailed(requested); });
    return () => { cancelled = true; };
  }, [requested, artwork]);
  const displayed = layers.find(layer => layer.src === shown);
  return <figure className={`${styles.art} ${className}`} data-enter={enter} data-art-src={shown || ''} data-art-state={failed === requested ? 'error' : requested !== shown ? 'loading' : 'ready'} data-instant={instant}>
    {layers.map(layer => <img key={layer.src} src={assetUrl(layer.src)} alt={layer.alt || ''} width="1536" height="1024" loading="lazy" aria-hidden={layer.src !== shown} data-visible={layer.src === shown} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />)}
    {(!requested || failed === requested) && <span className={styles.fallback}>{requested ? '이미지를 불러오지 못했습니다.' : '대표 이미지를 준비하고 있습니다.'}</span>}
    {displayed?.temporary && <figcaption>컨셉 이미지{requested !== shown && <span> · {failed === requested ? '선택 이미지 로딩 실패' : '이미지 불러오는 중'}</span>}</figcaption>}
  </figure>;
}

export function contentTiming(style) {
  const duration = style.getPropertyValue('--motion-content').trim();
  // Production CSS may normalize 280ms to .28s; WAAPI always needs milliseconds.
  return { duration: parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000) || 280, easing: style.getPropertyValue('--ease-out').trim() || 'cubic-bezier(.23,1,.32,1)' };
}

export function ContentReveal({ value, instant, children, className = '' }) {
  const node = useRef(null);
  const animation = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const current = getComputedStyle(node.current);
    const running = animation.current?.playState === 'running';
    const from = { opacity: running ? current.opacity : .55, transform: running ? current.transform : 'translateY(8px)' };
    animation.current?.cancel();
    if (!reduced && !instant) animation.current = node.current.animate([from, { opacity: 1, transform: 'translateY(0px)' }], contentTiming(current));
  }, [value, instant, reduced]);
  useEffect(() => () => animation.current?.cancel(), []);
  return <div ref={node} className={className} data-content-reveal>{children}</div>;
}

export function selectKey(event, selected, count, choose) {
  const destination = { ArrowRight: (selected + 1) % count, ArrowDown: (selected + 1) % count, ArrowLeft: (selected + count - 1) % count, ArrowUp: (selected + count - 1) % count, Home: 0, End: count - 1 }[event.key];
  if (destination === undefined || !count) return;
  event.preventDefault(); choose(destination, true);
  event.currentTarget.querySelectorAll('[role="tab"]')[destination]?.focus({ preventScroll: true });
}
