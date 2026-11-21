"""Run folders, status.json and progress.log for the video agent team."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import unicodedata
from datetime import date, datetime
from pathlib import Path

STEPS = ("story", "voice", "design", "animator", "done")
STATES = ("working", "reviewing", "waiting_owner", "fixing", "failed", "done")
STEP_DISPLAY = {
    "story": "[1/4] Story",
    "voice": "[2/4] Voice",
    "design": "[3/4] Design",
    "animator": "[4/4] Animator",
    "done": "[4/4] Done",
}
SUBFOLDERS = ("01-script", "02-voice", "03-design", "04-video", "review")
STEP_COL_WIDTH = 14  # len("[4/4] Animator")


class RunStateError(Exception):
    """Raised when a run's status.json is missing or unreadable."""


def slugify(topic: str) -> str:
    text = unicodedata.normalize("NFKD", topic).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50].strip("-")
    return slug or "video"


def _now() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def _write_status(run_dir: Path, status: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=run_dir, prefix="status.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(status, f, indent=2, ensure_ascii=False)
        os.replace(tmp, run_dir / "status.json")
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def _log_line(time: str, step: str, state: str, round_: int) -> str:
    stamp = time.replace("T", " ")
    return f"{stamp} | {STEP_DISPLAY[step].ljust(STEP_COL_WIDTH)} | {state} (round {round_})\n"


def _append_log(run_dir: Path, line: str) -> None:
    with open(run_dir / "progress.log", "a", encoding="utf-8") as f:
        f.write(line)


def init_run(topic: str, videos_root: Path, today: date | None = None) -> Path:
    videos_root = Path(videos_root)
    today = today or date.today()
    slug = slugify(topic)
    base = f"{today.isoformat()}-{slug}"
    run, n = videos_root / base, 1
    while run.exists():
        n += 1
        run = videos_root / f"{base}-{n}"
    run.mkdir(parents=True)
    for sub in SUBFOLDERS:
        (run / sub).mkdir()
    (run / "brief.md").write_text(
        f"# Brief\n\nTopic: {topic}\n\nOwner notes:\n\n\nlanguage: en\n", encoding="utf-8"
    )
    created = _now()
    status = {
        "topic": topic,
        "slug": slug,
        "created": created,
        "step": "story",
        "state": "working",
        "round": 1,
        "history": [{"time": created, "agent": "story", "event": "started", "detail": ""}],
    }
    _write_status(run, status)
    (run / "progress.log").write_text(_log_line(created, "story", "working", 1), encoding="utf-8")
    return run


def load_status(run_dir: Path) -> dict:
    path = Path(run_dir) / "status.json"
    if not path.is_file():
        raise RunStateError(f"No status.json found in {run_dir}. Is this a run folder?")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise RunStateError(f"status.json in {run_dir} is corrupt ({e}).") from e
    if not isinstance(data, dict):
        raise RunStateError(f"status.json in {run_dir} is corrupt (not an object).")
    return data


def update(
    run_dir: Path,
    *,
    step: str | None = None,
    state: str | None = None,
    round: int | None = None,
    agent: str,
    event: str,
    detail: str = "",
) -> dict:
    run_dir = Path(run_dir)
    if step is not None and step not in STEPS:
        raise ValueError(f"step must be one of {', '.join(STEPS)}; got {step!r}")
    if state is not None and state not in STATES:
        raise ValueError(f"state must be one of {', '.join(STATES)}; got {state!r}")
    if round is not None and (isinstance(round, bool) or not isinstance(round, int) or not 1 <= round <= 3):
        raise ValueError(f"round must be an integer 1..3; got {round!r}")
    status = load_status(run_dir)
    if step is not None:
        status["step"] = step
    if state is not None:
        status["state"] = state
    if round is not None:
        status["round"] = round
    now = _now()
    status.setdefault("history", []).append(
        {"time": now, "agent": agent, "event": event, "detail": detail}
    )
    _write_status(run_dir, status)
    _append_log(run_dir, _log_line(now, status["step"], status["state"], status["round"]))
    return status


def _team_for(run_dir: Path) -> dict:
    """Display names: team.json in the nearest folder above the run, else the defaults.

    Returns {} (plain role names) if the lookup fails: /video-status must always work.
    """
    try:
        from tools.dashboard.state import DEFAULT_TEAM, load_team  # state imports this module

        for parent in Path(run_dir).resolve().parents:
            if (parent / "team.json").is_file():
                return load_team(parent)
        return {role: dict(v) for role, v in DEFAULT_TEAM.items()}
    except Exception:  # noqa: BLE001 - names are display-only
        return {}


def format_status(run_dir: Path) -> str:
    s = load_status(run_dir)
    team = _team_for(run_dir)

    def who(agent: str) -> str:
        entry = team.get(agent)
        return f"{entry['name']} ({agent})" if isinstance(entry, dict) and entry.get("name") else agent

    entry = team.get(s["step"])
    step_name = entry.get("name") if isinstance(entry, dict) else None
    lines = [
        f"Topic: {s['topic']}",
        f"Step:  {STEP_DISPLAY[s['step']]}" + (f" — {step_name}" if step_name else ""),
        f"State: {s['state']}",
        f"Round: {s['round']}",
        "Last events:",
    ]
    for h in s.get("history", [])[-5:]:
        detail = f" ({h['detail']})" if h.get("detail") else ""
        lines.append(f"  {h['time']} {who(h['agent'])}: {h['event']}{detail}")
    return "\n".join(lines)


def _list_runs(videos_root: Path) -> str:
    rows = []
    if videos_root.is_dir():
        for d in sorted(p for p in videos_root.iterdir() if p.is_dir()):
            try:
                s = load_status(d)
                rows.append(f"{d.name}  {STEP_DISPLAY[s['step']]}  {s['state']}")
            except RunStateError:
                rows.append(f"{d.name}  (no valid status.json)")
    return "\n".join(rows) if rows else "No runs found."


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to a narrow code page
    except Exception:  # noqa: BLE001
        pass
    p = argparse.ArgumentParser(prog="python -m tools.pipeline.status")
    sub = p.add_subparsers(dest="cmd", required=True)
    pi = sub.add_parser("init", help="create a new run folder")
    pi.add_argument("topic")
    pi.add_argument("--videos-root", default="videos")
    pu = sub.add_parser("update", help="record a step/state change")
    pu.add_argument("run_dir")
    pu.add_argument("--step")
    pu.add_argument("--state")
    pu.add_argument("--round", type=int)
    pu.add_argument("--agent", required=True)
    pu.add_argument("--event", required=True)
    pu.add_argument("--detail", default="")
    ps = sub.add_parser("show", help="show a run's status")
    ps.add_argument("run_dir")
    pl = sub.add_parser("list", help="list all runs")
    pl.add_argument("--videos-root", default="videos")
    args = p.parse_args(argv)
    try:
        if args.cmd == "init":
            print(init_run(args.topic, Path(args.videos_root)))
        elif args.cmd == "update":
            update(Path(args.run_dir), step=args.step, state=args.state, round=args.round,
                   agent=args.agent, event=args.event, detail=args.detail)
        elif args.cmd == "show":
            print(format_status(Path(args.run_dir)))
        else:
            print(_list_runs(Path(args.videos_root)))
    except (RunStateError, ValueError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
