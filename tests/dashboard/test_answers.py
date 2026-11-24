import json
import subprocess
import sys
from pathlib import Path

import pytest

from tools.dashboard import answers
from tools.dashboard.answers import AnswerError


def req(run, checkpoint="gate-1", options=("approve", "changes")):
    return answers.write_request(run, checkpoint, "T", "B", list(options))


def test_request_ids_increment(tmp_path):
    assert req(tmp_path)["id"] == "gate-1-1"
    assert req(tmp_path)["id"] == "gate-1-2"
    assert req(tmp_path, "gate-2")["id"] == "gate-2-1"
    assert answers.read_request(tmp_path)["id"] == "gate-2-1"


def test_lessons_checkpoint_accepted(tmp_path):
    r = req(tmp_path, "lessons", options=("approve", "changes"))
    assert r["id"] == "lessons-1" and r["checkpoint"] == "lessons"


def test_first_answer_wins(tmp_path):
    r = req(tmp_path)
    answers.write_answer(tmp_path, r["id"], "approve")
    with pytest.raises(AnswerError, match="already answered"):
        answers.write_answer(tmp_path, r["id"], "changes")


def test_answer_must_match_open_request(tmp_path):
    req(tmp_path)
    with pytest.raises(AnswerError, match="no open request with id"):
        answers.write_answer(tmp_path, "gate-1-9", "approve")


def test_decision_must_be_an_option(tmp_path):
    r = req(tmp_path)
    with pytest.raises(AnswerError):
        answers.write_answer(tmp_path, r["id"], "cancel")


def test_bad_checkpoint_and_options(tmp_path):
    with pytest.raises(AnswerError):
        answers.write_request(tmp_path, "nope", "t", "b", ["approve"])
    with pytest.raises(AnswerError):
        answers.write_request(tmp_path, "stuck-gate-5", "t", "b", ["approve"])
    with pytest.raises(AnswerError):
        answers.write_request(tmp_path, "gate-1", "t", "b", ["bogus"])
    assert req(tmp_path, "stuck-gate-3")["id"] == "stuck-gate-3-1"


def test_unicode_round_trip(tmp_path):
    r = answers.write_request(tmp_path, "question", "Q", "B", ["answer"])
    text = "Café 🌋 “quoted”"
    answers.write_answer(tmp_path, r["id"], "answer", text)
    assert answers.read_answer(tmp_path, r["id"])["text"] == text
    assert answers.read_answer(tmp_path, "question-2") is None


def run_cli(*args):
    return subprocess.run([sys.executable, "-m", "tools.dashboard.answers", *map(str, args)],
                          capture_output=True, text=True, encoding="utf-8",
                          cwd=Path(__file__).resolve().parents[2])


def test_cli_write_then_show(tmp_path):
    p = run_cli("request", tmp_path, "--checkpoint", "gate-1", "--title", "T", "--body", "B",
                "--options", "approve,changes", "--link", "Full script=01-script/script.md")
    assert p.returncode == 0 and p.stdout.strip() == "gate-1-1"
    assert answers.read_request(tmp_path)["links"] == [
        {"label": "Full script", "path": "01-script/script.md"}]
    p = run_cli("write", tmp_path, "--id", "gate-1-1", "--decision", "approve", "--source", "chat")
    assert p.returncode == 0
    assert json.loads(p.stdout)["source"] == "chat"
    p = run_cli("show", tmp_path)
    out = json.loads(p.stdout)
    assert out["request"]["id"] == "gate-1-1" and out["answer"]["decision"] == "approve"
    p = run_cli("write", tmp_path, "--id", "gate-1-1", "--decision", "approve")
    assert p.returncode == 1 and p.stderr.startswith("error:")


def test_corrupt_or_unreadable_json_reads_as_none(tmp_path, monkeypatch):
    board = tmp_path / "board"
    board.mkdir()
    (board / "request.json").write_text("{half-writ", encoding="utf-8")
    (board / "answer-gate-1-1.json").write_bytes(b"\xff\xfe\x00")
    assert answers.read_request(tmp_path) is None
    assert answers.read_answer(tmp_path, "gate-1-1") is None

    (board / "request.json").write_text("{}", encoding="utf-8")

    def boom(self, *a, **k):
        raise PermissionError("replace race")

    monkeypatch.setattr(Path, "read_text", boom)
    assert answers.read_request(tmp_path) is None


def test_cli_team_prints_the_team(tmp_path):
    p = run_cli("team")
    assert p.returncode == 0
    team = json.loads(p.stdout)
    assert set(team) == {"story", "voice", "design", "animator", "reviewer"}
    assert all(isinstance(v["name"], str) and v["name"] for v in team.values())
    (tmp_path / "team.json").write_text('{"story": {"name": "Nib"}}', encoding="utf-8")
    p = run_cli("team", "--root", tmp_path)
    team = json.loads(p.stdout)
    assert team["story"]["name"] == "Nib" and team["reviewer"]["name"] == "Sage"
    p = run_cli("team", "--root", tmp_path / "nowhere")
    assert p.returncode == 0 and json.loads(p.stdout)["story"]["name"] == "Quill"


def test_request_logged_before_request_file(tmp_path, monkeypatch):
    """A crash while writing request.json must not let the next request reuse the id."""
    def crash(path, data):
        raise OSError("disk full")
    monkeypatch.setattr(answers, "_atomic_write", crash)
    with pytest.raises(OSError):
        answers.write_request(tmp_path, "gate-1", "T", "B", ["approve"])
    monkeypatch.undo()
    assert answers.write_request(tmp_path, "gate-1", "T", "B", ["approve"])["id"] == "gate-1-2"
