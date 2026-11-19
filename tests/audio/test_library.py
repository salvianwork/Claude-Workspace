import json
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from tools.audio import library as lib
from tools.audio.library import LibraryError


def make_wav(path: Path, seconds: float = 2.0, sr: int = 48000, freq: float = 440.0) -> Path:
    t = np.arange(int(seconds * sr)) / sr
    sf.write(str(path), 0.3 * np.sin(2 * np.pi * freq * t), sr)
    return path


@pytest.fixture
def root(tmp_path):
    r = tmp_path / "audio"
    r.mkdir()
    return r


def add(root, tmp_path, name, kind="music", tag="calm", seconds=2.0, licence="CC0-1.0"):
    f = make_wav(tmp_path / name, seconds)
    return lib.add_item(root, f, kind, [tag], licence, "https://example.org/" + name)


def test_add_rejects_cc_by(root, tmp_path):
    f = make_wav(tmp_path / "a.wav")
    with pytest.raises(ValueError):
        lib.add_item(root, f, "music", ["calm"], "CC-BY-4.0", "https://x")
    assert lib.load_items(root) == []


def test_add_rejects_bad_kind_and_tags(root, tmp_path):
    f = make_wav(tmp_path / "a.wav")
    with pytest.raises(ValueError):
        lib.add_item(root, f, "voice", ["calm"], "CC0-1.0", "u")
    with pytest.raises(ValueError):
        lib.add_item(root, f, "music", ["whoosh"], "CC0-1.0", "u")
    with pytest.raises(ValueError):
        lib.add_item(root, f, "sfx", ["calm"], "CC0-1.0", "u")


def test_add_copies_and_measures(root, tmp_path):
    item = add(root, tmp_path, "a.wav")
    assert (root / item["path"]).exists()
    assert item["path"].startswith("music/")
    assert item["id"] == "music-a"
    assert abs(item["duration_s"] - 2.0) < 0.01
    assert isinstance(item["lufs"], float)
    assert json.loads((root / "library.json").read_text())["items"][0]["id"] == "music-a"


def test_ids_made_unique(root, tmp_path):
    a = add(root, tmp_path, "a.wav")
    sub = tmp_path / "sub"
    sub.mkdir()
    b = add(root, sub, "a.wav")
    assert a["id"] != b["id"]


def test_short_clip_lufs_null(root, tmp_path):
    item = add(root, tmp_path, "s.wav", kind="sfx", tag="click", seconds=0.2)
    assert item["lufs"] is None


def test_pick_music_least_recently_used(root, tmp_path):
    a = add(root, tmp_path, "a.wav")
    b = add(root, tmp_path, "b.wav")
    lib.mark_used(root, [a["id"]])
    picked, warnings = lib.pick_music(root, "calm", 1.0)
    assert picked["id"] == b["id"]
    assert warnings == []


def test_pick_music_never_used_is_oldest_tie_by_id(root, tmp_path):
    add(root, tmp_path, "b.wav")
    add(root, tmp_path, "a.wav")
    assert lib.pick_music(root, "calm", 0)[0]["id"] == "music-a"


def test_pick_music_prefers_long_enough(root, tmp_path):
    short = add(root, tmp_path, "short.wav", seconds=1.0)
    long_ = add(root, tmp_path, "long.wav", seconds=5.0)
    lib.mark_used(root, [long_["id"]])
    picked, _ = lib.pick_music(root, "calm", 4.0)
    assert picked["id"] == long_["id"]
    # none long enough -> still returns something
    picked, _ = lib.pick_music(root, "calm", 60.0)
    assert picked["id"] == short["id"]


def test_missing_mood_falls_back_with_warning(root, tmp_path):
    add(root, tmp_path, "p.wav", tag="playful")
    picked, warnings = lib.pick_music(root, "curious", 1.0)  # neighbour: playful
    assert picked["id"] == "music-p"
    assert len(warnings) == 1 and "curious" in warnings[0] and "playful" in warnings[0]


def test_missing_mood_and_neighbour_uses_any(root, tmp_path):
    add(root, tmp_path, "d.wav", tag="dramatic")
    picked, warnings = lib.pick_music(root, "curious", 1.0)
    assert picked["id"] == "music-d"
    assert "curious" in warnings[0] and "dramatic" in warnings[0]


def test_empty_library_raises(root):
    with pytest.raises(LibraryError):
        lib.pick_music(root, "calm", 10)


def test_pick_sfx_lru(root, tmp_path):
    a = add(root, tmp_path, "w1.wav", kind="sfx", tag="whoosh", seconds=0.5)
    b = add(root, tmp_path, "w2.wav", kind="sfx", tag="whoosh", seconds=0.5)
    lib.mark_used(root, [a["id"]])
    assert lib.pick_sfx(root, "whoosh")["id"] == b["id"]
    with pytest.raises(LibraryError):
        lib.pick_sfx(root, "ding")


def test_credits_lists_every_file(root, tmp_path):
    a = add(root, tmp_path, "a.wav")
    b = add(root, tmp_path, "w.wav", kind="sfx", tag="pop", licence="Pixabay-Content-License")
    out = tmp_path / "credits.md"
    lib.write_credits([a, b], out)
    text = out.read_text()
    for it in (a, b):
        assert it["path"] in text and it["licence"] in text and it["source_url"] in text


def test_validate(root, tmp_path):
    a = add(root, tmp_path, "a.wav")
    assert lib.validate(root) == []
    (root / a["path"]).unlink()
    assert any("missing" in p for p in lib.validate(root))


def test_cli_validate(root, tmp_path, capsys):
    assert lib.main(["--root", str(root), "validate"]) == 0
    out = capsys.readouterr().out
    assert "OK" in out and "no music yet" in out
    add(root, tmp_path, "a.wav")
    (root / "music" / "a.wav").unlink()
    assert lib.main(["--root", str(root), "validate"]) == 1
