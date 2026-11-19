import json
import os
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from tools.voice.engine import get_engine
from tools.voice.synth import synth_scenes

SCRIPT = """# Title

## Scene 1: One
**Narration:** one two three four five six seven eight nine ten eleven twelve.
**Viewer should understand:** a
**Visual idea:** b

## Scene 2: Two
**Narration:** alpha beta gamma delta epsilon zeta eta theta iota kappa.
**Viewer should understand:** a
**Visual idea:** b

## Scene 3: Three
**Narration:** short line here.
**Viewer should understand:** a
**Visual idea:** b

## Key claims
- [S1] x
"""


class FakeEngine:
    name = "fake"
    sample_rate = 24000

    def synth(self, text, voice, speed):
        seconds = max(1, len(text.split()) // 10)
        t = np.arange(int(self.sample_rate * seconds)) / self.sample_rate
        return (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)


@pytest.fixture
def paths(tmp_path):
    script = tmp_path / "01-script" / "script.md"
    script.parent.mkdir()
    script.write_text(SCRIPT, encoding="utf-8")
    return script, tmp_path / "02-voice"


def test_writes_one_wav_per_scene_and_manifest(paths):
    script, out = paths
    manifest = synth_scenes(script, out, FakeEngine())
    assert len(list(out.glob("scene-*.wav"))) == 3
    assert manifest["scenes"][0]["file"] == "scene-01.wav"
    assert manifest["scenes"][0]["duration_s"] == pytest.approx(1.4)  # 1 s + 0.4 s pad
    assert manifest["total_s"] == pytest.approx(sum(s["duration_s"] for s in manifest["scenes"]), abs=0.01)
    assert json.loads((out / "manifest.json").read_text()) == manifest
    assert manifest["sample_rate"] == 24000 and manifest["engine"] == "fake"
    assert manifest["language"] == "en" and manifest["voice"] == "am_michael"  # male default (presenter is male)


def test_only_rerecords_selected_scenes(paths):
    script, out = paths
    synth_scenes(script, out, FakeEngine())
    for f in out.glob("scene-*.wav"):
        os.utime(f, (1000, 1000))
    manifest = synth_scenes(script, out, FakeEngine(), only=[2])
    assert (out / "scene-01.wav").stat().st_mtime == 1000
    assert (out / "scene-02.wav").stat().st_mtime != 1000
    assert len(manifest["scenes"]) == 3
    assert manifest["scenes"][0]["duration_s"] == pytest.approx(1.4)


def test_only_without_existing_output_raises(paths):
    script, out = paths
    with pytest.raises(ValueError):
        synth_scenes(script, out, FakeEngine(), only=[1])


def test_cli_script_option_uses_given_file(paths, monkeypatch):
    import tools.voice.synth as synth_mod

    script, out = paths
    run_dir = script.parent.parent
    copy = out / "script-voice.md"
    out.mkdir()
    two_scenes = SCRIPT.split("## Scene 3")[0] + "## Key claims\n- [S1] x\n"
    copy.write_text(two_scenes, encoding="utf-8")
    monkeypatch.setattr(synth_mod, "get_engine", lambda name, language, voice=None: FakeEngine())
    assert synth_mod.main([str(run_dir), "--script", str(copy)]) == 0
    manifest = json.loads((out / "manifest.json").read_text())
    assert [s["id"] for s in manifest["scenes"]] == [1, 2]
    assert manifest["voice"] == "am_michael"


def test_cli_default_script_is_01_script(paths, monkeypatch):
    import tools.voice.synth as synth_mod

    script, out = paths
    monkeypatch.setattr(synth_mod, "get_engine", lambda name, language, voice=None: FakeEngine())
    assert synth_mod.main([str(script.parent.parent)]) == 0
    manifest = json.loads((out / "manifest.json").read_text())
    assert len(manifest["scenes"]) == 3


def test_unknown_language_raises():
    with pytest.raises(ValueError, match="No voice engine for language"):
        get_engine("kokoro", "id")


@pytest.mark.slow
def test_kokoro_real_voice():
    engine = get_engine("kokoro", "en")
    audio = engine.synth("Hello there.", "af_heart", 1.0)
    assert 0.5 <= len(audio) / engine.sample_rate <= 3


def test_kokoro_lang_code_british_voices():
    from tools.voice.engine import kokoro_lang_code

    for v in ("bm_george", "bm_fable", "bm_lewis", "bf_emma"):
        assert kokoro_lang_code(v) == "b"
    for v in ("am_michael", "af_heart", None, ""):
        assert kokoro_lang_code(v) == "a"


def test_cli_passes_voice_to_engine(tmp_path, monkeypatch):
    import tools.voice.synth as synth_mod

    seen = {}

    def fake_get_engine(name, language, voice=None):
        seen["voice"] = voice
        raise SystemExit(0)

    monkeypatch.setattr(synth_mod, "get_engine", fake_get_engine)
    with pytest.raises(SystemExit):
        synth_mod.main([str(tmp_path), "--voice", "bm_george"])
    assert seen["voice"] == "bm_george"


@pytest.mark.slow
def test_kokoro_british_voice():
    engine = get_engine("kokoro", "en", "bm_george")
    audio = engine.synth("Hello there.", "bm_george", 1.0)
    assert 0.5 < len(audio) / engine.sample_rate < 3
