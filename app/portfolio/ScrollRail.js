'use client';
import { useEffect, useRef } from 'react';
import { clamp } from './timeline.mjs';
import styles from './Portfolio.module.css';

export default function ScrollRail({ container, position, onScroll }) {
  const input = useRef(null), limit = useRef(0);
  useEffect(() => {
    const update = value => {
      const percent = limit.current > 0 ? clamp(value / limit.current) * 100 : 0;
      input.current.value = percent;
      input.current.setAttribute('aria-valuetext', `${Math.round(percent)}%`);
    };
    const measure = () => {
      limit.current = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      input.current.disabled = limit.current === 0;
      update(position.get());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    window.addEventListener('resize', measure);
    const unsubscribe = position.on('change', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); unsubscribe(); };
  }, [container, position]);

  function seek(top) {
    if (document.documentElement.style.overflow === 'hidden') return;
    window.scrollTo({ top: Math.max(0, Math.min(limit.current, top)), behavior: 'instant' });
    onScroll(window.scrollY);
  }

  function key(event) {
    const steps = { ArrowDown: 40, ArrowRight: 40, ArrowUp: -40, ArrowLeft: -40, PageDown: innerHeight * .85, PageUp: -innerHeight * .85 };
    if (!(event.key in steps) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); event.stopPropagation();
    seek(event.key === 'Home' ? 0 : event.key === 'End' ? limit.current : position.get() + steps[event.key]);
  }

  return <div className={styles.scrollRail} data-page-scrollbar>
    <input ref={input} type="range" min="0" max="100" step="any" defaultValue="0" aria-label="페이지 스크롤 위치" aria-orientation="vertical" aria-controls="main" onChange={event => seek(Number(event.currentTarget.value) / 100 * limit.current)} onKeyDown={key}/>
  </div>;
}
