'use client';

import { createContext, useEffect, useMemo, useState } from 'react';
import { preloadImages } from './image-preload.mjs';
import styles from './LoadingGate.module.css';

export const ScenePreparationContext = createContext({ imagesReady:true, onReady:() => {} });

export default function LoadingGate({ images, children }) {
  const [attempt, setAttempt] = useState({ urls:images, base:0 });
  const [loaded, setLoaded] = useState(0);
  const [failures, setFailures] = useState([]);
  const [phase, setPhase] = useState('loading');
  const [sceneReady, setSceneReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const blocked = phase !== 'open';
  const percent = images.length ? Math.floor(loaded / images.length * 100) : 100;
  const imagesReady = phase !== 'loading' && phase !== 'error';
  const preparation = useMemo(() => ({ imagesReady, onReady:setSceneReady }), [imagesReady]);

  useEffect(() => {
    const controller = new AbortController();
    setHydrated(true); setPhase('loading'); setFailures([]);
    preloadImages(attempt.urls, {
      signal:controller.signal,
      onProgress:({loaded}) => setLoaded(attempt.base + loaded),
    }).then(failed => {
      if (controller.signal.aborted) return;
      setFailures(failed); setPhase(failed.length ? 'error' : 'prepared');
    }).catch(() => {
      if (!controller.signal.aborted) { setFailures(attempt.urls); setPhase('error'); }
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (phase === 'prepared' && sceneReady) setPhase('leaving');
  }, [phase, sceneReady]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = setTimeout(() => setPhase('open'), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!blocked) return;
    const html = document.documentElement, body = document.body;
    const previous = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden';
    const stop = event => { event.preventDefault(); event.stopPropagation(); };
    const key = event => { if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key) && !event.target.closest('button')) event.preventDefault(); };
    window.addEventListener('wheel',stop,{capture:true,passive:false});
    window.addEventListener('touchmove',stop,{capture:true,passive:false});
    window.addEventListener('keydown',key,true);
    return () => {
      [html.style.overflow, body.style.overflow] = previous;
      window.removeEventListener('wheel',stop,true); window.removeEventListener('touchmove',stop,true); window.removeEventListener('keydown',key,true);
    };
  }, [blocked]);

  return <>
    <ScenePreparationContext.Provider value={preparation}><div className={styles.content} data-loading-content data-loading={!imagesReady} inert={hydrated && blocked} aria-hidden={hydrated && blocked ? true : undefined}>{children}</div></ScenePreparationContext.Provider>
    {blocked && <section className={styles.loader} data-asset-loader data-phase={phase} aria-label="포트폴리오 준비" style={{'--load-progress':loaded / Math.max(1,images.length)}}>
      <div className={styles.center}>
        <div className={styles.signature}><span>Ideas in motion</span><div className={styles.wordmark} aria-label="Portfolio">PORT<br/>FOLIO<svg className={styles.symbol} viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M19 36 60 12l41 24v48l-41 24-41-24V36Z M19 36l41 24 41-24M60 60v48M60 12v48M19 84l41-24 41 24"/></svg></div></div>
        <div className={styles.statement}><span className={styles.ticks} aria-hidden="true"/><p>생각을 움직이는 경험으로.</p></div>
        {phase === 'error' && <div className={styles.actions}><button onClick={() => setAttempt({urls:failures,base:loaded})}>다시 시도</button><button onClick={() => setPhase('prepared')}>일부 이미지 없이 보기</button></div>}
      </div>
      <div className={styles.loading}>
        <div className={styles.numbers}><i aria-hidden="true"/><strong>{String(percent).padStart(2,'0')}<small>%</small></strong><span className={styles.count}>{loaded} / {images.length}</span><p className={styles.message} role="status">{phase === 'error' ? `이미지 ${failures.length}개를 불러오지 못했습니다.` : phase === 'prepared' ? '화면을 준비하고 있습니다.' : phase === 'leaving' ? '포트폴리오를 엽니다.' : '이미지를 불러오고 있습니다.'}</p></div>
        <div className={styles.track} role="progressbar" aria-label="이미지 로딩" aria-valuemin={0} aria-valuemax={images.length || 1} aria-valuenow={loaded} aria-valuetext={`${images.length}개 중 ${loaded}개 준비됨`}><span/></div>
      </div>
    </section>}
    <noscript><style>{'[data-asset-loader]{display:none!important}[data-loading-content]{visibility:visible!important}html,body{overflow:auto!important}'}</style></noscript>
  </>;
}
