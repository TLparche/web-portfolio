export const pieces = [
  [[664,139],[804,139],[594,569],[454,569]],
  [[747,264],[836,370],[557,941],[418,941]],
  [[987,71],[1076,178],[712,923],[625,816]],
  [[1044,252],[1186,252],[890,863],[747,863]],
  [[1146,344],[1233,453],[928,1080],[788,1080]],
  [[1338,252],[1478,252],[1168,885],[1081,780]],
];

const edges = pieces.map(points => {
  const diagonal = points.map(([x,y]) => x + .45 * y);
  return [Math.min(...diagonal), Math.max(...diagonal)];
});

export function galleryLayout(active) {
  const shifts = pieces.map(() => 0);
  if (active === null) return { shifts, expanded:null, offset:0 };
  const left = (edges[active][0] + edges[active][1] - 660) / 2;
  const expanded = [[left,0],[left+660,0],[left+174,1080],[left-486,1080]];
  let before = left - 6, after = left + 666;
  for (let i = active - 1; i >= 0; i--) {
    shifts[i] = before - edges[i][1];
    before = edges[i][0] + shifts[i] - 6;
  }
  for (let i = active + 1; i < pieces.length; i++) {
    shifts[i] = after - edges[i][0];
    after = edges[i][1] + shifts[i] + 6;
  }
  const xs = pieces.flatMap((points,i) => i === active ? expanded.map(([x]) => x) : points.map(([x]) => x + shifts[i]));
  return { shifts, expanded, offset:1912 - Math.max(...xs), artLeft:left + 30, captionLeft:left - 210 };
}
