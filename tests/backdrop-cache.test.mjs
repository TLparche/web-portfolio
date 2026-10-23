import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackdropRenderer } from '../app/portfolio/backdrop-renderer.mjs';

test('adjacent and reversed chapters reuse uploads; video revisions refresh and GPU memory stays bounded', () => {
  let uploads = 0;
  const tones = [];
  const live = new Set();
  const gl = new Proxy({
    createTexture() { const texture = {}; live.add(texture); return texture; },
    deleteTexture(texture) { live.delete(texture); },
    texImage2D(...args) { if(args.length===6)uploads++; },
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformLocation: (_,name) => name,
    uniform1f(name,value) { if(name==='outgoingTone')tones.push(value); },
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
    for(const blend of [0,.1,.35,.75,0])renderer.draw(d,e,blend,false,1280,720);
    assert.equal(tones.at(-5),0);
    assert.ok(tones.at(-4)>0 && tones.at(-4)<1);
    assert.equal(tones.at(-3),1);
    assert.equal(tones.at(-2),1);
    assert.equal(tones.at(-1),0);
    renderer.dispose(); assert.equal(live.size,0);
  } finally {
    if (density === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = density;
  }
});
