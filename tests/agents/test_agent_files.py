"""The five subagent files: front matter, hand-off line and the exact tool commands."""
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
AGENTS = ROOT / ".claude" / "agents"
NAMES = ["story", "voice", "design", "animator", "reviewer"]

TEMPLATE_NAMES = ["TitleCard", "Bullets", "Diagram", "Comparison", "BigNumber",
                  "Steps", "Chart", "Quote", "Recap"]
PRESENTER_POSES = ["idle", "talk", "point-left", "point-right", "think",
                   "surprised", "celebrate", "wave"]
PRESENTER_EXPRESSIONS = ["neutral", "happy", "curious", "surprised", "thinking"]
MUSIC_MOODS = ["curious", "upbeat", "calm", "inspiring", "dramatic", "playful"]
SFX_TYPES = ["whoosh", "pop", "ding", "click", "swoosh-in", "reveal"]

TOOLS = {
    "story": "Read, Write, Edit, Bash, WebSearch",
    "voice": "Read, Write, Edit, Bash",
    "design": "Read, Write, Edit, Bash",
    "animator": "Read, Write, Edit, Bash, Glob, Grep",
    "reviewer": "Read, Write, Bash, Glob, Grep, WebSearch, WebFetch, Skill",
}

COMMANDS = {
    "story": ["python -m tools.pipeline.checks story"],
    "voice": ["python -m tools.voice.synth", "python -m tools.review.transcript voice"],
    "design": [],
    "animator": ["python -m tools.voice.mouth", "python -m tools.audio.mix",
                 "python -m tools.render.render"],
    "reviewer": ["python -m tools.pipeline.checks story",
                 "python -m tools.review.transcript voice",
                 "python -m tools.review.transcript final",
                 "python -m tools.audio.measure", "extract_keyframes"],
}


def parse(name: str) -> tuple[dict, str]:
    text = (AGENTS / f"{name}.md").read_text(encoding="utf-8")
    assert text.startswith("---\n"), f"{name}.md must start with front matter"
    _, front, body = text.split("---\n", 2)
    meta = {}
    for line in front.strip().splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    return meta, body


@pytest.mark.parametrize("name", NAMES)
def test_front_matter(name):
    meta, _ = parse(name)
    assert meta["name"] == name
    assert meta.get("description")
    assert meta["tools"] == TOOLS[name]
    assert "model" not in meta


@pytest.mark.parametrize("name", NAMES)
def test_body_has_hand_off_and_rules(name):
    _, body = parse(name)
    assert "When done, reply with exactly: DONE" in body
    assert "run_dir" in body
    assert "feedback_file" in body
    assert "status.json" in body  # told never to edit it


@pytest.mark.parametrize("name", NAMES)
def test_body_uses_exact_commands(name):
    _, body = parse(name)
    for cmd in COMMANDS[name]:
        assert cmd in body, f"{name}.md must mention {cmd!r}"


def test_story_rules():
    _, body = parse("story")
    for s in ["150–450", "Key claims", "[S1]", "## Scene 1:", "**Narration:**",
              "**Viewer should understand:**", "**Visual idea:**", "01-script/script.md"]:
        assert s in body


def test_voice_rules():
    _, body = parse("voice")
    assert "never words" in body
    for s in ["--only", "--voice", "--speed", "--script", "am_michael", "02-voice/notes.md",
              "02-voice/manifest.json", "02-voice/script-voice.md", "SAME WORDS"]:
        assert s in body
    assert "script-before-voice" not in body
    assert "Never edit `01-script/script.md`" in body


def test_design_lists_allowed_values():
    _, body = parse("design")
    for v in TEMPLATE_NAMES + PRESENTER_POSES + PRESENTER_EXPRESSIONS + MUSIC_MOODS + SFX_TYPES:
        assert f"`{v}`" in body, f"design.md must list `{v}`"
    for s in ["storyboard.md", "style.json", "sound.json", "never writes code"]:
        assert s in body


def test_animator_lists_templates_and_schema():
    _, body = parse("animator")
    for v in TEMPLATE_NAMES:
        assert f"`{v}`" in body
    for s in ["templates/src/schema.ts", "templates/README.md", "scenes.json",
              "presenter", "durationInFrames", "Never create custom components",
              "closest template", "04-video/notes.md"]:
        assert s in body
    # v1 ruling: no custom components, never touch the shared templates
    assert "npm run typecheck" not in body
    assert "templates/src/templates/index.ts" not in body
    # order: mouth -> mix -> render
    i = [body.index(c) for c in COMMANDS["animator"]]
    assert i == sorted(i)


def test_reviewer_gates_and_template():
    _, body = parse("reviewer")
    for s in ["Gate 1", "Gate 2", "Gate 3", "Gate 4", "Must-fix", "Suggestions",
              "Sources", "PASS", "FIX", "review/gate-<n>-round-<m>.md", "watch-video",
              "DONE <review file path> PASS|FIX"]:
        assert s in body
    # §6.6 presenter checks
    for s in ["overlap", "mouth", "large"]:
        assert s in body
    assert "review/frames-gate4-round-<m>/" in body
    assert "02-voice/script-voice.md" in body
