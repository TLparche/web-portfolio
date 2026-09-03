const CAM_FOV = 45;
const CAM_DIST = 3.2;

// group을 yaw로 돌리면 먼 쪽 평면 끝이 화면 안으로 들어온다. 그만큼 넓게 찍어 둔다
// 16:9에서 yaw 12도(커서 5 + 스윙 7) 기준. yaw 예산을 늘리면 이 값도 올려야 한다
const OVERSCAN = 1.22;

// 배경 트랙이 따로 없는 에셋에서 근경과 원경을 가르는 깊이. 근경만 점구름이 된다.
// src79 전체 프레임 깊이 분포로 잡은 값 (깊이 > 0.45 가 약 22%, split.py 의 25%와 비슷)
const SPLIT = [0.35, 0.55];

// 배경 트랙이 없는 에셋에 평면 레이어를 깔지. 끄면 프레임 전체가 예전처럼 점구름이 된다
const CROSSFADE = false;

const VERTEX_SHADER = [
    'attribute vec2 aGrid;',
    'uniform sampler2D uTex;',
    'uniform vec4 uColorXf;',
    'uniform vec4 uDepthXf;',
    'uniform vec2 uTexel;',
    'uniform vec2 uDepthGate;',
    'uniform vec2 uLumaGate;',
    'uniform float uAspect;',
    'uniform float uDepth;',
    'uniform float uSize;',
    'uniform float uPixelRatio;',
    'uniform vec2 uSplit;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'float depthAt(vec2 g){ return texture2D(uTex, uDepthXf.xy + g * uDepthXf.zw).r; }',
    'void main(){',
    '  float d = depthAt(aGrid);',
    // 깊이 0은 배경 표시. 나머지 텍스처 조회 전에 버린다
    '  if (d < uDepthGate.x) {',
    '    gl_PointSize = 0.0;',
    '    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);',
    '    return;',
    '  }',
    '  vColor = texture2D(uTex, uColorXf.xy + aGrid * uColorXf.zw).rgb;',
    '#ifdef EDGE_MASK',
    // 실루엣 경계에서 늘어나는 점 제거
    '  float dx = abs(depthAt(aGrid + vec2(uTexel.x, 0.0)) - depthAt(aGrid - vec2(uTexel.x, 0.0)));',
    '  float dy = abs(depthAt(aGrid + vec2(0.0, uTexel.y)) - depthAt(aGrid - vec2(0.0, uTexel.y)));',
    '  vAlpha = 1.0 - smoothstep(0.035, 0.11, max(dx, dy));',
    '#else',
    '  vAlpha = 1.0;',
    '#endif',
    '  vAlpha *= smoothstep(uDepthGate.x, uDepthGate.y, d);',
    '  vAlpha *= smoothstep(uLumaGate.x, uLumaGate.y, dot(vColor, vec3(0.299, 0.587, 0.114)));',
    '#ifdef SPLIT_MATTE',
    // 원경은 평면 레이어가 선명하게 맡는다. 평면 알파와 정확히 상보적이어야 겹치지 않는다
    '  vAlpha *= smoothstep(uSplit.x, uSplit.y, d);',
    '#endif',
    '  if (vAlpha < 0.004) {',
    '    gl_PointSize = 0.0;',
    '    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);',
    '    return;',
    '  }',
    '  vec3 pos = vec3((aGrid - 0.5) * vec2(uAspect, 1.0), (d - 0.5) * uDepth);',
    '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
    '  gl_PointSize = uSize * uPixelRatio * (1.0 / -mv.z);',
    '  gl_Position = projectionMatrix * mv;',
    '}',
].join('\n');

const FRAGMENT_SHADER = [
    'precision highp float;',
    'uniform float uFade;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'void main(){',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  float r2 = dot(c, c);',
    '  if (r2 > 0.25) discard;',
    '  float a = vAlpha * uFade * (1.0 - smoothstep(0.03, 0.25, r2));',
    '  if (a < 0.008) discard;',
    '  gl_FragColor = vec4(vColor, a);',
    '}',
].join('\n');

const BACK_VERTEX = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}',
].join('\n');

const BACK_FRAGMENT = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec4 uBackXf;',
    'uniform vec2 uCover;',
    'uniform float uFade;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 uv = (vUv - 0.5) * uCover + 0.5;',
    '  gl_FragColor = vec4(texture2D(uTex, uBackXf.xy + uv * uBackXf.zw).rgb, uFade);',
    '}',
].join('\n');

// 배경 트랙이 없을 때. 컬러 영역을 평면으로 깔고 근경만 투과시켜 점구름에 넘긴다
const FLAT_FRAGMENT = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec4 uColorXf;',
    'uniform vec4 uDepthXf;',
    'uniform vec2 uSplit;',
    'uniform vec2 uCover;',
    'uniform float uFade;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 uv = (vUv - 0.5) * uCover + 0.5;',
    '  vec3 c = texture2D(uTex, uColorXf.xy + uv * uColorXf.zw).rgb;',
    '  float d = texture2D(uTex, uDepthXf.xy + uv * uDepthXf.zw).r;',
    '  gl_FragColor = vec4(c, (1.0 - smoothstep(uSplit.x, uSplit.y, d)) * uFade);',
    '}',
].join('\n');

// 정격자는 화면 픽셀과 맞물려 원형 무아레를 만든다. 칸 안에서 조금씩 흩뿌린다
const JITTER = 0.7;

function jitter(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return (s - Math.floor(s) - 0.5) * JITTER;
}

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

// 격자 끝이 옆 영역을 물지 않게 반 텍셀 안쪽에서 시작, v는 뒤집힘
function xform(rect, fw, fh) {
    const [x0, y0, x1, y1] = rect;
    return [x0 + 0.5 / fw, (1 - y1) + 0.5 / fh, (x1 - x0) - 1 / fw, (y1 - y0) - 1 / fh];
}

export function createGlRenderer(THREE, canvas, meta, tier) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.autoClear = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 100);
    camera.position.z = CAM_DIST;

    const [gw, gh] = tier.grid;
    const count = gw * gh;
    const grid = new Float32Array(count * 2);
    for (let y = 0, i = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++, i++) {
            grid[i * 2] = clamp01((x + jitter(i)) / (gw - 1));
            grid[i * 2 + 1] = clamp01((y + jitter(i + 0.5)) / (gh - 1));
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('aGrid', new THREE.BufferAttribute(grid, 2));
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

    const frameW = Math.round(meta.width / (meta.colorRect[2] - meta.colorRect[0]));
    const frameH = Math.round(meta.height / (meta.colorRect[3] - meta.colorRect[1]));
    const layered = !!meta.backRect;

    const aspect = meta.width / meta.height;
    const uniforms = {
        uTex: { value: null },
        uColorXf: { value: new THREE.Vector4(...xform(meta.colorRect, frameW, frameH)) },
        uDepthXf: { value: new THREE.Vector4(...xform(meta.depthRect, frameW, frameH)) },
        uTexel: { value: new THREE.Vector2(1 / frameW, 1 / frameH) },
        // 배경이 따로 있으면 깊이 0이 곧 배경이라 루미넌스로 거를 게 거의 없다
        uDepthGate: { value: new THREE.Vector2(...(layered ? [0.02, 0.10] : [0.012, 0.07])) },
        uLumaGate: { value: new THREE.Vector2(...(layered ? [0.0, 0.04] : [0.02, 0.12])) },
        uAspect: { value: aspect },
        uDepth: { value: 0.85 },
        uSplit: { value: new THREE.Vector2(...SPLIT) },
        uSize: { value: tier.size },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uFade: { value: 0 },
    };
    const pointDefines = tier.edge ? { EDGE_MASK: '' } : {};
    if (!layered && CROSSFADE) pointDefines.SPLIT_MATTE = '';
    const mat = new THREE.ShaderMaterial({
        defines: pointDefines,
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });

    const group = new THREE.Group();
    group.add(new THREE.Points(geo, mat));
    scene.add(group);

    // 평면 레이어. 회전 그룹 밖에서 클립 공간에 바로 그린다
    // 배경 트랙이 있으면 그 영역을, 없으면 컬러 영역을 깔고 근경만 투과시킨다
    const useFlat = layered || CROSSFADE;
    let backCam = null;
    let backMat = null;
    let backScene = null;
    if (useFlat) {
    backCam = new THREE.Camera();
    backMat = new THREE.ShaderMaterial({
        uniforms: layered
            ? {
                uTex: uniforms.uTex,
                uBackXf: { value: new THREE.Vector4(...xform(meta.backRect, frameW, frameH)) },
                uCover: { value: new THREE.Vector2(1, 1) },
                uFade: uniforms.uFade,
            }
            : {
                uTex: uniforms.uTex,
                uColorXf: uniforms.uColorXf,
                uDepthXf: uniforms.uDepthXf,
                uSplit: uniforms.uSplit,
                uCover: { value: new THREE.Vector2(1, 1) },
                uFade: uniforms.uFade,
            },
        vertexShader: BACK_VERTEX,
        fragmentShader: layered ? BACK_FRAGMENT : FLAT_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backMat);
    quad.frustumCulled = false;
    backScene = new THREE.Scene();
    backScene.add(quad);
    }

    let texture = null;
    let coverScale = 0;

    function setFrameSource(el, kind) {
        if (texture) texture.dispose();
        texture = kind === 'video' ? new THREE.VideoTexture(el) : new THREE.Texture(el);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        uniforms.uTex.value = texture;
    }

    function frameChanged() {
        if (texture) texture.needsUpdate = true;
    }

    function resize() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const pixelRatio = renderer.getPixelRatio();
        uniforms.uPixelRatio.value = pixelRatio;

        // 화면을 꽉 채우는 cover 스케일
        const visH = 2 * Math.tan((CAM_FOV / 2) * Math.PI / 180) * CAM_DIST;
        const scale = Math.max(visH * (w / h) / aspect, visH) * OVERSCAN;
        coverScale = scale;
        group.scale.setScalar(scale);

        // 점 지름을 격자 한 칸의 화면 크기에 맞춤. 고정값이면 큰 화면에서 격자가 드러난다
        const cellPx = (scale / visH) * h * pixelRatio / (gh - 1);
        uniforms.uSize.value = tier.size * cellPx * CAM_DIST / pixelRatio;

        // 배경도 같은 cover 틀이어야 오브젝트 위치가 맞는다. 오버스캔까지 같이 먹인다
        // uCover를 줄이면 텍스처를 좁게 떠서 확대된다. 점구름의 scale 확대와 방향이 반대다
        if (backMat) {
            const ca = w / h;
            backMat.uniforms.uCover.value.set(
                (ca > aspect ? 1 : ca / aspect) / OVERSCAN,
                (ca > aspect ? aspect / ca : 1) / OVERSCAN);
        }
    }

    // cam은 프레임 분석에서 온 카메라 자세. x, y는 평면 단위, z는 CAM_DIST 대비 비율
    function render(yaw, pitch, fade, cam) {
        if (!uniforms.uTex.value) return;
        uniforms.uFade.value = fade;
        group.rotation.y = yaw;
        group.rotation.x = pitch;
        if (cam) {
            camera.position.set(cam.x * coverScale, cam.y * coverScale, CAM_DIST * (1 + cam.z));
            camera.rotation.z = cam.roll;
        }
        renderer.clear();
        if (backScene) renderer.render(backScene, backCam);
        renderer.render(scene, camera);
    }

    function dispose() {
        if (texture) texture.dispose();
        geo.dispose();
        mat.dispose();
        if (backMat) backMat.dispose();
        renderer.dispose();
    }

    resize();
    return { setFrameSource, frameChanged, render, resize, dispose };
}
