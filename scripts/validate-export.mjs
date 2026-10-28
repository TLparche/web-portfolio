import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import content from '../content/portfolio.json' with { type: 'json' };
import { catalogItems, sectionMedia } from '../app/portfolio/work-catalog.mjs';

const root = path.resolve('out');
const prefix = process.env.PREVIEW_BASE_PATH || '/web-portfolio';
const preview = process.env.PREVIEW_URL;
const works = catalogItems(content.sections);
const routes = ['/', '/works/', ...works.map(work => `/works/${work.slug}/`)];
const assets = new Set();
for (const route of routes) {
  const file = path.join(root, route, 'index.html');
  assert.ok(fs.existsSync(file), `Missing route: ${route}`);
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.includes('<h1'), `Missing heading: ${route}`);
  for (const match of html.matchAll(/\b(?:href|src|poster)="([^"\s]+)"/g)) {
    const url = match[1].replaceAll('&amp;', '&');
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    assert.ok(url.startsWith(prefix + '/'), `Base path missing: ${route} → ${url}`);
    const pathname = decodeURIComponent(url.split(/[?#]/)[0]).slice(prefix.length);
    const target = path.resolve(root, '.' + pathname);
    assert.ok(target.startsWith(root + path.sep) || target === root, `Outside export: ${url}`);
    const resolved = pathname.endsWith('/') ? path.join(target, 'index.html') : target;
    assert.ok(fs.existsSync(resolved), `Broken local reference: ${route} → ${url}`);
    assets.add(url.split(/[?#]/)[0]);
  }
  if (preview) {
    const response = await fetch(new URL('.' + route, preview));
    assert.equal(response.status, 200, `Direct route: ${route}`);
    await response.body.cancel();
  }
}
for (const work of works) {
  const html = fs.readFileSync(path.join(root, 'works', work.slug, 'index.html'), 'utf8');
  assert.ok(html.includes(work.title.replaceAll('&', '&amp;')), `Wrong record: ${work.slug}`);
  for (const media of (work.detailSections || []).flatMap(sectionMedia)) {
    assert.ok(html.includes(prefix + media.src), `Missing media: ${work.slug} → ${media.src}`);
  }
}
if (preview) {
  for (const asset of assets) {
    const response = await fetch(new URL(asset, preview), { method: 'HEAD' });
    assert.equal(response.status, 200, `Asset: ${asset}`);
  }
  for (const name of ['holo-studio', 'yt-edit']) {
    const response = await fetch(new URL(`${prefix}/videos/works/${name}.mp4`, preview), { headers: { Range: 'bytes=0-1023' } });
    assert.equal(response.status, 206, `Video range: ${name}`);
    assert.equal((await response.arrayBuffer()).byteLength, 1024);
  }
  assert.equal((await fetch(new URL(`${prefix}/works/unknown-project/`, preview))).status, 404);
}
console.log(`정적 경로 ${routes.length}개 · 작업 ${works.length}개 · 참조 ${assets.size}개 검증 완료${preview ? ' (HTTP·영상 범위 요청 포함)' : ''}`);
