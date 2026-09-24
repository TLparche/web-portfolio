import test from 'node:test';
import assert from 'node:assert/strict';
import { collectImages } from '../app/portfolio/image-preload.mjs';

test('image manifest covers nested choices and fallbacks without unused transition fields', () => {
  const images = collectImages(
    [{ image: '/fallback.webp', artwork: { src: '/character.png', thumbnail: '/character.thumb.webp' }, chapters: [{ showcaseItems: [{ artwork: '/alternate.png', image: '/fallback.webp' }] }] }],
    [{ still: '/poster.webp', entry: { texture: '/unused-entry.webp' }, exit: { texture: '/unused-exit.webp' } }],
    { poster: '/poster.webp', video: '/background.mp4', links: [{ url: '/not-an-image' }], source: { src: '/unrelated.png' } },
    null,
  );
  assert.deepEqual(images, [
    '/fallback.webp', '/character.png', '/character.thumb.webp', '/alternate.png', '/poster.webp',
  ]);
});

test('image manifest leaves deployment prefixes and remote URLs unchanged', () => {
  assert.deepEqual(collectImages({ image: '', still: null, poster: '/web-portfolio/poster.webp', artwork: { src: 'https://example.com/cover.png' } }), [
    '/web-portfolio/poster.webp', 'https://example.com/cover.png',
  ]);
});
