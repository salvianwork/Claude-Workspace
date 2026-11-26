from pathlib import Path

import pytest

from tools.pipeline.checks import check_story
from tools.pipeline.script import (
    Scene, Script, ScriptFormatError, estimate_seconds, parse_script, word_count,
)

FIXTURE = Path(__file__).parent.parent / "fixtures" / "script_ok.md"


def make_script(words: int, claims=("[S1] x",), ids=(1,)) -> Script:
    scenes = [Scene(i, f"T{i}", " ".join(["word"] * words), "u", "v") for i in ids]
    return Script("Title", scenes, list(claims))


def test_parse_fixture():
    s = parse_script(FIXTURE)
    assert len(s.scenes) == 3
    assert s.scenes[1].title == "The Idea"
    assert s.claims[0].startswith("[S1]")
    assert len(s.claims) == 2
    assert 150 <= word_count(s) <= 450
    assert check_story(s) == []


def test_missing_narration_names_scene(tmp_path):
    p = tmp_path / "s.md"
    p.write_text(
        "# T\n\n## Scene 1: A\n**Narration:** hi\n**Viewer should understand:** u\n**Visual idea:** v\n\n"
        "## Scene 2: B\n**Viewer should understand:** u\n**Visual idea:** v\n\n## Key claims\n- [S1] c\n",
        encoding="utf-8",
    )
    with pytest.raises(ScriptFormatError, match="Scene 2.*Narration"):
        parse_script(p)


def test_word_count_limits():
    assert any("150–450" in p for p in check_story(make_script(120)))
    assert check_story(make_script(300)) == []


def test_estimate_seconds():
    assert estimate_seconds(make_script(300)) == 120.0


def test_other_problems():
    assert any("claim" in p.lower() for p in check_story(make_script(300, claims=())))
    assert any("order" in p.lower() or "1..n" in p for p in check_story(make_script(150, ids=(1, 3))))
    s = make_script(300)
    s.scenes[0].narration = " "
    assert any("empty" in p.lower() for p in check_story(s))
    assert word_count(Script("T", [Scene(1, "a", "hi - ... there", "u", "v")], [])) == 2


def test_vertical_short_word_limits():
    """A vertical short is 30-180 s (75-450 words at 150 wpm); landscape stays 150-450 words."""
    assert check_story(make_script(110), format="vertical") == []
    assert check_story(make_script(75), format="vertical") == []
    assert any("75–450" in p for p in check_story(make_script(70), format="vertical"))
    assert any("75–450" in p for p in check_story(make_script(460), format="vertical"))
    assert any("150–450" in p for p in check_story(make_script(110)))
    assert any("150–450" in p for p in check_story(make_script(110), format="landscape"))


def test_checks_cli_takes_format(tmp_path, capsys):
    from tools.pipeline.checks import main
    p = tmp_path / "s.md"
    p.write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")
    assert main(["story", str(p), "--format", "vertical"]) == 0
    assert '"problems": []' in capsys.readouterr().out
