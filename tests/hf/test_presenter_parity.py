"""Presenter port parity (slow): the HyperFrames kit draws the same character as Remotion.

Renders both character sheets and saves them side by side (left Remotion, right HyperFrames) to
docs/hf/presenter-parity.png for a human look; checks the figure areas match; and checks that
mountPresenter, driven by a HyperFrames timeline, gives the same frame after seeking backwards.
"""
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from tools.hf.render import assert_offline, check, install_kit

REPO = Path(__file__).resolve().parents[2]
KIT = REPO / "hf-kit"
TEMPLATES = REPO / "templates"
PARITY = REPO / "docs" / "hf" / "presenter-parity.png"
CHROME = Path("/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell")
GAP = 24  # px between the two sheets
HF_CLI = KIT / "node_modules" / "hyperframes" / "bin" / "hyperframes.mjs"

needs_tools = pytest.mark.skipif(
    shutil.which("npm") is None or shutil.which("node") is None or shutil.which("ffmpeg") is None
    or not HF_CLI.is_file() or not (TEMPLATES / "node_modules" / "remotion").is_dir(),
    reason="needs node, npm, ffmpeg, `npm ci` in hf-kit and templates")

pytestmark = [pytest.mark.slow, needs_tools]


def _run(cmd, cwd, env=None, timeout=600):
    r = subprocess.run(cmd, cwd=cwd, env={**os.environ, "HYPERFRAMES_NO_TELEMETRY": "1", **(env or {})},
                       capture_output=True, text=True, timeout=timeout)
    assert r.returncode == 0, f"{cmd} failed:\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}"
    return r


def _size(png: Path) -> tuple[int, int]:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(png)],
                       capture_output=True, text=True, check=True)
    w, h = r.stdout.strip().split(",")
    return int(w), int(h)


def _ssim(a: Path, b: Path, crop: str) -> float:
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(a), "-i", str(b), "-lavfi",
                        f"[0]crop={crop}[a];[1]crop={crop}[b];[a][b]ssim", "-f", "null", "-"],
                       capture_output=True, text=True, check=True)
    return float(re.search(r"All:([0-9.]+)", r.stderr).group(1))


def test_character_sheets_side_by_side(tmp_path):
    hf_png, remo_png = tmp_path / "hf.png", tmp_path / "remotion.png"
    _run([shutil.which("npm"), "run", "sheet", "--", f"--out={hf_png}"], KIT)
    env = {}
    if not os.environ.get("REMOTION_BROWSER_EXECUTABLE") and CHROME.is_file():
        env["REMOTION_BROWSER_EXECUTABLE"] = str(CHROME)
    _run([shutil.which("npm"), "run", "character-sheet", "--", f"--out={remo_png}"], TEMPLATES, env=env)
    assert _size(hf_png) == _size(remo_png) == (1920, 1680)

    PARITY.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(remo_png), "-i", str(hf_png), "-filter_complex",
                    f"[0]pad=iw+{GAP}:ih:0:0:color=0x05080F[l];[l][1]hstack", str(PARITY)], check=True)
    assert _size(PARITY) == (2 * 1920 + GAP, 1680)

    # Pose grids (both outfits) and the mouth/expression heads: the drawing is the same.
    for crop in ("1840:600:40:138", "1840:600:40:790", "1840:250:40:1400"):
        assert _ssim(remo_png, hf_png, crop) > 0.96, crop


DEMO = """<!doctype html>
<html lang="en"><head><meta charset="UTF-8">
<style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#0F172A}
#root{position:relative;width:1920px;height:1080px}
#pres{position:absolute;left:1474px;top:356px;width:422px;height:456px}</style>
<script src="kit/vendor/gsap.min.js"></script>
<script src="kit/src/kit.js"></script>
<script src="kit/src/presenter/look.js"></script>
<script src="kit/src/presenter/motion.js"></script>
<script src="kit/src/presenter/poses.js"></script>
<script src="kit/src/presenter/parts.js"></script>
<script src="kit/src/presenter/figure.js"></script>
</head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="3" data-width="1920" data-height="1080">
  <div id="pres" class="clip" data-start="0" data-duration="3" data-track-index="0"></div>
</div>
<script>
  var mouth = [];
  for (var f = 0; f < 90; f++) mouth.push(f > 10 && f < 50 ? 0.5 + 0.45 * Math.sin(f / 2) : 0);
  var p = HFKit.mountPresenter(document.getElementById("pres"), {pose: "talk", expression: "happy",
    outfit: "blazer", size: "small", side: "right", mouth: mouth, fps: 30, seed: 2});
  p.setPose("wave", 1.5, "happy");
  var svg = p.svg;
  var tl = HFKit.timeline("main");
  tl.eventCallback("onUpdate", function () {
    p.update(tl.time());
    if (p.svg !== svg || !document.contains(svg)) throw new Error("presenter svg was rebuilt");
  });
  tl.set({}, {}, 3);
  p.update(0);
  window.__timelines["main"] = tl;
</script></body></html>
"""


def _snapshot(comp: Path, at: str, out: Path) -> dict[str, bytes]:
    _run(["node", str(HF_CLI), "snapshot", "--at", at, "--no-end", "--output", str(out), str(comp)], comp)
    return {re.search(r"at-([0-9.]+)s", p.name).group(1): p.read_bytes() for p in out.glob("frame-*.png")}


def test_mount_presenter_seeks_deterministically(tmp_path):
    comp = tmp_path / "presenter demo"  # space on purpose (Windows paths)
    comp.mkdir()
    (comp / "index.html").write_text(DEMO, encoding="utf-8")
    install_kit(comp)
    assert assert_offline(comp) == []
    assert check(comp)["ok"]

    alone = _snapshot(comp, "0.4", tmp_path / "a")
    back = _snapshot(comp, "2.6,0.4", tmp_path / "b")  # forward past the pose change, then back
    blend = _snapshot(comp, "1.6", tmp_path / "c")  # mid pose blend (talk -> wave at 1.5 s)
    assert alone["0.4"] == back["0.4"]
    assert back["2.6"] != back["0.4"]
    assert blend["1.6"] not in (alone["0.4"], back["2.6"])
