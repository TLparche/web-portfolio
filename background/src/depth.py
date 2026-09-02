import argparse, pathlib, subprocess, sys

import numpy as np

from fftool import ffmpeg, ffprobe

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = ROOT / "work"

OUT_W, OUT_H = 640, 360
MODEL = "depth-anything/Depth-Anything-V2-Base-hf"

# 마스크 안쪽 깊이의 하한, 0은 "배경, 그리지 않음" 표시로 예약
FLOOR = 0.15


def resolve(name):
    p = pathlib.Path(name)
    return p if p.exists() else ROOT / "input" / p.name


def probe(path):
    import json
    r = subprocess.run([ffprobe(), "-v", "error", "-select_streams", "v:0", "-count_frames",
                        "-show_entries", "stream=width,height,nb_read_frames,r_frame_rate",
                        "-of", "json", str(path)], capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), int(s["nb_read_frames"]), int(num) / int(den)


def frames(path, w, h):
    """원본을 출력 해상도로 줄여서 RGB 프레임을 흘려보냄."""
    proc = subprocess.Popen(
        [ffmpeg(), "-v", "error", "-i", str(path), "-vf", f"scale={w}:{h}:flags=lanczos",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    size = w * h * 3
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    proc.stdout.close()
    proc.wait()


def masks(path, w, h):
    """마스크를 0~1 회색 프레임으로 흘려보냄."""
    proc = subprocess.Popen(
        [ffmpeg(), "-v", "error", "-i", str(path), "-vf", f"scale={w}:{h}:flags=bilinear",
         "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    size = w * h
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w).astype(np.float32) / 255.0
    proc.stdout.close()
    proc.wait()


def encoder(path, w, h, fps, gray):
    return subprocess.Popen(
        [ffmpeg(), "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray" if gray else "rgb24",
         "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-c:v", "ffv1", str(path)],
        stdin=subprocess.PIPE)


def norm_range(raw, idx, maskpath, gate):
    """정규화 구간을 잡는다. 마스크가 있으면 오브젝트 픽셀만 본다."""
    step = max(1, idx // 60)
    if not maskpath:
        return np.percentile(raw[:idx][::step][:60], [1.0, 99.0])
    vals = []
    for i, m in enumerate(masks(maskpath, OUT_W, OUT_H)):
        if i >= idx:
            break
        if i % step or len(vals) >= 60:
            continue
        sel = np.asarray(raw[i])[m > gate]
        if sel.size:
            vals.append(sel)
    if not vals:
        raise SystemExit("마스크가 전부 비어있다. matte.py 결과를 확인할 것")
    return np.percentile(np.concatenate(vals), [1.0, 99.0])


def write_depth(raw, idx, fps, ema, maskpath, gate):
    """정규화 후 시간 EMA를 걸어 인코딩. 마스크 밖은 0으로 비운다."""
    lo, hi = norm_range(raw, idx, maskpath, gate)
    print(f"정규화 구간: {lo:.3f} ~ {hi:.3f}" + ("  (마스크 안쪽만)" if maskpath else "  (전역)"))

    enc = encoder(WORK / "depth.mkv", OUT_W, OUT_H, fps, gray=True)
    src = masks(maskpath, OUT_W, OUT_H) if maskpath else None
    prev = None
    was_on = None
    for i in range(idx):
        d = np.clip((np.asarray(raw[i]) - lo) / max(hi - lo, 1e-6), 0, 1)
        if src is None:
            prev = d if prev is None else prev * ema + d * (1 - ema)
            enc.stdin.write((prev * 255).astype(np.uint8).tobytes())
            continue

        m = next(src, None)
        if m is None:
            break
        on = m > gate
        if prev is None:
            prev = d
        else:
            # 이번에 새로 덮인 픽셀은 직전 값이 배경이라 EMA를 걸지 않는다
            prev = np.where(on & ~was_on, d, prev * ema + d * (1 - ema))
        was_on = on
        out = np.where(on, FLOOR + prev * (1.0 - FLOOR), 0.0)
        enc.stdin.write((out * 255).astype(np.uint8).tobytes())
    enc.stdin.close()
    enc.wait()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video", help="background/input/ 안의 원본, 또는 work/obj_color.mkv")
    ap.add_argument("--mask", default="", help="matte.py가 만든 마스크, 주면 오브젝트만 깊이를 남긴다")
    ap.add_argument("--mask-gate", type=float, default=0.5, help="이 값 위를 오브젝트로 본다")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--ema", type=float, default=0.6, help="시간 스무딩 강도 0~1, 클수록 부드럽고 뭉갬")
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--res", default="", help="비우면 입력 해상도를 그대로 씀")
    ap.add_argument("--keep-raw", action="store_true", help="원시 깊이를 남긴다, ema 재튜닝용")
    ap.add_argument("--reuse", action="store_true", help="남아있는 원시 깊이를 재사용해 추론을 건너뛴다")
    a = ap.parse_args()

    global OUT_W, OUT_H
    maskpath = resolve(a.mask) if a.mask else None

    rawpath = WORK / "depth_raw.npy"
    if a.reuse and rawpath.exists():
        raw = np.load(rawpath, mmap_mode="r")
        idx = len(raw)
        OUT_H, OUT_W = raw.shape[1], raw.shape[2]
        print(f"원시 깊이 재사용: {idx}프레임, 추론 건너뜀")
        _, _, _, fps = probe(resolve(a.video))
        write_depth(raw, idx, fps, a.ema, maskpath, a.mask_gate)
        print(f"완료: {WORK/'depth.mkv'}  (ema {a.ema})")
        return

    src = resolve(a.video)
    w, h, n, fps = probe(src)

    if a.res:
        OUT_W, OUT_H = (int(x) for x in a.res.lower().split("x"))
    else:
        OUT_W, OUT_H = w, h
    print(f"원본 {w}x{h} {n}프레임 {fps:.2f}fps -> {OUT_W}x{OUT_H}")

    import torch
    from transformers import pipeline

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"장치: {dev}, 모델: {a.model}")
    est = pipeline("depth-estimation", model=a.model, device=0 if dev == "cuda" else -1)

    WORK.mkdir(parents=True, exist_ok=True)
    raw = np.lib.format.open_memmap(rawpath, mode="w+",
                                    dtype=np.float32, shape=(n, OUT_H, OUT_W))

    # 색 저장하면서 깊이는 원시값으로 받아둠
    from PIL import Image
    col_enc = encoder(WORK / "color.mkv", OUT_W, OUT_H, fps, gray=False)
    batch, idx = [], 0
    def flush():
        nonlocal batch, idx
        if not batch:
            return
        preds = est([Image.fromarray(f) for f in batch])
        if isinstance(preds, dict):
            preds = [preds]
        for pr in preds:
            d = pr["predicted_depth"]
            if hasattr(d, "detach"):
                d = d.detach().cpu().numpy()
            d = np.asarray(d, np.float32)
            while d.ndim > 2:
                d = d[0]
            if d.shape != (OUT_H, OUT_W):
                d = np.asarray(Image.fromarray(d).resize((OUT_W, OUT_H), Image.BILINEAR), np.float32)
            raw[idx] = d
            idx += 1
        batch = []

    for i, f in enumerate(frames(src, OUT_W, OUT_H)):
        if i >= n:
            break
        col_enc.stdin.write(f.tobytes())
        batch.append(f)
        if len(batch) >= a.batch:
            flush()
            print(f"  깊이 {idx}/{n}", flush=True)
    flush()
    col_enc.stdin.close()
    col_enc.wait()

    write_depth(raw, idx, fps, a.ema, maskpath, a.mask_gate)

    # 윈도우는 매핑 남아있으면 삭제가 막힘
    raw.flush()
    raw._mmap.close()
    del raw
    if a.keep_raw:
        print(f"원시 깊이 남김: {rawpath.name} (--reuse로 ema만 다시 걸 수 있음)")
    else:
        rawpath.unlink()
    print(f"완료: {WORK/'color.mkv'}, {WORK/'depth.mkv'}  ({idx}프레임)")
    print("다음: python src/pack.py")


if __name__ == "__main__":
    sys.exit(main())
