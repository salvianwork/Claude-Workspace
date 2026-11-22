"""Regression: every world-look fixture (tests/fixtures/hf/world/<name>) still validates.

Runs the real command, `python -m tools.hf.shots validate <fixture>`, the way the Design agent and
the Animator do, so a kit change (moves, places, anchors, variants) that breaks a committed shot
list fails here, fast, before anyone re-renders. A fixture without committed scene modules
(04-video/hf/scenes/) is checked with `--no-modules`; one with them loads them, as the build does.
"""
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
WORLD = REPO / "tests" / "fixtures" / "hf" / "world"
FIXTURES = sorted(p for p in WORLD.iterdir() if (p / "03-design" / "shots.json").is_file())

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")


def test_there_are_world_fixtures():
    assert {p.name for p in FIXTURES} >= {"sound", "volcano", "process", "whatif"}


@pytest.mark.parametrize("fixture", FIXTURES, ids=[p.name for p in FIXTURES])
def test_world_fixture_validates(fixture):
    cmd = [sys.executable, "-m", "tools.hf.shots", "validate", str(fixture)]
    if not (fixture / "04-video" / "hf" / "scenes").is_dir():
        cmd.append("--no-modules")
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, timeout=300)
    out = r.stdout + r.stderr
    assert r.returncode == 0, out
    assert "shots.json OK" in r.stdout, out
    assert "error" not in out.lower(), out
