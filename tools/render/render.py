"""Render the Remotion video silently, then mux the mixed audio into the final mp4."""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_TEMPLATES = Path(__file__).resolve().parents[2] / "templates"


class RenderError(Exception):
    pass


def durations_to_frames(manifest: dict, fps: int = 30) -> dict[int, int]:
    # round(…, 6) guards against float noise such as 2.1 * 30 = 63.00000000000001
    return {s["id"]: math.ceil(round(s["duration_s"] * fps, 6)) for s in manifest["scenes"]}


def validate_scene_timing(scenes_json: dict, manifest: dict) -> list[str]:
    fps = scenes_json.get("fps", 30)
    expected = durations_to_frames(manifest, fps)
    problems = []
    seen = set()
    for s in scenes_json.get("scenes", []):
        seen.add(s["id"])
        if s["id"] not in expected:
            problems.append(f"scene {s['id']}: not in voice manifest")
        elif abs(s["durationInFrames"] - expected[s["id"]]) > 1:
            problems.append(f"scene {s['id']}: {s['durationInFrames']} frames, "
                            f"voice needs {expected[s['id']]}")
    for sid in expected:
        if sid not in seen:
            problems.append(f"scene {sid}: missing from scenes.json")
    return problems


def _run(cmd: list[str], cwd: Path, what: str) -> None:
    try:
        r = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
    except OSError as e:
        raise RenderError(f"{what} could not start: {e}") from e
    if r.returncode != 0:
        tail = "\n".join((r.stderr or r.stdout or "").splitlines()[-20:])
        raise RenderError(f"{what} failed (exit {r.returncode}):\n{tail}")


def render_video(run_dir: Path, templates_dir: Path) -> Path:
    run_dir, templates_dir = Path(run_dir), Path(templates_dir)
    scenes_path = (run_dir / "04-video" / "scenes.json").resolve()
    manifest = json.loads((run_dir / "02-voice" / "manifest.json").read_text(encoding="utf-8"))
    scenes = json.loads(scenes_path.read_text(encoding="utf-8"))
    problems = validate_scene_timing(scenes, manifest)
    if problems:
        raise RenderError("scene timing does not match the voice:\n" + "\n".join(problems))
    mix = run_dir / "04-video" / "audio" / "mix.wav"
    if not mix.exists():
        raise RenderError(f"mix not found: {mix} (run tools.audio.mix first)")
    npm, ffmpeg = shutil.which("npm"), shutil.which("ffmpeg")
    if not npm:
        raise RenderError("npm not found on PATH")
    if not ffmpeg:
        raise RenderError("ffmpeg not found on PATH")

    out_dir = (run_dir / "04-video" / "out").resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    silent, final = out_dir / "silent.mp4", out_dir / "video.mp4"
    _run([npm, "run", "render", "--", str(silent), f"--props={scenes_path}"],
         templates_dir, "remotion render")
    _run([ffmpeg, "-y", "-i", str(silent), "-i", str(mix.resolve()), "-map", "0:v:0",
          "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
          str(final)], run_dir, "ffmpeg mux")
    silent.unlink(missing_ok=True)
    return final


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="tools.render.render")
    ap.add_argument("run_dir", type=Path)
    ap.add_argument("--templates-dir", type=Path, default=DEFAULT_TEMPLATES)
    args = ap.parse_args(argv)
    try:
        out = render_video(args.run_dir, args.templates_dir)
    except RenderError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(f"video written: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
