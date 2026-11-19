"""Check that this PC is ready: python -m tools.check_setup."""
from __future__ import annotations

import importlib
import importlib.metadata as md
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from tools.audio import library as lib

ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Check:
    name: str
    ok: bool | None  # None = warning only
    detail: str = ""
    fix: str = ""


def check_python(v: tuple = tuple(sys.version_info[:3])) -> Check:
    s = ".".join(map(str, v[:3]))
    fix = "Install Python 3.12: winget install -e --id Python.Python.3.12 (then use py -3.12 -m venv .venv)"
    if v[:2] == (3, 12):
        return Check("Python", True, s)
    if v[:2] == (3, 11):
        return Check("Python", None, f"{s} works, but 3.12 is recommended", fix)
    return Check("Python", False, f"{s} (need 3.12)", fix)


def check_av_version(version: str | None) -> Check:
    fix = 'pip install "av<16"'
    if version is None:
        return Check("av (audio reader)", None, "not installed", fix)
    major = int(version.split(".")[0])
    if major >= 16:
        return Check("av (audio reader)", False, f"{version} is too new", fix)
    return Check("av (audio reader)", True, version)


def check_node(version: str | None) -> Check:
    fix = "winget install -e --id OpenJS.NodeJS.LTS (then close and reopen the terminal)"
    if not version:
        return Check("Node.js", False, "not found", fix)
    major = int(version.lstrip("v").split(".")[0])
    return Check("Node.js", major >= 20, version if major >= 20 else f"{version} (need 20 or newer)", fix)


def check_music(root: Path = lib.DEFAULT_ROOT) -> Check:
    items = [i for i in lib.load_items(root) if i["kind"] == "music"]
    if not items:
        return Check("Music library", False, "no music yet — see assets/audio/DOWNLOAD-LIST.md",
                     "Download tracks per assets/audio/DOWNLOAD-LIST.md and add them with "
                     "python -m tools.audio.library add")
    few = [m for m in lib.MUSIC_MOODS if sum(m in i["tags"] for i in items) < 2]
    if few:
        return Check("Music library", None, f"{len(items)} tracks; fewer than 2 for: {', '.join(few)}",
                     "Add more tracks, see assets/audio/DOWNLOAD-LIST.md")
    return Check("Music library", True, f"{len(items)} tracks")


def check_library(root: Path = lib.DEFAULT_ROOT) -> Check:
    problems = lib.validate(root)
    if problems:
        return Check("Audio library files", False, problems[0], "python -m tools.audio.library validate")
    return Check("Audio library files", True, "valid")


def check_plugin(keyword: str, plugins_dir: Path | None = None) -> Check:
    base = plugins_dir or Path.home() / ".claude" / "plugins"
    found = base.is_dir() and any(keyword in p.name.lower() for p in base.rglob("*") if p.is_dir())
    name = f"Plugin {keyword}"
    if found:
        return Check(name, True, "found")
    return Check(name, None, "not found (may just be installed elsewhere)",
                 f"In Claude Code type /plugin and install '{keyword}' from the Anthropic Directory")


def _import_check(name: str, module: str, fix: str) -> Check:
    try:
        importlib.import_module(module)
    except Exception as e:  # noqa: BLE001 - any import failure means "not usable"
        return Check(name, False, f"cannot import: {type(e).__name__}", fix)
    return Check(name, True, "installed")


def _tool(name: str, fix: str, args: list[str] | None = None) -> Check:
    path = shutil.which(name)
    if not path:
        return Check(name, False, "not found on PATH", fix)
    return Check(name, True, path)


def check_espeak_path(path: str | None) -> Check:
    """espeak-ng on PATH is optional: the voice engine brings its own copy (espeakng_loader)."""
    if path:
        return Check("espeak-ng program", True, path)
    return Check("espeak-ng program", None, "not on PATH (fine: the voice engine has its own copy)",
                 "Optional: winget install -e --id eSpeak-NG.eSpeak-NG")


def _node() -> Check:
    path = shutil.which("node")
    if not path:
        return check_node(None)
    try:
        v = subprocess.run([path, "--version"], capture_output=True, text=True,
                           encoding="utf-8", errors="replace").stdout.strip()
    except OSError:
        return check_node(None)
    return check_node(v)


def _spacy() -> Check:
    fix = "python -m spacy download en_core_web_sm"
    try:
        import spacy
        ok = spacy.util.is_package("en_core_web_sm")
    except Exception:  # noqa: BLE001
        return Check("spaCy English model", False, "spaCy not installed", 'pip install -e ".[voice,review,dev]"')
    return Check("spaCy English model", ok, "en_core_web_sm" if ok else "missing", fix)


def _av() -> Check:
    try:
        return check_av_version(md.version("av"))
    except md.PackageNotFoundError:
        return check_av_version(None)


def _node_modules() -> Check:
    ok = (ROOT / "templates" / "node_modules" / "remotion").exists()
    return Check("Remotion packages", ok, "installed" if ok else "missing",
                 "cd templates, then npm install")


def run_checks() -> list[Check]:
    return [
        check_python(),
        _node(),
        _tool("ffmpeg", "winget install -e --id Gyan.FFmpeg (then reopen the terminal)"),
        _tool("ffprobe", "winget install -e --id Gyan.FFmpeg (ffprobe comes with ffmpeg)"),
        _import_check("espeak-ng (voice helper)", "espeakng_loader", 'pip install -e ".[voice,review,dev]"'),
        check_espeak_path(shutil.which("espeak-ng")),
        _import_check("kokoro (voice)", "kokoro", 'pip install -e ".[voice,review,dev]"'),
        _import_check("faster-whisper (review)", "faster_whisper", 'pip install -e ".[voice,review,dev]"'),
        _spacy(),
        _av(),
        _node_modules(),
        check_library(),
        check_music(),
        check_plugin("remotion"),
        check_plugin("watch-video"),
    ]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass
    failed = False
    for c in run_checks():
        icon = {True: "✅", False: "❌", None: "⚠️"}[c.ok]
        print(f"{icon} {c.name} — {c.detail}")
        if c.ok is not True and c.fix:
            print(f"    fix: {c.fix}")
        failed = failed or c.ok is False
    print("\nNot ready — fix the ❌ lines above." if failed else "\nReady.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
