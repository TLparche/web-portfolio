import { assetUrl } from '../portfolio/config.mjs';
import { workCover, workDomains } from '../portfolio/work-catalog.mjs';
import styles from './Works.module.css';

export default function WorkCard({ item, onOpen, buttonId }) {
  const cover = workCover(item);
  const content = <><div className={styles.cardImage}>{cover?.src ? <img src={assetUrl(cover.thumbnail || cover.src)} alt={cover.alt || item.title} loading="lazy" decoding="async"/> : <span>{item.label || item.title.split(' — ')[0]}</span>}</div><div className={styles.cardText}><div className={styles.cardMeta}>{!onOpen && <small>{workDomains.find(domain => domain.id === item.domain)?.title || item.collectionTitle}</small>}<small className={styles.status}>{item.status || item.period}</small></div><h3>{item.title}</h3><p>{item.description}</p><span className={styles.cardAction}>{onOpen ? '요약 보기' : '기록 읽기'}<span aria-hidden="true"> ↗</span></span></div></>;
  return onOpen ? <button id={buttonId} className={styles.card} onClick={event => onOpen(item, event.currentTarget)} data-work-card data-item-id={item.id}>{content}</button> : <a className={styles.card} href={assetUrl(`/works/${item.slug}/`)}>{content}</a>;
}
