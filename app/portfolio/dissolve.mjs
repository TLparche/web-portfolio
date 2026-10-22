import { clamp, smooth } from './timeline.mjs';

export const dissolveEase = value => .75 * smooth(0,1,value) + .25 * clamp(value);
const cubic = t => t < .5 ? 4*t*t*t : 1-(-2*t+2)**3/2;

export function dissolveTransform(progress, incoming) {
  const distance = incoming ? 1-progress : progress;
  return `scale(${1+.3*distance}) translateY(${(incoming?1:-1)*cubic(distance)*10}vh)`;
}

export function dissolveForPanel(index, state, navigation) {
  if (navigation?.effect === 'dissolve') {
    if (index !== navigation.from && index !== navigation.to) return null;
    return { progress:navigation.direction>0?navigation.progress:1-navigation.progress, incoming:index===Math.max(navigation.from,navigation.to) };
  }
  if (state.effect !== 'dissolve' || state.transition <= 0 || state.transition >= 1) return null;
  if (index !== state.index && index !== state.next) return null;
  return { progress:state.transition, incoming:index===state.next };
}
