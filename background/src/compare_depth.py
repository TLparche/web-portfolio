import argparse, pathlib, subprocess

import numpy as np

from fftool import ffmpeg

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORK = ROOT / "work"
W, H = 640, 360


def read_gray(path):
    proc = subprocess.run(
        [ffmpeg(), "-v", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        stdout=subprocess.PIPE, check=True)
    a = np.frombuffer(proc.stdout, np.uint8)
    return a.reshape(-1, H, W).astype(np.float32) / 255.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("truth", nargs="?", default="depth_truth.mkv")
    ap.add_argument("est", nargs="?", default="depth.mkv")
    a = ap.parse_args()
    truth = read_gray(WORK / a.truth)
    est = read_gray(WORK / a.est)
    n = min(len(truth), len(est))
    truth, est = truth[:n], est[:n]
    print(f"프레임 {n}개\n")

    # 시간 방향 변화량, 정답 대비 초과분이 떨림
    dt = np.abs(np.diff(truth, axis=0)).mean()
    de = np.abs(np.diff(est, axis=0)).mean()
    print("시간 변화량 (0~1 스케일, 프레임당 픽셀 평균)")
    print(f"  정답   {dt:.5f}   <- 전부 실제 움직임")
    print(f"  추정   {de:.5f}   <- 실제 움직임 + 떨림")
    print(f"  비율   {de / dt:.2f}x\n")

    # 안 움직이는 영역의 변화량은 통째로 떨림
    still = truth.std(axis=0) < 0.01
    if still.sum() > 0:
        se = np.abs(np.diff(est, axis=0))[:, still].mean()
        print(f"정지 영역 떨림 (전체 화소의 {100 * still.mean():.0f}%)")
        print(f"  추정   {se:.5f}  =  8비트로 {se * 255:.2f}단계/프레임\n")

    # 공간적으로 얼마나 맞는지
    cors = [np.corrcoef(truth[i].ravel(), est[i].ravel())[0, 1] for i in range(0, n, 10)]
    print(f"정답과의 상관 {np.mean(cors):.3f} (최소 {np.min(cors):.3f})")


if __name__ == "__main__":
    main()
