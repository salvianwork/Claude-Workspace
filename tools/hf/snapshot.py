"""Snapshot every scene of the run's built composition (start / middle / end) for a visual check.

    python -m tools.hf.snapshot <run_dir> [--when start,mid,end]
    python -m tools.hf.snapshot <run_dir> --overlap
    python -m tools.hf.snapshot <run_dir> --safe-zone

Needs `python -m tools.hf.build <run_dir>` first. Writes
04-video/hf/snapshots/scene-<id>-<when>.png with `hyperframes snapshot` (telemetry off).
"start" is just after the entry transition, "mid" the middle, "end" just before the exit.

--overlap (world scenes, schema 2) writes the overlap report instead of snapshots:
04-video/hf/overlap.json = [{scene, t, a: {kind, id}, b: {kind, id}}]. Every world scene is
sampled every 0.5 s of its own time in the browser HyperFrames uses (tools/hf/overlap.mjs); a tag
or label box (`a`; the title counts as a label) that intersects a face box or another tag or
label (`b`) is listed once per stretch of time it lasts, at the first sample (`t`, scene time).
The command exits 1 when the list is not empty.

--safe-zone (vertical videos) writes 04-video/hf/safe-zone.json = [{scene, t, kind, id, box: {x, y, w, h}}]:
every caption, label and tag box (the title counts as a label) that leaves the text safe zone,
x 64-940 and y 200-1420 of the 1080 x 1920 frame (HFKit.VERTICAL.safe), listed once per stretch of
time it lasts, at the first sample (`t`, scene time; same sampling as --overlap). The host is exempt.
The command exits 1 when the list is not empty. A landscape video has no safe zone: the list is empty.

Both run in the composition's own size (data.json `width` x `height`: 1080 x 1920 for a vertical
video): `hyperframes snapshot` reads it from the page's root element, and the overlap report opens
the page at that viewport and checks that the kit mounted in it (HFKit.CANVAS).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from tools.hf.render import KIT_DIR, HFError, _env, _hyperframes, _run, _tail, timeout_for

WHEN = ("start", "mid", "end")
OVERLAP_STEP = 0.5
OVERLAP_HELPER = Path(__file__).with_name("overlap.mjs")
TEXT_KINDS = ("tag", "label", "caption")
SAFE_KINDS = ("caption", "label", "tag")
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
    comp, data = _built(run_dir)
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


def _built(run_dir: Path) -> tuple[Path, dict]:
    comp = (Path(run_dir) / "04-video" / "hf").resolve()
    data_path = comp / "data.json"
    if not (comp / "index.html").is_file() or not data_path.is_file():
        raise HFError(f"no built composition in {comp}: run python -m tools.hf.build first")
    return comp, json.loads(data_path.read_text(encoding="utf-8"))


def canvas(data: dict) -> dict:
    """{width, height} of a built composition (data.json; landscape when it says nothing)."""
    c = data.get("canvas") or {"width": data.get("width", 1920), "height": data.get("height", 1080)}
    return {"width": int(c["width"]), "height": int(c["height"])}


def _hit(a: dict, b: dict) -> bool:
    """Boxes {x, y, w, h} share some area (touching edges do not count)."""
    return (min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]) > 0 and
            min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]) > 0)


def overlap_pairs(boxes: list[dict]) -> list[tuple[tuple[str, str], tuple[str, str]]]:
    """((kind, id) of a tag or label, (kind, id) of the face, tag or label it covers), in box order;
    two text boxes are paired once."""
    out = []
    for i, a in enumerate(boxes):
        if a["kind"] not in TEXT_KINDS:
            continue
        for j, b in enumerate(boxes):
            if j == i or (b["kind"] in TEXT_KINDS and j < i):
                continue
            if _hit(a, b):
                out.append(((a["kind"], a["id"]), (b["kind"], b["id"])))
    return out


def _browser() -> str:
    """The Chrome HyperFrames renders with (HYPERFRAMES_BROWSER_PATH, else `hyperframes browser path`)."""
    env = os.environ.get("HYPERFRAMES_BROWSER_PATH")
    if env:
        return env
    r = _run([*_hyperframes(), "browser", "path"], KIT_DIR, "hyperframes browser path")
    lines = [x.strip() for x in (r.stdout or "").splitlines() if x.strip()]
    if r.returncode != 0 or not lines or not Path(lines[-1]).is_file():
        raise HFError(f"no Chrome for the overlap report (run `npx hyperframes browser ensure` in hf-kit):\n{_tail(r)}")
    return lines[-1]


def _sample(run_dir: Path, kit_dir: Path, step: float, what: str) -> tuple[Path, dict, dict | None]:
    """(comp, data, report) with the box samples of every world scene (overlap.mjs); report is None
    when the composition has no world scene."""
    comp, data = _built(run_dir)
    if not any(s.get("kind") == "world" for s in data["scenes"]):
        return comp, data, None
    node = shutil.which("node")
    if node is None:
        raise HFError(f"node not found: install Node.js 22+ (needed for the {what})")
    size = canvas(data)
    req = {"kit": str(Path(kit_dir).resolve()), "comp": str(comp), "browser": _browser(), "step": step, **size}
    try:
        r = subprocess.run([node, str(OVERLAP_HELPER)], input=json.dumps(req), capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout_for(comp), env=_env())
    except subprocess.TimeoutExpired as e:
        raise HFError(f"the {what} timed out") from e
    try:
        out = json.loads(r.stdout)
    except json.JSONDecodeError:
        raise HFError(f"the {what} failed (exit {r.returncode}):\n{_tail(r)}")
    if out.get("errors"):
        raise HFError("the composition has errors in the browser:\n" + "\n".join(f"- {e}" for e in out["errors"]))
    for key in ("viewport", "canvas"):
        if out.get(key) != size:
            raise HFError(f"the {what} ran in a {key} of {out.get(key)}, "
                          f"not the composition's {size['width']} x {size['height']}")
    return comp, data, out


def _write(comp: Path, name: str, report: list[dict]) -> None:
    tmp = comp / f"{name}.tmp"
    tmp.write_text(json.dumps(report, indent=1), encoding="utf-8")
    os.replace(tmp, comp / name)


def overlap(run_dir: Path, kit_dir: Path = KIT_DIR, step: float = OVERLAP_STEP) -> list[dict]:
    """Write 04-video/hf/overlap.json (see the module doc) and return its list."""
    comp, _, out = _sample(run_dir, kit_dir, step, "overlap report")
    report: list[dict] = []
    if out is not None:
        before: dict[int, set] = {}
        for smp in out["samples"]:
            now = set()
            for a, b in overlap_pairs(smp["boxes"]):
                now.add((a, b))
                if (a, b) not in before.get(smp["scene"], set()):
                    report.append({"scene": smp["scene"], "t": smp["t"], "a": {"kind": a[0], "id": a[1]},
                                   "b": {"kind": b[0], "id": b[1]}})
            before[smp["scene"]] = now
    _write(comp, "overlap.json", report)
    return report


def outside_safe(box: dict, safe: dict) -> bool:
    """A box {x, y, w, h} reaches outside the safe zone {x0, x1, y0, y1} (by more than half a pixel)."""
    return (box["x"] < safe["x0"] - 0.5 or box["x"] + box["w"] > safe["x1"] + 0.5 or
            box["y"] < safe["y0"] - 0.5 or box["y"] + box["h"] > safe["y1"] + 0.5)


def safe_zone(run_dir: Path, kit_dir: Path = KIT_DIR, step: float = OVERLAP_STEP) -> list[dict]:
    """Write 04-video/hf/safe-zone.json (see the module doc) and return its list."""
    comp, data, out = _sample(run_dir, kit_dir, step, "safe-zone report")
    report: list[dict] = []
    size = canvas(data)
    if out is not None and size["height"] > size["width"]:
        safe = out["safe"]
        before: dict[int, set] = {}
        for smp in out["samples"]:
            now = set()
            for b in smp["boxes"]:
                if b["kind"] not in SAFE_KINDS or not outside_safe(b, safe):
                    continue
                key = (b["kind"], b["id"])
                now.add(key)
                if key not in before.get(smp["scene"], set()):
                    report.append({"scene": smp["scene"], "t": smp["t"], "kind": b["kind"], "id": b["id"],
                                   "box": {k: b[k] for k in ("x", "y", "w", "h")}})
            before[smp["scene"]] = now
    _write(comp, "safe-zone.json", report)
    return report


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m tools.hf.snapshot", description=__doc__.splitlines()[0])
    p.add_argument("run_dir", type=Path)
    p.add_argument("--when", default=",".join(WHEN), help="comma-separated moments: start, mid, end")
    p.add_argument("--overlap", action="store_true",
                   help="write 04-video/hf/overlap.json (tags or labels covering a face or each other) "
                        "instead of snapshots; exit 1 when it is not empty")
    p.add_argument("--safe-zone", action="store_true", dest="safe_zone",
                   help="write 04-video/hf/safe-zone.json (vertical: captions, labels or tags outside "
                        "x 64-940, y 200-1420) instead of snapshots; exit 1 when it is not empty")
    a = p.parse_args(argv)
    if a.safe_zone:
        try:
            report = safe_zone(a.run_dir)
        except HFError as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
        path = Path(a.run_dir) / "04-video" / "hf" / "safe-zone.json"
        if not report:
            print(f"all text is inside the safe zone: {path}")
            return 0
        print(f"{len(report)} box(es) outside the safe zone written to {path}:", file=sys.stderr)
        for o in report:
            b = o["box"]
            print(f"- scene {o['scene']} at {o['t']:g} s: {o['kind']} {o['id']} at x {b['x']:g}-{b['x'] + b['w']:g}, "
                  f"y {b['y']:g}-{b['y'] + b['h']:g}", file=sys.stderr)
        return 1
    if a.overlap:
        try:
            report = overlap(a.run_dir)
        except HFError as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
        path = Path(a.run_dir) / "04-video" / "hf" / "overlap.json"
        if not report:
            print(f"no overlaps: {path}")
            return 0
        print(f"{len(report)} overlap(s) written to {path}:", file=sys.stderr)
        for o in report:
            print(f"- scene {o['scene']} at {o['t']:g} s: {o['a']['kind']} {o['a']['id']} covers "
                  f"{o['b']['kind']} {o['b']['id']}", file=sys.stderr)
        return 1
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
