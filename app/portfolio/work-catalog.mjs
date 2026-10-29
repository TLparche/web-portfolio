export const workDomains = [
  { id: 'ai', title: 'AI', description: '데이터와 모델을 만들고, 쓰임을 연구하기', image: '/art/concepts/project-experiment.webp' },
  { id: 'platform', title: '플랫폼·도구 개발', description: '학습하고, 협업하고, 만드는 작업 환경', image: '/art/concepts/project-observation.webp' },
  { id: 'web', title: '웹서비스', description: '필요한 정보를 서비스로 연결하기', image: '/art/concepts/project-next.webp' },
  { id: 'plugins', title: '플러그인 개발', description: '익숙한 도구에 더하는 새로운 경험', image: '/art/concepts/project-portfolio.webp' },
  { id: 'xr', title: 'XR·인터랙션', description: '공간과 행동으로 넓히는 인터페이스', image: '/art/concepts/interest-observatory.webp' },
  { id: 'misc', title: 'Misc', description: '작은 실험과 기술 나눔, 문화와 커뮤니티', image: '/art/archive/education.webp' },
];

export const platformCategories = [
  { id: 'learning', title: '학습·실험' },
  { id: 'collaboration', title: '회의·협업' },
  { id: 'creation', title: '콘텐츠 제작' },
];

export function catalogItems(sections) {
  return sections.filter(section => section.enabled).flatMap(section => (section.showcaseItems || []).map(item => ({ ...item, collection: section.id, collectionTitle: section.title })));
}

export function workCover(item) {
  return typeof item.artwork === 'string' ? { src: item.artwork, alt: item.title } : item.artwork || (item.image ? { src: item.image, alt: item.title } : null);
}

export function sectionMedia(section) {
  return section.media?.length ? section.media : section.image ? [{ type: 'image', src: section.image, alt: section.alt, caption: section.caption, width: section.width, height: section.height, focus: section.focus }] : [];
}

export function mediaFocusStyle(media) {
  if (!media.focus) return undefined;
  const style = {};
  for (const [name, box] of [['focus', media.focus], ['compact', media.focus.mobile || media.focus]]) {
    style[`--${name}-ratio`] = `${box.width} / ${box.height}`;
    style[`--${name}-width`] = `${media.width / box.width * 100}%`;
    style[`--${name}-left`] = `${-box.x / box.width * 100}%`;
    style[`--${name}-top`] = `${-box.y / box.height * 100}%`;
  }
  return style;
}

export function mediaShape(media) {
  const { width = 16, height = 10 } = media?.focus || media || {};
  const ratio = width / height;
  return ratio < 1.05 ? 'portrait' : ratio >= 2.4 ? 'wide' : 'landscape';
}

export function workGallerySections(item) {
  const cover = workCover(item);
  return [
    { id: 'overview', title: '개요', body: item.description, media: cover?.src ? [{ type: 'image', ...cover, alt: cover.alt || item.title }] : [] },
    ...(item.detailSections || []).map((part, index) => ({ id: `section-${index + 1}`, title: part.title, body: part.body, media: sectionMedia(part) })),
  ];
}

export function summarizeWork({ detailSections, detail, bullets, ...item }) { return item; }

export function readWorkFilter(search) {
  const params = new URLSearchParams(search);
  const domain = workDomains.some(item => item.id === params.get('domain')) ? params.get('domain') : '';
  return { domain, category: domain === 'platform' && platformCategories.some(item => item.id === params.get('category')) ? params.get('category') : '' };
}

export function filterWorks(items, { domain = '', category = '' } = {}) {
  return items.filter(item => (!domain || item.domain === domain) && (!category || item.platformCategory === category));
}

export function workFilterQuery({ domain = '', category = '' } = {}) {
  const params = new URLSearchParams();
  if (domain) params.set('domain', domain);
  if (domain === 'platform' && category) params.set('category', category);
  return params.size ? `?${params}` : '';
}
