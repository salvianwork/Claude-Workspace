"""Browser tests for the answer board (Node Playwright via browser_driver.mjs).

Run with: .venv/bin/pytest tests/dashboard -m slow -q
"""
import json
import shutil
import subprocess
import threading
from contextlib import contextmanager
from pathlib import Path

import pytest

from tools.dashboard.server import make_server

pytestmark = pytest.mark.slow

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
FIX = REPO / "tests" / "fixtures" / "runs"
DRIVER = HERE / "browser_driver.mjs"
TOKEN = "browsertoken"


@contextmanager
def studio(tmp_path, runs=(), answers=None, mutate=None):
    """Serve a tmp project holding copies of the given fixture runs."""
    (tmp_path / "team.json").write_text((REPO / "team.json").read_text(encoding="utf-8"), encoding="utf-8")
    (tmp_path / "videos").mkdir(exist_ok=True)
    for name in runs:
        shutil.copytree(FIX / name, tmp_path / "videos" / name)
    for (run, rid), ans in (answers or {}).items():
        board = tmp_path / "videos" / run / "board"
        board.mkdir(parents=True, exist_ok=True)
        (board / f"answer-{rid}.json").write_text(json.dumps(ans), encoding="utf-8")
    if mutate:
        mutate(tmp_path / "videos")
    server = make_server(tmp_path, port=0, token=TOKEN)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    try:
        yield server
    finally:
        server.shutdown()
        server.server_close()


def drive(steps, expect_ok=True, http_errors_ok=False):
    p = subprocess.run(["node", str(DRIVER), json.dumps(steps)], capture_output=True, text=True,
                       timeout=120, cwd=str(HERE))
    assert p.stdout, p.stderr
    out = json.loads(p.stdout)
    if expect_ok:
        assert out["ok"], out.get("error", "") + "\n--- page text ---\n" + str(out.get("board", ""))
        errors = [e for e in out["errors"] if not (http_errors_ok and "Failed to load resource" in e)]
        assert errors == [], errors
    return out


def base_url(server):
    return server.url.split("?")[0]


def answer_file(server, run, rid):
    return Path(server.root) / "videos" / run / "board" / f"answer-{rid}.json"


def test_board_approve_flow(tmp_path):
    with studio(tmp_path, ["gate1-waiting"]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "wait_selector", "selector": "#board button:text-is('Approve')"},
            {"op": "eval", "js": "location.href"},
            {"op": "click", "name": "Approve"},
            {"op": "wait_text", "text": "Sent ✓ — Quill is on it"},
            {"op": "count", "selector": "#board button.decision:enabled"},
        ])
        assert "key=" not in out["results"][3]
        assert out["results"][6] == 0  # controls locked
        ans = json.loads(answer_file(s, "gate1-waiting", "gate-1-1").read_text(encoding="utf-8"))
        assert ans["decision"] == "approve" and ans["source"] == "board"


def test_board_requires_text_for_changes(tmp_path):
    with studio(tmp_path, ["gate1-waiting"]) as s:
        drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "click", "name": "Request changes"},
            {"op": "wait_text", "text": "Type what should change first"},
        ])
        assert not answer_file(s, "gate1-waiting", "gate-1-1").exists()
        drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "fill", "selector": "#reply", "value": "Make scene 2 simpler"},
            {"op": "click", "name": "Request changes"},
            {"op": "wait_text", "text": "Sent ✓"},
        ])
        ans = json.loads(answer_file(s, "gate1-waiting", "gate-1-1").read_text(encoding="utf-8"))
        assert ans == {**ans, "decision": "changes", "text": "Make scene 2 simpler"}


def test_board_stale_request_hidden(tmp_path):
    with studio(tmp_path, ["stale-request"]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "How volcanoes work"},
            {"op": "sleep", "ms": 300},
            {"op": "count", "selector": "#board button.decision"},
            {"op": "text", "selector": "#board"},
        ])
        assert out["results"][3] == 0
        assert "WAITING FOR YOU" not in out["results"][4]


def test_board_idle_message(tmp_path):
    with studio(tmp_path, ["empty"]) as s:
        drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "No video running. Start one with /make-video in Claude Code."},
            {"op": "wait_selector", "selector": "canvas#studio"},
        ])


def test_board_gate2_play_buttons(tmp_path):
    with studio(tmp_path, ["gate2-waiting"]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "wait_selector", "selector": "#board button.play"},
            {"op": "count", "selector": "#board button.play"},
            {"op": "eval", "js": "[...document.querySelectorAll('#board button.play')].map(b => b.dataset.src)"},
            {"op": "text", "selector": "#board"},
        ])
        assert out["results"][3] == 3
        assert out["results"][4][0] == "/files/gate2-waiting/02-voice/scene-01.wav"
        assert "am_adam" in out["results"][5]


def test_board_stuck_gate_options_and_must_fix(tmp_path):
    with studio(tmp_path, ["stuck-gate3"]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "wait_text", "text": "Presenter outfit is missing"},
            {"op": "buttons", "selector": "#board button.decision"},
        ])
        assert [t.split("\n")[-1].strip() for t in out["results"][3]] == ["Accept anyway", "Give directions", "Cancel"]


def _stuck_gate4(videos):
    run = videos / "stuck-gate3"
    req = json.loads((run / "board" / "request.json").read_text(encoding="utf-8"))
    req.update(id="stuck-gate-4-1", checkpoint="stuck-gate-4", title="The video is stuck")
    (run / "board" / "request.json").write_text(json.dumps(req), encoding="utf-8")
    (run / "review" / "gate-4-round-3.md").write_text("# Gate 4, round 3: FIX\n## Must-fix\n- Render failed\n", encoding="utf-8")


def test_board_stuck_gate4_without_a_video_hides_accept(tmp_path):
    """After a failed render there is nothing to accept: the button is hidden and the reason shown."""
    with studio(tmp_path, ["stuck-gate3"], mutate=_stuck_gate4) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "wait_text", "text": "there is no video to accept"},
            {"op": "buttons", "selector": "#board button.decision"},
        ])
        assert [t.split("\n")[-1].strip() for t in out["results"][3]] == ["Give directions", "Cancel"]

    def with_video(videos):
        _stuck_gate4(videos)
        out_dir = videos / "stuck-gate3" / "04-video" / "out"
        out_dir.mkdir(parents=True)
        (out_dir / "video.mp4").write_bytes(b"mp4")
    (tmp_path / "b").mkdir()
    with studio(tmp_path / "b", ["stuck-gate3"], mutate=with_video) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "Render failed"},
            {"op": "buttons", "selector": "#board button.decision"},
        ])
        assert [t.split("\n")[-1].strip() for t in out["results"][2]] == ["Accept anyway", "Give directions", "Cancel"]


def test_board_cancel_needs_second_click(tmp_path):
    with studio(tmp_path, ["stuck-gate3"]) as s:
        drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "click", "name": "Cancel"},
            {"op": "wait_text", "text": "Click Cancel again to stop this video"},
        ])
        assert not answer_file(s, "stuck-gate3", "stuck-gate-3-1").exists()


def test_board_answered_in_chat(tmp_path):
    ans = {"id": "gate-1-1", "decision": "approve", "text": "", "source": "chat", "time": "2026-11-20T10:09:12"}
    with studio(tmp_path, ["gate1-waiting"], {("gate1-waiting", "gate-1-1"): ans}) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "Answered in chat"},
            {"op": "count", "selector": "#board button.decision:enabled"},
            {"op": "text", "selector": "#board"},
        ])
        assert out["results"][2] == 0
        assert "type anything in the chat (or run /make-video --resume)" in out["results"][3]
        assert "unlocks" not in out["results"][3]


def test_board_done_links(tmp_path):
    with studio(tmp_path, ["done"]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "Done"},
            {"op": "eval", "js": "[...document.querySelectorAll('#board a')].map(a => a.getAttribute('href'))"},
        ])
        assert "/files/done/04-video/out/video.mp4" in out["results"][2]
        assert "/files/done/04-video/credits.md" in out["results"][2]


@pytest.mark.parametrize("status,body,msg", [
    (409, {"error": "already answered"}, "Already answered"),
    (409, {"error": "stale"}, "This request is no longer open"),
    (403, {"error": "bad key"}, "Studio key missing"),
])
def test_board_answer_errors(tmp_path, status, body, msg):
    with studio(tmp_path, ["gate1-waiting"]) as s:
        drive([
            {"op": "goto", "url": s.url},
            {"op": "mock_answer", "status": status, "body": body},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "click", "name": "Approve"},
            {"op": "wait_text", "text": msg},
        ], http_errors_ok=True)


def test_board_without_key_explains(tmp_path):
    with studio(tmp_path, ["gate1-waiting"]) as s:
        drive([
            {"op": "goto", "url": base_url(s)},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "click", "name": "Approve"},
            {"op": "wait_text", "text": "python -m tools.dashboard"},
        ])
        assert not answer_file(s, "gate1-waiting", "gate-1-1").exists()


def test_board_run_picker(tmp_path):
    with studio(tmp_path, ["gate1-waiting", "done"]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_selector", "selector": "#run-picker"},
            {"op": "count", "selector": "#run-picker option"},
            {"op": "eval", "js": "document.querySelector('#run-picker').value"},
        ])
        assert out["results"][2] == 2
        assert out["results"][3] == "gate1-waiting"  # the run waiting for the owner wins


def _set_status(videos, run, **changes):
    f = videos / run / "status.json"
    status = json.loads(f.read_text(encoding="utf-8"))
    extra = changes.pop("append", [])
    status.update(changes)
    status["history"] += extra
    f.write_text(json.dumps(status), encoding="utf-8")


def test_board_skips_cancelled_run_for_newer_working_run(tmp_path):
    def mutate(videos):
        # an old run the owner cancelled at a stuck gate: state stays "failed" forever
        _set_status(videos, "stuck-gate3", append=[{"time": "2026-11-20T10:45:00", "agent": "reviewer",
                                                    "event": "cancelled by owner", "detail": ""}])
        _set_status(videos, "story-working", topic="Why the sky is blue",
                    append=[{"time": "2026-11-20T11:00:00", "agent": "story", "event": "drafting",
                             "detail": ""}])
    with studio(tmp_path, ["stuck-gate3", "story-working"], mutate=mutate) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_selector", "selector": "#run-picker"},
            {"op": "wait_text", "text": "Quill drafting"},
            {"op": "sleep", "ms": 1800},  # one more poll: it must not jump back
            {"op": "eval", "js": "document.querySelector('#run-picker').value"},
            {"op": "text", "selector": "#board"},
        ])
        assert out["results"][4] == "story-working"
        assert "WAITING FOR YOU" not in out["results"][5]


def test_board_keeps_run_picked_by_hand(tmp_path):
    with studio(tmp_path, ["gate1-waiting", "done"]) as s:
        pick = ("(() => { const p = document.querySelector('#run-picker'); p.value = 'done';"
                " p.dispatchEvent(new Event('change', { bubbles: true })); return p.value; })()")
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "eval", "js": pick},
            {"op": "wait_text", "text": "is finished"},
            {"op": "sleep", "ms": 3500},  # two polls while gate1-waiting still needs the owner
            {"op": "eval", "js": "document.querySelector('#run-picker').value"},
            {"op": "text", "selector": "#board"},
        ])
        assert out["results"][5] == "done"
        assert "WAITING FOR YOU" not in out["results"][6]


def test_board_copy_reply(tmp_path):
    with studio(tmp_path, ["gate1-waiting"]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "click", "name": "Copy reply"},
            {"op": "eval", "js": "navigator.clipboard.readText()"},
            {"op": "fill", "selector": "#reply", "value": "shorter please"},
            {"op": "click", "name": "Copy reply"},
            {"op": "eval", "js": "navigator.clipboard.readText()"},
        ])
        assert out["results"][3] == "approve"
        assert out["results"][6] == "shorter please"


ALL_STATES = ["story-working", "gate1-reviewing", "gate1-fixing", "gate1-waiting", "gate2-waiting",
              "stuck-gate3", "done", "stale-request", "empty"]

LAYOUT_JS = """(() => {
  const b = document.querySelector('#board');
  const small = [...b.querySelectorAll('*')].filter(e => e.childNodes.length && [...e.childNodes]
      .some(n => n.nodeType === 3 && n.textContent.trim()) && e.offsetParent !== null
      && parseFloat(getComputedStyle(e).fontSize) < 18).map(e => e.tagName + ':' + e.textContent.slice(0, 30));
  const must = [...document.querySelectorAll('#board button.decision, #reply')].filter(e => e.offsetParent !== null);
  return {overflowX: b.scrollWidth > b.clientWidth + 1, controls: must.length,
          belowFold: must.filter(e => e.getBoundingClientRect().bottom > innerHeight).map(e => e.id || e.textContent),
          pageOverflowX: document.documentElement.scrollWidth > innerWidth + 1, small};
})()"""


@pytest.mark.parametrize("state", ALL_STATES)
def test_board_layout_every_state(tmp_path, state):
    with studio(tmp_path, [state]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_selector", "selector": "#board[data-ready]"},
            {"op": "eval", "js": LAYOUT_JS},
            {"op": "viewport", "w": 1366, "h": 768},
            {"op": "eval", "js": LAYOUT_JS},
        ])
        big, small = out["results"][2], out["results"][4]
        assert (big["overflowX"], big["pageOverflowX"], big["small"], big["belowFold"]) == (False, False, [], [])
        assert not small["overflowX"] and not small["pageOverflowX"]
        if state in ("gate1-waiting", "gate2-waiting", "stuck-gate3"):
            assert small["controls"] >= 3 and small["belowFold"] == [], small  # buttons + text box above the fold


def test_board_key_survives_reload(tmp_path):
    with studio(tmp_path, ["gate1-waiting"]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "reload"},
            {"op": "wait_text", "text": "WAITING FOR YOU"},
            {"op": "eval", "js": "location.href"},
            {"op": "click", "name": "Approve"},
            {"op": "wait_text", "text": "Sent ✓ — Quill is on it"},
        ])
        assert "key=" not in out["results"][4]
        assert answer_file(s, "gate1-waiting", "gate-1-1").exists()


def test_board_recovers_from_hung_request(tmp_path):
    with studio(tmp_path, ["gate1-waiting"]) as s:
        drive([
            {"op": "hang_once", "pattern": "**/api/state*"},
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "WAITING FOR YOU", "timeout": 20000},
        ])


XSS = '<img src=x onerror=alert(1)>'


def _poison(videos):
    run = videos / "stuck-gate3"
    req = json.loads((run / "board" / "request.json").read_text(encoding="utf-8"))
    req.update(title="T " + XSS, body="B " + XSS, links=[{"label": "L " + XSS, "path": "01-script/script.md"}])
    (run / "board" / "request.json").write_text(json.dumps(req), encoding="utf-8")
    review = run / "review" / "gate-3-round-3.md"
    review.write_text(f"# Gate 3, round 3: FIX\n## Must-fix\n- R {XSS} `{XSS}`\n", encoding="utf-8")
    status = json.loads((run / "status.json").read_text(encoding="utf-8"))
    status["topic"] = "Topic " + XSS
    (run / "status.json").write_text(json.dumps(status), encoding="utf-8")


def test_board_escapes_html(tmp_path):
    with studio(tmp_path, ["stuck-gate3"], mutate=_poison) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_text", "text": "T " + XSS},
            {"op": "wait_text", "text": "R " + XSS},
            {"op": "sleep", "ms": 500},
            {"op": "count", "selector": "img"},
            {"op": "text", "selector": "#board"},
        ])
        assert out["results"][4] == 0
        text = out["results"][5]
        for want in ("Topic " + XSS, "B " + XSS, "L " + XSS):
            assert want in text


STUDIO_JS = """(async () => {
  const cv = document.querySelector('#studio');
  const g = cv.getContext('2d');
  const d = g.getImageData(0, 0, cv.width, cv.height).data;
  const seen = new Set();
  let sum = 0, sum2 = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 97) {
    const v = d[i] + d[i + 1] + d[i + 2];
    sum += v; sum2 += v * v; n++; seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  }
  const runs = await (await fetch('/api/runs')).json();
  const api = runs.length ? await (await fetch('/api/state?run=' + encodeURIComponent(runs[0].run))).json() : null;
  return {variance: sum2 / n - (sum / n) ** 2, colours: seen.size, debug: window.__studioDebug(),
          api: api && api.agents, w: cv.width, h: cv.height};
})()"""


@pytest.mark.parametrize("state", ALL_STATES)
def test_studio_draws_agents(tmp_path, state):
    with studio(tmp_path, [state]) as s:
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_selector", "selector": "#board[data-ready]"},
            {"op": "sleep", "ms": 1000},
            {"op": "eval", "js": STUDIO_JS},
        ])
        r = out["results"][3]
        assert r["w"] > 300 and r["h"] > 200
        assert r["variance"] > 200 and r["colours"] > 40, r  # a drawn picture, not a blank fill
        api = r["api"] or {role: {"where": "kitchen", "activity": "idle"}
                           for role in ("story", "voice", "design", "animator", "reviewer")}
        dbg = r["debug"]
        rooms = dbg.pop("rooms")
        assert dbg.pop("triggered") == 0  # nothing replays on the first look
        assert set(dbg) == set(api)
        for role, want in api.items():
            got = dbg[role]
            assert (got["where"], got["activity"]) == (want["where"], want["activity"]), role
            assert isinstance(got["x"], (int, float)) and isinstance(got["y"], (int, float))
            assert 0 <= got["x"] < 332 and 0 <= got["y"] < 270
            if not got["walking"]:  # standing agents are inside the room the API names
                x0, y0, x1, y1 = rooms[want["where"]]
                assert x0 <= got["x"] <= x1 and y0 <= got["y"] <= y1, (role, got, want)


def _long_history(n):
    """A reviewing run with n alternating gate PASS/FIX events (more than the API's 30-event window)."""
    hist = [{"time": "2026-11-20T10:00:00", "agent": "story", "event": "started", "detail": ""}]
    for i in range(1, n):
        hist.append({"time": f"2026-11-20T{10 + i // 60:02d}:{i % 60:02d}:00", "agent": "reviewer",
                     "event": "gate 1 FIX" if i % 2 else "gate 1 PASS", "detail": f"round {i}"})
    return hist


def test_studio_new_event_triggers_once_across_sliding_window(tmp_path):
    def mutate(videos):
        status = json.loads((videos / "gate1-reviewing" / "status.json").read_text(encoding="utf-8"))
        status["history"] = _long_history(36)
        (videos / "gate1-reviewing" / "status.json").write_text(json.dumps(status), encoding="utf-8")

    with studio(tmp_path, ["gate1-reviewing"], mutate=mutate) as s:
        path = Path(s.root) / "videos" / "gate1-reviewing" / "status.json"
        status = json.loads(path.read_text(encoding="utf-8"))
        status["history"].append({"time": "2026-11-20T11:00:00", "agent": "reviewer", "event": "gate 1 PASS",
                                  "detail": "round 99"})
        out = drive([
            {"op": "goto", "url": s.url},
            {"op": "wait_selector", "selector": "#board[data-ready]"},
            {"op": "sleep", "ms": 500},
            {"op": "eval", "js": "__studioDebug().triggered"},
            {"op": "write_file", "path": str(path), "text": json.dumps(status)},
            {"op": "wait_text", "text": "round 99"},
            {"op": "sleep", "ms": 500},
            {"op": "eval", "js": "__studioDebug().triggered"},
        ])
        assert out["results"][3] == 0
        assert out["results"][7] == 1  # only the one new event, not the whole shifted window


def test_studio_clamps_long_names():
    p = subprocess.run(["node", "--input-type=module", "-e",
                        f"import('{(REPO / 'tools/dashboard/static/studio.js').as_uri()}')"
                        ".then(m => console.log(JSON.stringify([m.clampName('Quill'), m.clampName('Bartholomew-Long'),"
                        " m.clampName('Abcdefghij')])))"], capture_output=True, text=True, timeout=60)
    assert json.loads(p.stdout) == ["Quill", "Bartholom…", "Abcdefghij"], p.stderr
