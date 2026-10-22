import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackdropRenderer } from '../app/portfolio/backdrop-renderer.mjs';

test('adjacent and reversed chapters reuse uploads; video revisions refresh and GPU memory stays bounded', () => {
  let uploads = 0;
  const live = new Set();
  const gl = new Proxy({
    createTexture() { const texture = {}; live.add(texture); return texture; },
    deleteTexture(texture) { live.delete(texture); },
    texImage2D(...args) { if(args.length===6)uploads++; },
    getShaderParameter: () => true,
    getProgramParameter: () => true,
  }, { get: (target, key) => target[key] ?? (() => ({})) });
  const density = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 1;
  try {
    const renderer = createBackdropRenderer({ width:0, height:0, getContext: () => gl });
    const media = () => ({ source:{}, revision:0, aspect:1.5, progress:0, position:[.5,.5], contain:false });
    const [a,b,c,d,e] = Array.from({length:5}, media);
    const field={}; renderer.setDissolveField(field); renderer.setDissolveField(field);
    assert.equal(uploads,1,'the original noise field uploads only once');
    uploads=0;
    const draw = (a,b) => renderer.draw(a,b,.5,false,1280,720);
    draw(a,b); assert.equal(uploads,2);
    draw(b,c); assert.equal(uploads,3);
    draw(a,b); assert.equal(uploads,3);
    b.revision++; draw(a,b); assert.equal(uploads,4);
    draw(d,e); assert.equal(live.size,4); // Three media textures plus the fixed dissolve field.
    renderer.dispose(); assert.equal(live.size,0);
  } finally {
    if (density === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = density;
  }
});
