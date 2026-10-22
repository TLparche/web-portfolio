'use client';

import { useEffect, useRef } from 'react';
import { assetUrl } from './config.mjs';
import styles from './ArchiveEntrance.module.css';

export default function ArchiveEntrance({ phase, onEnter, still, onToggleStill }) {
  const parallax=useRef(null), light=useRef(null), finePointer=useRef(false);
  const ready=phase==='sealed', opening=phase==='opening'||phase==='leaving';
  useEffect(()=>{
    const query=matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
    const update=()=>{finePointer.current=query.matches;};update();
    query.addEventListener('change',update);return()=>query.removeEventListener('change',update);
  },[]);
  const reset=()=>{if(parallax.current)parallax.current.style.transform='translate3d(0,0,0)';if(light.current)light.current.style.transform='translate3d(0,0,0)';};
  useEffect(()=>{if(still||opening)reset();},[still,opening]);
  const follow=event=>{
    if(!finePointer.current||still||opening||event.pointerType==='touch')return;
    const x=event.clientX/innerWidth-.5,y=event.clientY/innerHeight-.5;
    parallax.current.style.transform='translate3d('+(-x*18)+'px,'+(-y*12)+'px,0)';
    light.current.style.transform='translate3d('+(x*30)+'px,'+(y*18)+'px,0)';
  };
  return <div className={styles.entrance} data-archive-entrance data-opening={opening} data-still={still} data-ready={ready} onPointerMove={follow} onPointerLeave={reset}>
    <div className={styles.scene}>
      <div className={styles.parallax} ref={parallax}>
        <div className={styles.world}>
          <img className={styles.closed} src={assetUrl('/art/archive/entrance-closed.webp')} width="1672" height="941" alt="햇빛이 비치는 연구 노트와 책 사이에 놓인 잠긴 기록 상자" fetchPriority="high"/>
          <img className={styles.opened} src={assetUrl('/art/archive/entrance-open.webp')} width="1672" height="941" alt=""/>
          <button className={styles.seal} onClick={onEnter} disabled={!ready} aria-label="상자 봉인 열기" aria-describedby="archive-invitation"><span aria-hidden="true"/><i aria-hidden="true"/></button>
        </div>
      </div>
      <div className={styles.sunlight} ref={light} aria-hidden="true"/>
      <div className={styles.dust} aria-hidden="true">{Array.from({length:12},(_,index)=><i key={index} style={{left:(12+(index*19)%80)+'%',top:(8+(index*23)%70)+'%',animationDelay:(-index*1.3)+'s'}}/>)}</div>
    </div>
    <div className={styles.shade} aria-hidden="true"/>
    <div className={styles.bloom} aria-hidden="true"/>
    <span className={styles.brand}>Portfolio</span>
    <div className={styles.invitation}>
      <h1>기록 너머의 이야기</h1>
      <p id="archive-invitation">{ready?'상자의 봉인이나 버튼을 눌러 열어 주세요.':opening?'첫 페이지로 들어갑니다.':'상자 안의 이야기를 준비하고 있습니다.'}</p>
      <button className={styles.open} onClick={onEnter} disabled={!ready}><span aria-hidden="true">◇</span><span>{opening?'이야기를 여는 중':'기록 상자 열기'}</span><span aria-hidden="true">◇</span></button>
    </div>
    <button className={styles.pause} onClick={onToggleStill} aria-pressed={still}>{still?'배경 움직임 재생':'배경 움직임 멈춤'}</button>
  </div>;
}
