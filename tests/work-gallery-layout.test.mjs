import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryLayout, galleryPointerPreview } from '../app/portfolio/work-gallery-layout.mjs';

test('staggered ribbons stay inside the available desktop area without moving neighboring heights', () => {
  for (const size of [{width:1880,height:960},{width:1600,height:850},{width:1100,height:600},{width:800,height:430}]) {
    const closed = galleryLayout(null,size);
    assert.equal(new Set(closed.map(card=>card.top)).size,6);
    assert.ok(new Set(closed.map(card=>card.height)).size>=5);
    for (const active of [null,0,1,2,3,4,5]) {
      const cards = galleryLayout(active,size);
      assert.equal(cards.length,6);
      for (const [index,card] of cards.entries()) {
        assert.equal(card.labelTop,closed[index].labelTop);
        if(index!==active) {
          assert.equal(card.height,closed[index].height);
          assert.equal(card.top,closed[index].top);
          assert.ok(Math.abs(card.width-closed[index].width)<.0001);
        }
        for(const [x,y] of card.points) assert.ok(x>=-.001&&x<=size.width+.001&&y>=0&&y<=size.height);
        if(index>0) {
          const slope=(card.points[0][0]-card.points[3][0])/(card.points[3][1]-card.points[0][1]);
          assert.ok(card.points[0][0]+slope*card.points[0][1]>cards[index-1].points[1][0]+slope*cards[index-1].points[1][1]);
        }
      }
      if(active!==null) {
        assert.ok(cards[active].captionWidth>120);
        assert.ok(cards[active].width>closed[active].width);
        assert.ok(cards[active].height>closed[active].height);
      }
    }
  }
});

test('returning to the closed gallery restores exactly the same framing', () => {
  const before=galleryLayout(null);
  for(let index=0;index<6;index++)galleryLayout(index);
  assert.deepEqual(galleryLayout(null),before);
});

test('closed ribbons keep their slender width on large monitors', () => {
  for(const width of [1600,2192,2800])for(const card of galleryLayout(null,{width,height:991})) {
    const [a,b,,d]=card.points;
    const slope=(a[0]-d[0])/(d[1]-a[1]);
    assert.ok(Math.abs(b[0]-a[0]+slope*(b[1]-a[1])-132)<.001);
  }
});

test('gaps and stationary pointer boundary events retain the open domain', () => {
  let active=0, point={x:200,y:400};
  for(const [x,y,target] of [[240,400,null],[250,401,null],[250,401,1],[260,401,1],[260,401,0],[270,400,null],[280,400,2],[280,400,1]]) {
    const next={x,y};
    const expected=target===null||(point.x===x&&point.y===y)?active:target;
    active=galleryPointerPreview(active,point,next,target);
    assert.equal(active,expected);
    point=next;
  }
  assert.equal(active,2);
  assert.equal(galleryPointerPreview(null,null,{x:50,y:60},null),null);
  assert.equal(galleryPointerPreview(null,null,{x:50,y:60},4),4);
});
