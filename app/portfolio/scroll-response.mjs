import { READING_POSITION, readingOffset } from './chapter-timeline.mjs';

export const SCROLL_RESPONSE = { lerp: .1, restDelta: .1, revealDuration: 1000 };

export function followScroll(current, target, delta) {
  const next = target + (current - target) * Math.exp(-SCROLL_RESPONSE.lerp * 60 * Math.max(0,delta) / 1000);
  return Math.abs(target - next) < SCROLL_RESPONSE.restDelta ? target : next;
}

export function advanceReveal(position, target, extent, delta) {
  return Math.min(target, position + extent * READING_POSITION * Math.max(0,delta) / SCROLL_RESPONSE.revealDuration);
}

export function revealContinuation(from, to, starts, extent) {
  const index = starts.findIndex(start => start > from && start <= to);
  return index > 0 ? { position:starts[index], target:readingOffset(index,starts,extent) } : null;
}
