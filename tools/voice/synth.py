"""Per-scene narration synthesis: python -m tools.voice.synth <run_dir> [--script <path>]."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf

from tools.pipeline.script import parse_script
from tools.voice.engine import TTSEngine, get_engine

PAD_S = 0.4
DEFAULT_VOICE = "am_adam"  # male, chosen by the owner to match the presenter


def _wav_name(scene_id: int) -> str:
    return f"scene-{scene_id:02d}.wav"


def synth_scenes(
    script_path: Path,
    out_dir: Path,
    engine: TTSEngine,
    voice: str = DEFAULT_VOICE,
    speed: float = 1.0,
    only: list[int] | None = None,
    language: str = "en",
) -> dict:
    script = parse_script(Path(script_path))
    out_dir = Path(out_dir)
    if only is not None:
        ids = {s.id for s in script.scenes}
        unknown = set(only) - ids
        if unknown:
            raise ValueError(f"Unknown scene ids: {sorted(unknown)}")
        missing = [s.id for s in script.scenes
                   if s.id not in only and not (out_dir / _wav_name(s.id)).exists()]
        if missing or not (out_dir / "manifest.json").exists():
            raise ValueError(
                "`only` needs an existing recording of the other scenes "
                f"(missing: {missing or 'manifest.json'}); run without --only first"
            )
    out_dir.mkdir(parents=True, exist_ok=True)

    entries = []
    for scene in script.scenes:
        path = out_dir / _wav_name(scene.id)
        if only is not None and scene.id not in only:
            info = sf.info(str(path))
            duration = info.frames / info.samplerate
        else:
            audio = np.asarray(engine.synth(scene.narration, voice, speed), dtype=np.float32)
            pad = np.zeros(int(round(PAD_S * engine.sample_rate)), dtype=np.float32)
            audio = np.concatenate([audio, pad])
            sf.write(str(path), audio, engine.sample_rate)
            duration = len(audio) / engine.sample_rate
        entries.append({"id": scene.id, "file": path.name, "duration_s": round(duration, 3)})

    manifest = {
        "language": language,
        "engine": engine.name,
        "voice": voice,
        "speed": speed,
        "sample_rate": engine.sample_rate,
        "scenes": entries,
        "total_s": round(sum(e["duration_s"] for e in entries), 3),
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Synthesise narration per scene")
    p.add_argument("run_dir", type=Path)
    p.add_argument("--voice", default=DEFAULT_VOICE)
    p.add_argument("--speed", type=float, default=1.0)
    p.add_argument("--only", default=None, help="comma-separated scene ids, e.g. 2,4")
    p.add_argument("--language", default="en")
    p.add_argument("--script", type=Path, default=None,
                   help="script to read narration from (default: <run_dir>/01-script/script.md)")
    a = p.parse_args(argv)
    only = [int(x) for x in a.only.split(",")] if a.only else None
    engine = get_engine("kokoro", a.language, a.voice)
    script = a.script if a.script is not None else a.run_dir / "01-script" / "script.md"
    m = synth_scenes(script, a.run_dir / "02-voice",
                     engine, a.voice, a.speed, only, a.language)
    print(f"Wrote {len(m['scenes'])} scenes, {m['total_s']} s total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
