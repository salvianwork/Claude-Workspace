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
        ])
        assert out["results"][2] == 0


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
        assert set(dbg) == set(api)
        for role, want in api.items():
            got = dbg[role]
            assert (got["where"], got["activity"]) == (want["where"], want["activity"]), role
            assert isinstance(got["x"], (int, float)) and isinstance(got["y"], (int, float))
            assert 0 <= got["x"] < 332 and 0 <= got["y"] < 270
