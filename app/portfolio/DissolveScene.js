'use client';

import { useContext, useEffect, useRef } from 'react';
import { getFontEmbedCSS } from 'html-to-image';
import { assetUrl } from './config.mjs';
import { ScenePreparationContext } from './LoadingGate';
import { captureScene } from './scene-capture.mjs';
import { createDissolveRenderer as createCanvasRenderer } from './dissolve-canvas.mjs';
import { createDissolveRenderer as createGpuRenderer } from './dissolve-gpu.mjs';

/** Cache scene pixels once; Canvas 2D preserves the effect without hardware acceleration. */
export default function DissolveScene({ root, state, navigation, reduced, prepareTransition }) {
  const canvas = useRef(null);
  const { imagesReady, onReady:prepared } = useContext(ScenePreparationContext);
  useEffect(() => {
    const node = root.current, surface = canvas.current;
    if (!node || reduced) { if (node) { node.dataset.transitionReady='true'; node.dataset.transitionRenderer='reduced'; } prepared(true); return; }
    if (!imagesReady) return;
    const panels = [...node.querySelectorAll('[data-section]>[data-panel]')];
    const size = () => { surface.style.width=`${innerWidth}px`; surface.style.height=`${innerHeight}px`; };
    size();
    const cache = new Map(), dirty = new Set(), pending = new Map();
    let renderer, fonts, renderWidth = 720, rendererType = 'canvas', disposed = false, initialized = false, frame = 0, refreshTimer = 0;
    let active = null, generation = 0, handoff = 0, resizedScenes = null, lastPaint = 0;
    const image = async path => { const result = new Image(); result.src = assetUrl(path); await result.decode(); return result; };
    const hide = () => { node.dataset.transitionActive = 'false'; surface.style.visibility = 'hidden'; };
    const failure = error => {
      if (disposed) return;
      node.dataset.transitionError = String(error?.message || error);
      node.dataset.transitionRenderer = 'opacity';
      hide(); initialized = false; cancelAnimationFrame(frame); renderer?.dispose(); cache.clear(); prepared(true);
    };
    const capture = async index => {
      if (pending.has(index)) return pending.get(index);
      const version = generation;
      dirty.delete(index);
      const task = captureScene(panels[index], { fontEmbedCSS:fonts, pixelRatio:Math.min(1,renderWidth/innerWidth) })
        .then(scene => {
          if (!disposed && version === generation) {
            renderer.prepareScene?.(scene);
            (resizedScenes || cache).set(index, scene);
            surface.dataset.captureMs=JSON.stringify([...cache].map(([index,scene]) => ({index,...scene.captureMs})));
          }
          return scene;
        })
        .finally(() => pending.delete(index));
      pending.set(index, task);
      return task;
    };
    const transition = () => {
      const move = navigation.get(), value = state.get();
      if (move?.effect === 'dissolve') return { lower:Math.min(move.from,move.to), upper:Math.max(move.from,move.to), progress:move.direction>0?move.progress:1-move.progress, reverse:move.direction<0 };
      if (value.effect === 'dissolve' && value.transition > 0 && value.transition < 1) return { lower:value.index, upper:value.next, progress:value.transition, reverse:value.transition>.5 };
      return null;
    };
    const paint = now => {
      frame = 0;
      if (!initialized || disposed || document.hidden) return;
      const next = transition();
      if (!next) {
        if (active) {
          renderer.render({progress:active.progress>.5?1:0,reverse:active.reverse,time:now-active.started,width:innerWidth,height:innerHeight});
          active = null;
          // Keep the final texture until Motion has painted the live DOM endpoint.
          cancelAnimationFrame(handoff);
          handoff = requestAnimationFrame(() => { if (!transition()) hide(); });
          refresh();
        }
        return;
      }
      const key = `${next.lower}-${next.upper}`;
      if (!active || active.key !== key) {
        const lower = cache.get(next.lower), upper = cache.get(next.upper);
        if (!lower || !upper) return;
        try { renderer.setPair(lower, upper); } catch (error) { failure(error); return; }
        active = { ...next, key, started:now };
        lastPaint = now - 1000 / 30;
      }
      active.progress = next.progress;
      // Navigation stays at display refresh rate. The small noise masks need
      // only 30 updates per second, including the original paused breathing.
      const elapsed = now - lastPaint;
      if (rendererType === 'canvas' && elapsed < 1000 / 30 - .5) { frame = requestAnimationFrame(paint); return; }
      lastPaint += Math.max(1,Math.floor(elapsed / (1000 / 30))) * (1000 / 30);
      try {
        renderer.render({progress:next.progress,reverse:active.reverse,time:now-active.started,width:innerWidth,height:innerHeight});
        Object.assign(surface.dataset,{progress:String(next.progress),pair:key,reverse:String(active.reverse),frames:String(Number(surface.dataset.frames||0)+1)});
        surface.style.visibility = 'visible'; node.dataset.transitionActive = 'true';
        frame = requestAnimationFrame(paint);
      } catch (error) { failure(error); }
    };
    const request = () => { if (initialized && !frame && !document.hidden) frame = requestAnimationFrame(paint); };
    async function refresh(indices = [...dirty]) {
      clearTimeout(refreshTimer);
      if (!initialized || disposed || transition()) return;
      try {
        for (const index of indices) {
          if (!dirty.has(index)) { if (pending.has(index)) await pending.get(index); continue; }
          if (transition() || disposed) break;
          const animations = panels[index].getAnimations({subtree:true}).filter(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity);
          if (animations.length) await Promise.allSettled(animations.map(animation => animation.finished));
          if (transition() || disposed) break;
          await capture(index);
        }
        // Keep a complete old viewport until every new scene is ready. A second
        // resize can never pair textures from two different viewport sizes.
        if (resizedScenes?.size === panels.length) {
          cache.clear(); resizedScenes.forEach((scene,index) => cache.set(index,scene)); resizedScenes=null;
        }
        if (dirty.size && !transition()) refreshTimer = setTimeout(refresh,180);
      } catch (error) { failure(error); }
    }
    // A changed card/illustration must be captured before its first transition
    // frame, otherwise an older bitmap visibly replaces the user's selection.
    prepareTransition.current = indices => {
      if (!initialized || transition() || (!resizedScenes && !indices.some(index => dirty.has(index) || pending.has(index)))) return;
      const targets = resizedScenes ? panels.map((_,index) => index) : indices;
      return (async () => {
        try {
          await refresh(targets);
          await Promise.all(targets.map(index => pending.get(index)));
          if (targets.some(index => dirty.has(index))) await refresh(targets);
        } catch (error) { failure(error); }
      })();
    };
    const changed = records => {
      for (const record of records) {
        if (record.type === 'attributes' && record.oldValue === record.target.getAttribute(record.attributeName)) continue;
        if (record.target === node) { panels.forEach((_,index) => dirty.add(index)); continue; }
        const panel = record.target.closest?.('[data-panel]');
        const index = panels.indexOf(panel);
        if (index >= 0) dirty.add(index);
      }
      clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh,180);
    };
    const observer = new MutationObserver(changed);
    observer.observe(node,{attributes:true,attributeOldValue:true,attributeFilter:['data-ready','data-enhanced']});
    panels.forEach(panel => observer.observe(panel,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['src','data-shown-id','data-interest-state','data-interest-phase','data-category','data-view','data-selected-index','data-active','data-preview','aria-selected','data-interest-scroll-progress','data-interest-expanded','data-open']}));
    const resize = () => {
      size();
      generation++;
      if (initialized) resizedScenes = new Map(); else cache.clear();
      panels.forEach((_,index) => dirty.add(index));
      renderer?.resize(innerWidth,innerHeight);
      request(); clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh,180);
    };
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame=0; } else request(); };
    const lost = event => { event.preventDefault(); failure(new Error('Transition graphics context lost')); };
    const a = state.on('change',request), b = navigation.on('change',request);
    window.addEventListener('resize',resize); document.addEventListener('visibilitychange',visibility);
    surface.addEventListener('contextlost',lost);
    surface.addEventListener('webglcontextlost',lost);
    (async () => {
      const started = performance.now();
      try {
        await document.fonts.ready;
        // All source fonts are WOFF2 already. html-to-image's optional format
        // filter drops alternating font sources because its RegExp is stateful.
        const [forwardImage,reverseImage,fontCSS] = await Promise.all([image('/art/transitions/field-forward.png'),image('/art/transitions/field-reverse.png'),getFontEmbedCSS(node)]);
        if (disposed) return;
        fonts = fontCSS;
        surface.dataset.fontMs=String(Math.round(performance.now()-started));
        // Avoid software WebGL: Canvas 2D can retain the original noise field
        // with fewer output pixels. Settled content always uses the sharp DOM.
        if (surface.getContext('webgl',{failIfMajorPerformanceCaveat:true,preserveDrawingBuffer:true,alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'})) {
          renderer = createGpuRenderer(surface,{forwardImage,reverseImage});
          rendererType = 'gpu'; renderWidth = 1600;
        } else renderer = createCanvasRenderer(surface,{forwardImage,reverseImage});
        while (cache.size < panels.length) {
          for (let index=0;index<panels.length;index++) {
            if (!cache.has(index)) await capture(index);
            if (disposed) return;
          }
        }
        initialized = true; node.dataset.transitionReady = 'true';
        node.dataset.transitionRenderer = rendererType;
        await refresh(); surface.dataset.prepareMs=String(Math.round(performance.now()-started)); prepared(true); request();
      } catch (error) { failure(error); }
    })();
    return () => {
      disposed=true; generation++; a(); b(); observer.disconnect();
      prepareTransition.current=null;
      cancelAnimationFrame(frame); cancelAnimationFrame(handoff); clearTimeout(refreshTimer);
      window.removeEventListener('resize',resize); document.removeEventListener('visibilitychange',visibility);
      surface.removeEventListener('contextlost',lost); surface.removeEventListener('webglcontextlost',lost); renderer?.dispose(); cache.clear(); hide();
    };
  }, [root,state,navigation,reduced,prepared,imagesReady,prepareTransition]);
  return <canvas ref={canvas} data-dissolve-canvas aria-hidden="true" style={{position:'fixed',inset:0,width:'100%',height:'100%',zIndex:4,pointerEvents:'none',visibility:'hidden'}}/>;
}
