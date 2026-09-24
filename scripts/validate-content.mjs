import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import content from '../content/portfolio.json' with { type: 'json' };
import { normalizeContent } from '../app/portfolio/config.mjs';

const publicRoot = path.resolve(import.meta.dirname, '../public');
const kinds = new Set(['intro', 'interests', 'projects', 'experience', 'credentials', 'education', 'awards', 'publications', 'skills', 'activities', 'contact']);

// Catch broken references before a CMS commit can replace the published site.
export function validateContent(data) {
  const check = (condition, message) => assert.ok(condition, `콘텐츠 오류: ${message}`);
  const uniqueIds = (items, label) => {
    const ids = items.map(item => item.id);
    check(ids.every(id => typeof id === 'string' && /^[a-z0-9-]+$/.test(id)), `${label} ID는 영문 소문자·숫자·하이픈만 사용하세요.`);
    check(new Set(ids).size === ids.length, `${label} ID가 중복되었습니다.`);
  };
  check(Array.isArray(data.sections) && data.sections.length > 0, '슬라이드 목록이 비어 있습니다.');
  data = normalizeContent(data);
  check(Array.isArray(data.profile.links), '명함 링크는 목록이어야 합니다.');
  check(data.sections.some(section => section.enabled), '표시할 슬라이드가 최소 하나 필요합니다.');
  uniqueIds(data.sections, '슬라이드');
  const ids = new Set(data.sections.map(section => section.id));
  for (const section of data.sections) {
    check(kinds.has(section.kind), `${section.id}: 지원하지 않는 슬라이드 종류입니다.`);
    check(typeof section.enabled === 'boolean', `${section.id}: 표시 여부가 필요합니다.`);
    check(Array.isArray(section.items), `${section.id}: 항목 목록이 필요합니다.`);
    check(section.framing && ['left', 'right'].includes(section.framing.side), `${section.id}: 텍스트 배치 정보를 확인하세요.`);
    check(/^scene-\d{2}$/.test(section.sceneId), `${section.id}: 배경 ID를 확인하세요.`);
    if (section.enabled && ['interests', 'skills'].includes(section.kind)) check(section.items.length > 0, `${section.id}: 항목을 하나 이상 입력하거나 슬라이드를 숨기세요.`);
    check(!section.mergeInto || (ids.has(section.mergeInto) && section.mergeInto !== section.id), `${section.id}: 상위 슬라이드를 확인하세요.`);
    check(section.chapterOrder?.every(id => ids.has(id)) ?? true, `${section.id}: 하위 탭 ID를 확인하세요.`);
    uniqueIds(section.items, `${section.id} 항목`);
    if (section.showcaseItems) uniqueIds(section.showcaseItems, `${section.id} 전시 항목`);
    for (const group of section.groups || []) uniqueIds(group.items, `${section.id} ${group.title}`);
    if (section.featuredItemIds) {
      const records = data.sections.filter(part => part.id === section.id || part.mergeInto === section.id).flatMap(part => part.showcaseItems ?? part.items);
      uniqueIds(records, `${section.id} 통합 전시 항목`);
      check(section.featuredItemIds.length <= 6, '대표 작업은 최대 6개입니다.');
      check(new Set(section.featuredItemIds).size === section.featuredItemIds.length, '대표 작업 ID가 중복되었습니다.');
      check(section.featuredItemIds.every(id => records.some(item => item.id === id)), '대표 작업 ID와 전시 항목 ID가 일치하지 않습니다.');
    }
  }
  const visit = (value, label = 'portfolio') => {
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      const location = `${label}.${key}`;
      if (entry && ['image', 'src', 'thumbnail', 'cv'].includes(key)) {
        check(typeof entry === 'string', `${location}: 파일 경로가 필요합니다.`);
        if (!/^https?:\/\//i.test(entry)) {
          check(/^\/(?!\/)/.test(entry) && !entry.includes('\\'), `${location}: /art 또는 /files로 시작하는 경로를 사용하세요.`);
          const file = path.resolve(publicRoot, `.${entry}`);
          check(file.startsWith(publicRoot + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile(), `${location}: 파일을 찾을 수 없습니다 (${entry}).`);
          check(!entry.startsWith('/bg/test/'), `${location}: 로컬 실험 이미지는 공개할 수 없습니다.`);
        }
      }
      if (entry && key === 'url') check(typeof entry === 'string' && /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(entry), `${location}: 웹 주소 또는 이메일 링크를 사용하세요.`);
      visit(entry, location);
    }
  };
  visit(data);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  validateContent(content);
  console.log(`콘텐츠 검증 완료: 슬라이드 ${content.sections.length}개`);
}
