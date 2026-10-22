'use client';

import { useEffect } from 'react';
import { clamp, sectionTransition } from './timeline.mjs';
import { sectionForAnchor } from './config.mjs';

/** One navigator owns wheel, touch, menu and section links. Scroll remains the video clock. */
export default function useSectionNavigation({ root, starts, sections, navigation, staged, update, setMoving, viewportPosition }) {
  useEffect(() => {
    if (!staged) return;
    let frame = 0, running = false, ownHash = false, lockedUntil = 0, lastWheel = 0, wheelDistance = 0, touch = null, targetId = null;
    const currentIndex = () => Math.max(0, starts.current.findLastIndex(top => top <= window.scrollY + 2));
    const hasDialog = () => !!root.current?.querySelector('dialog[open]');
    const setHash = id => {
      if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
      ownHash = true;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      ownHash = false;
    };
    const navigate = (id, { instant = false, writeHash = true } = {}) => {
      const owner = sectionForAnchor(sections, id);
      const to = owner ? sections.indexOf(owner) : -1;
      if (to < 0 && id !== 'preview') return;
      const destination = to < 0 ? 0 : document.getElementById(owner.id)?.getBoundingClientRect().top + window.scrollY;
      if (!Number.isFinite(destination)) return;
      cancelAnimationFrame(frame);
      targetId = id;
      const from = currentIndex(), start = window.scrollY;
      const fromCover = start < (starts.current[0] || innerHeight) - 2;
      const adjacent = to >= 0 && Math.abs(to - from) === 1;
      const cue = adjacent ? sectionTransition(sections, Math.min(to, from)) : null;
      const effect = !fromCover && to >= 0 && to !== from ? (cue?.effect || 'showcase') : 'scroll';
      const special = effect === 'page' || effect === 'showcase';
      const duration = instant || Math.abs(start - destination) < 2 ? 0 : effect === 'page' ? 1000 : effect === 'showcase' ? 220 : 700;
      if (writeHash) setHash(id);
      if (!duration) {
        navigation.set(null); window.scrollTo({ top: destination, behavior: 'instant' }); update(destination);
        running = false; setMoving(false); return;
      }
      running = true; setMoving(true);
      lockedUntil = performance.now() + (effect === 'showcase' ? 1350 : duration + 180);
      const began = performance.now(), direction = to > from ? 1 : -1;
      const tick = now => {
        const elapsed = now - began, raw = clamp(elapsed / duration), eased = raw * raw * (3 - 2 * raw);
        if (special) navigation.set({ from, to, effect, elapsed, progress: eased, direction });
        const progress = effect === 'showcase' ? Number(elapsed >= 100) : eased;
        const position = start + (destination - start) * progress;
        window.scrollTo({ top: position, behavior: 'instant' }); update(position);
        if (raw < 1) frame = requestAnimationFrame(tick);
        else {
          window.scrollTo({ top: destination, behavior: 'instant' }); update(destination);
          navigation.set(null); running = false; setMoving(false);
        }
      };
      frame = requestAnimationFrame(tick);
    };
    const click = event => {
      const link = event.target.closest?.('a[href^="#"]');
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const id = decodeURIComponent(link.getAttribute('href').slice(1));
      if (id !== 'preview' && !sectionForAnchor(sections, id)) return;
      event.preventDefault(); navigate(id, { instant: event.detail === 0 });
    };
    const wheel = event => {
      if (event.defaultPrevented || event.ctrlKey || hasDialog() || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.target.closest?.('[data-scene-scroll], [data-work-detail-active="true"]')) return;
      const now = performance.now(), previous = lastWheel; lastWheel = now;
      if (running || now < lockedUntil || (previous && now - previous < 160 && now < lockedUntil + 240)) {
        event.preventDefault(); wheelDistance = 0; lockedUntil = Math.max(lockedUntil, now + 100); return;
      }
      const index = currentIndex(), direction = Math.sign(event.deltaY), next = index + direction;
      const coverEnd = starts.current[0] || innerHeight;
      if (!direction || next < 0 || next >= sections.length || window.scrollY < coverEnd - 2) return;
      const cue = sectionTransition(sections, Math.min(index, next));
      if (cue.effect !== 'page' && cue.effect !== 'showcase') return;
      event.preventDefault();
      if (now - previous > 180 || Math.sign(wheelDistance) !== direction) wheelDistance = 0;
      wheelDistance += event.deltaY;
      if (Math.abs(wheelDistance) >= 8) { wheelDistance = 0; navigate(sections[next].id); }
    };
    const touchStart = event => {
      if (hasDialog() || event.target.closest?.('[data-scene-scroll], [data-scene-gesture]')) { touch = null; return; }
      const point = event.touches[0]; touch = { x: point.clientX, y: point.clientY };
    };
    const touchMove = event => {
      if (!touch) return;
      const point = event.touches[0], dx = point.clientX - touch.x, dy = point.clientY - touch.y;
      if (Math.abs(dy) < 35 || Math.abs(dx) > Math.abs(dy)) return;
      const index = currentIndex(), next = index + (dy < 0 ? 1 : -1);
      if (next < 0 || next >= sections.length || window.scrollY < starts.current[0] - 2) return;
      const effect = sectionTransition(sections, Math.min(index, next)).effect;
      if (!['page','showcase'].includes(effect)) return;
      event.preventDefault(); touch = null;
      if (!running && performance.now() >= lockedUntil) navigate(sections[next].id);
    };
    const key = event => {
      if (hasDialog() || event.defaultPrevented || event.target.closest?.('button, input, textarea, [role="tablist"], [data-scene-scroll]')) return;
      if (!['PageDown','PageUp'].includes(event.key)) return;
      if (window.scrollY < (starts.current[0] || innerHeight) - 2) {
        event.preventDefault(); navigate(event.key === 'PageDown' ? sections[0].id : 'preview', { instant: true }); return;
      }
      const next = currentIndex() + (event.key === 'PageDown' ? 1 : -1);
      if (next < 0 || next >= sections.length) return;
      event.preventDefault(); navigate(sections[next].id, { instant: true });
    };
    const hash = () => { if (!ownHash) navigate(decodeURIComponent(location.hash.slice(1)), { instant: true, writeHash: false }); };
    const resize = () => {
      if (!running || !targetId) return;
      const owner = sectionForAnchor(sections, targetId);
      const position = owner ? document.getElementById(owner.id).getBoundingClientRect().top + window.scrollY : 0;
      viewportPosition.current = { height: innerHeight, scroll: position };
      navigate(targetId, { instant: true, writeHash: false });
      lockedUntil = performance.now() + 180;
    };
    root.current?.addEventListener('click', click);
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('keydown', key);
    window.addEventListener('hashchange', hash);
    window.addEventListener('resize', resize);
    const node = root.current;
    return () => {
      cancelAnimationFrame(frame); navigation.set(null); setMoving(false);
      node?.removeEventListener('click', click);
      window.removeEventListener('wheel', wheel); window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchmove', touchMove); window.removeEventListener('keydown', key); window.removeEventListener('hashchange', hash);
      window.removeEventListener('resize', resize);
    };
  }, [root, starts, sections, navigation, staged, update, setMoving, viewportPosition]);
}
