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
# A vertical short is 30-180 s: 75-450 words at the 150 wpm estimate (the target is 45-75 s).
WORD_LIMITS = {"landscape": (150, 450), "vertical": (75, 450)}


def check_story(script: Script, format: str = "landscape") -> list[str]:
    problems: list[str] = []
    words = word_count(script)
    lo, hi = WORD_LIMITS[format]
    if not lo <= words <= hi:
        problems.append(f"Narration has {words} words; it must be {lo}–{hi} words.")
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
    st.add_argument("--format", choices=sorted(WORD_LIMITS), default="landscape")
    args = ap.parse_args(argv)
    try:
        script = parse_script(args.script)
    except ScriptFormatError as e:
        print(json.dumps({"words": 0, "est_seconds": 0.0, "problems": [str(e)]}, ensure_ascii=False))
        return 1
    print(json.dumps({"words": word_count(script),
                      "est_seconds": estimate_seconds(script),
                      "problems": check_story(script, args.format)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
