import { notFound } from 'next/navigation';
import { sections, assetUrl } from '../../portfolio/config.mjs';
import { catalogItems, workCover, workDomains, sectionMedia, workFilterQuery, mediaShape } from '../../portfolio/work-catalog.mjs';
import WorkMedia from '../WorkMedia';
import WorkCard from '../WorkCard';
import styles from '../Works.module.css';

const items = catalogItems(sections);
export const dynamicParams = false;
export function generateStaticParams() { return items.map(item => ({ slug: item.slug })); }
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = items.find(work => work.slug === slug);
  return item ? { title: `${item.title} | 신동호`, description: item.description } : {};
}

export default async function WorkPage({ params }) {
  const { slug } = await params;
  const item = items.find(work => work.slug === slug);
  if (!item) notFound();
  const cover = workCover(item), parts = item.detailSections || [];
  const related = (item.relatedWorkIds || []).map(id => items.find(work => work.id === id)).filter(Boolean);
  const domain = workDomains.find(domain => domain.id === item.domain);
  const toc = <ol>{parts.map((part, index) => <li key={index}><a href={`#section-${index + 1}`}>{part.title}</a></li>)}</ol>;
  return <main className={styles.page}><a className={styles.skip} href="#work-body">본문으로 건너뛰기</a><nav className={styles.topnav} aria-label="경험 탐색"><a href={`${assetUrl('/works/')}${workFilterQuery({ domain: item.domain })}`}>{domain?.title || item.collectionTitle} 목록</a><a href={assetUrl(`/#${item.collection}`)}>메인으로</a></nav>
    <article><div className={styles.hero} data-has-cover={Boolean(cover?.src)} data-media-shape={mediaShape(cover)}><header className={styles.workHeader}><p className={styles.context}><span>{domain?.title || item.collectionTitle}</span>{item.status && <span className={styles.status}>{item.status}</span>}</p><h1>{item.title}</h1><p className={styles.lead}>{item.description}</p></header>
      {cover?.src && <div className={styles.cover}><WorkMedia eager diagonal media={{ type: 'image', ...cover, alt: cover.alt || item.title, caption: cover.caption }}/></div>}</div>
      <dl className={styles.facts}>{[['기간', item.period], ['담당 범위', item.role], ['기술과 도구', item.tags?.join(' · ')]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {item.evidence && <p className={styles.evidence}><strong>자료 범위</strong>{item.evidence}</p>}
      {item.highlights?.length > 0 ? <dl className={styles.highlights}>{item.highlights.map(point => <div key={point.label}><dt>{point.label}</dt><dd><strong>{point.value}</strong><p>{point.note}</p></dd></div>)}</dl> : item.result && <p className={styles.result}>{item.result}</p>}
      <div className={styles.readingLayout} data-has-toc={parts.length > 2}>
        {parts.length > 2 && <aside className={styles.toc}><nav aria-label="본문 목차"><strong>이 기록에서</strong>{toc}</nav><details><summary>본문 목차</summary>{toc}</details></aside>}
        <div id="work-body" className={styles.body}>{item.detail && <p>{item.detail}</p>}{item.bullets?.length > 0 && <section><h2>주요 기여</h2><ul>{item.bullets.map(text => <li key={text}>{text}</li>)}</ul></section>}
          {parts.map((part, index) => <section id={`section-${index + 1}`} className={styles.story} key={index} data-layout={part.layout || 'stack'}><h2>{part.title}</h2><div className={styles.sectionContent}><div className={styles.prose}>{part.body.split('\n\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{sectionMedia(part).length > 0 && <div className={styles.mediaGrid} data-count={sectionMedia(part).length}>{sectionMedia(part).map((media, index) => <WorkMedia key={`${media.src}-${index}`} media={media}/>)}</div>}</div></section>)}
          {item.links?.length > 0 && <section className={styles.links}><h2>자료와 참고 링크</h2>{item.links.filter(link => link.url).map(link => <a key={link.url} href={link.url.startsWith('/') ? assetUrl(link.url) : link.url} target={/^https?:/.test(link.url) ? '_blank' : undefined} rel="noreferrer">{link.label}</a>)}</section>}
        </div>
      </div>
    </article>
    {related.length > 0 && <section className={styles.related}><h2>이어지는 기록</h2><div className={styles.grid}>{related.map(work => <WorkCard key={work.id} item={work}/>)}</div></section>}
    <footer className={styles.footer}><a href={assetUrl('/works/')}>전체 경험으로</a><a href={assetUrl('/#contact')}>연락하기</a></footer>
  </main>;
}
