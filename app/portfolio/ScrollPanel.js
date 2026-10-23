'use client';
import { useEffect, useRef, useState } from 'react';
import { revealAt } from './chapter-timeline.mjs';

export default function ScrollPanel({ index, state, staged, reduced, className, children }) {
  const ref = useRef(null);
  const [visible,setVisible] = useState(true);
  useEffect(() => {
    if (!staged) { setVisible(true); return; }
    if (!ref.current) return;
    const node = ref.current;
    let nodes = [], previousVisible;
    const paint = () => {
      const scene = state.get(), active = scene.index === index;
      const progress = active ? scene.progress : 0;
      const opacity = reduced ? Number(active) : revealAt(progress);
      const shown = opacity > .05;
      const dissolving = active && scene.dissolve > 0;
      const interactive = shown && !dissolving;
      node.style.opacity = String(opacity * (active ? 1-scene.dissolve : 1));
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
        const value = reduced ? 1 : revealAt(progress,group);
        element.style.opacity = String(value);
        element.style.transform = reduced ? 'none' : `translateY(${(1-value)*14}px)`;
      }
    };
    const scan = () => { nodes = [...node.querySelectorAll('[data-reveal]')]; paint(); };
    scan();
    const unsubscribe = state.on('change',paint);
    const observer = new MutationObserver(scan); observer.observe(node,{childList:true,subtree:true});
    return () => { unsubscribe(); observer.disconnect(); node.style.contentVisibility=''; node.style.opacity=''; node.style.visibility=''; node.style.pointerEvents=''; node.inert=false; node.removeAttribute('aria-hidden'); delete node.dataset.dissolving; nodes.forEach(el=>{el.style.opacity='';el.style.transform='';}); };
  },[index,state,staged,reduced]);
  return <div ref={ref} className={className} data-panel data-scroll-panel data-visible={visible}>{typeof children === 'function' ? children(visible) : children}</div>;
}
