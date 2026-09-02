'use client';

import { useEffect, useRef, useState } from 'react';

// 캐시된 재방문에 번쩍이지 않게 최소한 이만큼은 보여줌
const MIN_MS = 600;
const OUT_MS = 520;
// 에셋이 안 오더라도 갇히지 않게
const MAX_WAIT_MS = 6000;

export default function Landing({ ready }) {
    const bornRef = useRef(0);
    const [leaving, setLeaving] = useState(false);
    const [gone, setGone] = useState(false);

    if (!bornRef.current) bornRef.current = Date.now();

    useEffect(() => {
        document.documentElement.classList.add('dh-locked');
        return () => document.documentElement.classList.remove('dh-locked');
    }, []);

    useEffect(() => {
        const held = Date.now() - bornRef.current;
        const delay = ready ? Math.max(0, MIN_MS - held) : Math.max(0, MAX_WAIT_MS - held);
        const t = setTimeout(() => setLeaving(true), delay);
        return () => clearTimeout(t);
    }, [ready]);

    useEffect(() => {
        if (!leaving) return;
        document.documentElement.classList.remove('dh-locked');
        const t = setTimeout(() => setGone(true), OUT_MS);
        return () => clearTimeout(t);
    }, [leaving]);

    if (gone) return null;

    return (
        <div className={'dh-landing' + (leaving ? ' dh-landing-out' : '')}>
            <span className="dh-landing-mark"/>
            <div className="dh-landing-name">LOREM</div>
            <div className="dh-landing-bar"><span/></div>
        </div>
    );
}
