'use client';

import { useEffect, useRef, useState } from 'react';

import { createGlRenderer } from './glRender';
import { createSoftRenderer } from './softRender';

// 커서가 화면 가장자리일 때 닿는 회전 한계
const YAW_LIMIT = 16 * Math.PI / 180;
const PITCH_LIMIT = 10 * Math.PI / 180;
const EASE = 0.06;
const RECENTER = 0.04;

const SOFT_GRID = [240, 135];

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
function pickTier() {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (matchMedia('(pointer: coarse)').matches || mem <= 4 || cores <= 4) {
        return { grid: [240, 135], edge: false, size: 3.2 };
    }
    if (mem <= 8 || cores <= 8) return { grid: [360, 203], edge: true, size: 2.9 };
    return { grid: [480, 270], edge: true, size: 2.6 };
}

function has2d() {
    return !!document.createElement('canvas').getContext('2d');
}

export default function HologramBackground({ progress }) {
    const canvasRef = useRef(null);
    const progressRef = useRef(0);
    const [stillSrc, setStillSrc] = useState(null);
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        progressRef.current = progress;
    }, [progress]);

    useEffect(() => {
        const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
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
            fetch(base + '/bg/bg.json').then((r) => r.json()).then((meta) => {
                if (mounted) setStillSrc(base + '/bg/' + meta.still);
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

        fetch(base + '/bg/bg.json').then((r) => r.json()).then(async (meta) => {
            if (!mounted) return;

            if (gl.ok) {
                const THREE = await import('three');
                if (!mounted) return;
                engine = createGlRenderer(THREE, canvas, meta, pickTier());
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
            poster.src = base + '/bg/' + meta.poster;
            poster.decoding = 'sync';
            poster.onload = () => {
                if (!mounted) return;
                engine.setFrameSource(poster, 'image');
                dirty = true;
                startVideo(meta);
            };

            const step = meta.duration / meta.frames;
            let lastSeek = -1;

            const loop = () => {
                if (!mounted) return;
                raf = requestAnimationFrame(loop);
                if (document.hidden) return;

                // 스크롤 진행도를 프레임 위치로, 반프레임 넘게 움직였을 때만 탐색
                if (video && video.readyState >= 2) {
                    const p = Math.max(0, Math.min(1, progressRef.current));
                    const t = Math.round(p * (meta.frames - 1)) * step;
                    if (Math.abs(t - lastSeek) > step * 0.5) {
                        lastSeek = t;
                        video.currentTime = t;
                    }
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

                if (fade < 0.999) {
                    fade += (1 - fade) * 0.05;
                    dirty = true;
                }

                // 아무것도 안 변했으면 안 그림
                if (!dirty) return;
                dirty = false;
                engine.render(look.yaw, look.pitch, fade);
            };
            loop();
        });

        function startVideo(meta) {
            video = document.createElement('video');
            video.src = base + '/bg/' + meta.video;
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
