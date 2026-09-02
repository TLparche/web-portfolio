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


def color_src():
    """split.py가 만든 오브젝트 컬러가 있으면 그걸 쓴다."""
    obj = WORK / "obj_color.mkv"
    return obj if obj.exists() else WORK / "color.mkv"


def layout():
    """배경 트랙이 있으면 3영역, 없으면 옛 위아래 2영역. 배경 크기로 배치를 고른다."""
    back = WORK / "back.mkv"
    color = color_src()
    if back.exists():
        w, h, _, _ = probe(color)
        bw, bh, _, _ = probe(back)
        if (bw, bh) == (w * 2, h * 2):
            # 배경이 오브젝트의 2배, 그 아래에 컬러와 깊이를 나란히
            return {
                "back": back,
                "color": color,
                "inputs": [back, color, WORK / "depth.mkv"],
                "filter": ("[2:v]format=gbrp[d];[1:v][d]hstack=inputs=2[bot];"
                           "[0:v][bot]vstack=inputs=2"),
                "rects": {
                    "backRect": [0.0, 0.0, 1.0, 2 / 3],
                    "colorRect": [0.0, 2 / 3, 0.5, 1.0],
                    "depthRect": [0.5, 2 / 3, 1.0, 1.0],
                },
            }
        if (bw, bh) == (w, h):
            # 셋 다 같은 크기, 세로 3단
            return {
                "back": back,
                "color": color,
                "inputs": [back, color, WORK / "depth.mkv"],
                "filter": "[2:v]format=gbrp[d];[0:v][1:v][d]vstack=inputs=3",
                "rects": {
                    "backRect": [0.0, 0.0, 1.0, 1 / 3],
                    "colorRect": [0.0, 1 / 3, 1.0, 2 / 3],
                    "depthRect": [0.0, 2 / 3, 1.0, 1.0],
                },
            }
        raise SystemExit(f"배경이 {bw}x{bh}인데 {w}x{h} 또는 {w * 2}x{h * 2}여야 한다")
    return {
        "back": None,
        "color": color,
        "inputs": [color, WORK / "depth.mkv"],
        "filter": "[1:v]format=gbrp[d];[0:v][d]vstack=inputs=2",
        "rects": {
            "colorRect": [0.0, 0.0, 1.0, 0.5],
            "depthRect": [0.0, 0.5, 1.0, 1.0],
        },
    }


def encode(lay, gop, crf, tag, out, name):
    w, h, frames, fps = probe(lay["color"])
    dst = out / f"{name}{tag}.mp4"
    out.mkdir(parents=True, exist_ok=True)
    args = [ffmpeg(), "-y", "-loglevel", "error"]
    for src in lay["inputs"]:
        args += ["-i", str(src)]
    args += [
        "-filter_complex", lay["filter"] + ",format=yuv420p[v]",
        "-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
        "-g", str(gop), "-keyint_min", str(gop), "-sc_threshold", "0",
        "-x264-params", "bframes=0" if gop == 1 else "bframes=2",
        "-movflags", "+faststart", str(dst)]
    subprocess.run(args, check=True)

    meta = dict(width=w, height=h, frames=frames, fps=fps, duration=frames / fps)
    if lay["back"]:
        bw, bh, _, _ = probe(lay["back"])
        meta.update(backWidth=bw, backHeight=bh)
    return dst, meta


def check(lay):
    """크기는 layout()이 보고, 여기서는 프레임 수가 셋 다 같은지만 본다."""
    w, h, n, _ = probe(lay["color"])
    dw, dh, dn, _ = probe(WORK / "depth.mkv")
    if (dw, dh) != (w, h):
        raise SystemExit(f"컬러 {w}x{h}와 깊이 {dw}x{dh}가 다르다")
    if dn != n:
        raise SystemExit(f"컬러 {n}프레임과 깊이 {dn}프레임이 다르다")
    if not lay["back"]:
        return
    bn = probe(lay["back"])[2]
    if bn != n:
        raise SystemExit(f"배경 {bn}프레임과 오브젝트 {n}프레임이 다르다")


def poster(lay, out, name):
    """첫 프레임만 작은 이미지로 뽑음."""
    dst = out / f"{name}-poster.webp"
    args = [ffmpeg(), "-y", "-loglevel", "error"]
    for src in lay["inputs"]:
        args += ["-i", str(src)]
    args += ["-filter_complex", lay["filter"] + "[v]", "-map", "[v]",
             "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", str(dst)]
    subprocess.run(args, check=True)
    return dst


def still(lay, out, name):
    """WebGL 못 쓰는 기기용 정지 이미지. 배경 위에 오브젝트를 합성한다."""
    dst = out / f"{name}-still.webp"
    mask = WORK / "obj_mask.mkv"
    if lay["back"] and mask.exists():
        bw, bh, _, _ = probe(lay["back"])
        subprocess.run([
            ffmpeg(), "-y", "-loglevel", "error",
            "-i", str(lay["back"]), "-i", str(lay["color"]), "-i", str(mask),
            "-filter_complex",
            f"[1:v]scale={bw}:{bh}[c];[2:v]scale={bw}:{bh},format=gray[m];"
            f"[c][m]alphamerge,unpremultiply=inplace=1[fg];[0:v][fg]overlay[v]",
            "-map", "[v]", "-frames:v", "1", "-c:v", "libwebp", "-quality", "80",
            str(dst)], check=True)
    else:
        subprocess.run([
            ffmpeg(), "-y", "-loglevel", "error", "-i", str(lay["color"]),
            "-frames:v", "1", "-c:v", "libwebp", "-quality", "80", str(dst)], check=True)
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--gop", type=int, default=1, help="1이면 전 프레임 키프레임, 올리면 용량이 준다")
    ap.add_argument("--compare", action="store_true", help="GOP별 용량 비교")
    ap.add_argument("--out", default="", help="비우면 public/bg, 실험할 때 다른 데로 뺄 것")
    ap.add_argument("--name", default="bg",
                    help="산출물 이름. 에셋을 여러 개 두고 골라 쓸 때 바꾼다")
    a = ap.parse_args()

    out = pathlib.Path(a.out) if a.out else OUT
    lay = layout()
    check(lay)
    print("배경 트랙 있음, 3영역 배치" if lay["back"] else "배경 트랙 없음, 옛 2영역 배치")

    gops = [1, 6, 12, 30] if a.compare else [a.gop]
    meta = None
    for g in gops:
        tag = ("" if g == 1 else f"-gop{g}") if a.compare else ""
        dst, meta = encode(lay, g, a.crf, tag, out, a.name)
        mb = dst.stat().st_size / 1e6
        per_s = mb / meta["duration"]
        print(f"  GOP {g:>2}  {mb:6.2f} MB   ({per_s:.2f} MB/s 영상)")

    pdst = poster(lay, out, a.name)
    print(f"  포스터   {pdst.stat().st_size / 1e3:6.1f} KB")
    sdst = still(lay, out, a.name)
    print(f"  스틸     {sdst.stat().st_size / 1e3:6.1f} KB")

    # segments.py가 만든 챕터 구간이 있으면 같이 넣음
    chapters = None
    cpath = WORK / "chapters.json"
    if cpath.exists():
        chapters = json.loads(cpath.read_text(encoding="utf-8"))["chapters"]
        print(f"  챕터 구간 {len(chapters)}개 포함")

    (out / f"{a.name}.json").write_text(json.dumps({
        "video": f"{a.name}.mp4",
        "poster": f"{a.name}-poster.webp",
        "still": f"{a.name}-still.webp",
        "chapters": chapters,
        **lay["rects"],
        **meta,
    }, indent=2) + "\n", encoding="utf-8")
    size = f"{meta['width']}x{meta['height']}"
    if lay["back"]:
        size += f", 배경 {meta['backWidth']}x{meta['backHeight']}"
    print(f"\n오브젝트 {size}, {meta['frames']}프레임, {meta['duration']:.1f}초")


if __name__ == "__main__":
    main()
