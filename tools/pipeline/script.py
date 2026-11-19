"""Parser for 01-script/script.md."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

LABELS = {
    "narration": "Narration",
    "understand": "Viewer should understand",
    "visual": "Visual idea",
}
_SCENE_RE = re.compile(r"^##\s+Scene\s+(\d+)\s*:\s*(.*)$")
_LABEL_RE = re.compile(r"^\*\*(Narration|Viewer should understand|Visual idea):\*\*\s*(.*)$")
_KEY_FIELD = {v: k for k, v in LABELS.items()}


class ScriptFormatError(ValueError):
    """The script.md does not follow the pinned format."""


@dataclass
class Scene:
    id: int
    title: str
    narration: str
    understand: str
    visual: str


@dataclass
class Script:
    title: str
    scenes: list[Scene] = field(default_factory=list)
    claims: list[str] = field(default_factory=list)


def parse_script(path: Path) -> Script:
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    title = ""
    scenes_raw: list[dict] = []  # {id, title, fields: {key: [lines]}}
    claims: list[str] = []
    section = "top"
    current_field = None
    for line in lines:
        stripped = line.strip()
        m = _SCENE_RE.match(stripped)
        if m:
            scenes_raw.append({"id": int(m.group(1)), "title": m.group(2).strip(), "fields": {}})
            section, current_field = "scene", None
            continue
        if re.match(r"^##\s+Key claims\s*$", stripped, re.I):
            section, current_field = "claims", None
            continue
        if stripped.startswith("# ") and not title:
            title = stripped[2:].strip()
            continue
        if section == "scene":
            lm = _LABEL_RE.match(stripped)
            if lm:
                current_field = _KEY_FIELD[lm.group(1)]
                scenes_raw[-1]["fields"][current_field] = [lm.group(2)]
            elif stripped and current_field:
                scenes_raw[-1]["fields"][current_field].append(stripped)
        elif section == "claims" and stripped.startswith("- "):
            claims.append(stripped[2:].strip())
    if not title:
        raise ScriptFormatError("Missing title line '# <Video title>'")
    scenes = []
    for raw in scenes_raw:
        values = {}
        for key, label in LABELS.items():
            if key not in raw["fields"]:
                raise ScriptFormatError(f"Scene {raw['id']}: missing field '{label}'")
            values[key] = " ".join(raw["fields"][key]).strip()
        scenes.append(Scene(raw["id"], raw["title"], values["narration"],
                            values["understand"], values["visual"]))
    if not scenes:
        raise ScriptFormatError("No '## Scene <n>: <title>' sections found")
    return Script(title, scenes, claims)


def word_count(script: Script) -> int:
    """Narration words: whitespace tokens containing at least one letter or digit."""
    return sum(
        1
        for scene in script.scenes
        for tok in scene.narration.split()
        if any(c.isalnum() for c in tok)
    )


def estimate_seconds(script: Script, wpm: int = 150) -> float:
    return word_count(script) / wpm * 60
