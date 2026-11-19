"""The /make-video orchestrator, the /video-status command, the Notification hook and notify.ps1."""
import json
import re
import shlex
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
COMMANDS = ROOT / ".claude" / "commands"
MAKE_VIDEO = COMMANDS / "make-video.md"
VIDEO_STATUS = COMMANDS / "video-status.md"
SETTINGS = ROOT / ".claude" / "settings.json"
NOTIFY = ROOT / "tools" / "notify" / "notify.ps1"

AGENT_NAMES = ["story", "voice", "design", "animator", "reviewer"]
STEPS = ["story", "voice", "design", "animator"]


def front_matter(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    assert text.startswith("---\n"), f"{path.name} must start with front matter"
    _, front, body = text.split("---\n", 2)
    meta = {}
    for line in front.strip().splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    return meta, body


@pytest.mark.parametrize("path", [MAKE_VIDEO, VIDEO_STATUS], ids=lambda p: p.name)
def test_command_front_matter(path):
    meta, body = front_matter(path)
    assert meta.get("description")
    assert meta.get("argument-hint")
    assert "$ARGUMENTS" in body


def test_make_video_mentions_steps_gates_rounds_and_resume():
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    for step in STEPS:
        assert step in text
    for n in range(1, 5):
        assert f"gate {n}" in text.lower() or f"gate-{n}" in text
    for word in ["round", "3", "waiting_owner", "--resume"]:
        assert word in text


def test_make_video_uses_all_agents_and_tools():
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    for name in AGENT_NAMES:
        assert f"`{name}`" in text, name
    for needle in ["review/owner-gate-", "--only", "tools.pipeline.status update",
                   "tools.pipeline.status init", "subagent_type"]:
        assert needle in text, needle


def test_make_video_progress_lines():
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    for needle in ["▶ [n/4] <Agent> agent is working…",
                   "🔍 Reviewer checking <step> (round r/3)…",
                   "✅ Gate", "⏸ Waiting for you:", "🎬 Done:"]:
        assert needle in text, needle


def test_make_video_status_states_are_valid():
    from tools.pipeline.status import STATES
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    for state in STATES:
        assert f"--state {state}" in text, state


def test_video_status_calls_status_tool():
    text = VIDEO_STATUS.read_text(encoding="utf-8")
    assert "tools.pipeline.status" in text
    assert "python -m tools.pipeline.status show" in text
    assert "python -m tools.pipeline.status list" in text


def test_settings_has_notification_hook():
    data = json.loads(SETTINGS.read_text(encoding="utf-8"))
    assert "permissions" not in data
    entries = data["hooks"]["Notification"]
    hooks = [h for e in entries for h in e["hooks"]]
    assert any(h["type"] == "command" and "notify.ps1" in h["command"] for h in hooks)
    cmd = next(h["command"] for h in hooks if "notify.ps1" in h["command"])
    assert cmd == ('powershell -NoProfile -ExecutionPolicy Bypass -File '
                   '"$CLAUDE_PROJECT_DIR/tools/notify/notify.ps1"')


def test_notify_script_is_safe():
    text = NOTIFY.read_text(encoding="utf-8")
    for needle in ["try", "catch", "exit 0", "Video Agent Team",
                   "Windows.UI.Notifications", "System.Windows.Forms",
                   "Video Agent Team needs you"]:
        assert needle in text, needle


PLACEHOLDERS = {"<s>": "story", "<agent>": "reviewer", "<r+1>": "2", "<r>": "1", "<n>": "1"}


def status_update_commands() -> list[str]:
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    # one command per line, ending at the line end or at a closing inline-code backtick
    return re.findall(r"python -m tools\.pipeline\.status update [^`\n]*", text)


def test_every_status_update_is_a_full_command():
    cmds = status_update_commands()
    assert len(cmds) >= 10
    for cmd in cmds:
        assert '"<run_dir>"' in cmd, cmd
        assert "--agent " in cmd, cmd
        assert "--event " in cmd, cmd
    # no shorthand like `--event "..."` outside a full command
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    assert text.count("--event ") == sum(c.count("--event ") for c in cmds)


def test_every_status_update_runs_against_the_real_parser(tmp_path):
    from tools.pipeline.status import init_run, main
    run = init_run("Test topic", tmp_path / "videos")
    for cmd in status_update_commands():
        filled = cmd.replace('"<run_dir>"', shlex.quote(str(run)))
        for key, value in PLACEHOLDERS.items():
            filled = filled.replace(key, value)
        argv = shlex.split(filled)[3:]  # drop "python -m tools.pipeline.status"
        try:
            code = main(argv)
        except SystemExit as e:  # argparse error
            code = e.code
        assert code == 0, cmd


def test_make_video_preflight_checks_the_venv_first():
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    section1 = text.split("## 1. Start or resume", 1)[1]
    pre = section1.index('python -c "import sys, kokoro; print(sys.prefix)"')
    assert pre < section1.index("starts with `--resume`") and pre < section1.index("tools.pipeline.status init")
    assert ".venv\\Scripts\\activate" in section1 and "SAME terminal" in section1
    assert "stop" in section1[pre:pre + 600].lower()


@pytest.mark.parametrize("agent,needles", [
    ("animator", ["timeout: 600000", "run_in_background: true"]),
    ("voice", ["timeout: 600000", "bm_george", "bm_fable", "bm_lewis"]),
    ("reviewer", ["timeout: 600000"]),
])
def test_long_commands_get_long_timeouts(agent, needles):
    text = (ROOT / ".claude" / "agents" / f"{agent}.md").read_text(encoding="utf-8")
    for n in needles:
        assert n in text, n
    if agent == "reviewer":
        assert text.count("timeout: 600000") >= 3  # gate-2 transcript, keyframes, final transcript
