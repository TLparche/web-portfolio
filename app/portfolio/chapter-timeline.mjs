import { clamp, smooth } from './timeline.mjs';

export const CONTENT_DISTANCE = 1.44;
export const DISSOLVE_DISTANCE = 2;
export const CHAPTER_DISTANCE = CONTENT_DISTANCE + DISSOLVE_DISTANCE;
export const DISSOLVE_START = CONTENT_DISTANCE / CHAPTER_DISTANCE;
export const READING_POSITION = .81 / CHAPTER_DISTANCE;

export function sampleChapter(scroll, starts, extent) {
  if (!starts.length) return { index:0, next:0, progress:0, media:0, nextMedia:0, dissolve:0 };
  const index = Math.max(0, starts.findLastIndex(start => scroll >= start));
  const lengthAt = i => starts[i + 1] - starts[i] || extent || 1;
  const length = lengthAt(index), next = Math.min(index + 1, starts.length - 1);
  const progress = clamp((scroll - starts[index]) / length);
  const mediaAt = i => {
    const overlap = i > 0 ? lengthAt(i - 1) * (1 - DISSOLVE_START) : 0;
    return clamp((scroll - starts[i] + overlap) / (lengthAt(i) + overlap));
  };
  return { index, next, progress, media:mediaAt(index), nextMedia:mediaAt(next),
    dissolve:index < starts.length - 1 ? clamp((progress - DISSOLVE_START) / (1 - DISSOLVE_START)) : 0 };
}
export function revealAt(progress, group = 0) {
  const distance = progress * CHAPTER_DISTANCE;
  return smooth(.02 + group * .063, .52 + group * .063, distance);
}
export function componentReveal(progress, group = 0, kind = 'text', reduced = false, phase = 'content') {
  const surface = phase === 'surface';
  const surfaceStart = .04 + group * .035;
  const start = surface ? surfaceStart : surfaceStart + .55;
  const value = reduced ? 1 : smooth(start, start + (surface ? .55 : .07), progress * CHAPTER_DISTANCE);
  const rest = 1 - value;
  const style = { opacity: value === 1 ? '' : String(value), translate: '', clipPath: '' };
  if (!rest) return style;
  if (kind === 'title') {
    style.translate = `0 ${rest * 22}px`;
    style.clipPath = `inset(0 -2px ${rest * 100}% -2px)`;
  } else if (kind === 'line') {
    style.clipPath = `inset(-2px ${rest * 100}% -2px -2px)`;
  } else if (kind === 'diagonal') {
    style.translate = `${rest * 5}% ${rest * -8}%`;
    style.clipPath = `polygon(0 0,${Math.min(100, value * 120)}% 0,${Math.max(0, value * 120 - 20)}% 100%,0 100%)`;
  } else if (kind === 'ribbon-up' || kind === 'ribbon-down') {
    const direction = kind === 'ribbon-up' ? 1 : -1;
    style.translate = `${rest * 8 * direction}% ${rest * -28 * direction}%`;
  } else if (kind === 'ticket') {
    style.translate = `${rest * -32}px ${rest * 12}px`;
  } else if (kind === 'record') {
    style.translate = `${rest * -24}px 0`;
  } else {
    style.translate = `0 ${rest * (kind === 'controls' ? 28 : 16)}px`;
  }
  return style;
}
export function readingOffset(index, starts, extent) {
  return starts[index] + (starts[index + 1] - starts[index] || extent) * READING_POSITION;
}
export function visualFor(profile, id) {
  return profile.visuals?.[id === 'preview' ? 'landing' : id] || { src:'/art/archive/paper.webp', alt:'' };
}
