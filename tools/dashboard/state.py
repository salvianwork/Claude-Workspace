"""Aggregate a run folder into the dashboard's /api/state payload.

Never raises for missing or corrupt pipeline files: a run without a readable
status.json is reported as state "starting".
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from pathlib import Path

from tools.dashboard.answers import read_answer, read_request
from tools.pipeline.script import estimate_seconds, parse_script, word_count
from tools.pipeline.status import RunStateError, load_status

DEFAULT_TEAM = {
    "story": {"name": "Quill", "look": "round glasses, cardigan, coffee mug"},
    "voice": {"name": "Echo", "look": "big headphones, hoodie"},
    "design": {"name": "Iris", "look": "beret, paint palette"},
    "animator": {"name": "Flip", "look": "backwards cap, drawing tablet"},
    "reviewer": {"name": "Sage", "look": "older, grey beard, clipboard"},
}
ROLES = tuple(DEFAULT_TEAM)
ROOMS = {"story": "writers-room", "voice": "booth", "design": "art-room", "animator": "art-room"}
CELEBRATE_S = 10
MAX_EVENTS = 30
REQUEST_STATES = {"waiting_owner", "failed"}
VIDEO = "04-video/out/video.mp4"
CREDITS = "04-video/credits.md"
_REVIEW_RE = re.compile(r"^gate-1-round-(\d+)\.md$")
_REVIEW_HEAD_RE = re.compile(r"^#\s*Gate\s+1,\s*round\s+(\d+)\s*:\s*(PASS|FIX)\b", re.I)
_GATE_EVENT_RE = re.compile(r"gate\s+(\d+)\s+(PASS|FIX)", re.I)
_LOG_RE = re.compile(r"^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d(?::\d\d)?)\s*\|\s*\[\d/\d\]\s*(\w+)\s*\|\s*(.*)$")


def load_team(root: Path) -> dict:
    team = {role: dict(v) for role, v in DEFAULT_TEAM.items()}
    try:
        data = json.loads((Path(root) / "team.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return team
    if not isinstance(data, dict):
        return team
    for role in ROLES:
        entry = data.get(role)
        if not isinstance(entry, dict):
            continue
        for key in ("name", "look"):
            if isinstance(entry.get(key), str) and entry[key].strip():
                team[role][key] = entry[key].strip()
    return team


def _last_time(status: dict) -> str:
    hist = status.get("history")
    if isinstance(hist, list) and hist and isinstance(hist[-1], dict) and hist[-1].get("time"):
        return str(hist[-1]["time"])
    return str(status.get("created", ""))


def list_runs(videos_root: Path) -> list[dict]:
    rows = []
    root = Path(videos_root)
    if not root.is_dir():
        return rows
    for d in root.iterdir():
        if not d.is_dir():
            continue
        try:
            s = load_status(d)
        except RunStateError:
            continue
        rows.append({"run": d.name, "topic": s.get("topic", ""), "step": s.get("step", ""),
                     "state": s.get("state", ""), "updated": _last_time(s)})
    rows.sort(key=lambda r: (r["updated"], r["run"]), reverse=True)
    return rows


def _parse_time(text) -> datetime | None:
    try:
        return datetime.fromisoformat(str(text).replace(" ", "T"))
    except ValueError:
        return None


def _hhmm(text) -> str:
    t = _parse_time(text)
    return t.strftime("%H:%M") if t else str(text)[:5]


def _name(team: dict, agent: str) -> str:
    if agent in team:
        return team[agent]["name"]
    return "The studio" if agent in ("orchestrator", "") else str(agent).capitalize()


def _kind(event: str) -> str | None:
    low = event.lower()
    if "started" in low:
        return "start"
    if "PASS" in event:
        return "pass"
    if "FIX" in event:
        return "fix"
    if "waiting for owner" in low:
        return "owner"
    if "done" in low:
        return "done"
    return None


def _event_text(team: dict, agent: str, event: str, detail: str) -> str:
    name = _name(team, agent)
    m = _GATE_EVENT_RE.search(event)
    if m and agent == "reviewer":
        extra = f", {detail}" if detail else ""
        return f"{name} stamped {m.group(2).upper()} (gate {m.group(1)}{extra})"
    return f"{name} {event}" + (f" ({detail})" if detail else "")


def _events_from_history(history: list, team: dict) -> list[dict]:
    out, last_worker = [], None
    for h in history:
        if not isinstance(h, dict):
            continue
        agent, event = str(h.get("agent", "")), str(h.get("event", ""))
        kind = _kind(event)
        if kind is None:
            kind = "handoff" if agent in ROLES and agent != "reviewer" and agent != last_worker else "info"
        if agent in ROLES and agent != "reviewer":
            last_worker = agent
        out.append({"time": _hhmm(h.get("time", "")), "agent": agent,
                    "text": _event_text(team, agent, event, str(h.get("detail", ""))), "kind": kind})
    return out


def _events_from_log(run_dir: Path, team: dict) -> list[dict]:
    try:
        lines = (run_dir / "progress.log").read_text(encoding="utf-8").splitlines()
    except (OSError, ValueError):
        return []
    out, prev_step = [], None
    for line in lines:
        m = _LOG_RE.match(line.strip())
        if not m:
            continue
        _, time, step, rest = m.groups()
        step = step.lower()
        agent = step if step in ROLES else "orchestrator"
        kind = _kind(rest) or ("handoff" if prev_step not in (None, step) else "info")
        if prev_step is None:
            kind = "start"
        prev_step = step
        out.append({"time": time[:5], "agent": agent, "text": _event_text(team, agent, rest, ""), "kind": kind})
    return out


def _agents(step: str, state: str, celebrating: bool) -> dict:
    a = {r: {"where": "kitchen", "activity": "idle"} for r in ROLES}
    if state == "done" or step == "done":
        if celebrating:
            for v in a.values():
                v["activity"] = "celebrating"
        return a
    room = ROOMS.get(step)
    if room is None:
        return a
    if state == "working":
        a[step] = {"where": room, "activity": "working"}
    elif state == "reviewing":
        a[step] = {"where": "review-room", "activity": "carrying"}
        a["reviewer"] = {"where": "review-room", "activity": "reviewing"}
    elif state == "fixing":
        a[step] = {"where": room, "activity": "fixing"}
        a["reviewer"] = {"where": room, "activity": "carrying"}
    elif state == "waiting_owner":
        a[step] = {"where": "review-door", "activity": "waiting"}
    elif state == "failed":
        a["reviewer"] = {"where": "kitchen", "activity": "alarm"}
    return a


def _track(step: str, state: str) -> list[dict]:
    names = ["story", "owner", "voice", "owner", "design", "animator", "final"]
    if step == "done" or state == "done":
        cur = len(names)
    else:
        waiting = state == "waiting_owner"
        cur = {"story": 1 if waiting else 0, "voice": 3 if waiting else 2,
               "design": 4, "animator": 6 if waiting else 5}.get(step, 0)
    return [{"step": n, "status": "done" if i < cur else "active" if i == cur else "pending"}
            for i, n in enumerate(names)]


def _summary(run_dir: Path) -> dict | None:
    try:
        script = parse_script(run_dir / "01-script" / "script.md")
    except (OSError, ValueError):
        return None
    gate = rnd = None
    review = run_dir / "review"
    if review.is_dir():
        found = [(int(m.group(1)), f) for f in review.iterdir() if (m := _REVIEW_RE.match(f.name))]
        for n, f in sorted(found, reverse=True):
            try:
                head = f.read_text(encoding="utf-8").splitlines()[0]
            except (OSError, ValueError, IndexError):
                continue
            hm = _REVIEW_HEAD_RE.match(head.strip())
            if hm:
                gate, rnd = hm.group(2).upper(), int(hm.group(1))
                break
    return {"scenes": len(script.scenes), "words": word_count(script),
            "est_seconds": round(estimate_seconds(script), 1), "gate": gate, "round": rnd}


def _voice(run_dir: Path) -> dict | None:
    try:
        m = json.loads((run_dir / "02-voice" / "manifest.json").read_text(encoding="utf-8"))
        return {"voice": m.get("voice"), "speed": m.get("speed"), "total_s": m.get("total_s"),
                "scenes": [{"id": s["id"], "path": f"02-voice/{s['file']}"} for s in m["scenes"]]}
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return None


def _video(run_dir: Path) -> dict | None:
    if not (run_dir / VIDEO).is_file():
        return None
    return {"path": VIDEO, "credits": CREDITS if (run_dir / CREDITS).is_file() else None}


def _done_time(history) -> datetime | None:
    for h in reversed(history if isinstance(history, list) else []):
        if isinstance(h, dict) and "done" in str(h.get("event", "")).lower():
            return _parse_time(h.get("time"))
    return None


def run_state(run_dir: Path, team: dict, now: datetime | None = None) -> dict:
    run_dir = Path(run_dir)
    now = now or datetime.now()
    base = {"run": run_dir.name, "topic": "", "step": "story", "state": "starting", "round": 1,
            "team": team, "agents": _agents("", "starting", False), "track": [], "request": None,
            "answered": None, "summary": None, "voice": None, "events": [], "video": None}
    try:
        status = load_status(run_dir)
    except RunStateError:
        return base
    step, state = str(status.get("step", "story")), str(status.get("state", "working"))
    history = status.get("history")
    if isinstance(history, list):
        events = _events_from_history(history, team)
    else:
        events = _events_from_log(run_dir, team)
    celebrating = False
    if state == "done" or step == "done":
        t = _done_time(history)
        celebrating = t is not None and now < t + timedelta(seconds=CELEBRATE_S)
    request = answered = None
    if state in REQUEST_STATES:
        req = read_request(run_dir)
        if isinstance(req, dict) and isinstance(req.get("id"), str):
            ans = read_answer(run_dir, req["id"])
            if ans is None:
                request = req
            else:
                answered = ans
    base.update({
        "topic": status.get("topic", ""), "step": step, "state": state,
        "round": status.get("round", 1), "agents": _agents(step, state, celebrating),
        "track": _track(step, state), "request": request, "answered": answered,
        "summary": _summary(run_dir), "voice": _voice(run_dir),
        "events": events[-MAX_EVENTS:], "video": _video(run_dir),
    })
    return base
