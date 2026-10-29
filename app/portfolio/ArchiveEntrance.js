'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from '@phosphor-icons/react';
import { assetUrl } from './config.mjs';
import { followPointer, pointerCoordinate } from './entrance-motion.mjs';
import { LENS_ENTRY_DURATION, lensJourney } from './lens-journey.mjs';
import styles from './ArchiveEntrance.module.css';

export default function ArchiveEntrance({ phase, onEnter, still, onToggleStill, visual, profile }) {
  const scene=useRef(null), lens=useRef(null), reflection=useRef(null), light=useRef(null), portal=useRef(null), aperture=useRef(null);
  const landscape=useRef(null), bezel=useRef(null), portalView=useRef(null), portalRim=useRef(null);
  const finePointer=useRef(false), entering=useRef(false);
  const pointer=useRef({x:0,y:0}), target=useRef({x:0,y:0}), requestMove=useRef(()=>{}), stopMove=useRef(()=>{});
  const [engaged,setEngaged]=useState(false);
  const ready=phase==='sealed', opening=phase==='opening'||phase==='leaving';
  const src=assetUrl(visual.src);
  useEffect(()=>{
    let frame=0, lastTime=0;
    const viewport={width:scene.current.clientWidth,height:scene.current.clientHeight};
    const draw=()=>{
      if(!scene.current)return;
      const {x:px,y:py}=pointer.current;
      const cameraX=-px*viewport.width*.1, cameraY=-py*viewport.height*.2;
      const yaw=Math.atan2(cameraX*1.2,1700), pitch=Math.atan2(cameraY*1.2,Math.hypot(cameraX*1.2,1700));
      scene.current.style.transform=`perspective(1700px) translateZ(1700px) rotateX(${pitch}rad) rotateY(${-yaw}rad) translate3d(${-cameraX}px,${-cameraY}px,-3400px) scale(2)`;
      lens.current.style.transform='perspective(900px) rotateX('+(-py*6)+'deg) rotateY('+(px*6)+'deg)';
      reflection.current.style.transform='translate3d('+(px*110)+'px,'+(py*85)+'px,0)';
      light.current.style.transform='translate3d('+(px*110)+'px,'+(py*70)+'px,0)';
    };
    const tick=now=>{
      const point=pointer.current, goal=target.current, elapsed=now-lastTime;
      lastTime=now;frame=0;
      point.x=followPointer(point.x,goal.x,elapsed);point.y=followPointer(point.y,goal.y,elapsed);
      const settled=Math.abs(point.x-goal.x)+Math.abs(point.y-goal.y)<.0001;
      if(settled)Object.assign(point,goal);
      draw();
      if(!settled)frame=requestAnimationFrame(tick);
    };
    requestMove.current=()=>{if(!frame){lastTime=performance.now();frame=requestAnimationFrame(tick);}};
    stopMove.current=()=>{cancelAnimationFrame(frame);frame=0;Object.assign(target.current,pointer.current);};
    const query=matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
    const update=()=>{
      finePointer.current=query.matches;
      if(!query.matches){stopMove.current();Object.assign(pointer.current,{x:0,y:0});Object.assign(target.current,pointer.current);setEngaged(false);draw();}
    };
    update();query.addEventListener('change',update);
    const resize=new ResizeObserver(([entry])=>{viewport.width=entry.contentRect.width;viewport.height=entry.contentRect.height;draw();});
    resize.observe(scene.current);
    return()=>{cancelAnimationFrame(frame);resize.disconnect();query.removeEventListener('change',update);};
  },[]);
  useEffect(()=>{
    if(still)stopMove.current();
    if(opening)setEngaged(false);
  },[still,opening]);
  const follow=event=>{
    if(!finePointer.current||still||entering.current||event.pointerType==='touch')return;
    target.current.x=pointerCoordinate(event.clientX,event.currentTarget.clientWidth);
    target.current.y=pointerCoordinate(event.clientY,event.currentTarget.clientHeight);
    requestMove.current();
  };
  const leave=()=>setEngaged(false);
  const enter=()=>{
    if(!ready||entering.current)return;
    entering.current=true;stopMove.current();
    const image=landscape.current;
    if(image.naturalWidth&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
      const position=getComputedStyle(image).objectPosition.split(/\s+/).map(value=>parseFloat(value)/100);
      const journey=lensJourney(aperture.current.getBoundingClientRect(),image.getBoundingClientRect(),{width:portal.current.clientWidth,height:portal.current.clientHeight},{width:image.naturalWidth,height:image.naturalHeight},position,visual.fit);
      const rim=bezel.current.getBoundingClientRect();
      for(const [key,value] of Object.entries(journey.end))portalView.current.style[key]=value+'px';
      for(const key of ['left','top','width','height'])portalRim.current.style[key]=rim[key]+'px';
      portalRim.current.style.transformOrigin=`${journey.x-rim.left}px ${journey.y-rim.top}px`;
      const timing={duration:LENS_ENTRY_DURATION,easing:'cubic-bezier(.77,0,.175,1)',fill:'forwards'};
      portal.current.animate(journey.clip.map(clipPath=>({clipPath})),timing);
      portalView.current.animate(journey.view,{...timing,duration:LENS_ENTRY_DURATION-180});
      portalRim.current.animate([{transform:'translate3d(0,0,0) scale(1)'},{transform:journey.rimTransform}],timing);
    }
    onEnter();
  };
  const hover=()=>{if(finePointer.current&&ready)setEngaged(true);};
  const imageStyle={'--position':visual.position||'50% 50%','--mobile-position':visual.mobilePosition||visual.position||'50% 50%',objectFit:visual.fit||'cover'};
  return <div className={styles.entrance} data-archive-entrance data-opening={opening} data-still={still} data-ready={ready} data-engaged={engaged} onPointerMove={follow} onPointerLeave={leave}>
    <div className={styles.room} ref={scene} aria-hidden="true"><img src={assetUrl('/art/archive/entrance-atelier.webp')} width="1672" height="941" alt="" fetchPriority="high"/></div>
    <div className={styles.ambient} aria-hidden="true"><div className={styles.sunlight} ref={light}/><div className={styles.motes}>{Array.from({length:14},(_,index)=><i key={index} style={{left:(12+(index*19)%80)+'%',top:(8+(index*23)%75)+'%',animationDelay:(-index*1.3)+'s'}}/>)}</div></div>
    <div className={styles.shade} aria-hidden="true"/>
    <div className={styles.aura} aria-hidden="true"/>
    <div className={styles.instrument}>
      <div className={styles.shadow} aria-hidden="true"/>
      <div className={styles.lensMotion} ref={lens}>
          <button className={styles.lens} onClick={enter} disabled={!ready} aria-label="관측 렌즈를 열어 포트폴리오로 들어가기" aria-describedby="archive-invitation" onPointerEnter={hover} onPointerLeave={()=>setEngaged(false)}>
            <span className={styles.aperture} ref={aperture}>
              <img className={styles.landscape} ref={landscape} src={src} alt="" style={imageStyle}/>
              <span className={styles.glass}/><span className={styles.reflection} ref={reflection}/>
              <span className={styles.constellation} aria-hidden="true"><i/><i/><i/></span>
              <span className={styles.frost}/><span className={styles.lensHint}>들어가기</span>
            </span>
            <img className={styles.bezel} ref={bezel} src={assetUrl('/art/archive/entrance-lens.webp')} width="840" height="840" alt=""/>
            <span className={styles.ripple} aria-hidden="true"/>
          </button>
      </div>
    </div>
    <div className={styles.journey} aria-hidden="true">
      <div className={styles.portal} ref={portal}><img className={styles.portalView} ref={portalView} src={src} alt="" style={imageStyle}/></div>
      <img className={styles.portalRim} ref={portalRim} src={assetUrl('/art/archive/entrance-lens.webp')} alt=""/>
    </div>
    <span className={styles.brand}>{profile.name || 'Portfolio'}<span>{profile.tagline}</span></span>
    <div className={styles.invitation}>
      <h1>기록 너머의 이야기</h1>
      <p id="archive-invitation">{ready?'렌즈 너머에, 작은 질문들이 만든 세계가 있습니다.':opening?'기록 속으로 들어갑니다.':'첫 번째 이야기를 준비하고 있습니다.'}</p>
    </div>
    <button className={styles.pause} onClick={onToggleStill} aria-pressed={still} aria-label={still?'배경 움직임 재생':'배경 움직임 멈춤'}>{still?<Play size={14} aria-hidden="true"/>:<Pause size={14} aria-hidden="true"/>}<span>{still?'움직임 재생':'움직임 멈춤'}</span></button>
  </div>;
}
