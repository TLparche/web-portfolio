import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneManifest } from '../app/portfolio/scene-source.mjs';

test('normal CI exports stay synthetic even when a local background is configured', () => {
  const local = { NEXT_PUBLIC_BG_MANIFEST:'test/bg-src79-cuts.json' };
  assert.equal(sceneManifest({...local,GITHUB_ACTIONS:'true'}), 'public/bg/morph/scenes.json');
  assert.equal(sceneManifest({...local,CI:'true'}), 'public/bg/morph/scenes.json');
  assert.equal(sceneManifest({NEXT_PUBLIC_BG_MANIFEST:'../../outside.json'}), 'public/bg/morph/scenes.json');
  assert.equal(sceneManifest({NEXT_PUBLIC_BG_MANIFEST:'test/missing-background.json'}), 'public/bg/morph/scenes.json');
});
