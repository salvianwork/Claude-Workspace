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


# ---- loudness limiter, sfx level, ducking gaps, fades -------------------------------

PEAK_CAP = 10 ** (-1 / 20) + 1e-5  # -1 dBFS plus 24-bit rounding


def _speechlike(seconds, sr, seed):
    """Amplitude-modulated noise 'syllables' with sharp plosive-like transients.

    Real Kokoro narration has a peak-to-loudness ratio of about 19 dB; this has ~18 dB.
    """
    rng = np.random.default_rng(seed)
    n = int(seconds * sr)
    t = np.arange(n) / sr
    x = np.zeros(n)
    pos = 0.2
    while pos < seconds - 0.5:
        dur = rng.uniform(0.12, 0.3)
        m = (t >= pos) & (t < pos + dur)
        env = np.sin(np.pi * (t[m] - pos) / dur) ** 2
        x[m] = 0.05 * rng.uniform(0.5, 1.0) * env * rng.standard_normal(m.sum())
        if rng.random() < 0.3:  # a plosive: a 3 ms burst far above the syllable level
            k = int(pos * sr)
            x[k:k + int(0.003 * sr)] += 0.3 * rng.choice([-1, 1]) * np.hanning(int(0.003 * sr))
        pos += dur + (rng.uniform(0.4, 0.7) if rng.random() < 0.15 else rng.uniform(0.03, 0.12))
    return x


def _plr_db(x, sr):
    import pyloudnorm as pyln

    lufs = pyln.Meter(sr).integrated_loudness(np.stack([x, x], axis=1))
    return 20 * np.log10(np.max(np.abs(x))) - lufs


def test_speechlike_fixture_has_high_crest():
    x = np.concatenate([_speechlike(4.0, SR_V, i) for i in (1, 2, 3)])
    assert 16 <= _plr_db(x, SR_V) <= 22


def test_high_crest_voice_reaches_minus_14_with_peaks_under_minus_1(env):
    run, root = env
    for i in (1, 2, 3):
        sf.write(str(run / "02-voice" / f"scene-{i:02d}.wav"), _speechlike(4.0, SR_V, i), SR_V)
    # no effects: their own loudness would hide the voice's crest problem
    (run / "03-design" / "sound.json").write_text(json.dumps({"music_mood": "curious", "sfx": []}))
    res = build_mix(run, root)
    info = check_mix(run)
    assert abs(info["lufs"] - (-14)) <= 1, info
    mix, _ = sf.read(str(res.mix))
    assert np.max(np.abs(mix)) <= PEAK_CAP
    assert info["gap_db"] >= 12 and info["problems"] == []
    assert not any("LUFS" in w for w in res.warnings)


def test_stems_add_up_to_the_mix(env):
    run, root = env
    res = build_mix(run, root)
    parts = sum(sf.read(str(p))[0] for p in res.stems.values())
    mix, _ = sf.read(str(res.mix), always_2d=True)
    assert np.max(np.abs(parts - mix[:, 0])) < 1e-4


def test_limiter_keeps_every_sample_under_the_ceiling():
    rng = np.random.default_rng(3)
    x = 0.1 * rng.standard_normal(48000)
    x[rng.integers(0, 48000, 40)] = rng.choice([-1, 1], 40) * rng.uniform(0.5, 3.0, 40)
    y = x * mixmod.limiter_gain(x, 48000, -1.0)
    assert np.max(np.abs(y)) <= 10 ** (-1 / 20) + 1e-12
    quiet = mixmod.limiter_gain(0.1 * np.ones(1000), 48000, -1.0)
    assert np.all(quiet == 1.0)


def test_sfx_never_louder_than_the_voice(env):
    run, root = env
    res = build_mix(run, root)
    voice, sr = sf.read(str(res.stems["voice"]))
    sfx, _ = sf.read(str(res.stems["sfx"]))
    v_rms = np.sqrt(np.mean(voice[speech_mask(voice, sr)] ** 2))
    assert np.max(np.abs(sfx)) > 0
    assert mixmod._max_window_rms(sfx, sr, 0.1) <= v_rms


def test_close_gaps_fills_short_pauses_only():
    sr = 1000
    m = np.zeros(3000, dtype=bool)
    m[100:500] = True      # speech
    m[700:1000] = True     # after a 200 ms pause -> filled
    m[1500:2000] = True    # after a 500 ms pause -> kept
    c = mixmod.close_gaps(m, sr, 0.3)
    assert c[500:700].all()
    assert not c[1000:1500].any()
    assert not c[:100].any() and not c[2000:].any()  # leading/trailing silence untouched
    assert not m[500:700].any()  # input not modified


def test_warns_when_music_too_close_or_loudness_off(env, monkeypatch):
    run, root = env
    assert not [w for w in build_mix(run, root).warnings if "dB" in w or "LUFS" in w]
    monkeypatch.setattr(mixmod, "MUSIC_BELOW_VOICE_DB", -6.0)
    monkeypatch.setattr(mixmod, "DUCK_DB", 0.0)
    assert any("dB below the voice" in w for w in build_mix(run, root).warnings)
    monkeypatch.undo()
    monkeypatch.setattr(mixmod, "TARGET_LUFS", -20.0)
    assert any("LUFS" in w for w in build_mix(run, root).warnings)


def test_music_fade_out_ends_with_the_voice(env):
    run, root = env
    res = build_mix(run, root)
    music, sr = sf.read(str(res.stems["music"]))
    voice_end = 12 * sr  # three 4 s scenes
    assert np.all(music[voice_end:] == 0)
    rms = lambda a, b: np.sqrt(np.mean(music[a:b] ** 2))  # noqa: E731
    near_end = rms(voice_end - int(0.1 * sr), voice_end)
    before_fade = rms(voice_end - int(3.5 * sr), voice_end - int(3.0 * sr))
    assert near_end < before_fade * 0.1


def test_upsample2_is_clean_for_high_frequencies():
    sr = 24000
    t = np.arange(sr) / sr
    x = np.sin(2 * np.pi * 7000 * t)
    y = mixmod._upsample2(x)
    t2 = np.arange(2 * sr) / (2 * sr)
    ideal = np.sin(2 * np.pi * 7000 * t2)
    mid = slice(2000, -2000)
    assert len(y) == 2 * len(x)
    assert np.max(np.abs(y[mid] - ideal[mid])) < 1e-3
    linear = mixmod._resample(x, sr, 2 * sr)
    assert np.max(np.abs(linear[mid] - ideal[mid])) > 0.1  # what the old path did


@pytest.mark.slow
def test_real_kokoro_voice_mix_meets_targets(env):
    from tools.voice.engine import KokoroEngine

    run, root = env
    engine = KokoroEngine()
    lines = ["Have you ever wondered why volcanoes erupt? Deep under your feet, the Earth is hot.",
             "Gas builds up inside, like the fizz in a shaken bottle. Then, boom!",
             "Some volcanoes ooze gently. Others explode."]
    for i, text in enumerate(lines, 1):
        audio = engine.synth(text, "am_michael", 1.0)
        sf.write(str(run / "02-voice" / f"scene-{i:02d}.wav"),
                 np.concatenate([audio, np.zeros(int(0.4 * engine.sample_rate))]), engine.sample_rate)
    res = build_mix(run, root)
    info = check_mix(run)
    assert info["problems"] == [], info
    assert abs(info["lufs"] - (-14)) <= 1 and info["gap_db"] >= 14
    mix, _ = sf.read(str(res.mix))
    assert np.max(np.abs(mix)) <= PEAK_CAP
