import test from 'node:test';
import assert from 'node:assert/strict';
import { lockPageScroll } from '../app/portfolio/scroll-lock.mjs';

test('direct detail entry survives loader release and restores the original scroll styles', () => {
  for (const releaseLoaderFirst of [true, false]) {
    const document = { documentElement: { style: { overflow: 'auto' } }, body: { style: { overflow: '' } } };
    const loader = lockPageScroll(document), detail = lockPageScroll(document);
    (releaseLoaderFirst ? loader : detail)();
    assert.equal(document.body.style.overflow, 'hidden');
    (releaseLoaderFirst ? detail : loader)();
    assert.equal(document.body.style.overflow, '');
    assert.equal(document.documentElement.style.overflow, 'auto');
    loader(); detail();
    assert.equal(document.documentElement.style.overflow, 'auto');
  }
});
