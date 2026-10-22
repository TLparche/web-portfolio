import test from 'node:test';
import assert from 'node:assert/strict';
import { preloadImages } from '../app/portfolio/image-preload.mjs';

test('stalled and broken media return failures; retry and abort never hang',async()=>{
  const original=globalThis.Image;
  globalThis.Image=class {
    set src(value){if(value==='ready')queueMicrotask(()=>this.onload?.());if(value==='broken')queueMicrotask(()=>this.onerror?.());}
    decode(){return Promise.resolve();}
    removeAttribute(){}
  };
  try{
    const progress=[];
    assert.deepEqual(await preloadImages(['ready','broken','stalled'],{timeoutMs:10,onProgress:value=>progress.push(value.loaded)}),['broken','stalled']);
    assert.equal(progress.at(-1),1);
    assert.deepEqual(await preloadImages(['ready'],{timeoutMs:10}),[]);
    const controller=new AbortController();controller.abort();
    await assert.rejects(preloadImages(['stalled'],{signal:controller.signal,timeoutMs:10}));
  }finally{globalThis.Image=original;}
});
