"""Owner request/answer files for the studio dashboard.

Files live in <run>/board/ (created on demand):
  request.json          the one current request
  requests.log          JSON lines, one per write_request (id source: k = 1 + the
                        number of earlier lines with the same checkpoint)
  answer-<id>.json      the owner's answer, written once (open "x")

CLI: request | write | show | team (prints the team names from team.json, or the defaults)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from tools.pipeline.fsutil import replace_retry

CHECKPOINTS = {"gate-1", "gate-1-changed-lines", "gate-2", "final", "question"}
STUCK_RE = re.compile(r"^stuck-gate-[1-4]$")
DECISIONS = {"approve", "changes", "accept", "directions", "cancel", "answer"}
SOURCES = {"board", "chat"}


class AnswerError(Exception):
    pass


class AlreadyAnswered(AnswerError):
    pass


def _board(run_dir: Path) -> Path:
    return Path(run_dir) / "board"


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _atomic_write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    replace_retry(tmp, path)


def _valid_checkpoint(checkpoint: str) -> bool:
    return checkpoint in CHECKPOINTS or bool(STUCK_RE.match(checkpoint))


def _logged_ids(run_dir: Path) -> list[str]:
    log = _board(run_dir) / "requests.log"
    ids = []
    if log.exists():
        for line in log.read_text(encoding="utf-8").splitlines():
            try:
                ids.append(json.loads(line)["id"])
            except (ValueError, KeyError):
                continue
    return ids


def next_request_id(run_dir: Path, checkpoint: str) -> str:
    if not _valid_checkpoint(checkpoint):
        raise AnswerError(f"unknown checkpoint {checkpoint!r}")
    used = [i for i in _logged_ids(run_dir) if re.fullmatch(re.escape(checkpoint) + r"-\d+", i)]
    return f"{checkpoint}-{len(used) + 1}"


def write_request(run_dir, checkpoint, title, body, options, links=None) -> dict:
    run_dir = Path(run_dir)
    if not _valid_checkpoint(checkpoint):
        raise AnswerError(f"unknown checkpoint {checkpoint!r}")
    bad = [o for o in options if o not in DECISIONS]
    if bad or not options:
        raise AnswerError(f"invalid options: {bad or 'none given'}")
    req = {"id": next_request_id(run_dir, checkpoint), "checkpoint": checkpoint,
           "title": title, "body": body, "options": list(options),
           "links": list(links or []), "created": _now()}
    _atomic_write(_board(run_dir) / "request.json", req)
    with open(_board(run_dir) / "requests.log", "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"id": req["id"], "created": req["created"]}, ensure_ascii=False) + "\n")
    return req


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError, PermissionError):
        # missing, half-written/corrupt (JSON or UTF-8), or a Windows replace race
        return None


def read_request(run_dir) -> dict | None:
    return _read_json(_board(run_dir) / "request.json")


def read_answer(run_dir, request_id: str) -> dict | None:
    return _read_json(_board(run_dir) / f"answer-{request_id}.json")


def write_answer(run_dir, request_id, decision, text="", source="board") -> dict:
    run_dir = Path(run_dir)
    req = read_request(run_dir)
    if req is None or req["id"] != request_id:
        raise AnswerError(f"no open request with id {request_id}")
    if decision not in req["options"]:
        raise AnswerError(f"decision {decision!r} is not one of {req['options']}")
    if source not in SOURCES:
        raise AnswerError(f"invalid source {source!r}")
    ans = {"id": request_id, "decision": decision, "text": text, "source": source, "time": _now()}
    path = _board(run_dir) / f"answer-{request_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fh = open(path, "x", encoding="utf-8")
    except FileExistsError:
        raise AlreadyAnswered(f"request {request_id} already answered") from None
    with fh:
        fh.write(json.dumps(ans, ensure_ascii=False, indent=2))
    return ans


def _out(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False))


def main(argv=None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(prog="tools.dashboard.answers")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("request")
    r.add_argument("run")
    r.add_argument("--checkpoint", required=True)
    r.add_argument("--title", required=True)
    r.add_argument("--body", required=True)
    r.add_argument("--options", required=True)
    r.add_argument("--link", action="append", default=[])
    w = sub.add_parser("write")
    w.add_argument("run")
    w.add_argument("--id", required=True)
    w.add_argument("--decision", required=True)
    w.add_argument("--text", default="")
    w.add_argument("--source", default="board")
    s = sub.add_parser("show")
    s.add_argument("run")
    tm = sub.add_parser("team")
    tm.add_argument("--root", default=str(Path(__file__).resolve().parents[2]))
    a = ap.parse_args(argv)
    try:
        if a.cmd == "request":
            links = []
            for item in a.link:
                label, sep, path = item.partition("=")
                if not sep:
                    raise AnswerError(f"--link must be Label=path, got {item!r}")
                links.append({"label": label, "path": path})
            opts = [o.strip() for o in a.options.split(",") if o.strip()]
            print(write_request(Path(a.run), a.checkpoint, a.title, a.body, opts, links)["id"])
        elif a.cmd == "write":
            _out(write_answer(Path(a.run), a.id, a.decision, a.text, a.source))
        elif a.cmd == "team":
            from tools.dashboard.state import load_team  # state imports this module
            _out(load_team(Path(a.root)))
        else:
            req = read_request(Path(a.run))
            _out({"request": req, "answer": read_answer(Path(a.run), req["id"]) if req else None})
    except AnswerError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
