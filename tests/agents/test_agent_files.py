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
KIT_SCENES = ["title", "steps", "compare", "chart", "kinetic", "recap", "diagram"]
TRANSITIONS = ["cut", "fade", "blur", "slide", "zoom"]
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
    "design": ["python -m tools.hf.shots validate", "python -m tools.audio.library list"],
    # HyperFrames path, in this order: build (hyperframes check) -> snapshot -> mix -> render
    "animator": ["python -m tools.hf.build", "python -m tools.hf.snapshot",
                 "python -m tools.audio.mix", "python -m tools.render.render"],
    "reviewer": ["python -m tools.pipeline.checks story",
                 "python -m tools.review.transcript voice",
                 "python -m tools.hf.shots validate",
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
    for s in ["--only", "--voice", "--speed", "--script", "am_adam", "02-voice/notes.md",
              "02-voice/manifest.json", "02-voice/script-voice.md", "SAME WORDS"]:
        assert s in body
    assert "script-before-voice" not in body
    assert "Never edit `01-script/script.md`" in body


def test_voice_checks_word_timings():
    _, body = parse("voice")
    for s in ["02-voice/words.json", "`source`", "`kokoro`", "`whisper`", "`mixed`", "display"]:
        assert s in body, f"voice.md must mention {s!r}"
    # synth writes words.json; the voice agent never writes or edits it
    assert "never edit `02-voice/words.json`" in body.lower()


def test_design_lists_allowed_values():
    _, body = parse("design")
    for v in KIT_SCENES + TRANSITIONS + PRESENTER_POSES + PRESENTER_EXPRESSIONS + MUSIC_MOODS + SFX_TYPES:
        assert f"`{v}`" in body, f"design.md must list `{v}`"
    for s in ["storyboard.md", "style.json", "sound.json", "never writes code"]:
        assert s in body


def test_design_plans_shot_list_and_heroes():
    _, body = parse("design")
    for s in ["03-design/shots.json", "2–4", "hero", "`kind`", "`new_prop`", "hf-kit/props/README.md",
              "reuse", "brief", "facts", "camera", "`wide`", "`focus`", "`follow`", "2.5", "cues",
              "`label`", "`highlight`", "`phase`", "`until`", "word index", "02-voice/words.json",
              "--no-modules", "shots.json OK", "params", "anchors"]:
        assert s in body, f"design.md must mention {s!r}"
    # the HyperFrames path has no Remotion template list for Iris
    assert "templates/src/schema.ts" not in body


def test_design_picks_presenter_outfit():
    _, body = parse("design")
    for s in ["presenterOutfit", "`blazer`", "`labcoat`", "science", "health",
              "technology", "history"]:
        assert s in body, f"design.md must mention {s!r}"


def test_reviewer_checks_presenter_outfit():
    _, body = parse("reviewer")
    gate3 = body[body.index("## Gate 3"):body.index("## Gate 4")]
    for s in ["presenterOutfit", "`blazer`", "`labcoat`", "mismatched"]:
        assert s in gate3, f"reviewer.md gate 3 must mention {s!r}"


def test_animator_builds_hyperframes_heroes():
    _, body = parse("animator")
    for s in ["04-video/hf/scenes/scene-<id>.js", "HFKit.props", "meta", "mount", "update(t, cueState)",
              "anchorsFor(params)", "HFKit.draw", "hf-kit/props/README.md", "hyperframes check",
              "camera timing NOT checked", "04-video/hf/snapshots/", "--engine hyperframes",
              "timeout: 600000", "run_in_background: true", "04-video/notes.md", "03-design/shots.json",
              "02-voice/words.json", "Math.random"]:
        assert s in body, f"animator.md must mention {s!r}"
    # custom hero drawing is now expected: the v1 rule is gone
    assert "Never create custom components" not in body
    assert "must NOT create custom components" not in body
    assert "No custom components" not in body
    # ... but the shared kit is never edited
    assert "never edit `hf-kit/src/`" in body.lower()
    # order: build (check) -> snapshot -> mix -> render
    i = [body.index(c) for c in COMMANDS["animator"]]
    assert i == sorted(i)
    # the render uses HyperFrames explicitly
    assert 'python -m tools.render.render "<run_dir>" --engine hyperframes' in body


def test_animator_saves_new_props_after_pass():
    _, body = parse("animator")
    for s in ["hf-kit/props/<name>/", "prop.js", "preview.png", "README.md", "one line",
              "owner approved the final video — save the new props", "(cd hf-kit && npm test)",
              "the one allowed edit outside the run folder", "fewest labels"]:
        assert s in body, f"animator.md must mention {s!r}"
    # props are saved only after the owner's final approval, never at gate 4 PASS
    assert "gate 4 PASS" not in body and "after gate 4 passes" not in body


def test_animator_keeps_remotion_fallback():
    _, body = parse("animator")
    fallback = body[body.index("## Remotion fallback"):]
    assert "--engine remotion" in fallback
    assert "only when the owner asks" in fallback
    for s in ["scenes.json", "durationInFrames", "python -m tools.voice.mouth", "templates/src/schema.ts"]:
        assert s in fallback, s
    for v in TEMPLATE_NAMES:
        assert f"`{v}`" in fallback
    # order in the fallback: mouth -> mix -> render
    i = [fallback.index(c) for c in ["python -m tools.voice.mouth", "python -m tools.audio.mix",
                                     "python -m tools.render.render"]]
    assert i == sorted(i)
    assert "npm run typecheck" not in body
    assert "templates/src/templates/index.ts" not in body


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


def test_reviewer_gate3_checks_shot_list():
    _, body = parse("reviewer")
    gate3 = body[body.index("## Gate 3"):body.index("## Gate 4")]
    for s in ["03-design/shots.json", "python -m tools.hf.shots validate", "--no-modules", "2–4",
              "hero", "facts", "WebSearch", "calm", "zoom", "cue", "02-voice/words.json",
              "hf-kit/props/README.md"] + [f"`{v}`" for v in KIT_SCENES]:
        assert s in gate3, f"reviewer.md gate 3 must mention {s!r}"


def test_reviewer_gate4_checks_hyperframes():
    _, body = parse("reviewer")
    gate4 = body[body.index("## Gate 4"):]
    for s in ["hyperframes check", "camera timing NOT checked", "04-video/render.log", "04-video/hf/data.json",
              "±0.3", "02-voice/words.json", "brief", "dizzying", "04-video/hf/snapshots/",
              "hf-kit/props/<name>/", "prop.js", "preview.png", "README.md", "hf-kit/props/README.md",
              "(cd hf-kit && npm test)", "git status --short hf-kit/src templates/", "hf-kit/src",
              "Prop library check (after the owner's final approval)", "review/gate-props-round-<m>.md",
              "earlier videos"]:
        assert s in gate4, f"reviewer.md gate 4 must mention {s!r}"
    assert "after gate 4 PASS" not in gate4
    # the gate-4 kit check must not flag props saved by earlier videos
    assert "git status --short hf-kit/ templates/" not in gate4
    # the v1 "no custom components" must-fix is gone for the HyperFrames path
    assert "allowed in v1" not in gate4
    assert "created a custom component" not in gate4
