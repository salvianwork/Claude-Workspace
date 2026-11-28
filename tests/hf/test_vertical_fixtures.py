"""Regression: every vertical short fixture (tests/fixtures/hf/vertical/<name>) still validates.

Runs the real command, `python -m tools.hf.shots validate <fixture>`, the way the Design agent and
the Animator do, so a kit change (moves, places, anchors, the caption bands, the spread warning)
that breaks a committed vertical shot list fails here, fast, before anyone re-renders. A fixture
without committed scene modules (04-video/hf/scenes/) is checked with `--no-modules`; one with them
loads them, as the build does. The fixtures were made warning-free, so a new `warning:` line fails too.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
VERTICAL = REPO / "tests" / "fixtures" / "hf" / "vertical"
FIXTURES = sorted(p for p in VERTICAL.iterdir() if (p / "03-design" / "shots.json").is_file())

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")


def test_there_are_vertical_fixtures():
    assert {p.name for p in FIXTURES} >= {"sound", "whatif", "short"}


@pytest.mark.parametrize("fixture", FIXTURES, ids=[p.name for p in FIXTURES])
def test_vertical_fixture_is_vertical(fixture):
    shots = json.loads((fixture / "03-design" / "shots.json").read_text(encoding="utf-8"))
    assert shots.get("format", "vertical") == "vertical"
    assert "**Format:** vertical" in (fixture / "01-script" / "script.md").read_text(encoding="utf-8")
    total = json.loads((fixture / "02-voice" / "manifest.json").read_text(encoding="utf-8"))["total_s"]
    assert 45 <= total <= 75, f"{fixture.name}: {total} s is outside the short recipe's 45-75 s target"


@pytest.mark.parametrize("fixture", FIXTURES, ids=[p.name for p in FIXTURES])
def test_vertical_fixture_validates(fixture):
    cmd = [sys.executable, "-m", "tools.hf.shots", "validate", str(fixture)]
    if not (fixture / "04-video" / "hf" / "scenes").is_dir():
        cmd.append("--no-modules")
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, timeout=300)
    out = r.stdout + r.stderr
    assert r.returncode == 0, out
    assert "shots.json OK" in r.stdout, out
    assert "error" not in out.lower(), out
    assert "warning:" not in out, out
