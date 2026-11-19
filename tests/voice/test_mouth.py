import json

import numpy as np
import soundfile as sf

from tools.voice.mouth import add_mouth_to_scenes, mouth_envelope

SR = 24000


def _tone(seconds, dbfs):
    t = np.arange(int(SR * seconds)) / SR
    return (10 ** (dbfs / 20) * np.sqrt(2) * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def test_silence_is_closed():
    env = mouth_envelope(np.zeros(SR), SR, 30)
    assert env == [0.0] * 30


def test_loud_tone_opens_mouth():
    env = mouth_envelope(_tone(1.0, -6), SR, 30)
    assert np.mean(env) > 0.8


def test_length_matches_frames():
    env = mouth_envelope(_tone(1.0, -6), SR, 31)
    assert len(env) == 31
    assert env[-1] == 0.0
    assert len(mouth_envelope(_tone(1.0, -6), SR, 10)) == 10


def _make_run(tmp_path, scene_ids=(1, 2), manifest_ids=(1, 2)):
    voice = tmp_path / "02-voice"
    voice.mkdir()
    video = tmp_path / "04-video"
    video.mkdir()
    entries = []
    for i in manifest_ids:
        sf.write(voice / f"scene-{i:02d}.wav", _tone(1.0, -10), SR)
        entries.append({"id": i, "file": f"scene-{i:02d}.wav", "duration_s": 1.0})
    (voice / "manifest.json").write_text(json.dumps({"sample_rate": SR, "scenes": entries}))
    scenes = [{"id": i, "template": "TitleCard", "durationInFrames": 30 + i, "props": {}, "narration": "x"} for i in scene_ids]
    (video / "scenes.json").write_text(json.dumps({"fps": 30, "scenes": scenes}))


def test_add_mouth_to_scenes(tmp_path):
    _make_run(tmp_path)
    add_mouth_to_scenes(tmp_path)
    data = json.loads((tmp_path / "04-video" / "scenes.json").read_text())
    assert data["fps"] == 30
    for sc in data["scenes"]:
        assert len(sc["mouth"]) == sc["durationInFrames"]
        assert all(0.0 <= v <= 1.0 for v in sc["mouth"])


def test_missing_scene_raises(tmp_path):
    import pytest

    _make_run(tmp_path, scene_ids=(1, 2, 3), manifest_ids=(1, 2))
    with pytest.raises(ValueError, match="3"):
        add_mouth_to_scenes(tmp_path)
