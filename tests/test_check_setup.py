import numpy as np
import soundfile as sf

from tools import check_setup as cs
from tools.audio import library as lib


def test_python_312_ok():
    c = cs.check_python((3, 12, 4))
    assert c.ok is True


def test_python_311_warns():
    assert cs.check_python((3, 11, 9)).ok is None


def test_python_313_fails_with_fix():
    c = cs.check_python((3, 13, 1))
    assert c.ok is False and "3.12" in c.fix


def test_python_old_fails():
    assert cs.check_python((3, 10, 0)).ok is False


def test_av_version():
    assert cs.check_av_version("15.1.0").ok is True
    c = cs.check_av_version("16.0.1")
    assert c.ok is False and "av<16" in c.fix
    assert cs.check_av_version(None).ok is None


def test_node_version():
    assert cs.check_node("v22.1.0").ok is True
    assert cs.check_node("v18.0.0").ok is False
    assert cs.check_node(None).ok is False


def _add(root, tmp_path, mood, n):
    for i in range(n):
        f = tmp_path / f"{mood}{i}.wav"
        sf.write(str(f), 0.1 * np.random.default_rng(i).standard_normal(44100), 44100)
        lib.add_item(root, f, "music", [mood], "CC0-1.0", f"https://x/{mood}{i}")


def test_music_none_fails(tmp_path):
    c = cs.check_music(tmp_path / "lib")
    assert c.ok is False and "DOWNLOAD-LIST.md" in c.detail


def test_music_one_per_mood_warns(tmp_path):
    root = tmp_path / "lib"
    _add(root, tmp_path, "curious", 1)
    c = cs.check_music(root)
    assert c.ok is None and "calm" in c.detail


def test_music_enough_ok(tmp_path):
    root = tmp_path / "lib"
    for m in lib.MUSIC_MOODS:
        _add(root, tmp_path, m, 2)
    assert cs.check_music(root).ok is True


def test_library_validate_reports_problem(tmp_path):
    root = tmp_path / "lib"
    _add(root, tmp_path, "calm", 1)
    (root / lib.load_items(root)[0]["path"]).unlink()
    assert cs.check_library(root).ok is False


def test_plugins_found_and_missing(tmp_path):
    (tmp_path / "cache" / "x-remotion-y").mkdir(parents=True)
    assert cs.check_plugin("remotion", tmp_path).ok is True
    assert cs.check_plugin("watch-video", tmp_path).ok is None


def test_main_exit_code(monkeypatch, capsys):
    monkeypatch.setattr(cs, "run_checks", lambda: [cs.Check("a", True, "fine"),
                                                   cs.Check("b", None, "meh", "do x")])
    assert cs.main() == 0
    monkeypatch.setattr(cs, "run_checks", lambda: [cs.Check("a", False, "bad", "fix it")])
    assert cs.main() == 1
    assert "fix it" in capsys.readouterr().out
