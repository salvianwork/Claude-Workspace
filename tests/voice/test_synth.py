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
    assert manifest["language"] == "en" and manifest["voice"] == "af_heart"


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


def test_unknown_language_raises():
    with pytest.raises(ValueError, match="No voice engine for language"):
        get_engine("kokoro", "id")


@pytest.mark.slow
def test_kokoro_real_voice():
    engine = get_engine("kokoro", "en")
    audio = engine.synth("Hello there.", "af_heart", 1.0)
    assert 0.5 <= len(audio) / engine.sample_rate <= 3
