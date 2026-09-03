// 챕터 하나가 영상/카메라/전환 세 구간으로 나뉜다.
// 영상 구간은 스크롤이 클립 프레임을 넘기고, 카메라 구간은 마지막 프레임에 멈춘 채
// 카메라만 움직이고, 전환 구간은 검은 띠가 내려가며 다음 챕터로 넘어간다.

// 스크롤 25px에 프레임 하나. 휠 한 틱(약 100px)이면 4프레임쯤 나간다
const PX_PER_FRAME = 25;

// 소스 클립 하나의 길이. 챕터당 프레임 수와 맞아야 스크롤 속도가 25px/프레임이 된다
const SRC_FPS = 30;
const CLIP_SEC = 2;

const BASE = {
    video: SRC_FPS * CLIP_SEC * PX_PER_FRAME,
    camera: 750,
    wipe: 600,
};

// 챕터마다 다르게 줄 것만 적는다. 안 적은 구간은 위 기본값
const CHAPTER_PX = {};

function clampUnit(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

// 챕터별 구간 길이와 시작 위치를 미리 깔아 둔다
export function buildPlan(count) {
    const plan = [];
    let start = 0;
    for (let i = 0; i < count; i++) {
        const s = { ...BASE, ...CHAPTER_PX[i] };
        // 마지막 챕터는 넘어갈 데가 없어서 전환 구간이 없다
        const wipe = i === count - 1 ? 0 : s.wipe;
        const total = s.video + s.camera + wipe;
        plan.push({ start, total, video: s.video, camera: s.camera, wipe });
        start += total;
    }
    return plan;
}

// 문서에서 스크롤할 수 있는 총 길이
export function planLength(plan) {
    const last = plan[plan.length - 1];
    return last.start + last.total;
}

// 스크롤 위치를 챕터 번호와 구간별 진행도로 나눈다
export function segmentAt(plan, y) {
    const last = plan.length - 1;
    let ch = 0;
    while (ch < last && y >= plan[ch].start + plan[ch].total) ch++;

    const s = plan[ch];
    const within = Math.max(0, Math.min(s.total, y - s.start));
    const camAt = within - s.video;
    const wipeAt = camAt - s.camera;

    return {
        chapter: ch,
        video: clampUnit(within / s.video),
        camera: s.camera ? clampUnit(camAt / s.camera) : (camAt >= 0 ? 1 : 0),
        wipe: s.wipe ? clampUnit(wipeAt / s.wipe) : 0,
        frac: within / s.total,
    };
}
