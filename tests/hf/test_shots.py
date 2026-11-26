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


GEYSER = ('(function(){HFKit.props["geyser"]={meta:{name:"geyser",world:{width:1920,height:1080},'
          'frame:{x:0,y:0,width:1920,height:1080},anchors:["spout"]},'
          'mount:function(){return {update:function(){},anchors:{spout:{x:1,y:1}}};}};})();')


def test_paths_with_spaces_reach_the_node_helper(tmp_path):
    """Run, props, hero module and kit folders all have spaces (Windows-style paths)."""
    run = make_run(tmp_path / "a folder")
    kit = tmp_path / "my kit copy"
    for part in ("src", "vendor"):
        shutil.copytree(REPO / "hf-kit" / part, kit / part)
    shutil.copytree(PROPS / "volcano", kit / "props" / "volcano")
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    shots["scenes"][3].update({"prop": "geyser", "new_prop": True, "cues": [], "camera": []})
    scenes_dir = run / "04-video" / "hf" / "scenes"
    scenes_dir.mkdir(parents=True)
    (scenes_dir / "scene-4.js").write_text(GEYSER, encoding="utf-8")
    assert " " in str(run) and " " in str(kit)
    errs, warns = review_shots(shots, words, manifest, kit / "props", scenes_dir=scenes_dir, kit_dir=kit)
    assert errs == [] and warns == []
    report = kit_check(shots, words, manifest, kit / "props", scenes_dir=scenes_dir, kit_dir=kit)
    assert [r["id"] for r in report] == [1, 2, 3, 4]


def test_hero_without_anchorsFor_warns_camera_not_checked(run):
    shots, words, manifest = load(run)
    _two_heroes(shots, words, manifest)
    shots["scenes"][3].update({"prop": "geyser", "new_prop": True, "cues": [],
                               "camera": [{"at": {"word": 0}, "frame": "wide"},
                                          {"at": {"word": 5}, "frame": {"focus": "spout", "zoom": 1.2}}]})
    scenes_dir = run / "04-video" / "hf" / "scenes"
    scenes_dir.mkdir(parents=True)
    (scenes_dir / "scene-4.js").write_text(GEYSER, encoding="utf-8")
    errs, warns = review_shots(shots, words, manifest, PROPS, scenes_dir=scenes_dir)
    assert errs == []
    assert warns == ["scene 4: camera timing NOT checked (add anchorsFor): prop geyser has no anchorsFor(params)"]


# ---- schema 2: world scenes -----------------------------------------------------------------

from tests.hf.run_fixture import make_world_run, world_shots  # noqa: E402

PLACE_MODULE = """(function () {
  var meta = {name: "my-hill", description: "a test hill with one spot", variants: ["day"],
              anchors: ["spot"], paths: ["ridge"], actorScale: 1};
  function anchorsFor() {
    return {anchors: {spot: function () { return {x: 1920, y: 1500}; }},
            paths: {ridge: [{x: 1000, y: 1500}, {x: 2800, y: 1500}]}};
  }
  HFKit.places["my-hill"] = {meta: meta, anchorsFor: anchorsFor, mount: function () {
    var a = anchorsFor(); return {update: function () {}, anchors: a.anchors, paths: a.paths}; }};
})();
"""

CUSTOM_MODULE = """(function () {
  HFKit.customs["rail-spark"] = {mount: function () { return {update: function () {}}; }};
})();
"""


@pytest.fixture
def wrun(tmp_path):
    return make_world_run(tmp_path)


def _w(run):
    shots, words, manifest = load(run)
    return shots, words, manifest


def _errs(shots, words, manifest, **kw):
    return validate_shots(shots, words, manifest, PROPS, **kw)


def test_world_fixture_is_valid(wrun):
    shots, words, manifest = _w(wrun)
    errs, warns = review_shots(shots, words, manifest, PROPS, scenes_dir=wrun / "04-video" / "hf" / "scenes")
    assert errs == [] and warns == []


@pytest.mark.parametrize("kind", ["story", "action", "other"])
def test_world_later_phase_types_are_refused(wrun, kind):
    shots, words, manifest = _w(wrun)
    shots["type"] = kind
    assert _errs(shots, words, manifest) == [f'type "{kind}" is coming in a later phase — use explainer or what-if']


def test_world_type_and_audience_must_be_known(wrun):
    shots, words, manifest = _w(wrun)
    shots["type"] = "lecture"
    shots["audience"] = "toddlers"
    errs = _errs(shots, words, manifest)
    assert 'type must be explainer or what-if (got "lecture")' in errs
    assert 'audience must be all-ages, teens or adults (got "toddlers")' in errs
    shots["type"] = "what-if"
    del shots["audience"]  # all-ages by default
    assert _errs(shots, words, manifest) == []


def test_unknown_schema_is_refused(wrun):
    shots, words, manifest = _w(wrun)
    shots["schema"] = 3
    assert _errs(shots, words, manifest) == ["shots.json: schema must be 2 (world scenes) or absent (schema 1), got 3"]


def test_world_every_scene_is_a_world_scene(wrun):
    shots, words, manifest = _w(wrun)
    shots["scenes"][1]["kind"] = "kit"
    assert _errs(shots, words, manifest) == ['scene 2: kind must be "world" in schema 2 (got "kit")']


def test_world_place_must_exist_or_be_new_with_its_module(wrun):
    shots, words, manifest = _w(wrun)
    shots["scenes"][1]["place"] = "my-hill"
    errs = _errs(shots, words, manifest)
    assert errs == ["scene 2: place my-hill is not in the places library (hf-kit/places/); "
                    "set new_place true and write 04-video/hf/scenes/place-my-hill.js"]
    shots["scenes"][1].update(new_place=True, beats=[{"at": {"word": 0}, "moves": [
        {"do": "point", "who": "host", "target": "spot"}]}])
    scenes_dir = wrun / "04-video" / "hf" / "scenes"
    errs = _errs(shots, words, manifest, scenes_dir=scenes_dir)
    assert errs == ["scene 2: new place my-hill needs its module 04-video/hf/scenes/place-my-hill.js "
                    "(registering HFKit.places[\"my-hill\"])"]
    scenes_dir.mkdir(parents=True)
    (scenes_dir / "place-my-hill.js").write_text(PLACE_MODULE, encoding="utf-8")
    assert _errs(shots, words, manifest, scenes_dir=scenes_dir) == []
    # a new place may not reuse a library name
    shots["scenes"][1]["place"] = "lab"
    assert any("place lab is already in the places library" in e
               for e in _errs(shots, words, manifest, scenes_dir=scenes_dir))


def test_world_new_place_module_that_does_not_register_is_reported(wrun):
    shots, words, manifest = _w(wrun)
    shots["scenes"][1].update(place="my-hill", new_place=True)
    scenes_dir = wrun / "04-video" / "hf" / "scenes"
    scenes_dir.mkdir(parents=True)
    (scenes_dir / "place-my-hill.js").write_text("var nothing = 1;", encoding="utf-8")
    errs = _errs(shots, words, manifest, scenes_dir=scenes_dir)
    assert errs == ['scene 2: scenes/place-my-hill.js does not register HFKit.places["my-hill"] = {meta, anchorsFor, mount}']


def test_world_variant_and_actors_are_checked_by_the_kit(wrun):
    shots, words, manifest = _w(wrun)
    shots["scenes"][0]["variant"] = "winter"
    shots["scenes"][1]["actors"].append({"id": "mum", "start": {"anchor": "bench"}})
    errs = _errs(shots, words, manifest)
    assert 'scene 1: place countryside: unknown variant "winter"' in errs
    assert any(e.startswith("scene 2 actor mum: not in the cast") for e in errs)
    # an extra needs no cast entry
    shots["scenes"][0]["variant"] = "day"
    shots["scenes"][1]["actors"][-1]["character"] = "extra-2"
    assert _errs(shots, words, manifest) == []


def test_world_cast_needs_the_host(wrun):
    shots, words, manifest = _w(wrun)
    shots["cast"] = [{"id": "friend", "character": "extra-1"}]
    errs = _errs(shots, words, manifest)
    assert 'cast: needs the host (character "host")' in errs
    assert errs.count('cast: needs the host (character "host")') == 1


def test_world_every_beat_has_moves(wrun):
    shots, words, manifest = _w(wrun)
    shots["scenes"][1]["beats"][0]["moves"] = []
    assert _errs(shots, words, manifest) == ["scene 2 beat 0: no moves (show, don't tell)"]


def test_world_text_limits(wrun):
    shots, words, manifest = _w(wrun)
    shots["scenes"][0]["beats"][1]["moves"][2]["text"] = "this tag is far too long"
    shots["scenes"][1]["beats"][0]["moves"].append({"do": "title", "text": "Sound speeds"})
    errs = _errs(shots, words, manifest)
    assert any(e.startswith("scene 1 beat 1 move 2 (tag_follow): text") and "at most 4" in e for e in errs)
    assert "scene 2 beat 0 move 2 (title): a title belongs in scene 1 only" in errs
    assert len(errs) == 2


def test_world_step_ins_one_or_two(wrun):
    shots, words, manifest = _w(wrun)
    # no step-in: scene 1's host stays in the slot
    shots["scenes"][0]["beats"][0]["moves"].pop(1)
    errs = _errs(shots, words, manifest)
    assert errs == ["shots.json: the host steps into the world in 0 scene(s); a video has 1-2 step-ins "
                    "(the host talks from the side slot otherwise)"]
    assert _errs(shots, words, manifest, allow_step_ins=True) == []
    # three: scenes 1, 2 (placed at an anchor) and 3 (walks in from the slot)
    shots, words, manifest = _w(wrun)
    shots["scenes"][1]["actors"][0]["start"] = {"anchor": "bench"}
    s3 = copy.deepcopy(shots["scenes"][0])
    s3["id"] = 3
    shots["scenes"].append(s3)
    words["scenes"].append({"id": 3, "source": "kokoro", "words": copy.deepcopy(words["scenes"][0]["words"])})
    manifest["scenes"].append({"id": 3, "file": "scene-03.wav", "duration_s": 11.0})
    errs = _errs(shots, words, manifest)
    assert errs == ["shots.json: the host steps into the world in 3 scene(s) (scenes 1, 2, 3); a video has "
                    "1-2 step-ins (the host talks from the side slot otherwise)"]
    assert _errs(shots, words, manifest, allow_step_ins=True) == []


def test_world_camera_overrun_is_an_error(wrun):
    shots, words, manifest = _w(wrun)
    shots["scenes"][1]["beats"][0]["moves"].append({"do": "push_in", "target": "bench", "zoom": 5, "at": {"t": 5.9}})
    shots["scenes"][1]["beats"][0]["moves"].append({"do": "pull_out", "zoom": 0.6, "at": {"t": 6.0}})
    errs = _errs(shots, words, manifest)
    assert any(e.startswith("scene 2: camera finishes") and "after the scene ends (limit 0.25 s)" in e for e in errs), errs


def test_world_not_to_scale_places_need_the_tag(wrun):
    shots, words, manifest = _w(wrun)
    shots["scenes"][1].update(place="space", variant="earth-orbit")
    shots["scenes"][1]["beats"][0]["moves"] = [{"do": "point", "who": "host", "target": "planet"}]
    errs = _errs(shots, words, manifest)
    assert errs == ['scene 2: place space is not to scale: add a "not to scale" tag or label to the scene']
    shots["scenes"][1]["beats"][0]["moves"].append({"do": "label", "target": "moon", "text": "Not to scale"})
    assert _errs(shots, words, manifest) == []


def test_world_custom_moves_need_the_scene_module(wrun):
    shots, words, manifest = _w(wrun)
    shots["scenes"][1]["beats"][0]["moves"].append({"do": "custom", "name": "rail-spark"})
    scenes_dir = wrun / "04-video" / "hf" / "scenes"
    errs = _errs(shots, words, manifest, scenes_dir=scenes_dir)
    assert errs == ['scene 2 beat 0 move 2 (custom): no HFKit.customs["rail-spark"] (register it in 04-video/hf/scenes/scene-2.js)']
    assert _errs(shots, words, manifest, scenes_dir=None) == []  # --no-modules: not checked yet
    scenes_dir.mkdir(parents=True)
    (scenes_dir / "scene-2.js").write_text(CUSTOM_MODULE, encoding="utf-8")
    assert _errs(shots, words, manifest, scenes_dir=scenes_dir) == []


def _cli(run, shots, *args):
    (run / "03-design" / "shots.json").write_text(json.dumps(shots), encoding="utf-8")
    return shots_mod.main(["validate", str(run), *args])


@pytest.mark.parametrize("break_it, expected", [
    (lambda s: s["scenes"][0]["beats"][1]["moves"][0].update(who="ghost"),
     'scene 1 beat 1 move 0 (use): unknown actor "ghost"'),
    (lambda s: s["scenes"][0]["beats"][0]["moves"][1].update(to="rail-mid"),
     'scene 1 beat 0 move 1 (walk_to): unknown anchor "rail-mid"'),
    (lambda s: s["scenes"][1].update(place="moon-base"),
     "scene 2: place moon-base is not in the places library"),
    (lambda s: s["scenes"][0]["beats"][1]["moves"].append({"do": "fireworks", "target": "barn"}),
     'scene 1 beat 1 move 4 (fireworks): unknown move "fireworks"'),
    (lambda s: s["scenes"][0]["beats"][1]["moves"][1].update(path="road"),
     'scene 1 beat 1 move 1 (pulse_along): unknown path "road"'),
])
def test_cli_names_scene_beat_and_move_of_a_bad_reference(wrun, capsys, break_it, expected):
    """Review Focus 2: a move naming an actor, anchor, place or effect that does not exist fails
    validation and says where, instead of rendering nothing."""
    shots, _, _ = _w(wrun)
    break_it(shots)
    assert _cli(wrun, shots) == 1
    err = capsys.readouterr().err
    assert expected in err, err


def test_cli_validate_world_ok_prints_kit_warnings(wrun, capsys):
    shots, _, _ = _w(wrun)
    assert _cli(wrun, shots) == 0
    assert "shots.json OK (2 scenes)" in capsys.readouterr().out
    # the strike slips past its word: a warning, not an error
    shots["scenes"][0]["beats"][1]["moves"][0]["at"] = {"word": 7}
    assert _cli(wrun, shots) == 0
    out = capsys.readouterr().out
    assert "warning: scene 1 beat 1 move 0 (use): the strike lands" in out


def test_cli_validate_allow_step_ins(wrun, capsys):
    shots, _, _ = _w(wrun)
    shots["scenes"][0]["beats"][0]["moves"].pop(1)
    assert _cli(wrun, shots) == 1
    assert "steps into the world in 0 scene(s)" in capsys.readouterr().err
    assert _cli(wrun, shots, "--allow-step-ins") == 0


# ---- vertical: the anchor-spread warning and caption fit (Task 6; Review Focus 2 and 3) ---------

def _vertical(shots):
    shots.pop("format", None)
    return shots


def test_vertical_anchor_spread_warns_naming_scene_beat_and_spread(wrun):
    shots, words, manifest = _w(wrun)
    _vertical(shots)
    # rail-near (x 760) and barn (x 3460) in one beat: 2700 world px apart
    shots["scenes"][0]["beats"][0]["moves"].append({"do": "burst", "target": "barn"})
    errs, warns = review_shots(shots, words, manifest, PROPS, scenes_dir=wrun / "04-video" / "hf" / "scenes")
    spread = [w for w in warns if "apart horizontally" in w]
    assert errs == [], errs
    assert len(spread) == 1, warns
    assert spread[0].startswith('scene 1 beat 0: anchors "rail-near" and "barn" are 2700 world px apart horizontally '
                                "(more than 1700;"), spread[0]
    # the same shot in landscape shows the whole width: no warning
    shots["format"] = "landscape"
    _, warns = review_shots(shots, words, manifest, PROPS, scenes_dir=wrun / "04-video" / "hf" / "scenes")
    assert not any("apart horizontally" in w for w in warns)


def test_vertical_caption_word_wider_than_a_line_warns(wrun):
    shots, words, manifest = _w(wrun)
    _vertical(shots)
    words["scenes"][0]["words"][3]["display"] = "supercalifragilisticexpialidocious"
    errs, warns = review_shots(shots, words, manifest, PROPS, scenes_dir=wrun / "04-video" / "hf" / "scenes")
    assert errs == [], errs
    assert any(w.startswith("scene 1: caption word \"supercalifragilisticexpialidocious\" is wider than the 860 px") for w in warns), warns


def test_vertical_default_world_fixture_has_no_spread_or_caption_warnings(wrun):
    shots, words, manifest = _w(wrun)
    _vertical(shots)
    _, warns = review_shots(shots, words, manifest, PROPS, scenes_dir=wrun / "04-video" / "hf" / "scenes")
    assert not any("apart horizontally" in w or "caption word" in w for w in warns), warns
