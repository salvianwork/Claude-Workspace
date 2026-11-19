import shutil
import subprocess

import pytest

from tools.review.transcript import compare, normalize_words


def test_numbers_match_spoken_form():
    assert compare("Lava is 1,000 °C.", "lava is one thousand degrees celsius") == []


def test_decimal_and_percent():
    assert normalize_words("3.5%") == ["three", "point", "five", "percent"]


def test_reports_missing_words():
    problems = compare("Molten rock flows down", "flows down")
    assert problems == ['missing: "molten rock"']


def test_reports_extra_words():
    assert compare("flows down", "flows quickly down") == ['extra: "quickly"']


def test_reports_wrong_word():
    problems = compare("the lava flows", "the larva flows")
    assert problems == ['wrong: "lava" heard as "larva"']


def test_punctuation_and_case_ignored():
    assert compare("Hello, THERE!", "hello there") == []


@pytest.mark.slow
def test_extract_keyframes(tmp_path):
    from tools.review.keyframes import extract_keyframes

    video = tmp_path / "t.mp4"
    subprocess.run(
        [shutil.which("ffmpeg"), "-y", "-f", "lavfi", "-i",
         "testsrc=duration=4:size=320x240:rate=10", "-pix_fmt", "yuv420p", str(video)],
        check=True, capture_output=True)
    frames = extract_keyframes(video, tmp_path / "frames", every_s=2.0)
    assert len(frames) == 2
    assert all(f.exists() for f in frames)


@pytest.mark.slow
def test_transcribe_kokoro_output(tmp_path):
    import soundfile as sf

    from tools.review.transcript import transcribe
    from tools.voice.engine import KokoroEngine

    engine = KokoroEngine()
    audio = engine.synth("Hello there.", "af_heart", 1.0)
    wav = tmp_path / "a.wav"
    sf.write(wav, audio, 24000)
    assert compare("Hello there.", transcribe(wav, model="small.en")) == []


# ---- Whisper model caching and reuse of voice transcripts ---------------------------

import json  # noqa: E402
import sys  # noqa: E402
import types  # noqa: E402
from pathlib import Path  # noqa: E402

from tools.review import transcript as tr  # noqa: E402

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "script_ok.md"


@pytest.fixture
def fake_whisper(monkeypatch):
    built = []

    class Seg:
        def __init__(self, text):
            self.text = text

    class FakeModel:
        def __init__(self, name, **kw):
            built.append(name)

        def transcribe(self, path, language="en"):
            return [Seg(" hello "), Seg("there ")], None

    monkeypatch.setitem(sys.modules, "faster_whisper", types.SimpleNamespace(WhisperModel=FakeModel))
    tr._whisper.cache_clear()
    yield built
    tr._whisper.cache_clear()


def test_whisper_model_is_built_once_per_name(fake_whisper, tmp_path):
    for _ in range(3):
        assert tr.transcribe(tmp_path / "a.wav") == "hello there"
    assert fake_whisper == ["small.en"]
    tr.transcribe(tmp_path / "a.wav", model="base.en")
    assert fake_whisper == ["small.en", "base.en"]


def _run(tmp_path):
    from tools.pipeline.script import parse_script

    run = tmp_path / "run"
    (run / "01-script").mkdir(parents=True)
    (run / "02-voice").mkdir()
    (run / "01-script" / "script.md").write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")
    scenes = parse_script(run / "01-script" / "script.md").scenes
    for s in scenes:
        (run / "02-voice" / f"scene-{s.id:02d}.wav").write_bytes(b"x" * s.id)
    (run / "02-voice" / "manifest.json").write_text(json.dumps(
        {"scenes": [{"id": s.id, "file": f"scene-{s.id:02d}.wav"} for s in scenes]}))
    return run, scenes


def test_final_reuses_voice_transcripts(tmp_path, monkeypatch):
    run, scenes = _run(tmp_path)
    narration = {f"scene-{s.id:02d}.wav": s.narration for s in scenes}
    calls = []

    def fake(path, model="small.en"):
        calls.append(Path(path).name)
        if Path(path).name == "video.mp4":
            return " ".join(narration.values())
        return narration[Path(path).name]

    monkeypatch.setattr(tr, "transcribe", fake)
    assert tr._voice(run)["ok"] is True
    assert (run / "review" / "voice-transcripts.json").exists()
    calls.clear()
    res = tr._final(run)
    assert res["ok"] is True and calls == ["video.mp4"]

    # a re-recorded scene is transcribed again, the others still come from the cache
    (run / "02-voice" / "scene-02.wav").write_bytes(b"changed!")
    calls.clear()
    tr._final(run)
    assert calls == ["video.mp4", "scene-02.wav"]


def test_final_without_cache_transcribes_every_scene(tmp_path, monkeypatch):
    run, scenes = _run(tmp_path)
    calls = []
    monkeypatch.setattr(tr, "transcribe", lambda p, model="small.en": calls.append(Path(p).name) or "")
    tr._final(run)
    assert calls == ["video.mp4"] + [f"scene-{s.id:02d}.wav" for s in scenes]
