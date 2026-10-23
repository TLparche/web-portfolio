export const SCROLL_RESPONSE = { lerp: .1, restDelta: .1 };

export function followScroll(current, target, delta) {
  const next = target + (current - target) * Math.exp(-SCROLL_RESPONSE.lerp * 60 * Math.max(0,delta) / 1000);
  return Math.abs(target - next) < SCROLL_RESPONSE.restDelta ? target : next;
}
