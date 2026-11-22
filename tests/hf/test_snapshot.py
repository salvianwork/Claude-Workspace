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
