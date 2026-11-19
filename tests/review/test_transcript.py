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
