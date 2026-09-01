const BUF_H = 360;
const CAM_FOV = 45;
const CAM_DIST = 3.2;
const DEPTH_SCALE = 0.85;
const SPLAT = 2;

function smoothstep(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

export function createSoftRenderer(canvas, meta, grid) {
    const [gw, gh] = grid;
    const aspect = meta.width / meta.height;
    const ctx = canvas.getContext('2d');

    // 영상을 격자 크기로 줄여 받는 곳, 위 절반이 컬러 아래가 깊이
    const grab = document.createElement('canvas');
    grab.width = gw;
    grab.height = gh * 2;
    const gctx = grab.getContext('2d', { willReadFrequently: true });

    const depth = new Float32Array(gw * gh);
    const alpha = new Float32Array(gw * gh);
    const rgb = new Uint8Array(gw * gh * 3);

    const buf = document.createElement('canvas');
    const bctx = buf.getContext('2d');
    let img = null;
    let zbuf = null;
    let bw = 0;
    let bh = 0;
    let focal = 0;
    let scale = 0;

    function resize() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) return;
        canvas.width = w;
        canvas.height = h;

        bh = BUF_H;
        bw = Math.max(2, Math.round(BUF_H * (w / h)));
        buf.width = bw;
        buf.height = bh;
        img = bctx.createImageData(bw, bh);
        zbuf = new Float32Array(bw * bh);

        const half = Math.tan((CAM_FOV / 2) * Math.PI / 180);
        focal = (bh / 2) / half;
        const visH = 2 * half * CAM_DIST;
        scale = Math.max(visH * (bw / bh) / aspect, visH);
    }

    let source = null;

    function setFrameSource(el) {
        source = el;
        frameChanged();
    }

    function frameChanged() {
        const el = source;
        if (!el) return;
        gctx.drawImage(el, 0, 0, meta.width, meta.height * 2, 0, 0, gw, gh * 2);
        const px = gctx.getImageData(0, 0, gw, gh * 2).data;
        const dOff = gw * gh * 4;

        for (let i = 0, n = gw * gh; i < n; i++) {
            const c = i * 4;
            const r = px[c];
            const g = px[c + 1];
            const b = px[c + 2];
            rgb[i * 3] = r;
            rgb[i * 3 + 1] = g;
            rgb[i * 3 + 2] = b;
            depth[i] = px[dOff + c] / 255;
            const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
            // 셰이더와 같은 게이트
            alpha[i] = smoothstep(0.012, 0.07, depth[i]) * smoothstep(0.02, 0.12, lum);
        }

        // 실루엣 경계에서 늘어나는 점 제거
        for (let y = 1; y < gh - 1; y++) {
            for (let x = 1; x < gw - 1; x++) {
                const i = y * gw + x;
                const dx = Math.abs(depth[i + 1] - depth[i - 1]);
                const dy = Math.abs(depth[i + gw] - depth[i - gw]);
                alpha[i] *= 1 - smoothstep(0.035, 0.11, Math.max(dx, dy));
            }
        }
    }

    function render(yaw, pitch, fade) {
        if (!img || !source) return;
        const data = img.data;
        data.fill(0);
        zbuf.fill(1e9);

        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        const cp = Math.cos(pitch);
        const sp = Math.sin(pitch);
        const ox = bw / 2;
        const oy = bh / 2;

        for (let gy = 0, i = 0; gy < gh; gy++) {
            const my = 0.5 - gy / (gh - 1);
            for (let gx = 0; gx < gw; gx++, i++) {
                const a = alpha[i] * fade;
                if (a < 0.03) continue;
                const mx = (gx / (gw - 1) - 0.5) * aspect;
                const mz = (depth[i] - 0.5) * DEPTH_SCALE;

                const x1 = mx * cy + mz * sy;
                const z1 = -mx * sy + mz * cy;
                const y2 = my * cp - z1 * sp;
                const z2 = my * sp + z1 * cp;

                const den = CAM_DIST - z2 * scale;
                if (den < 0.1) continue;
                const sx = (ox + focal * x1 * scale / den) | 0;
                const syy = (oy - focal * y2 * scale / den) | 0;
                if (sx < 0 || syy < 0 || sx >= bw - SPLAT || syy >= bh - SPLAT) continue;

                const av = (a * 255) | 0;
                for (let py = 0; py < SPLAT; py++) {
                    for (let pxx = 0; pxx < SPLAT; pxx++) {
                        const pi = (syy + py) * bw + sx + pxx;
                        if (den >= zbuf[pi]) continue;
                        zbuf[pi] = den;
                        const o = pi * 4;
                        data[o] = rgb[i * 3];
                        data[o + 1] = rgb[i * 3 + 1];
                        data[o + 2] = rgb[i * 3 + 2];
                        data[o + 3] = av;
                    }
                }
            }
        }

        bctx.putImageData(img, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, canvas.width, canvas.height);
    }

    function dispose() {
        source = null;
        img = null;
        zbuf = null;
    }

    resize();
    return { setFrameSource, frameChanged, render, resize, dispose };
}
