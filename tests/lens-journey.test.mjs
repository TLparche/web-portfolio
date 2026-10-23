import test from 'node:test';
import assert from 'node:assert/strict';
import { lensJourney } from '../app/portfolio/lens-journey.mjs';

test('the lens starts on its existing image and arrives at the prologue crop',()=>{
  const aperture={left:300,top:200,width:200,height:200};
  const image={left:280,top:180,width:240,height:240};
  const source={width:1254,height:1254};
  for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:844,height:390}]){
    const journey=lensJourney(aperture,image,viewport,source,[.6,.4],'cover');
    const scale=journey.end.width/source.width;
    assert.ok(Math.abs(scale-Math.max(viewport.width/source.width,viewport.height/source.height)*1.08)<1e-8);
    assert.equal(journey.end.left,(viewport.width-journey.end.width)*.6);
    assert.equal(journey.end.top,(viewport.height-journey.end.height)*.4);
    const [dx,dy,,initialScale]=journey.view[0].transform.match(/-?\d+(?:\.\d+)?/g).slice(1).map(Number);
    assert.ok(Math.abs(journey.end.left+dx-image.left)<1e-8);
    assert.ok(Math.abs(journey.end.top+dy-image.top)<1e-8);
    assert.ok(Math.abs(journey.end.width*initialScale-image.width)<1e-8);
    assert.equal(journey.view.at(-1).transform,'translate3d(0px,0px,0) scale(1)');
    assert.ok(journey.endRadius>Math.hypot(viewport.width,viewport.height)/2);
    assert.equal(journey.clip[0],'circle(100px at 400px 300px)');
  }
});

test('contain framing keeps the original image ratio and position',()=>{
  const box={left:0,top:0,width:200,height:200};
  const journey=lensJourney(box,box,{width:1000,height:500},{width:1000,height:2000},[0,1],'contain');
  assert.equal(journey.end.width,270);assert.equal(journey.end.height,540);
  assert.equal(journey.end.left,0);assert.equal(journey.end.top,-40);
});
