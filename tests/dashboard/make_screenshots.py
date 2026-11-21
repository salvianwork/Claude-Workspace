"""Screenshot the board for every fixture state (visual QA, not a test).

Run: .venv/bin/python -m tests.dashboard.make_screenshots [out_dir]
Writes <out_dir>/board-<state>-<width>.png (default docs/dashboard/), the studio map for every
state (studio-<state>.png at 1920x1080, studio-<state>-1366.png) and three frames of each map
animation (anim-<name>-<k>.png, cropped). The map clock is frozen with window.__studioSetTime.
Sprites at 4x: node tests/dashboard/sprite_sheet.mjs docs/dashboard/sprites-4x.png
"""
import json
import sys
import tempfile
from datetime import datetime
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


FREEZE = "(() => { window.__t0 = performance.now() + %d; window.__studioSetTime(window.__t0); return 1; })()"
STEP = "(() => { window.__studioSetTime(window.__t0 + %d); return 1; })()"
# name: (fixture, ms after load, map-buffer crop x, y, w, h)
ANIMS = {
    "typing": ("story-working", 3000, 20, 36, 80, 50), "paper-toss": ("gate1-fixing", 300, 20, 36, 80, 50),
    "carrying": ("gate1-reviewing", 2500, 0, 90, 120, 40), "reviewing": ("gate1-reviewing", 3000, 200, 165, 80, 50),
    "waiting": ("gate1-waiting", 3000, 168, 140, 60, 50), "alarm": ("stuck-gate3", 3000, 256, 60, 72, 60),
    "celebrating": ("celebrate", 1000, 256, 20, 72, 100), "idle": ("empty", 3000, 256, 20, 72, 100),
}


def _celebrate(videos):
    """The done fixture, finished just now, so the team is still celebrating."""
    src = videos / "done"
    status = json.loads((src / "status.json").read_text(encoding="utf-8"))
    status["history"][-1]["time"] = datetime.now().isoformat(timespec="seconds")
    (src / "status.json").write_text(json.dumps(status), encoding="utf-8")
    src.rename(videos / "celebrate")


RECT_JS = """(() => { const c = document.querySelector('#studio').getBoundingClientRect();
  const s = Math.max(1, Math.floor(Math.min(c.width * devicePixelRatio / 332, c.height * devicePixelRatio / 270)));
  return {x: c.x + Math.floor((c.width * devicePixelRatio - 332 * s) / 2) / devicePixelRatio,
          y: c.y + Math.floor((c.height * devicePixelRatio - 270 * s) / 2) / devicePixelRatio, s: s / devicePixelRatio}; })()"""


def shoot_studio(out: Path, state: str):
    runs = ["done"] if state == "celebrate" else [] if state == "empty" else [state]
    mutate = _celebrate if state == "celebrate" else None
    with tempfile.TemporaryDirectory() as tmp, studio(Path(tmp), runs, mutate=mutate) as s:
        steps = [{"op": "goto", "url": s.url}, {"op": "wait_selector", "selector": "#board[data-ready]"},
                 {"op": "sleep", "ms": 300}, {"op": "eval", "js": FREEZE % 2500},
                 {"op": "screenshot", "path": str(out / f"studio-{state}.png")},
                 {"op": "viewport", "w": 1366, "h": 768}, {"op": "sleep", "ms": 200}, {"op": "eval", "js": STEP % 0},
                 {"op": "screenshot", "path": str(out / f"studio-{state}-1366.png")},
                 {"op": "viewport", "w": 1920, "h": 1080}, {"op": "sleep", "ms": 200}, {"op": "eval", "js": RECT_JS}]
        r = drive(steps)["results"][-1]
        anims = [(n, a) for n, a in ANIMS.items() if a[0] == state]
        steps = []
        for name, (_, ms, x, y, w, h) in anims:
            for k in range(3):
                steps += [{"op": "eval", "js": STEP % (ms - 2500 + k * 180)},
                          {"op": "screenshot", "path": str(out / f"anim-{name}-{k}.png"),
                           "clip": {"x": r["x"] + x * r["s"], "y": r["y"] + y * r["s"], "width": w * r["s"],
                                    "height": h * r["s"]}}]
        if steps:
            drive([{"op": "goto", "url": s.url}, {"op": "wait_selector", "selector": "#board[data-ready]"},
                   {"op": "sleep", "ms": 300}, {"op": "eval", "js": FREEZE % 2500}, *steps])


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = Path(args[0]) if args else REPO / "docs" / "dashboard"
    out.mkdir(parents=True, exist_ok=True)
    if "--studio" not in sys.argv:
        for state in ALL_STATES:
            shoot(out, state, [state])
        shoot(out, "gate1-sent", ["gate1-waiting"], [{"op": "click", "name": "Approve"},
                                                    {"op": "wait_text", "text": "Sent ✓"}])
        shoot(out, "gate1-needs-text", ["gate1-waiting"], [{"op": "click", "name": "Request changes"}])
        shoot(out, "picker", ["gate1-waiting", "done"])
    for state in [*ALL_STATES, "celebrate"]:
        shoot_studio(out, state)
    print(f"screenshots in {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
