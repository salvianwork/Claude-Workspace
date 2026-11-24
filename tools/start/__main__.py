"""python -m tools.start [--keep-studio] [claude args...]

Starts the pixel studio in the background, then runs Claude Code in this terminal.
When Claude exits, the studio is stopped (only if this launch started it).
Overrides for tests: TOOLS_START_CLAUDE, TOOLS_START_STUDIO_ARGS (a JSON list or one
program path), TOOLS_START_STUDIO_TIMEOUT, TOOLS_START_NO_BROWSER.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
URL_RE = re.compile(r"Studio running at (\S+)")


def _cmd_from_env(value: str) -> list[str]:
    value = value.strip()
    if value.startswith("["):
        return [str(x) for x in json.loads(value)]
    return [value]


def pid_alive(pid: int) -> bool:
    """Cross-platform liveness check (never os.kill(pid, 0) on Windows)."""
    if not isinstance(pid, int) or pid <= 0:
        return False
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        k32 = ctypes.windll.kernel32
        k32.OpenProcess.restype = wintypes.HANDLE
        handle = k32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return False
        try:
            code = wintypes.DWORD()
            if not k32.GetExitCodeProcess(handle, ctypes.byref(code)):
                return False
            return code.value == 259  # STILL_ACTIVE
        finally:
            k32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def url_answers(url: str, timeout: float = 2.0) -> bool:
    if not url.startswith("http://127.0.0.1"):
        return False
    try:
        urllib.request.urlopen(url, timeout=timeout).close()
        return True
    except urllib.error.HTTPError:
        return True  # the server answered
    except Exception:
        return False


def read_state(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return int(data["pid"]), str(data["url"])
    except Exception:
        return None


def start_studio(cmd, root: Path, log_path: Path, timeout: float):
    """Returns (process, url_or_None)."""
    log_path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    with open(log_path, "wb") as log:
        proc = subprocess.Popen(
            cmd, cwd=str(root), stdin=subprocess.DEVNULL, stdout=log,
            stderr=subprocess.STDOUT, **kwargs,
        )
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            m = URL_RE.search(log_path.read_text(encoding="utf-8", errors="replace"))
        except OSError:
            m = None
        if m:
            return proc, m.group(1)
        if proc.poll() is not None:
            break
        time.sleep(0.1)
    return proc, None


def stop_process(proc) -> None:
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass


def main(argv=None, env=None, root: Path | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    env = dict(os.environ if env is None else env)
    root = Path(root) if root else ROOT
    keep = "--keep-studio" in argv
    claude_args = [a for a in argv if a != "--keep-studio"]

    studio_dir = root / ".studio"
    state_path = studio_dir / "studio.json"
    log_path = studio_dir / "studio.log"
    studio_dir.mkdir(parents=True, exist_ok=True)
    no_browser = bool(env.get("TOOLS_START_NO_BROWSER"))
    studio_cmd = (_cmd_from_env(env["TOOLS_START_STUDIO_ARGS"])
                  if env.get("TOOLS_START_STUDIO_ARGS")
                  else [sys.executable, "-m", "tools.dashboard"])
    try:
        timeout = float(env.get("TOOLS_START_STUDIO_TIMEOUT", "10"))
    except ValueError:
        timeout = 10.0

    proc = None  # the studio this launch started
    claude_proc = None
    code = 0
    try:
        prior = read_state(state_path)
        if prior and pid_alive(prior[0]) and url_answers(prior[1]):
            print(f"Studio is already running at {prior[1]} - reusing it.", flush=True)
            if not no_browser:
                webbrowser.open(prior[1])
        else:
            print("Starting the studio...", flush=True)
            proc, url = start_studio(studio_cmd, root, log_path, timeout)
            if url:
                state_path.write_text(json.dumps({"pid": proc.pid, "url": url}), encoding="utf-8")
                print(f"Studio running at {url}", flush=True)
            else:
                stop_process(proc)
                proc = None
                print(f"The studio did not start. Claude will still start. "
                      f"See the log for details: {log_path}", flush=True)

        claude = env.get("TOOLS_START_CLAUDE")
        claude_cmd = _cmd_from_env(claude) if claude else None
        if claude_cmd is not None and not shutil.which(claude_cmd[0], path=env.get("PATH")):
            claude_cmd = None
        elif claude_cmd is None:
            found = shutil.which("claude", path=env.get("PATH"))
            claude_cmd = [found] if found else None
        if claude_cmd is None:
            print("Claude Code was not found. Install it from https://claude.ai/download "
                  "(see docs/SETUP.md), then run this again.", flush=True)
            if state_path.exists():
                print("The studio is still running in the background. "
                      "Run this launcher again once Claude is installed.", flush=True)
            keep = True
            return 127

        child_env = dict(env)
        # make the venv's tools (voice engine) visible to claude, like `activate` does
        bindir = str(Path(sys.executable).parent)
        child_env["PATH"] = bindir + os.pathsep + child_env.get("PATH", "")
        try:
            claude_proc = subprocess.Popen(claude_cmd + claude_args, cwd=str(root), env=child_env)
            while True:
                try:
                    code = claude_proc.wait()
                    break
                except KeyboardInterrupt:
                    # the terminal sent Ctrl+C to claude too; give it a moment, then go
                    try:
                        code = claude_proc.wait(timeout=5)
                    except (subprocess.TimeoutExpired, KeyboardInterrupt):
                        stop_process(claude_proc)
                        code = 130
                    break
        except OSError as e:
            print(f"Could not run Claude Code ({e}).", flush=True)
            code = 127
        return code
    except KeyboardInterrupt:
        return 130
    finally:
        if proc is not None and not keep:
            stop_process(proc)
            try:
                state_path.unlink()
            except OSError:
                pass


if __name__ == "__main__":
    sys.exit(main())
