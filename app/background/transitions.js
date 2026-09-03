// 챕터가 끝날 때 화면이 만화 패널처럼 갈리며 다음 클립으로 넘어감
// 패널은 반평면들의 교집합. planes 항목 [nx, ny, c]는 dot(p, n) + c >= 0 쪽을 남김

// 경계 하나가 쓸고 갈 때 쓰는 스칼라 필드. dot(q, dir) + bias 로 0~1
export const SWEEPS = {
    down: { dir: [0, -1], bias: 0.5, fold: 0 },
    up: { dir: [0, 1], bias: 0.5, fold: 0 },
    right: { dir: [1, 0], bias: 0.5, fold: 0 },
    left: { dir: [-1, 0], bias: 0.5, fold: 0 },
    diagDown: { dir: [0.5, -0.5], bias: 0.5, fold: 0 },
    diagUp: { dir: [0.5, 0.5], bias: 0.5, fold: 0 },
    splitV: { dir: [0, 2], bias: 0, fold: 1 },
    splitH: { dir: [2, 0], bias: 0, fold: 1 },
    closeV: { dir: [0, -2], bias: 1, fold: 1 },
    closeH: { dir: [-2, 0], bias: 1, fold: 1 },
};

// 경계 하나가 쓸고 갈 때 두 클립이 겹치는 폭
export const BAND = 0.18;

// (x0, y0)을 지나고 법선이 n인 직선. n 쪽을 남김
function half(nx, ny, x0, y0) {
    const m = Math.hypot(nx, ny);
    const ux = nx / m;
    const uy = ny / m;
    return [ux, uy, -(ux * x0 + uy * y0)];
}

function flip(p) {
    return [-p[0], -p[1], -p[2]];
}

// 패널 안쪽을 격자로 훑어 중심을 잡음
function centerOf(planes) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let i = 0; i < 40; i++) {
        for (let j = 0; j < 40; j++) {
            const x = (i + 0.5) / 40;
            const y = (j + 0.5) / 40;
            if (planes.every((p) => x * p[0] + y * p[1] + p[2] >= 0)) {
                sx += x;
                sy += y;
                n++;
            }
        }
    }
    return n ? [sx / n, sy / n] : [0.5, 0.5];
}

function panel(planes, order, cam) {
    return { planes, order, cam: cam || null, center: centerOf(planes) };
}

// 가로로 자른 단들. cuts는 아래에서 위로 올라가는 경계. 읽는 순서는 위에서 아래
function rowLayout(cuts, cams) {
    const edges = [0, ...cuts, 1];
    const bands = [];
    for (let i = 0; i < edges.length - 1; i++) {
        bands.push([half(0, 1, 0, edges[i]), half(0, -1, 0, edges[i + 1])]);
    }
    const n = bands.length;
    return bands.map((planes, i) => panel(planes, n - 1 - i, cams && cams[n - 1 - i]));
}

// 사선 세로 분할 + 가로 분할. 읽는 순서는 왼위 오른위 왼아래 오른아래
function slantLayout(cams) {
    const v = half(1.6, -0.4, 0.5, 0.5);
    const h = half(0, 1, 0, 0.5);
    const quads = [[flip(v), h], [v, h], [flip(v), flip(h)], [v, flip(h)]];
    return quads.map((planes, i) => panel(planes, i, cams && cams[i]));
}

// 패널마다 다른 프레이밍
// z는 음수만 씀. 양수는 OVERSCAN 여유를 먹어 평면 끝이 드러남
const SLANT_CAMS = [
    { z: -0.06 },
    { z: -0.18, x: 0.04, y: 0.03 },
    { z: -0.11, x: -0.04, y: -0.03, roll: 0.03 },
    { z: -0.24, x: 0.03, y: -0.03 },
];
const ROW_CAMS = [
    { z: -0.05 },
    { z: -0.16, x: 0.04, y: -0.02 },
    { z: -0.28, x: -0.04, y: 0.03, roll: -0.03 },
];

export const LAYOUTS = {
    rows3: () => rowLayout([0.28, 0.62], ROW_CAMS),
    rows3flat: () => rowLayout([0.28, 0.62]),
    slant4: () => slantLayout(SLANT_CAMS),
    slant4flat: () => slantLayout(),
};

// 챕터가 끝날 때 쓰는 전환. 마지막 챕터는 안 쓰임
// split은 칸이 갈리는 앞부분 비율, fade는 칸 하나가 넘어가는 폭
const ORDER = [
    { layout: 'slant4', gutter: 0.014, split: 0.26, fade: 0.5, pop: 0.05, flash: 0.1, rays: 0 },
    { layout: 'rows3', gutter: 0.016, split: 0.26, fade: 0.55, pop: 0.05, flash: 0, rays: 0.28 },
    { sweep: 'diagDown', flash: 0.08, rays: 0 },
    { layout: 'slant4flat', gutter: 0.014, split: 0.3, fade: 0.6, pop: 0, flash: 0, rays: 0 },
    { layout: 'rows3', gutter: 0.016, split: 0.22, fade: 0.45, pop: 0.07, flash: 0.12, rays: 0.2 },
    { sweep: 'splitV', flash: 0, rays: 0.22 },
    { layout: 'slant4', gutter: 0.02, split: 0.3, fade: 0.55, pop: 0.05, flash: 0, rays: 0 },
    { sweep: 'closeH', flash: 0.1, rays: 0 },
    { layout: 'rows3flat', gutter: 0.016, split: 0.26, fade: 0.6, pop: 0, flash: 0, rays: 0.25 },
    { layout: 'slant4', gutter: 0.014, split: 0.24, fade: 0.5, pop: 0.06, flash: 0.1, rays: 0.18 },
];

const cache = {};

export function transitionAt(chapter) {
    const def = ORDER[chapter % ORDER.length];
    if (!def.layout) return def;
    if (!cache[def.layout]) cache[def.layout] = LAYOUTS[def.layout]();
    return { ...def, panels: cache[def.layout] };
}

// 양끝이 잦아드는 감쇠
function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
}

// 거터로 안쪽으로 밀고, 팝인 비율 k만큼 중심을 향해 줄임
function shrink(planes, center, gutter, k) {
    return planes.map((p) => {
        const c = p[2] - gutter;
        if (k >= 1) return [p[0], p[1], c];
        const dq = center[0] * p[0] + center[1] * p[1];
        return [p[0], p[1], k * c + dq * (k - 1)];
    });
}

function addCam(base, off) {
    if (!off) return base;
    return {
        x: base.x + (off.x || 0),
        y: base.y + (off.y || 0),
        z: base.z + (off.z || 0),
        roll: base.roll + (off.roll || 0),
        yaw: (base.yaw || 0) + (off.yaw || 0),
    };
}

function clampUnit(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

// 전환 끝에서 거터를 닫는 데 쓰는 비율
const CLOSE = 0.14;

// 전환 진행도를 그리기 목록으로. 항목 하나가 renderer 호출 한 번
// 넘어가는 중인 칸은 정지와 영상을 알파로 겹쳐 두 번 그림
export function planDraws(def, frac, outCam, inCam) {
    if (def.sweep) {
        const s = SWEEPS[def.sweep];
        const pos = frac * (1 + 2 * BAND) - BAND;
        const sweep = { ...s, pos, half: BAND };
        return [
            { src: 'still', planes: [], cam: outCam, sweep, side: 1, alpha: 1 },
            { src: 'video', planes: [], cam: inCam, sweep, side: -1, alpha: 1 },
        ];
    }

    // 거터는 앞에서 자라고 뒤에서 닫힘
    const openT = clampUnit(def.split > 0 ? frac / def.split : 1);
    const closeT = clampUnit((1 - frac) / CLOSE);
    const gutter = def.gutter * easeInOut(Math.min(openT, closeT));

    // 칸이 넘어가는 구간. 거터가 닫히기 전에 끝남
    const span = Math.max(0.01, 1 - def.split - CLOSE);
    const u = clampUnit((frac - def.split) / span);

    const n = def.panels.length;
    const draws = [];
    for (const p of def.panels) {
        // 첫 칸은 u=0에서 시작하고 마지막 칸은 u=1에서 끝나게 펼침
        const at = n > 1 ? def.fade / 2 + p.order * (1 - def.fade) / (n - 1) : 0.5;
        const t = clampUnit((u - at) / def.fade + 0.5);
        const e = easeInOut(t);

        // 넘어가는 순간에만 살짝 오므라듦
        const k = def.pop ? 1 - def.pop * Math.sin(Math.PI * t) : 1;
        const planes = shrink(p.planes, p.center, gutter, k);

        if (e < 0.998) {
            draws.push({
                src: 'still', planes, cam: addCam(outCam, p.cam),
                sweep: null, side: 0, alpha: 1 - e,
            });
        }
        if (e > 0.002) {
            draws.push({
                src: 'video', planes, cam: addCam(inCam, p.cam),
                sweep: null, side: 0, alpha: e,
            });
        }
    }
    return draws;
}

// 가운데에서 부풀었다 잦아드는 곡선
function swell(t, at, w) {
    const d = Math.abs(t - at) / w;
    if (d >= 1) return 0;
    const u = 1 - d;
    return u * u * (3 - 2 * u) * 0.5 + u * 0.5;
}

// 전환 내내 있다가 양끝에서 잦아듦
function bell(t) {
    return Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
}

export function effectsAt(def, frac) {
    return {
        flash: def.flash ? def.flash * swell(frac, 0.5, 0.45) : 0,
        rays: def.rays ? def.rays * bell(frac) : 0,
    };
}
