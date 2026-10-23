const locks = new WeakMap();

export function lockPageScroll(document) {
  let state = locks.get(document);
  if (!state) {
    const elements = [document.documentElement, document.body];
    state = { owners: new Set(), elements, overflow: elements.map(element => element.style.overflow) };
    locks.set(document, state);
    elements.forEach(element => { element.style.overflow = 'hidden'; });
  }
  const owner = Symbol('scroll-lock');
  state.owners.add(owner);
  return () => {
    if (!state.owners.delete(owner) || state.owners.size) return;
    state.elements.forEach((element, index) => { element.style.overflow = state.overflow[index]; });
    locks.delete(document);
  };
}
