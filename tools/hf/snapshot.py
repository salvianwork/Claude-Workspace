"""Snapshot every scene of the run's built composition (start / middle / end) for a visual check.

    python -m tools.hf.snapshot <run_dir> [--when start,mid,end]

Needs `python -m tools.hf.build <run_dir>` first. Writes
04-video/hf/snapshots/scene-<id>-<when>.png with `hyperframes snapshot` (telemetry off).
"start" is just after the entry transition, "mid" the middle, "end" just before the exit.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

from tools.hf.render import HFError, _hyperframes, _run, _tail, timeout_for

WHEN = ("start", "mid", "end")
_AT = re.compile(r"at-([0-9]+(?:\.[0-9]+)?)s", re.I)


def moment(scene: dict, when: str) -> float:
    """Global time (s) of a snapshot moment in a scene of data.json."""
    start, d = scene["start"], scene["duration"]
    if when == "start":
        t = min(0.6, d * 0.25)
    elif when == "mid":
        t = d / 2
    elif when == "end":
        t = d - min(0.4, d * 0.2)
    else:
        raise HFError(f"unknown snapshot moment {when} (have: {', '.join(WHEN)})")
    return round(start + t, 3)


def snapshot(run_dir: Path, times_per_scene: tuple[str, ...] = WHEN) -> list[Path]:
    run_dir = Path(run_dir)
    comp = (run_dir / "04-video" / "hf").resolve()
    data_path = comp / "data.json"
    if not (comp / "index.html").is_file() or not data_path.is_file():
        raise HFError(f"no built composition in {comp}: run python -m tools.hf.build first")
    data = json.loads(data_path.read_text(encoding="utf-8"))
    plan = [(s["id"], w, moment(s, w)) for s in data["scenes"] for w in times_per_scene]
    if len({t for _, _, t in plan}) != len(plan):
        raise HFError("two snapshot moments fall on the same time (a scene is too short)")
    out_dir = comp / "snapshots"
    with tempfile.TemporaryDirectory(prefix="hf-snap-") as tmp:
        shots = Path(tmp) / "shots"
        at = ",".join(f"{t:g}" for _, _, t in plan)
        r = _run([*_hyperframes(), "snapshot", "--at", at, "--no-end", "--output", str(shots), str(comp)],
                 comp, "hyperframes snapshot", timeout_for(comp))
        found = {}
        for f in shots.glob("*.png") if shots.is_dir() else []:
            m = _AT.search(f.name)
            if m:
                found[float(m.group(1))] = f
        if r.returncode != 0 or not found:
            raise HFError(f"hyperframes snapshot failed (exit {r.returncode}):\n{_tail(r)}")
        out_dir.mkdir(parents=True, exist_ok=True)
        written = []
        for sid, when, t in plan:
            best = min(found, key=lambda k: abs(k - t))
            if abs(best - t) > 0.02:
                raise HFError(f"hyperframes snapshot gave no frame at {t} s (scene-{sid} {when})")
            dest = out_dir / f"scene-{sid}-{when}.png"
            shutil.copyfile(found[best], dest)
            written.append(dest)
    return written


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m tools.hf.snapshot", description=__doc__.splitlines()[0])
    p.add_argument("run_dir", type=Path)
    p.add_argument("--when", default=",".join(WHEN), help="comma-separated moments: start, mid, end")
    a = p.parse_args(argv)
    try:
        paths = snapshot(a.run_dir, tuple(w.strip() for w in a.when.split(",") if w.strip()))
    except HFError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    for path in paths:
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
