export function pointerCoordinate(position, extent) {
  return Math.max(-.5, Math.min(.5, position / Math.max(1, extent) - .5));
}

export function followPointer(current, target, elapsed) {
  return current + (target - current) * (1 - .95 ** (Math.max(0, Math.min(50, elapsed)) / (1000 / 60)));
}
