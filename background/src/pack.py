import argparse, json, pathlib, subprocess

from fftool import ffmpeg, ffprobe

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = ROOT / "work"
OUT = ROOT.parent / "public" / "bg"


def probe(path):
    # ffv1/mkv은 nb_frames가 없어서 직접 셈
    r = subprocess.run([ffprobe(), "-v", "error", "-select_streams", "v:0", "-count_frames",
                        "-show_entries", "stream=width,height,nb_read_frames,r_frame_rate",
                        "-of", "json", str(path)], capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), int(s["nb_read_frames"]), int(num) / int(den)


def encode(gop, crf, tag):
    w, h, frames, fps = probe(WORK / "color.mkv")
    dst = OUT / f"bg{tag}.mp4"
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        ffmpeg(), "-y", "-loglevel", "error",
        "-i", str(WORK / "color.mkv"), "-i", str(WORK / "depth.mkv"),
        "-filter_complex", "[1:v]format=gbrp[d];[0:v][d]vstack=inputs=2,format=yuv420p[v]",
        "-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
        "-g", str(gop), "-keyint_min", str(gop), "-sc_threshold", "0",
        "-x264-params", "bframes=0" if gop == 1 else "bframes=2",
        "-movflags", "+faststart", str(dst)], check=True)
    return dst, dict(width=w, height=h, frames=frames, fps=fps, duration=frames / fps)


def poster(crf):
    """첫 프레임만 작은 이미지로 뽑음."""
    dst = OUT / "bg-poster.webp"
    subprocess.run([
        ffmpeg(), "-y", "-loglevel", "error",
        "-i", str(WORK / "color.mkv"), "-i", str(WORK / "depth.mkv"),
        "-filter_complex", "[1:v]format=gbrp[d];[0:v][d]vstack=inputs=2[v]",
        "-map", "[v]", "-frames:v", "1", "-c:v", "libwebp", "-quality", "82",
        str(dst)], check=True)
    return dst


def still(crf):
    """컬러 전용 스틸, 깊이 절반은 안 넣음."""
    dst = OUT / "bg-still.webp"
    subprocess.run([
        ffmpeg(), "-y", "-loglevel", "error", "-i", str(WORK / "color.mkv"),
        "-frames:v", "1", "-c:v", "libwebp", "-quality", "80", str(dst)], check=True)
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--gop", type=int, default=1, help="1이면 전 프레임 키프레임, 올리면 용량이 준다")
    ap.add_argument("--compare", action="store_true", help="GOP별 용량 비교")
    a = ap.parse_args()

    gops = [1, 6, 12, 30] if a.compare else [a.gop]
    meta = None
    for g in gops:
        tag = "" if g == 1 else f"-gop{g}"
        dst, meta = encode(g, a.crf, tag)
        mb = dst.stat().st_size / 1e6
        per_s = mb / meta["duration"]
        print(f"  GOP {g:>2}  {mb:6.2f} MB   ({per_s:.2f} MB/s 영상)")

    pdst = poster(a.crf)
    print(f"  포스터   {pdst.stat().st_size / 1e3:6.1f} KB")
    sdst = still(a.crf)
    print(f"  스틸     {sdst.stat().st_size / 1e3:6.1f} KB")

    (OUT / "bg.json").write_text(json.dumps({
        "video": "bg.mp4",
        "poster": "bg-poster.webp",
        "still": "bg-still.webp",
        "colorRect": [0.0, 0.0, 1.0, 0.5],
        "depthRect": [0.0, 0.5, 1.0, 1.0],
        **meta,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"\n각 절반 {meta['width']}x{meta['height']}, {meta['frames']}프레임, {meta['duration']:.1f}초")


if __name__ == "__main__":
    main()
