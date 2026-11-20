import json
import shutil
from datetime import datetime
from pathlib import Path

import pytest

from tools.dashboard import answers
from tools.dashboard.state import list_runs, load_team, run_state

FIX = Path(__file__).resolve().parent.parent / "fixtures" / "runs"
ROOT = Path(__file__).resolve().parents[2]
TEAM = load_team(ROOT)
NOW = datetime(2026, 11, 20, 12, 0, 0)


def st(name, team=TEAM, now=NOW):
    return run_state(FIX / name, team, now=now)


def where(s):
    return {k: (v["where"], v["activity"]) for k, v in s["agents"].items()}


def idle_except(s, **kw):
    for role, v in s["agents"].items():
        if role not in kw:
            assert (v["where"], v["activity"]) == ("kitchen", "idle"), role


def test_empty_is_starting():
    s = st("empty")
    assert s["state"] == "starting"
    assert s["request"] is None and s["events"] == [] and s["track"] == []
    idle_except(s)


def test_story_working():
    s = st("story-working")
    assert s["state"] == "working" and s["step"] == "story" and s["round"] == 1
    assert where(s)["story"] == ("writers-room", "working")
    idle_except(s, story=1)
    assert s["request"] is None and s["summary"] is None and s["voice"] is None and s["video"] is None
    assert [t["status"] for t in s["track"]] == ["active"] + ["pending"] * 6
    assert [t["step"] for t in s["track"]] == ["story", "owner", "voice", "owner", "design", "animator", "final"]
    assert s["events"][0]["kind"] == "start"


def test_gate1_reviewing():
    s = st("gate1-reviewing")
    assert where(s)["story"] == ("review-room", "carrying")
    assert where(s)["reviewer"] == ("review-room", "reviewing")
    idle_except(s, story=1, reviewer=1)
    assert s["summary"] == {"scenes": 3, "words": 25, "est_seconds": 10.0, "gate": None, "round": None}


def test_gate1_fixing():
    s = st("gate1-fixing")
    assert where(s)["reviewer"] == ("writers-room", "carrying")
    assert where(s)["story"] == ("writers-room", "fixing")
    assert s["summary"]["gate"] == "FIX" and s["summary"]["round"] == 1
    assert s["events"][1]["kind"] == "fix"


def test_gate1_waiting():
    s = st("gate1-waiting")
    assert where(s)["story"] == ("review-door", "waiting")
    idle_except(s, story=1)
    assert s["request"]["id"] == "gate-1-1" and s["answered"] is None
    assert s["summary"]["gate"] == "PASS" and s["summary"]["round"] == 1
    assert [t["status"] for t in s["track"]] == ["done", "active"] + ["pending"] * 5
    kinds = [e["kind"] for e in s["events"]]
    assert "pass" in kinds and kinds[-1] == "owner"


def test_gate2_waiting():
    s = st("gate2-waiting")
    assert where(s)["voice"] == ("review-door", "waiting")
    assert s["request"]["checkpoint"] == "gate-2"
    assert s["voice"] == {"voice": "am_adam", "speed": 1.0, "total_s": 12.0,
                          "scenes": [{"id": i, "path": f"02-voice/scene-0{i}.wav"} for i in (1, 2, 3)]}
    assert [t["status"] for t in s["track"]] == ["done", "done", "done", "active", "pending", "pending", "pending"]
    handoffs = [e for e in s["events"] if e["kind"] == "start"]
    assert len(handoffs) == 2


def test_stuck_gate3():
    s = st("stuck-gate3")
    assert s["state"] == "failed"
    assert where(s)["reviewer"] == ("kitchen", "alarm")
    assert s["request"]["id"] == "stuck-gate-3-1"


def test_done_celebrates_then_idles():
    s = st("done", now=datetime(2026, 11, 20, 11, 30, 5))
    assert all(v == ("kitchen", "celebrating") for v in where(s).values())
    assert s["video"] == {"path": "04-video/out/video.mp4", "credits": "04-video/credits.md"}
    assert all(t["status"] == "done" for t in s["track"])
    s = st("done", now=datetime(2026, 11, 20, 11, 30, 11))
    assert all(v == ("kitchen", "idle") for v in where(s).values())
    assert s["events"][-1]["kind"] == "done"
    assert s["request"] is None


def test_stale_request_hidden():
    s = st("stale-request")
    assert s["request"] is None and s["answered"] is None


def test_answered_request(tmp_path):
    run = tmp_path / "r"
    shutil.copytree(FIX / "gate1-waiting", run)
    answers.write_answer(run, "gate-1-1", "approve")
    s = run_state(run, TEAM, now=NOW)
    assert s["request"] is None and s["answered"]["decision"] == "approve"


def test_corrupt_status_is_starting(tmp_path):
    run = tmp_path / "bad"
    run.mkdir()
    (run / "status.json").write_text("{not json", encoding="utf-8")
    s = run_state(run, TEAM)
    assert s["run"] == "bad" and s["state"] == "starting"
    assert s["events"] == [] and s["track"] == [] and s["request"] is None


def test_corrupt_extras_do_not_raise(tmp_path):
    run = tmp_path / "r"
    shutil.copytree(FIX / "gate2-waiting", run)
    (run / "01-script/script.md").write_text("garbage", encoding="utf-8")
    (run / "02-voice/manifest.json").write_text("{", encoding="utf-8")
    (run / "board/request.json").write_text("{", encoding="utf-8")
    s = run_state(run, TEAM, now=NOW)
    assert s["summary"] is None and s["voice"] is None and s["request"] is None


def test_events_use_team_names():
    team = load_team(ROOT)
    team["story"]["name"] = "Nova"
    s = run_state(FIX / "story-working", team, now=NOW)
    assert "Nova" in s["events"][0]["text"]
    assert s["team"]["story"]["name"] == "Nova"
    s = run_state(FIX / "gate1-fixing", team, now=NOW)
    assert s["events"][1]["text"].startswith("Sage stamped FIX")


def test_events_fall_back_to_progress_log(tmp_path):
    run = tmp_path / "r"
    shutil.copytree(FIX / "gate1-waiting", run)
    data = json.loads((run / "status.json").read_text(encoding="utf-8"))
    del data["history"]
    (run / "status.json").write_text(json.dumps(data), encoding="utf-8")
    s = run_state(run, TEAM, now=NOW)
    assert len(s["events"]) == 2
    assert "Quill" in s["events"][0]["text"] and s["events"][0]["time"] == "10:00"


def test_events_capped_at_30(tmp_path):
    run = tmp_path / "r"
    shutil.copytree(FIX / "story-working", run)
    data = json.loads((run / "status.json").read_text(encoding="utf-8"))
    data["history"] = [{"time": f"2026-11-20T10:{i:02d}:00", "agent": "story", "event": f"e{i}", "detail": ""}
                       for i in range(50)]
    (run / "status.json").write_text(json.dumps(data), encoding="utf-8")
    ev = run_state(run, TEAM, now=NOW)["events"]
    assert len(ev) == 30 and ev[-1]["text"].endswith("e49")


def test_team_defaults_when_missing_or_bad(tmp_path):
    assert load_team(tmp_path)["story"]["name"] == "Quill"
    (tmp_path / "team.json").write_text("{oops", encoding="utf-8")
    assert load_team(tmp_path)["reviewer"]["name"] == "Sage"
    (tmp_path / "team.json").write_text('{"story": {"name": "Nova"}, "voice": 5}', encoding="utf-8")
    t = load_team(tmp_path)
    assert t["story"]["name"] == "Nova" and t["story"]["look"].startswith("round glasses")
    assert t["voice"]["name"] == "Echo" and t["animator"]["name"] == "Flip"


def test_list_runs_sorted_newest_first(tmp_path):
    for name, src in (("a-old", "story-working"), ("b-new", "done"), ("c-none", "empty")):
        shutil.copytree(FIX / src, tmp_path / name)
    (tmp_path / "not-a-run").mkdir()
    rows = list_runs(tmp_path)
    assert [r["run"] for r in rows] == ["b-new", "a-old"]
    assert rows[0] == {"run": "b-new", "topic": "How volcanoes work", "step": "done",
                       "state": "done", "updated": "2026-11-20T11:30:00"}
    assert list_runs(tmp_path / "missing") == []
