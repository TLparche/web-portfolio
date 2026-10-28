import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import content from '../content/portfolio.json' with { type: 'json' };
import { catalogItems, filterWorks, readWorkFilter, workFilterQuery, workCover, sectionMedia, summarizeWork, workDomains, workGallerySections, mediaFocusStyle, mediaShape } from '../app/portfolio/work-catalog.mjs';
import { validateContent } from '../scripts/validate-content.mjs';
import { collectImages } from '../app/portfolio/image-preload.mjs';
import { activeSections, sectionForAnchor } from '../app/portfolio/config.mjs';

test('experience domains include every enabled project, research and activity once', () => {
  const works = catalogItems(content.sections);
  assert.equal(works.length, content.sections.filter(s => s.enabled).reduce((sum, s) => sum + (s.showcaseItems?.length || 0), 0));
  assert.equal(workDomains.length, 6);
  assert.equal(collectImages(workDomains).length, 6);
  assert.ok(workDomains.every(domain => existsSync(new URL(`../public${domain.image}`, import.meta.url))));
  assert.ok(filterWorks(works, { domain: 'xr' }).some(work => work.collection === 'experience'));
  assert.equal(new Set(works.map(work => work.slug)).size, works.length);
  assert.ok(works.every(work => work.slug));
  const grouped = workDomains.flatMap(domain => filterWorks(works, { domain: domain.id }));
  assert.deepEqual(grouped.map(work => work.id).sort(), works.map(work => work.id).sort());
  assert.deepEqual(new Set(filterWorks(works, { domain: 'ai' }).map(work => work.collection)), new Set(['projects', 'publications']));
  assert.deepEqual(new Set(filterWorks(works, { domain: 'misc' }).map(work => work.collection)), new Set(['projects', 'activities']));
  assert.ok(filterWorks(works, { domain: 'platform', category: 'collaboration' }).some(work => work.id === 'showcase-experience-01'));
});

test('experience navigation keeps all former chapter anchors on the shared domain gallery', () => {
  const sections = activeSections(content.sections);
  const experience = sections.find(section => section.id === 'projects');
  assert.equal(experience.title, '경험');
  for (const id of ['projects', 'experience', 'publications', 'activities']) {
    assert.equal(sectionForAnchor(sections, id), experience);
  }
});

test('URL filters round trip, isolate platform categories and discard invalid values', () => {
  const filter = { domain: 'platform', category: 'collaboration' };
  assert.deepEqual(readWorkFilter(workFilterQuery(filter)), filter);
  assert.deepEqual(readWorkFilter('?domain=nope&category=creation'), { domain: '', category: '' });
  assert.deepEqual(readWorkFilter('?domain=ai&category=creation'), { domain: 'ai', category: '' });
  const works = catalogItems(content.sections);
  assert.ok(filterWorks(works, filter).every(work => work.domain === 'platform' && work.platformCategory === 'collaboration'));
  assert.equal(filterWorks(works).length, works.length);
});

test('explicit covers never promote body media; multiple media take precedence over legacy images', () => {
  const part = { image: '/legacy.webp', alt: '기존', media: [{ type: 'image', src: '/new.webp', alt: '새 자료' }] };
  assert.equal(sectionMedia(part).length, 1);
  assert.equal(sectionMedia(part)[0].src, '/new.webp');
  assert.equal(sectionMedia({ ...part, media: [] })[0].src, '/legacy.webp');
  assert.equal(sectionMedia({ ...part, media: [], width: 1280, height: 720 })[0].width, 1280);
  const item = { title: '작업', detailSections: [part] };
  assert.equal(workCover(item), null);
  assert.deepEqual(collectImages(item), []);
  assert.equal(summarizeWork(item).detailSections, undefined);
});

test('content validation rejects broken routes, domains, relations and rich media', () => {
  const mutate = change => {
    const data = structuredClone(content), works = data.sections.find(s => s.kind === 'projects').showcaseItems;
    change(works);
    return () => validateContent(data);
  };
  assert.throws(mutate(works => { works[0].slug = works[1].slug; }), /slug가 중복/);
  assert.throws(mutate(works => { works[0].slug = '../escape'; }), /slug는/);
  assert.throws(mutate(works => { works[0].domain = 'invalid'; }), /잘못된 분야/);
  for (const kind of ['projects', 'experience', 'publications', 'activities']) {
    const missingDomain = structuredClone(content);
    delete missingDomain.sections.find(section => section.kind === kind).showcaseItems[0].domain;
    assert.throws(() => validateContent(missingDomain), /분야가 없거나/);
  }
  assert.throws(mutate(works => { works[0].relatedWorkIds = ['missing']; }), /관련 작업/);
  assert.throws(mutate(works => { works[0].relatedWorkIds = [works[0].id]; }), /관련 작업/);
  assert.throws(mutate(works => { works[0].artwork = { src: '/art/projects/moa.webp' }; }), /대체 텍스트/);
  assert.throws(mutate(works => { works[0].artwork.width = -1; }), /미디어 너비·높이/);
  assert.throws(mutate(works => { delete works[0].artwork.height; }), /미디어 너비·높이/);
  assert.throws(mutate(works => { works[0].detailSections = [{ title: '실행', body: '', media: [{ type: 'image', src: '/art/projects/moa.webp', caption: '재구성 자료', alt: '' }] }]; }), /대체 텍스트/);
  assert.throws(mutate(works => { works[0].detailSections = [{ title: '실행', body: '', media: [{ type: 'video', src: '/videos/missing.mp4', caption: '실행 녹화', alt: '조작 흐름' }] }]; }), /파일을 찾을 수 없습니다/);
});

test('gallery keeps an explicit overview and preserves text, legacy media and video ordering', () => {
  const item = { title: '작업', description: '소개', detailSections: [{ title: '설명', body: '글만 있는 항목' }, { title: '실행', body: '결과', image: '/legacy.webp', alt: '화면' }, { title: '변화', body: '과정', media: [{ type: 'image', src: '/one.jpg', alt: '첫 화면' }, { type: 'video', src: '/two.mp4', alt: '조작' }] }] };
  const parts = workGallerySections(item);
  assert.deepEqual(parts.map(part => part.id), ['overview', 'section-1', 'section-2', 'section-3']);
  assert.deepEqual(parts[0].media, []);
  assert.equal(parts[1].body, '글만 있는 항목');
  assert.equal(parts[2].media[0].src, '/legacy.webp');
  assert.deepEqual(parts[3].media.map(media => media.type), ['image', 'video']);
  const cover = workGallerySections({ ...item, artwork: { src: '/cover.jpg', width: 1280, height: 720, caption: '실제 화면' } })[0].media[0];
  assert.equal(cover.src, '/cover.jpg');
  assert.equal(cover.alt, '작업');
  assert.equal(cover.width, 1280);
  assert.equal(cover.caption, '실제 화면');
});

test('published capture extensions match their actual image format', () => {
  const sources = new Set(catalogItems(content.sections).flatMap(item => [workCover(item), ...(item.detailSections || []).flatMap(sectionMedia)]).filter(Boolean).flatMap(media => [media.src, media.poster]).filter(src => src?.startsWith('/art/works/') && /\.(png|jpe?g)$/.test(src)));
  assert.ok(sources.size > 0);
  for (const src of sources) {
    const header = readFileSync(new URL(`../public${src}`, import.meta.url)).subarray(0, 8);
    assert.ok(src.endsWith('.png') ? header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : header[0] === 255 && header[1] === 216, `Image format does not match extension: ${src}`);
  }
});

test('focus framing uses original pixels and preserves a separate mobile composition', () => {
  const focus = { x: 100, y: 200, width: 1000, height: 500, caption: '핵심 화면', mobile: { x: 500, y: 300, width: 500, height: 400 } };
  const media = { width: 2000, height: 1200, focus };
  assert.deepEqual(mediaFocusStyle(media), {
    '--focus-ratio': '1000 / 500', '--focus-width': '200%', '--focus-left': '-10%', '--focus-top': '-40%',
    '--compact-ratio': '500 / 400', '--compact-width': '400%', '--compact-left': '-100%', '--compact-top': '-75%',
  });
  assert.equal(mediaFocusStyle({}), undefined);
  assert.equal(mediaFocusStyle({ ...media, focus: { ...focus, mobile: undefined } })['--compact-width'], '200%');
  assert.deepEqual(sectionMedia({ image: '/legacy.webp', focus })[0].focus, focus);
  assert.deepEqual(workGallerySections({ artwork: { src: '/cover.jpg', ...media } })[0].media[0].focus, focus);
});

test('focus framing rejects blank captions and regions outside the source image', () => {
  const validate = focus => {
    const data = structuredClone(content);
    data.sections.find(s => s.kind === 'projects').showcaseItems[0].artwork.focus = focus;
    return () => validateContent(data);
  };
  const focus = { x: 0, y: 0, width: 1000, height: 500, caption: '핵심 화면' };
  assert.doesNotThrow(validate(focus));
  for (const invalid of [{ x: -1 }, { width: 0 }, { width: 99999 }, { y: 99999 }, { height: 1.5 }, { caption: '' }, { mobile: false }, { mobile: { x: 0, y: 0, width: 0, height: 400 } }]) {
    assert.throws(validate({ ...focus, ...invalid }), /부분 화면/);
  }
});

test('gallery composition follows the displayed image ratio and updates for each medium', () => {
  assert.equal(mediaShape(), 'landscape');
  assert.equal(mediaShape({ width: 900, height: 1200 }), 'portrait');
  assert.equal(mediaShape({ width: 1600, height: 900 }), 'landscape');
  assert.equal(mediaShape({ width: 2400, height: 1000 }), 'wide');
  assert.equal(mediaShape({ width: 2400, height: 1000, focus: { width: 700, height: 900 } }), 'portrait');
  assert.equal(mediaShape({ width: 900, height: 1200, focus: { width: 1050, height: 1000 } }), 'landscape');
});
