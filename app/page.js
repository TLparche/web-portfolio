'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import HologramBackground from './background/HologramBackground';
import Landing from './Landing';
import { buildPlan, planLength, segmentAt } from './scrollPlan';

const CH_NAMES = [
    'ABOUT', 'INTEREST', 'PROJECTS', 'EXPERIENCE', 'CERTIFICATIONS', 'EDUCATION',
    'AWARDS', 'PUBLICATIONS', 'SKILLS', 'ACTIVITIES', 'CONTACT',
];
const CH_COUNT = CH_NAMES.length;
const CH_LAST = CH_COUNT - 1;

// 챕터 02 관심분야 데이터, card는 썸네일에 들어가는 짧은 이름
const INTERESTS = [
    {
        key: 'bci', card: 'LOREM', name: 'Ipsum dolor', color: '#e564c8',
        quote: '「Lorem ipsum dolor sit amet.」',
        bar: 'Commodo consequat duis.',
        desc: 'Mollit anim id est laborum sed ut.',
        stack: 'Sit amet consectetur adipiscing',
        why: 'Anim id est laborum sed ut perspiciatis unde omnis iste natus error voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae.',
        where: 'Elit sed do eiusmod',
    },
    {
        key: 'eeg-fmri', card: 'Tempor incididunt', name: 'Labore dolore', color: '#b56de0',
        quote: '「Consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et.」',
        bar: 'Aute irure dolor in reprehenderit in voluptate velit.',
        desc: 'Perspiciatis unde omnis iste natus error voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta.',
        stack: 'Magna aliqua enim',
        why: 'Dicta sunt explicabo lorem ipsum dolor sit amet consectetur.',
        where: 'MINIM',
    },
    {
        key: 'alignment', card: 'Veniam', name: 'Quis nostrud', color: '#f07ab0',
        quote: '「Dolore magna aliqua ut.」',
        bar: 'Esse cillum dolore eu fugiat.',
        desc: 'Sunt explicabo lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod.',
        stack: 'Exercitation ullamco laboris nisi aliquip',
        why: 'Adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud.',
        where: 'Commodo',
    },
    {
        key: 'representation', card: 'Consequat', name: 'Duis aute', color: '#9184d9',
        quote: '「Enim ad minim veniam quis nostrud exercitation ullamco.」',
        bar: 'Nulla pariatur excepteur sint.',
        desc: 'Tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu.',
        stack: 'Irure reprehenderit voluptate velit esse',
        why: 'Exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis.',
        where: 'Cillum',
    },
    {
        key: 'speech', card: 'Fugiat', name: 'Nulla pariatur', color: '#d95fa8',
        quote: '「Laboris nisi ut aliquip ex ea.」',
        bar: 'Occaecat cupidatat non proident sunt in culpa qui officia deserunt.',
        desc: 'Fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit.',
        stack: 'Excepteur sint occaecat cupidatat proident',
        why: 'Aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis unde omnis iste natus error voluptatem accusantium doloremque laudantium totam.',
        where: 'Sunt culpa',
    },
];

const PROJ = [
    { no: '01', tabLabel: 'QUI OFFICIA', kicker: 'DESERUNT MOLLIT ANIM EST', title: 'Laborum perspiciatis unde omnis iste natus', meta: 'Error voluptatem accusantium doloremque laudantium totam rem aperiam', desc: 'Rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo lorem ipsum dolor sit amet consectetur adipiscing.', tags: ['quae', 'ab', 'illo', 'inventore', 'veritatis'], grad: 'linear-gradient(150deg,rgba(229,100,200,.34),rgba(145,132,217,.10) 60%,rgba(23,18,43,0))' },
    { no: '02', tabLabel: 'EAQUE', kicker: 'IPSA QUAE ILLO INVENTORE VERITATIS QUASI', title: 'Architecto beatae vitae dicta explicabo', meta: 'Nemo ipsam voluptas aspernatur aut odit', desc: 'Elit sed do eiusmod tempor incididunt ut labore et.', tags: ['quasi', 'architecto', 'beatae', 'vitae'], grad: 'linear-gradient(150deg,rgba(145,132,217,.34),rgba(229,100,200,.10) 60%,rgba(23,18,43,0))' },
    { no: '03', tabLabel: 'FUGIT', kicker: 'SEQUI NESCIUNT NEQUE LOREM', title: 'Ipsum dolor sit amet consectetur adipiscing', meta: 'Elit sed do eiusmod', desc: 'Dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum.', tags: ['dicta', 'explicabo', 'nemo', 'enim'], grad: 'linear-gradient(150deg,rgba(229,100,200,.26),rgba(145,132,217,.20) 60%,rgba(23,18,43,0))' },
    { no: '04', tabLabel: 'TEMPOR', kicker: 'Incididunt labore dolore', title: 'Magna aliqua enim minim', meta: 'Veniam quis nostrud exercitation ullamco laboris', desc: 'Dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa.', tags: ['ipsam', 'voluptas', 'aspernatur'], grad: 'linear-gradient(150deg,rgba(145,132,217,.28),rgba(229,100,200,.14) 60%,rgba(23,18,43,0))' },
];

const POP = [
    { media: 'NISI ALIQUIP', kicker: 'COMMODO CONSEQUAT DUIS AUTE IRURE REPREHENDERIT VOLUPTATE', title: 'Velit esse cillum fugiat', meta: 'Nulla pariatur excepteur sint occaecat cupidatat proident', tags: ['aut', 'odit', 'fugit', 'lorem', 'ipsum'], bullets: [
        'Irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur.',
        'Sint occaecat cupidatat non proident sunt culpa qui officia deserunt.',
        'Mollit anim id est laborum perspiciatis unde omnis iste natus error voluptatem accusantium.',
        'Doloremque laudantium totam rem aperiam eaque ipsa quae ab illo.',
    ] },
    { media: 'SUNT CULPA QUI OFFICIA', kicker: 'DESERUNT MOLLIT ANIM EST', title: 'Laborum perspiciatis unde omnis', meta: 'Iste natus error voluptatem accusantium doloremque laudantium', tags: ['dolor', 'sit', 'amet', 'consectetur'], bullets: [
        'Inventore veritatis quasi architecto beatae vitae dicta explicabo nemo enim ipsam voluptas aspernatur.',
        'Aut odit fugit lorem ipsum dolor sit amet consectetur adipiscing elit sed do.',
        'Eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam.',
        'Quis nostrud exercitation ullamco laboris nisi.',
    ] },
    { media: 'TOTAM REM APERIAM', kicker: 'EAQUE', title: 'Ipsa quae illo inventore veritatis quasi architecto', meta: 'Beatae vitae dicta explicabo nemo ipsam', tags: ['adipiscing', 'elit', 'sed', 'do'], bullets: [
        'Aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate.',
        'Velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt.',
        'Culpa qui officia deserunt mollit anim id est laborum.',
    ] },
    { media: 'VOLUPTAS ASPERNATUR', kicker: 'Aut odit fugit', title: 'Sequi nesciunt neque', meta: 'Lorem ipsum dolor sit amet consectetur adipiscing', tags: ['eiusmod', 'tempor', 'incididunt'], bullets: [
        'Perspiciatis unde omnis iste natus error voluptatem accusantium doloremque laudantium totam rem.',
        'Aperiam eaque ipsa quae ab illo inventore.',
    ] },
    { media: 'ELIT SED DO', kicker: 'EIUSMOD TEMPOR INCIDIDUNT LABORE DOLORE', title: 'Magna aliqua enim minim', meta: 'Veniam quis nostrud exercitation ullamco laboris nisi', tags: ['ut', 'labore', 'et', 'dolore'], bullets: [
        'Veritatis quasi architecto beatae vitae dicta explicabo nemo enim ipsam voluptas aspernatur aut odit fugit.',
        'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut.',
        'Labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation.',
        'Ullamco laboris nisi aliquip ex ea commodo.',
    ] },
    { media: 'ALIQUIP', kicker: 'COMMODO CONSEQUAT DUIS AUTE', title: 'Irure reprehenderit voluptate velit', meta: 'Esse cillum fugiat', tags: ['magna', 'aliqua', 'enim'], bullets: [
        'Consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla.',
    ] },
];

function clampUnit(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

function chapterVars(prog, count) {
    const v = {};
    for (let i = 1; i <= count; i++) {
        const raw = clampUnit(0.5 + ((count - 1) * prog - (i - 1)) / 2);
        const t = raw * raw * (3 - 2 * raw);
        v['--k' + i] = (0.5 - t).toFixed(4);
        v['--o' + i] = clampUnit(1 - Math.abs(t - 0.5) * 2.6).toFixed(3);
        v['--f' + i] = clampUnit((t - 0.2) / 0.28).toFixed(3);
    }
    return v;
}

// 임시: 배경 영상을 끝까지 보려고 마지막 챕터 뒤에 빈 슬롯을 붙였음.
// bg.json의 chapters 개수와 CH_COUNT + BLANK_SLOTS가 같아야 한다.
const BLANK_SLOTS = 0;
const SLOT_LAST = CH_LAST + BLANK_SLOTS;

// 챕터 하나당 스크롤 구간 = 영상 + 카메라 + 전환. 길이는 scrollPlan에 있다
const PLAN = buildPlan(SLOT_LAST + 1);
const SCROLL_PX = planLength(PLAN);

export default function Home() {
    const intCloseTimerRef = useRef(null);
    const chapterIndexRef = useRef(0);

    const [p3, setP3] = useState(0);
    const [pop, setPop] = useState(-1);
    const [proj, setProj] = useState(0);
    const [interest, setInterest] = useState(0);
    const [interestOpen, setInterestOpen] = useState(false);
    const [chapterIndex, setChapterIndex] = useState(0);
    const [viewportH, setViewportH] = useState(0);
    const [bgReady, setBgReady] = useState(false);
    const [seg, setSeg] = useState(() => segmentAt(PLAN, 0));

    // 플레이트에서 why 패널로 넘어갈 때 깜빡여서 닫는 쪽만 딜레이
    const openInterest = useCallback(() => {
        clearTimeout(intCloseTimerRef.current);
        setInterestOpen(true);
    }, []);
    const closeInterest = useCallback(() => {
        clearTimeout(intCloseTimerRef.current);
        intCloseTimerRef.current = setTimeout(() => setInterestOpen(false), 120);
    }, []);
    const closeInterestNow = useCallback(() => {
        clearTimeout(intCloseTimerRef.current);
        setInterestOpen(false);
    }, []);

    useEffect(() => () => clearTimeout(intCloseTimerRef.current), []);

    const glide = useCallback((top) => {
        window.scrollTo({ top, behavior: 'smooth' });
    }, []);

    const goToChapter = useCallback((i) => {
        glide(PLAN[i].start);
    }, [glide]);

    const prevCh = useCallback(() => {
        goToChapter(Math.max(0, Math.min(CH_LAST, chapterIndexRef.current) - 1));
    }, [goToChapter]);

    const nextCh = useCallback(() => {
        goToChapter(Math.min(CH_LAST, chapterIndexRef.current + 1));
    }, [goToChapter]);

    // 스크롤 위치에서 진행도 바로 계산, 애니메이션 루프 안 씀
    useEffect(() => {
        const onScroll = () => {
            const s = segmentAt(PLAN, window.scrollY);
            setSeg(s);

            // 텍스트는 전환 구간에서 다음 챕터로 넘어간다
            const progress = s.chapter + s.wipe;
            setP3(progress / CH_LAST);

            const idx = Math.min(SLOT_LAST, Math.round(progress));
            if (idx !== chapterIndexRef.current) {
                chapterIndexRef.current = idx;
                setChapterIndex(idx);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const onResize = () => setViewportH(window.innerHeight);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const ch3 = chapterIndex;
    // 빈 슬롯에서는 이름 있는 마지막 챕터를 표시에 쓴다
    const navIdx = Math.min(CH_LAST, ch3);
    // 진행 표시는 스크롤 위치 그대로. chapterIndex는 전환 중간에 먼저 넘어간다
    const overall = (PLAN[seg.chapter].start + seg.frac * PLAN[seg.chapter].total) / SCROLL_PX;
    const pct3 = String(Math.round(overall * 100)).padStart(3, '0') + '%';
    const chapter3 = String(navIdx + 1).padStart(2, '0');
    const chapterName3 = CH_NAMES[navIdx];
    const chapterVarsObj = chapterVars(p3, CH_COUNT);

    const pjd = PROJ[proj];
    const pd = POP[pop < 0 ? 0 : pop];

    const ind = INTERESTS[interest];
    const interestPrev = () => setInterest((i) => (i + INTERESTS.length - 1) % INTERESTS.length);
    const interestNext = () => setInterest((i) => (i + 1) % INTERESTS.length);

    const tabStyle = (n) => ({
        padding: '10px 18px',
        cursor: 'pointer',
        font: '500 11.5px ui-monospace,Menlo,monospace',
        letterSpacing: '.14em',
        color: n === proj ? 'var(--color-accent)' : 'rgba(236,233,245,.45)',
        boxShadow: n === proj ? 'inset 0 -2px 0 var(--color-accent)' : 'none',
        background: n === proj ? 'rgba(229,100,200,.07)' : 'transparent',
        transition: 'color .25s, box-shadow .25s, background .25s',
    });

    const thumbStyle = (n) => ({
        width: '74px',
        height: '52px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-end',
        padding: '6px',
        background: PROJ[n].grad,
        border: '1px solid ' + (n === proj ? 'var(--color-accent)' : 'rgba(255,255,255,.16)'),
        transform: n === proj ? 'translateY(-6px) scale(1.06)' : 'none',
        boxShadow: n === proj ? '0 0 22px rgba(229,100,200,.35)' : 'none',
        opacity: n === proj ? 1 : 0.62,
        transition: 'transform .3s cubic-bezier(.2,.8,.2,1), border-color .3s, opacity .3s, box-shadow .3s',
    });

    const progress3Style = {
        position: 'absolute', top: 0, left: 0, width: '100%',
        height: (overall * 100).toFixed(2) + '%',
        background: 'linear-gradient(var(--color-accent),var(--color-accent-2))',
        boxShadow: '0 0 12px var(--color-accent)',
        transition: 'height .12s linear',
    };

    const chaptersStyle = { position: 'relative', ...chapterVarsObj };

    const popStyle = pop < 0
        ? { display: 'none' }
        : { position: 'fixed', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };

    const popIndex = 'DETAIL ' + String(Math.max(pop, 0) + 1).padStart(2, '0') + ' / ' + String(POP.length).padStart(2, '0');

    return (
        <>
            <Landing ready={bgReady}/>

            {/* 챕터가 전부 fixed라 스크롤 높이는 이걸로 만듦 */}
            <div style={{ height: SCROLL_PX + viewportH }}/>

            <HologramBackground progress={p3} scroll={seg} onReady={() => setBgReady(true)}/>

            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5, background: 'repeating-linear-gradient(to bottom,rgba(255,255,255,.03) 0 1px,transparent 1px 3px)', mixBlendMode: 'overlay' }}/>

            <div className="dh-hud">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0' }}>
                    <span style={{ width: '8px', height: '8px', flex: 'none', background: 'var(--color-accent)', boxShadow: '0 0 12px var(--color-accent)', transform: 'rotate(45deg)' }}/>
                    <span style={{ font: '500 12px ui-monospace,Menlo,monospace', letterSpacing: '.22em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Lorem</span>
                    <span className="dh-hud-sub" style={{ font: '400 11px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'rgba(236,233,245,.42)' }}>// {chapterName3} · WEBGL</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.18em', color: 'var(--color-accent-300)', whiteSpace: 'nowrap' }}>
                    <span>{chapter3}/{CH_COUNT}</span><span style={{ color: 'rgba(236,233,245,.3)' }}>|</span><span>{pct3}</span>
                </div>
            </div>

            <nav className={"dh-side-nav"}>
                {CH_NAMES.map((name, i) => (
                    <div key={name} onClick={() => goToChapter(i)} className={'dh-side-item' + (i === navIdx ? ' dh-side-active' : '')}>
                        <span className="dh-side-num">{String(i + 1).padStart(2, '0')}</span>
                        <span className="dh-side-name">{name}</span>
                    </div>
                ))}
            </nav>

            <div style={{ position: 'fixed', right: '0', top: '0', height: '100%', width: '2px', zIndex: '8', background: 'rgba(255,255,255,.06)' }}>
                <div style={progress3Style}/>
            </div>

            <div style={{ position: 'fixed', right: '20px', bottom: '20px', zIndex: '9', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <span onClick={navIdx <= 0 ? undefined : prevCh} className={'dh-nav-btn dh-nav-prev ' + (navIdx <= 0 ? 'dh-nav-disabled' : 'dh-nav-active')}>▲</span>
                <span onClick={navIdx >= CH_LAST ? undefined : nextCh} className={'dh-nav-btn dh-nav-next ' + (navIdx >= CH_LAST ? 'dh-nav-disabled' : 'dh-nav-active')}>▼</span>
            </div>

            <div style={chaptersStyle}>

                {/* 01 · About */}
                <div className={'dh-chapter dh-pad-x' + (chapterIndex === 0 ? '' : ' dh-chapter-hidden')} style={{ display: 'flex', alignItems: 'center', opacity: 'var(--o1)' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 62% 48%,rgba(229,100,200,.34),rgba(145,132,217,.14) 46%,rgba(23,18,43,0) 74%)', transform: 'scale(calc(1 + var(--k1) * 0.45))' }}/>
                    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(to right,rgba(229,100,200,.07) 0 1px,transparent 1px 64px),repeating-linear-gradient(to bottom,rgba(229,100,200,.07) 0 1px,transparent 1px 64px)', animation: 'gridScroll 14s linear infinite' }}/>
                    <div style={{ position: 'relative', zIndex: '2', width: '100%' }}>
                        <div style={{ font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--color-accent-300)', marginBottom: '22px', opacity: 'var(--o1)', transform: 'translateY(calc(var(--k1) * 170px)) scale(calc(1 - var(--k1) * 0.12))' }}>01 · About</div>
                        <div style={{ font: '500 clamp(34px,9vw,92px)/.95 Inter,system-ui,sans-serif', letterSpacing: '-.045em', maxWidth: '16ch', opacity: 'var(--o1)', transform: 'translateY(calc(var(--k1) * 190px))' }}>
                            <div>IPSUM DOLOR</div>
                            <div style={{ color: 'var(--color-accent)' }}>SIT</div>
                        </div>
                        <p style={{ font: '400 clamp(14px,2vw,17px)/1.7 Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.68)', maxWidth: '56ch', margin: '26px 0 0', opacity: 'var(--o1)', transform: 'translateY(calc(var(--k1) * 130px)) scale(calc(1 - var(--k1) * 0.08))' }}>Amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure.</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', marginTop: '30px', opacity: 'var(--o1)', transform: 'translateY(calc(var(--k1) * 170px)) scale(calc(1 - var(--k1) * 0.12))' }}>
                            <div><div style={{ font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'rgba(236,233,245,.4)', marginBottom: '5px' }}>BASED IN</div><div style={{ font: '500 16px Inter,system-ui,sans-serif' }}>In reprehenderit</div></div>
                            <div><div style={{ font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'rgba(236,233,245,.4)', marginBottom: '5px' }}>FOCUS</div><div style={{ font: '500 16px Inter,system-ui,sans-serif' }}>Voluptate velit</div></div>
                            <div><div style={{ font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'rgba(236,233,245,.4)', marginBottom: '5px' }}>STATUS</div><div style={{ font: '500 16px Inter,system-ui,sans-serif' }}>Esse cillum eu fugiat nulla</div></div>
                        </div>
                    </div>
                    <div style={{ position: 'absolute', bottom: '26px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', animation: 'bob 2.6s ease-in-out infinite' }}>
                        <span style={{ font: '500 10px ui-monospace,Menlo,monospace', letterSpacing: '.24em', color: 'rgba(236,233,245,.45)' }}>SCROLL</span>
                        <span style={{ width: '1px', height: '28px', background: 'linear-gradient(var(--color-accent),transparent)' }}/>
                    </div>
                </div>

                {/* 02 · Interest */}
                <div className={'dh-chapter dh-interest' + (chapterIndex === 1 ? '' : ' dh-chapter-hidden')} style={{ '--accent-i': ind.color, opacity: 'var(--o2)' }}>
                    <div className={"dh-int-shade"} style={{ transform: 'translateX(calc(var(--k2) * -120px))' }}/>
                    <div className="dh-int-glow2" style={{ opacity: 'var(--o2)' }}/>

                    <div
                        className={'dh-int-plate' + (interestOpen ? ' dh-int-plate-open' : '')}
                        onMouseEnter={openInterest}
                        onMouseLeave={closeInterest}
                        style={{ transform: 'translateX(calc(var(--k2) * -120px))' }}
                    >
                        <span onClick={closeInterestNow} className="dh-int-close">✕</span>

                        <div className={"dh-int-col"}>
                            <div style={{ opacity: 'var(--o2)', transform: 'translateY(calc(var(--k2) * 140px))' }}>
                                <div className="dh-int-kicker">02 · INTEREST</div>
                            </div>

                            <div key={interest} className="dh-int-body">
                                <h3 className={"dh-int-name"}>{ind.name}</h3>
                                <div className="dh-int-rows">
                                    <div className="dh-int-bubble">{ind.quote}</div>
                                    <div className={"dh-int-stack-sm"}>{ind.stack}</div>
                                </div>
                                <div className="dh-int-bar">{ind.bar}</div>
                                <p className="dh-int-desc2">{ind.desc}</p>

                                <div className={"dh-int-rail"}>
                                    <span onClick={interestPrev} className="dh-int-arrow">◂</span>
                                    <div className="dh-int-cards-row">
                                        {INTERESTS.map((it, n) => (
                                            <div key={it.key} onClick={() => setInterest(n)} className={"dh-int-card2"}>
                                                <div
                                                    className="dh-int-thumb2"
                                                    style={{ '--card-accent': it.color, borderColor: n === interest ? 'var(--color-accent-200)' : undefined }}
                                                />
                                                <div className="dh-int-card2-label" style={{ color: n === interest ? 'var(--color-accent-200)' : undefined }}>{it.card}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <span onClick={interestNext} className={"dh-int-arrow"}>▸</span>
                                </div>

                                <div className="dh-int-stripe"/>
                            </div>
                        </div>

                        <div className="dh-int-ext">
                            <div className={"dh-int-ext-divider"}/>
                            <div className="dh-int-ext-body">
                                <div className="dh-int-ext-label">WHY THIS</div>
                                <p className={"dh-int-ext-text"}>{ind.why}</p>
                                <div className="dh-int-ext-meta">
                                    <div><div className="dh-int-ext-meta-label">STACK</div><div className={"dh-int-ext-meta-val"}>{ind.stack}</div></div>
                                    <div><div className="dh-int-ext-meta-label">WHERE</div><div className="dh-int-ext-meta-val">{ind.where}</div></div>
                                </div>
                            </div>
                            <div className={"dh-int-ext-image"}>IMAGE</div>
                        </div>
                    </div>
                </div>

                {/* 03 · Projects */}
                <div className={'dh-chapter' + (chapterIndex === 2 ? '' : ' dh-chapter-hidden')} style={{ opacity: 'var(--o3)' }}>
                    <div className="dh-proj-decor" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '56%', transformOrigin: 'right center', transform: 'perspective(1400px) rotateY(calc(var(--k3) * 14deg)) translateX(calc(var(--k3) * 120px)) scale(calc(1 - var(--k3) * 0.1))' }}>
                        <div style={{ position: 'absolute', inset: 0, background: pjd.grad, transition: 'background .45s ease' }}/>
                    </div>
                    <div className="dh-proj-decor" style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '56%', background: 'linear-gradient(to right,var(--color-bg) 2%,rgba(23,18,43,.55) 34%,rgba(23,18,43,0) 78%)' }}/>
                    <div className={"dh-proj-decor dh-proj-number"} style={{ position: 'absolute', top: '26%', font: '500 clamp(90px,18vw,210px)/1 Inter,system-ui,sans-serif', letterSpacing: '-.07em', color: 'rgba(229,100,200,.13)', transform: 'translateY(calc(var(--k3) * -190px)) scale(calc(1 + var(--k3) * 0.2))' }}>{pjd.no}</div>

                    <div className="dh-proj-content">
                        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '14px', marginBottom: '22px', opacity: 'var(--o3)', transform: 'translateY(calc(var(--k3) * 150px)) scale(calc(1 - var(--k3) * 0.1))' }}>
                            <h2 style={{ font: '500 clamp(22px,4.5vw,34px) Inter,system-ui,sans-serif', letterSpacing: '-.03em', margin: '0' }}>03 · PROJECTS</h2>
                            <span style={{ font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.18em', color: 'rgba(236,233,245,.4)' }}>SELECT A FILE</span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, borderBottom: '1px solid rgba(255,255,255,.12)', marginBottom: '26px', opacity: 'var(--o3)', transformOrigin: 'left center', transform: 'rotate(calc(var(--k3) * -2.2deg)) translateX(calc(var(--k3) * 150px))' }}>
                            {PROJ.map((p, n) => (
                                <span key={p.no} onClick={() => setProj(n)} style={tabStyle(n)}>{p.no} {p.tabLabel}</span>
                            ))}
                        </div>

                        <div style={{ opacity: 'var(--o3)', transform: 'translateY(calc(var(--k3) * 170px)) scale(calc(1 - var(--k3) * 0.08))' }}>
                            <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.2em', color: 'var(--color-accent-300)', marginBottom: '14px' }}>{pjd.kicker}</div>
                            <h3 style={{ font: '500 clamp(26px,6vw,52px)/1.08 Inter,system-ui,sans-serif', letterSpacing: '-.035em', margin: '0 0 14px' }}>{pjd.title}</h3>
                            <div style={{ font: '400 12.5px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.45)', marginBottom: '18px' }}>{pjd.meta}</div>
                            <p style={{ font: '400 16px/1.7 Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.68)', maxWidth: '46ch', margin: '0 0 22px' }}>{pjd.desc}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '28px' }}>
                                {pjd.tags.map((t) => (
                                    <span key={t} className="tag tag-neutral" style={{ fontSize: '11.5px' }}>{t}</span>
                                ))}
                            </div>
                            <span onClick={() => setPop(proj)} className={"btn btn-primary"} style={{ padding: '12px 22px', letterSpacing: '.08em', cursor: 'pointer', clipPath: 'polygon(0 0,100% 0,100% 72%,calc(100% - 14px) 100%,0 100%)' }}>VIEW DETAIL ▸</span>
                        </div>
                    </div>

                    <div className="dh-proj-decor dh-proj-thumbs" style={{ position: 'absolute', bottom: '44px', zIndex: 3, display: 'flex', gap: '10px', transform: 'translateY(calc(var(--k3) * -180px)) rotate(calc(var(--k3) * 3deg))' }}>
                        {PROJ.map((p, n) => (
                            <div key={p.no} onClick={() => setProj(n)} style={thumbStyle(n)}>
                                <span style={{ font: '500 9.5px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'rgba(236,233,245,.6)' }}>{p.no}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 04 · Experience */}
                <div className={'dh-chapter dh-pad-x' + (chapterIndex === 3 ? '' : ' dh-chapter-hidden')} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: 'var(--o4)' }}>
                    <div style={{ position: 'absolute', right: '-80px', top: 0, bottom: 0, width: '640px', background: 'radial-gradient(ellipse at 50% 50%,rgba(145,132,217,.22),transparent 62%)', transform: 'translateX(calc(var(--k4) * 420px))' }}/>
                    <h2 style={{ font: '500 clamp(24px,5vw,42px) Inter,system-ui,sans-serif', letterSpacing: '-.03em', margin: '0 0 26px', position: 'relative', opacity: 'var(--o4)', transformOrigin: 'left center', transform: 'rotate(calc(var(--k4) * -3.2deg)) translate(calc(var(--k4) * 150px),calc(var(--k4) * 60px))' }}>04 · EXPERIENCE</h2>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="dh-exp-row dh-exp-grid" style={{ border: '1px solid rgba(255,255,255,.12)', padding: '22px 24px', opacity: 'var(--o4)', transformOrigin: 'left center', transform: 'rotate(calc(var(--k4) * -3.2deg)) translate(calc(var(--k4) * 150px),calc(var(--k4) * 60px))' }}>
                            <div><div style={{ font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'var(--color-accent-300)' }}>PARIATUR EXCEPTEUR</div><div style={{ font: '400 11px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.4)', marginTop: '4px' }}>Sint</div></div>
                            <div><div style={{ font: '500 22px Inter,system-ui,sans-serif', letterSpacing: '-.015em', marginBottom: '5px' }}>Occaecat cupidatat non proident sunt culpa qui officia.</div><div style={{ font: '400 13.5px Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.6)' }}>Deserunt mollit anim id est laborum perspiciatis unde omnis iste.</div></div>
                            <span onClick={() => setPop(4)} className={"dh-exp-arrow"}>▸</span>
                        </div>
                        <div className="dh-exp-row dh-exp-grid" style={{ border: '1px solid rgba(255,255,255,.12)', padding: '22px 24px', opacity: 'var(--o4)', transformOrigin: 'left center', transform: 'rotate(calc(var(--k4) * -3.2deg)) translate(calc(var(--k4) * 150px),calc(var(--k4) * 60px))' }}>
                            <div><div style={{ font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'var(--color-accent-300)' }}>NATUS ERROR</div><div style={{ font: '400 11px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.4)', marginTop: '4px' }}>Voluptatem</div></div>
                            <div><div style={{ font: '500 22px Inter,system-ui,sans-serif', letterSpacing: '-.015em', marginBottom: '5px' }}>Accusantium doloremque laudantium totam rem</div><div style={{ font: '400 13.5px Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.6)' }}>Aperiam eaque ipsa quae ab illo inventore.</div></div>
                            <span onClick={() => setPop(5)} className="dh-exp-arrow">▸</span>
                        </div>
                        <div className={"dh-exp-grid"} style={{ border: '1px dashed rgba(255,255,255,.14)', padding: '22px 24px', opacity: 'var(--o4)', transformOrigin: 'left center', transform: 'rotate(calc(var(--k4) * -2.6deg)) translateX(calc(var(--k4) * 120px))' }}>
                            <div><div style={{ font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'rgba(236,233,245,.4)' }}>SLOT</div></div>
                            <div style={{ font: '400 13.5px Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.45)' }}>Veritatis quasi architecto beatae vitae dicta explicabo nemo enim ipsam voluptas aspernatur.</div>
                            <span style={{ font: '400 20px Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.25)', textAlign: 'center' }}>+</span>
                        </div>
                    </div>
                </div>

                {/* 05 · Certifications */}
                <div className={'dh-chapter dh-pad-x' + (chapterIndex === 4 ? '' : ' dh-chapter-hidden')} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: 'var(--o5)' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(to bottom,rgba(229,100,200,.06) 0 1px,transparent 1px 70px)', transform: 'perspective(1200px) rotateX(calc(var(--k5) * 22deg)) translateY(calc(var(--k5) * 220px))' }}/>
                    <h2 style={{ font: '500 clamp(24px,5vw,42px) Inter,system-ui,sans-serif', letterSpacing: '-.03em', margin: '0 0 26px', position: 'relative', opacity: 'var(--o5)', transform: 'perspective(1100px) rotateY(calc(var(--k5) * 16deg)) translateX(calc(var(--k5) * 110px))' }}>05 · CERTIFICATIONS</h2>
                    <div className="dh-grid-2" style={{ position: 'relative', opacity: 'var(--o5)', transform: 'perspective(1100px) rotateX(calc(var(--k5) * 20deg)) translateY(calc(var(--k5) * 130px))' }}>
                        <div style={{ border: '1px solid rgba(255,255,255,.12)', padding: '24px' }}>
                            <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.18em', color: 'rgba(236,233,245,.4)', marginBottom: '18px' }}>PROFESSIONAL</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}><span style={{ font: '500 18px Inter,system-ui,sans-serif' }}>Aut odit fugit lorem ipsum dolor.</span><span className="tag tag-neutral">SIT</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}><span style={{ font: '500 18px Inter,system-ui,sans-serif' }}>Amet consectetur adipiscing</span><span className={"tag tag-neutral"}>ELIT SED</span></div>
                        </div>
                        <div style={{ border: '1px solid rgba(255,255,255,.12)', padding: '24px' }}>
                            <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.18em', color: 'rgba(236,233,245,.4)', marginBottom: '18px' }}>LANGUAGE PROFICIENCY</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}><span style={{ font: '500 17px Inter,system-ui,sans-serif' }}>DO <span style={{ color: 'rgba(236,233,245,.5)', fontSize: '13px' }}>Eiusmod tempor</span></span><span className="tag tag-accent">INCIDIDUNT</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}><span style={{ font: '500 17px Inter,system-ui,sans-serif' }}>UT LABORE <span style={{ color: 'rgba(236,233,245,.5)', fontSize: '13px' }}>Et</span></span><span className="tag tag-neutral">DOLORE MAGNA</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}><span style={{ font: '500 17px Inter,system-ui,sans-serif' }}>Aliqua enim <span style={{ color: 'rgba(236,233,245,.5)', fontSize: '13px' }}>Ad</span></span><span className={"tag tag-neutral"}>MINIM</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 06 · Education */}
                <div className={'dh-chapter dh-pad-x' + (chapterIndex === 5 ? '' : ' dh-chapter-hidden')} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: 'var(--o6)' }}>
                    <div style={{ position: 'absolute', left: '-100px', top: 0, bottom: 0, width: '600px', background: 'radial-gradient(ellipse at 50% 50%,rgba(229,100,200,.22),transparent 62%)', transform: 'translateX(calc(var(--k6) * -300px))' }}/>
                    <h2 style={{ font: '500 clamp(24px,5vw,42px) Inter,system-ui,sans-serif', letterSpacing: '-.03em', margin: '0 0 26px', position: 'relative', opacity: 'var(--o6)', transform: 'scale(calc(1 - var(--k6) * 0.14)) translateY(calc(var(--k6) * 90px))' }}>06 · EDUCATION</h2>
                    <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,.12)', padding: '34px', opacity: 'var(--o6)', transform: 'scale(calc(1 - var(--k6) * 0.2)) translateY(calc(var(--k6) * 110px))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline', marginBottom: '8px' }}>
                            <div style={{ font: '500 clamp(20px,5vw,34px) Inter,system-ui,sans-serif', letterSpacing: '-.025em' }}>Veniam quis nostrud exercitation</div>
                            <div style={{ font: '500 12px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'var(--color-accent-300)' }}>MAR 2020 - FEB 2027 (EXPECTED)</div>
                        </div>
                        <div style={{ font: '400 16px Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.68)', marginBottom: '26px' }}>Ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate.</div>
                        <div className="dh-grid-3-stats" style={{ borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: '22px' }}>
                            <div><div style={{ font: '500 32px Inter,system-ui,sans-serif', color: 'var(--color-accent)', letterSpacing: '-.02em' }}>0.00<span style={{ fontSize: '16px', color: 'rgba(236,233,245,.4)' }}>/4.5</span></div><div style={{ font: '400 11px ui-monospace,Menlo,monospace', letterSpacing: '.12em', color: 'rgba(236,233,245,.45)' }}>TOTAL GPA</div></div>
                            <div><div style={{ font: '500 32px Inter,system-ui,sans-serif', color: 'var(--color-accent)', letterSpacing: '-.02em' }}>0.00<span style={{ fontSize: '16px', color: 'rgba(236,233,245,.4)' }}>/4.5</span></div><div style={{ font: '400 11px ui-monospace,Menlo,monospace', letterSpacing: '.12em', color: 'rgba(236,233,245,.45)' }}>MAJOR GPA</div></div>
                            <div><div style={{ font: '500 32px Inter,system-ui,sans-serif', color: 'var(--color-accent)', letterSpacing: '-.02em' }}>0000-00</div><div style={{ font: '400 11px ui-monospace,Menlo,monospace', letterSpacing: '.12em', color: 'rgba(236,233,245,.45)' }}>VELIT ESSE CILLUM EU</div></div>
                        </div>
                    </div>
                </div>

                {/* 07 · Awards & Honors */}
                <div className={'dh-chapter dh-pad-x' + (chapterIndex === 6 ? '' : ' dh-chapter-hidden')} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: 'var(--o7)' }}>
                    <div className="dh-awards-ghost" style={{ position: 'absolute', top: '12%', left: 0, right: 0, font: '500 clamp(70px,16vw,170px)/1 Inter,system-ui,sans-serif', letterSpacing: '-.06em', whiteSpace: 'nowrap', color: 'var(--color-accent)', transform: 'translateX(calc(var(--k7) * 26%))', opacity: 'calc(.05 + var(--o7) * .09)' }}>AWARDS</div>
                    <h2 style={{ font: '500 clamp(24px,5vw,42px) Inter,system-ui,sans-serif', letterSpacing: '-.03em', margin: '0 0 26px', position: 'relative', opacity: 'var(--o7)', transform: 'translateY(calc(var(--k7) * 150px))' }}>07 · AWARDS & HONORS</h2>
                    <div className={"dh-grid-2b"} style={{ position: 'relative' }}>
                        <div style={{ border: '1px solid rgba(255,255,255,.12)', padding: '24px', opacity: 'var(--o7)', transformOrigin: 'bottom left', transform: 'rotate(calc(var(--k7) * -3.5deg)) translateY(calc(var(--k7) * 130px))' }}>
                            <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.18em', color: 'rgba(236,233,245,.4)', marginBottom: '18px' }}>AWARDS</div>
                            <div style={{ paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}><span style={{ font: '500 20px Inter,system-ui,sans-serif' }}>Fugiat nulla pariatur excepteur</span><span className="tag tag-accent">SINT OCCAECAT</span></div>
                                <div style={{ font: '400 12.5px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.45)', marginTop: '5px' }}>CUPIDATAT</div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}><span style={{ font: '500 20px Inter,system-ui,sans-serif' }}>Non proident sunt culpa qui</span><span className="tag tag-accent">OFFICIA</span></div>
                                <div style={{ font: '400 12.5px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.45)', marginTop: '5px' }}>DESERUNT</div>
                            </div>
                        </div>
                        <div style={{ border: '1px solid rgba(255,255,255,.12)', padding: '24px', opacity: 'var(--o7)', transformOrigin: 'bottom right', transform: 'rotate(calc(var(--k7) * 3.5deg)) translateY(calc(var(--k7) * 130px))' }}>
                            <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.18em', color: 'rgba(236,233,245,.4)', marginBottom: '18px' }}>HONORS</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '13px', font: '400 14.5px Inter,system-ui,sans-serif' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}><span>Mollit anim id est laborum perspiciatis unde.</span><span style={{ font: '400 11px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.42)', whiteSpace: 'nowrap' }}>0000-00</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}><span>Omnis iste natus</span><span style={{ font: '400 11px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.42)', whiteSpace: 'nowrap' }}>ERROR</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}><span>Voluptatem accusantium doloremque laudantium totam</span><span style={{ font: '400 11px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.42)', whiteSpace: 'nowrap' }}>0000-00</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}><span>Rem aperiam eaque</span><span style={{ font: '400 11px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.42)', whiteSpace: 'nowrap' }}>IPSA</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 08 · Publications */}
                <div className={'dh-chapter dh-pad-x' + (chapterIndex === 7 ? '' : ' dh-chapter-hidden')} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: 'var(--o8)' }}>
                    <h2 style={{ font: '500 clamp(24px,5vw,42px) Inter,system-ui,sans-serif', letterSpacing: '-.03em', margin: '0 0 10px', opacity: 'var(--o8)', transform: 'translateY(calc(var(--k8) * 200px))' }}>08 · PUBLICATIONS</h2>
                    <p style={{ font: '400 14.5px Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.5)', margin: '0 0 26px', maxWidth: '56ch', opacity: 'var(--o8)', transform: 'translateY(calc(var(--k8) * 200px))' }}>Quae ab illo inventore veritatis quasi architecto beatae vitae dicta explicabo nemo enim ipsam voluptas aspernatur aut odit fugit.</p>
                    <div className={"dh-grid-2"} style={{ opacity: 'var(--o8)', transform: 'scale(calc(1 - var(--k8) * 0.16)) translateY(calc(var(--k8) * 140px))' }}>
                        <div style={{ border: '1px solid rgba(255,255,255,.12)', padding: '24px' }}>
                            <div className="tag tag-accent" style={{ marginBottom: '14px' }}>IN PREPARATION</div>
                            <div style={{ font: '500 20px/1.25 Inter,system-ui,sans-serif', marginBottom: '8px' }}>MMN-based machine learning for adult ADHD (reproduction study)</div>
                            <div style={{ font: '400 13px/1.6 Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.55)' }}>Lorem ipsum dolor sit amet consectetur adipiscing.</div>
                        </div>
                        <div style={{ border: '1px dashed rgba(255,255,255,.14)', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                            <span style={{ font: '400 24px Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.25)' }}>+</span>
                            <span style={{ font: '400 12.5px ui-monospace,Menlo,monospace', letterSpacing: '.12em', color: 'rgba(236,233,245,.35)' }}>NEXT PAPER</span>
                        </div>
                    </div>
                </div>

                {/* 09 · Skills */}
                <div className={'dh-chapter dh-skills' + (chapterIndex === 8 ? '' : ' dh-chapter-hidden')} style={{ opacity: 'var(--o9)' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 92%,rgba(229,100,200,.28),rgba(23,18,43,0) 66%)', transform: 'translateY(calc(var(--k9) * 170px))' }}/>
                    <div style={{ position: 'relative' }}>
                        <h2 style={{ font: '500 clamp(24px,5vw,42px) Inter,system-ui,sans-serif', letterSpacing: '-.03em', margin: '0 0 24px', opacity: 'var(--o9)', transform: 'translateY(calc(var(--k9) * 120px))' }}>09 · SKILLS</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', opacity: 'var(--o9)', transform: 'translateY(calc(var(--k9) * 190px))' }}>
                            {[
                                { label: 'MACHINE LEARNING', tools: 'PyTorch · Braindecode · sklearn', width: '86%' },
                                { label: 'SIGNAL PROCESSING', tools: 'MNE · SciPy · NumPy', width: '74%' },
                                { label: 'DEVELOPMENT', tools: 'React · Next.js · FastAPI · Unity', width: '80%' },
                                { label: 'LANGUAGES', tools: 'Python · TS · C# · SQL', width: '78%' },
                            ].map((s) => (
                                <div key={s.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', font: '500 11.5px ui-monospace,Menlo,monospace', letterSpacing: '.12em', marginBottom: '6px' }}><span>{s.label}</span><span style={{ color: 'var(--color-accent-300)' }}>{s.tools}</span></div>
                                    <div style={{ height: '6px', background: 'rgba(255,255,255,.07)' }}><div style={{ width: s.width, height: '100%', background: 'linear-gradient(90deg,var(--color-accent),var(--color-accent-2))', transformOrigin: 'left', transform: 'scaleX(var(--f9))' }}/></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,.12)', padding: '26px', opacity: 'var(--o9)', transform: 'perspective(1000px) rotateY(calc(var(--k9) * -18deg)) translateX(calc(var(--k9) * -120px))' }}>
                        <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.18em', color: 'rgba(236,233,245,.4)', marginBottom: '16px' }}>TOOLBOX</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                            {['ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute'].map((t) => (
                                <span key={t} className="tag tag-neutral" style={{ fontSize: '12px' }}>{t}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 10 · Activities */}
                <div className={'dh-chapter dh-pad-x' + (chapterIndex === 9 ? '' : ' dh-chapter-hidden')} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: 'var(--o10)' }}>
                    <h2 style={{ font: '500 clamp(24px,5vw,42px) Inter,system-ui,sans-serif', letterSpacing: '-.03em', margin: '0 0 26px', opacity: 'var(--o10)', transform: 'translate(calc(var(--k10) * 170px),calc(var(--k10) * 110px))' }}>10 · ACTIVITIES</h2>
                    <div className={"dh-grid-3"}>
                        <div style={{ border: '1px solid rgba(255,255,255,.12)', padding: '24px', transformOrigin: 'top center', transform: 'translateY(calc(var(--k10) * 300px)) rotate(calc(var(--k10) * -2.4deg))' }}>
                            <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.16em', color: 'var(--color-accent-300)', marginBottom: '14px' }}>SEMINARS</div>
                            <div style={{ font: '500 19px/1.25 Inter,system-ui,sans-serif', marginBottom: '8px' }}>Elit sed do eiusmod</div>
                            <div style={{ font: '400 13px/1.6 Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.55)' }}>Tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris.</div>
                        </div>
                        <div style={{ border: '1px solid rgba(255,255,255,.12)', padding: '24px', transform: 'translateY(calc(var(--k10) * -240px)) scale(calc(1 - var(--k10) * 0.12))' }}>
                            <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.16em', color: 'var(--color-accent-300)', marginBottom: '14px' }}>ENTREPRENEURSHIP</div>
                            <div style={{ font: '500 19px/1.25 Inter,system-ui,sans-serif', marginBottom: '8px' }}>Nisi aliquip ex</div>
                            <div style={{ font: '400 13px/1.6 Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.55)' }}>Ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat.</div>
                        </div>
                        <div style={{ border: '1px solid rgba(255,255,255,.12)', padding: '24px', transformOrigin: 'top center', transform: 'translateY(calc(var(--k10) * 170px)) rotate(calc(var(--k10) * 2.4deg))' }}>
                            <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.16em', color: 'var(--color-accent-300)', marginBottom: '14px' }}>EXCHANGE</div>
                            <div style={{ font: '500 19px/1.25 Inter,system-ui,sans-serif', marginBottom: '8px' }}>Nulla pariatur excepteur sint occaecat</div>
                            <div style={{ font: '400 13px/1.6 Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.55)' }}>Cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum perspiciatis unde omnis.</div>
                        </div>
                    </div>
                </div>

                {/* 11 · Contact */}
                <div className={'dh-chapter dh-pad-x' + (chapterIndex === 10 ? '' : ' dh-chapter-hidden')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 'var(--o11)' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 96%,rgba(229,100,200,.36),rgba(23,18,43,0) 64%)', transform: 'translateY(calc(var(--k11) * 170px))' }}/>
                    <div style={{ position: 'relative', opacity: 'var(--o11)', transform: 'scale(calc(1 - var(--k11) * 0.24)) translateY(calc(var(--k11) * 70px))' }}>
                        <div style={{ font: '500 11px ui-monospace,Menlo,monospace', letterSpacing: '.24em', color: 'rgba(236,233,245,.45)', marginBottom: '22px' }}>11 · CONTACT</div>
                        <div style={{ font: '500 clamp(32px,10vw,74px)/1 Inter,system-ui,sans-serif', letterSpacing: '-.045em', marginBottom: '18px' }}>PRESS START</div>
                        <div className="dh-contact-email" style={{ font: '500 clamp(16px,4vw,24px) Inter,system-ui,sans-serif', color: 'var(--color-accent)', marginBottom: '12px' }}>lorem@example.com</div>
                        <div style={{ font: '400 13.5px Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.5)', marginBottom: '30px' }}>Iste natus error voluptatem accusantium doloremque laudantium totam.</div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <span className="btn btn-primary" style={{ padding: '12px 24px', letterSpacing: '.06em', clipPath: 'polygon(0 0,100% 0,100% 72%,calc(100% - 14px) 100%,0 100%)' }}>REM APERIAM</span>
                            <span className={"btn btn-secondary"} style={{ padding: '12px 24px', letterSpacing: '.06em' }}>CV (PDF)</span>
                        </div>
                        <div style={{ marginTop: '54px', font: '400 11px ui-monospace,Menlo,monospace', letterSpacing: '.16em', color: 'rgba(236,233,245,.3)' }}>EAQUE IPSA</div>
                    </div>
                </div>

            </div>

            <div style={popStyle}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,9,22,.82)', backdropFilter: 'blur(6px)' }} onClick={() => setPop(-1)}/>
                <div className="dh-pop-card">
                    <div className="dh-pop-media">
                        <span style={{ font: '500 10px ui-monospace,Menlo,monospace', letterSpacing: '.16em', color: 'rgba(236,233,245,.55)' }}>{pd.media}</span>
                    </div>
                    <div className={"dh-pop-body"}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                            <div>
                                <div style={{ font: '500 10.5px ui-monospace,Menlo,monospace', letterSpacing: '.18em', color: 'var(--color-accent-300)', marginBottom: '10px' }}>{pd.kicker}</div>
                                <div style={{ font: '500 clamp(20px,4vw,30px)/1.15 Inter,system-ui,sans-serif', letterSpacing: '-.025em' }}>{pd.title}</div>
                                <div style={{ font: '400 12.5px ui-monospace,Menlo,monospace', color: 'rgba(236,233,245,.45)', marginTop: '8px' }}>{pd.meta}</div>
                            </div>
                            <span onClick={() => setPop(-1)} className="dh-pop-close">✕</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '20px' }}>
                            {pd.tags.map((t, i) => (
                                <span key={t + i} className="tag tag-neutral" style={{ fontSize: '11.5px' }}>{t}</span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: '1', overflowY: 'auto' }}>
                            {pd.bullets.map((b, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: '10px', font: '400 14px/1.65 Inter,system-ui,sans-serif', color: 'rgba(236,233,245,.72)' }}>
                                    <span style={{ color: 'var(--color-accent)', fontSize: '11px', lineHeight: '1.9' }}>▸</span><span>{b}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '22px', borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: '16px' }}>
                            <span style={{ font: '400 11px ui-monospace,Menlo,monospace', letterSpacing: '.14em', color: 'rgba(236,233,245,.35)' }}>{popIndex}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span onClick={() => setPop((p) => (p + POP.length - 1) % POP.length)} className={"dh-pop-nav"}>◂</span>
                                <span onClick={() => setPop((p) => (p + 1) % POP.length)} className="dh-pop-nav">▸</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
