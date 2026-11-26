"""The format switch (vertical short-form, Task 1): shots.json schema 2 `format` (default
vertical, 1080 x 1920), schema 1 always landscape, `data.canvas` from the build, and landscape
output unchanged (Review Focus 1): the world fixtures built as landscape give byte-identical
data.json and the same snapshots as the goldens captured before the switch (tests/fixtures/hf/golden,
captured with the tools at 75eb409)."""
import copy
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest

from tests.hf.run_fixture import load, make_run, make_world_run, world_shots
from tools.hf import shots as shots_mod
from tools.hf import snapshot as snap_mod
from tools.hf.build import build
from tools.hf.shots import review_shots, validate_shots

REPO = Path(__file__).resolve().parents[2]
KIT = REPO / "hf-kit"
PROPS = KIT / "props"
GOLDEN = REPO / "tests" / "fixtures" / "hf" / "golden"
WORLD = REPO / "tests" / "fixtures" / "hf" / "world"
WORLD_FIXTURES = ("process", "sound", "volcano", "whatif")
SNAP_SIZE = (640, 360)  # the golden snapshots are stored downscaled (ffmpeg area scaling)

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")
needs_hf = pytest.mark.skipif(
    shutil.which("npx") is None or shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None
    or not (KIT / "node_modules" / "hyperframes").is_dir(),
    reason="needs npx, ffmpeg and `npm ci` in hf-kit")
needs_browser = pytest.mark.skipif(
    shutil.which("node") is None or shutil.which("npx") is None
    or not (KIT / "node_modules" / "puppeteer-core").is_dir(),
    reason="needs node, npx and `npm ci` in hf-kit (puppeteer-core and the HyperFrames Chrome)")


def vertical_shots() -> dict:
    """world_shots() with no format: the default, vertical."""
    s = world_shots()
    s.pop("format", None)
    return s


# ---- the format values -----------------------------------------------------------------------

@needs_node
def test_formats_match_the_kit():
    js = ("import './hf-kit/src/kit.js'; process.stdout.write(JSON.stringify(globalThis.HFKit.FORMATS))")
    r = subprocess.run(["node", "--input-type=module", "-e", js], cwd=REPO, capture_output=True, text=True, check=True)
    assert json.loads(r.stdout) == shots_mod.FORMATS
    assert shots_mod.FORMATS == {"vertical": {"width": 1080, "height": 1920},
                                 "landscape": {"width": 1920, "height": 1080}}


def test_format_and_canvas_of_shots():
    assert shots_mod.format_of({"scenes": []}) == "landscape"  # schema 1 is always landscape
    assert shots_mod.format_of({"schema": 2, "scenes": []}) == "vertical"  # schema 2 default
    assert shots_mod.format_of({"schema": 2, "format": "landscape", "scenes": []}) == "landscape"
    assert shots_mod.format_of({"schema": 2, "format": "vertical", "scenes": []}) == "vertical"
    assert shots_mod.canvas_of({"schema": 2, "scenes": []}) == {"width": 1080, "height": 1920}
    assert shots_mod.canvas_of({"scenes": []}) == {"width": 1920, "height": 1080}


@needs_node
def test_world_fixture_default_is_vertical_and_valid(tmp_path):
    run = make_world_run(tmp_path, vertical_shots())
    shots, words, manifest = load(run)
    errs, _ = review_shots(shots, words, manifest, PROPS, scenes_dir=run / "04-video" / "hf" / "scenes")
    assert errs == []


@needs_node
@pytest.mark.parametrize("bad", ["square", "Vertical", 9, None, ""])
def test_unknown_format_is_refused(tmp_path, bad):
    run = make_world_run(tmp_path)
    shots, words, manifest = load(run)
    shots["format"] = bad
    errs = validate_shots(shots, words, manifest, PROPS)
    assert errs == [f"format must be vertical or landscape (got {json.dumps(bad)})"]


@needs_node
def test_schema1_is_always_landscape(tmp_path):
    run = make_run(tmp_path)
    shots, words, manifest = load(run)
    shots["format"] = "vertical"
    errs = validate_shots(shots, words, manifest, PROPS, hero_count=False)
    assert errs == ['format: schema 1 videos are always landscape (got "vertical"); vertical needs "schema": 2']
    shots["format"] = "landscape"
    assert validate_shots(shots, words, manifest, PROPS, hero_count=False) == []


@needs_node
def test_kit_check_runs_on_the_scene_canvas(tmp_path):
    """kit_check.mjs sets the kit canvas from the shots' format before it compiles the moves (the
    camera, framing and tag maths read HFKit.CANVAS); each scene's report echoes HFKit.CANVAS."""
    run = make_world_run(tmp_path)
    shots, words, manifest = load(run)
    land = shots_mod.kit_check(shots, words, manifest, PROPS)
    vert = shots_mod.kit_check(vertical_shots(), words, manifest, PROPS)
    assert [r["canvas"] for r in land] == [{"width": 1920, "height": 1080}] * 2
    assert [r["canvas"] for r in vert] == [{"width": 1080, "height": 1920}] * 2


# ---- build -----------------------------------------------------------------------------------

@needs_node
def test_schema2_without_format_builds_a_vertical_composition(tmp_path):
    run = make_world_run(tmp_path, vertical_shots())
    comp = build(run, KIT, run_check=False)
    data = json.loads((comp / "data.json").read_text(encoding="utf-8"))
    assert data["canvas"] == {"width": 1080, "height": 1920}
    assert (data["width"], data["height"]) == (1080, 1920)
    page = (comp / "index.html").read_text(encoding="utf-8")
    assert 'data-width="1080" data-height="1920"' in page
    assert '<meta name="viewport" content="width=1080, height=1920">' in page
    assert "width: 1080px; height: 1920px;" in page
    assert "1920px; height: 1080px" not in page


@needs_node
def test_landscape_build_writes_no_canvas_key(tmp_path):
    """Landscape data.json stays byte-identical to the pre-switch builds: no `canvas` key (the
    kit's default canvas is landscape)."""
    run = make_world_run(tmp_path)
    comp = build(run, KIT, run_check=False)
    data = json.loads((comp / "data.json").read_text(encoding="utf-8"))
    assert "canvas" not in data and (data["width"], data["height"]) == (1920, 1080)
    assert 'data-width="1920" data-height="1080"' in (comp / "index.html").read_text(encoding="utf-8")


def _copy_fixture(src: Path, dest: Path) -> Path:
    shutil.copytree(src, dest, ignore=shutil.ignore_patterns("kit", "snapshots", ".hyperframes", "out"))
    for f in ("data.json", "index.html", "overlap.json"):
        (dest / "04-video" / "hf" / f).unlink(missing_ok=True)
    return dest


@needs_node
@pytest.mark.parametrize("name", WORLD_FIXTURES)
def test_world_fixture_as_landscape_is_byte_identical(tmp_path, name):
    src = WORLD / name
    if not (src / "02-voice" / "scene-01.wav").is_file():
        pytest.skip("the world fixture's wavs are not in git (made by the real voice)")
    shots = json.loads((src / "03-design" / "shots.json").read_text(encoding="utf-8"))
    assert shots.get("format") == "landscape", "the world fixtures are landscape videos"
    run = _copy_fixture(src, tmp_path / f"{name} run")
    comp = build(run, KIT, run_check=False)
    assert (comp / "data.json").read_bytes() == (GOLDEN / f"world-{name}-data.json").read_bytes()


def _rgb(png: Path, size: tuple[int, int]) -> np.ndarray:
    w, h = size
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(png), "-vf", f"scale={w}:{h}:flags=area",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.int16)


@needs_hf
def test_world_sound_landscape_snapshots_match_the_goldens(tmp_path):
    src = WORLD / "sound"
    if not (src / "02-voice" / "scene-01.wav").is_file():
        pytest.skip("the world fixture's wavs are not in git (made by the real voice)")
    run = _copy_fixture(src, tmp_path / "sound run")
    build(run, KIT, run_check=False)
    shots = snap_mod.snapshot(run)
    assert len(shots) == 9
    for p in shots:
        got, want = _rgb(p, SNAP_SIZE), _rgb(GOLDEN / "world-sound-snapshots" / p.name, SNAP_SIZE)
        diff = np.abs(got - want)
        assert diff.mean() <= 1.0 and (diff.max(axis=2) > 24).mean() <= 0.002, \
            f"{p.name}: mean {diff.mean():.3f}, {(diff.max(axis=2) > 24).mean():.4%} of pixels off"


def _size(path: Path) -> tuple[int, int]:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    w, h = r.stdout.strip().split(",")
    return int(w), int(h)


@needs_hf
def test_vertical_snapshots_are_1080_by_1920(tmp_path):
    run = make_world_run(tmp_path, vertical_shots())
    build(run, KIT, run_check=False)
    shots = snap_mod.snapshot(run, ("mid",))
    assert [_size(p) for p in shots] == [(1080, 1920)] * 2


@needs_browser
def test_overlap_report_runs_in_the_composition_size(tmp_path):
    run = make_world_run(tmp_path, vertical_shots())
    build(run, KIT, run_check=False)
    # overlap.mjs checks its viewport is the canvas (else HFError). This fixture keeps the host in the
    # legacy side slot (the vertical bottom slot is wired later), whose face sits in the caption band:
    # that caption hit (and a tag crossing the caption pill) is expected; nothing else overlaps.
    report = snap_mod.overlap(run)
    assert [o for o in report if "caption" not in (o["a"]["kind"], o["b"]["kind"])] == [], report


# ---- render (slow) ---------------------------------------------------------------------------

@pytest.mark.slow
@needs_hf
def test_vertical_render_is_1080_by_1920(tmp_path):
    from tests.hf.test_build import _music_library
    from tools.audio.mix import build_mix
    from tools.render import render as render_mod
    shots = vertical_shots()
    # the fixture's pulse tag crosses the vertical caption pill; `hyperframes check` fails a tag on text
    shots["scenes"][0]["beats"][1]["moves"] = [m for m in shots["scenes"][0]["beats"][1]["moves"] if m["do"] != "tag_follow"]
    run = make_world_run(tmp_path, shots)
    build_mix(run, _music_library(tmp_path))
    assert render_mod.main([str(run), "--engine", "hyperframes"]) == 0
    assert _size(run / "04-video" / "out" / "video.mp4") == (1080, 1920)


# ---- render checks the output size -----------------------------------------------------------

def test_render_reads_the_composition_size(tmp_path):
    from tools.hf.render import composition_size
    (tmp_path / "index.html").write_text(
        '<div id="root" data-composition-id="main" data-start="0" data-duration="3" data-width="1080" '
        'data-height="1920"></div>', encoding="utf-8")
    assert composition_size(tmp_path) == (1080, 1920)
    (tmp_path / "index.html").write_text('<div data-composition-id="main"></div>', encoding="utf-8")
    assert composition_size(tmp_path) == (1920, 1080)  # older pages: landscape


@pytest.mark.skipif(shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None, reason="needs ffmpeg")
def test_render_refuses_an_mp4_in_another_size(tmp_path):
    """No silent switch of format: a render whose MP4 is not the composition's size fails."""
    from tools.hf.render import HFError, check_output_size
    (tmp_path / "index.html").write_text(
        '<div id="root" data-composition-id="main" data-duration="1" data-width="1080" data-height="1920"></div>',
        encoding="utf-8")
    mp4 = tmp_path / "v.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=192x108:d=0.2",
                    "-pix_fmt", "yuv420p", str(mp4)], check=True)
    with pytest.raises(HFError, match=r"192 x 108.*1080 x 1920"):
        check_output_size(tmp_path, mp4)
    (tmp_path / "index.html").write_text(
        '<div id="root" data-composition-id="main" data-duration="1" data-width="192" data-height="108"></div>',
        encoding="utf-8")
    check_output_size(tmp_path, mp4)  # the same size: fine
