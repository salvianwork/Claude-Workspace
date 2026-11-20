# Studio Dashboard — Design

**Date:** 2026-11-20
**Status:** Waiting for owner approval
**Builds on:** `2026-11-19-video-agent-team-design.md` (the video pipeline)
**Runs on:** the owner's Windows PC, in `C:\Users\PC\Documents\Claude Workspace`

---

## 1. Intent and why

While `/make-video` runs, the owner wants to **see** the team working, not
read a terminal: a live **pixel-art animation studio**, viewed from the top
like the owner's reference picture, where each agent works in its own room
and visibly hands work to the next. A **large board** shows, in big readable
text, anything that needs the owner, and the owner can **answer right there**
(approve, request changes, accept or cancel), without going back to the
terminal.

## 2. Goals, non-goals, anti-goals

**Goals**
- A browser page that shows the current video run as a top-down pixel studio,
  updated live (within ~2 s) from the run's files.
- The five agents, by name, each with a room, a look and working animations.
- Collaboration made visible: work being carried between rooms, reviews
  stamped PASS / FIX, idle agents in the kitchen.
- A large, readable **answer board** for every owner checkpoint, with buttons
  and a text box; the answer reaches the pipeline, which continues.
- Owner-editable agent names in one settings file.

**Non-goals (this version)**
- Starting a new video from the dashboard (still `/make-video` in Claude Code).
- Watching the final video inside the dashboard (a link opens the file).
- Use from another computer or a phone (local only; see §7).
- Pixel-perfect match with the owner's reference picture (it comes from a
  commercial asset pack; see §6).

**Anti-goals (a failure even if it "works")**
- An answer from the board that the pipeline misses, or applies twice.
- Any other website or program being able to send approvals.
- The dashboard slowing down or breaking a video run (it must be optional:
  the pipeline works exactly as before when the dashboard is not running).
- Text on the board too small to read comfortably.

## 3. Constraints

- Windows PC, Python 3.12 venv already used by the pipeline; **no new
  packages** for the server (Python standard library only).
- The pipeline's files are the single source of truth: `status.json`,
  `progress.log`, `review/*.md`, `01-script/script.md`,
  `02-voice/manifest.json` and wavs, `04-video/out/video.mp4`
  (formats pinned in the pipeline plan).
- All art drawn in code (no downloaded or copied images), following the
  **Codixel** skill's pixel-art rules (MIT licence). Optional later: a CC0
  asset pack as a reference (§6).
- Owner's private data never leaves the PC.

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Python standard-library server + one canvas page that checks for changes every ~1.5 s** | No installs; fits the Python tools; easy to test; updates not truly instant (unnoticeable) | **Chosen by the owner** |
| B. Node server with live push (websockets) | Instant updates; extra packages and a second server technology to break on Windows | Rejected |
| C. Hosted online page | Can't read the PC's files or answer the pipeline | Ruled out |

Earlier layout choice: owner preferred a **top-down office** (their reference
picture) over a side-view row of desks.

## 5. What the owner sees

```
┌──────────────────────── map (≈70% width) ───────────────────┬── board (≈30%) ──┐
│ WRITERS' ROOM (Quill) │ RECORDING BOOTH (Echo) │ KITCHEN    │ run name          │
│                       │                        │ (idle      │ progress track    │
│                       │                        │  agents)   │ ⚑ WAITING FOR YOU │
├───────────────────────┼────────────────────────┴────────────┤ request text      │
│ ART & ANIMATION       │ REVIEW ROOM (Sage)                  │ preview           │
│ (Iris, Flip)          │ presenter "STAR" poster             │ [APPROVE][CHANGES]│
│                       │                                     │ [COPY] text box   │
│                       │                                     │ activity log      │
└───────────────────────┴─────────────────────────────────────┴───────────────────┘
```

- Rooms: Writers' Room (Quill), Recording Booth (Echo), Art & Animation
  (Iris and Flip), Review Room (Sage, with the presenter poster as the
  studio's "STAR"), Kitchen (where idle agents wait).
- The board is a side panel, not a picture inside the map, so its text stays
  large (body text ≥ 18 px at 1920×1080; it scales with the window).
- A run picker (top of the board) when there is more than one run; default
  is the most recently updated run.

### 5.1 The team (display names; owner can rename)

`team.json` at the project root:

| Role (internal, fixed) | Name | Look | Working animation |
|---|---|---|---|
| story | **Quill** | round glasses, cardigan, coffee mug | typing; crumpled paper balls into the bin on rewrites |
| voice | **Echo** | big headphones, hoodie | talking into a studio mic; "ON AIR" light glows |
| design | **Iris** | beret, paint palette | sketching at an easel; colour swatches pop up |
| animator | **Flip** | backwards cap, drawing tablet | flipbook frames flicker; render bar fills |
| reviewer | **Sage** | older, grey beard, clipboard | reading with a magnifier; stamps PASS / FIX |

Names are display-only: the agent files keep their internal role names, so a
rename can never break the pipeline. Names appear on the map, on the board,
in `/make-video` progress lines and in `/video-status`.

### 5.2 What each pipeline state looks like

| Pipeline state (from `status.json` + `progress.log`) | On the map | On the board |
|---|---|---|
| a step agent `working` | that agent at their desk, working animation; others idle in the kitchen | track shows the step; "Echo is recording scene 3…" if known |
| `reviewing` (gate n, round r) | the agent walks the file to the Review Room; Sage reads with the magnifier | "Sage is checking the script (round r/3)" |
| `fixing` | Sage walks a red FIX note back to the agent; the agent works again | the must-fix items, read-only |
| gate PASS | green PASS stamp animation | "Gate n passed" |
| `waiting_owner` (script / voice / final) | the agent stands by the Review Room door; a gentle "!" above the board side | **⚑ WAITING FOR YOU** with the request, preview and answer controls (§5.3) |
| `failed` (gate stuck after 3 rounds) | Sage holds a red flag | the open must-fix items + Accept / Give directions / Cancel |
| `done` | everyone celebrates for a few seconds, then the kitchen | "🎬 Done" + link to the video and `credits.md` |
| no run / dashboard idle | everyone in the kitchen | "No video running. Start one with /make-video in Claude Code." |

Hand-offs are animated from `progress.log` transitions (e.g. Story → gate 1
review) so the owner sees work move between rooms.

### 5.3 The answer board

| Checkpoint | Shown | Buttons |
|---|---|---|
| Gate 1 script | gate result, scene/word/length summary, first lines of the script, links to the full script and Sage's review | Approve · Request changes (+ text) |
| Gate 2 voice | voice, speed, total length, a ▶ play button per scene | Approve · Request changes (+ text) |
| Stuck gate (round 3 failed) | the open must-fix items | Accept anyway · Give directions (+ text) · Cancel |
| Final video | link to the MP4, credits | Approve (done) · Change the sound (+ text) |

- **Copy reply** copies what was typed, to paste into Claude Code instead.
- After pressing a button the board shows "Sent ✓ — Quill is on it" and locks
  until the pipeline picks the answer up.
- An optional soft chime and a browser notification when the board starts
  waiting for the owner (on by default, toggle on the board).

## 6. Art method

- Top-down view at a low internal resolution (about 330×270 for the map),
  scaled up with crisp pixels.
- Everything drawn in code following Codixel's rules: limited palettes with
  hue shifting, outlines taken from the sprite's colours with rim light on the
  lit side, dithering only where two colour bands meet, readable mini
  characters from few pixels, simple "bones" (head, arms) so poses animate.
- Characters walk between rooms along fixed paths through the doors.
- The presenter appears as a small framed poster in the Review Room, in the
  current video's outfit.
- **Honest limit:** code-drawn art will be clearly better than the first
  mockup but simpler than the owner's reference (a commercial pack). Option
  for later: the owner downloads a **CC0** pixel pack (e.g. Kenney's indoor
  tiles) and the builder uses it as the reference.

## 7. How it works

```
 /make-video (Claude Code)                 python -m tools.dashboard  (local server)
   │ writes status.json, progress.log  ───────►  reads the run folder every ~1.5 s
   │ writes board/request.json at a checkpoint ─► board shows the request
   │ starts a background "wait" ◄── board/answer.json ◄── owner clicks Approve
   ▼ continues with the answer
```

- **Server:** `python -m tools.dashboard [--port 8765]` serves the page and a
  small JSON API on `127.0.0.1` only, prints the URL and opens the browser.
  - `GET /api/runs` — runs with step, state, last update.
  - `GET /api/state?run=<folder>` — status, last ~30 progress lines, the open
    request (if any), team names, summary numbers, links.
  - `GET /files/<run>/<path>` — serves the run's script, review files, wavs and
    the MP4 for the board's links and play buttons (only inside `videos/`).
  - `POST /api/answer` — writes the owner's answer (below).
- **Security:**
  - listens on 127.0.0.1 only;
  - a random secret key is created at start and put in the opened URL; every
    POST must carry it, so no other website can send approvals;
  - the `Host` header must be `127.0.0.1` or `localhost` (blocks DNS-rebinding
    tricks);
  - file serving refuses any path outside `videos/<run>/`.
- **Checkpoint request:** at each owner checkpoint the orchestrator writes
  `<run>/board/request.json` — `{"id", "checkpoint": "gate-1"|"gate-2"|
  "stuck-gate-<n>"|"final", "title", "body", "options": [...], "created"}` —
  in addition to what it already prints in the chat.
- **Answer:** the server writes `<run>/board/answer-<id>.json` —
  `{"id", "decision": "approve"|"changes"|"accept"|"directions"|"cancel",
  "text", "time"}` — once (a second answer for the same id is refused).
- **Pipeline side:** the orchestrator starts
  `python -m tools.dashboard.wait <run> --id <id>` **in the background** and
  ends its turn. Two ways the answer arrives:
  1. from the board: the waiter sees the answer file, exits, and Claude Code
     is woken with it;
  2. from the chat: the owner types as before; the orchestrator writes the
     same answer file itself (marking the request answered) and stops the
     waiter.
  Either way the answer becomes the usual `review/owner-gate-<n>-<k>.md` file
  and the pipeline continues exactly as it does today.
- **Dashboard optional:** if the server isn't running, nothing changes — the
  request file is just unused and the owner answers in the chat.

## 8. File layout

```
team.json                         display names + look hints (owner-editable)
tools/dashboard/
  __init__.py  __main__.py        `python -m tools.dashboard`
  server.py                       http.server: routes, token + Host checks
  state.py                        reads a run folder into the board's JSON (pure, tested)
  answers.py                      request/answer files, once-only writes (tested)
  wait.py                         `python -m tools.dashboard.wait` (background waiter)
  static/index.html  board.js  studio.js  sprites.js  palette.js
videos/<run>/board/request.json, answer-<id>.json   (created per run)
```

Changes to existing files: `.claude/commands/make-video.md` (write the
request file, start the background waiter, accept either source, use names
from `team.json` in progress lines), `.claude/commands/video-status.md`
(names), `docs/SETUP.md` and `docs/TEST-CHECKLIST.md` (how to open the
dashboard), and the permission allow-list for `python -m tools.dashboard*`
(already covered by `python -m tools.*`).

## 9. Testing

- Python unit tests: state aggregation for every pipeline state, request/
  answer once-only writes, token and Host checks, path checks, the waiter.
- A browser smoke test (Playwright, slow): open the page against fixture run
  folders in each state, screenshot, press Approve, confirm the answer file.
- Visual QA by eye (Codixel's "check every step"): screenshots of every state;
  sprites reviewed one by one.
- Owner tests on Windows: start the server, run a short `/make-video`, answer
  gate 1 from the board and gate 2 from the chat.

## 10. Left to the builder

- Exact sprite designs, palettes and walking paths (within §5–6).
- Port number default and fallback when it's in use.
- Polling interval (1–2 s) and animation timings.
- How the "Echo is recording scene 3…" detail is detected (only if it can be
  read reliably from existing files; otherwise omit).

## 11. Risks

| Risk | Mitigation |
|---|---|
| Owner answers in both places at once | Once-only answer file per request id; the second is refused and the board says it was already answered |
| Background waiter not waking Claude Code on Windows | Chat answer always works; owner test on Windows; waiter timeout re-armed by the orchestrator |
| Art looks amateur | Codixel rules, sprite-by-sprite visual QA, owner sees screenshots before merge; CC0 reference pack as an upgrade path |
| Another site sending approvals | Localhost only + secret key + Host check |
| Board text too small on small screens | Side panel scales with the window; minimum font sizes |

## 12. Decisions from the builder check (my calls unless noted)

1. **Prove the wake-up first.** The whole "answer from the board" idea rests
   on Claude Code being woken when a background command finishes. The first
   build task is a small spike that proves it (here, and on the owner's PC in
   the test checklist). If it fails on Windows, the board keeps working as a
   live view with **Copy reply**, and answers go through the chat.
2. **Final checkpoint.** After gate 4 passes, the orchestrator opens a
   `final` request. **Approve** records "owner approved final video" and
   closes the run; **Change the sound** follows the existing sound-feedback
   path (design → animator → gate 4).
3. **All checkpoints get an id.** `gate-1`, `gate-1-changed-lines` (re-approval
   of changed script lines), `gate-2`, `stuck-gate-<n>` (Accept / Give
   directions / Cancel, the same for every gate), `final`, and `question`
   (any clarifying question from the orchestrator; free-text answer).
4. **Source of truth.** Agent positions come from `status.json` /
   `progress.log`; the open checkpoint comes from `board/request.json`. A
   request is shown only while `status.json` says `waiting_owner` or
   `failed`; otherwise it is treated as stale and hidden.
5. **Chat answers.** `python -m tools.dashboard.answers write <run> --id …
   --decision … --text …` lets the orchestrator record a chat answer in the
   same file (covered by the existing `python -m tools.*` permission). The
   board then shows "Answered in chat". Any second answer is refused.
6. **Resume and timeouts.** The waiter runs in the background for up to
   2 hours; if it times out, the orchestrator re-arms it once and reminds the
   owner. `/make-video --resume` re-arms the waiter for an open request with
   the same id.
7. **Per-scene detail** ("Echo is recording scene 3…") is left out of v1;
   the board shows the step-level status only.

## 13. Open questions

- None. Ready for owner approval.
