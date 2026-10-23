import { clamp, smooth } from './timeline.mjs';

export const CONTENT_DISTANCE = 1.44;
export const DISSOLVE_DISTANCE = 1;
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
  return smooth(.27 + group * .063, .414 + group * .063, distance);
}
export function readingOffset(index, starts, extent) {
  return starts[index] + (starts[index + 1] - starts[index] || extent) * READING_POSITION;
}
export function visualFor(profile, id) {
  return profile.visuals?.[id === 'preview' ? 'landing' : id] || { src:'/art/archive/paper.webp', alt:'' };
}
