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
    for needle in ["▶ [n/4] <Name> (<Agent>) is working…",
                   "🔍 <Reviewer name> is checking the <thing> (round r/3)…",
                   "▶ [1/4] Quill (Story) is working…",
                   "🔍 Sage is checking the script (round r/3)…",
                   "✅ Gate", "⏸ Waiting for you:", "🎬 Done:",
                   "…or answer on the studio board"]:
        assert needle in text, needle
    # names come from team.json, read once per run
    assert "python -m tools.dashboard.answers team" in text


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
    assert "team.json" in text and "Quill" in text  # names shown, from format_status


def test_settings_has_notification_hook():
    data = json.loads(SETTINGS.read_text(encoding="utf-8"))
    # The owner approved a narrow allow-list; risky commands must still prompt.
    allow = data.get("permissions", {}).get("allow", [])
    for broad in ("Bash", "Bash(*)", "Bash(python *)", "Bash(npm *)", "Bash(git *)", "Edit", "Write"):
        assert broad not in allow, broad
    assert not any(r.startswith(("Bash(rm", "Bash(git push", "Bash(pip", "Bash(npm install")) for r in allow)
    assert "defaultMode" not in data.get("permissions", {})
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



# ---- the studio board (answers from a browser) ----

CHECKPOINT_OPTIONS = {
    "gate-1": "approve,changes",
    "gate-1-changed-lines": "approve,changes",
    "gate-2": "approve,changes",
    "stuck-gate-<n>": "accept,directions,cancel",
    "final": "approve,changes",
    "question": "answer",
}
CHECKPOINT_LINKS = {
    "gate-1": ["01-script/script.md", "review/gate-1-round-<r>.md"],
    "gate-2": ["02-voice/manifest.json"],
    "stuck-gate-<n>": ["review/gate-<n>-round-3.md"],
    "final": ["04-video/out/video.mp4", "04-video/credits.md"],
}
BOARD_PLACEHOLDERS = {"<id>": "gate-1-1", "<decision>": "approve", "<n>": "1", "<r>": "1",
                      "<k>": "1"}


def answers_commands() -> list[str]:
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    return re.findall(r"python -m tools\.dashboard\.answers [^`\n]*", text)


def wait_commands() -> list[str]:
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    return re.findall(r"python -m tools\.dashboard\.wait [^`\n]*", text)


def _fill(cmd: str, run: Path) -> list[str]:
    filled = cmd.replace('"<run_dir>"', shlex.quote(str(run)))
    for key, value in BOARD_PLACEHOLDERS.items():
        filled = filled.replace(key, value)
    return shlex.split(filled)[3:]  # drop "python -m tools.dashboard.<x>"


def test_make_video_uses_the_studio_board():
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    for needle in ["tools.dashboard.answers request", "tools.dashboard.answers write",
                   "tools.dashboard.answers show", "tools.dashboard.wait",
                   "run_in_background: true", "--source chat", "already answered",
                   "timeout", "owner approved final video", "board/request.json"]:
        assert needle in text, needle
    for checkpoint in CHECKPOINT_OPTIONS:
        assert f"--checkpoint {checkpoint} " in text, checkpoint
    assert "final" in text


def test_every_checkpoint_request_is_complete():
    reqs = [c for c in answers_commands() if c.startswith("python -m tools.dashboard.answers request")]
    seen = set()
    for cmd in reqs:
        argv = shlex.split(cmd.replace('"<run_dir>"', "RUN"))
        assert argv[4] == "RUN", cmd  # the run folder, quoted
        cp = argv[argv.index("--checkpoint") + 1]
        assert cp in CHECKPOINT_OPTIONS, cmd
        assert argv[argv.index("--options") + 1] == CHECKPOINT_OPTIONS[cp], cmd
        assert "--title" in argv and "--body" in argv, cmd
        body = argv[argv.index("--body") + 1]
        assert body and not any(ch in body for ch in "*#`"), cmd  # short plain text
        links = [argv[i + 1] for i, a in enumerate(argv) if a == "--link"]
        for path in CHECKPOINT_LINKS.get(cp, []):
            assert any(link.endswith("=" + path) for link in links), (cp, path)
        seen.add(cp)
    assert seen == set(CHECKPOINT_OPTIONS)


def test_every_answers_command_runs_against_the_real_cli(tmp_path):
    from tools.dashboard import answers
    cmds = answers_commands()
    assert len(cmds) >= 9
    for i, cmd in enumerate(cmds):
        run = tmp_path / f"run {i}"  # a space, like the owner's path
        run.mkdir()
        assert '"<run_dir>"' in cmd or " team" in cmd, cmd
        argv = _fill(cmd, run)
        if argv[0] in ("write", "show"):
            answers.write_request(run, "gate-1", "T", "B", sorted(answers.DECISIONS))
        try:
            code = answers.main(argv)
        except SystemExit as e:  # argparse error
            code = e.code
        assert code == 0, cmd


def test_every_wait_command_runs_against_the_real_cli(tmp_path):
    from tools.dashboard import wait
    cmds = wait_commands()
    assert cmds
    for cmd in cmds:
        assert '"<run_dir>"' in cmd and "--id <id>" in cmd, cmd
        try:
            code = wait.main(_fill(cmd, tmp_path) + ["--timeout", "0"])
        except SystemExit as e:
            code = e.code
        assert code == 3, cmd  # parsed fine, nothing answered → timeout


def test_checkpoints_record_waiting_before_the_request():
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    for start, end in [("### 4.1", "### 4.2"), ("### 4.2", "## 5."), ("## 5.", "## 6."),
                       ("## 6.", "## 7.")]:
        part = text.split(start, 1)[1].split(end, 1)[0]
        waits = [m.start() for m in re.finditer(r"--state (waiting_owner|failed)", part)]
        reqs = [m.start() for m in re.finditer(r"tools\.dashboard\.answers request", part)]
        assert waits and reqs, start
        assert min(waits) < min(reqs), start


def test_resume_re_arms_the_waiter():
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    resume = text.split("## 8. Resume", 1)[1]
    for needle in ["board/request.json", "tools.dashboard.answers show", "same id",
                   "final video"]:
        assert needle in resume, needle


def test_waiter_gets_the_two_hour_bash_timeout():
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    lines = [ln for ln in text.splitlines() if "run_in_background" in ln]
    assert len(lines) >= 2  # start + re-arm
    for ln in lines:
        assert "timeout: 7200000" in ln, ln
    assert "any other exit code" in text.lower()


def test_final_checkpoint_does_not_say_done_before_approval():
    text = MAKE_VIDEO.read_text(encoding="utf-8")
    final = text.split("## 6.", 1)[1].split("## 7.", 1)[0]
    assert "🎬 Done:" not in final
    progress = text.split("## 7.", 1)[1].split("## 8.", 1)[0]
    for needle in ["🎬 Finished:", "🎞 Video ready:", "Your board answer was already used:"]:
        assert needle in text, needle
    for needle in ["🎬 Finished:", "🎞 Video ready:"]:
        assert needle in progress, needle
