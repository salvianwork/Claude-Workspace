"""Read and edit lessons.md without disturbing anything the owner wrote by hand.

The file is kept as a list of raw lines (line endings included); a write splices
one line into the target section and leaves every other byte as it was.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from tools.pipeline.fsutil import replace_retry

SECTIONS = {
    "everyone": "## Everyone",
    "quill": "## Quill (script)",
    "echo": "## Echo (voice)",
    "iris": "## Iris (design)",
    "flip": "## Flip (animation)",
    "sage": "## Sage (review)",
}
HEADER = ("# Lessons\n"
          "Lessons the team follows. Edit freely; the current video's own instructions always win.\n")
MAX_TEXT = 160
SOFT_CAP = 40

_LINE_RE = re.compile(r"^- (?P<text>.*?) _\(from (?P<src>.+?), (?P<date>\d{4}-\d{2}-\d{2})\)_$")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_URL_RE = re.compile(r"(?:https?|ftp)://|\bwww\.", re.I)


class LessonError(Exception):
    pass


@dataclass
class Lesson:
    text: str
    source: str | None
    date: str | None


def _template() -> str:
    return HEADER + "".join(f"\n{h}\n" for h in SECTIONS.values())


def _read(path: Path) -> str:
    path = Path(path)
    if not path.exists():
        return ""
    return path.read_bytes().decode("utf-8")


def _write(path: Path, text: str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(text.encode("utf-8"))
    replace_retry(tmp, path)


def _eol(text: str) -> str:
    return "\r\n" if "\r\n" in text else "\n"


def _parse_line(line: str) -> Lesson | None:
    body = line.rstrip("\r\n").rstrip()
    if not body.startswith("- "):
        return None
    m = _LINE_RE.match(body)
    if m:
        return Lesson(m["text"], m["src"], m["date"])
    return Lesson(body[2:].strip(), None, None)


def _index(lines: list[str]) -> dict[str, tuple[int, int]]:
    """key -> (heading line index, end index exclusive); first heading wins."""
    by_heading = {h: k for k, h in SECTIONS.items()}
    starts = {}
    for i, line in enumerate(lines):
        k = by_heading.get(line.strip())
        if k and k not in starts:
            starts[k] = i
    out = {}
    for k, s in starts.items():
        e = len(lines)
        for j in range(s + 1, len(lines)):
            if lines[j].startswith("## "):
                e = j
                break
        out[k] = (s, e)
    return out


def _lesson_rows(lines: list[str], span: tuple[int, int]) -> list[tuple[int, Lesson]]:
    rows = []
    for i in range(span[0] + 1, span[1]):
        les = _parse_line(lines[i])
        if les:
            rows.append((i, les))
    return rows


def load(path: Path) -> dict[str, list[Lesson]]:
    lines = _read(path).splitlines(keepends=True)
    idx = _index(lines)
    return {k: [l for _, l in _lesson_rows(lines, idx[k])] if k in idx else [] for k in SECTIONS}


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _clean(text: str) -> str:
    text = (text or "").strip()
    if not text:
        raise LessonError("lesson text is empty")
    if "\n" in text or "\r" in text:
        raise LessonError("lesson text must be one line")
    if len(text) > MAX_TEXT:
        raise LessonError(f"lesson text is {len(text)} characters; the limit is {MAX_TEXT}")
    if _EMAIL_RE.search(text) or _URL_RE.search(text):
        raise LessonError("lesson text must not contain e-mail addresses or URLs")
    return text


def _parse_replace(replace: str, key: str, count: int) -> int:
    m = re.fullmatch(r"([a-z]+)#(\d+)", replace.strip())
    if not m:
        raise LessonError(f"bad --replace {replace!r}; expected <section>#<number>, e.g. {key}#1")
    if m[1] != key:
        raise LessonError(f"--replace {replace!r} is not in section {key!r}")
    n = int(m[2])
    if not 1 <= n <= count:
        raise LessonError(f"section {key!r} has {count} lesson(s); there is no #{n}")
    return n


def add(path, key, text, run_dir, today, replace=None) -> str:
    path = Path(path)
    if key not in SECTIONS:
        raise LessonError(f"unknown section {key!r}; use one of: {', '.join(SECTIONS)}")
    text = _clean(text)
    raw = _read(path) if path.exists() else _template()
    eol = _eol(raw)
    lines = raw.splitlines(keepends=True)
    idx = _index(lines)
    if key not in idx:  # owner removed the heading: put it back at the end
        if lines and not lines[-1].endswith(("\n", "\r")):
            lines[-1] += eol
        lines += [eol, SECTIONS[key] + eol]
        idx = _index(lines)
    rows = _lesson_rows(lines, idx[key])
    suffix = f" _(from {Path(run_dir).name}, {today})_" if run_dir else ""
    new_line = f"- {text}{suffix}{eol}"

    if replace is not None:
        n = _parse_replace(replace, key, len(rows))
        lines[rows[n - 1][0]] = new_line
        _write(path, "".join(lines))
        return "replaced"

    if any(_norm(l.text) == _norm(text) for _, l in rows):
        return "already there"

    if rows:
        at = rows[-1][0]
        if not lines[at].endswith(("\n", "\r")):
            lines[at] += eol
        lines.insert(at + 1, new_line)
    else:
        s = idx[key][0]
        if not lines[s].endswith(("\n", "\r")):
            lines[s] += eol
        blank_next = s + 1 < len(lines) and not lines[s + 1].strip()
        if blank_next:  # keep the owner's blank line above the lesson and below it
            lines[s + 2:s + 2] = [new_line] + ([eol] if s + 2 < len(lines) else [])
        else:
            lines.insert(s + 1, new_line)
    _write(path, "".join(lines))
    return "added"


def check(path) -> list[str]:
    raw = _read(path)
    lines = raw.splitlines(keepends=True)
    idx = _index(lines)
    problems = [f"missing heading {h!r}" for k, h in SECTIONS.items() if k not in idx]
    total = sum(len(v) for v in load(path).values())
    if total > SOFT_CAP:
        problems.append(f"{total} lessons; the soft cap is {SOFT_CAP}, so merge or remove some")
    return problems
