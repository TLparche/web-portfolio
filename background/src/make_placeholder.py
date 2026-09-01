import numpy as np, pathlib, subprocess, sys

from fftool import ffmpeg

W, H, FPS, FRAMES = 640, 360, 30, 240
ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = ROOT / "work"

# 가까울수록 1.0(흰색), Depth Anything 출력과 같은 방향
NEAR, FAR = 2.0, 16.0

SPHERES = [
    # (궤도반경, 궤도속도, 위상, y, 반지름, 색)
    (3.2, 1.00, 0.0, 0.0, 1.30, (0.90, 0.39, 0.78)),
    (5.0, -0.70, 2.1, 1.1, 0.95, (0.57, 0.52, 0.85)),
    (4.1, 0.55, 4.0, -1.2, 1.10, (0.96, 0.74, 0.91)),
    (6.6, -0.40, 1.0, 0.4, 0.80, (0.75, 0.35, 0.62)),
    (2.2, 1.40, 3.3, -0.6, 0.62, (1.00, 0.85, 0.97)),
]


def render(t):
    """카메라는 원점 뒤에 고정, 구들이 공전."""
    aspect = W / H
    x = (np.arange(W) + 0.5) / W * 2 - 1
    y = 1 - (np.arange(H) + 0.5) / H * 2
    px, py = np.meshgrid(x * aspect, y)

    ro = np.array([0.0, 0.6, -11.0])
    rd = np.stack([px, py, np.full_like(px, 1.9)], axis=-1)
    rd /= np.linalg.norm(rd, axis=-1, keepdims=True)

    depth = np.full((H, W), np.inf)
    color = np.zeros((H, W, 3), np.float32)

    for orbit, speed, phase, cy, rad, col in SPHERES:
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
        lam = np.clip((n * np.array([0.4, 0.7, -0.6])).sum(-1), 0, 1)
        rim = np.power(1 - np.clip((-(rd * n).sum(-1)), 0, 1), 2.5)
        shade = (0.25 + 0.75 * lam)[..., None] * np.array(col) + rim[..., None] * 0.55
        depth = np.where(closer, dist, depth)
        color = np.where(closer[..., None], shade, color)

    # 바닥 격자
    ground = rd[..., 1] < -1e-4
    gd = np.where(ground, (ro[1] + 3.0) / -rd[..., 1], np.inf)
    gvis = ground & (gd > 0) & (gd < depth)
    if gvis.any():
        gp = ro + rd * gd[..., None]
        line = np.minimum(np.abs((gp[..., 0] % 2.0) - 1.0), np.abs((gp[..., 2] % 2.0) - 1.0))
        grid = np.clip(1 - line * 9, 0, 1) * np.clip(1 - gd / FAR, 0, 1)
        gcol = grid[..., None] * np.array([0.55, 0.28, 0.52])
        depth = np.where(gvis, gd, depth)
        color = np.where(gvis[..., None], gcol, color)

    d = np.clip((FAR - np.clip(depth, NEAR, FAR)) / (FAR - NEAR), 0, 1)
    d = np.where(np.isinf(depth), 0.0, d)
    return (np.clip(color, 0, 1) * 255).astype(np.uint8), (d * 255).astype(np.uint8)


def main():
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

    for i in range(FRAMES):
        c, d = render(i / FPS * 0.9)
        enc[0].stdin.write(c.tobytes())
        enc[1].stdin.write(d.tobytes())
        if i % 40 == 0:
            print(f"  {i}/{FRAMES}", flush=True)

    for e in enc:
        e.stdin.close()
        e.wait()
    print(f"완료: {WORK/'color.mkv'}, {WORK/'depth.mkv'}  ({FRAMES}프레임 {FRAMES/FPS:.1f}초)")


if __name__ == "__main__":
    sys.exit(main())
