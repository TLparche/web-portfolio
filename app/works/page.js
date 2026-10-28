import { sections, assetUrl } from '../portfolio/config.mjs';
import { catalogItems, summarizeWork } from '../portfolio/work-catalog.mjs';
import WorkCatalog from './WorkCatalog';
import styles from './Works.module.css';

export const metadata = { title: '전체 경험 | 신동호', description: 'AI, 플랫폼·도구, 웹서비스, 플러그인, XR과 다양한 배움의 기록.' };

export default function WorksPage() {
  return <main className={styles.page}><a className={styles.skip} href="#works-list">경험 목록으로 건너뛰기</a><nav className={styles.topnav}><a href={assetUrl('/#projects')}>포트폴리오로 돌아가기</a><span>신동호의 경험 기록</span></nav><header className={styles.indexHeader}><h1>만들고, 실험하고,<br/>연결해 온 것들.</h1><p>프로젝트와 연구, 실무와 활동의 기록.<br/>분야별로 경험을 살펴보고, 각 기록에서 과정과 배움을 읽어 보세요.</p></header><section id="works-list" aria-label="전체 경험 목록"><WorkCatalog items={catalogItems(sections).map(summarizeWork)}/></section></main>;
}
