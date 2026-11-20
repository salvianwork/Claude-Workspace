"""Screenshot the board for every fixture state (visual QA, not a test).

Run: .venv/bin/python -m tests.dashboard.make_screenshots [out_dir]
Writes <out_dir>/board-<state>-<width>.png (default docs/dashboard/).
"""
import sys
import tempfile
from pathlib import Path

from tests.dashboard.test_browser import ALL_STATES, REPO, drive, studio

SIZES = [(1920, 1080), (1366, 768)]


def shoot(out: Path, name: str, runs, extra=()):
    with tempfile.TemporaryDirectory() as tmp, studio(Path(tmp), runs) as s:
        steps = [{"op": "goto", "url": s.url}, {"op": "wait_selector", "selector": "#board[data-ready]"},
                 {"op": "sleep", "ms": 400}, *extra]
        for w, h in SIZES:
            steps += [{"op": "viewport", "w": w, "h": h}, {"op": "sleep", "ms": 200},
                      {"op": "screenshot", "path": str(out / f"board-{name}-{w}.png")}]
        drive(steps)


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "docs" / "dashboard"
    out.mkdir(parents=True, exist_ok=True)
    for state in ALL_STATES:
        shoot(out, state, [state])
    shoot(out, "gate1-sent", ["gate1-waiting"], [{"op": "click", "name": "Approve"},
                                                {"op": "wait_text", "text": "Sent ✓"}])
    shoot(out, "gate1-needs-text", ["gate1-waiting"], [{"op": "click", "name": "Request changes"}])
    shoot(out, "picker", ["gate1-waiting", "done"])
    print(f"screenshots in {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
