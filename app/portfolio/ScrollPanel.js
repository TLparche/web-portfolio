'use client';
import { createContext, Fragment, useContext, useLayoutEffect, useRef, useState } from 'react';
import { animate, useMotionValue } from 'motion/react';
import { componentReveal, READING_POSITION, revealAt } from './chapter-timeline.mjs';
import { SCROLL_RESPONSE } from './scroll-response.mjs';
import { dissolveTone } from './dissolve.mjs';
import { ScenePreparationContext } from './LoadingGate';

export const InitialChapterAnchorContext = createContext(true);

export default function ScrollPanel({ index, state, staged, reduced, className, children }) {
  const ref = useRef(null);
  const { arrival } = useContext(ScenePreparationContext);
  const [visible,setVisible] = useState(true);
  const [visit,setVisit] = useState(0);
  const replay = useMotionValue(1);
  useLayoutEffect(() => {
    let previous = state.get().index, pending = replay.get() < 1, animation;
    const track = scene => {
      if (previous === index && scene.index !== index) {
        animation?.stop(); pending = true; replay.jump(0);
        setVisit(value => value + 1);
      }
      previous = scene.index;
      if (!staged || reduced) {
        pending = false;
        if (replay.get() !== 1) replay.jump(1);
      } else if (pending && scene.index === index && scene.dissolve === 0) {
        pending = false;
        animation = animate(replay, READING_POSITION, {duration:SCROLL_RESPONSE.revealDuration / 1000,ease:'linear',onComplete:() => replay.set(1)});
      }
    };
    track(state.get());
    const unsubscribe = state.on('change',track);
    return () => { unsubscribe(); animation?.stop(); };
  },[index,state,staged,reduced,replay]);
  useLayoutEffect(() => {
    if (!staged) { setVisible(true); return; }
    if (!ref.current) return;
    const node = ref.current;
    let nodes = [], previousVisible;
    const paint = () => {
      const scene = state.get(), active = scene.index === index;
      const progress = active ? Math.min(scene.progress, !reduced && arrival ? arrival.get() : 1, replay.get()) : 0;
      const opacity = reduced ? Number(active) : revealAt(progress);
      const shown = opacity > .05;
      const dissolving = active && scene.dissolve > 0;
      const interactive = shown && !dissolving;
      const tone = active && !reduced ? dissolveTone(scene.dissolve) : 0;
      node.style.opacity = String(opacity * (active ? 1-scene.dissolve : 1));
      node.style.filter = tone ? `grayscale(${tone}) brightness(${1-.2*tone})` : '';
      node.style.visibility = opacity > .001 ? 'visible' : 'hidden';
      node.style.contentVisibility = Math.abs(scene.index-index)>1 ? 'hidden' : '';
      node.style.pointerEvents = interactive ? 'auto' : 'none';
      node.dataset.dissolving = String(dissolving);
      node.dataset.replaying = String(active && !reduced && !dissolving && replay.get() < 1);
      node.dataset.chapterProgress = progress.toFixed(4);
      node.inert = !interactive;
      node.setAttribute('aria-hidden',String(!interactive));
      if (shown !== previousVisible) {
        previousVisible = shown; setVisible(shown);
      }
      for (const element of nodes) {
        const group = Number(element.dataset.reveal) || 0;
        const style = componentReveal(progress, group, element.dataset.revealKind, reduced, element.dataset.revealPhase);
        Object.assign(element.style, style);
        element.inert = style.opacity !== '' && Number(style.opacity) < .12;
      }
    };
    const scan = () => { nodes = [...node.querySelectorAll('[data-reveal]')]; paint(); };
    scan();
    const unsubscribe = state.on('change',paint);
    const unsubscribeArrival = arrival?.on('change',paint);
    const unsubscribeReplay = replay.on('change',paint);
    const observer = new MutationObserver(scan); observer.observe(node,{childList:true,subtree:true});
    return () => { unsubscribe(); unsubscribeArrival?.(); unsubscribeReplay(); observer.disconnect(); node.style.contentVisibility=''; node.style.opacity=''; node.style.filter=''; node.style.visibility=''; node.style.pointerEvents=''; node.inert=false; node.removeAttribute('aria-hidden'); delete node.dataset.dissolving; delete node.dataset.replaying; nodes.forEach(el=>{el.style.opacity='';el.style.translate='';el.style.clipPath='';el.inert=false;}); };
  },[index,state,staged,reduced,arrival,replay,visit]);
  return <div ref={ref} className={className} data-panel data-scroll-panel data-visible={visible}><InitialChapterAnchorContext.Provider value={visit === 0}><Fragment key={visit}>{typeof children === 'function' ? children(visible) : children}</Fragment></InitialChapterAnchorContext.Provider></div>;
}
