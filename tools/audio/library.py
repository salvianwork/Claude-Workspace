"""Licensed audio library: python -m tools.audio.library add|list|validate."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

ALLOWED_LICENCES = {"CC0-1.0", "Pixabay-Content-License"}
MUSIC_MOODS = ["curious", "upbeat", "calm", "inspiring", "dramatic", "playful"]
SFX_TYPES = ["whoosh", "pop", "ding", "click", "swoosh-in", "reveal"]

NEIGHBOURS = {
    "curious": "playful", "upbeat": "playful", "calm": "inspiring",
    "inspiring": "upbeat", "dramatic": "inspiring", "playful": "upbeat",
}
DEFAULT_ROOT = Path(__file__).resolve().parents[2] / "assets" / "audio"
MIN_LUFS_S = 0.4


class LibraryError(Exception):
    pass


def _atomic_write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def load_items(lib_root: Path) -> list[dict]:
    p = Path(lib_root) / "library.json"
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8")).get("items", [])


def _load_usage(lib_root: Path) -> dict:
    p = Path(lib_root) / "usage.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def _measure(path: Path) -> tuple[float, float | None]:
    data, sr = sf.read(str(path), always_2d=True)
    duration = len(data) / sr
    if duration < MIN_LUFS_S:
        return duration, None
    mono = data.mean(axis=1)
    try:
        lufs = float(pyln.Meter(sr).integrated_loudness(mono))
    except Exception:
        return duration, None
    if not np.isfinite(lufs):
        return duration, None
    return duration, round(lufs, 2)


def add_item(lib_root: Path, file: Path, kind: str, tags: list[str],
             licence: str, source_url: str) -> dict:
    lib_root, file = Path(lib_root), Path(file)
    if licence not in ALLOWED_LICENCES:
        raise ValueError(f"Licence {licence!r} not allowed; use one of {sorted(ALLOWED_LICENCES)}")
    if kind not in ("music", "sfx"):
        raise ValueError(f"kind must be 'music' or 'sfx', got {kind!r}")
    allowed = MUSIC_MOODS if kind == "music" else SFX_TYPES
    bad = [t for t in tags if t not in allowed]
    if bad or not tags:
        raise ValueError(f"Invalid {kind} tags {bad or tags}; allowed: {allowed}")
    if not file.exists():
        raise ValueError(f"File not found: {file}")

    items = load_items(lib_root)
    stem = re.sub(r"[^a-z0-9]+", "-", file.stem.lower()).strip("-") or "item"
    ids = {i["id"] for i in items}
    base = f"{kind}-{stem}"
    item_id, n = base, 2
    while item_id in ids:
        item_id, n = f"{base}-{n}", n + 1

    duration, lufs = _measure(file)
    dest_dir = lib_root / kind
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{item_id[len(kind) + 1:]}{file.suffix.lower()}"
    if file.resolve() != dest.resolve():
        shutil.copy2(file, dest)
    item = {
        "id": item_id, "path": f"{kind}/{dest.name}", "kind": kind, "tags": list(tags),
        "duration_s": round(duration, 3), "licence": licence,
        "source_url": source_url, "lufs": lufs,
    }
    items.append(item)
    _atomic_write(lib_root / "library.json", {"items": items})
    return item


def _lru(candidates: list[dict], usage: dict) -> dict:
    return min(candidates, key=lambda i: (usage.get(i["id"], ""), i["id"]))


def pick_music(lib_root: Path, mood: str, min_length_s: float) -> tuple[dict, list[str]]:
    music = [i for i in load_items(lib_root) if i["kind"] == "music"]
    if not music:
        raise LibraryError("No music in the library — see assets/audio/DOWNLOAD-LIST.md")
    usage = _load_usage(lib_root)
    warnings: list[str] = []

    def choose(pool: list[dict]) -> dict:
        long_enough = [i for i in pool if i["duration_s"] >= min_length_s]
        pick = _lru(long_enough or pool, usage)
        if not long_enough and pick["duration_s"] < min_length_s:
            warnings.append(f"track {pick['id']} is {pick['duration_s']:.0f}s, shorter than the "
                            f"{min_length_s:.0f}s needed; it will be looped")
        return pick

    pool = [i for i in music if mood in i["tags"]]
    if pool:
        return choose(pool), warnings
    neighbour = NEIGHBOURS.get(mood)
    pool = [i for i in music if neighbour and neighbour in i["tags"]]
    if pool:
        pick = choose(pool)
        warnings.append(f"no music with mood '{mood}'; used '{neighbour}' instead ({pick['id']})")
        return pick, warnings
    pick = choose(music)
    used = pick["tags"][0] if pick["tags"] else "untagged"
    warnings.append(f"no music with mood '{mood}'; used '{used}' instead ({pick['id']})")
    return pick, warnings


def pick_sfx(lib_root: Path, type_: str) -> dict:
    pool = [i for i in load_items(lib_root) if i["kind"] == "sfx" and type_ in i["tags"]]
    if not pool:
        raise LibraryError(f"No sound effect of type '{type_}' in the library")
    return _lru(pool, _load_usage(lib_root))


def mark_used(lib_root: Path, item_ids: list[str]) -> None:
    usage = _load_usage(lib_root)
    now = datetime.now().isoformat(timespec="microseconds")
    for i in item_ids:
        usage[i] = now
    _atomic_write(Path(lib_root) / "usage.json", usage)


def write_credits(items: list[dict], out: Path) -> None:
    lines = ["# Credits", "", "| File | Kind | Licence | Source |", "| --- | --- | --- | --- |"]
    for i in items:
        lines.append(f"| {i['path']} | {i['kind']} | {i['licence']} | {i['source_url']} |")
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def validate(lib_root: Path) -> list[str]:
    problems = []
    for i in load_items(lib_root):
        if not (Path(lib_root) / i["path"]).exists():
            problems.append(f"{i['id']}: file missing ({i['path']})")
        if i["licence"] not in ALLOWED_LICENCES:
            problems.append(f"{i['id']}: licence not allowed ({i['licence']})")
        if not i.get("source_url"):
            problems.append(f"{i['id']}: no source URL")
    return problems


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to a narrow code page
    except Exception:  # noqa: BLE001
        pass
    ap = argparse.ArgumentParser(prog="tools.audio.library")
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add")
    a.add_argument("file", type=Path)
    a.add_argument("--kind", required=True, choices=["music", "sfx"])
    a.add_argument("--tags", required=True, help="comma-separated")
    a.add_argument("--licence", required=True)
    a.add_argument("--source-url", required=True)
    sub.add_parser("list")
    sub.add_parser("validate")
    args = ap.parse_args(argv)

    if args.cmd == "add":
        try:
            item = add_item(args.root, args.file, args.kind,
                            [t.strip() for t in args.tags.split(",") if t.strip()],
                            args.licence, args.source_url)
        except ValueError as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
        print(f"added {item['id']} ({item['duration_s']}s, LUFS {item['lufs']})")
        return 0
    if args.cmd == "list":
        for i in load_items(args.root):
            print(f"{i['id']:32} {i['kind']:5} {','.join(i['tags']):12} "
                  f"{i['duration_s']:7.1f}s {i['licence']}")
        return 0
    problems = validate(args.root)
    items = load_items(args.root)
    if not any(i["kind"] == "music" for i in items):
        print("warning: no music yet — see DOWNLOAD-LIST.md")
    if problems:
        print("\n".join(problems))
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
