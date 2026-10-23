export const LENS_ENTRY_DURATION = 1500;

export function lensJourney(aperture, image, viewport, source, position, fit) {
  const resize = fit === 'contain' ? Math.min : Math.max;
  const frame = (box, zoom) => {
    const scale = resize(box.width / source.width, box.height / source.height) * zoom;
    const width = source.width * scale, height = source.height * scale;
    return { width, height, left: box.left + (box.width - width) * position[0], top: box.top + (box.height - height) * position[1] };
  };
  const start = frame(image, 1), end = frame({ left: 0, top: 0, ...viewport }, 1.08);
  const x = aperture.left + aperture.width / 2, y = aperture.top + aperture.height / 2;
  const radius = aperture.width / 2, endRadius = Math.hypot(viewport.width, viewport.height) / 2 + 8;
  const transform = progress => `translate3d(${(start.left - end.left) * (1 - progress)}px,${(start.top - end.top) * (1 - progress)}px,0) scale(${start.width / end.width + (1 - start.width / end.width) * progress})`;
  return {
    end, x, y, radius, endRadius,
    clip: [`circle(${radius}px at ${x}px ${y}px)`, `circle(${endRadius}px at ${viewport.width / 2}px ${viewport.height / 2}px)`],
    view: [{ transform: transform(0) }, { transform: transform(1) }],
    rimTransform: `translate3d(${viewport.width / 2 - x}px,${viewport.height / 2 - y}px,0) scale(${endRadius / radius})`,
  };
}
