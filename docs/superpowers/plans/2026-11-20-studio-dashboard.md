# Studio Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local pixel-art "animation studio" web page that shows a `/make-video` run live (agents by name, rooms, hand-offs, reviews) and a large answer board where the owner approves or requests changes, with the answer reaching the pipeline.

**Architecture:** A Python standard-library HTTP server (`python -m tools.dashboard`) reads the run folder and serves one canvas page plus a small JSON API on 127.0.0.1. Checkpoints are exchanged through two files per request in `<run>/board/`. The `/make-video` orchestrator writes the request, starts a background waiter, and accepts the answer from the board or the chat.

**Tech Stack:** Python 3.12 stdlib (`http.server`, `json`, `secrets`), vanilla JS + `<canvas>` (no framework, no CDN), pytest, Playwright (already installed) for one slow browser test.

**Spec:** `docs/superpowers/specs/2026-11-20-studio-dashboard-design.md` (pipeline context: `docs/superpowers/specs/2026-11-19-video-agent-team-design.md`)

## Global Constraints

- Windows PC, path contains a space: `pathlib` everywhere; list-arg subprocess only.
- **No new Python packages** for the server; no external network, CDN or web fonts in the page (fully offline).
- Server binds **127.0.0.1 only**; every POST needs the per-start secret key; `Host` must be `127.0.0.1[:port]` or `localhost[:port]`; files served only from inside `videos/<run>/`.
- Pipeline files are the source of truth (formats pinned in `docs/superpowers/plans/2026-11-19-video-agent-team.md`); the dashboard only *writes* `<run>/board/answer-<id>.json`.
- The pipeline must work exactly as before when the dashboard isn't running.
- Team (role → name): story → **Quill**, voice → **Echo**, design → **Iris**, animator → **Flip**, reviewer → **Sage**; names are display-only, from `team.json`.
- Checkpoint ids: `gate-1`, `gate-1-changed-lines`, `gate-2`, `stuck-gate-<n>`, `final`, `question`.
- Decisions: `approve`, `changes`, `accept`, `directions`, `cancel`, `answer` (free text for `question`).
- A request is shown only while `status.json` state is `waiting_owner` or `failed`; otherwise it's stale and hidden.
- Board body text ≥ 18 px at 1920×1080; map is top-down pixel art drawn in code following Codixel's rules (palette with hue shifting, sprite-coloured outlines + rim light, dither only at band edges, mini characters).
- Waiter: background, up to 2 h; poll interval 1 s.

## Review Focus

1. **Answer arrives twice** (board click + chat reply, or double click): the first wins, the second is refused with "already answered" — test in Task 1.
2. **Stale request** after a resume or a crash (request file exists but status is `working`): the board must not show answer buttons — test in Task 2.
3. **Path tricks** (`/files/<run>/../../.env`, absolute paths, encoded `%2e%2e`): refused with 403 — test in Task 3.
4. **Run folder with missing or half-written files** (no `status.json` yet, `progress.log` mid-write, corrupt JSON): the API returns a clear "starting…" state, never a 500 — test in Task 2.
5. **Topic or text with non-ASCII / emoji / quotes** in requests and answers: round-trips byte-exactly through UTF-8 JSON on Windows — test in Task 1.

---

## File Structure

```
team.json                                   display names + looks
tools/dashboard/
  __init__.py
  __main__.py      python -m tools.dashboard  (start server, open browser)
  answers.py       request/answer files; CLI `python -m tools.dashboard.answers`
  wait.py          python -m tools.dashboard.wait <run> --id <id>
  state.py         run folder → board JSON (pure)
  server.py        routes, token + Host checks, file serving
  static/index.html  board.js  studio.js  sprites.js  palette.js
tests/dashboard/   test_answers.py test_wait.py test_state.py test_server.py test_browser.py
tests/fixtures/runs/<state>/   small run folders, one per pipeline state
```

### Pinned formats

**`team.json`**
```json
{"story":{"name":"Quill","look":"round glasses, cardigan, coffee mug"},
 "voice":{"name":"Echo","look":"big headphones, hoodie"},
 "design":{"name":"Iris","look":"beret, paint palette"},
 "animator":{"name":"Flip","look":"backwards cap, drawing tablet"},
 "reviewer":{"name":"Sage","look":"older, grey beard, clipboard"}}
```

**`<run>/board/request.json`**
```json
{"id":"gate-1-1","checkpoint":"gate-1","title":"Script ready","body":"…markdown-free text…",
 "options":["approve","changes"],"links":[{"label":"Full script","path":"01-script/script.md"}],
 "created":"2026-11-20T10:07:00"}
```
`id` = `<checkpoint>-<k>`, k = 1,2,… per checkpoint within a run.

**`<run>/board/answer-<id>.json`**
```json
{"id":"gate-1-1","decision":"approve","text":"","source":"board","time":"2026-11-20T10:09:12"}
```
`source` ∈ `board`, `chat`.

**`GET /api/state?run=<folder>` response**
```json
{"run":"2026-11-20-how-volcanoes-work","topic":"How volcanoes work",
 "step":"story","state":"waiting_owner","round":1,
 "team":{...team.json...},
 "agents":{"story":{"where":"review-door","activity":"waiting"},"voice":{"where":"kitchen","activity":"idle"},...},
 "track":[{"step":"story","status":"done"},{"step":"owner","status":"active"},...],
 "request":{...request.json...}|null, "answered":{...answer...}|null,
 "summary":{"scenes":6,"words":312,"est_seconds":124.8,"gate":"PASS","round":1}|null,
 "voice":{"voice":"am_adam","speed":1.0,"total_s":121.4,"scenes":[{"id":1,"path":"02-voice/scene-01.wav"}]}|null,
 "events":[{"time":"10:07","agent":"reviewer","text":"Sage stamped PASS (gate 1, round 1)","kind":"pass"}],
 "video":{"path":"04-video/out/video.mp4","credits":"04-video/credits.md"}|null}
```
`where` ∈ `writers-room`, `booth`, `art-room`, `review-room`, `review-door`, `kitchen`. `activity` ∈ `working`, `carrying`, `reviewing`, `fixing`, `waiting`, `idle`, `celebrating`, `alarm`. `kind` ∈ `start`, `handoff`, `pass`, `fix`, `owner`, `done`, `info`.

---

### Task 1: Request/answer files and the background waiter

**Files:**
- Create: `tools/dashboard/__init__.py`, `tools/dashboard/answers.py`, `tools/dashboard/wait.py`
- Test: `tests/dashboard/test_answers.py`, `tests/dashboard/test_wait.py`

**Interfaces:**
- Produces:
  - `CHECKPOINTS` (set of the six ids' prefixes), `DECISIONS` (set above), `class AnswerError(Exception)`.
  - `next_request_id(run_dir: Path, checkpoint: str) -> str`
  - `write_request(run_dir: Path, checkpoint: str, title: str, body: str, options: list[str], links: list[dict] | None = None) -> dict` — validates checkpoint and options ⊆ DECISIONS, writes `board/request.json` atomically, returns it.
  - `read_request(run_dir: Path) -> dict | None`
  - `write_answer(run_dir: Path, request_id: str, decision: str, text: str = "", source: str = "board") -> dict` — refuses (AnswerError "already answered") if `answer-<id>.json` exists; refuses unknown id (≠ current request id) and decisions not in the request's options; creates the file with `open(..., "x")` so concurrent writers can't both succeed.
  - `read_answer(run_dir: Path, request_id: str) -> dict | None`
  - CLI `python -m tools.dashboard.answers request <run> --checkpoint … --title … --body … --options approve,changes [--link "Label=path"]…` prints the id; `… write <run> --id … --decision … [--text …] [--source chat]`; `… show <run>`. Exit 1 with `error: …` on AnswerError.
  - `wait_for_answer(run_dir: Path, request_id: str, timeout_s: float = 7200, poll_s: float = 1.0) -> dict | None`
  - CLI `python -m tools.dashboard.wait <run> --id <id> [--timeout 7200]` prints the answer JSON and exits 0, or prints `timeout` and exits 3.
- All JSON written UTF-8, `ensure_ascii=False`, atomic (tmp + `os.replace`) except the once-only `open("x")` answer write.

- [ ] **Step 1: Failing tests**: `test_request_ids_increment` (two gate-1 requests → `gate-1-1`, `gate-1-2`); `test_first_answer_wins` (second write → AnswerError matching "already answered"); `test_answer_must_match_open_request`; `test_decision_must_be_an_option` (`cancel` for a gate-1 request → AnswerError); `test_unicode_round_trip` (text `"Café 🌋 “quoted”"` read back identical); `test_waiter_returns_answer` (thread writes the answer after 0.3 s; `wait_for_answer(..., poll_s=0.05)` returns it); `test_waiter_times_out` (`timeout_s=0.2` → None); `test_cli_write_then_show`.
- [ ] **Step 2: Run** `.venv/bin/pytest tests/dashboard -q` → FAIL.
- [ ] **Step 3: Implement** `answers.py` and `wait.py`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: dashboard request/answer files and background waiter`

---

### Task 2: Team names and run-state aggregation

**Files:**
- Create: `team.json`, `tools/dashboard/state.py`, fixture run folders `tests/fixtures/runs/{empty,story-working,gate1-reviewing,gate1-fixing,gate1-waiting,gate2-waiting,stuck-gate3,done,stale-request}/`
- Test: `tests/dashboard/test_state.py`

**Interfaces:**
- Consumes: `tools.pipeline.status.load_status`, `tools.pipeline.script.parse_script`, `tools.pipeline.script.word_count`, `estimate_seconds`, `read_request`, `read_answer` (Task 1).
- Produces:
  - `load_team(root: Path) -> dict` — `team.json` merged over the defaults above (missing file or role → default; bad JSON → defaults + no crash).
  - `list_runs(videos_root: Path) -> list[dict]` — `{run, topic, step, state, updated}` newest first; skips folders without `status.json`.
  - `run_state(run_dir: Path, team: dict) -> dict` — the pinned `/api/state` shape. Rules:
    - agent placement: current step's agent `working` → its room (`story`→`writers-room`, `voice`→`booth`, `design`/`animator`→`art-room`); state `reviewing` → step agent `carrying` at `review-room` and reviewer `reviewing`; `fixing` → reviewer `carrying` in the step agent's room, step agent `fixing`; `waiting_owner` → step agent `waiting` at `review-door`; `failed` → reviewer `alarm`; `done` → all `celebrating` for 10 s after the done event, then `idle` in `kitchen`; everyone else `idle` in `kitchen`.
    - `events`: last 30 `progress.log`/history entries turned into friendly text using team names; `kind` from the event text (`started`→start, `PASS`→pass, `FIX`→fix, `waiting for owner`→owner, `done`→done, a step change→handoff).
    - `request` is null unless state ∈ {`waiting_owner`,`failed`} **and** the request has no answer; otherwise `answered` holds the answer if any.
    - `summary` only when `01-script/script.md` parses; `voice` only when `02-voice/manifest.json` exists; `video` only when the MP4 exists.
    - missing/corrupt `status.json` → `{"run", "state": "starting", ...}` with empty lists, never an exception.

- [ ] **Step 1: Failing tests**: one test per fixture asserting `state`, each agent's `where`/`activity`, and `request is None`/not None as the rules above; `test_stale_request_hidden`; `test_corrupt_status_is_starting`; `test_events_use_team_names` (custom team.json with story=Nova → an event text contains "Nova"); `test_team_defaults_when_missing_or_bad`; `test_list_runs_sorted_newest_first`.
- [ ] **Step 2: Run** `.venv/bin/pytest tests/dashboard/test_state.py -q` → FAIL.
- [ ] **Step 3: Create fixtures and implement** `state.py`, `team.json` (exact content above).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: dashboard run-state aggregation and team names`

---

### Task 3: Local server

**Files:**
- Create: `tools/dashboard/server.py`, `tools/dashboard/__main__.py`, `tools/dashboard/static/index.html` (placeholder page that fetches `/api/state` and prints it; real UI in Tasks 4–5)
- Test: `tests/dashboard/test_server.py`

**Interfaces:**
- Consumes: Task 1 (`write_answer`, `AnswerError`), Task 2 (`list_runs`, `run_state`, `load_team`).
- Produces:
  - `make_server(root: Path, port: int = 8765, token: str | None = None) -> ThreadingHTTPServer` bound to `127.0.0.1`; `token` defaults to `secrets.token_urlsafe(24)`; server exposes `.token` and `.url` (`http://127.0.0.1:<port>/?key=<token>`).
  - Routes: `GET /` and `/static/*` (from `tools/dashboard/static/`), `GET /api/runs`, `GET /api/state?run=`, `GET /files/<run>/<rel path>` (only regular files inside `videos/<run>/`; correct Content-Type for `.md`, `.wav`, `.mp4`, `.json`; supports HTTP Range for audio/video), `POST /api/answer` with JSON `{"run","id","decision","text"}` and header `X-Studio-Key: <token>` → 200 `{ok:true, answer}`; 409 `{error:"already answered"}`; 400 bad input; 403 bad/missing key.
  - Every request: `Host` header must be `127.0.0.1:<port>`, `localhost:<port>` (or without port) → else 403. Responses `Cache-Control: no-store`.
  - `python -m tools.dashboard [--port 8765] [--no-browser]`: if the port is busy, try the next 10 ports; print the URL; open it with `webbrowser.open` unless `--no-browser`; Ctrl+C stops cleanly.

- [ ] **Step 1: Failing tests** (start the server on port 0 in a thread against a tmp project with fixture runs): `test_state_endpoint`; `test_answer_requires_key` (403 without/with wrong key); `test_answer_once` (200 then 409); `test_bad_host_rejected` (Host `evil.example` → 403); `test_path_traversal_refused` (`/files/<run>/../../team.json`, `%2e%2e%2f`, absolute → 403); `test_serves_wav_with_range` (206 for `Range: bytes=0-99`); `test_binds_localhost_only` (`server.server_address[0] == "127.0.0.1"`).
- [ ] **Step 2: Run** `.venv/bin/pytest tests/dashboard/test_server.py -q` → FAIL.
- [ ] **Step 3: Implement** `server.py`, `__main__.py`, placeholder `index.html`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: local dashboard server with key, host and path checks`

---

### Task 4: The answer board (right panel)

**Files:**
- Modify: `tools/dashboard/static/index.html`
- Create: `tools/dashboard/static/board.js`, `tools/dashboard/static/palette.js`
- Test: `tests/dashboard/test_browser.py` (slow, Playwright)

**Interfaces:**
- Consumes: `/api/runs`, `/api/state`, `/api/answer`, `/files/...` (Task 3); key from the page URL `?key=`.
- Produces: page layout — left `<canvas id="studio">` (≈70% width, filled in Task 5) and right `<aside id="board">` (≈30%). `board.js` exports `renderBoard(state)` and polls `/api/state` every 1.5 s (pauses while the tab is hidden).
- Board content per spec §5.3: header (run picker when >1 run, topic), progress track (Story, You, Voice, You, Design, Animate, 🎬 with done/active/pending), **⚑ WAITING FOR YOU** block with title/body/links, checkpoint-specific extras (gate-1: summary + first two narration lines; gate-2: a ▶ button per scene playing `/files/<run>/<wav>`; stuck gate: open must-fix lines from the last review file; final: link to video + credits), buttons for exactly the request's `options` (labels: Approve, Request changes, Accept anyway, Give directions, Cancel, Send answer), a text box (required for `changes`, `directions`, `answer`), **Copy reply** (copies `approve` or the typed text), after sending: "Sent ✓ — <Name> is on it" and controls locked; `answered` with source `chat` → "Answered in chat". Activity list = last 8 events. Idle state text: "No video running. Start one with /make-video in Claude Code." Chime (WebAudio beep, no files) + `Notification` when a new request id appears; toggle stored in `localStorage`.
- All text sizes ≥ 18 px body at 1920×1080; pixel look via CSS (hard borders, offset shadows), system monospace font only.

- [ ] **Step 1: Failing test** `test_board_approve_flow` (`@pytest.mark.slow`): start server on a tmp copy of the `gate1-waiting` fixture, open `url` in Chromium, assert "WAITING FOR YOU" and "Approve" visible, click Approve, assert "Sent ✓" visible and `answer-<id>.json` exists with decision `approve`; `test_board_requires_text_for_changes`; `test_board_stale_request_hidden` (stale fixture → no Approve button); `test_board_idle_message`.
- [ ] **Step 2: Run** `.venv/bin/pytest tests/dashboard/test_browser.py -q -m slow` → FAIL.
- [ ] **Step 3: Implement** the board.
- [ ] **Step 4: Run** → PASS; save screenshots of each fixture state to `docs/dashboard/board-<state>.png` and LOOK at them: text readable, nothing clipped at 1920×1080 and 1366×768.
- [ ] **Step 5: Commit** `feat: dashboard answer board`

---

### Task 5: The pixel studio map

**Files:**
- Create: `tools/dashboard/static/studio.js`, `tools/dashboard/static/sprites.js`
- Modify: `tools/dashboard/static/palette.js`, `tools/dashboard/static/index.html`
- Test: extend `tests/dashboard/test_browser.py` (slow); `tests/dashboard/test_sprites.mjs` is not needed — JS is checked by screenshots

**Interfaces:**
- Consumes: `state.agents`, `state.events`, `state.team`, presenter outfit from `<run>/03-design/style.json` if present (`presenterOutfit`, default `blazer`) via `state` — add `"presenterOutfit"` to `run_state` output in this task (test it in `test_state.py`).
- Produces: `startStudio(canvas, getState)` — draws at an internal 332×270 buffer scaled by an integer factor with `imageSmoothingEnabled = false`; rooms per spec §5 (Writers' Room, Recording Booth, Kitchen, Art & Animation, Review Room) with doors; furniture; the five characters with name tags; 4-frame animations per `activity` (working per role as spec §5.1 table, `carrying` walks along door paths holding a paper, `reviewing` magnifier, `fixing`, `waiting` with "!" bubble, `idle` sipping coffee, `celebrating` jump, `alarm` red flag); hand-off walks triggered by new `handoff`/`pass`/`fix` events; presenter "STAR" poster in the Review Room in the run's outfit (curly hair, glasses, light tan skin `#E3B28A`).
- Art rules (Codixel, MIT — read `SKILL.md` and `core/` of the Codixel skill: https://github.com/mankidev/codixel, install with `git clone https://github.com/mankidev/codixel ~/.claude/skills/codixel`): per-material palettes with hue-shifted ramps (3–4 tones), outlines from the sprite's darkest ramp colour with a 1-px rim light on the lit (top-left) side, dither only on the boundary between two bands, characters ~12×16 px.

- [ ] **Step 1: Failing test** `test_studio_draws_agents` (slow): for each fixture state, load the page, wait 1 s, assert the canvas is not blank (pixel variance) and that `window.__studioDebug()` (exported by `studio.js`) reports each agent's `where`/`activity` equal to the API's.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** map, sprites, animations.
- [ ] **Step 4: Run** → PASS. Visual QA (mandatory, Codixel's "check every step"): screenshot every fixture state and three frames of each animation into `docs/dashboard/`; LOOK at each sprite at 4× zoom and at full page; fix what looks amateur (muddy colours, unreadable faces, floating furniture, characters clipping walls). Iterate at least twice.
- [ ] **Step 5: Commit** `feat: pixel studio map with animated agents`

---

### Task 6: Pipeline integration (`/make-video`, `/video-status`, names)

**Files:**
- Modify: `.claude/commands/make-video.md`, `.claude/commands/video-status.md`, `tools/pipeline/status.py` (`format_status` uses team names), `tests/agents/test_orchestrator_file.py`, `tests/pipeline/test_status.py`

**Interfaces:**
- Consumes: Task 1 CLIs; `load_team` (Task 2).
- Produces, in `make-video.md`:
  - Progress lines use names: `▶ [n/4] Quill (Story) is working…`, `🔍 Sage is checking the script (round r/3)…` (names read once per run from `team.json` via `python -m tools.dashboard.answers team`, a new tiny subcommand printing the team JSON — add it in this task with a test).
  - At every owner checkpoint (gate-1, gate-1-changed-lines, gate-2, stuck-gate-n, final, question): (1) `python -m tools.dashboard.answers request "<run_dir>" --checkpoint … --title … --body … --options …` → id; (2) print the request in chat as today plus "…or answer on the studio board"; (3) start `python -m tools.dashboard.wait "<run_dir>" --id <id>` with `run_in_background: true`, and end the turn; (4) when woken by the waiter: use its JSON as the owner's answer; when the owner replies in chat first: run `answers write … --source chat` (if that says "already answered", use the board's answer instead and tell the owner), stop the waiter. Then convert to the existing `review/owner-gate-<n>-<k>.md` and continue as today. Waiter exit 3 (timeout) → re-arm once and remind the owner.
  - After gate 4 PASS: open a `final` request (options `approve`,`changes`); approve → `status update … --event "owner approved final video"`, done; changes → existing sound path.
  - `--resume`: if `board/request.json` exists without an answer and status is `waiting_owner`/`failed`, re-arm the waiter for the same id.
- `video-status.md` and `format_status` show names.

- [ ] **Step 1: Failing tests**: orchestrator file mentions `tools.dashboard.answers request`, `tools.dashboard.wait`, `run_in_background`, `--source chat`, every checkpoint id, `final`; every `answers` command line in the file parses with the real argparse (same approach as the existing status-update test); `format_status` shows "Quill" for the story step with the default team; `answers team` prints valid JSON with 5 roles.
- [ ] **Step 2: Run** `.venv/bin/pytest tests/agents tests/pipeline tests/dashboard -q -m "not slow"` → FAIL.
- [ ] **Step 3: Implement** the edits.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: make-video talks to the studio board`

---

### Task 7: Wake-up proof, docs and owner checklist

**Files:**
- Modify: `docs/SETUP.md`, `docs/TEST-CHECKLIST.md`, `README.md`
- Create: `docs/dashboard/README.md` (what the studio shows, how to rename the team, screenshots)

**Interfaces:**
- Consumes: everything above.
- Produces: SETUP/README: "Open the studio: in a second terminal (venv active) run `python -m tools.dashboard`; keep it open while making videos." TEST-CHECKLIST additions: (1) start the studio, check it shows "No video running"; (2) run a short `/make-video`, answer **gate 1 on the board**, confirm Claude Code continues by itself within a few seconds (this is the Windows proof of the background wake-up); (3) answer **gate 2 in the chat**, confirm the board shows "Answered in chat"; (4) rename one agent in `team.json`, refresh, see the new name.

- [ ] **Step 1 (controller, not a subagent): Wake-up proof here**: in the main Claude Code session, start `python -m tools.dashboard.wait <tmp run> --id gate-1-1` with `run_in_background: true`, then write the answer with the `answers write` CLI from a separate command, and confirm this session is notified when the waiter exits. Record the result (and exact notification) in the task report. If it does not wake, STOP and report BLOCKED (spec §12.1 fallback decision is the owner's).
- [ ] **Step 2: Write the docs** above with screenshots from Tasks 4–5.
- [ ] **Step 3: Run** the full fast suite and the slow browser tests; all PASS.
- [ ] **Step 4: Commit** `docs: studio dashboard setup and owner checklist`
