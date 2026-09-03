// 챕터 하나가 영상/카메라/전환 세 구간으로 나뉨
// 클립 하나는 앞 챕터의 전환 구간(lead)부터 나가기 시작해 자기 영상 구간에서 끝남

// 클립 한 장을 넘기는 데 드는 스크롤. 체감은 play(lead + video) / 프레임수
const PX_PER_FRAME = 25;

// 소스 클립 하나의 길이. 1.6초가 소스 컷 경계에서 11개를 뽑을 수 있는 최대
const SRC_FPS = 30;
const CLIP_SEC = 1.6;

const BASE = {
    video: SRC_FPS * CLIP_SEC * PX_PER_FRAME,
    // 영상이 멈추고 전환이 시작되기까지. 휠 두 틱
    camera: 200,
    // 짧으면 패널이 툭툭 바뀜
    wipe: 900,
};

// 챕터마다 다르게 줄 것만 적음. 안 적은 구간은 위 기본값
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
        // 마지막 챕터는 넘어갈 데가 없어서 전환 구간이 없음
        const wipe = i === count - 1 ? 0 : s.wipe;
        const total = s.video + s.camera + wipe;
        plan.push({ start, total, video: s.video, camera: s.camera, wipe, lead: 0, play: s.video });
        start += total;
    }
    // play가 그 클립의 총 재생 픽셀
    for (let i = 1; i < count; i++) {
        plan[i].lead = plan[i - 1].wipe;
        plan[i].play = plan[i].lead + plan[i].video;
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

    const video = clampUnit(within / s.video);
    const wipe = s.wipe ? clampUnit(wipeAt / s.wipe) : 0;

    // 지금 스크롤로 나가고 있는 클립과 그 안에서의 위치
    let clip = ch;
    let play;
    if (wipe > 0) {
        clip = ch + 1;
        const n = plan[clip];
        play = clampUnit((wipe * n.lead) / n.play);
    } else {
        play = clampUnit((s.lead + video * s.video) / s.play);
    }

    return {
        chapter: ch,
        video,
        camera: s.camera ? clampUnit(camAt / s.camera) : (camAt >= 0 ? 1 : 0),
        wipe,
        frac: within / s.total,
        clip,
        play,
    };
}
