import argparse, json, pathlib, subprocess, sys

import numpy as np
from PIL import Image

from fftool import ffmpeg, ffprobe

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = ROOT / "work"


def probe(path):
    """프레임 수는 세지 않는다. ffv1을 -count_frames로 세면 전체 디코딩이라 몇십 초씩 걸린다."""
    r = subprocess.run([ffprobe(), "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height,r_frame_rate,nb_frames",
                        "-show_entries", "format=duration",
                        "-of", "json", str(path)], capture_output=True, text=True, check=True)
    j = json.loads(r.stdout)
    s = j["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    fps = int(num) / int(den)
    n = int(s.get("nb_frames") or 0)
    if not n:
        n = round(float(j.get("format", {}).get("duration", 0) or 0) * fps)
    return int(s["width"]), int(s["height"]), n, fps


def frames(path, w, h, chans):
    proc = subprocess.Popen(
        [ffmpeg(), "-v", "error", "-i", str(path), "-f", "rawvideo",
         "-pix_fmt", "rgb24" if chans == 3 else "gray", "-"], stdout=subprocess.PIPE)
    size = w * h * chans
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        a = np.frombuffer(buf, np.uint8)
        yield a.reshape(h, w, 3) if chans == 3 else a.reshape(h, w)
    proc.stdout.close()
    proc.wait()


def encoder(path, w, h, fps, gray):
    # 스트림 셋을 동시에 쓰므로 ffv1을 슬라이스로 쪼개 멀티스레딩을 켠다
    return subprocess.Popen(
        [ffmpeg(), "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray" if gray else "rgb24",
         "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-c:v", "ffv1", "-level", "3",
         "-threads", "4", "-slices", "12", "-slicecrc", "0", str(path)],
        stdin=subprocess.PIPE)


def smoothstep(lo, hi, x):
    t = np.clip((x - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def blur(a, r):
    """분리형 박스 블러. 2차원과 3차원 모두 받는다."""
    if r < 1:
        return a
    k = 2 * r + 1
    for axis in (0, 1):
        pad = [(0, 0)] * a.ndim
        pad[axis] = (r, r)
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis)
        hi = [slice(None)] * a.ndim
        hi[axis] = slice(k - 1, None)
        lo = [slice(None)] * a.ndim
        lo[axis] = slice(0, -k)
        zshape = list(a.shape)
        zshape[axis] = 1
        zero = np.zeros(zshape, c.dtype)
        a = (c[tuple(hi)] - np.concatenate([zero, c[tuple(lo)]], axis=axis)) / k
    return a.astype(np.float32)


def resize(a, w, h):
    lo, hi = 0.0, 1.0
    img = Image.fromarray((np.clip(a, lo, hi) * 255).astype(np.uint8))
    return np.asarray(img.resize((w, h), Image.BILINEAR), np.float32) / 255.0


def inpaint(rgb, hole, scale, iters, r):
    """구멍을 주변 색으로 확산시켜 메움. 저해상도에서 돌리고 다시 키운다."""
    h, w = hole.shape
    sw, sh = max(8, w // scale), max(8, h // scale)
    c = resize(rgb, sw, sh)
    m = resize(hole, sw, sh)
    known = (m < 0.5).astype(np.float32)

    num = c * known[..., None]
    den = known.copy()
    for _ in range(iters):
        num = blur(num, r)
        den = blur(den, r)
        num = np.where(known[..., None] > 0, c, num)
        den = np.where(known > 0, 1.0, den)
    filled = num / np.maximum(den, 1e-3)[..., None]

    up = resize(np.clip(filled, 0, 1), w, h)
    a = hole[..., None]
    return rgb * (1 - a) + up * a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--color", default=str(WORK / "color.mkv"))
    ap.add_argument("--depth", default=str(WORK / "depth.mkv"))
    ap.add_argument("--cover", type=float, default=30.0,
                    help="가까운 쪽 몇 %%를 오브젝트로 볼지. 컷마다 임계값을 다시 잡는다. 0이면 --thresh 고정")
    ap.add_argument("--thresh", type=float, default=0.4, help="--cover 0일 때 쓰는 고정 임계값")
    ap.add_argument("--thresh-ema", type=float, default=0.8, help="임계값 시간 스무딩, 컷에서는 즉시 따라간다")
    ap.add_argument("--cut", type=float, default=0.12, help="임계값이 이만큼 튀면 컷으로 보고 바로 갱신")
    ap.add_argument("--soft", type=float, default=0.08, help="임계값 주변 경사 폭")
    ap.add_argument("--cutoff", type=float, default=0.25, help="이 알파 밑은 배경으로 버린다")
    ap.add_argument("--relief-on", type=float, default=0.26,
                    help="깊이 대비(p90-p50)가 이 위로 올라가면 오브젝트를 뽑기 시작한다")
    ap.add_argument("--relief-off", type=float, default=0.18, help="이 밑으로 내려가면 멈춘다")
    ap.add_argument("--start", type=int, default=0, help="앞 N프레임을 건너뛴다. 특정 컷 확인용")
    ap.add_argument("--feather", type=int, default=1, help="마스크 가장자리 블러 반경 px")
    ap.add_argument("--dilate", type=int, default=6, help="배경을 메울 때 마스크를 넓히는 반경 px")
    ap.add_argument("--fill-scale", type=int, default=8, help="메우기를 몇 분의 1 해상도에서 할지")
    ap.add_argument("--fill-iters", type=int, default=30)
    ap.add_argument("--preview", type=int, default=0, help="확인용 프레임 N장을 work/preview/에 저장")
    ap.add_argument("--limit", type=int, default=0, help="앞 N프레임만 처리. 임계값 맞출 때 쓴다")
    a = ap.parse_args()

    cw, ch, cn, fps = probe(a.color)
    dw, dh, dn, _ = probe(a.depth)
    if (dw, dh) != (cw, ch):
        raise SystemExit(f"컬러 {cw}x{ch}와 깊이 {dw}x{dh}가 다르다")
    n = min(cn, dn)
    if a.limit:
        n = min(n, a.limit)
    mode = f"가까운 {a.cover:.0f}%" if a.cover > 0 else f"고정 임계 {a.thresh}"
    print(f"{cw}x{ch} {n}프레임 {fps:.2f}fps  {mode} ±{a.soft}")

    # depth.py --mask가 덮어쓴 깊이를 다시 넣으면 결과가 조용히 망가진다.
    # 마스크된 깊이는 0이거나 FLOOR 위뿐이라 그 사이가 비어있다
    d0 = next(frames(a.depth, cw, ch, 1)).astype(np.float32) / 255.0
    if (d0 <= 0.002).mean() > 0.05 and ((d0 > 0.002) & (d0 < 0.14)).mean() < 0.005:
        raise SystemExit(f"{a.depth}는 이미 마스크된 깊이다. "
                         "depth.py <원본> --reuse 로 전체 프레임 깊이를 되살린 뒤 다시 돌릴 것")

    back_enc = encoder(WORK / "back.mkv", cw, ch, fps, gray=False)
    col_enc = encoder(WORK / "obj_color.mkv", cw, ch, fps, gray=False)
    msk_enc = encoder(WORK / "obj_mask.mkv", cw, ch, fps, gray=True)

    prev_dir = WORK / "preview"
    if a.preview:
        prev_dir.mkdir(parents=True, exist_ok=True)
        for old in prev_dir.glob("split_*.png"):
            old.unlink()
    shots = set(a.start + round(i * (n - 1) / max(1, a.preview - 1)) for i in range(a.preview)) if a.preview else set()

    covered = []
    relief_gain = []
    thresh = None
    on = None
    cuts = 0
    cs = frames(a.color, cw, ch, 3)
    ds = frames(a.depth, cw, ch, 1)
    for i, (cf, df) in enumerate(zip(cs, ds)):
        if i < a.start:
            continue
        if i - a.start >= n:
            break
        rgb = cf.astype(np.float32) / 255.0
        d = df.astype(np.float32) / 255.0

        p50, p90, pc = np.percentile(d, [50.0, 90.0, 100.0 - a.cover])

        # 컷마다 깊이 분포가 달라서 프레임별로 임계값을 다시 잡는다
        is_cut = False
        if a.cover > 0:
            want = float(pc)
            if thresh is None or abs(want - thresh) > a.cut:
                is_cut = thresh is not None
                cuts += is_cut
                thresh = want
            else:
                thresh = thresh * a.thresh_ema + want * (1 - a.thresh_ema)
        else:
            thresh = a.thresh

        # 깊이 대비가 없는 컷은 어디를 잘라도 임의적이라 오브젝트를 아예 안 뽑는다.
        # 중간 세기로 섞으면 배경이 안 메워진 채 옅은 점만 떠서 유령이 생기므로 컷 단위로 켜고 끈다
        relief = float(p90 - p50)
        if on is None or is_cut:
            on = relief >= (a.relief_on + a.relief_off) / 2
        elif on and relief < a.relief_off:
            on = False
        elif not on and relief >= a.relief_on:
            on = True
        gain = 1.0 if on else 0.0
        relief_gain.append(gain)

        alpha = smoothstep(thresh - a.soft, thresh + a.soft, d)
        # 구조가 약한 컷은 알파가 넓은 그라데이션이 된다. 옅은 데는 배경으로 넘긴다
        alpha = np.where(alpha < a.cutoff, 0.0, alpha) * gain
        alpha = blur(alpha, a.feather)
        covered.append(float(alpha.mean()))

        # 메우는 범위는 부드러운 알파가 아니라 단단한 코어에서 잡는다
        hole = np.clip(blur((alpha > 0.5).astype(np.float32), a.dilate) * 3.0, 0, 1)
        back = inpaint(rgb, hole, a.fill_scale, a.fill_iters, 2)
        obj = np.clip(rgb * alpha[..., None], 0, 1)

        back_enc.stdin.write((back * 255).astype(np.uint8).tobytes())
        col_enc.stdin.write((obj * 255).astype(np.uint8).tobytes())
        msk_enc.stdin.write((alpha * 255).astype(np.uint8).tobytes())

        if i in shots:
            strip = np.concatenate([
                (rgb * 255).astype(np.uint8),
                (back * 255).astype(np.uint8),
                (obj * 255).astype(np.uint8),
                np.repeat((alpha * 255).astype(np.uint8)[..., None], 3, axis=2),
            ], axis=1)
            Image.fromarray(strip).save(prev_dir / f"split_{i:05d}.png")
        if i % 100 == 0:
            print(f"  분리 {i}/{n}", flush=True)

    for e in (back_enc, col_enc, msk_enc):
        e.stdin.close()
        e.wait()

    cov = sum(covered) / max(1, len(covered))
    print(f"\n완료: {WORK/'back.mkv'}, {WORK/'obj_color.mkv'}, {WORK/'obj_mask.mkv'}  ({len(covered)}프레임)")
    print(f"평균 오브젝트 면적 {cov * 100:.1f}%  (최소 {min(covered) * 100:.1f}% / 최대 {max(covered) * 100:.1f}%)")
    if a.cover > 0:
        g = np.array(relief_gain)
        print(f"임계값을 새로 잡은 컷 {cuts}회")
        print(f"오브젝트를 뽑은 프레임 {100 * float((g > 0.5).mean()):.0f}%, "
              f"깊이 대비가 없어 평면 영상으로 둔 프레임 {100 * float((g <= 0.5).mean()):.0f}%")
    if cov < 0.02:
        print("!! 거의 다 배경이다. --thresh 를 낮출 것")
    if cov > 0.7:
        print("!! 거의 다 오브젝트다. --thresh 를 올릴 것")
    if a.preview:
        print(f"확인용 {len(shots)}장 (원본 | 배경 | 오브젝트 | 마스크): {prev_dir}")
    print("다음: python src/depth.py ../work/obj_color.mkv --mask ../work/obj_mask.mkv --reuse")


if __name__ == "__main__":
    sys.exit(main())
