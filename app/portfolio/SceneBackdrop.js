'use client';
import { useContext, useEffect, useRef } from 'react';
import { assetUrl } from './config.mjs';
import { visualFor } from './chapter-timeline.mjs';
import { videoFrameTime } from './timeline.mjs';
import { createBackdropRenderer } from './backdrop-renderer.mjs';
import styles from './SceneBackdrop.module.css';
import { ScenePreparationContext } from './LoadingGate';

export default function SceneBackdrop({ profile, ids, state, paused, reduced }) {
  const root=useRef(null), surface=useRef(null), maskTransfer=useRef(null), latest=useRef({paused,reduced});
  const { onReady, wallpaperActive }=useContext(ScenePreparationContext);
  latest.current={paused,reduced,wallpaperActive};
  useEffect(()=>{
    const node=root.current, owner=node.parentElement, canvas=surface.current, cache=new Map();
    const fallbacks=[...node.querySelectorAll('img')], atmosphere=node.querySelector('[data-wallpaper-atmosphere]'), reportedScenes=new Set();
    let renderer=null, fieldReady=false, frame=0, disposed=false, painted=0, liveTime=0, lastTime=null, lastPaint=0, dirty=true;
    const measuring=new URLSearchParams(location.search).has('motionMetrics');
    let observer, drawTotal=0, drawMax=0, longTasks=0, longTaskMax=0;
    if(measuring&&typeof PerformanceObserver!=='undefined'){
      try{observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){longTasks++;longTaskMax=Math.max(longTaskMax,entry.duration);}Object.assign(node.dataset,{longTasks:String(longTasks),longTaskMaxMs:longTaskMax.toFixed(1)});});observer.observe({type:'longtask'});}catch{}
    }
    try{renderer=createBackdropRenderer(canvas);}catch{}
    const request=(force=true)=>{if(force)dirty=true;if(!disposed&&!frame&&!document.hidden)frame=requestAnimationFrame(paint);};
    const dissolveField=new Image();
    dissolveField.onload=()=>{
      if(disposed)return;
      if(renderer){try{renderer.setDissolveField(dissolveField);}catch{renderer.dispose();renderer=null;canvas.style.opacity='0';}}
      fieldReady=true;
      request();
    };
    dissolveField.onerror=request;
    dissolveField.src=assetUrl('/art/transitions/field-forward.png');
    function media(index){
      if(cache.has(index))return cache.get(index);
      const visual=visualFor(profile,ids[index]), entry={visual,source:null,aspect:16/9,revision:0,progress:0,position:[.5,.5],contain:visual.fit==='contain',video:null,loop:ids[index]==='preview'};
      cache.set(index,entry);
      const poster=new Image();poster.crossOrigin='anonymous';entry.poster=poster;
      poster.onload=()=>{if(disposed||cache.get(index)!==entry)return;if(entry.video&&entry.source===entry.video)return;entry.source=poster;entry.aspect=poster.naturalWidth/poster.naturalHeight;entry.revision++;request();};
      entry.posterUrl=assetUrl(visual.src || '/art/archive/paper.webp');
      poster.onerror=()=>{node.dataset.mediaError='poster';if(!entry.posterFailed){entry.posterFailed=true;entry.posterUrl=assetUrl('/art/archive/paper.webp');poster.src=entry.posterUrl;}request();};poster.src=entry.posterUrl;
      entry.retire=()=>{poster.onload=poster.onerror=null;if(entry.video){entry.video.pause();entry.video.removeAttribute('src');entry.video.load();}clearTimeout(entry.timeout);};
      return entry;
    }
    function video(entry){
      if(!entry.visual.videoSrc||entry.video||latest.current.reduced)return;
      const player=document.createElement('video');entry.video=player;
      player.crossOrigin='anonymous';player.muted=true;player.playsInline=true;player.preload='auto';player.loop=entry.loop;
      const finish=()=>{
        if(disposed||!cacheHas(entry)||player.seeking||player.readyState<2)return;
        clearTimeout(entry.timeout);entry.source=player;entry.aspect=player.videoWidth/player.videoHeight;entry.revision++;request();
      };
      const fail=()=>{clearTimeout(entry.timeout);player.onerror=null;player.pause();player.removeAttribute('src');player.load();entry.source=entry.poster.complete&&entry.poster.naturalWidth?entry.poster:null;entry.aspect=entry.poster.naturalWidth/entry.poster.naturalHeight||16/9;entry.revision++;node.dataset.mediaError='video';request();};
      player.onloadedmetadata=request;player.onloadeddata=finish;player.onseeked=finish;player.onerror=fail;
      const retire=entry.retire;entry.retire=()=>{player.onloadedmetadata=player.onloadeddata=player.onseeked=player.onerror=null;retire();};
      entry.timeout=setTimeout(fail,8000);player.src=assetUrl(entry.visual.videoSrc);player.load();
    }
    const cacheHas=entry=>[...cache.values()].includes(entry);
    function paint(now){
      frame=0;if(disposed||document.hidden)return;
      if(!dirty&&now-lastPaint<1000/60){request(false);return;}
      dirty=false;lastPaint=now;
      const started=measuring?performance.now():0;
      const scene=state.get(), current=scene.index, next=scene.next;
      const live=current===0 && latest.current.wallpaperActive && !latest.current.paused && !latest.current.reduced;
      if(live && lastTime!==null)liveTime+=Math.min(50,now-lastTime)/1000;
      lastTime=live?now:null;
      const a=media(current), b=media(next);
      if(current>0)media(current-1);
      for(const [index,entry] of cache){if(index<current-1||index>next){entry.retire();cache.delete(index);}}
      for(const [index,entry] of cache){if(index!==current&&index!==next&&entry.video){entry.retire();cache.delete(index);}}
      if(!latest.current.paused)a.progress=latest.current.reduced?0:current===0?.5:scene.media;
      if(b!==a)b.progress=0;
      [a,b].forEach(entry=>{
        const position=innerWidth<700?(entry.visual.mobilePosition||entry.visual.position):entry.visual.position;
        entry.position=(position||'50% 50%').split(/\s+/).slice(0,2).map(value=>Math.max(0,Math.min(1,(parseFloat(value)||0)/100)));
        if(entry.position.length<2)entry.position.push(.5);
        video(entry);
        const player=entry.video;
        if(player && entry.loop){
          if(live && entry===a && player.paused && player.readyState>=2 && !entry.playRequested && !entry.playFailed){
            entry.playRequested=true;player.play().catch(()=>{entry.playFailed=true;}).finally(()=>{entry.playRequested=false;});
          }
          if(!live || entry!==a)player.pause();
          if(entry.lastVideoTime!==player.currentTime && entry.source===player){entry.lastVideoTime=player.currentTime;entry.revision++;}
        } else if(player&&Number.isFinite(player.duration)&&!player.seeking&&!latest.current.paused){
          const time=videoFrameTime(entry.progress,player.duration,entry.visual.fps||30);
          if(entry.target!==time&&Math.abs(player.currentTime-time)>.001){entry.target=time;player.currentTime=time;}
        }
      });
      const blend=latest.current.reduced?0:scene.dissolve;
      [a,b].forEach((entry,index)=>{
        const img=fallbacks[index], url=entry.posterUrl;
        if(img.getAttribute('src')!==url)img.src=url;
        img.style.objectPosition=(innerWidth<700?entry.visual.mobilePosition:null)||entry.visual.position||'50% 50%';
        img.style.objectFit=entry.visual.fit||'cover';img.style.opacity=String(index?blend:1);
        img.style.transform=latest.current.reduced?'none':`scale(${1.04+.08*entry.progress}) translateY(${(entry.progress-.5)*-2}%)`;
      });
      if(!a.source)canvas.style.opacity='0';
      if(renderer&&a.source&&(blend===0||b.source)){
        try{renderer.draw(a,b.source?b:a,blend,latest.current.reduced,node.clientWidth,node.clientHeight,{time:liveTime,ambient:current===0&&!latest.current.reduced?1-blend:0});canvas.style.opacity='1';}
        catch{renderer.dispose();renderer=null;canvas.style.opacity='0';}
      }
      maskTransfer.current?.setAttribute('intercept',String(.5-blend/.016));
      owner.dataset.sceneMask=renderer&&fieldReady?'noise':'fade';
      if(a.source&&!reportedScenes.has(current)){reportedScenes.add(current);onReady(ids[current]);}
      if(measuring){const cost=performance.now()-started;drawTotal+=cost;drawMax=Math.max(drawMax,cost);Object.assign(node.dataset,{drawMaxMs:drawMax.toFixed(2),drawMeanMs:(drawTotal/(painted+1)).toFixed(2),longTasks:String(longTasks),longTaskMaxMs:longTaskMax.toFixed(1)});}
      Object.assign(node.dataset,{scene:ids[current],progress:scene.progress.toFixed(4),dissolve:blend.toFixed(4),frames:String(++painted),renderer:renderer?'gpu':'image',effect:renderer?'noise-contour':'crossfade',players:String([...cache.values()].filter(entry=>entry.video?.getAttribute('src')).length),videoTime:String(a.video?.currentTime||0),live:String(live),ambientTime:liveTime.toFixed(2)});
      atmosphere.style.opacity=String(current===0&&!latest.current.reduced?1-blend:0);
      if(live)request(false);
    }
    const lost=event=>{event.preventDefault();renderer=null;canvas.style.opacity='0';request();};
    const visibility=()=>{lastTime=null;if(document.hidden){cache.forEach(entry=>entry.video?.pause());}else request();};
    const unsubscribe=state.on('change',request);
    canvas.addEventListener('webglcontextlost',lost);window.addEventListener('resize',request);document.addEventListener('visibilitychange',visibility);
    node.addEventListener('scene-settings',request);request();
    return()=>{disposed=true;delete owner.dataset.sceneMask;dissolveField.onload=dissolveField.onerror=null;observer?.disconnect();cancelAnimationFrame(frame);unsubscribe();cache.forEach(entry=>entry.retire());cache.clear();renderer?.dispose();canvas.removeEventListener('webglcontextlost',lost);window.removeEventListener('resize',request);document.removeEventListener('visibilitychange',visibility);node.removeEventListener('scene-settings',request);};
  },[profile,ids,state,onReady]);
  useEffect(()=>{root.current?.dispatchEvent(new Event('scene-settings'));},[paused,reduced,wallpaperActive]);
  return <div ref={root} className={styles.backdrop} data-scene-backdrop aria-hidden="true">
    <svg width="0" height="0" aria-hidden="true"><defs>
      <filter id="scene-dissolve-threshold" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2 0 -.075 0 -.4625"/>
        <feComponentTransfer><feFuncA ref={maskTransfer} type="linear" slope="62.5" intercept=".5"/></feComponentTransfer>
        <feComponentTransfer><feFuncA type="table" tableValues="0 .042969 .15625 .316406 .5 .683594 .84375 .957031 1"/></feComponentTransfer>
      </filter>
      <mask id="scene-dissolve" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1" style={{maskType:'alpha'}}>
        <image href={assetUrl('/art/transitions/field-forward.png')} width="1" height="1" preserveAspectRatio="none" filter="url(#scene-dissolve-threshold)"/>
      </mask>
    </defs></svg>
    <img alt=""/><img alt=""/><canvas ref={surface}/><div className={styles.atmosphere} data-wallpaper-atmosphere>{Array.from({length:8},(_,index)=><i key={index} style={{left:`${47+index*6}%`,top:`${12+(index*17)%72}%`,animationDelay:`${-index*2}s`}}/>)}</div></div>;
}
