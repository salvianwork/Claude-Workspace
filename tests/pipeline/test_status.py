import json
from datetime import date

import pytest

from tools.pipeline.status import (
    RunStateError,
    format_status,
    init_run,
    load_status,
    slugify,
    update,
)


def test_slugify_handles_symbols_and_accents():
    assert slugify("Why is the sky blue? (Rayleigh) — café") == "why-is-the-sky-blue-rayleigh-cafe"
    assert slugify("???") == "video"
    assert len(slugify("a" * 200)) == 50


def test_init_run_creates_layout(tmp_path):
    run = init_run("How volcanoes work", tmp_path, today=date(2026, 11, 19))
    assert run.name == "2026-11-19-how-volcanoes-work"
    for sub in ["01-script", "02-voice", "03-design", "04-video", "review"]:
        assert (run / sub).is_dir()
    s = load_status(run)
    assert (s["step"], s["state"], s["round"]) == ("story", "working", 1)
    brief = (run / "brief.md").read_text()
    assert "How volcanoes work" in brief and "language: en" in brief
    assert (run / "progress.log").exists()


def test_init_run_does_not_overwrite(tmp_path):
    a = init_run("X", tmp_path, today=date(2026, 11, 19))
    b = init_run("X", tmp_path, today=date(2026, 11, 19))
    assert b.name == a.name + "-2"
    c = init_run("X", tmp_path, today=date(2026, 11, 19))
    assert c.name == a.name + "-3"


def test_update_appends_history_and_log(tmp_path):
    run = init_run("X", tmp_path)
    update(run, step="voice", state="reviewing", round=1, agent="reviewer", event="gate 2 started")
    assert load_status(run)["step"] == "voice"
    assert "[2/4] Voice" in (run / "progress.log").read_text().splitlines()[-1]
    assert load_status(run)["history"][-1]["event"] == "gate 2 started"


def test_update_without_step_keeps_step(tmp_path):
    run = init_run("X", tmp_path)
    update(run, state="reviewing", agent="story", event="e")
    assert load_status(run)["step"] == "story"


def test_update_rejects_bad_state(tmp_path):
    run = init_run("X", tmp_path)
    with pytest.raises(ValueError):
        update(run, state="sleeping", agent="x", event="y")


def test_update_rejects_bad_step_and_round(tmp_path):
    run = init_run("X", tmp_path)
    with pytest.raises(ValueError):
        update(run, step="nope", agent="x", event="y")
    for bad in (0, 4, "2", True):
        with pytest.raises(ValueError):
            update(run, round=bad, agent="x", event="y")
    assert load_status(run)["round"] == 1


def test_missing_or_corrupt_status_gives_clear_error(tmp_path):
    with pytest.raises(RunStateError, match="status.json"):
        load_status(tmp_path)
    (tmp_path / "status.json").write_text("{not json")
    with pytest.raises(RunStateError, match="corrupt"):
        load_status(tmp_path)


def test_format_status_shows_step(tmp_path):
    run = init_run("Volcanoes", tmp_path)
    out = format_status(run)
    assert "[1/4] Story" in out and "Volcanoes" in out


def test_format_status_last_five_events(tmp_path):
    run = init_run("X", tmp_path)
    for i in range(7):
        update(run, agent="story", event=f"ev{i}")
    out = format_status(run)
    assert "ev6" in out and "ev2" in out and "ev1" not in out


def test_progress_log_format(tmp_path):
    run = init_run("X", tmp_path)
    update(run, step="voice", state="reviewing", round=1, agent="a", event="e")
    line = (run / "progress.log").read_text().splitlines()[-1]
    parts = line.split(" | ")
    assert parts[1] == "[2/4] Voice".ljust(14)
    assert parts[2].startswith("reviewing (round 1)")


def test_cli_init_show_list(tmp_path, capsys):
    from tools.pipeline.status import main

    assert main(["init", "Hello World", "--videos-root", str(tmp_path)]) == 0
    run = capsys.readouterr().out.strip()
    assert run.endswith("hello-world")
    assert main(["update", run, "--agent", "voice", "--state", "reviewing", "--round", "1", "--event", "x"]) == 0
    capsys.readouterr()
    assert main(["show", run]) == 0
    assert "reviewing" in capsys.readouterr().out
    assert main(["list", "--videos-root", str(tmp_path)]) == 0
    assert "hello-world" in capsys.readouterr().out


def test_format_status_shows_team_names(tmp_path):
    run = init_run("Volcanoes", tmp_path / "videos")
    update(run, agent="reviewer", event="review started")
    out = format_status(run)
    assert "[1/4] Story" in out and "Quill" in out  # default team (no team.json above the run)
    assert "Quill (story): started" in out and "Sage (reviewer): review started" in out


def test_format_status_reads_team_json_above_the_run(tmp_path):
    (tmp_path / "team.json").write_text(
        json.dumps({"story": {"name": "Nib"}, "reviewer": {"name": "Owl"}}), encoding="utf-8")
    run = init_run("Volcanoes", tmp_path / "videos")
    update(run, step="voice", agent="reviewer", event="gate 1 PASS")
    update(run, agent="someone", event="odd")
    out = format_status(run)
    assert "[2/4] Voice — Echo" in out
    assert "Owl (reviewer): gate 1 PASS" in out and "Nib (story): started" in out
    assert "someone: odd" in out


def test_format_status_done_step_has_no_name(tmp_path):
    run = init_run("X", tmp_path)
    update(run, step="done", state="done", agent="animator", event="video done")
    assert "Step:  [4/4] Done\n" in format_status(run)
