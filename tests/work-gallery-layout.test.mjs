import test from 'node:test';
import assert from 'node:assert/strict';
import { pieces, galleryLayout } from '../app/portfolio/work-gallery-layout.mjs';

test('every expanded work docks its neighbours without resizing or hiding any strip', () => {
  for (let active = 0; active < pieces.length; active++) {
    const layout = galleryLayout(active);
    const polygons = pieces.map((points,i) => i === active ? layout.expanded : points.map(([x,y]) => [x + layout.shifts[i],y]));
    const intervals = polygons.map(points => {
      const values = points.map(([x,y]) => x + .45 * y);
      return [Math.min(...values),Math.max(...values)];
    });
    for (let i = 1; i < intervals.length; i++) assert.ok(Math.abs(intervals[i][0] - intervals[i-1][1] - 6) < 1e-6);
    for (const polygon of polygons) for (const [x] of polygon) {
      const visibleX = x + layout.offset;
      assert.ok(visibleX >= 8 - 1e-6 && visibleX <= 1912 + 1e-6);
    }
    for (let i = 0; i < pieces.length; i++) {
      if (i < active) assert.ok(layout.shifts[i] < 0);
      if (i > active) assert.ok(layout.shifts[i] > 0);
      if (i !== active) for (let j = 0; j < pieces[i].length; j++) {
        assert.equal(polygons[i][j][1],pieces[i][j][1]);
        assert.ok(Math.abs((polygons[i][j][0] - polygons[i][0][0]) - (pieces[i][j][0] - pieces[i][0][0])) < 1e-6);
      }
    }
    const [left,right] = intervals[active];
    for (const [x,y] of [[layout.artLeft,160],[layout.artLeft+330,640],[layout.captionLeft,670],[layout.captionLeft+380,1040]]) {
      assert.ok(x + .45 * y >= left && x + .45 * y <= right);
    }
  }
});

test('leaving the gallery restores the original six cuts and framing', () => {
  const closed = galleryLayout(null);
  assert.deepEqual(closed.shifts,[0,0,0,0,0,0]);
  assert.equal(closed.expanded,null);
  assert.equal(closed.offset,0);
});
