'use client';
import { useContext, useEffect, useRef, useState } from 'react';
import { componentReveal, revealAt } from './chapter-timeline.mjs';
import { dissolveTone } from './dissolve.mjs';
import { ScenePreparationContext } from './LoadingGate';

export default function ScrollPanel({ index, state, staged, reduced, className, children }) {
  const ref = useRef(null);
  const { arrival } = useContext(ScenePreparationContext);
  const [visible,setVisible] = useState(true);
  useEffect(() => {
    if (!staged) { setVisible(true); return; }
    if (!ref.current) return;
    const node = ref.current;
    let nodes = [], previousVisible;
    const paint = () => {
      const scene = state.get(), active = scene.index === index;
      const progress = active ? Math.min(scene.progress, !reduced && arrival ? arrival.get() : 1) : 0;
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
    const observer = new MutationObserver(scan); observer.observe(node,{childList:true,subtree:true});
    return () => { unsubscribe(); unsubscribeArrival?.(); observer.disconnect(); node.style.contentVisibility=''; node.style.opacity=''; node.style.filter=''; node.style.visibility=''; node.style.pointerEvents=''; node.inert=false; node.removeAttribute('aria-hidden'); delete node.dataset.dissolving; nodes.forEach(el=>{el.style.opacity='';el.style.translate='';el.style.clipPath='';el.inert=false;}); };
  },[index,state,staged,reduced,arrival]);
  return <div ref={ref} className={className} data-panel data-scroll-panel data-visible={visible}>{typeof children === 'function' ? children(visible) : children}</div>;
}
