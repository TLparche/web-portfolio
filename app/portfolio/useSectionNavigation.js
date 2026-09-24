'use client';

import { useEffect } from 'react';
import { clamp, sectionTransition } from './timeline.mjs';
import { sectionForAnchor } from './config.mjs';
import { canScrollScene } from './sceneScroll.mjs';

/** One navigator owns wheel, touch, menu and section links. Scroll remains the video clock. */
export default function useSectionNavigation({ root, starts, sections, navigation, staged, reducedMotion, update, setMoving, viewportPosition, prepareTransition }) {
  useEffect(() => {
    if (!staged) return;
    let frame = 0, running = false, ownHash = false, lockedUntil = 0, lockedDirection = 0, lastWheel = 0, wheelDistance = 0, touch = null, targetId = null, scrubState = null;
    let preparing = false, preparation = 0, queuedDelta = 0;
    const currentIndex = () => Math.max(0, starts.current.findLastIndex(top => top <= window.scrollY + 2));
    const hasDialog = () => !!root.current?.querySelector('dialog[open]');
    const setHash = id => {
      if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
      ownHash = true;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      ownHash = false;
    };
    const navigate = async (id, { instant = false, writeHash = true } = {}) => {
      const ticket = ++preparation;
      preparing=false;
      const owner = sectionForAnchor(sections, id);
      const to = owner ? sections.indexOf(owner) : -1;
      if (to < 0 && id !== 'preview') return;
      const destination = to < 0 ? 0 : document.getElementById(owner.id)?.getBoundingClientRect().top + window.scrollY;
      if (!Number.isFinite(destination)) return;
      cancelAnimationFrame(frame);
      scrubState = null;
      targetId = id;
      const from = currentIndex(), start = window.scrollY;
      const fromCover = start < (starts.current[0] || innerHeight) - 2;
      const adjacent = to >= 0 && Math.abs(to - from) === 1;
      const cue = adjacent ? sectionTransition(sections, Math.min(to, from)) : null;
      const effect = !fromCover && to >= 0 && to !== from ? (cue?.effect || 'dissolve') : 'scroll';
      // Adjacent dissolves read actual scroll state; a distant menu jump shares the same field.
      const special = effect === 'page' || (effect === 'dissolve' && !adjacent);
      const duration = instant || reducedMotion || Math.abs(start - destination) < 2 ? 0 : effect === 'page' ? 1000 : effect === 'dissolve' ? 2400 : 700;
      if (writeHash) setHash(id);
      if (!duration) {
        navigation.set(null); window.scrollTo({ top: destination, behavior: 'instant' }); update(window.scrollY);
        running = false; lockedUntil = 0; setMoving(false); return;
      }
      running = true; setMoving(true);
      const ready = effect === 'dissolve' && prepareTransition.current?.([from,to]);
      if (ready) {
        preparing=true; await ready;
        if (ticket !== preparation) return;
        preparing=false;
      }
      lockedUntil = performance.now() + duration + 180;
      lockedDirection = Math.sign(destination - start);
      const began = performance.now(), direction = to > from ? 1 : -1;
      const tick = now => {
        const elapsed = now - began, raw = clamp(elapsed / duration), eased = raw * raw * (3 - 2 * raw);
        if (special) navigation.set({ from, to, effect, elapsed, progress: eased, direction });
        const position = start + (destination - start) * eased;
        window.scrollTo({ top: position, behavior: 'instant' }); update(window.scrollY);
        if (raw < 1) frame = requestAnimationFrame(tick);
        else {
          window.scrollTo({ top: destination, behavior: 'instant' }); update(window.scrollY);
          navigation.set(null); running = false; setMoving(false);
        }
      };
      frame = requestAnimationFrame(tick);
    };
    const scrub = (delta, index, prepared = false) => {
      const low = starts.current[index], high = starts.current[index + 1];
      const direction = Math.sign(delta), begin = !scrubState || scrubState.index !== index;
      if (begin && !prepared) {
        const ready = prepareTransition.current?.([index,index+1]);
        if (ready) {
          const ticket=++preparation;
          preparing=true; queuedDelta=delta; setMoving(true);
          ready.then(() => {
            if (ticket !== preparation) return;
            preparing=false; scrub(queuedDelta,index,true);
          });
          return;
        }
      }
      if (begin) {
        cancelAnimationFrame(frame); navigation.set(null);
        scrubState = { index, progress:clamp((window.scrollY - low) / (high - low)), velocity:0, time:null, direction, originDirection:direction };
        running = false; setMoving(true); targetId = null; lockedUntil = 0;
      }
      const motion = scrubState;
      // New input changes velocity, never restarts the animation or extends a lock.
      if (direction !== motion.direction) motion.velocity = 0;
      motion.direction = direction;
      const strength = clamp(Math.abs(delta) / 80, .85, 2);
      motion.velocity = clamp(motion.velocity + direction * (direction === motion.originDirection ? .095 : .016) * strength, -.045, .045);
      if (!begin) return;
      const tick = now => {
        // rAF's timestamp can precede the wheel handler within the same frame.
        const frames = motion.time === null ? 1 : clamp((now - motion.time) / (1000 / 60), 0, 3);
        motion.time = now;
        const finishing = motion.direction > 0 ? motion.progress >= .8 : motion.progress <= .2;
        const step = finishing ? motion.direction * .006 : clamp(motion.velocity, -.01, .01);
        motion.progress = clamp(motion.progress + step * frames);
        motion.velocity *= Math.pow(motion.velocity * motion.originDirection < 0 ? .96 : .9, frames);
        if (Math.abs(motion.velocity) < .0002) motion.velocity = 0;
        const position = low + (high - low) * motion.progress;
        window.scrollTo({ top:position, behavior:'instant' }); update(window.scrollY);
        if (motion.progress > 0 && motion.progress < 1 && (motion.velocity || finishing)) frame = requestAnimationFrame(tick);
        else {
          scrubState = null; setMoving(false);
          if (motion.progress === 0 || motion.progress === 1) {
            setHash(sections[index + Number(motion.progress === 1)].id);
            lockedUntil = performance.now() + 180;
            lockedDirection = motion.direction;
          }
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
      if (event.target.closest?.('[data-work-detail-active="true"]') || canScrollScene(event.target, event.deltaY)) return;
      if (preparing) {
        event.preventDefault();
        queuedDelta=event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
        return;
      }
      const now = performance.now(), previous = lastWheel; lastWheel = now;
      const index = currentIndex(), direction = Math.sign(event.deltaY), next = index + direction;
      const local = window.scrollY - starts.current[index];
      const boundary = direction < 0 && local < 2 ? index - 1 : index;
      if (direction && boundary >= 0 && sectionTransition(sections,boundary).effect === 'dissolve' && window.scrollY >= starts.current[0] - 2) {
        event.preventDefault();
        if (now < lockedUntil && !running && direction === lockedDirection) return;
        if (reducedMotion || innerWidth <= 900) { navigate(sections[boundary + Number(direction > 0)].id, { instant:true }); return; }
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
        scrub(delta, boundary);
        return;
      }
      if (running || (now < lockedUntil && direction === lockedDirection)) {
        event.preventDefault(); wheelDistance = 0; return;
      }
      const coverEnd = starts.current[0] || innerHeight;
      if (!direction || next < 0 || next >= sections.length || window.scrollY < coverEnd - 2) return;
      const cue = sectionTransition(sections, Math.min(index, next));
      if (cue.effect !== 'page') return;
      event.preventDefault();
      if (now - previous > 180 || Math.sign(wheelDistance) !== direction) wheelDistance = 0;
      wheelDistance += event.deltaY;
      if (Math.abs(wheelDistance) >= 8) { wheelDistance = 0; navigate(sections[next].id); }
    };
    const touchStart = event => {
      if (hasDialog() || event.target.closest?.('[data-scene-gesture]')) { touch = null; return; }
      const point = event.touches[0]; touch = { x: point.clientX, y: point.clientY, target: event.target };
    };
    const touchMove = event => {
      if (!touch) return;
      const point = event.touches[0], dx = point.clientX - touch.x, dy = point.clientY - touch.y;
      if (Math.abs(dy) < 35 || Math.abs(dx) > Math.abs(dy)) return;
      if (canScrollScene(touch.target, -dy)) return;
      const index = currentIndex(), next = index + (dy < 0 ? 1 : -1);
      if (next < 0 || next >= sections.length || window.scrollY < starts.current[0] - 2) return;
      const effect = sectionTransition(sections, Math.min(index, next)).effect;
      if (!['page','dissolve'].includes(effect)) return;
      event.preventDefault(); touch = null;
      if (!running && performance.now() >= lockedUntil) navigate(sections[next].id);
    };
    const key = event => {
      if (hasDialog() || event.defaultPrevented || event.target.closest?.('button, input, textarea, [role="tablist"]')) return;
      if (!['PageDown','PageUp'].includes(event.key)) return;
      if (canScrollScene(event.target, event.key === 'PageDown' ? 1 : -1)) return;
      if (window.scrollY < (starts.current[0] || innerHeight) - 2) {
        event.preventDefault(); navigate(event.key === 'PageDown' ? sections[0].id : 'preview', { instant: true }); return;
      }
      const next = currentIndex() + (event.key === 'PageDown' ? 1 : -1);
      if (next < 0 || next >= sections.length) return;
      event.preventDefault(); navigate(sections[next].id, { instant: true });
    };
    const hash = () => { if (!ownHash) navigate(decodeURIComponent(location.hash.slice(1)), { instant: true, writeHash: false }); };
    const resize = () => {
      if (scrubState !== null) {
        cancelAnimationFrame(frame); scrubState = null; setMoving(false);
        // Portfolio's layout measurement preserves the current fractional position.
        return;
      }
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
      preparation++;
      cancelAnimationFrame(frame); navigation.set(null); setMoving(false);
      node?.removeEventListener('click', click);
      window.removeEventListener('wheel', wheel); window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchmove', touchMove); window.removeEventListener('keydown', key); window.removeEventListener('hashchange', hash);
      window.removeEventListener('resize', resize);
    };
  }, [root, starts, sections, navigation, staged, reducedMotion, update, setMoving, viewportPosition, prepareTransition]);
}
