import copy
import json
import shutil
from pathlib import Path

import pytest

from tests.hf.run_fixture import NARRATION, load, make_run, words_for
from tests.hf.run_fixture import shots as fixture_shots
from tools.hf import shots as shots_mod
from tools.hf.shots import kit_check, review_shots, validate_shots

REPO = Path(__file__).resolve().parents[2]
PROPS = REPO / "hf-kit" / "props"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")


@pytest.fixture
def run(tmp_path):
    return make_run(tmp_path)


def _two_heroes(shots, words, manifest):
    """Add a second volcano hero (scene 4) so the hero count rule passes."""
    s4 = copy.deepcopy(shots["scenes"][0])
    s4["id"] = 4
    shots["scenes"].append(s4)
    words["scenes"].append({"id": 4, "source": "kokoro", "words": copy.deepcopy(words["scenes"][0]["words"])})
    manifest["scenes"].append({"id": 4, "file": "scene-04.wav", "duration_s": 9.0})


def test_fixture_with_two_heroes_is_valid(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    assert validate_shots(shots, words, manifest, PROPS) == []


def test_unknown_cue_word_names_scene_and_cue(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    shots["scenes"][1]["cues"][2]["at"] = {"word": 99}
    errs = validate_shots(shots, words, manifest, PROPS)
    assert len(errs) == 1
    assert "scene 2" in errs[0] and "cue 2" in errs[0] and "word 99" in errs[0]


def test_unknown_camera_and_until_words(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    shots["scenes"][0]["camera"][1]["at"] = {"word": 40}
    shots["scenes"][0]["cues"][0]["until"] = {"word": 41}
    errs = validate_shots(shots, words, manifest, PROPS)
    assert any("scene 1" in e and "camera key 1" in e and "word 40" in e for e in errs)
    assert any("scene 1" in e and "cue 0" in e and "word 41" in e for e in errs)


@pytest.mark.parametrize("heroes", [1, 5])
def test_hero_count_outside_2_to_4_is_an_error(heroes):
    hero, kit = fixture_shots()["scenes"][:2]
    ws = words_for(NARRATION[1], 9.0)
    scenes, wscenes, mscenes = [], [], []
    for i in range(1, 7):
        s = copy.deepcopy(hero if i <= heroes else kit)
        s["id"] = i
        if s["kind"] == "kit":
            s["cues"] = []
        scenes.append(s)
        wscenes.append({"id": i, "source": "kokoro", "words": ws})
        mscenes.append({"id": i, "file": f"scene-{i:02d}.wav", "duration_s": 9.0})
    errs = validate_shots({"scenes": scenes}, {"source": "kokoro", "scenes": wscenes},
                          {"scenes": mscenes}, PROPS)
    assert len(errs) == 1 and "hero" in errs[0] and str(heroes) in errs[0]
    assert validate_shots({"scenes": scenes}, {"source": "kokoro", "scenes": wscenes},
                          {"scenes": mscenes}, PROPS, hero_count=False) == []


def test_schema_errors(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    s = shots["scenes"]
    s[0]["kind"] = "custom"
    s[1]["scene"] = "carousel"
    s[2]["props"]["points"] = ["x"] * 7
    s[3]["prop"] = "unicorn"
    errs = "\n".join(validate_shots(shots, words, manifest, PROPS))
    assert "scene 1: kind must be hero or kit" in errs
    assert "scene 2: unknown kit scene carousel" in errs
    assert "scene 3: recap: points has at most 5 items" in errs
    assert "scene 4: prop unicorn is not in the prop library" in errs


def test_scene_ids_must_match_manifest_and_words(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    manifest["scenes"].append({"id": 9, "file": "scene-09.wav", "duration_s": 3})
    words["scenes"] = [w for w in words["scenes"] if w["id"] != 3]
    errs = "\n".join(validate_shots(shots, words, manifest, PROPS))
    assert "scene 9: in the voice manifest but not in shots.json" in errs
    assert "scene 3: no word timings in words.json" in errs


def test_presenter_and_transition_checked_by_the_kit(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    shots["scenes"][1]["presenter"] = {"pose": "dance", "expression": "happy", "position": "middle", "size": "small"}
    shots["scenes"][2]["transition"] = "spin"
    errs = "\n".join(validate_shots(shots, words, manifest, PROPS))
    assert "scene 2: presenter position must be left, right or none" in errs
    assert "scene 2: presenter pose must be one of" in errs
    assert "scene 3: transition must be one of cut, fade, blur, slide, zoom" in errs


def test_hero_cue_targets_are_prop_anchors_and_phases(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    shots["scenes"][0]["cues"][0]["target"] = "summit"
    shots["scenes"][0]["cues"][1]["target"] = "explode"
    shots["scenes"][0]["camera"][1]["frame"] = {"focus": "basement", "zoom": 1.2}
    errs = "\n".join(validate_shots(shots, words, manifest, PROPS))
    assert "scene 1: cue 0: label target summit is not an anchor of volcano" in errs
    assert "scene 1: cue 1: phase explode is not a phase of volcano" in errs
    shots["scenes"][0]["cues"][0]["target"] = "chamber"
    shots["scenes"][0]["cues"][1]["target"] = "rise"
    errs = "\n".join(validate_shots(shots, words, manifest, PROPS))
    assert "scene 1: camera key 1 names an unknown anchor basement" in errs


def test_new_prop_needs_its_hero_module(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    shots["scenes"][3].update({"prop": "geyser", "new_prop": True})
    shots["scenes"][3]["cues"] = []
    shots["scenes"][3]["camera"] = []
    scenes_dir = run / "04-video" / "hf" / "scenes"
    errs = validate_shots(shots, words, manifest, PROPS, scenes_dir=scenes_dir)
    assert len(errs) == 1 and "scene 4" in errs[0] and "scene-4.js" in errs[0]
    scenes_dir.mkdir(parents=True)
    (scenes_dir / "scene-4.js").write_text(
        '(function(){HFKit.props["geyser"]={meta:{name:"geyser",world:{width:1920,height:1080},'
        'frame:{x:0,y:0,width:1920,height:1080},anchors:["spout"]},'
        'mount:function(){return {update:function(){},anchors:{spout:{x:1,y:1}}};}};})();', encoding="utf-8")
    assert validate_shots(shots, words, manifest, PROPS, scenes_dir=scenes_dir) == []
    # a new prop may not take the name of a library prop
    shots["scenes"][3]["prop"] = "volcano"
    errs = validate_shots(shots, words, manifest, PROPS, scenes_dir=scenes_dir)
    assert any("scene 4" in e and "already in the prop library" in e for e in errs)


def test_new_prop_module_that_throws_on_load_is_reported(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    shots["scenes"][3].update({"prop": "geyser", "new_prop": True, "cues": [], "camera": []})
    scenes_dir = run / "04-video" / "hf" / "scenes"
    scenes_dir.mkdir(parents=True)
    (scenes_dir / "scene-4.js").write_text('throw new Error("half-drawn geyser");', encoding="utf-8")
    errs = validate_shots(shots, words, manifest, PROPS, scenes_dir=scenes_dir)
    assert len(errs) == 1 and "scene 4" in errs[0] and "scene-4.js" in errs[0] and "half-drawn geyser" in errs[0]


def _overrun(run, shots, words, manifest, sid):
    return {r["id"]: r for r in kit_check(shots, words, manifest, PROPS)}[sid]["overrun"]


def test_camera_overrun_fails_above_a_quarter_second_and_warns_below(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    # a big pan at full zoom near the end cannot finish inside the scene
    shots["scenes"][0]["camera"] = [{"at": {"word": 0}, "frame": "wide"},
                                    {"at": {"word": 16}, "frame": {"focus": "crater", "zoom": 2.5}},
                                    {"at": {"word": 33}, "frame": {"focus": "chamber", "zoom": 2.5}}]
    errs, warns = review_shots(shots, words, manifest, PROPS)
    assert any(e.startswith("scene 1: camera finishes") and "after the scene ends" in e for e in errs)

    # a scene that ends 0.1 s before the camera move does: warning only
    shots["scenes"][0]["camera"] = [{"at": {"word": 0}, "frame": "wide"},
                                    {"at": {"word": 30}, "frame": {"focus": "chamber", "zoom": 1.3}}]
    manifest["scenes"][0]["duration_s"] = 30.0
    assert _overrun(run, shots, words, manifest, 1) == 0
    manifest["scenes"][0]["duration_s"] = 0.0
    end = _overrun(run, shots, words, manifest, 1)  # = when the last move ends
    manifest["scenes"][0]["duration_s"] = end - 0.1
    errs, warns = review_shots(shots, words, manifest, PROPS)
    assert not [e for e in errs if "camera" in e]
    assert any(w.startswith("scene 1: camera finishes") for w in warns)


def test_cli_validate(run, capsys):
    shots, words, manifest = load(run)
    assert shots_mod.main(["validate", str(run)]) == 1  # one hero only
    assert "hero" in capsys.readouterr().err
    _two_heroes(shots, words, manifest)
    (run / "03-design" / "shots.json").write_text(json.dumps(shots), encoding="utf-8")
    (run / "02-voice" / "words.json").write_text(json.dumps(words), encoding="utf-8")
    (run / "02-voice" / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    assert shots_mod.main(["validate", str(run)]) == 0
    assert "shots.json OK" in capsys.readouterr().out
