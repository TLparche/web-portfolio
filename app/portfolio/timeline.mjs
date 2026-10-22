export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const smooth = (start, end, value) => { const t = clamp((value - start) / (end - start)); return t * t * (3 - 2 * t); };

/** Seek to an actual frame, including the last valid frame rather than duration. */
export function videoFrameTime(progress, duration, fps = 30) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const last = Math.max(0, Math.ceil(duration * rate) - 1);
  return Math.min(last, Math.floor(clamp(Number.isFinite(progress) ? progress : 0) * duration * rate)) / rate;
}

/** @typedef {{from:string,to:string,effect:'page'|'showcase'|'fade',length:number}} TransitionCue */
/** @type {TransitionCue[]} */
export const transitionCues = [
  { from:'about', to:'interests', effect:'page', length:0 },
  { from:'interests', to:'projects', effect:'showcase', length:0 },
  { from:'projects', to:'education', effect:'showcase', length:0 },
  { from:'education', to:'contact', effect:'fade', length:45 },
];
export function sectionTransition(items, index) {
  if (index >= items.length - 1) return { effect:'none', length:0 };
  return transitionCues.find(cue => cue.from === items[index].id && cue.to === items[index + 1].id) || { effect:'none', length:24 };
}

/** Reading lasts one viewport; transition lengths follow actual adjacent IDs. */
export function samplePage(scroll, starts, items, viewport) {
  let index = starts.length - 1;
  while (index > 0 && scroll < starts[index]) index--;
  if (index < 0) return { index:-1, next:-1, hold:0, transition:0, effect:'none' };
  const next = Math.min(index + 1, items.length - 1);
  const cue = sectionTransition(items, index);
  const local = Math.max(0, scroll - starts[index]);
  return { index, next, hold:clamp(local / viewport), transition:cue.length ? clamp((local - viewport) / (viewport * cue.length / 100)) : 0, effect:cue.effect };
}

export const contentEnterStart = effect => effect === 'fade' ? .55 : .82;
export const contentExitEnd = effect => effect === 'fade' ? .3 : .18;

// One reading surface at a time, with a short background-only interval.
export function textOpacity(index, state) {
  if (index === state.index) return 1 - smooth(0, contentExitEnd(state.effect), state.transition);
  if (index === state.next) return smooth(contentEnterStart(state.effect), 1, state.transition);
  return 0;
}
