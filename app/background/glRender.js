const CAM_FOV = 45;
const CAM_DIST = 3.2;

const VERTEX_SHADER = [
    'attribute vec2 aGrid;',
    'uniform sampler2D uTex;',
    'uniform vec2 uTexel;',
    'uniform float uAspect;',
    'uniform float uDepth;',
    'uniform float uSize;',
    'uniform float uPixelRatio;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    // 위 절반이 컬러 아래 절반이 깊이, flipY라 v가 뒤집힘
    'float depthAt(vec2 g){ return texture2D(uTex, vec2(g.x, g.y * 0.5)).r; }',
    'void main(){',
    '  float d = depthAt(aGrid);',
    '  vColor = texture2D(uTex, vec2(aGrid.x, 0.5 + aGrid.y * 0.5)).rgb;',
    '#ifdef EDGE_MASK',
    // 실루엣 경계에서 늘어나는 점 제거
    '  float dx = abs(depthAt(aGrid + vec2(uTexel.x, 0.0)) - depthAt(aGrid - vec2(uTexel.x, 0.0)));',
    '  float dy = abs(depthAt(aGrid + vec2(0.0, uTexel.y)) - depthAt(aGrid - vec2(0.0, uTexel.y)));',
    '  vAlpha = 1.0 - smoothstep(0.035, 0.11, max(dx, dy));',
    '#else',
    '  vAlpha = 1.0;',
    '#endif',
    '  vAlpha *= smoothstep(0.012, 0.07, d);',
    // 어두운 곳은 안 그림
    '  vAlpha *= smoothstep(0.02, 0.12, dot(vColor, vec3(0.299, 0.587, 0.114)));',
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

export function createGlRenderer(THREE, canvas, meta, tier) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 100);
    camera.position.z = CAM_DIST;

    const [gw, gh] = tier.grid;
    const count = gw * gh;
    const grid = new Float32Array(count * 2);
    for (let y = 0, i = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++, i++) {
            grid[i * 2] = x / (gw - 1);
            grid[i * 2 + 1] = y / (gh - 1);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('aGrid', new THREE.BufferAttribute(grid, 2));
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

    const aspect = meta.width / meta.height;
    const uniforms = {
        uTex: { value: null },
        uTexel: { value: new THREE.Vector2(1 / meta.width, 1 / meta.height) },
        uAspect: { value: aspect },
        uDepth: { value: 0.85 },
        uSize: { value: tier.size },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uFade: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
        defines: tier.edge ? { EDGE_MASK: '' } : {},
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

    let texture = null;

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
        uniforms.uPixelRatio.value = renderer.getPixelRatio();

        // 화면을 꽉 채우는 cover 스케일
        const visH = 2 * Math.tan((CAM_FOV / 2) * Math.PI / 180) * CAM_DIST;
        group.scale.setScalar(Math.max(visH * (w / h) / aspect, visH));
    }

    function render(yaw, pitch, fade) {
        if (!uniforms.uTex.value) return;
        uniforms.uFade.value = fade;
        group.rotation.y = yaw;
        group.rotation.x = pitch;
        renderer.render(scene, camera);
    }

    function dispose() {
        if (texture) texture.dispose();
        geo.dispose();
        mat.dispose();
        renderer.dispose();
    }

    resize();
    return { setFrameSource, frameChanged, render, resize, dispose };
}
