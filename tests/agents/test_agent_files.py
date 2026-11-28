"""The five subagent files: front matter, hand-off line and the exact tool commands."""
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
AGENTS = ROOT / ".claude" / "agents"
NAMES = ["story", "voice", "design", "animator", "reviewer"]
MOVES_MD = ROOT / "hf-kit" / "MOVES.md"
HOST_OUTFITS = ["blazer", "lab-coat", "casual", "explorer"]
VIDEO_TYPES = ["explainer", "what-if"]
AUDIENCES = ["all-ages", "teens", "adults"]
LATER_TYPES = ["story", "action", "other"]


def kit_moves() -> list[str]:
    """Every move name in the kit's generated vocabulary (hf-kit/MOVES.md, from HFKit.MOVES)."""
    names = re.findall(r"^\| `([a-z_]+)` \|", MOVES_MD.read_text(encoding="utf-8"), re.M)
    assert len(names) >= 25, names
    return names

TEMPLATE_NAMES = ["TitleCard", "Bullets", "Diagram", "Comparison", "BigNumber",
                  "Steps", "Chart", "Quote", "Recap"]
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
    # (also `python -m tools.hf.snapshot "<run_dir>" --overlap`, checked in order below)
    "reviewer": ["python -m tools.pipeline.checks story",
                 "python -m tools.review.transcript voice",
                 "python -m tools.hf.shots validate",
                 "python -m tools.review.transcript final",
                 "python -m tools.audio.measure", "extract_keyframes",
                 'python -m tools.hf.snapshot "<run_dir>" --overlap'],
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


def section(body: str, start: str, end: str | None = None) -> str:
    part = body[body.index(start):]
    return part[:part.index(end)] if end else part


def json_example(body: str, needle: str) -> dict:
    """The fenced ```json block of an agent file that contains `needle`, parsed."""
    blocks = re.findall(r"```json\n(.*?)\n```", body, re.S)
    hits = [b for b in blocks if needle in b]
    assert len(hits) == 1, f"one ```json block with {needle!r} expected, found {len(hits)}"
    return json.loads(hits[0])


def test_story_rules():
    _, body = parse("story")
    for s in ["150–450", "Key claims", "[S1]", "## Scene 1:", "**Narration:**",
              "**Viewer should understand:**", "**Visual idea:**", "01-script/script.md"]:
        assert s in body


def test_story_follows_the_type_recipes():
    _, body = parse("story")
    for s in ["`explainer`", "`what-if`", "hook", "3–5 ideas", "recap", "the question",
              "step by step", "consequences", "twist", "signpost", "plausible",
              "brief.md", "`type:`", "`audience:`", "propose", "later phase",
              "can be shown", "hf-kit/places/README.md", "metaphor"]:
        assert s in body, f"story.md must mention {s!r}"
    for v in AUDIENCES + HOST_OUTFITS:
        assert f"`{v}`" in body, f"story.md must list `{v}`"
    for v in LATER_TYPES:
        assert f"`{v}`" in body, f"story.md must say `{v}` is not made yet"
    # no slides: the visual idea is a scene in a place, never text, icons or a chart
    assert "text, shapes, icons" not in body
    assert "Big number:" not in body


def test_story_header_carries_type_audience_and_outfit_and_still_parses(tmp_path):
    from tools.pipeline.script import parse_script
    _, body = parse("story")
    fmt = re.findall(r"```markdown\n(.*?)\n```", body, re.S)[0]
    head = fmt.split("## Scene 1:", 1)[0]
    for s in ["**Type:**", "**Audience:**", "**Host outfit:**"]:
        assert s in head, f"the script header must carry {s!r}"
    path = tmp_path / "script.md"
    path.write_text(fmt, encoding="utf-8")
    script = parse_script(path)  # the header lines are not narration: the parser ignores them
    assert script.title == "<Video title>"
    assert [s.id for s in script.scenes] == [1, 2]
    assert all("Type" not in s.narration and "outfit" not in s.narration for s in script.scenes)


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


def test_voice_stays_one_narrator_per_scene():
    _, body = parse("voice")
    for s in ["one narrator", "stays per scene", "later phase", "**Type:**", "never read aloud"]:
        assert s in body, f"voice.md must mention {s!r}"


def test_design_lists_allowed_values():
    _, body = parse("design")
    for v in TRANSITIONS + MUSIC_MOODS + SFX_TYPES + HOST_OUTFITS + VIDEO_TYPES + AUDIENCES:
        assert f"`{v}`" in body, f"design.md must list `{v}`"
    # the whole moves vocabulary, as the kit generates it
    for v in kit_moves():
        assert f"`{v}`" in body, f"design.md must list the move `{v}`"
    for s in ["storyboard.md", "style.json", "sound.json", "never writes code"]:
        assert s in body


def test_design_plans_world_shot_list():
    _, body = parse("design")
    for s in ["03-design/shots.json", '"schema":2', "`action`", "`moves`", "`new_place`",
              "04-video/hf/scenes/place-<name>.js", "`custom`", "04-video/hf/scenes/scene-<id>.js",
              "hf-kit/places/README.md", "hf-kit/props/README.md", "hf-kit/MOVES.md", "variant",
              "anchors", "reuse", "facts", "one idea", "step-in", "1–2", "not to scale",
              "true to scale", "tag", "metaphor", "never slides", "`label`", "`until`", "params",
              "word index", "02-voice/words.json", "--no-modules", "shots.json OK", "`follow`",
              "brief", "slip", "head", "Kit warnings", "captions", "extra-<n>", "`cast`",
              "`notToScale`", "4 words"]:
        assert s in body, f"design.md must mention {s!r}"
    # library first: places, then props, before anything new is asked for
    assert body.index("hf-kit/places/README.md") < body.index("hf-kit/props/README.md")
    # the HyperFrames path has no Remotion template list for Iris, and no schema-1 kit/hero plan
    assert "templates/src/schema.ts" not in body
    assert '"kind": "kit"' not in body and '"kind": "hero"' not in body
    assert "2–4 hero" not in body
    # drafts only: the step-ins rule is never switched off by the Design agent
    assert "--allow-step-ins" not in body


def _design_examples():
    _, body = parse("design")
    hits = re.findall(r"```json\n(\{\"schema\":2.*?)\n```", body, re.S)
    assert len(hits) == 2, "design.md has the landscape and the vertical worked example"
    return [json.loads(h) for h in hits]


def test_design_vertical_example_shows_the_vertical_recipe():
    land, vert = _design_examples()
    assert land["format"] == "landscape" and vert["format"] == "vertical"
    scenes = vert["scenes"]
    slots = [a["start"].get("slot") for sc in scenes for a in sc["actors"] if a["id"] == "host"]
    assert "bottom-left" in slots or "bottom-right" in slots
    moves = [m["do"] for sc in scenes for b in sc["beats"] for m in b["moves"]]
    assert "pan_down" in moves or "pan_up" in moves
    _, body = parse("design")
    assert "Framing:** vertical" in body  # the storyboard sample shows a vertical scene


@pytest.mark.parametrize("which", [0, 1], ids=["landscape", "vertical"])
def test_design_example_is_a_valid_world_shot_list(which):
    """Each worked shots.json in design.md passes the real validator (Python and kit checks)."""
    import shutil
    if shutil.which("node") is None:
        pytest.skip("needs node")
    from tools.hf.shots import PROPS_DIR, review_shots
    shots = _design_examples()[which]
    assert shots["schema"] == 2 and shots["type"] in VIDEO_TYPES and shots["audience"] in AUDIENCES
    host = [c for c in shots["cast"] if c["character"] == "host"]
    assert host and host[0]["outfit"] in HOST_OUTFITS
    moves = set(kit_moves())
    for s in shots["scenes"]:
        assert s["kind"] == "world" and s.get("facts") is not None
        for b in s["beats"]:
            assert b["action"] and b["moves"], (s["id"], b)
            for m in b["moves"]:
                assert m["do"] in moves, m
    # words for every index the example uses (0.4 s apart), and room after the last one
    used = [int(n) for n in re.findall(r'"word":\s*(\d+)', json.dumps(shots))]
    n_words = max(used) + 12
    words = {"source": "kokoro", "scenes": [
        {"id": s["id"], "source": "kokoro",
         "words": [{"i": i, "text": f"w{i}", "start": round(i * 0.4, 2), "end": round(i * 0.4 + 0.3, 2)}
                   for i in range(n_words)]} for s in shots["scenes"]]}
    manifest = {"scenes": [{"id": s["id"], "file": f"scene-{s['id']:02d}.wav", "duration_s": n_words * 0.4 + 2}
                           for s in shots["scenes"]]}
    # schema 2 is vertical by default; the example has no `format` yet and is framed for landscape
    # (the vertical recipe comes with the agents' --format work): check it as the format it was made for
    shots.setdefault("format", "landscape")
    errs, warns = review_shots(shots, words, manifest, PROPS_DIR, scenes_dir=None, style=None)
    assert errs == [] and warns == [], (errs, warns)


def test_design_keeps_the_host_moving():
    """The host moves on most beats (gesture / point / react on key words); the kit's talk pose in
    the side slot is only the floor."""
    _, body = parse("design")
    for t in ["Lively, never a statue", "most beats", "`gesture`, `point` or `react`", "talk pose"]:
        assert t in body, f"design.md must mention {t!r}"


def test_design_picks_host_outfit():
    _, body = parse("design")
    for s in ["`cast`", "**Host outfit:**", "science", "health", "technology", "history"]:
        assert s in body, f"design.md must mention {s!r}"
    for v in HOST_OUTFITS:
        assert f"`{v}`" in body
    # the schema-1 presenter outfit (style.json) is gone: the host's outfit is in the cast
    assert "presenterOutfit" not in body


def test_reviewer_checks_host_outfit():
    _, body = parse("reviewer")
    gate3 = section(body, "## Gate 3", "## Gate 4")
    for s in ["`cast`", "**Host outfit:**", "mismatched"] + [f"`{v}`" for v in HOST_OUTFITS]:
        assert s in gate3, f"reviewer.md gate 3 must mention {s!r}"


def test_animator_builds_world_scenes():
    _, body = parse("animator")
    for s in ["04-video/hf/scenes/scene-<id>.js", "04-video/hf/scenes/place-<name>.js",
              "HFKit.customs", "HFKit.places", "meta", "mount", "anchorsFor", "update(t, cam)",
              "HFKit.draw", "hf-kit/places/README.md", "hf-kit/props/README.md", "hf-kit/MOVES.md",
              "hf-kit/src/world/place.js", "only for `custom` moves and new places", "hyperframes check",
              "04-video/hf/snapshots/", "04-video/hf/overlap.json", "--engine hyperframes",
              "timeout: 600000", "timeout: 7200000", "run_in_background: true", "04-video/notes.md",
              "03-design/shots.json", "02-voice/words.json", "Math.random", "LOOK at every snapshot",
              "slip", "head"]:
        assert s in body, f"animator.md must mention {s!r}"
    # custom drawing is expected where the library lacks it: the v1 rule is gone
    assert "Never create custom components" not in body
    assert "must NOT create custom components" not in body
    assert "No custom components" not in body
    # ... but the shared kit is never edited
    assert "never edit `hf-kit/src/`" in body.lower()
    # order: build (check) -> snapshot -> overlap report -> mix -> render
    order = ["python -m tools.hf.build", "python -m tools.hf.snapshot",
             'python -m tools.hf.snapshot "<run_dir>" --overlap', "python -m tools.audio.mix",
             "python -m tools.render.render"]
    i = [body.index(c) for c in order]
    assert i == sorted(i)
    # the render uses HyperFrames explicitly
    assert 'python -m tools.render.render "<run_dir>" --engine hyperframes' in body
    # the step-ins rule is the plan's, never switched off by the Animator
    assert "--allow-step-ins" not in body


def test_animator_runs_build_and_snapshots_in_the_background():
    """A build with `hyperframes check` or a snapshot of a long video can pass 10 minutes on a slow
    PC: they run in the background with a 1-hour limit, like the render (2 hours)."""
    _, body = parse("animator")
    head = body[:body.index("## Step 1")]
    for s in ["run_in_background: true", "timeout: 3600000", "the build (step 2)", "the snapshots (steps 3 and 4)"]:
        assert s in head, f"animator.md must say {s!r} before step 1"
    for cmd in ['python -m tools.hf.build "<run_dir>"\n```', 'python -m tools.hf.snapshot "<run_dir>"\n```',
                'python -m tools.hf.snapshot "<run_dir>" --overlap\n```']:
        after = body[body.index(cmd):][:200]
        assert "run_in_background: true" in after and "timeout: 3600000" in after, f"{cmd!r} must run in the background"
    render = section(body, "## Step 6", "## Step 7")
    assert "run_in_background: true" in render and "timeout: 7200000" in render


def test_animator_place_sheet_path_works_when_run_dir_is_absolute():
    """`--out="../<run_dir>/..."` broke for an absolute run_dir (C:\\...): the sheet script runs
    from the workspace root with the run_dir as given."""
    _, body = parse("animator")
    save = section(body, "## Step 7", "## Fix rounds")
    assert '--out="<run_dir>/04-video/hf/place-sheet"' in save
    assert "../<run_dir>" not in body
    assert "node hf-kit/scripts/world-sheet.mjs" in save


def test_animator_saves_new_props_after_pass():
    _, body = parse("animator")
    for s in ["hf-kit/props/<name>/", "prop.js", "preview.png", "README.md", "one line",
              "owner approved the final video — save the new props", "(cd hf-kit && npm test)",
              "the one allowed edit outside the run folder", "fewest labels"]:
        assert s in body, f"animator.md must mention {s!r}"
    # props are saved only after the owner's final approval, never at gate 4 PASS
    assert "gate 4 PASS" not in body and "after gate 4 passes" not in body


def test_animator_saves_new_places_after_approval():
    _, body = parse("animator")
    save = section(body, "## Step 7", "## Fix rounds")
    for s in ["hf-kit/places/<name>/", "place.js", "preview.png", "README.md", "one line",
              "hf-kit/places/README.md", "owner approved the final video — save the new props and places",
              "(cd hf-kit && npm test)", "new_place", "world-sheet", "--preview", "--only=<name>",
              "--out="]:
        assert s in save, f"animator.md step 7 must mention {s!r}"


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
    # the host's checks (he is an actor in the world now, not a side presenter)
    for s in ["overlap", "mouth", "lively"]:
        assert s in body
    assert "review/frames-gate4-round-<m>/" in body
    assert "02-voice/script-voice.md" in body


def test_reviewer_gate1_checks_the_recipe_and_audience():
    _, body = parse("reviewer")
    gate1 = section(body, "## Gate 1", "## Gate 2")
    for s in ["**Type:**", "**Audience:**", "**Host outfit:**", "`explainer`", "`what-if`", "hook",
              "recap", "consequences", "twist", "signposted", "plausible", "can be shown"] + \
             [f"`{v}`" for v in AUDIENCES]:
        assert s in gate1, f"reviewer.md gate 1 must mention {s!r}"


def test_reviewer_gate3_checks_shot_list():
    _, body = parse("reviewer")
    gate3 = section(body, "## Gate 3", "## Gate 4")
    for s in ["03-design/shots.json", "python -m tools.hf.shots validate", "--no-modules", "facts",
              "WebSearch", "calm", "zoom", "02-voice/words.json", "hf-kit/places/README.md",
              "hf-kit/props/README.md", "hf-kit/MOVES.md", "recipe", "`explainer`", "`what-if`",
              "one idea", "show the sentence", "not to scale", "true to scale", "plausible",
              "signposted", "audience", "step-in", "metaphor", "slide", "warning:", "slip", "head",
              "Kit warnings", "`action`", "`moves`", "new_place", "reuse"]:
        assert s in gate3, f"reviewer.md gate 3 must mention {s!r}"


def test_reviewer_gate4_checks_hyperframes():
    _, body = parse("reviewer")
    gate4 = section(body, "## Gate 4")
    for s in ["hyperframes check", "camera timing NOT checked", "04-video/render.log", "04-video/hf/data.json",
              "±0.3", "02-voice/words.json", "brief", "dizzying", "04-video/hf/snapshots/",
              "hf-kit/props/<name>/", "prop.js", "preview.png", "README.md", "hf-kit/props/README.md",
              "(cd hf-kit && npm test)", "git status --short hf-kit/src templates/", "hf-kit/src",
              "Prop library check (after the owner's final approval)", "review/gate-props-round-<m>.md",
              "earlier videos", "git status --short hf-kit/props/",
              # the world scenes: overlap report, show-don't-tell, the host, captions, places
              'python -m tools.hf.snapshot "<run_dir>" --overlap', "04-video/hf/overlap.json",
              "carries what the picture should", "lively", "step-in", "captions", "readable",
              "hf-kit/places/<name>/", "place.js", "hf-kit/places/README.md",
              "git status --short hf-kit/places/", "Kit warnings"]:
        assert s in gate4, f"reviewer.md gate 4 must mention {s!r}"
    # git diff is not on the allow-list: it would prompt the owner every round
    assert "git diff" not in gate4
    assert "after gate 4 PASS" not in gate4
    # the gate-4 kit check must not flag props or places saved by earlier videos
    assert "git status --short hf-kit/ templates/" not in gate4
    # the v1 "no custom components" must-fix is gone for the HyperFrames path
    assert "allowed in v1" not in gate4
    assert "created a custom component" not in gate4


def test_reviewer_gate4_timeline_script_runs_on_a_world_build(tmp_path):
    """The gate-4 'what should be on screen when' script runs on a real schema-2 build."""
    import shutil
    import subprocess
    import sys
    if shutil.which("node") is None:
        pytest.skip("needs node")
    from tests.hf.run_fixture import make_world_run
    from tools.hf.build import build
    _, body = parse("reviewer")
    gate4 = section(body, "## Gate 4")
    script = re.findall(r"```bash\npython - \"<run_dir>\" <<'PY'\n(.*?)\nPY\n```", gate4, re.S)
    assert len(script) == 1
    run = make_world_run(tmp_path)
    build(run, run_check=False)
    out = subprocess.run([sys.executable, "-", str(run)], input=script[0], capture_output=True,
                         text=True, encoding="utf-8", cwd=ROOT)
    assert out.returncode == 0, out.stderr
    assert "scene 1:" in out.stdout and "countryside" in out.stdout and "scene 2:" in out.stdout
    assert "step-in" in out.stdout  # the host steps into the countryside in scene 1
    assert "beat" in out.stdout and "expected at" in out.stdout
    assert "mouth open expected at" in out.stdout


def test_props_gate_also_covers_places():
    _, body = parse("reviewer")
    gate = section(body, "### Prop library check")
    for s in ["new_place", "hf-kit/places/<name>/", "place.js", "preview.png", "README.md",
              "hf-kit/places/README.md", "HFKit.places", "(cd hf-kit && npm test)",
              "git status --short hf-kit/"]:
        assert s in gate, f"the props gate must mention {s!r}"


# ---- the lessons notebook (feedback notebook, task 2) ----

LESSON_KEYS = {"story": "quill", "voice": "echo", "design": "iris", "animator": "flip",
               "reviewer": "sage"}


@pytest.mark.parametrize("name", NAMES)
def test_agent_reads_the_lessons_first(name):
    _, body = parse(name)
    key = LESSON_KEYS[name]
    sentence = (f"Before you start, run `python -m tools.lessons list --section everyone` and "
                f"`--section {key}` and follow them, unless this video's brief, the owner's notes "
                "or `feedback_file` say otherwise.")
    assert sentence in body
    assert "python -m tools.lessons list --section everyone" in body
    # before the inputs: read at the start
    assert body.index(sentence) < body.index("## Inputs")


def test_reviewer_gate_checklists_check_the_lessons():
    _, body = parse("reviewer")
    for start, end, section_name in [("## Gate 1 ", "## Gate 2 ", "Quill"),
                                     ("## Gate 2 ", "## Gate 3 ", "Echo"),
                                     ("## Gate 3 ", "## Gate 4 ", "Iris"),
                                     ("## Gate 4 ", "### Prop library check", "Flip")]:
        gate = section(body, start, end)
        assert "the work follows `lessons.md`" in gate, start
        assert f"Everyone plus the {section_name} section" in gate, start


def test_reviewer_proposes_lessons_after_final_approval():
    _, body = parse("reviewer")
    part = section(body, "### Lessons proposal (after the owner's final approval)", "\n---\n")
    for s in ["gate: lessons", "review/lessons-proposed.md", "at most 5", "none",
              "review/owner-gate-", "final-video comments", "N. [key] <rule>",
              "replaces sage#2", "40", "merge", "general rule", "one-off"]:
        assert s in part, s
    assert "gate: lessons" in section(body, "## Inputs", "## Output")


# ---- vertical short form (Task 7) ----

def test_story_has_a_short_recipe_for_vertical():
    _, body = parse("story")
    for s in ["`format:`", "`vertical`", "`landscape`", "45–75 s", "30–180 s", "about 2 s",
              "5–8 s", "rewatch", "comment", "**Format:**", "--format"]:
        assert s in body, f"story.md must mention {s!r}"
    # the vertical short is written to the same word limits the check enforces
    assert 'python -m tools.pipeline.checks story "<run_dir>/01-script/script.md" --format <format>' in body


def test_design_sets_format_and_frames_for_the_tall_screen():
    _, body = parse("design")
    for s in ["\"format\":\"vertical\"", "`format`", "**Format:**", "middle band", "tall reveals",
              "`pan_up`", "`pan_down`", "1700", "bottom-left", "bottom-right", "840", "220",
              "x 64–940", "y 200–1420", "active caption band", "landscape", "Kit warnings"]:
        assert s in body, f"design.md must mention {s!r}"
    # the extended spread note is extended, not duplicated
    assert body.count("within 1700 world px") <= 1


def test_animator_runs_overlap_and_safe_zone_and_never_switches_format():
    _, body = parse("animator")
    step4 = section(body, "## Step 4", "## Step 5")
    for s in ['python -m tools.hf.snapshot "<run_dir>" --overlap',
              'python -m tools.hf.snapshot "<run_dir>" --safe-zone',
              "04-video/hf/safe-zone.json", "run_in_background: true", "timeout: 3600000",
              "vertical", "both"]:
        assert s in step4, f"animator.md step 4 must mention {s!r}"
    assert step4.index("--overlap") < step4.index("--safe-zone")
    order = ['python -m tools.hf.snapshot "<run_dir>" --safe-zone', "python -m tools.audio.mix"]
    assert body.index(order[0]) < body.index(order[1])
    fallback = body[body.index("## Remotion fallback"):]
    for s in ["landscape-only", "never switch", "stuck"]:
        assert s in body.lower(), s
    assert "vertical" in fallback
    assert "04-video/hf/safe-zone.json" in section(body, "## Outputs", "## Step 1")


def test_reviewer_checks_the_vertical_rules_at_gates_1_3_4():
    _, body = parse("reviewer")
    gate1 = section(body, "## Gate 1", "## Gate 2")
    for s in ["**Format:**", "`vertical`", "45–75 s", "30–180 s", "about 2 s", "5–8 s", "rewatch", "--format"]:
        assert s in gate1, f"reviewer.md gate 1 must mention {s!r}"
    gate3 = section(body, "## Gate 3", "## Gate 4")
    for s in ["`format`", "middle band", "tall reveals", "1700", "spread", "bottom-left", "bottom-right",
              "active caption band"]:
        assert s in gate3, f"reviewer.md gate 3 must mention {s!r}"
    gate4 = section(body, "## Gate 4")
    for s in ['python -m tools.hf.snapshot "<run_dir>" --safe-zone', "04-video/hf/safe-zone.json",
              "must-fix", "phone", "hook", "vertical"]:
        assert s in gate4, f"reviewer.md gate 4 must mention {s!r}"


def test_reviewer_gate1_check_command_takes_the_format():
    _, body = parse("reviewer")
    gate1 = section(body, "## Gate 1", "## Gate 2")
    assert 'python -m tools.pipeline.checks story "<run_dir>/01-script/script.md" --format <format>' in gate1
    assert 'checks story "<run_dir>/01-script/script.md"\n' not in gate1
