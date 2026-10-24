import test from 'node:test';
import assert from 'node:assert/strict';
import content from '../content/portfolio.json' with { type: 'json' };
import { validateContent } from '../scripts/validate-content.mjs';
import { assetUrl, normalizeContent } from '../app/portfolio/config.mjs';

test('CMS content accepts edits and rejects broken published references', () => {
  validateContent(content);
  const edited = structuredClone(normalizeContent(content));
  edited.profile.name = '편집 테스트';
  edited.sections[0].headline = '수정한 소개';
  const work = edited.sections.find(section => section.kind === 'projects');
  work.showcaseItems.push({ id: 'cms-test-work', title: '새 작업', description: '새 설명' });
  work.featuredItemIds = ['cms-test-work'];
  validateContent(edited);
  work.showcaseItems.pop();
  assert.throws(() => validateContent(edited), /대표 작업 ID/);
  const missing = structuredClone(normalizeContent(content));
  missing.profile.cv = '/files/missing-cms-test.pdf';
  assert.throws(() => validateContent(missing), /파일을 찾을 수 없습니다/);
  const duplicate = structuredClone(content);
  duplicate.sections.push(duplicate.sections[0]);
  assert.throws(() => validateContent(duplicate), /ID가 중복/);
});

test('CMS uploads use the deployment prefix and external assets keep their URL', () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = '/web-portfolio';
  try {
    assert.equal(assetUrl('/art/portrait.webp'), '/web-portfolio/art/portrait.webp');
    assert.equal(assetUrl('/files/cv.pdf'), '/web-portfolio/files/cv.pdf');
    assert.equal(assetUrl('https://example.com/portrait.webp'), 'https://example.com/portrait.webp');
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }
});

test('detail figures keep CMS fields and require accessible, existing assets', () => {
  const edited = structuredClone(content);
  const work = edited.sections.find(section => section.kind === 'projects').showcaseItems[0];
  const part = { title: '구현 흐름', body: '자료를 설명하는 본문', image: '/art/projects/moa.webp', alt: '음성에서 협업 캔버스로 이어지는 흐름', caption: '설명용 재구성' };
  work.detailSections = [part];
  assert.deepEqual(validateContent(edited).sections.find(section => section.kind === 'projects').showcaseItems[0].detailSections[0], part);
  part.alt = ' ';
  assert.throws(() => validateContent(edited), /대체 텍스트/);
  part.alt = '처리 흐름';
  part.image = '/art/projects/missing-diagram.webp';
  assert.throws(() => validateContent(edited), /파일을 찾을 수 없습니다/);
  delete part.image;
  delete part.alt;
  validateContent(edited);
  work.detailSections = {};
  assert.throws(() => validateContent(edited), /목록/);
});

test('CMS omission of empty fields keeps placeholders and cleared lists safe', () => {
  const saved = structuredClone(normalizeContent(content));
  delete saved.profile;
  for (const section of saved.sections) {
    if (!section.items.length) delete section.items;
    for (const group of section.groups || []) delete group.items;
  }
  const work = saved.sections.find(section => section.kind === 'projects');
  delete work.showcaseItems;
  delete work.featuredItemIds;
  const normalized = validateContent(saved);
  assert.deepEqual(normalized.profile.links, []);
  assert.equal(normalized.profile.name, '');
  assert.deepEqual(normalized.sections.find(section => section.kind === 'projects').showcaseItems, []);
  assert.deepEqual(normalizeContent(normalized), normalized);
});
