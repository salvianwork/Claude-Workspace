"""Kit scenes and props in a real browser (slow): hf-kit/test/browser/kit-scenes.mjs mounts every
kit scene (3 presenter layouts, with and without camera drift) and every prop through the hero
stage with the preinstalled Node Playwright, and checks runtime errors, seek determinism, text size
(>= 32 px), layout (inside the content box, no overlaps, never under the presenter or captions)
and cue timing (+-0.3 s). Also checks the kit sheet composition passes `hyperframes check`."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from tools.hf.render import assert_offline, check, install_kit

REPO = Path(__file__).resolve().parents[2]
KIT = REPO / "hf-kit"
HARNESS = KIT / "test" / "browser" / "kit-scenes.mjs"
SHEET = KIT / "sample" / "kit-sheet" / "index.html"


def _has_playwright() -> bool:
    if shutil.which("node") is None:
        return False
    r = subprocess.run(["node", "-e", "require.resolve('playwright')"], capture_output=True, cwd=str(KIT))
    return r.returncode == 0


pytestmark = [pytest.mark.slow,
              pytest.mark.skipif(not _has_playwright(), reason="needs node and the preinstalled Node Playwright")]


def test_kit_scenes_and_props_in_a_browser():
    r = subprocess.run(["node", str(HARNESS)], cwd=str(KIT), capture_output=True, text=True, timeout=600)
    try:
        report = json.loads(r.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"harness gave no report (exit {r.returncode}):\n{r.stdout[-3000:]}\n{r.stderr[-3000:]}")
    failed = [f"{c['name']}: {f}" for c in report["cases"] for f in c["fails"]]
    assert not failed, "\n".join(failed[:60])
    names = {c["name"].split()[0] for c in report["cases"]}
    assert {"title", "steps", "compare", "chart", "kinetic", "recap", "diagram", "prop"} <= names
    assert r.returncode == 0


@pytest.mark.skipif(not (KIT / "node_modules" / "hyperframes").is_dir(), reason="needs `npm ci` in hf-kit")
def test_kit_sheet_composition_is_offline_and_checks_clean(tmp_path):
    comp = tmp_path / "kit sheet"  # space on purpose (Windows paths)
    comp.mkdir()
    shutil.copy(SHEET, comp / "index.html")
    install_kit(comp)
    assert (comp / "kit" / "props" / "volcano" / "prop.js").is_file()
    assert assert_offline(comp) == []
    assert check(comp)["ok"]
