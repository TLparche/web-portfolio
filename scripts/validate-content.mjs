import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import content from '../content/portfolio.json' with { type: 'json' };
import { normalizeContent } from '../app/portfolio/config.mjs';
import { workDomains, platformCategories } from '../app/portfolio/work-catalog.mjs';

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
  const works = data.sections.flatMap(section => section.showcaseItems || []);
  const availableWorkIds = new Set(data.sections.filter(section => section.enabled).flatMap(section => section.showcaseItems || []).map(item => item.id));
  uniqueIds(works, '전체 전시 항목');
  const slugs = new Set();
  for (const item of works) {
    check(typeof item.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug), `${item.id}: slug는 영문 소문자·숫자·하이픈으로 입력하세요.`);
    check(!slugs.has(item.slug), `${item.id}: slug가 중복되었습니다.`);
    slugs.add(item.slug);
    check(workDomains.some(domain => domain.id === item.domain), `${item.id}: 분야가 없거나 잘못된 분야입니다.`);
    if (item.domain === 'platform') check(platformCategories.some(category => category.id === item.platformCategory), `${item.id}: 플랫폼 내부 분류가 필요합니다.`);
    else check(!item.platformCategory, `${item.id}: 플랫폼 외 분야에는 내부 분류를 사용할 수 없습니다.`);
    if (item.relatedWorkIds != null) {
      check(Array.isArray(item.relatedWorkIds), `${item.id}: 관련 작업은 ID 목록이어야 합니다.`);
      check(new Set(item.relatedWorkIds).size === item.relatedWorkIds.length && item.relatedWorkIds.every(id => id !== item.id && availableWorkIds.has(id)), `${item.id}: 관련 작업 ID를 확인하세요.`);
    }
    if (item.artwork?.src) check(typeof item.artwork.alt === 'string' && item.artwork.alt.trim(), `${item.id}: 대표 이미지의 대체 텍스트가 필요합니다.`);
    for (const key of ['status', 'evidence']) if (item[key] != null) check(typeof item[key] === 'string', `${item.id}: ${key}는 문자열이어야 합니다.`);
  }
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
    if ((value.src || value.image) && (value.width != null || value.height != null)) check([value.width, value.height].every(size => Number.isInteger(size) && size > 0), `${label}: 미디어 너비·높이는 양의 정수로 함께 입력하세요.`);
    if (value.focus != null) {
      check((value.src || value.image) && value.type !== 'video' && [value.width, value.height].every(size => Number.isInteger(size) && size > 0), `${label}: 부분 화면은 원본 치수가 있는 이미지에만 지정하세요.`);
      check(typeof value.focus.caption === 'string' && value.focus.caption.trim(), `${label}: 부분 화면의 핵심 설명이 필요합니다.`);
      for (const box of [value.focus, value.focus.mobile].filter(box => box != null)) {
        check(['x', 'y', 'width', 'height'].every(key => Number.isInteger(box[key])) && box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0 && box.x + box.width <= value.width && box.y + box.height <= value.height, `${label}: 부분 화면 영역은 원본 이미지 안에 있어야 합니다.`);
      }
    }
    for (const [key, entry] of Object.entries(value)) {
      const location = `${label}.${key}`;
      if (key === 'highlights' && entry != null) {
        check(Array.isArray(entry), `${location}: 핵심 결과는 목록이어야 합니다.`);
        check(entry.every(point => point && ['label', 'value', 'note'].every(field => typeof point[field] === 'string' && point[field].trim())), `${location}: 결과 항목·값·검증 범위를 모두 입력하세요.`);
      }
      if (key === 'detailSections' && entry != null) {
        check(Array.isArray(entry), `${location}: 상세 문단은 목록이어야 합니다.`);
        for (const part of entry) {
          check(part && typeof part.title === 'string' && part.title.trim() && typeof part.body === 'string', `${location}: 소제목과 본문이 필요합니다.`);
          if (part.image) check(typeof part.alt === 'string' && part.alt.trim(), `${location}: 자료 이미지의 대체 텍스트가 필요합니다.`);
          if (part.caption != null) check(typeof part.caption === 'string', `${location}: 자료 설명은 문자열이어야 합니다.`);
          if (part.layout != null) check(['stack', 'split'].includes(part.layout), `${location}: 지원하지 않는 본문 배치입니다.`);
          if (part.media != null) {
            check(Array.isArray(part.media), `${location}: 미디어는 목록이어야 합니다.`);
            for (const media of part.media) {
              check(media && ['image', 'video'].includes(media.type) && typeof media.src === 'string' && media.src.trim(), `${location}: 미디어 유형과 경로가 필요합니다.`);
              check(typeof media.alt === 'string' && media.alt.trim(), `${location}: 미디어 대체 텍스트가 필요합니다.`);
              check(typeof media.caption === 'string' && media.caption.trim(), `${location}: 자료 설명과 출처가 필요합니다.`);
            }
          }
        }
      }
      if (entry && ['image', 'src', 'thumbnail', 'cv', 'videoSrc', 'poster'].includes(key)) {
        check(typeof entry === 'string', `${location}: 파일 경로가 필요합니다.`);
        if (!/^https?:\/\//i.test(entry)) {
          check(/^\/(?!\/)/.test(entry) && !entry.includes('\\'), `${location}: /art 또는 /files로 시작하는 경로를 사용하세요.`);
          const file = path.resolve(publicRoot, `.${entry}`);
          check(file.startsWith(publicRoot + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile(), `${location}: 파일을 찾을 수 없습니다 (${entry}).`);
          check(!entry.startsWith('/bg/test/'), `${location}: 로컬 실험 이미지는 공개할 수 없습니다.`);
        }
      }
      if (entry && key === 'url') check(typeof entry === 'string' && /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(entry), `${location}: 웹 주소 또는 이메일 링크를 사용하세요.`);
      if (entry != null && key === 'fps') check(typeof entry === 'number' && entry > 0 && entry <= 120, `${location}: 1~120 사이 프레임 레이트를 입력하세요.`);
      if (entry && ['position','mobilePosition'].includes(key) && label.includes('.visuals.')) check(/^\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/.test(entry) && entry.split(/\s+/).every(value=>parseFloat(value)<=100), `${location}: 0%~100% 범위의 가로 세로 비율을 입력하세요.`);
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
