"""Render the video silently, then mux the mixed audio into the final mp4.

    python -m tools.render.render <run_dir> [--engine hyperframes|remotion] [--workers N]
                                  [--allow-hero-count] [--templates-dir DIR]

hyperframes (default): tools.hf.build (04-video/hf/, hyperframes check) -> tools.hf.render ->
04-video/out/silent.mp4. remotion: 04-video/scenes.json -> templates/ (npm run render). Both
then mux 04-video/audio/mix.wav into 04-video/out/video.mp4 and delete silent.mp4.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_TEMPLATES = Path(__file__).resolve().parents[2] / "templates"
ENGINES = ("hyperframes", "remotion")


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


def _tools(*names: str) -> dict[str, str]:
    found = {}
    for name in names:
        path = shutil.which(name)
        if not path:
            raise RenderError(f"{name} not found on PATH")
        found[name] = path
    return found


def _mix(run_dir: Path) -> Path:
    mix = run_dir / "04-video" / "audio" / "mix.wav"
    if not mix.exists():
        raise RenderError(f"mix not found: {mix} (run tools.audio.mix first)")
    return mix


def _mux(ffmpeg: str, silent: Path, mix: Path, final: Path, run_dir: Path) -> Path:
    _run([ffmpeg, "-y", "-i", str(silent), "-i", str(mix.resolve()), "-map", "0:v:0",
          "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
          str(final)], run_dir, "ffmpeg mux")
    silent.unlink(missing_ok=True)
    return final


def _render_remotion(run_dir: Path, templates_dir: Path) -> Path:
    scenes_path = (run_dir / "04-video" / "scenes.json").resolve()
    manifest = json.loads((run_dir / "02-voice" / "manifest.json").read_text(encoding="utf-8"))
    scenes = json.loads(scenes_path.read_text(encoding="utf-8"))
    problems = validate_scene_timing(scenes, manifest)
    if problems:
        raise RenderError("scene timing does not match the voice:\n" + "\n".join(problems))
    mix = _mix(run_dir)
    tools = _tools("npm", "ffmpeg")
    out_dir = (run_dir / "04-video" / "out").resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    silent, final = out_dir / "silent.mp4", out_dir / "video.mp4"
    _run([tools["npm"], "run", "render", "--", str(silent), f"--props={scenes_path}"],
         templates_dir, "remotion render")
    return _mux(tools["ffmpeg"], silent, mix, final, run_dir)


def _render_hyperframes(run_dir: Path, workers: int | None, hero_count: bool) -> Path:
    from tools.hf.build import build
    from tools.hf.render import HFError, render

    mix = _mix(run_dir)
    tools = _tools("ffmpeg")
    out_dir = (run_dir / "04-video" / "out").resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    silent, final = out_dir / "silent.mp4", out_dir / "video.mp4"
    try:
        comp = build(run_dir, hero_count=hero_count)
        result = render(comp, silent, workers=workers)
    except HFError as e:
        raise RenderError(f"hyperframes: {e}") from e
    print(f"hyperframes render took {result['seconds']:.1f} s")
    if result.get("retried"):
        print("note: the render was interrupted and finished on a retry with 1 worker")
    for w in result.get("warnings", []):
        print(f"warning: {w}")
    return _mux(tools["ffmpeg"], silent, mix, final, run_dir)


def render_video(run_dir: Path, templates_dir: Path = DEFAULT_TEMPLATES,
                 engine: str = "hyperframes", *, workers: int | None = None,
                 hero_count: bool = True) -> Path:
    """Render 04-video/out/video.mp4 with `engine` (hyperframes | remotion). HyperFrames only:
    `workers` (default half the CPUs), `hero_count=False` skips the 2-4 hero rule (drafts)."""
    run_dir, templates_dir = Path(run_dir), Path(templates_dir)
    if engine == "remotion":
        return _render_remotion(run_dir, templates_dir)
    if engine == "hyperframes":
        return _render_hyperframes(run_dir, workers, hero_count)
    raise RenderError(f"unknown engine {engine} (have: {', '.join(ENGINES)})")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="tools.render.render")
    ap.add_argument("run_dir", type=Path)
    ap.add_argument("--engine", choices=ENGINES, default="hyperframes",
                    help="hyperframes (default) or remotion (kept until HyperFrames is approved)")
    ap.add_argument("--workers", type=int, default=None,
                    help="HyperFrames render workers (default: half the CPUs, at least 1)")
    ap.add_argument("--allow-hero-count", action="store_true",
                    help="HyperFrames draft only: do not require 2-4 hero scenes")
    ap.add_argument("--templates-dir", type=Path, default=DEFAULT_TEMPLATES,
                    help="Remotion templates folder (remotion engine only)")
    args = ap.parse_args(argv)
    try:
        out = render_video(args.run_dir, args.templates_dir, engine=args.engine,
                           workers=args.workers, hero_count=not args.allow_hero_count)
    except RenderError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(f"video written: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
