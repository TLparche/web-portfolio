import { clamp, smooth } from './timeline.mjs';
import { dissolveEase } from './dissolve.mjs';

const cubic = value => value < .5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
const linearRGB = Float32Array.from({ length: 256 }, (_, value) => {
  const color = value / 255;
  return color <= .04045 ? color / 12.92 : ((color + .055) / 1.055) ** 2.4;
});
const surface = (width, height, read = false) => {
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  return { canvas, context: canvas.getContext('2d', { willReadFrequently: read }) };
};
const reset = target => {
  const context = target.context;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  if ('filter' in context) context.filter = 'none';
  context.clearRect(0, 0, target.canvas.width, target.canvas.height);
  return context;
};

function readField(image, width, height) {
  const target = surface(width, height, true);
  target.context.drawImage(image, 0, 0, width, height);
  const bytes = target.context.getImageData(0, 0, width, height).data;
  const red = new Float32Array(width * height), green = new Float32Array(red.length), blue = new Float32Array(red.length);
  for (let index = 0; index < red.length; index++) {
    red[index] = 2 * bytes[index * 4] / 255 - .5;
    green[index] = .075 * bytes[index * 4 + 1] / 255 - .0375;
    blue[index] = .0375 - .075 * bytes[index * 4 + 2] / 255;
  }
  return [red, green, blue];
}

function createEdge(scene, width, height) {
  const w = scene.base.width, h = scene.base.height, target = surface(w, h, true);
  target.context.drawImage(scene.base, 0, 0);
  target.context.drawImage(scene.art, 0, 0);
  const pixels = target.context.getImageData(0, 0, w, h), bytes = pixels.data;
  const luma = new Float32Array(w * h);
  for (let index = 0; index < luma.length; index++) {
    const offset = index * 4;
    luma[index] = .299 * linearRGB[bytes[offset]] + .587 * linearRGB[bytes[offset + 1]] + .114 * linearRGB[bytes[offset + 2]];
  }
  const dx = w / width, dy = h / height;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const index = y * w + x, sx = x - dx, sy = y - dy;
    const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
    const left = sx < -.5 ? 0 : luma[y * w + Math.max(0, ix)] * (1 - fx) + luma[y * w + Math.max(0, ix + 1)] * fx;
    const above = sy < -.5 ? 0 : luma[Math.max(0, iy) * w + x] * (1 - fy) + luma[Math.max(0, iy + 1) * w + x] * fy;
    const gradient = Math.min(1, 10 * (Math.abs(luma[index] - left) + Math.abs(luma[index] - above)));
    const color = Math.round(255 * (gradient <= .0031308 ? 12.92 * gradient : 1.055 * gradient ** (1 / 2.4) - .055));
    bytes[index * 4] = bytes[index * 4 + 1] = bytes[index * 4 + 2] = color;
    bytes[index * 4 + 3] = 255;
  }
  target.context.putImageData(pixels, 0, 0);
  return target.canvas;
}

function supportsBlur() {
  const probe = surface(9, 9, true), context = probe.context;
  if (!('filter' in context)) return false;
  context.filter = 'blur(1px)';
  context.fillRect(4, 4, 1, 1);
  return context.getImageData(3, 4, 1, 1).data[3] > 0;
}

// Safari lacks Canvas2D.filter. Cache eight small, cropped Gaussian levels.
// Interpolating neighboring levels keeps body motion continuous without reads
// or convolution during a transition. The maximum blur remains 2.25 CSS px.
function createBodyBlurs(scene, width, height) {
  if (!scene.body) return null;
  const w = scene.body.width, h = scene.body.height;
  const source = scene.body.getContext('2d').getImageData(0, 0, w, h).data;
  let left = w, top = h, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (source[(y * w + x) * 4 + 3]) {
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) return null;
  const sigmaX = 2.25 * w / width, sigmaY = 2.25 * h / height;
  const marginX = Math.ceil(3 * sigmaX), marginY = Math.ceil(3 * sigmaY);
  left -= marginX; top -= marginY; right += marginX; bottom += marginY;
  const bw = right - left + 1, bh = bottom - top + 1;
  let pixels = new Float32Array(bw * bh * 4);
  for (let y = Math.max(0, top); y <= Math.min(h - 1, bottom); y++) for (let x = Math.max(0, left); x <= Math.min(w - 1, right); x++) {
    const from = (y * w + x) * 4, to = ((y - top) * bw + x - left) * 4, alpha = source[from + 3] / 255;
    pixels[to] = source[from] * alpha; pixels[to + 1] = source[from + 1] * alpha;
    pixels[to + 2] = source[from + 2] * alpha; pixels[to + 3] = source[from + 3];
  }
  const levels = [];
  const save = () => {
    const target = surface(bw, bh), image = target.context.createImageData(bw, bh);
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      image.data[index] = alpha ? pixels[index] * 255 / alpha : 0;
      image.data[index + 1] = alpha ? pixels[index + 1] * 255 / alpha : 0;
      image.data[index + 2] = alpha ? pixels[index + 2] * 255 / alpha : 0;
      image.data[index + 3] = alpha;
    }
    target.context.putImageData(image, 0, 0);
    levels.push(target.canvas);
  };
  save();
  const original = pixels;
  for (let level = 1; level <= 8; level++) {
    pixels = original;
    for (let axis = 0; axis < 2; axis++) {
      const sigma = (axis ? sigmaY : sigmaX) * level / 8, radius = Math.ceil(3 * sigma);
      const weights = Float32Array.from({ length: 2 * radius + 1 }, (_, index) => Math.exp(-.5 * ((index - radius) / sigma) ** 2));
      const total = weights.reduce((sum, value) => sum + value, 0);
      for (let index = 0; index < weights.length; index++) weights[index] /= total;
      const result = new Float32Array(pixels.length);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const destination = (y * bw + x) * 4;
        for (let step = -radius; step <= radius; step++) {
          const sx = x + (axis ? 0 : step), sy = y + (axis ? step : 0);
          if (sx < 0 || sx >= bw || sy < 0 || sy >= bh) continue;
          const from = (sy * bw + sx) * 4, weight = weights[step + radius];
          result[destination] += pixels[from] * weight; result[destination + 1] += pixels[from + 1] * weight;
          result[destination + 2] += pixels[from + 2] * weight; result[destination + 3] += pixels[from + 3] * weight;
        }
      }
      pixels = result;
    }
    save();
  }
  return { levels, left, top, scratch: surface(bw, bh) };
}

/** Original noise, shade and luma dissolve, using only native Canvas 2D. */
export function createDissolveRenderer(canvas, { forwardImage, reverseImage }) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable for the dissolve renderer.');
  const maskWidth = Math.min(512, forwardImage.naturalWidth || forwardImage.width);
  const maskHeight = Math.min(512, forwardImage.naturalHeight || forwardImage.height);
  const fields = [forwardImage, reverseImage].map(image => readField(image, maskWidth, maskHeight));
  const masks = Array.from({ length: 6 }, (_, index) => {
    const target = surface(maskWidth, maskHeight);
    const image = target.context.createImageData(maskWidth, maskHeight);
    if (index % 3 !== 1) image.data.fill(255);
    return { ...target, image, pixels: new Uint32Array(image.data.buffer) };
  });
  const tables = Array.from({ length: 6 }, () => new Float32Array(256));
  const nativeBlur = supportsBlur(), sceneLayer = surface(1, 1), copyLayer = surface(1, 1), edgeLayer = surface(1, 1);
  const rows = Array.from({ length: 4 }, () => [0, maskHeight - 1]);
  let cache = new WeakMap(), pair, width = 1, height = 1, disposed = false, tableKey;

  const prepareScene = (scene, renderWidth = scene.width || width, renderHeight = scene.height || height) => {
    let saved = cache.get(scene);
    if (saved?.width === renderWidth && saved?.height === renderHeight) return saved;
    const useNativeBlur = nativeBlur && Math.abs(scene.base.width / renderWidth - scene.base.height / renderHeight) < .001;
    saved = { width: renderWidth, height: renderHeight, nativeBlur: useNativeBlur,
      edge: createEdge(scene, renderWidth, renderHeight), body: useNativeBlur ? null : createBodyBlurs(scene, renderWidth, renderHeight) };
    cache.set(scene, saved);
    return saved;
  };
  const resize = (nextWidth, nextHeight) => {
    if (disposed) return;
    width = Math.max(1, nextWidth); height = Math.max(1, nextHeight);
    const w = pair ? pair[0].base.width : Math.round(width), h = pair ? pair[0].base.height : Math.round(height);
    for (const target of [canvas, sceneLayer.canvas, copyLayer.canvas, edgeLayer.canvas]) {
      if (target.width !== w) target.width = w;
      if (target.height !== h) target.height = h;
    }
  };
  const setPair = (lower, upper) => {
    if (disposed) return;
    const expected = lower.base;
    for (const scene of [lower, upper]) {
      for (const key of ['base', 'content', 'art', 'body']) if (scene[key]
        && (scene[key].width !== expected.width || scene[key].height !== expected.height)) {
        throw new Error('Dissolve scene canvases must have equal pixel dimensions.');
      }
    }
    pair = [lower, upper];
    resize(width, height);
  };

  const updateMasks = (p, reverse, time) => {
    const key = `${p}:${reverse}`;
    if (key !== tableKey) {
      tableKey = key;
      const travel = reverse ? 1 - p : p, eased = dissolveEase(travel);
      for (let side = 0; side < 2; side++) {
        const outgoing = (side === 1) === reverse;
        const weight = outgoing ? smooth(0, .5, eased) ** 2 : smooth(.2, .8, 1 - eased) ** 2;
        const dark = outgoing ? Math.min(travel * .6, .32) : 0, gain = (outgoing ? 5 + 5 * eased : 5 - 2 * eased) / 10;
        for (let index = 0; index < 256; index++) {
          const threshold = index / 255, blend = smooth(eased - .008, eased + .008, threshold);
          const q = 1 - smooth(0, .3, Math.abs(eased - threshold));
          const glow = (1 - smooth(0, .003, Math.abs(eased - threshold))) * smooth(.01, .08, travel) * (1 - smooth(.92, 1, travel));
          const values = [outgoing ? blend : 1 - blend, 1 - (1 - dark) * (1 - weight * q),
            Math.min(1, q * (q * weight * (1 - dark) + .1 * dark) * gain * (1 + 9 * glow))];
          for (let kind = 0; kind < 3; kind++) tables[side * 3 + kind][index] = Number(values[kind].toFixed(4)) * 255 * (kind === 1 ? .78 : 1);
        }
      }
    }
    const [red, green, blue] = fields[reverse ? 1 : 0], sine = Math.sin(time * .0006), cosine = Math.cos(time * .0006);
    const [cut0, shade0, outline0, cut1, shade1, outline1] = masks.map(mask => mask.pixels);
    const [a, b, c, , e, f] = tables;
    rows.forEach(row => { row[0] = maskHeight; row[1] = -1; });
    for (let y = 0, index = 0; y < maskHeight; y++) {
      let lowerCut = false, upperCut = false, lowerEdge = false, upperEdge = false;
      for (let x = 0; x < maskWidth; x++, index++) {
        const position = Math.max(0, Math.min(255, (red[index] + sine * green[index] + cosine * blue[index]) * 255));
        const first = Math.floor(position), next = Math.min(255, first + 1), fraction = position - first;
        const alpha = Math.round(a[first] + (a[next] - a[first]) * fraction);
        const edge0 = Math.round(c[first] + (c[next] - c[first]) * fraction);
        const edge1 = Math.round(f[first] + (f[next] - f[first]) * fraction);
        cut0[index] = (alpha << 24) | 0xffffff;
        cut1[index] = ((255 - alpha) << 24) | 0xffffff;
        shade0[index] = Math.round(b[first] + (b[next] - b[first]) * fraction) << 24;
        outline0[index] = (edge0 << 24) | 0xffffff;
        shade1[index] = Math.round(e[first] + (e[next] - e[first]) * fraction) << 24;
        outline1[index] = (edge1 << 24) | 0xffffff;
        lowerCut ||= alpha > 0; upperCut ||= alpha < 255;
        lowerEdge ||= edge0 > 0; upperEdge ||= edge1 > 0;
      }
      [lowerCut, upperCut, lowerEdge, upperEdge].forEach((visible, index) => {
        if (visible) { rows[index][0] = Math.min(rows[index][0], y); rows[index][1] = y; }
      });
    }
    masks.forEach(mask => mask.context.putImageData(mask.image, 0, 0));
  };
  const draw = (side, p) => {
    const scene = pair[side], saved = prepareScene(scene, width, height), incoming = side === 1;
    const opacity = incoming ? smooth(.82, 1, p) : 1 - smooth(0, .18, p);
    const w = canvas.width, h = canvas.height;
    const bounds = index => [Math.floor(Math.max(0, rows[index][0] - 1) * h / maskHeight), Math.ceil(Math.min(maskHeight, rows[index][1] + 2) * h / maskHeight)];
    const [top, bottom] = bounds(side);
    if (bottom <= top) return;
    let copyImage = opacity <= 0 ? scene.art : scene.content;
    if (opacity > 0 && opacity < 1) {
      const copy = reset(copyLayer);
      copyImage = copyLayer.canvas;
      if (scene.body) {
      copy.drawImage(scene.art, 0, 0);
      copy.globalAlpha = opacity;
      const shift = (1 - opacity) * 4.5 * h / height;
      if (saved.nativeBlur) {
        copy.filter = `blur(${(1 - opacity) * 2.25 * w / width}px)`;
        copy.drawImage(scene.body, 0, shift);
        copy.filter = 'none';
      } else if (saved.body) {
        const body = saved.body, position = (1 - opacity) * 8, first = Math.floor(position), fraction = position - first;
        const bodyContext = reset(body.scratch);
        bodyContext.globalAlpha = 1 - fraction;
        bodyContext.drawImage(body.levels[first], 0, 0);
        if (fraction) {
          bodyContext.globalCompositeOperation = 'lighter'; bodyContext.globalAlpha = fraction;
          bodyContext.drawImage(body.levels[Math.min(8, first + 1)], 0, 0);
        }
        copy.drawImage(body.scratch.canvas, body.left, body.top + shift);
      }
      } else {
        copy.globalAlpha = 1 - opacity; copy.drawImage(scene.art, 0, 0);
        copy.globalAlpha = opacity; copy.globalCompositeOperation = 'lighter'; copy.drawImage(scene.content, 0, 0);
      }
    }
    const distance = incoming ? 1 - p : p, scale = 1 + .3 * distance;
    const pivotX = scene.pivot[0] * w / (scene.width || width), pivotY = scene.pivot[1] * h / (scene.height || height);
    const translateY = (incoming ? 1 : -1) * cubic(distance) * .1 * h;
    const transform = target => target.setTransform(scale, 0, 0, scale, pivotX * (1 - scale), pivotY * (1 - scale) + scale * translateY);
    const layer = reset(sceneLayer);
    layer.save(); layer.beginPath(); layer.rect(0, top, w, bottom - top); layer.clip();
    layer.drawImage(scene.base, 0, 0);
    transform(layer); layer.drawImage(copyImage, 0, 0); layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.drawImage(masks[side * 3 + 1].canvas, 0, 0, w, h);
    const edge = reset(edgeLayer);
    const [edgeTop, edgeBottom] = bounds(side + 2);
    edge.save(); edge.beginPath(); edge.rect(0, edgeTop, w, Math.max(0, edgeBottom - edgeTop)); edge.clip();
    transform(edge); edge.drawImage(saved.edge, 0, 0); edge.setTransform(1, 0, 0, 1, 0, 0);
    edge.globalCompositeOperation = 'destination-in'; edge.drawImage(masks[side * 3 + 2].canvas, 0, 0, w, h);
    edge.restore();
    layer.globalCompositeOperation = 'screen'; layer.drawImage(edgeLayer.canvas, 0, 0);
    layer.globalCompositeOperation = 'destination-in'; layer.drawImage(masks[side * 3].canvas, 0, 0, w, h);
    layer.restore();
    context.drawImage(sceneLayer.canvas, 0, top, w, bottom - top, 0, top, w, bottom - top);
  };
  const render = ({ progress, reverse = false, time = 0, width: nextWidth = width, height: nextHeight = height }) => {
    if (disposed || !pair) return;
    resize(nextWidth, nextHeight);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const p = clamp(progress);
    if (p <= 0 || p >= 1) {
      const scene = pair[p >= 1 ? 1 : 0];
      context.drawImage(scene.base, 0, 0); context.drawImage(scene.content, 0, 0);
      return;
    }
    updateMasks(p, reverse, time); draw(0, p); draw(1, p);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; pair = null; cache = new WeakMap();
    for (const target of [...masks, sceneLayer, copyLayer, edgeLayer]) target.canvas.width = target.canvas.height = 1;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };
  return { prepareScene, setPair, render, resize, dispose };
}
