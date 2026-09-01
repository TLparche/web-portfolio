import shutil, subprocess


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg를 못 찾음. uv pip install imageio-ffmpeg")
    return exe


def ffprobe():
    exe = shutil.which("ffprobe")
    if not exe:
        raise RuntimeError("ffprobe를 못 찾음")
    return exe


def has_x264():
    out = subprocess.run([ffmpeg(), "-hide_banner", "-encoders"],
                         capture_output=True, text=True).stdout
    return "libx264" in out
