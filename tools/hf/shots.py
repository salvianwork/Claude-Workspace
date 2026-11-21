"""Validate 03-design/shots.json against the voice (manifest + words.json) and the hf-kit.

    python -m tools.hf.shots validate <run_dir> [--no-modules]

Checks: the pinned schema; 2-4 hero scenes; scene ids match the voice manifest and words.json;
every `at.word` / `until.word` (cues and camera keys) is a word index of that scene; a hero's
`prop` is in hf-kit/props/ (or `new_prop: true` with 04-video/hf/scenes/scene-<id>.js present
and registering the prop); kit scene known and its props / cues valid (the kit's own
`validate`); presenter and transition values known to the kit; the camera plan finishes inside
the scene (more than 0.25 s late is an error, less is a warning). The kit-side checks run the
kit's pure functions in node (tools/hf/kit_check.mjs) so they use the same maths as the video.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

from tools.hf.render import KIT_DIR

PROPS_DIR = KIT_DIR / "props"
NODE_HELPER = Path(__file__).with_name("kit_check.mjs")
FPS = 30
KINDS = ("hero", "kit")
KIT_SCENES = ("title", "steps", "compare", "chart", "kinetic", "recap", "diagram")
WORD_SOURCES = ("kokoro", "whisper", "engine", "mixed")
HEROES = (2, 4)
_NAME = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")


class ShotsError(ValueError):
    pass


def scene_frames(duration_s: float) -> int:
    # round(…, 6) guards against float noise such as 2.1 * 30 = 63.00000000000001
    return math.ceil(round(float(duration_s) * FPS, 6))


def module_path(scenes_dir: Path, sid: int) -> Path:
    return Path(scenes_dir) / f"scene-{sid}.js"


def _words_by_scene(words: dict) -> dict[int, list[dict]]:
    return {int(s["id"]): s.get("words") or [] for s in words.get("scenes", []) if isinstance(s, dict) and "id" in s}


def _check_at(at, idx: set[int], where: str, errs: list[str]) -> None:
    if not isinstance(at, dict):
        errs.append(f"{where}: `at` must be {{word: i}} or {{t: seconds}}")
    elif "word" in at:
        w = at["word"]
        if not isinstance(w, int) or isinstance(w, bool):
            errs.append(f"{where}: word must be a word index (got {w!r})")
        elif w not in idx:
            errs.append(f"{where} at word {w}: no such word in words.json "
                        f"(the scene has words 0-{max(idx) if idx else -1})")
    elif not isinstance(at.get("t"), (int, float)):
        errs.append(f"{where}: `at` must be {{word: i}} or {{t: seconds}}")


def _structure(shots: dict, words: dict, manifest: dict, props_dir: Path,
               scenes_dir: Path | None, hero_count: bool) -> tuple[list[str], list[dict]]:
    """Python-side checks. Returns (errors, scenes ready for the node checks)."""
    errs: list[str] = []
    if not isinstance(shots, dict) or not isinstance(shots.get("scenes"), list) or not shots["scenes"]:
        return ["shots.json: needs a non-empty `scenes` list"], []
    if words.get("source") not in WORD_SOURCES:
        errs.append(f"words.json: source must be one of {', '.join(WORD_SOURCES)} (got {words.get('source')!r})")
    by_words = _words_by_scene(words)
    durations = {int(s["id"]): float(s["duration_s"]) for s in manifest.get("scenes", [])}
    seen: list[int] = []
    node_scenes: list[dict] = []
    heroes = 0
    new_props: dict[str, int] = {}
    for n, s in enumerate(shots["scenes"]):
        if not isinstance(s, dict) or not isinstance(s.get("id"), int) or isinstance(s.get("id"), bool):
            errs.append(f"shots.json: scene {n} needs an integer id")
            continue
        sid = s["id"]
        where = f"scene {sid}"
        if sid in seen:
            errs.append(f"{where}: id used twice")
            continue
        seen.append(sid)
        before = len(errs)
        if sid not in durations:
            errs.append(f"{where}: not in the voice manifest")
        ws = by_words.get(sid)
        if ws is None:
            errs.append(f"{where}: no word timings in words.json")
            ws = []
        idx = {w.get("i") for w in ws}
        kind = s.get("kind")
        node = {"id": sid, "kind": kind, "words": ws, "duration": scene_frames(durations.get(sid, 0)) / FPS,
                "cues": s.get("cues", []), "camera": s.get("camera", []), "presenter": s.get("presenter")}
        if "transition" in s:
            node["transition"] = s["transition"]
        if kind not in KINDS:
            errs.append(f"{where}: kind must be hero or kit (got {kind!r})")
        elif kind == "hero":
            heroes += 1
            prop, new = s.get("prop"), s.get("new_prop", False)
            if not isinstance(new, bool):
                errs.append(f"{where}: new_prop must be true or false")
            if not isinstance(prop, str) or not _NAME.match(prop):
                errs.append(f"{where}: prop must be a lowercase name like volcano or tidal-wave (got {prop!r})")
            elif new is True:
                if (Path(props_dir) / prop / "prop.js").is_file():
                    errs.append(f"{where}: prop {prop} is already in the prop library: reuse it "
                                "(new_prop false) or give the new drawing another name")
                elif prop in new_props:
                    errs.append(f"{where}: new prop {prop} is also drawn by scene {new_props[prop]}")
                new_props.setdefault(prop, sid)
                if scenes_dir is not None:
                    mod = module_path(scenes_dir, sid)
                    if not mod.is_file():
                        errs.append(f"{where}: new prop {prop} needs its hero module 04-video/hf/scenes/{mod.name} "
                                    "(written by the animator)")
                    node.update(prop=prop, module=str(mod), module_label=f"scenes/{mod.name}")
            else:
                lib = Path(props_dir) / prop / "prop.js"
                if not lib.is_file():
                    errs.append(f"{where}: prop {prop} is not in the prop library ({props_dir}); "
                                "set new_prop true to draw it")
                node.update(prop=prop, module=str(lib), module_label=f"props/{prop}/prop.js")
            if "params" in s and not isinstance(s["params"], dict):
                errs.append(f"{where}: params must be an object")
            node["params"] = s.get("params") if isinstance(s.get("params"), dict) else {}
        else:
            if s.get("scene") not in KIT_SCENES:
                errs.append(f"{where}: unknown kit scene {s.get('scene')} (have: {', '.join(KIT_SCENES)})")
            node.update(scene=s.get("scene"), props=s.get("props"))
        for field in ("camera", "cues"):
            if not isinstance(s.get(field, []), list):
                errs.append(f"{where}: {field} must be a list")
                node[field] = []
        for k, c in enumerate(node["cues"]):
            if not isinstance(c, dict) or not isinstance(c.get("show"), str):
                errs.append(f"{where}: cue {k}: needs `at` and `show`")
                continue
            _check_at(c.get("at"), idx, f"{where}: cue {k}", errs)
            if "until" in c:
                _check_at(c["until"], idx, f"{where}: cue {k} until", errs)
        for k, c in enumerate(node["camera"]):
            if not isinstance(c, dict) or "frame" not in c:
                errs.append(f"{where}: camera key {k}: needs `at` and `frame`")
                continue
            _check_at(c.get("at"), idx, f"{where}: camera key {k}", errs)
        if len(errs) == before and ("module" in node or kind == "kit"):
            node_scenes.append(node)
    for sid in durations:
        if sid not in seen:
            errs.append(f"scene {sid}: in the voice manifest but not in shots.json")
    if hero_count and not HEROES[0] <= heroes <= HEROES[1]:
        errs.append(f"shots.json: {heroes} hero scene(s); a video needs {HEROES[0]}-{HEROES[1]} hero scenes "
                    "(custom drawings), the rest kit scenes")
    return errs, node_scenes


def _node_check(node_scenes: list[dict], style: dict | None, kit_dir: Path) -> list[dict]:
    if not node_scenes:
        return []
    node = shutil.which("node")
    if node is None:
        raise ShotsError("node not found: install Node.js 22+ (needed to check scenes with the kit)")
    req = {"kit": str(Path(kit_dir).resolve()), "style": style, "scenes": node_scenes}
    r = subprocess.run([node, str(NODE_HELPER)], input=json.dumps(req), capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=300)
    try:
        return json.loads(r.stdout)["scenes"]
    except (json.JSONDecodeError, KeyError):
        tail = "\n".join((r.stderr or r.stdout or "").splitlines()[-20:])
        raise ShotsError(f"kit check failed (exit {r.returncode}):\n{tail}")


def kit_check(shots: dict, words: dict, manifest: dict, props_dir: Path = PROPS_DIR, *,
              scenes_dir: Path | None = None, style: dict | None = None, kit_dir: Path = KIT_DIR) -> list[dict]:
    """Raw node report per scene: [{id, errors, warnings, overrun}] (scenes that pass the Python
    checks only)."""
    _, node_scenes = _structure(shots, words, manifest, props_dir, scenes_dir, False)
    return _node_check(node_scenes, style, kit_dir)


def review_shots(shots: dict, words: dict, manifest: dict, props_dir: Path = PROPS_DIR, *,
                 scenes_dir: Path | None = None, style: dict | None = None, hero_count: bool = True,
                 kit_dir: Path = KIT_DIR) -> tuple[list[str], list[str]]:
    """(errors, warnings). `scenes_dir` = 04-video/hf/scenes (needed to check new_prop hero
    modules; None skips them). `hero_count=False` skips the 2-4 heroes rule."""
    errs, node_scenes = _structure(shots, words, manifest, props_dir, scenes_dir, hero_count)
    warns: list[str] = []
    for r in _node_check(node_scenes, style, kit_dir):
        errs += [f"scene {r['id']}: {e}" for e in r["errors"]]
        warns += [f"scene {r['id']}: {w}" for w in r["warnings"]]
    return errs, warns


def validate_shots(shots: dict, words: dict, manifest: dict, props_dir: Path = PROPS_DIR, *,
                   scenes_dir: Path | None = None, style: dict | None = None, hero_count: bool = True) -> list[str]:
    """Errors in shots.json (empty list = valid). See review_shots for the options."""
    return review_shots(shots, words, manifest, props_dir, scenes_dir=scenes_dir, style=style,
                        hero_count=hero_count)[0]


def read_json(path: Path, what: str) -> dict:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ShotsError(f"{what} not found: {path}")
    except json.JSONDecodeError as e:
        raise ShotsError(f"{what} is not valid JSON ({path}): {e}")


def load_run(run_dir: Path) -> dict:
    """shots, words, manifest and style (None when 03-design/style.json is missing) of a run."""
    run_dir = Path(run_dir)
    style_path = run_dir / "03-design" / "style.json"
    return {"shots": read_json(run_dir / "03-design" / "shots.json", "shots.json"),
            "words": read_json(run_dir / "02-voice" / "words.json", "words.json"),
            "manifest": read_json(run_dir / "02-voice" / "manifest.json", "voice manifest"),
            "style": read_json(style_path, "style.json") if style_path.is_file() else None}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m tools.hf.shots", description=__doc__.splitlines()[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate", help="check 03-design/shots.json")
    v.add_argument("run_dir", type=Path)
    v.add_argument("--no-modules", action="store_true",
                   help="do not require new_prop hero modules yet (shot list review before animation)")
    a = p.parse_args(argv)
    try:
        d = load_run(a.run_dir)
        scenes_dir = None if a.no_modules else a.run_dir / "04-video" / "hf" / "scenes"
        errs, warns = review_shots(d["shots"], d["words"], d["manifest"], PROPS_DIR,
                                   scenes_dir=scenes_dir, style=d["style"])
    except ShotsError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    for w in warns:
        print(f"warning: {w}")
    if errs:
        print(f"shots.json has {len(errs)} problem(s):", file=sys.stderr)
        for e in errs:
            print(f"- {e}", file=sys.stderr)
        return 1
    print(f"shots.json OK ({len(d['shots']['scenes'])} scenes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
