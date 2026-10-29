'use client';

import { useEffect, useState } from 'react';
import { workDomains, platformCategories, readWorkFilter, filterWorks, workFilterQuery } from '../portfolio/work-catalog.mjs';
import { assetUrl } from '../portfolio/config.mjs';
import WorkCard from './WorkCard';
import styles from './Works.module.css';

export default function WorkCatalog({ items }) {
  const [filter, setFilter] = useState({ domain: '', category: '' });
  useEffect(() => {
    const read = () => setFilter(readWorkFilter(location.search));
    read(); window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  function choose(event, next) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); setFilter(next);
    history.pushState(null, '', `${assetUrl('/works/')}${workFilterQuery(next)}`);
  }
  const shown = filterWorks(items, filter);
  return <><nav className={styles.filters} aria-label="경험 분야">{[{ id: '', title: '전체 경험' }, ...workDomains].map(domain => <a key={domain.id} href={`${assetUrl('/works/')}${workFilterQuery({ domain: domain.id })}`} aria-current={filter.domain === domain.id ? 'true' : undefined} onClick={event => choose(event, { domain: domain.id, category: '' })}>{domain.title}</a>)}</nav>
    {filter.domain === 'platform' && <nav className={styles.subfilters} aria-label="플랫폼·도구 분류">{[{ id: '', title: '모두' }, ...platformCategories].map(category => <a key={category.id} href={`${assetUrl('/works/')}${workFilterQuery({ domain: 'platform', category: category.id })}`} aria-current={filter.category === category.id ? 'true' : undefined} onClick={event => choose(event, { domain: 'platform', category: category.id })}>{category.title}</a>)}</nav>}
    <p className={styles.count} role="status">{shown.length}개의 기록{!filter.domain && ' · 프로젝트·연구·실무·활동을 분야별로 담았습니다.'}</p>
    <div className={styles.grid}>{shown.map(item => <WorkCard key={item.id} item={item}/>)}</div>
    {!shown.length && <p>이 분류에 등록된 기록이 없습니다. 다른 분야를 선택해 주세요.</p>}
  </>;
}
