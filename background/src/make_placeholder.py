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


# 챕터마다 다른 장면. 하나가 챕터 하나로 잘림
SCENES = [
    # 큰 구 셋이 느리게 공전
    {"s": orb(3, 3.4, 0.55, 0.0, 1.30, pal=0), "b": [], "g": True},
    # 박스 탑
    {"s": [], "b": [blk(0, -1.6, 0, 1.5, 0.5, 1.5, 0.35, 0),
                    blk(0, -0.4, 0, 1.1, 0.5, 1.1, -0.5, 1),
                    blk(0, 0.7, 0, 0.7, 0.5, 0.7, 0.8, 2)], "g": True},
    # 작은 구 고리
    {"s": orb(9, 4.6, 0.75, 0.2, 0.52, pal=1), "b": [], "g": True},
    # 큰 구 둘이 가까이
    {"s": [(1.6, 0.3, 0.0, 0.3, 1.85, PAL[0]), (2.1, -0.25, 3.1, -0.5, 1.45, PAL[3])],
     "b": [], "g": False},
    # 박스 격자
    {"s": [], "b": [blk(x * 2.3, y * 1.7, 0, 0.62, 0.62, 0.62, 0.3 + 0.1 * x, x + y + 2)
                    for x in (-1, 0, 1) for y in (-1, 1)], "g": True},
    # 잔구름
    {"s": orb(14, 5.4, 1.15, -0.4, 0.34, pal=2) + orb(8, 2.8, -0.9, 0.9, 0.28, pal=4),
     "b": [], "g": True},
    # 큰 박스 하나에 구가 지나감
    {"s": orb(4, 4.4, 0.9, 0.0, 0.62, pal=1),
     "b": [blk(0, 0, 0, 1.5, 1.5, 1.5, 0.22, 3)], "g": False},
    # 나선
    {"s": [(3.6, 0.6, i * 1.1, -1.6 + i * 0.62, 0.62, PAL[i % len(PAL)]) for i in range(6)],
     "b": [], "g": True},
    # 납작한 판 셋
    {"s": [], "b": [blk(-1.9, 0.9, 0, 1.5, 0.14, 1.1, 0.18, 0),
                    blk(1.7, -0.2, 0, 1.3, 0.14, 1.0, -0.26, 2),
                    blk(-0.3, -1.5, 0, 1.7, 0.14, 1.2, 0.34, 4)], "g": True},
    # 한쪽에 몰린 덩어리
    {"s": orb(6, 1.9, 1.0, 0.5, 0.78, phase=0.4, pal=3)
          + [(0.0, 0.0, 0.0, 0.5, 1.15, PAL[0])], "b": [], "g": True},
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
