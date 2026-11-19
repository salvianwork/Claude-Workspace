"""The /make-video orchestrator, the /video-status command, the Notification hook and notify.ps1."""
import json
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
    assert cmd.startswith("powershell -NoProfile -ExecutionPolicy Bypass -File ")
    assert '"tools/notify/notify.ps1"' in cmd


def test_notify_script_is_safe():
    text = NOTIFY.read_text(encoding="utf-8")
    for needle in ["try", "catch", "exit 0", "Video Agent Team",
                   "Windows.UI.Notifications", "System.Windows.Forms",
                   "Video Agent Team needs you"]:
        assert needle in text, needle
