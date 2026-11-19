"""Measure the mix: python -m tools.audio.measure <run_dir> (prints JSON)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tools.audio.mix import MixCheckError, check_mix


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="tools.audio.measure")
    ap.add_argument("run_dir", type=Path)
    args = ap.parse_args(argv)
    try:
        result = check_mix(args.run_dir)
    except (MixCheckError, FileNotFoundError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0 if not result["problems"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
