"""Mechanical story checks. CLI: python -m tools.pipeline.checks story <script.md>"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tools.pipeline.script import (
    Script, ScriptFormatError, estimate_seconds, parse_script, word_count,
)

MIN_WORDS, MAX_WORDS = 150, 450


def check_story(script: Script) -> list[str]:
    problems: list[str] = []
    words = word_count(script)
    if not MIN_WORDS <= words <= MAX_WORDS:
        problems.append(f"Narration has {words} words; it must be 150–450 words.")
    ids = [s.id for s in script.scenes]
    if ids != list(range(1, len(ids) + 1)):
        problems.append(f"Scene ids must be 1..n in order; found {ids}.")
    for s in script.scenes:
        if not s.narration.strip():
            problems.append(f"Scene {s.id}: narration is empty.")
    if not script.claims:
        problems.append("No key claims listed under '## Key claims'.")
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="tools.pipeline.checks")
    sub = ap.add_subparsers(dest="cmd", required=True)
    st = sub.add_parser("story")
    st.add_argument("script", type=Path)
    args = ap.parse_args(argv)
    try:
        script = parse_script(args.script)
    except ScriptFormatError as e:
        print(json.dumps({"words": 0, "est_seconds": 0.0, "problems": [str(e)]}, ensure_ascii=False))
        return 1
    print(json.dumps({"words": word_count(script),
                      "est_seconds": estimate_seconds(script),
                      "problems": check_story(script)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
