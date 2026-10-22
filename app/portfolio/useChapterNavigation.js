'use client';
import { useEffect } from 'react';
import { sectionForAnchor } from './config.mjs';
import { readingOffset } from './chapter-timeline.mjs';

export default function useChapterNavigation({ root, starts, extent, sections, staged, reducedMotion, state, syncScroll }) {
  useEffect(() => {
    let ownHash = false;
    const navigate = (id, instant = false, write = true) => {
      const owner = sectionForAnchor(sections,id);
      const index = id === 'preview' ? 0 : owner ? sections.indexOf(owner) + 1 : -1;
      if (index < 0 || !Number.isFinite(starts.current[index])) return;
      if (write) {
        history.pushState(null,'',`#${id}`);
        ownHash = true; window.dispatchEvent(new HashChangeEvent('hashchange')); ownHash = false;
      }
      if(staged){
        const top=readingOffset(index,starts.current,extent.current);
        window.scrollTo({top,behavior:instant || reducedMotion ? 'instant' : 'smooth'});
        if(instant || reducedMotion)syncScroll(window.scrollY);
      }
      else document.getElementById(owner?.id || 'preview')?.scrollIntoView({behavior:'instant'});
    };
    const click = event => {
      const link = event.target.closest?.('a[href^="#"]');
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      let id; try { id = decodeURIComponent(link.hash.slice(1)); } catch { return; }
      if (id !== 'preview' && !sectionForAnchor(sections,id)) return;
      event.preventDefault(); navigate(id,event.detail === 0);
    };
    const hash = () => { if (!ownHash) navigate(location.hash.slice(1),true,false); };
    const key = event => {
      if (event.defaultPrevented || root.current?.querySelector('dialog[open], [data-widget="works"][data-visible="true"] [data-work-detail-active="true"]') || event.target.closest?.('button,input,textarea,select,[role="tablist"],[data-scene-scroll]')) return;
      if (!['PageDown','PageUp'].includes(event.key)) return;
      const index = Math.min(sections.length,Math.max(0,state.get().index + (event.key === 'PageDown' ? 1 : -1)));
      event.preventDefault(); navigate(index ? sections[index - 1].id : 'preview',true);
    };
    const node = root.current;
    node?.addEventListener('click',click); window.addEventListener('hashchange',hash); window.addEventListener('keydown',key);
    return () => { node?.removeEventListener('click',click); window.removeEventListener('hashchange',hash); window.removeEventListener('keydown',key); };
  },[root,starts,extent,sections,staged,reducedMotion,state,syncScroll]);
}
