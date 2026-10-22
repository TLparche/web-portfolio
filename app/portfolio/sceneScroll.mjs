/** Let native reading scroll consume input only while it can move in that direction. */
export function canScrollScene(target, delta) {
  if (!delta) return false;
  for (let node = target?.closest?.('[data-scene-scroll], [data-panel]'); node; node = node.parentElement?.closest('[data-scene-scroll], [data-panel]')) {
    if (!/auto|scroll|overlay/.test(getComputedStyle(node).overflowY)) continue;
    if (delta < 0 ? node.scrollTop > 1 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
  }
  return false;
}
