import assert from 'node:assert/strict';
import test from 'node:test';
import { filterFontFaces } from '../app/portfolio/scene-capture.mjs';

test('font subsets preserve ASCII, scene glyphs, variants, and unbounded faces', () => {
  const face = (name, range, weight = 400) => `@font-face { font-family: ${name}; font-weight: ${weight}; src: url(data:font/woff2;base64,AAAA); ${range ? `unicode-range: ${range};` : ''} }`;
  const kept = [
    face('latin', 'U+0-7F'),
    face('hangul', 'U+D550-D55F'),
    face('hangul', 'U+D550-D55F', 700),
    face('wildcard', 'U+1F6??'),
    face('list', 'U+400-4FF, U+D55C'),
    face('unbounded'),
    face('unknown', 'unsupported'),
    face('invalid', 'U+500-400'),
    face('"Barlow Condensed"', 'U+100-2FF', 600),
  ];
  const removed = [face('cyrillic', 'U+4??'), face('han', 'U+4E00-9FFF'), face('otherEmoji', 'U+1F9??')];
  const surrounding = '.caption { color: red; }';
  const filtered = filterFontFaces([...kept, ...removed, surrounding].join('\n'), '한😀');
  for (const rule of kept) assert.ok(filtered.includes(rule), `Dropped required face: ${rule}`);
  for (const rule of removed) assert.ok(!filtered.includes(rule), `Kept unused face: ${rule}`);
  assert.ok(filtered.includes(surrounding));
});
