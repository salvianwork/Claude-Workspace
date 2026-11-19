"""Mouth-movement data: per-video-frame openness (0..1) from narration loudness."""
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

DB_CLOSED = -45.0
DB_OPEN = -12.0


def mouth_envelope(samples: np.ndarray, sr: int, n_frames: int, fps: int = 30) -> list[float]:
    x = np.asarray(samples, dtype=np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    audio_frames = int(len(x) / sr * fps)
    vals = np.zeros(audio_frames)
    for i in range(audio_frames):
        a = int(round(i * sr / fps))
        b = int(round((i + 1) * sr / fps))
        seg = x[a:b]
        rms = float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0
        db = 20 * np.log10(max(rms, 1e-10))
        vals[i] = min(1.0, max(0.0, (db - DB_CLOSED) / (DB_OPEN - DB_CLOSED)))
    if audio_frames:
        smooth = np.empty(audio_frames)
        for i in range(audio_frames):
            smooth[i] = vals[max(0, i - 1): i + 2].mean()
        vals = smooth
    out = [round(float(v), 2) for v in vals][:n_frames]
    out += [0.0] * (n_frames - len(out))
    return out


def add_mouth_to_scenes(run_dir: Path) -> None:
    run_dir = Path(run_dir)
    manifest = json.loads((run_dir / "02-voice" / "manifest.json").read_text(encoding="utf-8"))
    files = {s["id"]: s["file"] for s in manifest["scenes"]}
    path = run_dir / "04-video" / "scenes.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    fps = data.get("fps", 30)
    for scene in data["scenes"]:
        sid = scene["id"]
        if sid not in files:
            raise ValueError(f"scene {sid} not found in voice manifest")
        wav = run_dir / "02-voice" / files[sid]
        if not wav.exists():
            raise ValueError(f"scene {sid}: wav file missing ({files[sid]})")
        samples, sr = sf.read(str(wav), dtype="float32")
        scene["mouth"] = mouth_envelope(samples, sr, int(scene["durationInFrames"]), fps)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print("usage: python -m tools.voice.mouth <run_dir>")
        return 2
    try:
        add_mouth_to_scenes(Path(argv[0]))
        n = len(json.loads((Path(argv[0]) / "04-video" / "scenes.json").read_text(encoding="utf-8"))["scenes"])
    except ValueError as e:
        print(f"error: {e}")
        return 1
    print(f"mouth data added to {n} scenes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
