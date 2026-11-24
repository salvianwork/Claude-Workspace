"""python -m tools.lessons list|add|check  (see tools/lessons/notebook.py)"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from tools.lessons import notebook
from tools.lessons.notebook import LessonError

ROOT = Path(__file__).resolve().parents[2]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m tools.lessons")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("list", "add", "check"):
        sp = sub.add_parser(name)
        sp.add_argument("--file", default=str(ROOT / "lessons.md"))
        if name in ("list", "add"):
            sp.add_argument("--section", required=name == "add")
        if name == "add":
            sp.add_argument("--text", required=True)
            sp.add_argument("--run")
            sp.add_argument("--replace")
    a = ap.parse_args(argv)
    path = Path(a.file)
    try:
        if a.cmd == "list":
            if a.section and a.section not in notebook.SECTIONS:
                raise LessonError(f"unknown section {a.section!r}")
            for key, items in notebook.load(path).items():
                if a.section and key != a.section:
                    continue
                for n, les in enumerate(items, 1):
                    print(f"{key}#{n} {les.text}")
        elif a.cmd == "add":
            print(notebook.add(path, a.section, a.text, Path(a.run) if a.run else None,
                               date.today().isoformat(), replace=a.replace))
        else:
            problems = notebook.check(path)
            for p in problems:
                print(f"error: {p}", file=sys.stderr)
            return 1 if problems else 0
    except LessonError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
