# Vertical Short-Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make vertical 1080×1920 the default video format for TikTok and YouTube Shorts. That means taller places, a phone-ready host, safe-zone captions and a short recipe, while landscape output stays exactly as it is today.

**Architecture:**
- The canvas becomes per-composition, set by `data.canvas` from the new `shots.json` field `format`.
- Places gain an "extended" mount, used only for vertical: 720 px of extra world above and below, with anchors offset automatically.
- Vertical adds a screen-anchored `bottom` host slot, a caption band, a text safe zone (checked by `snapshot --safe-zone`) and `pan_up`/`pan_down` moves.
- The agents learn the `--format` flag and the short recipe.

**Tech Stack:** HyperFrames 0.9.72 (pinned), the classic-script `HFKit` kit, `node --test`, Node Playwright, Python 3.12 tools with pytest, Kokoro voice.

**Spec:** `docs/superpowers/specs/2026-11-24-vertical-short-form-design.md`. The prior phases' specs and constraints also apply: `2026-11-21-world-kit-and-video-types-design.md` and `2026-11-24-feedback-notebook-design.md`.

## Global Constraints

- **Formats:** `vertical` = 1080×1920 (the default); `landscape` = 1920×1080. 30 fps, frames = ceil(duration × 30).
- **Landscape and schema-1 output are unchanged:** byte-identical `data.json` and matching snapshots against goldens captured at this plan's base. The one exception is the host refresh (Task 2), which is re-baselined deliberately, with its reason given in the commit.
- **Extended places (vertical only):** the world is 3840×3600 (the original 3840×2160 plus 720 above and 720 below). Every anchor and path is offset by +720 y. In landscape, places mount exactly as today.
- **Zoom and motion limits are unchanged:**
  - zoom 0.6×–5×;
  - zoom rate 2.5×/s, log space;
  - pan 0.6;
  - dive 4×/s;
  - cut is instant.
- **Vertical text safe zone:** text (captions, labels, tags, titles) stays inside x 64–940, y 200–1420. The host is exempt.
- **Vertical captions:** a band at y 840–1020 (a 40 px gap above the host's face zone), 64 px, max width 860, at most 2 lines, with word highlight. Exported as `HFKit.VERTICAL`.
- **Vertical host:** the `bottom` slot, left or right. He is cropped by the frame bottom, about 1.4x bigger (k 0.97, face box about 320–330 px tall), his face sits inside y 1060–1400 (chin above 1400, clear of the apps' bottom text) and inside x 40–1040, and no text ever covers his face (overlap check). Owner decision 2026-11-25.
- **Anchor spread:** shot validation warns when anchors used in one vertical shot are more than 1700 world px apart horizontally.
- **Short recipe (vertical):**
  - target 45–75 s, hard limits 30–180 s;
  - the hook is the first sentence, about 2 s of speech or less;
  - one idea per 5–8 s;
  - the last line invites a rewatch or a comment.
- **Host look:**
  - curly hair, skin `#F0CDAE`, clean jaw;
  - chunky lime acetate glasses: fill `#9CD62B` at 0.95, inner edge `#D4F57A`, outer edge `#5E9A14`;
  - the refresh makes the head about 20% bigger and the brows, eyes and mouth bolder, softens the body, and keeps the face design.
- **Remotion** stays landscape-only. A failed vertical render stops the run (stuck-gate flow), with no silent switch of format.
- **Inherited rules:**
  - offline render, `HYPERFRAMES_NO_TELEMETRY=1`;
  - no Lemo text;
  - Windows-safe;
  - don't widen `.claude/settings.json`;
  - every SVG id unique per instance;
  - every agent reads `lessons.md`.

## Review Focus

1. **A landscape run after this change** (schema 1 and landscape schema 2) produces identical output to before. Golden test in Task 1, re-checked in Task 6.
2. **A vertical shot using two anchors far apart** (rail-near to barn): a validation warning that names the scene, beat and spread, not a silent half-empty frame. Test in Task 6.
3. **A long caption line in vertical** wraps to at most 2 lines inside 860 px. If the text still doesn't fit, the build warns and the safe-zone check passes. Test in Task 6.
4. **Pulling out to 0.6× at the top or bottom of an extended place** never shows past the world edge (the camera clamps to world bounds). Test in Task 3.
5. **A run started without `--format`** is vertical. `--format landscape` gives today's behaviour, and an unknown format is refused before any agent starts. Test in Task 7.

---

### Task 1: Format switch (per-composition canvas)

**Files:**
- Modify:
  - `hf-kit/src/kit.js`, `shell.js`, `stage.js`, `composition.js`, `world/world.js`, `world/overlays.js`, `world/moves.js`, `world/insides.js`, `presenter/figure.js`;
  - `tools/hf/shots.py`, `build.py`, `snapshot.py`, `overlap.mjs`, `kit_check.mjs`, `render.py`.
- Test: `hf-kit/test/canvas.test.js`, `tests/hf/test_format.py`, golden files under `tests/fixtures/hf/golden/`.

**Interfaces — Produces:**
- `HFKit.setCanvas({width, height})`, called by `mountComposition(data)` from `data.canvas`. Default 1920×1080.
- `HFKit.FORMATS = {vertical:{width:1080,height:1920}, landscape:{width:1920,height:1080}}`.
- Every kit module reads `HFKit.CANVAS` at mount time, not at load time.
- `shots.json` schema 2 has an optional top-level `"format"` (default `"vertical"`); schema 1 is always landscape. `validate_shots` rejects unknown formats.
- `build` writes `data.canvas`. `render`, `snapshot` and `overlap` use the composition's size.

- [ ] **Step 1: Capture goldens before any change:**
  - `data.json` for the schema-1 volcano fixture and for the 4 world fixtures (as landscape);
  - snapshot PNGs, start/mid/end, of `tests/fixtures/hf/world/sound`.
- [ ] **Step 2: Failing tests:**
  - `setCanvas` changes `captionTop` and the shell layout boxes;
  - the world fixtures with `"format":"landscape"` match the goldens byte for byte, and their snapshots match within a pixel tolerance;
  - schema 2 with no `format` builds a 1080×1920 composition (the `data.canvas` value, and the rendered MP4 size via ffprobe in a slow test);
  - `format: "square"` gives an error.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** `(cd hf-kit && npm test)`, the browser tests, `pytest -m "not slow"` and `pytest -m slow tests/hf`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: per-composition canvas and format switch (landscape unchanged)`

---

### Task 2: Host phone-ready refresh and the vertical `bottom` slot

**Files:**
- Modify: `hf-kit/src/presenter/{parts,look,figure}.js`, `hf-kit/src/actor/{rig,actor,host}.js`, `templates/` (the Remotion presenter, for parity), `hf-kit/scripts/world-sheet.mjs`, `hair-closeup.mjs`.
- Test: `hf-kit/test/actor.test.js`, `presenter.test.js`, the presenter-parity test.

**Interfaces — Produces:**
- `rig.SLOT.bottom = {left:{x}, right:{x}, k}`.
- `mountActor` accepts `start:{slot:"bottom-left"|"bottom-right"}`, placing his face between y 1150–1400 on a 1080×1920 canvas, with his body cropped by the bottom edge.
- `HFKit.LOOK.headScale = 1.2`.

**Steps:**
- [ ] **Step 1: Failing tests:**
  - the head bounding box is 1.18–1.22× the old ratio to body height;
  - the glasses and skin hex values are unchanged;
  - a bottom-slot face box on a vertical canvas sits within y 1150–1400;
  - SVG ids stay unique.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the refresh:**
  - bigger head, same face design;
  - bolder brows, larger eyes, clearer mouth shapes;
  - waist taper, softer sweater, bendier arms.

  Then implement the slot.
- [ ] **Step 4: Make a before/after sheet** for the owner, `hf-kit/sample/world-sheet/host-refresh.png`: 4 outfits × key poses, the walk, and a vertical bottom-slot shot, with before and after side by side. Then re-baseline host.png, the parity images and the goldens, stating the reason in the commit.
- [ ] **Step 5: Run** all suites, including templates. Expected: PASS.
- [ ] **Step 6: Commit** `feat: phone-ready host refresh and vertical bottom slot`

---

### Task 3: The extended-place contract, with countryside and lab extended

**Files:**
- Modify: `hf-kit/src/world/place.js`, `hf-kit/places/{countryside,lab}/place.js` (plus README and preview), `hf-kit/scripts/world-sheet.mjs`, `hf-kit/src/world/world.js` (world bounds).
- Test: `hf-kit/test/places.test.js`, `hf-kit/test/browser/places.mjs`.

**Interfaces — Produces:**
- `meta.extend = {top:{…}, bottom:{…}}` describes what each band draws.
- `place.mount(layers, {variant, seed, idPrefix, extended:true})` draws the bands and returns anchors and paths offset by +720.
- `HFKit.placeWorld(place, extended) -> {width:3840, height: extended?3600:2160}`.
- `world.js` clamps the camera to the world bounds.

**Steps:**
- [ ] **Step 1: Failing tests:**
  - **Review Focus 4:** at zoom 0.6 the camera can't show past the top or bottom of the 3600 world;
  - the extended anchors equal the original anchors + 720;
  - `extended:false` output is unchanged;
  - a seam check: sample a row of pixels at y 720 and y 2880 in the browser and check there's no hard colour step greater than a small threshold, except where real scene edges are (the per-place allowlist lives in meta).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Countryside:** sky continues with high clouds, birds and contrails, and stars at night; below are deeper soil strata, roots, rock and a buried pipe or fossil detail.
  - **Lab:** above, a ceiling with light fittings, ducts and the top shelf; below, a tiled floor continued, the under-bench storage and the lower cabinets.
- [ ] **Step 4: Extend the vertical sheet section** for each place: the full tall world plus wide, mid and close vertical shots. LOOK at it with Read and iterate.
- [ ] **Step 5: Run** all suites. Expected: PASS.
- [ ] **Step 6: Commit** `feat: extended places for vertical (countryside, lab)`

---

### Task 4: Owner style check (controller-run)

- [ ] Show the owner `host-refresh.png` and the countryside and lab vertical sheets.
- [ ] Collect approval or directions, with up to 2 fix rounds via the Task 2/3 implementers.
- [ ] Record the approval and any style rules in the ledger for Tasks 5–8.

---

### Task 5: Extend the remaining 9 places

**Files:** `hf-kit/places/{city-street,home,classroom,forest,ocean,space,inside-body,sky-fantasy,rooftop-night}/place.js` (plus README and preview), and the sheets.

**Interfaces:** the Task 3 contract. Every variant, including forest `moonless`, gets bands.

- [ ] **Step 1: Failing tests:** every place has `meta.extend`, offset anchors, and passes the seam check.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Indoor places get a ceiling above and floor or lower furniture below.
  - Space gets more stars and galaxies above, and the planet or station continued below.
  - Ocean underwater gets more surface light above and deep water or the seabed below.
  - Inside-body gets more tissue or vessels above and below.

  LOOK at every vertical sheet and do two passes each.
- [ ] **Step 4: Run** all suites. Expected: PASS.
- [ ] **Step 5: Commit** `feat: extended places for vertical (all places)`

---

### Task 6: Vertical camera moves, captions, safe zone and checks

**Files:**
- Modify: `hf-kit/src/world/{moves,world,overlays}.js`, `hf-kit/src/shell.js`, `hf-kit/MOVES.md` (regenerated), `tools/hf/{shots,snapshot}.py`, `tools/hf/overlap.mjs`.
- Test: `hf-kit/test/moves.test.js`, `overlays.test.js`, `tests/hf/test_snapshot.py`, `tests/hf/test_shots.py`.

**Interfaces — Produces:**
- New moves `pan_up` and `pan_down`, with params `to` (an anchor) or `by` (world px), under the existing limits.
- Vertical captions use the band and size from Global Constraints.
- `python -m tools.hf.snapshot <run> --safe-zone` writes `04-video/hf/safe-zone.json` as `[{scene, t, kind, id, box}]` and exits 1 if the list is non-empty.
- Shots validation warns on anchor spread above 1700.

**Steps:**
- [ ] **Step 1: Failing tests:**
  - Review Focus 2 (the spread warning, naming scene, beat and spread);
  - Review Focus 3 (a long caption wraps to ≤2 lines inside 860 px, and the safe-zone check passes);
  - a tag placed at x 1000 is reported by `--safe-zone`;
  - `pan_up` respects the limits and the world clamp;
  - Review Focus 1 re-checked: the landscape goldens still match.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all suites, including the slow hf tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: vertical camera moves, caption band and safe-zone check`

---

### Task 7: Agents — `--format`, the short recipe, vertical checks

**Files:**
- Modify: `.claude/commands/make-video.md`, `.claude/agents/{story,design,animator,reviewer}.md`.
- Test: `tests/agents/test_agent_files.py`, `test_orchestrator_file.py`.

**Produces:**
- **make-video:** `--format vertical|landscape`, default vertical. An unknown value is refused before init (Review Focus 5). The format is stored and shown at script approval.
- **Quill:** a short recipe for vertical, using the Global Constraints values.
- **Iris:**
  - sets `"format"`;
  - frames for the middle band;
  - uses tall reveals and pans;
  - heeds the spread warning;
  - places the host in the bottom slots.
- **Flip:** runs `snapshot --overlap` and `--safe-zone`, both of which must be clean.
- **Sage:**
  - gate 1: the hook and length rules;
  - gate 3: vertical framing and the spread warnings explained;
  - gate 4: the safe-zone report is clean, plus a phone-size readability check of the snapshots.
- Every status command passes the real-parser test.

- [ ] **Step 1: Failing tests** for the rules and commands above. Existing tests are not weakened.
- [ ] **Step 2: Run** `pytest tests/agents -q`. Expected: FAIL.
- [ ] **Step 3: Edit.**
- [ ] **Step 4: Run** the agent tests and the fast suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat: agents make vertical shorts by default`

---

### Task 8: Vertical fixtures, timings, docs

**Files:**
- Create: `tests/fixtures/hf/vertical/{sound,whatif,short}/`
- Modify: `docs/hf/README.md`, `docs/GETTING-STARTED.md`, `docs/TEST-CHECKLIST.md`

- [ ] **Step 1: Make the fixtures** end to end with the real voice, following the agent files:
  - `sound` and `whatif` remade vertically;
  - `short` is a new 45–75 s explainer written to the short recipe.

  Every fixture must pass validate, build, snapshot, `--overlap` and `--safe-zone`, then render and mix. Commit the inputs and contact sheets `docs/hf/vertical-<name>-sheet.png` (≤1.5 MB). The mp4s are git-ignored. Record timings. LOOK at every sheet and fix what's visible.
- [ ] **Step 2: Update the docs:** `--format`, vertical by default, safe zones. In GETTING-STARTED Part C, the example becomes a vertical short.
- [ ] **Step 3: Add a fast test** that validates every `tests/fixtures/hf/vertical/*`.
- [ ] **Step 4: Run all suites.** Expected: PASS.
- [ ] **Step 5: Commit** `docs: vertical fixtures, timings and guides`
