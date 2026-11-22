"""Validate 03-design/shots.json against the voice (manifest + words.json) and the hf-kit.

    python -m tools.hf.shots validate <run_dir> [--no-modules] [--allow-step-ins]

`"schema": 2` (world scenes) is checked by validate_shots / review_shots too; see _structure_world:
type explainer or what-if (story, action and other come in a later phase); audience all-ages
(default), teens or adults; a top-level `cast` with the host; every scene `kind: "world"` in a
place from hf-kit/places/ (or `new_place: true` with 04-video/hf/scenes/place-<name>.js present
and registering it); variants, actors and every beat's moves (names, anchors, targets, effects,
text limits, the title in scene 1 only, show-don't-tell) through the kit's own HFKit.validateWorld;
`custom` moves need 04-video/hf/scenes/scene-<id>.js; a place whose meta says notToScale needs a
"not to scale" tag or label in the scene; the host steps into the world (placed at an anchor, or
walking / running out of the side slot) in 1-2 scenes (`--allow-step-ins` relaxes this). Kit
warnings (a strike that slips past its word, a head cut by the frame, a camera that ends late by
less than 0.25 s) are printed as warnings; a camera overrun above 0.25 s is an error.

Schema 1 (no "schema"):

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
TYPES = ("explainer", "what-if")
LATER_TYPES = ("story", "action", "other")
AUDIENCES = ("all-ages", "teens", "adults")
STEP_INS = (1, 2)
STEP_IN_MOVES = ("walk_to", "run_to")
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


def schema_of(shots) -> int | None:
    """1 (no "schema"), 2, or None for anything else."""
    if not isinstance(shots, dict) or "schema" not in shots:
        return 1
    v = shots["schema"]
    return v if v in (1, 2) and not isinstance(v, bool) else None


def _structure(shots: dict, words: dict, manifest: dict, props_dir: Path,
               scenes_dir: Path | None, hero_count: bool, step_ins: bool = True,
               places_dir: Path | None = None) -> tuple[list[str], list[dict]]:
    """Python-side checks. Returns (errors, scenes ready for the node checks)."""
    if not isinstance(shots, dict) or not isinstance(shots.get("scenes"), list) or not shots["scenes"]:
        return ["shots.json: needs a non-empty `scenes` list"], []
    schema = schema_of(shots)
    if schema is None:
        return [f"shots.json: schema must be 2 (world scenes) or absent (schema 1), got {shots.get('schema')!r}"], []
    if schema == 2:
        places = Path(places_dir) if places_dir is not None else Path(props_dir).parent / "places"
        return _structure_world(shots, words, manifest, places, scenes_dir, step_ins)
    return _structure_hero(shots, words, manifest, props_dir, scenes_dir, hero_count)


def _common(shots: dict, words: dict, manifest: dict, errs: list[str]):
    if words.get("source") not in WORD_SOURCES:
        errs.append(f"words.json: source must be one of {', '.join(WORD_SOURCES)} (got {words.get('source')!r})")
    return _words_by_scene(words), {int(s["id"]): float(s["duration_s"]) for s in manifest.get("scenes", [])}


def _structure_hero(shots: dict, words: dict, manifest: dict, props_dir: Path,
                    scenes_dir: Path | None, hero_count: bool) -> tuple[list[str], list[dict]]:
    """Schema 1 (hero / kit scenes)."""
    errs: list[str] = []
    by_words, durations = _common(shots, words, manifest, errs)
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


def _host_ids(shots: dict, scene: dict) -> set[str]:
    """Actor ids of the host in a scene (by the actor's character, its cast entry, or id "host")."""
    cast = {c.get("id"): c for c in shots.get("cast") or [] if isinstance(c, dict)}
    out = set()
    for a in scene.get("actors") or []:
        if not isinstance(a, dict):
            continue
        ch = a.get("character") or (cast.get(a.get("id")) or {}).get("character")
        if ch == "host" or (ch is None and a.get("id") == "host"):
            out.add(a.get("id"))
    return out


def steps_in(shots: dict, scene: dict) -> bool:
    """True when the host is in the world in this scene: placed at an anchor, or walking or running
    out of the side slot (one step-in per scene at most)."""
    hosts = _host_ids(shots, scene)
    for a in scene.get("actors") or []:
        if isinstance(a, dict) and a.get("id") in hosts and isinstance(a.get("start"), dict) and "anchor" in a["start"]:
            return True
    for b in scene.get("beats") or []:
        for mv in (b.get("moves") or []) if isinstance(b, dict) else []:
            if isinstance(mv, dict) and mv.get("do") in STEP_IN_MOVES and mv.get("who") in hosts:
                return True
    return False


def place_module_path(scenes_dir: Path, name: str) -> Path:
    return Path(scenes_dir) / f"place-{name}.js"


def _structure_world(shots: dict, words: dict, manifest: dict, places_dir: Path,
                     scenes_dir: Path | None, step_ins: bool) -> tuple[list[str], list[dict]]:
    """Schema 2 (world scenes): the Python-side checks; the kit checks the rest (kit_check.mjs)."""
    errs: list[str] = []
    typ = shots.get("type")
    if typ in LATER_TYPES:
        errs.append(f'type "{typ}" is coming in a later phase — use explainer or what-if')
    elif typ not in TYPES:
        errs.append(f"type must be explainer or what-if (got {json.dumps(typ)})")
    aud = shots.get("audience", "all-ages")
    if aud not in AUDIENCES:
        errs.append(f"audience must be all-ages, teens or adults (got {json.dumps(aud)})")
    cast = shots.get("cast")
    if not isinstance(cast, list) or not all(isinstance(c, dict) for c in cast):
        errs.append('cast: must be a list of {"id", "character", "outfit"?}')
        cast = []
    else:
        ids = [c.get("id") for c in cast]
        for c in cast:
            ch = c.get("character")
            if not isinstance(c.get("id"), str) or not c.get("id"):
                errs.append(f"cast: every entry needs an id (got {json.dumps(c)})")
            elif ids.count(c["id"]) > 1:
                errs.append(f"cast: id {c['id']} is used twice")
            elif ch != "host" and not (isinstance(ch, str) and re.fullmatch(r"extra-\d+", ch)):
                errs.append(f"cast {c['id']}: character must be host or extra-<n> (got {json.dumps(ch)})")
        if not any(c.get("character") == "host" for c in cast):
            errs.append('cast: needs the host (character "host")')
    by_words, durations = _common(shots, words, manifest, errs)
    seen: list[int] = []
    node_scenes: list[dict] = []
    stepped: list[int] = []
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
        if s.get("kind") != "world":
            errs.append(f'{where}: kind must be "world" in schema 2 (got {json.dumps(s.get("kind"))})')
            continue
        if steps_in(shots, s):
            stepped.append(sid)
        node = {"id": sid, "kind": "world", "world": s, "words": ws,
                "duration": scene_frames(durations.get(sid, 0)) / FPS, "customs_unchecked": scenes_dir is None}
        if "transition" in s:
            node["transition"] = s["transition"]
        place, new = s.get("place"), s.get("new_place", False)
        if not isinstance(new, bool):
            errs.append(f"{where}: new_place must be true or false")
        if not isinstance(place, str) or not _NAME.match(place):
            errs.append(f"{where}: place must be a lowercase name like countryside or city-street (got {place!r})")
        elif new is True:
            if (Path(places_dir) / place / "place.js").is_file():
                errs.append(f"{where}: place {place} is already in the places library: reuse it "
                            "(new_place false) or give the new place another name")
            if scenes_dir is None:
                node = None  # the place is not drawn yet: Python checks only
            else:
                mod = place_module_path(scenes_dir, place)
                if not mod.is_file():
                    errs.append(f"{where}: new place {place} needs its module 04-video/hf/scenes/{mod.name} "
                                f'(registering HFKit.places["{place}"])')
                node.update(place_module=str(mod), place_label=f"scenes/{mod.name}")
        else:
            lib = Path(places_dir) / place / "place.js"
            if not lib.is_file():
                errs.append(f"{where}: place {place} is not in the places library (hf-kit/places/); "
                            f"set new_place true and write 04-video/hf/scenes/place-{place}.js")
            node.update(place_module=str(lib), place_label=f"places/{place}/place.js")
        if node is not None and scenes_dir is not None and module_path(scenes_dir, sid).is_file():
            node.update(scene_module=str(module_path(scenes_dir, sid)),
                        scene_label=f"scenes/{module_path(scenes_dir, sid).name}")
        if len(errs) == before and node is not None:
            node_scenes.append(node)
    for sid in durations:
        if sid not in seen:
            errs.append(f"scene {sid}: in the voice manifest but not in shots.json")
    if step_ins and not STEP_INS[0] <= len(stepped) <= STEP_INS[1]:
        which = f" (scenes {', '.join(map(str, stepped))})" if stepped else ""
        errs.append(f"shots.json: the host steps into the world in {len(stepped)} scene(s){which}; a video has "
                    f"{STEP_INS[0]}-{STEP_INS[1]} step-ins (the host talks from the side slot otherwise)")
    return errs, node_scenes


def _node_check(node_scenes: list[dict], style: dict | None, kit_dir: Path, cast=None) -> list[dict]:
    if not node_scenes:
        return []
    node = shutil.which("node")
    if node is None:
        raise ShotsError("node not found: install Node.js 22+ (needed to check scenes with the kit)")
    req = {"kit": str(Path(kit_dir).resolve()), "style": style, "scenes": node_scenes}
    if cast is not None:
        req["cast"] = cast
    r = subprocess.run([node, str(NODE_HELPER)], input=json.dumps(req), capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=300)
    try:
        return json.loads(r.stdout)["scenes"]
    except (json.JSONDecodeError, KeyError):
        tail = "\n".join((r.stderr or r.stdout or "").splitlines()[-20:])
        raise ShotsError(f"kit check failed (exit {r.returncode}):\n{tail}")


def _cast_of(shots):
    return shots.get("cast") if schema_of(shots) == 2 and isinstance(shots.get("cast"), list) else None


def kit_check(shots: dict, words: dict, manifest: dict, props_dir: Path = PROPS_DIR, *,
              scenes_dir: Path | None = None, style: dict | None = None, kit_dir: Path = KIT_DIR) -> list[dict]:
    """Raw node report per scene: [{id, errors, warnings, overrun}] (scenes that pass the Python
    checks only)."""
    _, node_scenes = _structure(shots, words, manifest, props_dir, scenes_dir, False, False,
                                Path(kit_dir) / "places")
    return _node_check(node_scenes, style, kit_dir, _cast_of(shots))


def _scoped(sid: int, msg: str) -> str:
    """Kit world errors already name their scene ("scene 2 beat 0 ...") or the cast."""
    return msg if msg.startswith(("scene ", "cast")) else f"scene {sid}: {msg}"


def review_shots(shots: dict, words: dict, manifest: dict, props_dir: Path = PROPS_DIR, *,
                 scenes_dir: Path | None = None, style: dict | None = None, hero_count: bool = True,
                 kit_dir: Path = KIT_DIR, allow_step_ins: bool = False) -> tuple[list[str], list[str]]:
    """(errors, warnings). `scenes_dir` = 04-video/hf/scenes (needed to check new_prop hero
    modules, new places and custom moves; None skips them). Schema 1: `hero_count=False` skips
    the 2-4 heroes rule. Schema 2: `allow_step_ins=True` skips the 1-2 step-ins rule."""
    errs, node_scenes = _structure(shots, words, manifest, props_dir, scenes_dir, hero_count,
                                   not allow_step_ins, Path(kit_dir) / "places")
    warns: list[str] = []
    world = schema_of(shots) == 2
    for r in _node_check(node_scenes, style, kit_dir, _cast_of(shots)):
        if world:
            errs += [e for e in (_scoped(r["id"], x) for x in r["errors"]) if e not in errs]
            warns += [_scoped(r["id"], w) for w in r["warnings"]]
        else:
            errs += [f"scene {r['id']}: {e}" for e in r["errors"]]
            warns += [f"scene {r['id']}: {w}" for w in r["warnings"]]
    return errs, warns


def validate_shots(shots: dict, words: dict, manifest: dict, props_dir: Path = PROPS_DIR, *,
                   scenes_dir: Path | None = None, style: dict | None = None, hero_count: bool = True,
                   allow_step_ins: bool = False) -> list[str]:
    """Errors in shots.json (empty list = valid); schema 1 or 2. See review_shots for the options."""
    return review_shots(shots, words, manifest, props_dir, scenes_dir=scenes_dir, style=style,
                        hero_count=hero_count, allow_step_ins=allow_step_ins)[0]


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
                   help="do not require new_prop hero modules, new place modules or custom modules yet "
                        "(shot list review before animation)")
    v.add_argument("--allow-step-ins", action="store_true",
                   help="schema 2, drafts and tests only: do not require 1-2 host step-ins")
    a = p.parse_args(argv)
    try:
        d = load_run(a.run_dir)
        scenes_dir = None if a.no_modules else a.run_dir / "04-video" / "hf" / "scenes"
        errs, warns = review_shots(d["shots"], d["words"], d["manifest"], PROPS_DIR,
                                   scenes_dir=scenes_dir, style=d["style"], allow_step_ins=a.allow_step_ins)
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
