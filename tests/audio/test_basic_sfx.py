import soundfile as sf

from tools.audio import basic_sfx, library as lib


def test_generate_basic_sfx(tmp_path):
    root = tmp_path / "audio"
    root.mkdir()
    items = basic_sfx.generate_basic_sfx(root)
    assert len(items) == 6
    assert {i["tags"][0] for i in items} == set(lib.SFX_TYPES)
    for i in items:
        assert i["licence"] in lib.ALLOWED_LICENCES
        assert i["duration_s"] <= 1.2
        data, sr = sf.read(str(root / i["path"]))
        assert sr == 48000 and data.ndim == 1 and abs(data).max() <= 10 ** (-1 / 20) + 1e-3
    assert lib.validate(root) == []
    assert basic_sfx.generate_basic_sfx(root) == []
    assert len(lib.load_items(root)) == 6


def test_regenerates_missing_wav(tmp_path):
    root = tmp_path / "audio"
    root.mkdir()
    items = basic_sfx.generate_basic_sfx(root)
    victim = root / items[0]["path"]
    victim.unlink()
    assert basic_sfx.generate_basic_sfx(root) == []
    assert victim.exists()
    assert len(lib.load_items(root)) == 6
    assert lib.validate(root) == []
