export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const smooth = (start, end, value) => { const t = clamp((value - start) / (end - start)); return t * t * (3 - 2 * t); };

/** Seek to an actual frame, including the last valid frame rather than duration. */
export function videoFrameTime(progress, duration, fps = 30) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const last = Math.max(0, Math.ceil(duration * rate) - 1);
  return Math.min(last, Math.floor(clamp(Number.isFinite(progress) ? progress : 0) * duration * rate)) / rate;
}

/** @typedef {{from:string,to:string,effect:'page'|'dissolve'|'fade',length:number}} TransitionCue */
/** @type {TransitionCue[]} */
export const transitionCues = [
  { from:'about', to:'interests', effect:'dissolve', length:0 },
  { from:'interests', to:'projects', effect:'dissolve', length:0 },
  { from:'projects', to:'education', effect:'dissolve', length:0 },
  { from:'education', to:'contact', effect:'dissolve', length:0 },
];
export function sectionTransition(items, index) {
  if (index >= items.length - 1) return { effect:'none', length:0 };
  return transitionCues.find(cue => cue.from === items[index].id && cue.to === items[index + 1].id) || { effect:'none', length:24 };
}

/** Reading lasts one viewport; transition lengths follow actual adjacent IDs. */
export function samplePage(scroll, starts, items, viewport) {
  let index = starts.length - 1;
  // Browser scroll positions round subpixels; use the navigator's same tolerance.
  while (index > 0 && scroll + 2 < starts[index]) index--;
  if (index < 0) return { index:-1, next:-1, hold:0, transition:0, effect:'none' };
  const next = Math.min(index + 1, items.length - 1);
  const cue = sectionTransition(items, index);
  const local = Math.max(0, scroll - starts[index]);
  // Use the same measured interval as the navigator. On mobile, 100vh section
  // spacing can stay fixed while the address bar changes innerHeight.
  const extent = starts[index + 1] - starts[index];
  const sectionViewport = extent > 0 ? extent / (1 + cue.length / 100) : viewport;
  return { index, next, hold:clamp(local / sectionViewport), transition:cue.effect === 'dissolve' ? clamp(local / sectionViewport) : cue.length ? clamp((local - sectionViewport) / (sectionViewport * cue.length / 100)) : 0, effect:cue.effect };
}

export const contentEnterStart = effect => effect === 'fade' ? .55 : .82;
export const contentExitEnd = effect => effect === 'fade' ? .3 : .18;

// One reading surface at a time, with a short background-only interval.
export function textOpacity(index, state) {
  if (index === state.index) return 1 - smooth(0, contentExitEnd(state.effect), state.transition);
  if (index === state.next) return smooth(contentEnterStart(state.effect), 1, state.transition);
  return 0;
}
