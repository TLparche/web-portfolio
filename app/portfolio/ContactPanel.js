import { assetUrl } from './config.mjs';
import styles from './ContactPanel.module.css';

export default function ContactPanel({ section, Heading, chapter, profile, firstId }) {
  const email = profile.email?.trim();
  const cv = profile.cv?.trim();
  const links = profile.links.filter(link => link.url?.trim());

  return <div className={styles.contact} data-copy data-contact-panel>
    <header className={styles.heading}>
      <span>{chapter}</span>
      <Heading id={`${section.id}-title`}>{section.title}</Heading>
      <small>LET’S CONNECT</small>
    </header>
    <div className={styles.content}>
      <div className={styles.intro}>
        <p className={styles.word} aria-hidden="true">CONTACT</p>
        <h3>{section.display}</h3>
        <p className={styles.headline}>{section.headline}</p>
        <p className={styles.body}>{section.body}</p>
      </div>
      <div className={styles.channels} data-scene-scroll>
        <div className={styles.channel}>
          <span className={styles.label}><small>01</small> EMAIL</span>
          {email ? <a className={styles.link} href={`mailto:${email}`}><span>{email}</span><span aria-hidden="true">↗</span></a> : <div className={styles.pending}><span>이메일</span><small>준비 중</small></div>}
        </div>
        <div className={styles.channel}>
          <span className={styles.label}><small>02</small> CURRICULUM VITAE</span>
          {cv ? <a className={styles.link} href={assetUrl(cv)}><span>CV 다운로드</span><span aria-hidden="true">↓</span></a> : <div className={styles.pending}><span>이력서</span><small>준비 중</small></div>}
        </div>
        <div className={styles.channel}>
          <span className={styles.label}><small>03</small> ELSEWHERE</span>
          {links.length ? links.map(link => <a key={link.url} className={styles.link} href={link.url} target="_blank" rel="noreferrer"><span>{link.label || link.url}</span><span aria-hidden="true">↗</span></a>) : <div className={styles.pending}><span>공개 채널</span><small>준비 중</small></div>}
        </div>
      </div>
    </div>
    <footer className={styles.footer}>
      <span>새로운 연결, 새로운 이야기.</span>
      <a href={`#${firstId}`}>처음으로 <span aria-hidden="true">↑</span></a>
    </footer>
  </div>;
}
