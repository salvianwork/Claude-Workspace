# HyperFrames Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Remotion template visuals with HyperFrames videos built from a shared kit, word-timed shot lists and 2–4 custom "hero" scenes per video, while the rest of the pipeline stays unchanged.

**Architecture:** A versioned `hf-kit/` (HyperFrames + vendored GSAP/fonts) provides the presenter, scene shell, camera/cue/caption helpers, kit scene types and a prop library. Echo writes `words.json`; Iris writes `shots.json`; `python -m tools.hf.build` turns them into one HyperFrames composition in `04-video/hf/` (Flip adds hero-scene modules); `python -m tools.hf.render` renders a silent MP4 that the existing mix/mux step finishes. Remotion stays as a selectable fallback.

**Tech Stack:** HyperFrames 0.9.72 (pinned, Apache-2.0), GSAP (vendored), HTML/SVG/JS, `node --test` for kit unit tests, Python 3.12 tools + pytest, Node Playwright (preinstalled) for snapshots, Kokoro for word timings.

**Spec:** `docs/superpowers/specs/2026-11-21-hyperframes-switch-design.md` (pipeline: `2026-11-19-video-agent-team-design.md`; spike evidence: `/tmp/claude-0/-home-user-Claude-Workspace/cb57df6d-07e8-58a8-9c94-69c13e20fc00/scratchpad/spike-hf/` — `REPORT.md`, `hf/index.html`, `scripts/ts.py`)

## Global Constraints

- 1920×1080, 30 fps; captions on; presenter rules from pipeline spec §6.6 (positions, sizes, never over content/captions).
- **Offline at render time:** no `http(s)://` resource in any compiled composition; GSAP and fonts vendored in `hf-kit/vendor/`; env `HYPERFRAMES_NO_TELEMETRY=1` on every HyperFrames call; never send usage beacons.
- No HyperFrames Pro / HeyGen paid features; no downloaded images.
- Lemo-Opuscar text is never copied into the repo.
- Scene lengths = voice manifest durations (frames = ceil(duration_s × 30)); transitions stay inside scene time.
- Each video: **2–4 hero scenes** (custom drawing), all others kit scenes; every hero drawing is saved as a prop in `hf-kit/props/<name>/` (`prop.js`, `preview.png`, `README.md` one line).
- Labels/cues land within **±0.3 s** of their word; camera speed/zoom limited by the kit (calm motion).
- Windows: paths with spaces, list-arg subprocess, `npx` via `shutil.which`.
- Remotion stays selectable (`--engine remotion`) until the owner approves 3 HyperFrames videos; default engine is `hyperframes`.

## Review Focus

1. **A cue word that isn't in the narration** (typo, changed script): build must fail with the scene and word named, not render a label at 0 s — test in Task 6.
2. **Word repeated in a scene** ("magma … magma"): cues by word index pick the right occurrence — test in Task 2.
3. **Network unavailable during render**: render still succeeds and compiled HTML has no remote URLs — test in Task 1.
4. **Hero scene module throws at runtime** (bug in Flip's drawing): `hyperframes check` / build reports the scene id clearly and render stops — test in Task 6.
5. **Script with numbers/symbols** ("1,000 °C"): words.json keeps the script's text tokens so captions show "1,000 °C", not "one thousand" — test in Task 2.

---

## File Structure

```
hf-kit/
  package.json            pinned hyperframes, scripts: test, sample, sheet
  vendor/gsap.min.js  vendor/fonts/*.woff2  vendor/LICENSES.md
  src/kit.js              entry: exports below
  src/timing.js           camera keyframes, cues, captions maths (pure)
  src/shell.js            scene shell: layout boxes, caption bar, presenter slot
  src/presenter/*.js      SVG presenter (parts, poses, expressions, outfits, mouth)
  src/scenes/*.js         kit scene types: title, steps, compare, chart, kinetic, recap, diagram
  src/draw.js             illustration helpers (gradients, outline, shade, particles)
  props/<name>/prop.js preview.png README.md      prop library (starts with volcano)
  sample/index.html       sample composition (Windows smoke test)
  test/*.test.js          node --test unit tests
tools/hf/__init__.py  shots.py  build.py  render.py  snapshot.py
tools/voice/words.py
tests/hf/  tests/voice/test_words.py
```

### Pinned formats

**`02-voice/words.json`**
```json
{"source":"kokoro","scenes":[{"id":1,"words":[{"i":0,"text":"Deep","start":0.12,"end":0.38},{"i":1,"text":"under","start":0.40,"end":0.61}]}]}
```
Times are seconds from the start of that scene's wav. `text` = the script token as written (punctuation stripped from the ends). `source` ∈ `kokoro`, `whisper`.

**`03-design/shots.json`**
```json
{"scenes":[
 {"id":1,"kind":"hero","prop":"volcano","new_prop":false,
  "brief":"Cut-away volcano: chamber under the cone, vent to crater…","facts":["magma chamber lies beneath the volcano"],
  "camera":[{"at":{"word":0},"frame":"wide"},{"at":{"word":5},"frame":{"focus":"chamber","zoom":1.8}},{"at":{"word":14},"frame":{"follow":"magma-tip"}}],
  "cues":[{"at":{"word":5},"show":"label","target":"chamber","text":"Magma chamber"}],
  "presenter":{"pose":"point-left","expression":"curious","position":"right","size":"small"},
  "transition":"fade"},
 {"id":2,"kind":"kit","scene":"steps","props":{"title":"How an eruption builds","steps":["Pressure","Rise","Burst"]},
  "camera":[],"cues":[{"at":{"word":3},"show":"step","index":0}],
  "presenter":{"pose":"talk","expression":"happy","position":"left","size":"small"},"transition":"slide"}]}
```
`kind` ∈ `hero`, `kit`. Kit `scene` ∈ `title`, `steps`, `compare`, `chart`, `kinetic`, `recap`, `diagram`. `at.word` = word index `i` in that scene. `frame` = `"wide"` or `{focus, zoom}` or `{follow}` where focus/follow name an anchor exported by the prop/scene. Hero count per video: 2–4.

---

### Task 1: Kit foundation, offline vendoring and render wrapper

**Files:** Create `hf-kit/package.json`, `hf-kit/vendor/*`, `hf-kit/src/kit.js`, `hf-kit/sample/index.html`, `tools/hf/__init__.py`, `tools/hf/render.py`; Test `tests/hf/test_render.py`.

**Interfaces:**
- Produces: `render(composition_dir: Path, out_mp4: Path, *, workers: int = 1) -> dict` (runs `npx hyperframes check --json` then `npx hyperframes render`, env `HYPERFRAMES_NO_TELEMETRY=1`, cwd = composition dir; returns `{"check": {...}, "seconds": float}`; raises `HFError` with the check errors when `errors > 0`); `assert_offline(composition_dir: Path) -> list[str]` (remote URLs found in HTML/JS/CSS after compile); CLI `python -m tools.hf.render <composition_dir> <out.mp4>`; npm scripts `sample` (renders `sample/` to `sample/out.mp4`) and `test` (`node --test test/`).

- [ ] **Step 1: Failing tests**: `test_sample_renders_offline` (slow: render `hf-kit/sample` → MP4 exists, 1920×1080, 30 fps by ffprobe; `assert_offline` returns []); `test_check_errors_raise` (a broken tmp composition → HFError mentioning the error); `test_telemetry_env_set` (monkeypatch subprocess.run → env has `HYPERFRAMES_NO_TELEMETRY=1`).
- [ ] **Step 2: Run** `.venv/bin/pytest tests/hf -q -m "not slow"` and `-m slow` → FAIL.
- [ ] **Step 3: Implement**: pin `hyperframes@0.9.72`; vendor GSAP (record its licence) and the kit fonts (Inter, Poppins — OFL) in `vendor/` with `LICENSES.md`; sample composition = 3 s: shell + text + a GSAP tween, referencing only vendored files; the wrapper above. Pre-cache any fonts the compiler wants so a render with `HTTPS_PROXY=http://127.0.0.1:9` succeeds (add that as the slow offline test).
- [ ] **Step 4: Run** → PASS (record render time in the commit message body).
- [ ] **Step 5: Commit** `feat: hf-kit foundation with offline vendoring and render wrapper`

---

### Task 2: Word timings from Kokoro

**Files:** Create `tools/voice/words.py`; Modify `tools/voice/engine.py` (add `synth_words`), `tools/voice/synth.py` (write words.json); Test `tests/voice/test_words.py`.

**Interfaces:**
- Consumes: `KokoroEngine`, `synth_scenes`, `parse_script`.
- Produces: `TTSEngine.synth_words(text, voice, speed) -> tuple[np.ndarray, list[dict]]` (Kokoro: from result tokens' `start_ts`/`end_ts`, chunk offsets added; FakeEngine in tests: even spacing); `align_to_script(script_text: str, timed: list[dict]) -> list[dict]` (maps engine tokens back to the script's own tokens so `text` is exactly as written, e.g. "1,000"); `write_words(run_dir, scenes: dict[int, list[dict]], source: str) -> Path`; `whisper_words(wav: Path) -> list[dict]` fallback (faster-whisper `word_timestamps=True`) used only when the engine gives no timestamps. `synth_scenes` writes `02-voice/words.json` for the scenes it (re)records and keeps others.

- [ ] **Step 1: Failing tests**: `test_words_json_shape` (pinned format; indices 0..n-1); `test_repeated_word_indices` ("magma rises, magma bursts" → two "magma" with i=0 and i=2 and increasing times); `test_numbers_keep_script_text` (script "Lava is 1,000 °C." → texts `["Lava","is","1,000","°C"]`); `test_only_rerecord_keeps_other_scene_words`; slow `test_kokoro_word_times_real` (real am_adam: every word has start<end, monotonic, last end ≤ wav duration + 0.05).
- [ ] **Step 2: Run** `.venv/bin/pytest tests/voice -q -m "not slow"` (and slow in `.venv-voice`) → FAIL.
- [ ] **Step 3: Implement** (see `scratchpad/spike-hf/scripts/ts.py` for how the spike read Kokoro token times).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: word timings for every scene`

---

### Task 3: Kit timing maths (camera, cues, captions)

**Files:** Create `hf-kit/src/timing.js`; Test `hf-kit/test/timing.test.js`.

**Interfaces:**
- Produces: `wordTime(words, at) -> seconds` (`at = {word:i}` or `{t:sec}`; throws `Error("scene <id>: no word <i>")`); `cameraAt(keys, t, anchors, limits) -> {x, y, zoom}` (ease-in-out between keyframes; `limits = {maxZoom: 2.5, maxPanPerSec: 0.35 (screen widths/s), maxZoomPerSec: 0.6}` — moves that would exceed limits are slowed by stretching their duration, never by jumping); `cueState(cues, words, t) -> [{target, opacity, progress}]` (fade-in 0.25 s starting at the word's start); `captionPage(words, t, maxWords = 10) -> {words: [...], current: i}`.

- [ ] **Step 1: Failing tests**: cue starts at the word time ±0.01; repeated-word index honoured; missing word throws with scene id; camera never exceeds limits on a pathological keyframe pair (wide → zoom 2.5 in 0.1 s); captions page boundaries.
- [ ] **Step 2: Run** `cd hf-kit && npm test` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: kit timing for camera, cues and captions`

---

### Task 4: Presenter port

**Files:** Create `hf-kit/src/presenter/*.js`, `hf-kit/sample/presenter-sheet.html`; Modify `hf-kit/package.json` (script `sheet`); Test `hf-kit/test/presenter.test.js`, `tests/hf/test_presenter_parity.py` (slow).

**Interfaces:**
- Consumes: look values and pose/expression/outfit lists from `templates/src/presenter/look.ts`, `poses.ts`, `templates/src/schema.ts` (read; same names and colours).
- Produces: `mountPresenter(el, {pose, expression, outfit, size, side, mouth: number[], fps: 30}) -> {update(t)}` drawing SVG; same poses (`idle talk point-left point-right think surprised celebrate wave`), expressions (`neutral happy curious surprised thinking`), outfits (`blazer labcoat`), mouth thresholds (<0.15 closed, <0.4 slight, <0.7 open, else wide), seeded blinks, breathing, 8-frame pose blends.
- Parity: `npm run sheet` renders a character sheet PNG matching the Remotion sheet layout; the slow test renders both sheets and saves them side by side to `docs/hf/presenter-parity.png`.

- [ ] **Step 1: Failing tests**: unit — every pose/expression/outfit renders without throwing and produces an `<svg>` with the expected part ids; mouth shape thresholds; blink schedule deterministic per seed. Slow — parity image produced.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; LOOK at `docs/hf/presenter-parity.png` and iterate until the two read as the same character (shape, colours, glasses, curls, outfits, hands).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: presenter ported to the HyperFrames kit`

---

### Task 5: Scene shell, kit scenes, drawing helpers and the first prop

**Files:** Create `hf-kit/src/shell.js`, `hf-kit/src/scenes/{title,steps,compare,chart,kinetic,recap,diagram}.js`, `hf-kit/src/draw.js`, `hf-kit/props/volcano/{prop.js,preview.png,README.md}`, `hf-kit/props/README.md`, `hf-kit/sample/kit-sheet.html`; Test `hf-kit/test/scenes.test.js`.

**Interfaces:**
- Consumes: Task 3 timing, Task 4 presenter.
- Produces:
  - `shell(el, {presenter, style}) -> {content: Box, presenterBox: Box|null, captionTop}` — same layout rule as today (presenter large 34% / small 22% width, never over content or captions).
  - Each kit scene: `export function mount(root, {props, style, words, cues, camera, duration}) -> {update(t), anchors}`; props schema per scene validated (`validate(props) -> string[]`), with readability limits (≤ 5 bullets/steps, titles ≤ 60 chars).
  - Prop contract: `export const meta = {name, description, anchors: [...], params: {...}}`, `export function mount(root, {params, style}) -> {update(t, cueState), anchors: {name: {x, y}}}` in world coordinates; `props/README.md` lists props with one line each (agents read it).
  - `volcano` prop: port of the spike scene (chamber, vent, eruption, lava flows, cone growth; anchors `chamber`, `vent`, `crater`, `magma-tip`, `lava`), parameterised by timing cues instead of hard-coded seconds.
  - Registry: add only blocks that fit (e.g. a transition, kinetic-text, a chart) via `npx hyperframes add …` **once**, committed into `hf-kit/src/blocks/` with their licence notes.
- `kit-sheet.html` shows every kit scene and the volcano prop at 3 moments for visual QA.

- [ ] **Step 1: Failing tests**: each scene validates props and mounts in a headless DOM (jsdom-free: render via the HyperFrames snapshot or Playwright in a slow test); prop contract check for every folder in `props/`; layout boxes never intersect for all presenter positions/sizes.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; render the kit sheet; LOOK; iterate at least twice (richness, calm motion, readable text ≥ 32 px on screen).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: kit scenes, drawing helpers and volcano prop`

---

### Task 6: shots.json, composition builder and engine switch

**Files:** Create `tools/hf/shots.py`, `tools/hf/build.py`, `tools/hf/snapshot.py`; Modify `tools/render/render.py` (engine selection); Test `tests/hf/test_shots.py`, `tests/hf/test_build.py`.

**Interfaces:**
- Consumes: words.json (Task 2), kit (Tasks 3–5), `mouth.json`-style data (Task 12 of the pipeline plan: `add_mouth_to_scenes` — reuse its envelope function `mouth_envelope` directly), voice manifest, `style.json`, `render(...)` (Task 1).
- Produces:
  - `validate_shots(shots: dict, words: dict, manifest: dict, props_dir: Path) -> list[str]` — schema per pinned format; 2–4 heroes; every `at.word` exists; hero `prop` exists in `hf-kit/props/` or `new_prop: true` with a hero module present; kit `scene` known and its props valid (calls the kit validator via `node`); presenter fields valid.
  - `build(run_dir: Path, kit_dir: Path) -> Path` — writes `04-video/hf/index.html` (+ copies/links kit, vendor, props) as ONE composition: scenes in order, durations from the manifest, transitions inside scene time, captions from words.json, presenter with mouth data; hero modules loaded from `04-video/hf/scenes/scene-<id>.js` when `new_prop: true`, else from the prop library.
  - `snapshot(run_dir, times_per_scene=("start","mid","end")) -> list[Path]` → `04-video/hf/snapshots/scene-<id>-<when>.png`.
  - CLI: `python -m tools.hf.shots validate <run>`, `python -m tools.hf.build <run>`, `python -m tools.hf.snapshot <run>`.
  - `tools/render/render.py`: `--engine hyperframes|remotion` (default `hyperframes`); hyperframes path = build → `render()` → `04-video/out/silent.mp4` → existing mux; remotion path unchanged.
- [ ] **Step 1: Failing tests**: Review Focus 1 (unknown cue word → error naming scene + index); hero count 1 or 5 → error; Review Focus 4 (a hero module that throws → build/check error names `scene-<id>`); end-to-end slow test: fixture run (3 scenes: volcano hero, steps kit, recap kit; FakeEngine voice + words) → `render --engine hyperframes` → video.mp4 duration = manifest total ±0.1 s; remotion engine still renders the old fixture.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: shots validation, HyperFrames composition builder and engine switch`

---

### Task 7: Agents switch to shot lists and hero scenes

**Files:** Modify `.claude/agents/voice.md`, `design.md`, `animator.md`, `reviewer.md`; Test `tests/agents/test_agent_files.py`.

**Interfaces:**
- Consumes: CLIs from Tasks 1, 2, 6; `hf-kit/props/README.md`; kit scene list and prop contract.
- Produces (agent rules, copied from spec §5 and §12):
  - **voice**: confirm `02-voice/words.json` exists after recording (synth writes it); if `source` is `whisper`, note it.
  - **design**: write `shots.json` + readable `storyboard.md`; pick **2–4 hero scenes** (the moments that carry the explanation); check `hf-kit/props/README.md` first and reuse/adapt a prop before asking for a new one; illustration brief + facts list for each hero; camera keyframes tied to word indices (calm, purposeful); cues on the words; kit scenes for the rest; run `python -m tools.hf.shots validate <run>` until clean.
  - **animator**: for `new_prop` heroes write `04-video/hf/scenes/scene-<id>.js` following the prop contract using `draw.js` helpers; run build → `hyperframes check` must be clean → `python -m tools.hf.snapshot <run>` and LOOK at every snapshot, fix before handing over; then mix + render as before (`--engine hyperframes`); after gate 4 PASS, save each new hero as `hf-kit/props/<name>/` (prop.js, preview.png from a snapshot, README line) and update `props/README.md` (this is the one allowed edit outside the run folder; reviewer checks it).
  - **reviewer**: gate 3 adds — hero count 2–4 and well chosen; illustration facts checked (web for non-obvious); camera calm; every cue word exists (run shots validate). Gate 4 adds — `hyperframes check` clean (from the render log), illustrations match briefs, labels on their words ±0.3 s (compare snapshot times with words.json), no dizzying motion; after PASS the new prop folders are complete.
- [ ] **Step 1: Failing tests**: each agent file contains its new commands and rules (`tools.hf.shots validate`, `tools.hf.snapshot`, `hyperframes check`, `2–4`, `props/README.md`, `words.json`, `±0.3`); old "must NOT create custom components" rule removed from animator.md; existing tests updated, none weakened.
- [ ] **Step 2: Run** `.venv/bin/pytest tests/agents -q` → FAIL.
- [ ] **Step 3: Edit the agent files.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: agents plan shot lists and build hero scenes in HyperFrames`

---

### Task 8: Three fixture videos, timing report, setup and checklist

**Files:** Create `tests/fixtures/hf/{volcano,chart,process}/` (script, manifest, words, shots, style, sound — FakeEngine-free: real Kokoro voice in `.venv-voice`), `docs/hf/README.md`, `docs/hf/fixture-*.mp4` (git-ignored; keep 4-frame contact sheets `docs/hf/fixture-*-sheet.png` committed); Modify `docs/SETUP.md`, `docs/TEST-CHECKLIST.md`, `tools/check_setup.py` (hf-kit installed, Node ≥ 22).

- [ ] **Step 1 (controller-run):** build and render the three fixtures end to end in the cloud with the real voice; record per-video build time (agent-like authoring excluded — measured separately when the real pipeline runs) and render time in `docs/hf/README.md`; contact sheets; LOOK at them.
- [ ] **Step 2:** `check_setup` gains: Node major ≥ 22, `hf-kit/node_modules/hyperframes` present (tests).
- [ ] **Step 3:** SETUP: `cd hf-kit` → `npm ci`; TEST-CHECKLIST: **first item** = `cd hf-kit` → `npm run sample` renders `sample/out.mp4` on Windows ("you should see a 3-second clip"); then one full `/make-video` and note the time it took; then approve or not the HyperFrames look (3 approvals → Remotion cleanup).
- [ ] **Step 4: Run** full fast suite + slow hf tests → PASS.
- [ ] **Step 5: Commit** `docs: HyperFrames setup, fixtures and owner checklist`
