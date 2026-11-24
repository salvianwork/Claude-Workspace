import json
import os
import sys
import textwrap
from pathlib import Path

import pytest

from tools.start import __main__ as start
from tools.start.__main__ import main, pid_alive

REPO = Path(__file__).resolve().parents[2]

FAKE_STUDIO = textwrap.dedent("""
    import sys, http.server
    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200); self.end_headers(); self.wfile.write(b"ok")
        def log_message(self, *a): pass
    s = http.server.HTTPServer(("127.0.0.1", 0), H)
    print("Studio running at http://127.0.0.1:%d/?key=x" % s.server_address[1], flush=True)
    s.serve_forever()
""")
FAKE_BAD_STUDIO = "import sys\nprint('boom', flush=True)\nsys.exit(3)\n"
FAKE_CLAUDE = textwrap.dedent("""
    import json, os, sys
    open(os.environ["CLAUDE_OUT"], "w").write(json.dumps({"argv": sys.argv[1:], "cwd": os.getcwd()}))
    sys.exit(int(os.environ.get("CLAUDE_EXIT", "0")))
""")


@pytest.fixture
def env(tmp_path):
    (tmp_path / "studio.py").write_text(FAKE_STUDIO)
    (tmp_path / "bad.py").write_text(FAKE_BAD_STUDIO)
    (tmp_path / "claude.py").write_text(FAKE_CLAUDE)
    root = tmp_path / "root"
    root.mkdir()
    return {
        "root": root,
        "env": {
            "PATH": os.environ.get("PATH", ""),
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
            "TOOLS_START_NO_BROWSER": "1",
            "TOOLS_START_STUDIO_ARGS": json.dumps([sys.executable, str(tmp_path / "studio.py")]),
            "TOOLS_START_CLAUDE": json.dumps([sys.executable, str(tmp_path / "claude.py")]),
            "CLAUDE_OUT": str(tmp_path / "claude_out.json"),
            "TOOLS_START_STUDIO_TIMEOUT": "10",
        },
        "out": tmp_path / "claude_out.json",
        "tmp": tmp_path,
    }


def run(e, args=()):
    return main(list(args), env=e["env"], root=e["root"])


def state(e):
    return json.loads((e["root"] / ".studio" / "studio.json").read_text())


def test_starts_and_stops_studio_around_claude(env):
    seen = {}
    real = start.stop_process

    def spy(proc):
        seen["pid"] = proc.pid
        real(proc)

    start.stop_process = spy
    try:
        assert run(env, ["--continue"]) == 0
    finally:
        start.stop_process = real
    out = json.loads(env["out"].read_text())
    assert out["argv"] == ["--continue"]
    assert Path(out["cwd"]).resolve() == env["root"].resolve()
    assert not pid_alive(seen["pid"])
    assert not (env["root"] / ".studio" / "studio.json").exists()
    assert "Studio running at" in (env["root"] / ".studio" / "studio.log").read_text()


def test_keep_studio_leaves_it_running_and_next_launch_reuses_it(env):
    env["env"]["CLAUDE_EXIT"] = "0"
    assert run(env, ["--keep-studio"]) == 0
    st = state(env)
    try:
        assert pid_alive(st["pid"])
        # second launch reuses, does not start another, and does not stop it
        env["env"]["TOOLS_START_STUDIO_ARGS"] = json.dumps([sys.executable, str(env["tmp"] / "bad.py")])
        assert run(env) == 0
        assert state(env) == st
        assert pid_alive(st["pid"])
    finally:
        os.kill(st["pid"], 15) if os.name != "nt" else os.system(f"taskkill /F /PID {st['pid']}")


def test_missing_claude_keeps_studio_and_says_so(env, capsys):
    env["env"]["TOOLS_START_CLAUDE"] = str(env["tmp"] / "nope-not-here")
    code = run(env)
    st = state(env)
    try:
        assert code != 0
        text = capsys.readouterr().out
        assert "https://claude.ai/download" in text and "still running" in text
        assert pid_alive(st["pid"])
    finally:
        os.kill(st["pid"], 15) if os.name != "nt" else os.system(f"taskkill /F /PID {st['pid']}")


def test_missing_claude_on_path(env, capsys):
    del env["env"]["TOOLS_START_CLAUDE"]
    env["env"]["PATH"] = str(env["tmp"])  # nothing named claude here
    code = run(env, ["--keep-studio"])
    st = state(env)
    try:
        assert code != 0
        assert "not found" in capsys.readouterr().out
    finally:
        os.kill(st["pid"], 15) if os.name != "nt" else os.system(f"taskkill /F /PID {st['pid']}")


def test_studio_failure_still_runs_claude(env, capsys):
    env["env"]["TOOLS_START_STUDIO_ARGS"] = json.dumps([sys.executable, str(env["tmp"] / "bad.py")])
    assert run(env) == 0
    assert env["out"].exists()
    assert "studio.log" in capsys.readouterr().out
    assert "boom" in (env["root"] / ".studio" / "studio.log").read_text()
    assert not (env["root"] / ".studio" / "studio.json").exists()


def test_exit_code_passthrough(env):
    env["env"]["CLAUDE_EXIT"] = "7"
    assert run(env) == 7


def test_pid_alive_basics():
    assert pid_alive(os.getpid())
    assert not pid_alive(0)
    assert not pid_alive(-5)


def test_studio_cmd_launcher():
    raw = (REPO / "studio.cmd").read_bytes()
    text = raw.decode("ascii")
    assert "%~dp0" in text
    assert "cd /d" in text
    assert r".venv\Scripts\python.exe -m tools.start" in text
    assert "%*" in text
    assert "Run the setup first (docs/SETUP.md)" in text
    assert raw.count(b"\r\n") == raw.count(b"\n"), "studio.cmd must use CRLF endings"
    assert "*.cmd text eol=crlf" in (REPO / ".gitattributes").read_text()
