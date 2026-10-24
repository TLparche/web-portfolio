'use client';
import { lockPageScroll } from './scroll-lock.mjs';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import { preloadImages } from './image-preload.mjs';
import { sectionForAnchor } from './config.mjs';
import { visualFor } from './chapter-timeline.mjs';
import ArchiveEntrance from './ArchiveEntrance';
import { LENS_ENTRY_DURATION } from './lens-journey.mjs';
import styles from './LoadingGate.module.css';

export const ScenePreparationContext = createContext({imagesReady:true,onReady:()=>{},entranceOpening:false,wallpaperActive:true});

export default function LoadingGate({ sceneImages, sections, profile, children }) {
  const [attempt,setAttempt]=useState(0), [loaded,setLoaded]=useState(0), [total,setTotal]=useState(1);
  const [failures,setFailures]=useState([]), [phase,setPhase]=useState('loading'), [hydrated,setHydrated]=useState(false);
  const [entrance,setEntrance]=useState(true), [still,setStill]=useState(false);
  const [percent,setPercent]=useState(0);
  const progress=useMotionValue(0), reduced=useReducedMotion();
  const barTransform=useTransform(progress,value=>`scaleX(${value})`);
  useMotionValueEvent(progress,'change',value=>setPercent(Math.floor(value*100)));
  const entered=useRef(false), loadingStarted=useRef(0);
  const blocked=phase!=='open';
  const targetScene=useRef('preview');
  const [sceneReady,setSceneReady]=useState(false);
  const onReady=useCallback(id=>{if(id===targetScene.current)setSceneReady(true);},[]);
  const context=useMemo(()=>({imagesReady:phase!=='loading',onReady,entranceOpening:phase==='opening',wallpaperActive:phase==='open'}),[phase,onReady]);
  useEffect(()=>{
    const controller=new AbortController();let fontTimer;
    loadingStarted.current=performance.now();
    progress.jump(0);setPercent(0);
    const id=location.hash.slice(1), owner=sectionForAnchor(sections,id);
    setEntrance(!owner);
    targetScene.current=owner?.id || 'preview';
    const urls=sceneImages[owner?.id || 'preview'] || sceneImages.preview || [];
    setHydrated(true);setPhase('loading');setFailures([]);setLoaded(0);setTotal(urls.length+2);
    (async()=>{
      const failed=await preloadImages(urls,{signal:controller.signal,timeoutMs:8000,onProgress:({loaded})=>setLoaded(loaded)});
      await Promise.race([document.fonts.ready,new Promise(resolve=>{fontTimer=setTimeout(resolve,4000);})]);
      clearTimeout(fontTimer);
      if(controller.signal.aborted)return;
      setLoaded(urls.length-failed.length+1);setFailures(failed);setPhase(failed.length?'error':'prepared');
    })().catch(()=>{if(!controller.signal.aborted){setFailures(urls);setPhase('error');}});
    return()=>{controller.abort();clearTimeout(fontTimer);};
  },[attempt,sceneImages,sections,progress]);
  useEffect(()=>{
    if(phase!=='prepared'||sceneReady)return;
    if(reduced){setSceneReady(true);return;}
    const timer=setTimeout(()=>setPhase('error'),5000);
    return()=>clearTimeout(timer);
  },[phase,sceneReady,reduced]);
  useEffect(()=>{
    if(phase!=='prepared'||!sceneReady||percent<100)return;
    const timer=setTimeout(()=>setPhase(entrance?'sealed':'leaving'),Math.max(160,800-(performance.now()-loadingStarted.current)));
    return()=>clearTimeout(timer);
  },[phase,sceneReady,entrance,percent]);
  useEffect(()=>{
    if(phase!=='opening')return;
    const timer=setTimeout(()=>setPhase('leaving'),matchMedia('(prefers-reduced-motion:reduce)').matches?0:LENS_ENTRY_DURATION);
    return()=>clearTimeout(timer);
  },[phase]);
  useEffect(()=>{
    if(phase==='open'&&entered.current){
      const heading=document.getElementById('preview-name');
      heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
    }
  },[phase]);
  useEffect(()=>{
    if(phase!=='leaving')return;
    const timer=setTimeout(()=>setPhase('open'),reduced?0:entrance?300:600);
    return()=>clearTimeout(timer);
  },[phase,entrance,reduced]);
  useEffect(()=>{
    if(!blocked)return;
    const releaseScroll = lockPageScroll(document);
    const stop=event=>{event.preventDefault();event.stopPropagation();};
    const key=event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)&&!event.target.closest('button'))event.preventDefault();};
    window.addEventListener('wheel',stop,{capture:true,passive:false});window.addEventListener('touchmove',stop,{capture:true,passive:false});window.addEventListener('keydown',key,true);
    return()=>{releaseScroll();window.removeEventListener('wheel',stop,true);window.removeEventListener('touchmove',stop,true);window.removeEventListener('keydown',key,true);};
  },[blocked]);
  const prepared=Math.min(total,loaded+Number(sceneReady));
  const target=phase==='prepared'&&sceneReady?1:Math.min(.99,prepared/total);
  useEffect(()=>{
    if(!hydrated||!['loading','prepared','error'].includes(phase))return;
    const animation=animate(progress,target,{duration:reduced?0:Math.max(.16,(target-progress.get())*.8),ease:'linear'});
    return()=>animation.stop();
  },[hydrated,phase,target,progress,reduced,attempt]);
  return <>
    <ScenePreparationContext.Provider value={context}><div data-loading-content inert={hydrated&&blocked} aria-hidden={hydrated&&blocked?true:undefined}>{children}</div></ScenePreparationContext.Provider>
    {blocked&&<section className={styles.loader} data-asset-loader data-phase={phase} data-entrance={entrance} aria-label={entrance?'포트폴리오 입구':'포트폴리오 준비'}>
      {entrance ? <ArchiveEntrance profile={profile} phase={phase} visual={visualFor(profile,'preview')} still={still} onToggleStill={()=>setStill(value=>!value)} onEnter={()=>{if(phase==='sealed'){entered.current=true;setPhase('opening');}}}/> : <><span className={styles.index}>PERSONAL ARCHIVE / 001</span><div className={styles.center}><span className={styles.eyebrow}>{profile.role}</span><h1>{profile.name || 'Portfolio'}</h1><p>{profile.tagline}</p><span className={styles.rule}/></div></>}
      {(!entrance||!['sealed','opening','leaving'].includes(phase))&&<div className={styles.loading}><div className={styles.meta}><span role="status">{phase==='error'?(failures.length?'일부 이미지를 준비하지 못했습니다.':'첫 배경을 준비하지 못했습니다.'):percent===100?'준비가 끝났습니다.':'첫 장면을 준비하고 있습니다.'}</span><strong>{String(percent).padStart(2,'0')}<small>%</small></strong></div>
        <div className={styles.track} role="progressbar" aria-label="첫 장면 준비" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><motion.span style={{transform:barTransform}}/></div>
        <div className={styles.caption}><span>첫 장면 준비</span><span>{prepared} / {total}</span></div>
        {phase==='error'&&<div className={styles.actions}><button onClick={()=>setAttempt(value=>value+1)}>다시 시도</button><button onClick={()=>setPhase(entrance?'sealed':'leaving')}>대체 배경으로 계속 보기</button>{failures.length>0&&<small>이미지 {failures.length}개</small>}</div>}
      </div>}
    </section>}
    <noscript><style>{'[data-asset-loader]{display:none!important}[data-loading-content]{visibility:visible!important}html,body{overflow:auto!important}'}</style></noscript>
  </>;
}
