import json
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from tools.audio import library as lib
from tools.audio import mix as mixmod
from tools.audio.mix import MixCheckError, build_mix, check_mix, speech_mask

SR_V = 24000


def _noise(seconds, sr, seed=0):
    rng = np.random.default_rng(seed)
    w = rng.standard_normal(int(seconds * sr))
    return 0.2 * w / np.max(np.abs(w))


def _voice_scene(path, seconds=4.0, silent=False):
    t = np.arange(int(seconds * SR_V)) / SR_V
    x = np.zeros_like(t)
    if not silent:
        for start in (0.3, 2.0):
            m = (t >= start) & (t < start + 1.2)
            x[m] = 0.3 * np.sin(2 * np.pi * 220 * t[m])
    sf.write(str(path), x, SR_V)


@pytest.fixture
def env(tmp_path):
    root = tmp_path / "lib"
    music_wav = tmp_path / "m.wav"
    sf.write(str(music_wav), _noise(5.0, 44100), 44100)  # short -> must loop
    lib.add_item(root, music_wav, "music", ["curious"], "CC0-1.0", "https://x/music")
    blip = tmp_path / "blip.wav"
    t = np.arange(int(0.2 * 48000)) / 48000
    sf.write(str(blip), 0.5 * np.sin(2 * np.pi * 1000 * t), 48000)
    for tag in ("whoosh", "pop"):
        lib.add_item(root, blip, "sfx", [tag], "CC0-1.0", "https://x/" + tag)
    run = tmp_path / "run"
    (run / "02-voice").mkdir(parents=True)
    (run / "03-design").mkdir(parents=True)
    scenes = []
    for i in (1, 2, 3):
        _voice_scene(run / "02-voice" / f"scene-{i:02d}.wav")
        scenes.append({"id": i, "file": f"scene-{i:02d}.wav", "duration_s": 4.0})
    (run / "02-voice" / "manifest.json").write_text(json.dumps(
        {"language": "en", "engine": "kokoro", "voice": "v", "speed": 1.0,
         "sample_rate": SR_V, "scenes": scenes, "total_s": 12.0}))
    sound = {"music_mood": "curious", "sfx": [{"scene": 1, "at_s": 1.7, "type": "whoosh"},
                                              {"scene": 3, "at_s": 1.7, "type": "pop"}]}
    (run / "03-design" / "sound.json").write_text(json.dumps(sound))
    return run, root


def test_ducking_meets_12db_gap(env):
    run, root = env
    build_mix(run, root)
    assert check_mix(run)["gap_db"] >= 12


def test_mix_loudness_is_minus_14(env):
    run, root = env
    res = build_mix(run, root)
    assert res.mix.exists()
    info = check_mix(run)
    assert abs(info["lufs"] - (-14)) <= 1
    data, sr = sf.read(str(res.mix), always_2d=True)
    assert sr == 48000 and data.shape[1] == 2


def test_short_music_is_looped_to_video_length(env):
    run, root = env
    res = build_mix(run, root)
    music, sr = sf.read(str(res.stems["music"]))
    voice, _ = sf.read(str(res.stems["voice"]))
    assert sr == 48000 and len(music) >= len(voice)
    assert abs(len(music) / sr - 13.0) < 0.1
    assert np.sqrt(np.mean(music[-int(0.05 * sr) - 48000 * 4:-48000 * 3] ** 2)) > 0  # looped, not silent


def test_silent_voice_raises_clear_error(env):
    run, root = env
    for i in (1, 2, 3):
        _voice_scene(run / "02-voice" / f"scene-{i:02d}.wav", silent=True)
    with pytest.raises(MixCheckError, match="no speech"):
        build_mix(run, root)
    with pytest.raises(MixCheckError, match="no speech"):
        mixmod.voice_music_gap_db(np.zeros(48000), np.ones(48000) * 0.1, 48000)


def test_too_many_sfx_reported(env):
    run, root = env
    build_mix(run, root)
    sound = json.loads((run / "03-design" / "sound.json").read_text())
    sound["sfx"] = [{"scene": 1 + (i % 3), "at_s": 1.7, "type": "pop"} for i in range(4)]
    (run / "03-design" / "sound.json").write_text(json.dumps(sound))
    build_mix(run, root)
    info = check_mix(run)
    assert info["sfx_count"] == 4 and info["scenes"] == 3
    assert any("sound effect" in p for p in info["problems"])


def test_credits_written(env):
    run, root = env
    build_mix(run, root)
    text = (run / "04-video" / "credits.md").read_text()
    assert "music/" in text and "sfx/" in text
    assert (root / "usage.json").exists()


def test_speech_mask_basic():
    sr = 48000
    x = np.zeros(sr)
    x[sr // 2:] = 0.3
    m = speech_mask(x, sr)
    assert m.dtype == bool and not m[0] and m[-1] and len(m) == len(x)
