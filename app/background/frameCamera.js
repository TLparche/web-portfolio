// 프레임의 점 분포에서 카메라 자세를 뽑는다. 깊이 맵을 작게 받아 모멘트만 계산
const PROBE_W = 96;
const PROBE_H = 54;

// 점으로 살아남을 깊이. 축소 보간으로 배경이 번지니 셰이더 게이트보다 높게
const DEPTH_GATE = 0.05;

// 무게중심을 화면 중앙으로 당기는 비율과 최대 이동량. 평면 높이 1 기준
const PAN = 0.2;
const PAN_CAP = 0.03;

// 화면을 채운 비율에 따라 앞뒤로. 평소보다 꽉 차면 물러나고 비면 다가간다
// 기준값은 에셋마다 다르다(전체 프레임은 0.8쯤, 배경 분리는 0.3쯤).
// 고정하면 한쪽에서 항상 상한에 붙어 죽으므로 본 값들의 평균을 따라가게 둔다
const DOLLY = 0.2;
const DOLLY_CAP = 0.05;
const FILL_ADAPT = 0.2;

// 주축 기울기를 되돌리는 비율. 음수면 반대로 더 기울인다
const ROLL = 0.45;
const ROLL_CAP = 3 * Math.PI / 180;

// 이 비율 아래로 비면 분포가 의미 없으니 정면 유지
const MIN_FILL = 0.01;

function clamp(v, lim) {
    return v < -lim ? -lim : v > lim ? lim : v;
}

export function createFrameCamera(meta) {
    const aspect = meta.width / meta.height;
    const frameW = Math.round(meta.width / (meta.colorRect[2] - meta.colorRect[0]));
    const frameH = Math.round(meta.height / (meta.colorRect[3] - meta.colorRect[1]));
    const [x0, y0, x1, y1] = meta.depthRect;
    const src = [x0 * frameW, y0 * frameH, (x1 - x0) * frameW, (y1 - y0) * frameH];

    const probe = document.createElement('canvas');
    probe.width = PROBE_W;
    probe.height = PROBE_H;
    const pctx = probe.getContext('2d', { willReadFrequently: true });

    // 호출자가 매 프레임 새 객체를 안 받게 하나를 갱신해서 돌려준다
    const pose = { x: 0, y: 0, z: 0, roll: 0 };
    let fillRef = -1;

    function reset() {
        pose.x = 0;
        pose.y = 0;
        pose.z = 0;
        pose.roll = 0;
        return pose;
    }

    function analyze(el) {
        try {
            pctx.drawImage(el, src[0], src[1], src[2], src[3], 0, 0, PROBE_W, PROBE_H);
        } catch (e) {
            return pose;
        }
        const px = pctx.getImageData(0, 0, PROBE_W, PROBE_H).data;

        // 1차 모멘트. u는 평면 가로가 aspect라 미리 곱해 화면 비율과 맞춘다
        let n = 0;
        let su = 0;
        let sv = 0;
        for (let y = 0, i = 0; y < PROBE_H; y++) {
            for (let x = 0; x < PROBE_W; x++, i++) {
                if (px[i * 4] / 255 < DEPTH_GATE) continue;
                n++;
                su += ((x + 0.5) / PROBE_W - 0.5) * aspect;
                sv += 0.5 - (y + 0.5) / PROBE_H;
            }
        }
        if (n < PROBE_W * PROBE_H * MIN_FILL) return reset();

        const mu = su / n;
        const mv = sv / n;

        // 2차 모멘트. 주축 각도와 장단축 비를 여기서 얻는다
        let suu = 0;
        let svv = 0;
        let suv = 0;
        for (let y = 0, i = 0; y < PROBE_H; y++) {
            for (let x = 0; x < PROBE_W; x++, i++) {
                if (px[i * 4] / 255 < DEPTH_GATE) continue;
                const u = ((x + 0.5) / PROBE_W - 0.5) * aspect - mu;
                const v = 0.5 - (y + 0.5) / PROBE_H - mv;
                suu += u * u;
                svv += v * v;
                suv += u * v;
            }
        }
        suu /= n;
        svv /= n;
        suv /= n;

        const mid = (suu + svv) / 2;
        const dev = Math.sqrt((suu - svv) * (suu - svv) / 4 + suv * suv);
        const major = Math.sqrt(Math.max(0, mid + dev));
        const minor = Math.sqrt(Math.max(0, mid - dev));

        // 장단축이 비슷하면 기울기가 뭘 가리키는지 모른다. 그만큼 약하게 반영
        const aniso = major > 1e-6 ? (major - minor) / major : 0;
        const theta = 0.5 * Math.atan2(2 * suv, suu - svv);

        // 주축이 세로면 지면선이 아니라 인물이다. 눕힐 대상이 아니니 뺀다
        const horiz = Math.max(0, Math.cos(2 * theta));

        // 첫 측정은 기준 자체가 되니 z가 0이다. 이후 챕터가 그 평균 대비로 앞뒤가 된다
        const fill = n / (PROBE_W * PROBE_H);
        fillRef = fillRef < 0 ? fill : fillRef + (fill - fillRef) * FILL_ADAPT;

        pose.x = clamp(mu * PAN, PAN_CAP);
        pose.y = clamp(mv * PAN, PAN_CAP);
        pose.z = clamp((fill - fillRef) * DOLLY, DOLLY_CAP);
        pose.roll = clamp(theta * aniso * horiz * ROLL, ROLL_CAP);
        return pose;
    }

    return { analyze };
}
