"""End-to-end smoke test on Linux: fixture script -> fake voice -> mix -> render -> checks."""
import json
import shutil
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from tests.voice.test_synth import FakeEngine
from tools.audio import library as lib
from tools.audio.basic_sfx import generate_basic_sfx
from tools.audio.mix import build_mix, check_mix
from tools.pipeline.script import parse_script
from tools.render.render import durations_to_frames, render_video
from tools.voice.mouth import add_mouth_to_scenes
from tools.voice.synth import synth_scenes

REPO = Path(__file__).resolve().parents[1]


@pytest.mark.slow
def test_smoke_full_pipeline(tmp_path):
    run = tmp_path / "run"
    (run / "01-script").mkdir(parents=True)
    (run / "03-design").mkdir()
    (run / "04-video").mkdir()
    script_path = run / "01-script" / "script.md"
    shutil.copy(REPO / "tests/fixtures/script_ok.md", script_path)
    script = parse_script(script_path)

    # voice (fake engine) -> manifest
    manifest = synth_scenes(script_path, run / "02-voice", FakeEngine())
    manifest_path = run / "02-voice" / "manifest.json"
    assert manifest_path.exists() and len(manifest["scenes"]) == 3

    # design: scenes.json from the template fixture (first 3 scenes), timed to the voice
    fixture = json.loads((REPO / "templates/fixtures/sample-scenes.json").read_text())
    frames = durations_to_frames(manifest)
    fixture["scenes"] = fixture["scenes"][:3]
    for s, sc in zip(fixture["scenes"], script.scenes):
        s["id"] = sc.id
        s["durationInFrames"] = frames[sc.id]
        s["narration"] = sc.narration
        s.pop("mouth", None)
    assert fixture["scenes"][0].get("presenter"), "fixture should carry a presenter line"
    (run / "04-video" / "scenes.json").write_text(json.dumps(fixture))
    add_mouth_to_scenes(run)
    scenes = json.loads((run / "04-video" / "scenes.json").read_text())
    assert any(max(s["mouth"]) > 0 for s in scenes["scenes"])

    # sound: synthetic music + a few basic sfx
    root = tmp_path / "lib"
    music = tmp_path / "m.wav"
    sf.write(str(music), 0.2 * np.random.default_rng(0).standard_normal(44100 * 5), 44100)
    lib.add_item(root, music, "music", ["curious"], "CC0-1.0", "https://example.org/m")
    generate_basic_sfx(root)
    (run / "03-design" / "sound.json").write_text(json.dumps(
        {"music_mood": "curious", "sfx": [{"scene": 2, "at_s": 0.1, "type": "pop"}]}))

    build_mix(run, root)
    assert check_mix(run)["problems"] == []

    out = render_video(run, REPO / "templates", engine="remotion")
    assert out.exists() and out.stat().st_size > 0

    # transcript check needs faster-whisper (and its model download)
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        pytest.skip("render + mix passed; transcript step skipped: faster-whisper not installed")
    # The fake voice is a tone, not speech, so the check here is that it runs on the final video.
    from tools.review.transcript import transcribe
    assert isinstance(transcribe(out), str)
