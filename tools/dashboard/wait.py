"""Block until the owner answers a dashboard request (meant to run in the background)."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path


def wait_for_answer(run_dir, request_id, timeout_s: float = 7200, poll_s: float = 1.0):
    path = Path(run_dir) / "board" / f"answer-{request_id}.json"
    deadline = time.monotonic() + timeout_s
    while True:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError, OSError):
            pass  # absent or half-written: retry next poll
        if time.monotonic() >= deadline:
            return None
        time.sleep(max(0.0, min(poll_s, deadline - time.monotonic())))


def main(argv=None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(prog="tools.dashboard.wait")
    ap.add_argument("run")
    ap.add_argument("--id", required=True)
    ap.add_argument("--timeout", type=float, default=7200)
    a = ap.parse_args(argv)
    ans = wait_for_answer(Path(a.run), a.id, a.timeout)
    if ans is None:
        print("timeout")
        return 3
    print(json.dumps(ans, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
