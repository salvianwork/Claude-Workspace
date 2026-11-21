"""HyperFrames composition builder, snapshots and the render engine switch."""
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from tests.hf.run_fixture import SECONDS, load, make_run
from tools.audio import library as lib
from tools.audio.mix import build_mix
from tools.hf import build as build_mod
from tools.hf.build import build
from tools.hf.render import HFError, assert_offline
from tools.hf.snapshot import snapshot
from tools.render import render as render_mod

REPO = Path(__file__).resolve().parents[2]
KIT = REPO / "hf-kit"

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")
needs_hf = pytest.mark.skipif(
    shutil.which("npx") is None or shutil.which("ffmpeg") is None
    or not (KIT / "node_modules" / "hyperframes").is_dir(),
    reason="needs npx, ffmpeg and `npm ci` in hf-kit")

THROWING_MOUNT = """(function () {
  HFKit.props["geyser"] = {
    meta: {name: "geyser", world: {width: 1920, height: 1080}, frame: {x: 0, y: 0, width: 1920, height: 1080}, anchors: ["spout"]},
    mount: function () { throw new Error("geyser drawing is broken"); }
  };
})();
"""


@pytest.fixture
def run(tmp_path):
    return make_run(tmp_path)


def _write_shots(run, shots):
    (run / "03-design" / "shots.json").write_text(json.dumps(shots), encoding="utf-8")


def _new_prop(run, module_text, sid=1):
    shots, _, _ = load(run)
    s = shots["scenes"][sid - 1]
    s.update({"prop": "geyser", "new_prop": True, "cues": [], "camera": [], "params": {}})
    _write_shots(run, shots)
    scenes = run / "04-video" / "hf" / "scenes"
    scenes.mkdir(parents=True, exist_ok=True)
    (scenes / f"scene-{sid}.js").write_text(module_text, encoding="utf-8")


@needs_node
def test_build_writes_one_composition(run):
    comp = build(run, KIT, run_check=False, hero_count=False)
    assert comp == run / "04-video" / "hf"
    page = (comp / "index.html").read_text(encoding="utf-8")
    data = json.loads((comp / "data.json").read_text(encoding="utf-8"))
    inline = re.search(r'<script id="hf-data" type="application/json">(.*?)</script>', page, re.S).group(1)
    assert json.loads(inline) == data

    frames = [270, 135, 138]  # ceil(9.0 / 4.5 / 4.6 s x 30)
    assert [s["frames"] for s in data["scenes"]] == frames
    assert [s["id"] for s in data["scenes"]] == [1, 2, 3]
    starts = [s["start"] for s in data["scenes"]]
    assert starts == [0, 270 / 30, 405 / 30]  # back to back
    assert data["frames"] == sum(frames) and data["total"] == pytest.approx(sum(frames) / 30)
    assert abs(data["total"] - sum(SECONDS.values())) < 0.1
    assert 'data-composition-id="main"' in page and f'data-duration="{build_mod._num(data["total"])}"' in page
    for s in data["scenes"]:
        assert f'id="scene-{s["id"]}" class="scene clip"' in page
        assert len(s["mouth"]) == s["frames"] and max(s["mouth"]) > 0.3  # from the wav
        assert s["words"][0]["display"]  # captions keep punctuation
    assert [s["transition"] for s in data["scenes"]] == ["fade", "slide", "blur"]
    assert [s["next"] for s in data["scenes"]] == ["slide", "blur", None]
    assert data["presenterOutfit"] == "labcoat"
    assert data["scenes"][0]["prop"] == "volcano" and data["scenes"][1]["scene"] == "steps"

    # kit + only the props the video uses; the library prop is loaded for the hero
    assert (comp / "kit" / "src" / "composition.js").is_file()
    assert (comp / "kit" / "props" / "volcano" / "prop.js").is_file()
    assert '<script src="kit/props/volcano/prop.js"></script>' in page
    assert page.index('src="kit/src/composition.js"') < page.index('src="kit/props/volcano/prop.js"')
    assert "HFKit.mountComposition" in page
    assert assert_offline(comp) == []


@needs_node
def test_build_refuses_invalid_shots_naming_scene_and_cue(run):
    shots, _, _ = load(run)
    shots["scenes"][2]["cues"][1]["at"] = {"word": 77}
    _write_shots(run, shots)
    with pytest.raises(HFError) as e:
        build(run, KIT, run_check=False, hero_count=False)
    assert "scene 3: cue 1 at word 77" in str(e.value)
    assert not (run / "04-video" / "hf" / "index.html").exists()


@needs_node
def test_build_fails_a_scene_whose_camera_overruns(run):
    shots, _, _ = load(run)
    shots["scenes"][0]["camera"] = [{"at": {"word": 0}, "frame": "wide"},
                                    {"at": {"word": 16}, "frame": {"focus": "crater", "zoom": 2.5}},
                                    {"at": {"word": 33}, "frame": {"focus": "chamber", "zoom": 2.5}}]
    _write_shots(run, shots)
    with pytest.raises(HFError, match=r"scene 1: camera finishes [0-9.]+ s after the scene ends"):
        build(run, KIT, run_check=False, hero_count=False)


@needs_node
def test_build_loads_new_prop_heroes_from_the_run(run):
    _new_prop(run, THROWING_MOUNT.replace('throw new Error("geyser drawing is broken");',
                                          'return {update: function () {}, anchors: {spout: {x: 1, y: 1}}};'))
    comp = build(run, KIT, run_check=False, hero_count=False)
    page = (comp / "index.html").read_text(encoding="utf-8")
    assert '<script src="scenes/scene-1.js"></script>' in page
    assert "kit/props/volcano" not in page and not (comp / "kit" / "props" / "volcano").exists()
    assert '"scenes/scene-1.js": [1]' in page  # load errors are named scene-1


@needs_node
def test_build_reports_a_hero_module_that_throws_on_load(run):
    _new_prop(run, 'throw new Error("half-drawn geyser");')
    with pytest.raises(HFError) as e:
        build(run, KIT, run_check=False, hero_count=False)
    assert "scene 1" in str(e.value) and "scenes/scene-1.js" in str(e.value) and "half-drawn geyser" in str(e.value)


def test_cli_build_reports_errors(run, monkeypatch, capsys):
    def boom(*a, **k):
        raise HFError("scene-2: mount failed: x")
    monkeypatch.setattr(build_mod, "build", boom)
    assert build_mod.main([str(run)]) == 1
    assert "scene-2" in capsys.readouterr().err


def test_render_cli_engine_choice(run, monkeypatch, tmp_path):
    calls = []

    def fake(run_dir, templates_dir, engine="hyperframes", *, workers=None, hero_count=True):
        calls.append((engine, workers, hero_count))
        return tmp_path / "v.mp4"
    monkeypatch.setattr(render_mod, "render_video", fake)
    assert render_mod.main([str(run)]) == 0
    assert render_mod.main([str(run), "--engine", "remotion"]) == 0
    assert render_mod.main([str(run), "--workers", "3", "--allow-hero-count"]) == 0
    assert calls == [("hyperframes", None, True), ("remotion", None, True), ("hyperframes", 3, False)]
    with pytest.raises(SystemExit):
        render_mod.main([str(run), "--engine", "flash"])


def test_render_video_passes_workers_and_hero_rule_to_hyperframes(run, monkeypatch):
    from tools.hf import build as hb
    from tools.hf import render as hr
    seen = {}
    (run / "04-video" / "audio").mkdir(parents=True)
    (run / "04-video" / "audio" / "mix.wav").write_bytes(b"x")
    monkeypatch.setattr(hb, "build", lambda run_dir, **kw: seen.update(build=kw) or run_dir / "04-video" / "hf")

    def fake_render(comp, out, *, workers=None):
        seen["workers"] = workers
        out.write_bytes(b"mp4")
        return {"check": {}, "seconds": 1.0}
    monkeypatch.setattr(hr, "render", fake_render)
    monkeypatch.setattr(render_mod, "_mux", lambda ffmpeg, silent, mix, final, run_dir: final)
    monkeypatch.setattr(render_mod, "_tools", lambda *names: {n: n for n in names})
    render_mod.render_video(run, engine="hyperframes", workers=5)
    assert seen == {"build": {"hero_count": True}, "workers": 5}
    render_mod.render_video(run, engine="hyperframes", hero_count=False)
    assert seen == {"build": {"hero_count": False}, "workers": None}


@needs_node
def test_build_enforces_two_to_four_heroes_by_default(run):
    with pytest.raises(HFError) as e:
        build(run, KIT, run_check=False)
    assert "1 hero scene(s); a video needs 2-4 hero scenes" in str(e.value)
    assert build_mod.main([str(run), "--no-check"]) == 1
    assert build_mod.main([str(run), "--no-check", "--allow-hero-count"]) == 0


def test_render_hyperframes_needs_the_mix(run):
    with pytest.raises(render_mod.RenderError, match="mix not found"):
        render_mod.render_video(run, REPO / "templates", engine="hyperframes")


# ---- slow: real HyperFrames ---------------------------------------------------------------

@pytest.mark.slow
@needs_hf
def test_hero_module_that_throws_in_mount_fails_check_naming_the_scene(run):
    _new_prop(run, THROWING_MOUNT, sid=1)
    with pytest.raises(HFError) as e:
        build(run, KIT, hero_count=False)
    assert "scene-1: mount failed: geyser drawing is broken" in str(e.value)


def _music_library(tmp_path) -> Path:
    root = tmp_path / "lib"
    rng = np.random.default_rng(0)
    mus = tmp_path / "m.wav"
    sf.write(str(mus), 0.2 * rng.standard_normal(44100 * 5), 44100)
    lib.add_item(root, mus, "music", ["curious"], "CC0-1.0", "https://x/m")
    return root


@pytest.mark.slow
@needs_hf
def test_render_hyperframes_end_to_end(run, tmp_path, capsys):
    build_mix(run, _music_library(tmp_path))
    assert render_mod.main([str(run), "--engine", "hyperframes", "--allow-hero-count"]) == 0
    printed = capsys.readouterr().out
    print(printed)
    out = run / "04-video" / "out" / "video.mp4"
    assert out.is_file() and not (run / "04-video" / "out" / "silent.mp4").exists()
    info = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate",
         "-of", "json", str(out)], capture_output=True, text=True, check=True).stdout)
    total = json.loads((run / "02-voice" / "manifest.json").read_text())["total_s"]
    assert abs(float(info["format"]["duration"]) - total) <= 0.1
    kinds = sorted(s["codec_type"] for s in info["streams"])
    assert kinds == ["audio", "video"]
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    assert (v["width"], v["height"], v["r_frame_rate"]) == (1920, 1080, "30/1")

    shots = snapshot(run)
    assert [p.name for p in shots] == [f"scene-{i}-{w}.png" for i in (1, 2, 3) for w in ("start", "mid", "end")]
    assert all(p.stat().st_size > 10_000 for p in shots)
    keep = os.environ.get("HF_KEEP_SNAPSHOTS")
    if keep:  # optional: keep the snapshots somewhere to look at them
        Path(keep).mkdir(parents=True, exist_ok=True)
        for p in shots:
            shutil.copyfile(p, Path(keep) / p.name)
