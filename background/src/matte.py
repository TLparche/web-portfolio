import argparse, json, pathlib, subprocess, sys

import numpy as np

from fftool import ffmpeg, ffprobe

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = ROOT / "work"


def probe(path):
    r = subprocess.run([ffprobe(), "-v", "error", "-select_streams", "v:0", "-count_frames",
                        "-show_entries", "stream=width,height,nb_read_frames,r_frame_rate,pix_fmt",
                        "-of", "json", str(path)], capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), int(s["nb_read_frames"]), int(num) / int(den), s["pix_fmt"]


def frames(path, w, h, chans):
    """rgb24 또는 rgba로 프레임을 흘려보냄."""
    proc = subprocess.Popen(
        [ffmpeg(), "-v", "error", "-i", str(path), "-f", "rawvideo",
         "-pix_fmt", "rgba" if chans == 4 else "rgb24", "-"], stdout=subprocess.PIPE)
    size = w * h * chans
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, chans)
    proc.stdout.close()
    proc.wait()


def encoder(path, w, h, fps, gray):
    return subprocess.Popen(
        [ffmpeg(), "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray" if gray else "rgb24",
         "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-c:v", "ffv1", str(path)],
        stdin=subprocess.PIPE)


def smoothstep(lo, hi, x):
    t = np.clip((x - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def boxblur(a, r):
    """분리형 박스 블러 2회, 대략 가우시안."""
    if r < 1:
        return a
    k = 2 * r + 1
    for _ in range(2):
        pad = np.pad(a, ((r, r), (0, 0)), mode="edge")
        c = np.cumsum(pad, axis=0)
        a = (c[k - 1:] - np.concatenate([np.zeros((1, a.shape[1]), np.float32), c[:-k]])) / k
        pad = np.pad(a, ((0, 0), (r, r)), mode="edge")
        c = np.cumsum(pad, axis=1)
        a = (c[:, k - 1:] - np.concatenate([np.zeros((a.shape[0], 1), np.float32), c[:, :-k]], axis=1)) / k
    return a.astype(np.float32)


def luma_key(rgb, lo, hi):
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    return smoothstep(lo, hi, lum)


def color_key(rgb, key, tol, soft):
    d = np.sqrt(((rgb - key) ** 2).sum(-1)) / np.sqrt(3.0)
    return smoothstep(tol, tol + soft, d)


def despill(rgb, key):
    """키 색이 가장 센 채널을 나머지 둘의 최대치까지 눌러 테두리 물듦 제거."""
    ch = int(np.argmax(key))
    rest = np.delete(rgb, ch, axis=-1).max(-1)
    out = rgb.copy()
    out[..., ch] = np.minimum(out[..., ch], rest)
    return out


class Rmbg:
    """배경제거 모델. 원격 코드를 받아 실행하므로 명시적으로 골랐을 때만 쓴다."""

    def __init__(self, name, size):
        import torch
        from transformers import AutoModelForImageSegmentation
        self.torch = torch
        self.size = size
        self.dev = "cuda" if torch.cuda.is_available() else "cpu"
        self.net = AutoModelForImageSegmentation.from_pretrained(name, trust_remote_code=True)
        self.net.to(self.dev).eval()
        print(f"매팅 모델 {name}, 장치 {self.dev}")

    def alpha(self, rgb):
        torch = self.torch
        h, w = rgb.shape[:2]
        t = torch.from_numpy(rgb).permute(2, 0, 1)[None]
        t = torch.nn.functional.interpolate(t, size=(self.size, self.size), mode="bilinear")
        t = ((t - 0.5) / 1.0).to(self.dev)
        with torch.no_grad():
            out = self.net(t)
        while isinstance(out, (list, tuple)):
            out = out[0]
        out = torch.nn.functional.interpolate(out, size=(h, w), mode="bilinear")
        a = out[0, 0].float().cpu().numpy()
        lo, hi = a.min(), a.max()
        return ((a - lo) / max(hi - lo, 1e-6)).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video", nargs="?", default=str(WORK / "object.mkv"))
    ap.add_argument("--key", default="auto", choices=["auto", "alpha", "luma", "color", "model"])
    ap.add_argument("--lo", type=float, default=0.05, help="luma 키 하한, 이 밑은 완전 배경")
    ap.add_argument("--hi", type=float, default=0.20, help="luma 키 상한, 이 위는 완전 오브젝트")
    ap.add_argument("--color", default="00b140", help="color 키 색 RRGGBB")
    ap.add_argument("--tol", type=float, default=0.16)
    ap.add_argument("--soft", type=float, default=0.10)
    ap.add_argument("--feather", type=int, default=1, help="마스크 가장자리 블러 반경 px")
    ap.add_argument("--shrink", type=float, default=0.0, help="마스크를 0~1만큼 안쪽으로 조임")
    ap.add_argument("--model", default="briaai/RMBG-1.4")
    ap.add_argument("--model-size", type=int, default=1024)
    ap.add_argument("--preview", type=int, default=0, help="확인용 프레임 N장을 work/preview/에 저장")
    a = ap.parse_args()

    src = pathlib.Path(a.video)
    w, h, n, fps, pix = probe(src)

    key = a.key
    if key == "auto":
        key = "alpha" if ("a" in pix and pix != "gray") else "luma"
    print(f"{src.name}  {w}x{h} {n}프레임 {fps:.2f}fps  pix_fmt={pix}  ->  키 방식 {key}")

    net = Rmbg(a.model, a.model_size) if key == "model" else None
    kc = np.array([int(a.color[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32) if key == "color" else None

    WORK.mkdir(parents=True, exist_ok=True)
    col_enc = encoder(WORK / "obj_color.mkv", w, h, fps, gray=False)
    msk_enc = encoder(WORK / "obj_mask.mkv", w, h, fps, gray=True)

    prev_dir = WORK / "preview"
    if a.preview:
        prev_dir.mkdir(exist_ok=True)
        for old in prev_dir.glob("*.png"):
            old.unlink()
    shots = set(round(i * (n - 1) / max(1, a.preview - 1)) for i in range(a.preview)) if a.preview else set()

    covered = []
    for i, f in enumerate(frames(src, w, h, 4 if key == "alpha" else 3)):
        rgb = f[..., :3].astype(np.float32) / 255.0
        if key == "alpha":
            alpha = f[..., 3].astype(np.float32) / 255.0
        elif key == "luma":
            alpha = luma_key(rgb, a.lo, a.hi)
        elif key == "color":
            alpha = color_key(rgb, kc, a.tol, a.soft)
            rgb = despill(rgb, kc)
        else:
            alpha = net.alpha(rgb)

        if a.shrink > 0:
            alpha = np.clip((alpha - a.shrink) / max(1.0 - a.shrink, 1e-6), 0, 1)
        alpha = boxblur(alpha, a.feather)
        covered.append(float(alpha.mean()))

        # 컬러는 알파를 곱해서 저장, 배경은 완전 검정
        col_enc.stdin.write((np.clip(rgb * alpha[..., None], 0, 1) * 255).astype(np.uint8).tobytes())
        msk_enc.stdin.write((alpha * 255).astype(np.uint8).tobytes())

        if i in shots:
            from PIL import Image
            side = np.concatenate([(np.clip(rgb * alpha[..., None], 0, 1) * 255).astype(np.uint8),
                                   np.repeat((alpha * 255).astype(np.uint8)[..., None], 3, axis=2)], axis=1)
            Image.fromarray(side).save(prev_dir / f"matte_{i:04d}.png")
        if i % 60 == 0:
            print(f"  매팅 {i}/{n}", flush=True)

    col_enc.stdin.close()
    col_enc.wait()
    msk_enc.stdin.close()
    msk_enc.wait()

    cov = sum(covered) / max(1, len(covered))
    print(f"\n완료: {WORK/'obj_color.mkv'}, {WORK/'obj_mask.mkv'}  ({len(covered)}프레임)")
    print(f"평균 오브젝트 면적 {cov * 100:.1f}%  (최소 {min(covered) * 100:.1f}% / 최대 {max(covered) * 100:.1f}%)")
    if cov < 0.01:
        print("!! 거의 다 배경으로 잘렸다. --lo/--hi 를 낮추거나 --key 를 바꿀 것")
    if cov > 0.85:
        print("!! 거의 다 오브젝트로 남았다. 배경이 충분히 어둡거나 단색인지 확인할 것")
    if a.preview:
        print(f"확인용 {len(shots)}장: {prev_dir}")
    print("다음: python src/depth.py ../work/obj_color.mkv --mask ../work/obj_mask.mkv")


if __name__ == "__main__":
    sys.exit(main())
