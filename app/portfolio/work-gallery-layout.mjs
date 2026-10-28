export function galleryLayout(active, { width = 1920, height = 800 } = {}) {
  const cardHeight = Math.min(height - 24, 780);
  const top = (height - cardHeight) / 2;
  const slant = Math.min(cardHeight * .32, width * .16);
  const gap = Math.min(16, width * .012);
  const expandedWidth = Math.min(560, width * .38);
  const stripWidth = Math.min(132, (width - slant - gap * 5 - expandedWidth) / 5);
  const total = (active === null ? stripWidth * 6 : stripWidth * 5 + expandedWidth) + slant + gap * 5;
  let left = (width - total) / 2;
  const cuts = [[.05,.05,.62,.62],[.24,.34,.96,.96],[0,.10,.90,.80],[.18,.18,.88,.88],[.28,.38,1,1],[.16,.16,.84,.74]];
  return Array.from({ length: 6 }, (_, index) => {
    const cardWidth = index === active ? expandedWidth : stripWidth;
    const ends = index === active ? [0,0,1,1] : cuts[index];
    const points = ends.map((y, corner) => [left + slant * (1 - y) + (corner === 1 || corner === 2 ? cardWidth : 0), top + cardHeight * y]);
    const labelY = Math.min(cuts[index][2], cuts[index][3]) - .16;
    const captionTop = top + Math.max(cardHeight * .44, cardHeight - 250);
    const captionInset = slant * (1 - (captionTop - top) / cardHeight);
    const card = {
      points,
      left, top: Math.min(...points.map(point => point[1])), width: cardWidth + slant, height: cardHeight * (Math.max(...ends) - Math.min(...ends)),
      labelLeft: left + slant * (1 - labelY) + 8, labelTop: top + cardHeight * labelY - 24, labelWidth: cardWidth - 16,
      captionLeft: left + captionInset + 20, captionTop, captionWidth: cardWidth - captionInset - 40,
    };
    left += cardWidth + gap;
    return card;
  });
}

export function galleryPointerPreview(current, previous, point, target) {
  if (target === null || (previous && previous.x === point.x && previous.y === point.y)) return current;
  return target;
}
