'use client';

import { useEffect, useRef, useState } from 'react';

import { createFrameCamera } from './frameCamera';
import { createGlRenderer } from './glRender';
import { createSoftRenderer } from './softRender';

// 커서가 화면 가장자리일 때 닿는 회전 한계. 화면 구도는 카메라가 잡는다
const YAW_LIMIT = 5 * Math.PI / 180;
const PITCH_LIMIT = 5 * Math.PI / 180;
const EASE = 0.06;
const RECENTER = 0.04;

// 챕터에 도착할 때 한 번에 트는 각도. 방향은 챕터마다 번갈아 뒤집힌다
// 키우면 glRender의 OVERSCAN도 같이 올려야 평면 끝이 안 드러난다
const SWING = 14 * Math.PI / 180;

// 도착 후 새 자세까지 걸리는 시간. 스크롤 속도와 무관하게 이 시간으로 끝난다
const SWING_MS = 200;

// 챕터마다 좌우로 번갈아 눕힌 기준 yaw. 도착할 때마다 SWING만큼 차이가 난다
const yawOf = (i) => (i % 2 ? 0.5 : -0.5) * SWING;

// 경계에서 1px만 흔들려도 챕터가 뒤집히면 카메라가 울렁인다
// 새 챕터로 인정하려면 경계에서 슬롯의 이 비율만큼 들어와야 한다
const CH_DEADBAND = 0.08;

// 처음이 빠르고 끝이 길게 잦아드는 감쇠. 훅 돌아간 뒤 자리를 잡는다
function easeOut(t) {
    const u = 1 - t;
    return 1 - u * u * u * u;
}

const SOFT_GRID = [240, 135];

// 에셋을 여러 개 두고 고를 때. pack.py --name 으로 만든 매니페스트 이름을 넣는다
const MANIFEST = process.env.NEXT_PUBLIC_BG_MANIFEST || 'bg.json';

// ?bg=... 로 에셋을 갈아끼운다. 재시작 없이 비교하려고 둔 것이고, 없으면 환경변수 값
// 같은 오리진의 /bg/ 아래만 읽게 경로 문자를 제한한다
function pickManifest() {
    if (typeof location === 'undefined') return MANIFEST;
    const q = new URLSearchParams(location.search).get('bg');
    if (!q || q.includes('..') || !/^[\w./-]+\.json$/.test(q)) return MANIFEST;
    return q;
}

// 매니페스트가 하위 폴더에 있으면 영상과 이미지도 같은 폴더에서 찾는다.
// 저작권 때문에 못 올리는 실험용 에셋을 test/ 같은 데 몰아넣고 골라 쓰기 위한 것
function assetDir(name) {
    return name.slice(0, name.lastIndexOf('/') + 1);
}

// WebGL 유무, 정점 텍스처 유닛, 소프트웨어 렌더러 확인
function probeGL() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { ok: false, why: 'WebGL을 쓸 수 없습니다' };

    let why = '';
    if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1) {
        why = '그래픽 드라이버가 이 렌더링을 지원하지 않습니다';
    } else {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
        if (/swiftshader|llvmpipe|softpipe|basic render/i.test(name)) {
            why = 'GPU 대신 소프트웨어로 그리고 있습니다';
        }
    }

    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return { ok: !why, why };
}

// Edge UA에 Chrome이 들어있어 검사 순서 유지
function accelPath() {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return '설정 > 시스템 및 성능 > 사용 가능한 경우 하드웨어 가속 사용';
    if (/Firefox\//.test(ua)) return '설정 > 일반 > 성능 > 권장 성능 설정 사용';
    if (/OPR\//.test(ua)) return '설정 > 시스템 > 사용 가능한 경우 하드웨어 가속 사용';
    if (/Chrome\//.test(ua)) return '설정 > 시스템 > 사용 가능한 경우 하드웨어 가속 사용';
    return '브라우저 설정에서 하드웨어 가속 항목을 확인해 주세요';
}

const NOTICE_KEY = 'dh-gpu-notice-dismissed';

function noticeDismissed() {
    try {
        return localStorage.getItem(NOTICE_KEY) === '1';
    } catch (e) {
        return false;
    }
}
function rememberDismiss() {
    try {
        localStorage.setItem(NOTICE_KEY, '1');
    } catch (e) {
    }
}

// 약한 기기는 점 줄이고 이웃 샘플링도 뺌
// size는 점 지름을 격자 한 칸의 몇 배로 할지. 1 미만이면 칸 사이가 벌어지고
// 정격자 무늬가 다시 드러날 수 있다. 격자가 성긴 하위 티어는 조금 더 겹쳐 둔다
function pickTier(meta) {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    let t;
    if (matchMedia('(pointer: coarse)').matches || mem <= 4 || cores <= 4) {
        t = { grid: [240, 135], edge: false, size: 1.33 };
    } else if (mem <= 8 || cores <= 8) {
        t = { grid: [480, 270], edge: true, size: 1.23 };
    } else {
        t = { grid: [1280, 720], edge: true, size: 1.15 };
    }

    // 격자가 텍스처보다 촘촘하면 보간만 늘어남, 에셋 해상도에서 자름
    const gw = Math.min(t.grid[0], meta.width);
    const gh = Math.min(t.grid[1], meta.height);
    return { grid: [gw, gh], edge: t.edge, size: t.size };
}

function has2d() {
    return !!document.createElement('canvas').getContext('2d');
}

export default function HologramBackground({ progress, chapterProgress, onReady }) {
    const canvasRef = useRef(null);
    const progressRef = useRef(0);
    const chapterRef = useRef(0);
    const [stillSrc, setStillSrc] = useState(null);
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        progressRef.current = progress;
        chapterRef.current = chapterProgress || 0;
    }, [progress, chapterProgress]);

    useEffect(() => {
        const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const manifest = pickManifest();
        const dir = assetDir(manifest);
        let mounted = true;

        // 못 그리는 기기와 reduced-motion은 정지 이미지로
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const gl = probeGL();
        const soft = !gl.ok && has2d();

        // 가속 안내는 GL 능력 문제일 때만, reduced는 제외
        if (!gl.ok && !reduced && !noticeDismissed()) {
            setNotice({ why: gl.why, path: accelPath(), degraded: soft });
        }

        if (reduced || (!gl.ok && !soft)) {
            fetch(base + '/bg/' + manifest).then((r) => r.json()).then((meta) => {
                if (!mounted) return;
                setStillSrc(base + '/bg/' + dir + meta.still);
                if (onReady) onReady();
            });
            return () => { mounted = false; };
        }

        const canvas = canvasRef.current;
        let raf = 0;
        let engine;
        let video;
        let resizeObserver;
        let dirty = true;
        let fade = 0;

        const look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, tracking: false };

        // cam이 지금 자세. 도착할 때 from에서 to로 한 번 흐르고 멈춘다
        const cam = { x: 0, y: 0, z: 0, roll: 0, yaw: 0 };
        const from = { x: 0, y: 0, z: 0, roll: 0, yaw: 0 };
        const to = { x: 0, y: 0, z: 0, roll: 0, yaw: 0 };
        let tweenAt = -1;
        let frameCam = null;
        let cpNow = () => 0;
        let posedCh = -1;

        // 챕터에 도착했을 때만 구도를 재고 트윈을 건다. 그 사이엔 카메라가 멈춰 있다
        const reframe = (el, force) => {
            if (!frameCam) return;
            const cp = cpNow();
            const ch = Math.floor(cp);
            const t = cp - ch;
            if (!force) {
                if (ch === posedCh) return;
                // 경계 바로 옆은 아직 넘어온 걸로 안 본다. 되돌아갈 때도 같은 폭
                if (ch > posedCh && t < CH_DEADBAND) return;
                if (ch < posedCh && t > 1 - CH_DEADBAND) return;
            }
            posedCh = ch;
            const p = frameCam.analyze(el);
            Object.assign(from, cam);
            to.x = p.x;
            to.y = p.y;
            to.z = p.z;
            to.roll = p.roll;
            to.yaw = yawOf(ch);
            tweenAt = performance.now();
            dirty = true;
        };

        // 커서 위치를 그대로 회전량으로, 부호 뒤집으면 반대 방향
        const onMove = (e) => {
            if (e.pointerType === 'touch') return;
            const nx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1));
            const ny = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
            look.tYaw = -nx * YAW_LIMIT;
            look.tPitch = -ny * PITCH_LIMIT;
            look.tracking = true;
            dirty = true;
        };
        // 커서가 창을 벗어나면 정면으로 복귀
        const onLeave = () => {
            look.tracking = false;
        };
        const onVisible = () => {
            dirty = true;
        };

        fetch(base + '/bg/' + manifest).then((r) => r.json()).then(async (meta) => {
            if (!mounted) return;

            if (gl.ok) {
                const THREE = await import('three');
                if (!mounted) return;
                engine = createGlRenderer(THREE, canvas, meta, pickTier(meta));
                frameCam = createFrameCamera(meta);
            } else {
                engine = createSoftRenderer(canvas, meta, SOFT_GRID);
            }

            resizeObserver = new ResizeObserver(() => {
                engine.resize();
                dirty = true;
            });
            resizeObserver.observe(canvas);

            window.addEventListener('pointermove', onMove, { passive: true });
            document.documentElement.addEventListener('pointerleave', onLeave);
            window.addEventListener('blur', onLeave);
            document.addEventListener('visibilitychange', onVisible);

            // 포스터로 먼저 그리고, 영상 준비되면 갈아끼움
            const poster = new Image();
            poster.src = base + '/bg/' + dir + meta.poster;
            poster.decoding = 'sync';
            poster.onload = () => {
                if (!mounted) return;
                engine.setFrameSource(poster, 'image');
                reframe(poster, true);
                dirty = true;
                if (onReady) onReady();
                startVideo(meta);
            };

            const segs = meta.chapters;
            const last = segs ? segs.length - 1 : 0;

            // 챕터 구간이 있으면 슬롯 하나가 그 챕터 클립 전체를 재생함
            const frameAt = () => {
                if (!segs) {
                    const p = Math.max(0, Math.min(1, progressRef.current));
                    return Math.round(p * (meta.frames - 1));
                }
                const cp = Math.max(0, Math.min(last + 0.999, chapterRef.current));
                const ch = Math.min(last, Math.floor(cp));
                const seg = segs[ch];
                const span = Math.max(1, seg.out - seg.in - 1);
                return seg.in + Math.round((cp - ch) * span);
            };

            cpNow = () => Math.max(0, Math.min(last + 0.999, chapterRef.current));

            const step = meta.duration / meta.frames;
            let lastSeek = -1;

            const loop = () => {
                if (!mounted) return;
                raf = requestAnimationFrame(loop);
                if (document.hidden) return;

                // 스크롤 진행도를 프레임 위치로, 반프레임 넘게 움직였을 때만 탐색
                if (video && video.readyState >= 2) {
                    const t = frameAt() * step;
                    if (Math.abs(t - lastSeek) > step * 0.5) {
                        lastSeek = t;
                        video.currentTime = t;
                    }
                    // 탐색이 끝난 프레임에서만 잰다. 게이트에 걸리면 바로 빠져나온다
                    if (!video.seeking) reframe(video);
                }

                if (!look.tracking) {
                    look.tYaw -= look.tYaw * RECENTER;
                    look.tPitch -= look.tPitch * RECENTER;
                }
                const moving = Math.abs(look.tYaw - look.yaw) > 1e-4 || Math.abs(look.tPitch - look.pitch) > 1e-4
                    || (!look.tracking && (Math.abs(look.tYaw) > 1e-4 || Math.abs(look.tPitch) > 1e-4));
                if (moving) {
                    look.yaw += (look.tYaw - look.yaw) * EASE;
                    look.pitch += (look.tPitch - look.pitch) * EASE;
                    dirty = true;
                }

                // 도착 트윈. 다 흐르면 놓아서 다음 도착까지 아무것도 안 움직인다
                if (tweenAt >= 0) {
                    const t = Math.min(1, (performance.now() - tweenAt) / SWING_MS);
                    const k = easeOut(t);
                    cam.x = from.x + (to.x - from.x) * k;
                    cam.y = from.y + (to.y - from.y) * k;
                    cam.z = from.z + (to.z - from.z) * k;
                    cam.roll = from.roll + (to.roll - from.roll) * k;
                    cam.yaw = from.yaw + (to.yaw - from.yaw) * k;
                    if (t >= 1) tweenAt = -1;
                    dirty = true;
                }

                if (fade < 0.999) {
                    fade += (1 - fade) * 0.05;
                    dirty = true;
                }

                // 아무것도 안 변했으면 안 그림
                if (!dirty) return;
                dirty = false;
                engine.render(look.yaw + cam.yaw, look.pitch, fade, cam);
            };
            loop();
        });

        function startVideo(meta) {
            video = document.createElement('video');
            video.src = base + '/bg/' + dir + meta.video;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto';
            video.setAttribute('style', 'position:fixed;left:-4px;top:-4px;width:2px;height:2px;opacity:0;pointer-events:none');
            document.body.appendChild(video);

            video.addEventListener('loadeddata', () => {
                video.currentTime = 0;
            });
            video.addEventListener('seeked', () => {
                if (!mounted) return;
                engine.frameChanged();
                dirty = true;
            });
            video.addEventListener('canplaythrough', () => {
                if (!mounted) return;
                engine.setFrameSource(video, 'video');
                // 포스터로 잰 구도는 챕터 0 기준이다. 영상으로 넘어가면 다시 재게 푼다
                posedCh = -1;
                dirty = true;
            });
        }

        return () => {
            mounted = false;
            if (raf) cancelAnimationFrame(raf);
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener('pointermove', onMove);
            document.documentElement.removeEventListener('pointerleave', onLeave);
            window.removeEventListener('blur', onLeave);
            document.removeEventListener('visibilitychange', onVisible);
            if (video) {
                video.removeAttribute('src');
                video.load();
                video.remove();
            }
            if (engine) engine.dispose();
        };
    }, []);

    const closeNotice = () => {
        rememberDismiss();
        setNotice(null);
    };

    return (
        <>
            {stillSrc
                ? <div className="dh-bg-still" style={{ backgroundImage: 'url(' + stillSrc + ')' }}/>
                : <canvas ref={canvasRef} className="dh-bg-canvas"/>}
            {notice ? (
                <div className="dh-gpu-notice">
                    <span className="dh-gpu-notice-mark"/>
                    <div className="dh-gpu-notice-body">
                        <div className="dh-gpu-notice-head">
                            배경 {notice.degraded ? '간이 모드' : '정지 이미지'}
                        </div>
                        <p className="dh-gpu-notice-text">{notice.why}</p>
                        <p className="dh-gpu-notice-path">
                            하드웨어 가속을 켜면 더 부드럽게 동작합니다
                            <span>{notice.path}</span>
                        </p>
                    </div>
                    <span onClick={closeNotice} className="dh-gpu-notice-close">✕</span>
                </div>
            ) : null}
        </>
    );
}
