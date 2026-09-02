import argparse, json, pathlib, subprocess, sys

from fftool import ffmpeg, ffprobe

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = ROOT / "work"

OUT_W, OUT_H = 640, 360

IMG_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
VID_EXT = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}


def parse_res(t):
    w, h = t.lower().split("x")
    return int(w), int(h)


def probe(path):
    r = subprocess.run([ffprobe(), "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,r_frame_rate", "-show_entries", "format=duration",
                        "-of", "json", str(path)], capture_output=True, text=True, check=True)
    j = json.loads(r.stdout)
    s = j["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    dur = float(j.get("format", {}).get("duration", 0) or 0)
    return int(s["width"]), int(s["height"]), int(num) / int(den), dur


def write_map(fps, frames, chapters):
    body = json.dumps({"fps": fps, "frames": frames, "chapters": chapters}, indent=2)
    (WORK / "chapters.json").write_text(body + chr(10), encoding="utf-8")


def resolve(spec):
    p = pathlib.Path(spec)
    return p if p.is_absolute() or p.exists() else ROOT / "input" / spec


def plan(spec, count, at, dur, skip_head, skip_tail, clip_start):
    """챕터별로 쓸 (파일, 시작초)를 정한다."""
    p = resolve(spec)
    if not p.exists():
        raise SystemExit(f"{p} 없음")
    if p.is_dir():
        files = sorted(f for f in p.iterdir() if f.suffix.lower() in IMG_EXT | VID_EXT)
        if not files:
            raise SystemExit(f"{p} 안에 영상도 이미지도 없다")
        return [(files[i % len(files)], clip_start) for i in range(count)]
    if p.suffix.lower() in IMG_EXT:
        return [(p, 0.0)] * count
    total = probe(p)[3]
    if at:
        starts = [float(x) for x in at.split(",")]
    else:
        lo, hi = skip_head, total - skip_tail - dur
        span = max(0.0, hi - lo)
        starts = [lo + span * i / max(1, count - 1) for i in range(count)]
    return [(p, starts[i % len(starts)]) for i in range(count)]


def read_exact(src, start, nf, fps, w, h):
    """정확히 nf프레임을 rgb24로 읽는다. 모자라면 마지막 프레임을 늘린다."""
    cmd = [ffmpeg(), "-v", "error"]
    if src.suffix.lower() in IMG_EXT:
        cmd += ["-loop", "1", "-t", f"{nf / fps + 0.5:.3f}", "-i", str(src)]
    else:
        cmd += ["-ss", f"{start:.3f}", "-t", f"{nf / fps + 0.5:.3f}", "-i", str(src)]
    cmd += ["-vf", f"fps={fps},scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,"
                   f"crop={w}:{h}",
            "-frames:v", str(nf), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    out = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout
    fsz = w * h * 3
    got = len(out) // fsz
    if got == 0:
        raise SystemExit(f"{src.name} {start:.2f}s 에서 프레임을 못 읽음")
    out = out[:got * fsz]
    if got < nf:
        out += out[(got - 1) * fsz:] * (nf - got)
    return out, got


def encoder(path, w, h, fps):
    return subprocess.Popen(
        [ffmpeg(), "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-c:v", "ffv1", str(path)],
        stdin=subprocess.PIPE)


def build(name, steps, nf, fps, w, h):
    """챕터를 순서대로 이어붙여 하나의 무손실 mkv로."""
    enc = encoder(WORK / f"{name}.mkv", w, h, fps)
    for i, (src, st) in enumerate(steps):
        buf, got = read_exact(src, st, nf, fps, w, h)
        enc.stdin.write(buf)
        tail = "" if got >= nf else f"  (원본 {got}프레임, 마지막을 {nf - got}프레임 늘림)"
        print(f"  {name} {i + 1:>2}/{len(steps)}  {src.name} @{st:5.2f}s{tail}")
    enc.stdin.close()
    enc.wait()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video", nargs="?", help="옛 방식, 영상 하나를 통째로 쓸 때만")
    ap.add_argument("--back", default="", help="배경 소스. 파일 하나, 이미지, 또는 클립 디렉터리")
    ap.add_argument("--object", dest="obj", default="", help="오브젝트 소스. 같은 형식")
    ap.add_argument("--count", type=int, default=11, help="챕터 수")
    ap.add_argument("--dur", type=float, default=1.5, help="챕터당 초")
    ap.add_argument("--fps", type=float, default=24)
    ap.add_argument("--skip-head", type=float, default=2.0, help="앞부분 몇 초 건너뛸지")
    ap.add_argument("--skip-tail", type=float, default=3.0)
    ap.add_argument("--clip-start", type=float, default=0.0, help="디렉터리 모드에서 각 클립의 시작 초")
    ap.add_argument("--at", default="", help="쉼표로 구분한 시작 초, 주면 균등 배치 대신 이걸 씀")
    ap.add_argument("--res", default="640x360", help="오브젝트 절반 해상도. 배경은 이것의 2배")
    ap.add_argument("--split", action="store_true",
                    help="자르지 않고 이미 만들어진 work/color.mkv를 count개로 나눠 맵만 씀")
    a = ap.parse_args()

    global OUT_W, OUT_H
    OUT_W, OUT_H = parse_res(a.res)
    WORK.mkdir(parents=True, exist_ok=True)

    if a.split:
        n = int(subprocess.run([ffprobe(), "-v", "error", "-select_streams", "v:0",
                                "-count_frames", "-show_entries", "stream=nb_read_frames",
                                "-of", "csv=p=0", str(WORK / "color.mkv")],
                               capture_output=True, text=True, check=True).stdout.strip())
        edges = [round(n * i / a.count) for i in range(a.count + 1)]
        chapters = [{"in": edges[i], "out": edges[i + 1]} for i in range(a.count)]
        write_map(a.fps, n, chapters)
        print(f"{n}프레임을 {a.count}구간으로 나눔 (구간당 약 {n // a.count}프레임)")
        return

    if a.obj:
        nf = max(1, round(a.dur * a.fps))
        obj = plan(a.obj, a.count, a.at, a.dur, a.skip_head, a.skip_tail, a.clip_start)
        back = plan(a.back or a.obj, a.count, a.at, a.dur, a.skip_head, a.skip_tail, a.clip_start)
        print(f"챕터 {a.count}개 x {nf}프레임 @{a.fps:.0f}fps"
              f"  오브젝트 {OUT_W}x{OUT_H}, 배경 {OUT_W * 2}x{OUT_H * 2}")
        build("object", obj, nf, a.fps, OUT_W, OUT_H)
        build("back", back, nf, a.fps, OUT_W * 2, OUT_H * 2)
        total = nf * a.count
        write_map(a.fps, total, [{"in": i * nf, "out": (i + 1) * nf} for i in range(a.count)])
        print(f"\n완료: {WORK/'object.mkv'}, {WORK/'back.mkv'}  {total}프레임 {total / a.fps:.1f}초")
        print("다음: python src/matte.py")
        return

    if not a.video:
        raise SystemExit("--object 를 주거나, 옛 방식이면 원본 영상 경로를 줄 것")

    # 옛 방식: 영상 하나에서 구간만 잘라 trimmed.mkv
    src = resolve(a.video)
    w, h, sfps, dur = probe(src)
    print(f"원본 {w}x{h} {sfps:.2f}fps {dur:.1f}초 -> {OUT_W}x{OUT_H} {a.fps:.0f}fps")
    nf = max(1, round(a.dur * a.fps))
    steps = plan(a.video, a.count, a.at, a.dur, a.skip_head, a.skip_tail, a.clip_start)
    build("trimmed", steps, nf, a.fps, OUT_W, OUT_H)
    total = nf * len(steps)
    write_map(a.fps, total, [{"in": i * nf, "out": (i + 1) * nf} for i in range(len(steps))])
    print(f"\n완료: {WORK/'trimmed.mkv'}  {total}프레임 {total / a.fps:.1f}초")
    print("다음: python src/depth.py ../work/trimmed.mkv")


if __name__ == "__main__":
    sys.exit(main())
