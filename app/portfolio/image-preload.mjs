/** Keep public-relative URLs unchanged; the page applies its deployment base path once. */
export function collectImages(...sources) {
  const images = new Set();
  const add = value => { if (typeof value === 'string' && value) images.add(value); };
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const key of ['image', 'still', 'poster']) add(value[key]);
    add(typeof value.artwork === 'string' ? value.artwork : value.artwork?.src);
    add(value.artwork?.thumbnail);
    Object.values(value).forEach(visit);
  };
  sources.forEach(visit);
  return [...images];
}

/** Decode all candidates with bounded concurrency; failed images do not count as loaded. */
export async function preloadImages(urls, { onProgress, signal } = {}) {
  const queue = [...new Set(urls.filter(url => typeof url === 'string' && url))];
  const failed = new Set();
  let cursor = 0, loaded = 0;
  const checkAbort = () => { if (signal?.aborted) throw signal.reason ?? new DOMException('Image preload aborted', 'AbortError'); };
  const load = url => new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = success => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      image.onload = image.onerror = null;
      if (!success) image.removeAttribute('src');
      resolve(success);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(false), 30000);
    image.onload = () => image.decode().then(() => finish(true), () => finish(false));
    image.onerror = () => finish(false);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    else image.src = url;
  });
  checkAbort();
  onProgress?.({ loaded, total: queue.length });
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (cursor < queue.length && !signal?.aborted) {
      const url = queue[cursor++];
      const success = await load(url);
      if (signal?.aborted) return;
      if (success) { loaded++; onProgress?.({ loaded, total: queue.length }); }
      else failed.add(url);
    }
  }));
  checkAbort();
  return queue.filter(url => failed.has(url));
}
