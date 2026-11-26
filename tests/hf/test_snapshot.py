"""The overlap report: `python -m tools.hf.snapshot <run> --overlap` (Review Focus 5)."""
import json
import shutil
from pathlib import Path

import pytest

from tests.hf.run_fixture import make_world_run, world_shots
from tools.hf import snapshot as snap_mod
from tools.hf.build import build
from tools.hf.render import HFError

REPO = Path(__file__).resolve().parents[2]
KIT = REPO / "hf-kit"

needs_browser = pytest.mark.skipif(
    shutil.which("node") is None or shutil.which("npx") is None
    or not (KIT / "node_modules" / "puppeteer-core").is_dir(),
    reason="needs node, npx and `npm ci` in hf-kit (puppeteer-core and the HyperFrames Chrome)")


def _face_tag_shots() -> dict:
    """Scene 2: a label pinned on the host's head in the side slot, for 1.2 s."""
    shots = world_shots()
    shots["scenes"][1]["beats"][0]["moves"] = [
        {"do": "gesture", "who": "host", "name": "wave"},
        {"do": "label", "target": "host", "text": "Our host", "at": {"t": 3.0}, "until": {"t": 4.2}}]
    return shots


@needs_browser
def test_overlap_report_lists_a_label_on_the_hosts_face(tmp_path, capsys):
    run = make_world_run(tmp_path, _face_tag_shots())
    build(run, KIT, run_check=False)
    assert snap_mod.main([str(run), "--overlap"]) == 1
    report = json.loads((run / "04-video" / "hf" / "overlap.json").read_text(encoding="utf-8"))
    assert len(report) == 1, report
    hit = report[0]
    assert hit["scene"] == 2 and 3.0 <= hit["t"] <= 4.5
    assert hit["a"] == {"kind": "label", "id": hit["a"]["id"]} and hit["a"]["id"].startswith("label-")
    assert hit["b"] == {"kind": "face", "id": "host"}
    assert "scene 2" in capsys.readouterr().err


@needs_browser
def test_overlap_report_is_empty_for_a_clean_video(tmp_path, capsys):
    run = make_world_run(tmp_path)
    build(run, KIT, run_check=False)
    assert snap_mod.main([str(run), "--overlap"]) == 0
    assert json.loads((run / "04-video" / "hf" / "overlap.json").read_text(encoding="utf-8")) == []
    assert "no overlaps" in capsys.readouterr().out


def test_overlap_needs_a_built_composition(tmp_path):
    run = make_world_run(tmp_path)
    with pytest.raises(HFError, match="run python -m tools.hf.build first"):
        snap_mod.overlap(run)


def test_boxes_overlap_pairs():
    boxes = [{"kind": "face", "id": "host", "x": 0, "y": 0, "w": 100, "h": 100},
             {"kind": "tag", "id": "tag-0", "x": 50, "y": 50, "w": 100, "h": 40},
             {"kind": "label", "id": "label-1", "x": 120, "y": 60, "w": 50, "h": 20},
             {"kind": "face", "id": "friend", "x": 90, "y": 0, "w": 40, "h": 70},
             {"kind": "label", "id": "label-2", "x": 100, "y": 0, "w": 10, "h": 10}]  # touches host only at the edge
    pairs = snap_mod.overlap_pairs(boxes)
    assert pairs == [(("tag", "tag-0"), ("face", "host")), (("tag", "tag-0"), ("label", "label-1")),
                     (("tag", "tag-0"), ("face", "friend")), (("label", "label-1"), ("face", "friend")),
                     (("label", "label-2"), ("face", "friend"))]


# ---- --safe-zone (vertical text safe zone x 64-940, y 200-1420; Task 6) --------------------------

def _vertical_run(tmp_path, scene1_moves=None):
    shots = world_shots()
    shots.pop("format")  # the default: vertical
    shots["scenes"][0]["actors"][0]["start"] = {"slot": "bottom-right"}
    shots["scenes"][1]["actors"][0]["start"] = {"slot": "bottom-left"}
    if scene1_moves is not None:
        shots["scenes"][0]["beats"] = [{"at": {"word": 0}, "action": "tag far out on the right", "moves": scene1_moves}]
    return make_world_run(tmp_path, shots)


def _safe_zone_report(run):
    return json.loads((run / "04-video" / "hf" / "safe-zone.json").read_text(encoding="utf-8"))


@needs_browser
def test_safe_zone_reports_a_tag_wider_than_the_zone(tmp_path, capsys):
    """Tags and labels clamp to the zone (x 64-940), so only a pill wider than the 876 px zone can leave it:
    four long words at 38 px."""
    run = _vertical_run(tmp_path, [
        {"do": "cut", "target": "bridge", "zoom": 0.6}, {"do": "walk_to", "who": "host", "to": "bridge", "at": {"word": 14}},
        {"do": "tag_follow", "target": "sky", "text": "Electromagnetic spectroscopy instrumentation calibration",
         "at": {"t": 2.0}, "until": {"t": 5.0}}])
    build(run, KIT, run_check=False)
    assert snap_mod.main([str(run), "--safe-zone"]) == 1
    hits = [h for h in _safe_zone_report(run) if h["kind"] == "tag"]
    assert len(hits) == 1, hits
    h = hits[0]
    assert h["scene"] == 1 and 2.0 <= h["t"] <= 3.0 and h["id"].startswith("tag-")
    assert h["box"]["w"] > 876 and h["box"]["x"] < 64, h
    assert set(h["box"]) == {"x", "y", "w", "h"}
    err = capsys.readouterr().err
    assert "scene 1" in err and "outside the safe zone" in err


@needs_browser
def test_a_tag_at_x_1000_is_clamped_into_the_safe_zone(tmp_path):
    """Review: a tag whose point is at x about 1000 is pulled inside x 64-940, so the check passes."""
    run = _vertical_run(tmp_path, [
        {"do": "cut", "target": "bridge", "zoom": 0.6}, {"do": "walk_to", "who": "host", "to": "bridge", "at": {"word": 14}},
        {"do": "tag_follow", "target": "rail-far", "text": "Far rail", "at": {"t": 2.0}, "until": {"t": 5.0}}])
    build(run, KIT, run_check=False)
    _, _, out = snap_mod._sample(run, KIT, 0.5, "test")
    tags = [b for s in out["samples"] for b in s["boxes"] if b["kind"] == "tag"]
    assert tags and all(b["x"] >= 64 and b["x"] + b["w"] <= 940 for b in tags), tags
    assert snap_mod.main([str(run), "--safe-zone"]) == 0


@needs_browser
def test_a_vertical_title_stays_inside_the_safe_zone(tmp_path):
    run = _vertical_run(tmp_path, [
        {"do": "cut", "target": "bridge", "zoom": 1}, {"do": "walk_to", "who": "host", "to": "bridge", "at": {"word": 14}},
        {"do": "title", "text": "How fast does sound travel", "at": {"t": 1.0}, "until": {"t": 4.0}}])
    build(run, KIT, run_check=False)
    assert snap_mod.main([str(run), "--safe-zone"]) == 0


@needs_browser
def test_safe_zone_passes_for_long_captions_inside_the_band(tmp_path, capsys):
    """Review Focus 3: the captions of the vertical fixture wrap to at most 2 lines inside 860 px,
    in the caption band, so the safe-zone check passes."""
    run = _vertical_run(tmp_path, [{"do": "cut", "target": "bridge", "zoom": 1}, {"do": "walk_to", "who": "host", "to": "bridge", "at": {"word": 14}}])
    build(run, KIT, run_check=False)
    comp, _, out = snap_mod._sample(run, KIT, 0.5, "test")
    caps = [b for s in out["samples"] for b in s["boxes"] if b["kind"] == "caption"]
    assert caps, "the caption pill is reported as a box in a vertical video"
    for b in caps:
        assert b["w"] <= 860 and b["h"] <= 180, b
        assert 840 <= b["y"] and b["y"] + b["h"] <= 1020, b
    assert snap_mod.main([str(run), "--safe-zone"]) == 0
    assert _safe_zone_report(run) == []
    assert "inside the safe zone" in capsys.readouterr().out


@needs_browser
def test_safe_zone_is_empty_for_a_landscape_video(tmp_path):
    run = make_world_run(tmp_path)
    build(run, KIT, run_check=False)
    assert snap_mod.main([str(run), "--safe-zone"]) == 0
    assert _safe_zone_report(run) == []
    comp, _, out = snap_mod._sample(run, KIT, 0.5, "test")
    assert not any(b["kind"] == "caption" for s in out["samples"] for b in s["boxes"]), "landscape boxes are unchanged"


def test_outside_safe_box_maths():
    safe = {"x0": 64, "x1": 940, "y0": 200, "y1": 1420}
    inside = {"x": 64, "y": 200, "w": 876, "h": 1220}
    assert not snap_mod.outside_safe(inside, safe)
    for moved in ({"x": 63}, {"x": 65}, {"y": 199}, {"y": 201}):
        assert snap_mod.outside_safe({**inside, **moved}, safe), moved


def test_safe_zone_needs_a_built_composition(tmp_path):
    run = make_world_run(tmp_path)
    with pytest.raises(HFError, match="run python -m tools.hf.build first"):
        snap_mod.safe_zone(run)
