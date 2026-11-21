import json

import pytest
import soundfile as sf

from tools.voice.synth import synth_scenes
from tools.voice.words import align_to_script
import numpy as np
from tests.voice.test_synth import FakeEngine, SCRIPT


def _script(tmp_path, text):
    p = tmp_path / "01-script" / "script.md"
    p.parent.mkdir(exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


def _one_scene(narration):
    return (f"# T\n\n## Scene 1: One\n**Narration:** {narration}\n"
            "**Viewer should understand:** a\n**Visual idea:** b\n\n## Key claims\n- [S1] x\n")


def test_words_json_shape(tmp_path):
    out = tmp_path / "02-voice"
    synth_scenes(_script(tmp_path, SCRIPT), out, FakeEngine())
    data = json.loads((out / "words.json").read_text())
    assert data["source"] in ("kokoro", "engine", "whisper")
    assert [s["id"] for s in data["scenes"]] == [1, 2, 3]
    w = data["scenes"][0]["words"]
    assert [x["i"] for x in w] == list(range(12))
    assert w[0]["text"] == "one"
    assert all(x["start"] < x["end"] for x in w)
    assert all(a["end"] <= b["start"] + 1e-6 for a, b in zip(w, w[1:]))


def test_repeated_word_indices():
    timed = [{"text": t, "start": i * .3, "end": i * .3 + .25}
             for i, t in enumerate(["magma", "rises", ",", "magma", "bursts"])]
    w = align_to_script("magma rises, magma bursts", timed)
    magma = [x for x in w if x["text"] == "magma"]
    assert [x["i"] for x in magma] == [0, 2]
    assert magma[0]["start"] < magma[1]["start"]


def test_numbers_keep_script_text():
    timed = [{"text": t, "start": i * .3, "end": i * .3 + .25}
             for i, t in enumerate(["Lava", "is", "one", "thousand", "degrees", "Celsius", "."])]
    w = align_to_script("Lava is 1,000 °C.", timed)
    assert [x["text"] for x in w] == ["Lava", "is", "1,000", "°C"]
    assert w[2]["start"] == pytest.approx(.6) and w[2]["end"] == pytest.approx(1.15)
    assert w[3]["end"] == pytest.approx(1.75)


def test_unmatched_tokens_interpolated():
    timed = [{"text": "alpha", "start": 0.0, "end": 0.5},
             {"text": "gamma", "start": 1.5, "end": 2.0}]
    w = align_to_script("alpha beta gamma", timed)
    assert 0.5 <= w[1]["start"] < w[1]["end"] <= 1.5


def test_only_rerecord_keeps_other_scene_words(tmp_path):
    script, out = _script(tmp_path, SCRIPT), tmp_path / "02-voice"
    synth_scenes(script, out, FakeEngine())
    before = json.loads((out / "words.json").read_text())
    synth_scenes(script, out, FakeEngine(), only=[2])
    after = json.loads((out / "words.json").read_text())
    assert after["scenes"][0] == before["scenes"][0]
    assert after["scenes"][2] == before["scenes"][2]
    assert len(after["scenes"]) == 3


@pytest.mark.slow
def test_kokoro_word_times_real(tmp_path):
    from tools.voice.engine import get_engine
    script = _script(tmp_path, _one_scene(
        "Deep under the ground, magma rises at 1,000 °C. Then magma bursts out of the crater."))
    out = tmp_path / "02-voice"
    synth_scenes(script, out, get_engine("kokoro", "en", "am_adam"), "am_adam")
    data = json.loads((out / "words.json").read_text())
    assert data["source"] == "kokoro"
    w = data["scenes"][0]["words"]
    info = sf.info(str(out / "scene-01.wav"))
    assert "1,000" in [x["text"] for x in w]
    assert all(x["start"] < x["end"] for x in w)
    assert all(a["start"] <= b["start"] for a, b in zip(w, w[1:]))
    assert w[-1]["end"] <= info.frames / info.samplerate + 0.05


class KokoroNamed(FakeEngine):
    name = "kokoro"


class NoTimings(FakeEngine):
    name = "plain"
    synth_words = None

    def __getattribute__(self, a):
        if a == "synth_words":
            raise AttributeError(a)
        return super().__getattribute__(a)


def test_mixed_sources_and_kept_scene_source(tmp_path, monkeypatch):
    import tools.voice.synth as sy
    script, out = _script(tmp_path, SCRIPT), tmp_path / "02-voice"
    synth_scenes(script, out, KokoroNamed())
    assert json.loads((out / "words.json").read_text())["source"] == "kokoro"
    monkeypatch.setattr(sy, "whisper_available", lambda: True)
    monkeypatch.setattr(sy, "whisper_words", lambda wav: [
        {"text": w, "start": i * .2, "end": i * .2 + .1}
        for i, w in enumerate("alpha beta gamma delta epsilon zeta eta theta iota kappa".split())])
    synth_scenes(script, out, NoTimings(), only=[2])
    d = json.loads((out / "words.json").read_text())
    assert d["source"] == "mixed"
    assert [s["source"] for s in d["scenes"]] == ["kokoro", "whisper", "kokoro"]


def test_full_run_drops_stale_scenes(tmp_path):
    out = tmp_path / "02-voice"
    synth_scenes(_script(tmp_path, SCRIPT), out, FakeEngine())
    synth_scenes(_script(tmp_path, _one_scene("only one now.")), out, FakeEngine())
    assert [s["id"] for s in json.loads((out / "words.json").read_text())["scenes"]] == [1]


def test_no_timings_without_whisper_raises(tmp_path, monkeypatch):
    import sys
    monkeypatch.setitem(sys.modules, "faster_whisper", None)
    with pytest.raises(RuntimeError, match="faster-whisper is not installed"):
        synth_scenes(_script(tmp_path, SCRIPT), tmp_path / "v", NoTimings())


def test_empty_timed_raises():
    with pytest.raises(ValueError, match="no word timings"):
        align_to_script("hello there", [])
