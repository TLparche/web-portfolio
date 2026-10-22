import { getFontEmbedCSS, toSvg } from 'html-to-image';

const reading = '[data-interest-column],[data-widget="works"] header,[data-work-detail-item] article,[data-chapter-group="education"] header,[data-record-list],[data-record-detail]';
// Hidden panels pass visibility to every child; html-to-image copies that
// computed value inline. Existing display:none and opacity:0 remain intact.
const captureCSS = `
  *,*::before,*::after{visibility:visible!important;animation:none!important;transition:none!important}
  foreignObject > *{transform:none!important;translate:none!important;rotate:none!important;scale:none!important;opacity:1!important;filter:none!important;clip-path:none!important;mask:none!important;-webkit-mask:none!important}
  [data-panel] > [data-copy]{transform:none!important;translate:none!important;opacity:1!important;filter:none!important}
`;
const rootStyle = {
  position: 'relative', inset: 'auto', top: '0', left: '0', margin: '0',
  transform: 'none', translate: 'none', rotate: 'none', scale: 'none',
  opacity: '1', visibility: 'visible', filter: 'none', clipPath: 'none',
  mask: 'none', WebkitMask: 'none', animation: 'none', transition: 'none',
  boxSizing: 'border-box', minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none',
};

/** Keep every font variant that can render the scene, including generated text. */
export function filterFontFaces(css, text) {
  const points = [...new Set([...text].map(character => character.codePointAt(0)))];
  return css.replace(/@font-face\s*\{[^}]*\}/gi, rule => {
    // Chromium's SVG text metrics change when Barlow's companion subsets are
    // removed. Preserve this small display family; subset the large body font.
    if (/font-family\s*:\s*["']?Barlow Condensed["']?\s*;/i.test(rule)) return rule;
    const descriptor = rule.match(/\bunicode-range\s*:\s*([^;}]+)/i);
    if (!descriptor) return rule;
    const used = descriptor[1].split(',').some(range => {
      const match = range.trim().match(/^u\+([\da-f]{1,6}|[\da-f]{0,5}\?{1,6})(?:-([\da-f]{1,6}))?$/i);
      // Keep unfamiliar descriptors rather than risk replacing a required font.
      if (!match || match[1].length > 6 || (match[2] && match[1].includes('?'))) return true;
      const start = parseInt(match[1].replaceAll('?', '0'), 16);
      const end = parseInt(match[2] || match[1].replaceAll('?', 'f'), 16);
      if (start > end || end > 0x10ffff || start <= 0x7f) return true;
      return points.some(point => point >= start && point <= end);
    });
    return used ? rule : '';
  });
}

function sceneText(panel) {
  let text = '';
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (!walker.currentNode.parentElement?.closest('noscript,style,script')) text += walker.currentNode.nodeValue;
  }
  for (const node of [panel, ...panel.querySelectorAll('*')]) {
    if (node.closest('noscript,style,script')) continue;
    for (const pseudo of ['::before', '::after']) {
      text += getComputedStyle(node, pseudo).content.replace(/\\([\da-f]{1,6})[\t\n\f\r ]?|\\([^\n\r\f])/gi, (_, hex, character) => hex ? String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)) : character);
    }
  }
  return text;
}

/** Capture static scene layers once; the controller caches them between updates. */
export async function captureScene(panel, { fontEmbedCSS, pixelRatio = 1 } = {}) {
  const started = performance.now();
  const width = window.innerWidth, height = window.innerHeight;
  const canvas = () => {
    const layer = document.createElement('canvas');
    layer.width = width * pixelRatio;
    layer.height = height * pixelRatio;
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
    return layer;
  };
  const copy = panel.querySelector(':scope > [data-copy]');
  // Layout coordinates deliberately exclude the transition's scale/translation.
  const x = copy?.offsetLeft || 0, y = copy?.offsetTop || 0;
  const copyWidth = copy?.offsetWidth || 0, copyHeight = copy?.offsetHeight || 0;
  const fonts = filterFontFaces(fontEmbedCSS ?? await getFontEmbedCSS(panel), sceneText(panel));
  // SVG images disable scripting and can expose serialized noscript fallback text.
  // Clone/computed-style/embed work dominates preparation. Do it once, then
  // rasterize isolated layers from that same frozen tree.
  const url = await toSvg(panel, {
    width, height, filter: node => node.nodeName !== 'NOSCRIPT',
    style: { ...rootStyle, width: `${panel.offsetWidth}px`, height: `${panel.offsetHeight}px` },
    fontEmbedCSS: `${fonts}\n${captureCSS}`,
  });
  const frozen = new DOMParser().parseFromString(decodeURIComponent(url.slice(url.indexOf(',')+1)), 'image/svg+xml');
  const frozenPanel = frozen.querySelector('foreignObject').firstElementChild;
  const originals = [panel,...panel.querySelectorAll('*')].filter(node => node.localName !== 'style' && !node.closest('noscript'));
  const copies = [frozenPanel,...frozenPanel.querySelectorAll('*')].filter(node => node.localName !== 'style');
  // html-to-image rounds every font down. Restore exact metrics so a button or
  // heading cannot wrap differently when the bitmap replaces the live scene.
  if (originals.length === copies.length) originals.forEach((node,index) => {
    if (node.localName === copies[index].localName && copies[index].style) copies[index].style.fontSize=getComputedStyle(node).fontSize;
  });
  // WebKit drops some foreignObject images with an individual scale property.
  // Fold it into the equivalent transform without changing artwork framing.
  frozenPanel.querySelectorAll('img').forEach(image => {
    const scale = image.style.scale;
    if (!scale || scale === 'none') return;
    const axes = scale.trim().split(/\s+/);
    image.style.transform = `${axes.length === 3 ? 'scale3d' : 'scale'}(${axes.join(',')}) ${image.style.transform === 'none' ? '' : image.style.transform}`;
    image.style.scale = 'none';
  });
  const cloned = performance.now();
  const raster = async kind => {
    const svg = frozen.documentElement.cloneNode(true);
    const scene = svg.querySelector('foreignObject').firstElementChild;
    // WebKit's XML document :scope differs from its live HTML implementation.
    const content = [...scene.children].find(child => child.hasAttribute('data-copy'));
    if (kind === 'base') content?.remove();
    else {
      [...scene.children].forEach(child => { if (child !== content && child.localName !== 'style') child.remove(); });
      const style = frozen.createElementNS('http://www.w3.org/1999/xhtml','style');
      style.textContent = 'foreignObject > *::before,foreignObject > *::after{content:none!important;display:none!important}';
      scene.appendChild(style);
      scene.style.setProperty('background','transparent','important');
      scene.style.setProperty('border-color','transparent','important');
      scene.style.setProperty('box-shadow','none','important');
      if (kind === 'art') scene.querySelectorAll(reading).forEach(node => node.style.setProperty('opacity','0','important'));
      if (kind === 'body') {
        // Invisible artwork still costs SVG decode memory; text-only layers do
        // not need to carry a second copy of every embedded illustration.
        scene.querySelectorAll('img').forEach(image => { if (!image.closest(reading)) image.remove(); });
        const style = frozen.createElementNS('http://www.w3.org/1999/xhtml','style');
        const visible = reading.split(',').flatMap(selector => [selector,`${selector} *`,`${selector}::before`,`${selector}::after`,`${selector} *::before`,`${selector} *::after`]).join(',');
        // Hiding the outer SVG/foreignObject suppresses all HTML in Chromium,
        // even when individual reading elements restore their visibility.
        style.textContent = `foreignObject *,foreignObject *::before,foreignObject *::after{visibility:hidden!important}${visible}{visibility:visible!important}`;
        scene.appendChild(style);
      }
    }
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve,reject) => {
      image.onload=resolve; image.onerror=reject;
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    });
    await image.decode();
    await new Promise(requestAnimationFrame);
    const layer = canvas();
    const context = layer.getContext('2d');
    context.drawImage(image,0,0,layer.width,layer.height);
    // WebKit starts painting large embedded foreignObject images on the first
    // draw, after decode() resolves. Publish only the next frame's complete copy.
    await new Promise(requestAnimationFrame);
    context.clearRect(0,0,layer.width,layer.height);
    context.drawImage(image,0,0,layer.width,layer.height);
    return layer;
  };
  const hasBody = Boolean(copy?.querySelector(reading) || copy?.matches(reading));
  const contentTask = raster('content');
  const [base,content,art,body] = await Promise.all([raster('base'),contentTask,hasBody?raster('art'):contentTask,hasBody?raster('body'):undefined]);
  return {
    base, content, art, body,
    captureMs: { clone:Math.round(cloned-started), raster:Math.round(performance.now()-cloned) },
    pivot: copyWidth && copyHeight ? [x + copyWidth / 2, y + copyHeight / 2] : [width / 2, height / 2],
    width, height,
  };
}
