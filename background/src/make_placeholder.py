import argparse, numpy as np, pathlib, subprocess, sys

from fftool import ffmpeg

W, H, FPS, FRAMES = 640, 360, 30, 240
ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = ROOT / "work"
INPUT = ROOT / "input"

# 가까울수록 1.0(흰색), Depth Anything 출력과 같은 방향
NEAR, FAR = 2.0, 16.0

# 사이트 강조색 계열
PAL = [
    (0.90, 0.39, 0.78), (0.57, 0.52, 0.85), (0.96, 0.74, 0.91),
    (0.75, 0.35, 0.62), (1.00, 0.85, 0.97), (0.62, 0.44, 0.80),
]


def orb(n, radius, speed, y, rad, phase=0.0, pal=0):
    """공전하는 구 n개. (궤도반경, 궤도속도, 위상, y, 반지름, 색)"""
    return [(radius, speed, phase + i * 2 * np.pi / n, y, rad, PAL[(pal + i) % len(PAL)])
            for i in range(n)]


def blk(cx, cy, cz, sx, sy, sz, spin, col):
    """도는 박스. (중심, 반크기, 회전속도, 색)"""
    return ((cx, cy, cz), (sx, sy, sz), spin, PAL[col % len(PAL)])


PHI = (1 + 5 ** 0.5) / 2


def norm_rows(v):
    """단위벡터로 만들고 중복 제거. 0 좌표의 부호 조합이 겹침"""
    v = np.asarray(v, np.float64)
    v = v / np.linalg.norm(v, axis=-1, keepdims=True)
    seen = {}
    for row in v:
        seen.setdefault(tuple(np.round(row, 6)), row)
    return np.array(list(seen.values()))


def cyc(a, b, c):
    """세 좌표를 돌려가며 배치. 정십이면체·정이십면체 법선 만들 때 씀"""
    return [(a, b, c), (b, c, a), (c, a, b)]


def signs(v, flip=(1, 1, 1)):
    out = []
    for sx in (1, -1) if flip[0] else (1,):
        for sy in (1, -1) if flip[1] else (1,):
            for sz in (1, -1) if flip[2] else (1,):
                out.append((v[0] * sx, v[1] * sy, v[2] * sz))
    return out


# 볼록 다면체는 반평면 교집합. 면 법선만 주면 됨
FACES = {
    "tetra": norm_rows([(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)]),
    "cube": norm_rows(signs((1, 0, 0), (1, 0, 0)) + signs((0, 1, 0), (0, 1, 0))
                      + signs((0, 0, 1), (0, 0, 1))),
    "octa": norm_rows(signs((1, 1, 1))),
    "dodeca": norm_rows([v for t in cyc(0, 1, PHI) for v in signs(t)]),
    "icosa": norm_rows(signs((1, 1, 1)) + [v for t in cyc(0, 1 / PHI, PHI) for v in signs(t)]),
    # 정육면체와 정팔면체 면을 겹쳐 깎은 모양
    "cubocta": norm_rows(signs((1, 0, 0), (1, 0, 0)) + signs((0, 1, 0), (0, 1, 0))
                         + signs((0, 0, 1), (0, 0, 1)) + signs((0.62, 0.62, 0.62))),
}


def poly(kind, cx, cy, cz, size, spin, col, tilt=0.0):
    """다면체. (면 법선, 중심, 크기, 회전속도, 기울기, 색)"""
    return (FACES[kind], (cx, cy, cz), size, spin, tilt, PAL[col % len(PAL)])


def tess_edges():
    """4차원 정팔포체의 꼭짓점 16개와 한 좌표만 다른 변 32개"""
    vs = [(x, y, z, w) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1) for w in (-1, 1)]
    es = []
    for i, a in enumerate(vs):
        for j in range(i + 1, len(vs)):
            if sum(1 for k in range(4) if a[k] != vs[j][k]) == 1:
                es.append((i, j))
    return np.array(vs, np.float64), es


TESS_V, TESS_E = tess_edges()


def rot4(v, ax, ay):
    """xw 평면과 yz 평면에서 회전. 안팎이 뒤집히는 그 움직임"""
    x, y, z, w = v[:, 0].copy(), v[:, 1].copy(), v[:, 2].copy(), v[:, 3].copy()
    c, s = np.cos(ax), np.sin(ax)
    x, w = x * c - w * s, x * s + w * c
    c, s = np.cos(ay), np.sin(ay)
    y, z = y * c - z * s, y * s + z * c
    return np.stack([x, y, z, w], -1)


def tess_at(t, size, center):
    """지금 시각의 변 목록. 4차원에서 돌린 뒤 3차원으로 투영"""
    v = rot4(TESS_V, t * 0.55, t * 0.33)
    k = size / (2.6 - v[:, 3] * 0.75)
    p = v[:, :3] * k[:, None] + np.array(center)
    return [(p[i], p[j]) for i, j in TESS_E]


# 챕터마다 다른 장면. 하나가 챕터 하나로 잘림
# s는 구, b는 박스, p는 다면체, t는 테서렉트, g는 바닥 격자
SCENES = [
    # 4차원 정팔포체가 안팎으로 뒤집힘
    {"s": [], "b": [], "t": [(3.2, (0, 0.1, 0), 0.1, 1)], "g": True},
    # 정이십면체 셋
    {"s": [], "b": [], "p": [poly("icosa", -2.5, 0.6, 0.5, 1.15, 0.5, 0),
                             poly("icosa", 0.4, -0.7, -0.6, 1.45, -0.35, 2, 0.5),
                             poly("icosa", 2.9, 0.4, 0.8, 0.95, 0.62, 4)], "g": True},
    # 정십이면체에 작은 구가 붙어 돎
    {"s": orb(6, 3.6, 0.85, 0.1, 0.34, pal=4),
     "b": [], "p": [poly("dodeca", 0, 0, 0, 1.7, 0.3, 1)], "g": True},
    # 정사면체 흩뿌림
    {"s": [], "b": [], "p": [poly("tetra", -3.0, 0.9, 0.4, 0.72, 0.7, 0, 0.9),
                             poly("tetra", -0.7, -0.8, -0.5, 0.92, -0.55, 3, 0.2),
                             poly("tetra", 1.9, 0.8, 0.6, 0.78, 0.45, 2, 1.6),
                             poly("tetra", 3.6, -1.0, -0.3, 0.62, -0.8, 5)], "g": True},
    # 깎은 정육면체 하나
    {"s": [], "b": [], "p": [poly("cubocta", 0, 0.1, 0, 2.0, 0.26, 1, 0.35)], "g": True},
    # 정팔면체 고리
    {"s": [], "b": [],
     "p": [poly("octa", np.cos(k * 1.05) * 3.5, np.sin(k * 1.05) * 1.2, 0, 0.72,
                0.4 + k * 0.08, k) for k in range(6)], "g": True},
    # 박스 탑
    {"s": [], "b": [blk(0, -1.6, 0, 1.5, 0.5, 1.5, 0.35, 0),
                    blk(0, -0.4, 0, 1.1, 0.5, 1.1, -0.5, 1),
                    blk(0, 0.7, 0, 0.7, 0.5, 0.7, 0.8, 2)], "g": True},
    # 잔구름
    {"s": orb(14, 5.4, 1.15, -0.4, 0.34, pal=2) + orb(8, 2.8, -0.9, 0.9, 0.28, pal=4),
     "b": [], "g": True},
    # 테서렉트가 작게 둘, 빠르게
    {"s": [], "b": [], "t": [(2.3, (-2.6, 0.4, 0), 0.085, 0), (2.3, (2.6, -0.4, 0), 0.085, 3)],
     "g": True},
    # 다면체와 구를 섞음
    {"s": [(2.4, -0.5, 1.6, 0.8, 0.85, PAL[4])],
     "b": [blk(2.6, -1.0, 0.5, 0.7, 0.7, 0.7, 0.4, 2)],
     "p": [poly("dodeca", -2.4, 0.7, -0.4, 1.05, 0.45, 0),
           poly("octa", 0.2, -0.6, 0.3, 0.9, -0.6, 1, 0.7)], "g": True},
    # 큰 구 하나
    {"s": [(0.8, 0.35, 0.0, 0.0, 2.15, PAL[1])], "b": [], "g": True},
]


def shade_of(rd, n, col, lit):
    """램버트 + 림. 색은 0~1"""
    lam = np.clip((n * np.array([0.4, 0.7, -0.6])).sum(-1), 0, 1)
    rim = np.power(1 - np.clip((-(rd * n).sum(-1)), 0, 1), 2.5)
    return (0.25 + 0.75 * lam)[..., None] * np.array(col) + rim[..., None] * lit


def box_hit(ro, rd, center, half, spin):
    """y축으로 spin만큼 돈 박스와의 교차. (거리, 법선) 반환, 안 맞으면 거리 inf"""
    c, sn = np.cos(-spin), np.sin(-spin)
    rot = np.array([[c, 0.0, -sn], [0.0, 1.0, 0.0], [sn, 0.0, c]])
    o = (ro - np.array(center)) @ rot.T
    d = rd @ rot.T
    inv = 1.0 / np.where(np.abs(d) < 1e-6, 1e-6, d)
    hb = np.array(half)
    t1 = (-hb - o) * inv
    t2 = (hb - o) * inv
    lo = np.minimum(t1, t2)
    hi = np.maximum(t1, t2)
    tmin = lo.max(-1)
    tmax = hi.min(-1)
    ok = (tmax > np.maximum(tmin, 0.0)) & (tmin > 0.0)
    # 어느 축이 tmin을 냈는지가 곧 법선
    ax = lo.argmax(-1)
    nl = np.zeros_like(rd)
    for k in range(3):
        m = ax == k
        nl[..., k] = np.where(m, -np.sign(d[..., k]), 0.0)
    return np.where(ok, tmin, np.inf), nl @ rot


def yrot(a):
    c, sn = np.cos(a), np.sin(a)
    return np.array([[c, 0.0, -sn], [0.0, 1.0, 0.0], [sn, 0.0, c]])


def xrot(a):
    c, sn = np.cos(a), np.sin(a)
    return np.array([[1.0, 0.0, 0.0], [0.0, c, -sn], [0.0, sn, c]])


def poly_hit(ro, rd, faces, center, size, spin, tilt):
    """볼록 다면체와의 교차. 들어오는 면 중 가장 늦은 것이 표면"""
    rot = yrot(-spin) @ xrot(-tilt)
    o = (ro - np.array(center)) @ rot.T
    d = rd @ rot.T
    tmin = np.full(d.shape[:-1], -np.inf)
    tmax = np.full(d.shape[:-1], np.inf)
    nrm = np.zeros_like(d)
    for f in faces:
        dn = d @ f
        on = o @ f - size
        safe = np.where(np.abs(dn) < 1e-7, 1e-7, dn)
        tp = -on / safe
        enter = dn < 0
        # 면을 향해 들어가는 쪽은 tmin, 등지는 쪽은 tmax
        newer = enter & (tp > tmin)
        tmin = np.where(newer, tp, tmin)
        for k in range(3):
            nrm[..., k] = np.where(newer, f[k], nrm[..., k])
        tmax = np.where(~enter, np.minimum(tmax, tp), tmax)
        # 평행하게 바깥을 지나가면 아예 안 맞음
        tmin = np.where((np.abs(dn) < 1e-7) & (on > 0), np.inf, tmin)
    ok = (tmax > tmin) & (tmin > 0) & np.isfinite(tmin)
    return np.where(ok, tmin, np.inf), nrm @ rot


def cap_hit(ro, rd, a, b, r):
    """선분 a-b를 반지름 r로 부풀린 캡슐. 와이어프레임 변에 씀"""
    ba = np.asarray(b, np.float64) - np.asarray(a, np.float64)
    oa = ro - np.asarray(a, np.float64)
    baba = ba @ ba
    bard = rd @ ba
    baoa = oa @ ba
    rdoa = (rd * oa).sum(-1)
    oaoa = oa @ oa
    qa = baba - bard * bard
    qb = baba * rdoa - baoa * bard
    qc = baba * oaoa - baoa * baoa - r * r * baba
    disc = qb * qb - qa * qc
    safe = np.where(np.abs(qa) < 1e-9, 1e-9, qa)
    tp = (-qb - np.sqrt(np.maximum(disc, 0))) / safe
    y = baoa + tp * bard
    ok = (disc > 0) & (tp > 0) & (y > 0) & (y < baba)
    n = (oa + tp[..., None] * rd - ba * (y / baba)[..., None]) / r
    return np.where(ok, tp, np.inf), n


def render(t, w=None, h=None, scene=None):
    """카메라는 원점 뒤에 고정, 도형들이 움직임"""
    w = w or W
    h = h or H
    scene = SCENES[0] if scene is None else scene
    aspect = w / h
    x = (np.arange(w) + 0.5) / w * 2 - 1
    y = 1 - (np.arange(h) + 0.5) / h * 2
    px, py = np.meshgrid(x * aspect, y)

    ro = np.array([0.0, 0.6, -11.0])
    rd = np.stack([px, py, np.full_like(px, 1.9)], axis=-1)
    rd /= np.linalg.norm(rd, axis=-1, keepdims=True)

    depth = np.full((h, w), np.inf)
    color = np.zeros((h, w, 3), np.float32)

    for center, half, spin, col in scene["b"]:
        dist, n = box_hit(ro, rd, center, half, spin * t)
        closer = (dist < depth) & np.isfinite(dist)
        if not closer.any():
            continue
        depth = np.where(closer, dist, depth)
        color = np.where(closer[..., None], shade_of(rd, n, col, 0.35), color)

    for faces, center, size, spin, tilt, col in scene.get("p", []):
        dist, n = poly_hit(ro, rd, faces, center, size, spin * t, tilt + t * 0.17)
        closer = (dist < depth) & np.isfinite(dist)
        if not closer.any():
            continue
        depth = np.where(closer, dist, depth)
        color = np.where(closer[..., None], shade_of(rd, n, col, 0.42), color)

    for size, center, rad, col in scene.get("t", []):
        for ea, eb in tess_at(t, size, center):
            dist, n = cap_hit(ro, rd, ea, eb, rad)
            closer = (dist < depth) & np.isfinite(dist)
            if not closer.any():
                continue
            depth = np.where(closer, dist, depth)
            color = np.where(closer[..., None], shade_of(rd, n, col, 0.7), color)

    for orbit, speed, phase, cy, rad, col in scene["s"]:
        a = phase + speed * t
        c = np.array([np.cos(a) * orbit, cy + np.sin(a * 0.7) * 0.5, np.sin(a) * orbit])
        oc = ro - c
        b = (rd * oc).sum(-1)
        disc = b * b - (oc @ oc - rad * rad)
        hit = disc > 0
        if not hit.any():
            continue
        dist = np.where(hit, -b - np.sqrt(np.maximum(disc, 0)), np.inf)
        closer = hit & (dist > 0) & (dist < depth)
        if not closer.any():
            continue
        p = ro + rd * dist[..., None]
        n = (p - c) / rad
        depth = np.where(closer, dist, depth)
        color = np.where(closer[..., None], shade_of(rd, n, col, 0.55), color)

    # 바닥 격자
    floor = scene["g"] & (rd[..., 1] < -1e-4)
    gd = np.where(floor, (ro[1] + 3.0) / -rd[..., 1], np.inf)
    gvis = floor & (gd > 0) & (gd < depth)
    if gvis.any():
        gp = ro + rd * gd[..., None]
        line = np.minimum(np.abs((gp[..., 0] % 2.0) - 1.0), np.abs((gp[..., 2] % 2.0) - 1.0))
        lines = np.clip(1 - line * 9, 0, 1) * np.clip(1 - gd / FAR, 0, 1)
        gcol = lines[..., None] * np.array([0.55, 0.28, 0.52])
        depth = np.where(gvis, gd, depth)
        color = np.where(gvis[..., None], gcol, color)

    d = np.clip((FAR - np.clip(depth, NEAR, FAR)) / (FAR - NEAR), 0, 1)
    d = np.where(np.isinf(depth), 0.0, d)
    return (np.clip(color, 0, 1) * 255).astype(np.uint8), (d * 255).astype(np.uint8)


# 장면을 순서대로 이어 붙일 때 프레임이 속한 장면과 그 안에서의 시간
def at(i, per, count):
    k = min(count - 1, i // per)
    return SCENES[k % len(SCENES)], (i - k * per) / FPS * 0.9


def write_mp4(path, w, h, frames, per, count, only):
    """새 파이프라인 입력으로 쓸 소스 영상"""
    enc = subprocess.Popen(
        [ffmpeg(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "16", "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    for i in range(frames):
        sc, t = at(i, per, count)
        if only == "back":
            sc = {"s": [], "b": [], "g": sc["g"]}
        elif only == "object":
            sc = {"s": sc["s"], "b": sc["b"], "g": False}
        c, _ = render(t, w, h, sc)
        enc.stdin.write(c.tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"  {path.name}  {w}x{h} {frames}프레임")


def layers(frames, per, count):
    INPUT.mkdir(parents=True, exist_ok=True)
    write_mp4(INPUT / "ph_back.mp4", W * 2, H * 2, frames, per, count, "back")
    write_mp4(INPUT / "ph_object.mp4", W, H, frames, per, count, "object")
    print(f"완료: {INPUT/'ph_back.mp4'}, {INPUT/'ph_object.mp4'}")
    print("다음: python src/segments.py --back ph_back.mp4 --object ph_object.mp4")


def main():
    global W, H

    ap = argparse.ArgumentParser()
    ap.add_argument("--layers", action="store_true", help="배경/오브젝트를 나눠 input/에 소스 영상으로 저장")
    ap.add_argument("--frames", type=int, default=FRAMES)
    ap.add_argument("--scenes", type=int, default=1, help="장면을 몇 개 이어 붙일지. 챕터 수와 맞춤")
    ap.add_argument("--res", default=f"{W}x{H}", help="오브젝트 해상도. --layers면 배경은 이것의 2배")
    a = ap.parse_args()

    W, H = (int(v) for v in a.res.lower().split("x"))
    per = max(1, a.frames // max(1, a.scenes))

    if a.layers:
        return layers(a.frames, per, a.scenes)

    for sub in ("color", "depth"):
        (WORK / sub).mkdir(parents=True, exist_ok=True)
        for old in (WORK / sub).glob("*.png"):
            old.unlink()

    enc = []
    for sub in ("color", "depth"):
        enc.append(subprocess.Popen(
            [ffmpeg(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt",
             "rgb24" if sub == "color" else "gray", "-s", f"{W}x{H}", "-r", str(FPS),
             "-i", "-", "-c:v", "ffv1", str(WORK / f"{sub}.mkv")], stdin=subprocess.PIPE))

    for i in range(a.frames):
        sc, t = at(i, per, a.scenes)
        c, d = render(t, scene=sc)
        enc[0].stdin.write(c.tobytes())
        enc[1].stdin.write(d.tobytes())
        if i % 40 == 0:
            print(f"  {i}/{a.frames}", flush=True)

    for e in enc:
        e.stdin.close()
        e.wait()
    print(f"완료: {WORK/'color.mkv'}, {WORK/'depth.mkv'}  "
          f"({a.frames}프레임 {a.frames/FPS:.1f}초, 장면 {a.scenes}개 x {per}프레임)")
    print("다음: python src/segments.py --split --count 11")


if __name__ == "__main__":
    sys.exit(main())
