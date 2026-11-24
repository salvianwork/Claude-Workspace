import subprocess
import sys
from pathlib import Path

import pytest

from tools.lessons import notebook
from tools.lessons.notebook import LessonError, SECTIONS, add, check, load

ROOT = Path(__file__).resolve().parents[2]
HEADINGS = ["## Everyone", "## Quill (script)", "## Echo (voice)",
            "## Iris (design)", "## Flip (animation)", "## Sage (review)"]


def run_cli(*args):
    return subprocess.run([sys.executable, "-m", "tools.lessons", *args],
                          cwd=ROOT, capture_output=True, text=True, encoding="utf-8")


def test_sections_order():
    assert list(SECTIONS) == ["everyone", "quill", "echo", "iris", "flip", "sage"]
    assert list(SECTIONS.values()) == HEADINGS


def test_missing_file_load_empty_and_add_creates(tmp_path):
    p = tmp_path / "lessons.md"
    assert load(p) == {k: [] for k in SECTIONS}
    assert add(p, "echo", "Pause after numbers.", None, "2026-11-24") == "added"
    text = p.read_text(encoding="utf-8")
    for h in HEADINGS:
        assert h in text
    assert load(p)["echo"][0].text == "Pause after numbers."


def test_add_line_format(tmp_path):
    p = tmp_path / "lessons.md"
    run = tmp_path / "2026-11-24-my-video"
    add(p, "sage", "Check captions.", run, "2026-11-24")
    assert "- Check captions. _(from 2026-11-24-my-video, 2026-11-24)_\n" in p.read_text(encoding="utf-8")
    les = load(p)["sage"][0]
    assert (les.text, les.source, les.date) == ("Check captions.", "2026-11-24-my-video", "2026-11-24")


def test_add_without_run_has_no_suffix(tmp_path):
    p = tmp_path / "lessons.md"
    add(p, "sage", "Plain.", None, "2026-11-24")
    assert "- Plain.\n" in p.read_text(encoding="utf-8")


HAND = ("Intro text the tool doesn't know\r\n\r\n## Everyone\r\n\r\n- Hand lesson\r\n\r\n"
        "## Quill (script)\r\n- Q1 _(from r1, 2026-01-01)_\r\n\r\n## Extra heading\r\nfree text\r\n\r\n"
        "## Echo (voice)\r\n## Iris (design)\r\n## Flip (animation)\r\n## Sage (review)\r\n- S1\r\n- S2\r\n")


def test_hand_edited_preserved_byte_for_byte(tmp_path):
    p = tmp_path / "lessons.md"
    p.write_bytes(HAND.encode("utf-8"))
    d = load(p)
    assert [l.text for l in d["everyone"]] == ["Hand lesson"]
    assert d["everyone"][0].source is None
    assert add(p, "quill", "Q2", None, "2026-11-24") == "added"
    new = p.read_bytes().decode("utf-8")
    assert new == HAND.replace("- Q1 _(from r1, 2026-01-01)_\r\n", "- Q1 _(from r1, 2026-01-01)_\r\n- Q2\r\n")


def test_add_to_empty_section_lands_in_it(tmp_path):
    p = tmp_path / "lessons.md"
    p.write_bytes(HAND.encode("utf-8"))
    add(p, "echo", "E1", None, "2026-11-24")
    assert [l.text for l in load(p)["echo"]] == ["E1"]
    assert load(p)["iris"] == []


def test_duplicate_ignoring_case_and_spacing(tmp_path):
    p = tmp_path / "lessons.md"
    add(p, "sage", "Check  the captions", None, "2026-11-24")
    before = p.read_bytes()
    assert add(p, "sage", "  check the CAPTIONS ", None, "2026-11-25") == "already there"
    assert p.read_bytes() == before


def test_replace(tmp_path):
    p = tmp_path / "lessons.md"
    p.write_bytes(HAND.encode("utf-8"))
    assert add(p, "sage", "S-new", None, "2026-11-24", replace="sage#2") == "replaced"
    assert [l.text for l in load(p)["sage"]] == ["S1", "S-new"]


@pytest.mark.parametrize("rep", ["sage#9", "sage#0", "sage#x", "sage", "echo#1"])
def test_bad_replace_errors_file_unchanged(tmp_path, rep):
    p = tmp_path / "lessons.md"
    p.write_bytes(HAND.encode("utf-8"))
    before = p.read_bytes()
    with pytest.raises(LessonError) as e:
        add(p, "sage", "New", None, "2026-11-24", replace=rep)
    assert p.read_bytes() == before
    if rep == "sage#9":
        assert "sage" in str(e.value) and "2" in str(e.value)


@pytest.mark.parametrize("key,text", [
    ("nobody", "ok"), ("sage", "x" * 161), ("sage", ""), ("sage", "mail me a@x.com"),
    ("sage", "see http://foo"), ("sage", "see https://foo"), ("sage", "two\nlines"),
])
def test_bad_input_raises(tmp_path, key, text):
    p = tmp_path / "lessons.md"
    with pytest.raises(LessonError):
        add(p, key, text, None, "2026-11-24")
    assert not p.exists()


def test_160_chars_ok(tmp_path):
    assert add(tmp_path / "l.md", "sage", "x" * 160, None, "2026-11-24") == "added"


def test_check(tmp_path):
    p = tmp_path / "lessons.md"
    assert check(p) != []  # missing file lacks headings
    for i in range(40):
        add(p, "everyone", f"lesson {i}", None, "2026-11-24")
    assert check(p) == []
    add(p, "everyone", "lesson 40", None, "2026-11-24")
    probs = check(p)
    assert len(probs) == 1 and "41" in probs[0]
    p.write_text("## Everyone\n", encoding="utf-8")
    assert any("Sage" in x for x in check(p))


def test_cli_list_section_numbering(tmp_path):
    p = tmp_path / "lessons.md"
    add(p, "echo", "E1", None, "2026-11-24")
    add(p, "sage", "S1", None, "2026-11-24")
    add(p, "sage", "S2", None, "2026-11-24")
    r = run_cli("list", "--section", "sage", "--file", str(p))
    assert r.returncode == 0 and r.stdout.splitlines() == ["sage#1 S1", "sage#2 S2"]
    r = run_cli("list", "--file", str(p))
    assert r.stdout.splitlines() == ["echo#1 E1", "sage#1 S1", "sage#2 S2"]


def test_cli_missing_file_list_empty(tmp_path):
    r = run_cli("list", "--file", str(tmp_path / "none.md"))
    assert r.returncode == 0 and r.stdout == ""


def test_cli_round_trip(tmp_path):
    p = tmp_path / "lessons.md"
    run = tmp_path / "run-a"
    r = run_cli("add", "--section", "iris", "--text", "Big fonts.", "--run", str(run), "--file", str(p))
    assert r.returncode == 0
    assert run_cli("add", "--section", "iris", "--text", "big fonts.", "--file", str(p)).returncode == 0
    assert run_cli("list", "--file", str(p)).stdout == "iris#1 Big fonts.\n"
    r = run_cli("add", "--section", "iris", "--text", "Better.", "--replace", "iris#1", "--file", str(p))
    assert r.returncode == 0
    assert run_cli("list", "--file", str(p)).stdout == "iris#1 Better.\n"
    assert run_cli("check", "--file", str(p)).returncode == 0


def test_cli_errors_exit_1(tmp_path):
    p = tmp_path / "lessons.md"
    r = run_cli("add", "--section", "nobody", "--text", "x", "--file", str(p))
    assert r.returncode == 1 and r.stderr.startswith("error:")
    r = run_cli("add", "--section", "sage", "--text", "x", "--replace", "sage#3", "--file", str(p))
    assert r.returncode == 1


def test_committed_template():
    text = (ROOT / "lessons.md").read_text(encoding="utf-8")
    lines = text.splitlines()
    assert lines[1] == "Lessons the team follows. Edit freely; the current video's own instructions always win."
    assert [l for l in lines if l.startswith("## ")] == HEADINGS
    assert check(ROOT / "lessons.md") == []
    assert all(not v for v in load(ROOT / "lessons.md").values())


def test_replace_refuses_text_that_duplicates_another_lesson(tmp_path):
    p = tmp_path / "lessons.md"
    add(p, "sage", "Check captions.", None, "2026-11-24")
    add(p, "sage", "Check numbers.", None, "2026-11-24")
    before = p.read_bytes()
    with pytest.raises(LessonError):
        add(p, "sage", "check  captions.", None, "2026-11-24", replace="sage#2")
    assert p.read_bytes() == before
    # replacing a lesson with its own text is still fine
    assert add(p, "sage", "Check captions.", None, "2026-11-24", replace="sage#1") == "replaced"


def test_add_with_missing_heading_appends_it_and_keeps_earlier_bytes(tmp_path):
    p = tmp_path / "lessons.md"
    original = "# Lessons\r\nmy note \xe9\r\n\r\n## Everyone\r\n- keep me\r\n"
    p.write_bytes(original.encode("utf-8"))
    assert add(p, "iris", "One scene per step.", None, "2026-11-24") == "added"
    data = p.read_bytes()
    assert data.startswith(original.encode("utf-8"))
    assert load(p)["iris"][0].text == "One scene per step."
    assert b"## Iris (design)" in data


def test_remove_keeps_every_other_byte(tmp_path):
    p = tmp_path / "lessons.md"
    original = ("# Lessons\r\nhand note\r\n\r\n## Everyone\r\n- one\r\n- two\r\n- three\r\n\r\n"
                "## Sage (review)\r\n- keep\r\n")
    p.write_bytes(original.encode("utf-8"))
    assert notebook.remove(p, "everyone", 2) == "removed"
    assert p.read_bytes() == original.replace("- two\r\n", "").encode("utf-8")
    assert not (tmp_path / "lessons.md.tmp").exists()


@pytest.mark.parametrize("key,n", [("everyone", 0), ("everyone", 2), ("echo", 1), ("nope", 1)])
def test_remove_bad_target_errors_file_unchanged(tmp_path, key, n):
    p = tmp_path / "lessons.md"
    add(p, "everyone", "Only one.", None, "2026-11-24")
    before = p.read_bytes()
    with pytest.raises(LessonError):
        notebook.remove(p, key, n)
    assert p.read_bytes() == before


def test_remove_cli(tmp_path):
    p = tmp_path / "lessons.md"
    add(p, "flip", "Ease every move.", None, "2026-11-24")
    r = run_cli("remove", "--file", str(p), "--section", "flip", "--number", "1")
    assert r.returncode == 0 and r.stdout.strip() == "removed"
    assert load(p)["flip"] == []
    r = run_cli("remove", "--file", str(p), "--section", "flip", "--number", "1")
    assert r.returncode == 1 and r.stderr.startswith("error:")
