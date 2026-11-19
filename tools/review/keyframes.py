"""Extract evenly spaced keyframes from a video with ffmpeg."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def extract_keyframes(video: Path, out_dir: Path, every_s: float = 2.0) -> list[Path]:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise RuntimeError("ffmpeg not found on PATH")
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = out_dir / "frame-%04d.png"
    subprocess.run(
        [ffmpeg, "-y", "-i", str(video), "-vf", f"fps=1/{every_s}", str(pattern)],
        check=True, capture_output=True)
    return sorted(out_dir.glob("frame-*.png"))
