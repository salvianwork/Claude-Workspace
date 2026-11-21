import json
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from tools.audio import library as lib
from tools.audio.mix import build_mix
from tools.render.render import (RenderError, durations_to_frames, render_video,
                                 validate_scene_timing)

REPO = Path(__file__).resolve().parents[2]
SR_V = 24000


def test_frames_round_up():
    m = {"scenes": [{"id": 1, "file": "a.wav", "duration_s": 12.41},
                    {"id": 2, "file": "b.wav", "duration_s": 2.1}]}
    assert durations_to_frames(m) == {1: 373, 2: 63}


def test_timing_mismatch_reported():
    m = {"scenes": [{"id": 1, "duration_s": 2.0}, {"id": 2, "duration_s": 2.0}]}
    scenes = {"fps": 30, "scenes": [{"id": 1, "durationInFrames": 61},
                                    {"id": 2, "durationInFrames": 80}]}
    problems = validate_scene_timing(scenes, m)
    assert len(problems) == 1 and "scene 2" in problems[0]
    scenes["scenes"][1]["durationInFrames"] = 60
    assert validate_scene_timing(scenes, m) == []


def test_render_refuses_on_timing_problem(tmp_path):
    run = tmp_path / "run"
    (run / "02-voice").mkdir(parents=True)
    (run / "04-video").mkdir(parents=True)
    (run / "02-voice" / "manifest.json").write_text(json.dumps(
        {"scenes": [{"id": 1, "duration_s": 2.0}], "total_s": 2.0}))
    (run / "04-video" / "scenes.json").write_text(json.dumps(
        {"fps": 30, "scenes": [{"id": 1, "durationInFrames": 999}]}))
    with pytest.raises(RenderError, match="scene 1"):
        render_video(run, REPO / "templates", engine="remotion")


def _tone(path, seconds):
    t = np.arange(int(seconds * SR_V)) / SR_V
    x = np.zeros_like(t)
    m = (t >= 0.2) & (t < seconds - 0.2)
    x[m] = 0.3 * np.sin(2 * np.pi * 220 * t[m])
    sf.write(str(path), x, SR_V)


@pytest.mark.slow
def test_render_fixture_end_to_end(tmp_path):
    fixture = json.loads((REPO / "templates/fixtures/sample-scenes.json").read_text())
    root = tmp_path / "lib"
    rng = np.random.default_rng(0)
    mus = tmp_path / "m.wav"
    sf.write(str(mus), 0.2 * rng.standard_normal(44100 * 5), 44100)
    lib.add_item(root, mus, "music", ["curious"], "CC0-1.0", "https://x/m")
    run = tmp_path / "run"
    for d in ("02-voice", "03-design", "04-video"):
        (run / d).mkdir(parents=True)
    ms = []
    for s in fixture["scenes"]:
        name = f"scene-{s['id']:02d}.wav"
        _tone(run / "02-voice" / name, 2.0)
        ms.append({"id": s["id"], "file": name, "duration_s": 2.0})
        s["durationInFrames"] = durations_to_frames({"scenes": [ms[-1]]})[s["id"]]
    total = 2.0 * len(ms)
    manifest = {"language": "en", "engine": "kokoro", "voice": "v", "speed": 1.0,
                "sample_rate": SR_V, "scenes": ms, "total_s": total}
    (run / "02-voice" / "manifest.json").write_text(json.dumps(manifest))
    (run / "03-design" / "sound.json").write_text(json.dumps({"music_mood": "curious", "sfx": []}))
    (run / "04-video" / "scenes.json").write_text(json.dumps(fixture))
    build_mix(run, root)

    out = render_video(run, REPO / "templates", engine="remotion")
    assert out == run / "04-video" / "out" / "video.mp4" and out.exists()
    assert not (run / "04-video" / "out" / "silent.mp4").exists()
    info = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
         "-of", "json", str(out)], capture_output=True, text=True, check=True).stdout)
    assert abs(float(info["format"]["duration"]) - total) <= 0.1
    kinds = sorted(s["codec_type"] for s in info["streams"])
    assert kinds == ["audio", "video"]
