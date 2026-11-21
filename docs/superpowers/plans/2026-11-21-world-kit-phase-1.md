# World Kit — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace slide-style scenes with drawn **world scenes**: a full-body host who keeps his face, a places library, effects and data tags inside the picture, a `moves` vocabulary that makes "show, don't tell" checkable, bigger captions and a bolder camera. The agents make **explainer** and **what-if** videos in the new look.

**Architecture:**
- **Library-first, data-driven.** The kit gains:
  - `actors` (a full-body rig for the host and, later, the cast),
  - `places` (a layered scene library like `props/`),
  - `effects` and `overlays`,
  - a `moves` compiler that turns each beat's `moves` into actor, effect, overlay and camera tracks,
  - a `world` scene runtime that composes them.
- **`shots.json` schema 2** adds `kind: "world"` scenes made of beats. Schema 1 (hero/kit) still validates and builds until the agents switch over.
- Flip writes per-scene modules only for `custom:` moves and new places.

**Tech Stack:**
- HyperFrames 0.9.72 (pinned), vendored GSAP and fonts.
- HTML/SVG/JS classic scripts on `globalThis.HFKit`.
- `node --test`, Node Playwright for browser and sheet tests.
- Python 3.12 tools with pytest; Kokoro voice in `.venv-voice`.

**Spec:** `docs/superpowers/specs/2026-11-21-world-kit-and-video-types-design.md`, phase 1 (§12 item 1). Prior spec: `2026-11-21-hyperframes-switch-design.md`. Spike reference: `docs/hf/spike-world/` (`actor.js`, `world.js`, `sheet.png`).

## Global Constraints

- **Format:** 1920×1080, 30 fps. Scene frames = ceil(duration_s × 30); transitions stay inside scene time.
- **Offline:** no `http(s)://` resource in any compiled composition; `HYPERFRAMES_NO_TELEMETRY=1` on every HyperFrames call; no downloaded images; no paid tools or voices.
- **Lemo-Opuscar** text is never copied into the repo.
- **Kit modules** are classic scripts that attach to `globalThis.HFKit` and are listed in load order in `HFKit.SCRIPTS`.
- **SVG ids:** every id is unique per mounted instance (`<scene>-<actor|place>-<n>-…`), because two actors or two scenes must never share a mask, gradient or clip id.
- **Host face is fixed:** curly hair, glasses, skin `#E3B28A`. Outfit chosen per video; default blazer, lab coat for science/health/tech. Voice `am_adam`.
- **Art style:** flat-shaded cartoon, soft gradients, simple outlines, warm light.
- **Captions:** 60 px default (was 40), dark pill, word highlight. Size and position (`bottom`/`top`) come from `style.json` `captions`.
- **Camera in world scenes:**
  - zoom 0.6×–5×;
  - `cut` is instant;
  - all other moves are slew-limited, with no whip pans;
  - `cameraOverrun` > 0.25 s is an error.
- **On-screen text:**
  - labels and tags ≤ 4 words (a number counts as one word);
  - one title, in scene 1 only;
  - no bullet lists, no sentences (captions excepted).
- **Show, don't tell:** every beat has ≥ 1 entry in `moves`.
- **Numbers:** sizes, speeds and ratios on screen are true to scale, or the scene carries a `"not to scale"` tag.
- **Video types in phase 1:** `explainer`, `what-if`. `story`, `action` and `other` are refused with "coming in a later phase". `audience` ∈ `all-ages` (default), `teens`, `adults`.
- **Host step-ins** (host placed in the world, not in a side slot) per video: 1–2 (`--allow-step-ins` relaxes this for drafts and tests).
- **Library growth:** new places, props and custom pieces are saved to the libraries only after the owner's final approval (the existing props rule, extended to places).
- **Compatibility:** Windows paths with spaces, list-arg subprocess, `npx` via `shutil.which`. Remotion is untouched. `.claude/settings.json` is not widened.

## Review Focus

1. **Two actors, or two world scenes, mounted on one page.** No duplicate SVG ids, and neither actor disappears. *(This was the spike's bug.)* Test in Task 1.
2. **A `moves` entry naming an actor, anchor, place or effect that doesn't exist.** Validation fails, naming the scene, beat and move, instead of rendering nothing. Test in Task 6.
3. **A tag following a point that leaves the frame, or a camera at 5× with a moving target.** The tag is clamped to the frame edge or hidden, never drawn half-off. The camera stays within limits and its overrun is reported. Test in Task 4.
4. **A schema-1 `shots.json`** (the current fixtures and agents). It still validates, builds and renders unchanged. Test in Task 6.
5. **A tag or label covering an actor's face or another label.** The overlap report lists it with scene and time. Test in Task 6.

---

## File Structure

```
hf-kit/src/actor/rig.js        full-body rig: parts, outfits, poses, cycles (pure SVG-string builders)
hf-kit/src/actor/actor.js      mountActor: instance ids, placement (slot|world), update(t) from a track
hf-kit/src/actor/host.js       the host's fixed face + wardrobe entry (HFKit.cast.host)
hf-kit/src/world/place.js      place contract helpers: layers, parallax, anchors, variants
hf-kit/src/world/effects.js    burst, rings, pulse_along, speed_lines, splash, sparkle, smoke, glow
hf-kit/src/world/overlays.js   tag_follow, label (edge clamp, boxes for overlap)
hf-kit/src/world/moves.js      MOVES vocabulary + compileMoves (pure)
hf-kit/src/world/world.js      mountWorld: place + actors + effects + overlays + camera (+ dive/inside)
hf-kit/places/<name>/place.js preview.png README.md ;  hf-kit/places/README.md
hf-kit/scripts/world-sheet.mjs host/outfit/motion sheet + place sheets
tools/hf/shots.py  build.py  snapshot.py  kit_check.mjs   (schema 2, overlap report)
.claude/agents/{story,voice,design,animator,reviewer}.md, .claude/commands/make-video.md
tests/fixtures/hf/{volcano,process,sound,whatif}/      (schema 2, real voice)
```

### Pinned format — `03-design/shots.json` schema 2

```json
{"schema":2,"type":"explainer","audience":"all-ages",
 "cast":[{"id":"host","character":"host","outfit":"lab-coat"}],
 "scenes":[
  {"id":1,"kind":"world","place":"countryside","variant":"day","new_place":false,
   "facts":["sound travels ~343 m/s in air","~5,960 m/s in steel"],
   "actors":[{"id":"host","start":{"slot":"right"}},{"id":"friend","character":"extra-1","outfit":"casual","start":{"anchor":"rail-far"}}],
   "beats":[
    {"at":{"word":0},"action":"host waves from the side; camera pulls out over the railway",
     "moves":[{"do":"gesture","who":"host","name":"wave"},{"do":"pull_out","zoom":0.8}]},
    {"at":{"word":9},"action":"host walks in and strikes the rail; a pulse races along it",
     "moves":[{"do":"walk_to","who":"host","to":"rail-near"},{"do":"use","who":"host","prop":"hammer","at":{"word":12}},
              {"do":"pulse_along","path":"rail","from":"rail-near","to":"rail-far","speed":"fast","at":{"word":12}},
              {"do":"tag_follow","target":"pulse","text":"≈5,960 m/s"},{"do":"push_in","target":"rail-far","zoom":2.2}]}],
   "transition":"fade"}]}
```

- `type`: `explainer` or `what-if`.
- `cast[].character`: `host`, or `extra-<n>` (generic phase-1 extras built by the rig).
- `actors[].start`: `{"slot":"left"|"right"}` or `{"anchor":<place anchor>}`.
- `at` (beat or move): `{word:i}` or `{t:s}`; a move's `at` defaults to its beat's.
- `do`: one of `HFKit.MOVES`, as below.

| Group | Moves (parameters) |
|---|---|
| Actor | `enter`/`exit` (who, side), `walk_to`/`run_to` (who, to), `jump` (who), `point` (who, target), `gesture` (who, name), `react` (who, expression), `hold`/`use` (who, prop), `say` (who) |
| Effect | `burst`, `rings`, `pulse_along` (path, from, to, speed), `speed_lines`, `splash`, `sparkle`, `smoke`, `glow` — each takes `target` or `path` plus optional params |
| Overlay | `tag_follow` (target, text), `label` (target, text), `title` (text) |
| Camera | `push_in` (target, zoom), `pull_out` (zoom), `follow` (target), `cut` (target, zoom), `dive` (target, into, params) |
| Custom | `custom` (name, params): needs `04-video/hf/scenes/scene-<id>.js` registering `HFKit.customs[name]` |

- `new_place: true` needs `04-video/hf/scenes/place-<name>.js` registering `HFKit.places[name]`.
- Schema 1 (`"schema"` absent) keeps the old pinned format and rules.

---

### Task 1: Actor rig and the host

**Files:**
- Create: `hf-kit/src/actor/{rig,actor,host}.js`, `hf-kit/test/actor.test.js`, `hf-kit/test/browser/actors.mjs`
- Modify: `hf-kit/src/kit.js` (`SCRIPTS`, `HFKit.cast`, `HFKit.mountActor`)

**Interfaces:**
- Consumes: the face, hair, glasses, palette and mouth from `hf-kit/src/presenter/*` (reuse; do not redraw the face). The spike `docs/hf/spike-world/actor.js` is reference only.
- Produces:
  - `HFKit.rig.POSES` (keys must include `idle`, `talk`, `point-left`, `point-right`, `wave`, `raise`, `shrug`, `think`, `strike`, `carry`, `celebrate`).
  - `HFKit.rig.CYCLES` = `walk`, `run`, `jump`, each a pure function `(phase:0..1) -> legs/arms pose`.
  - `HFKit.rig.OUTFITS` ⊇ `blazer`, `lab-coat`, `casual`, `explorer`.
  - `HFKit.rig.HELD` ⊇ `hammer`, `book`, `phone`, `pointer`.
  - `HFKit.rig.EXPRESSIONS` = the presenter's set plus `surprised`.
  - `HFKit.rig.svg(state, idPrefix) -> string`, where `state = {pose, cycle?, phase?, outfit, held?, expression, mouth, blink, breath, facing}`. Body units: feet at y = 1300.
  - `HFKit.cast.host = {character:"host", face:{hair:"curly", glasses:true, skin:"#E3B28A"}, voice:"am_adam", defaultOutfit:"blazer"}`.
  - `HFKit.cast.extra(n) -> character` (deterministic generic extras: varied skin, hair, outfit; never the host's face).
  - `HFKit.mountActor(el, spec, ctx) -> {update(t, s), anchors:{head, hand, feet}, box(t)}`.
    - `spec = {id, character, outfit, scale?, start}`.
    - `s` = the actor state at t.
    - `box(t)` = the face box in screen px, used by the overlap report.
  - The side slot is ≈1.35× the old presenter size. Idle breathing and blinks are automatic.
- [ ] **Step 1: Failing tests** in `actor.test.js`:
  - every listed pose, cycle, outfit, held item and expression exists;
  - `rig.svg` is deterministic for the same state;
  - the host's face constants are exact (`#E3B28A`);
  - `cast.extra(1)` differs from the host and is stable across calls;
  - **Review Focus 1:** two `rig.svg` outputs with prefixes `s1-host-0` and `s1-extra-1-0` share no `id="…"` value, and every `url(#…)` reference resolves to an id with its own prefix.

  In `actors.mjs` (browser): mount the host and one extra on one page; both have non-empty bounding boxes at t = 0 and t = 2.
- [ ] **Step 2: Run** `(cd hf-kit && npm test)` and `node hf-kit/test/browser/actors.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** rig, actor and host.
  - The face comes from the presenter modules.
  - Legs, coat tails, cycles and held props are new.
  - Mouth from the scene's mouth data; blinks from a seeded schedule.
- [ ] **Step 4: Run** both. Expected: PASS. Existing presenter tests still pass.
- [ ] **Step 5: Commit** `feat: full-body actor rig and the host`

---

### Task 2: Places contract, first two places, world sheet

**Files:**
- Create:
  - `hf-kit/src/world/place.js`
  - `hf-kit/places/{countryside,lab}/{place.js,preview.png,README.md}`
  - `hf-kit/places/README.md`
  - `hf-kit/scripts/world-sheet.mjs`
  - `hf-kit/test/places.test.js`
- Modify: `hf-kit/src/kit.js`, `hf-kit/package.json` (script `"world-sheet"`), `tools/hf/render.py` `install_kit` (copy `places/`)

**Interfaces:**
- Produces:
  - Place contract: `HFKit.places[name] = {meta:{name, description, variants:[…], anchors:[…], paths:[…]}, mount(layerEls, {variant, seed, idPrefix}) -> {update(t, cam), anchors:{name:(t)=>{x,y}}, paths:{name:[{x,y}…]}}}`.
    - Coordinates are world px in a 3840×2160 world, so a 0.6× pull-out still fills the frame.
    - Layers are `sky`, `far`, `mid`, `ground` and `front`, with parallax factors `0.2 / 0.45 / 0.75 / 1 / 1.15`.
  - `HFKit.placeLayers(el, idPrefix) -> {sky,far,mid,ground,front}`.
  - **countryside:**
    - variants `day`, `sunset`, `night`;
    - anchors `rail-near`, `rail-far`, `bridge`, `lake`, `barn`, `sky`;
    - path `rail`;
    - ported from the spike's look.
  - **lab:**
    - variants `bright`, `dim`;
    - anchors `bench`, `screen`, `door`, `window`;
    - path `bench-top`.
  - `npm run world-sheet` writes `hf-kit/sample/world-sheet/host.png` (4 outfits × 6 poses, plus walk and run strips) and `place-<name>.png` (all variants, with anchors marked). Each file ≤ 1.5 MB.
- [ ] **Step 1: Failing tests** in `places.test.js`:
  - each place has a `meta` with ≥ 1 variant, and the anchors and paths it lists;
  - `mount` with an unknown variant throws `place countryside: unknown variant "x"`;
  - anchors lie inside the 3840×2160 world;
  - `install_kit` copies `places/`;
  - `tests/hf/test_render.py` gains a case for the places copy.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the contract and both places, drawing with the `draw.js` helpers.
- [ ] **Step 4: Run.** Expected: PASS. Then run `npm run world-sheet` and LOOK at every sheet; fix anything ugly, cut off or inconsistent.
- [ ] **Step 5: Commit** `feat: places contract, countryside and lab, world sheet`

---

### Task 3: Style lock with the owner (controller-run)

- [ ] **Step 1:** The controller shows the owner `host.png` and both place sheets.
- [ ] **Step 2:** The owner approves, or gives directions. Directions go back to the Task 1/2 implementer as a fix round, at most 2 rounds, and the controller shows the new sheets each time.
- [ ] **Step 3:** Record the approval in the ledger, with any style rules the owner gave, and pass them into the briefs for Tasks 4–5.

---

### Task 4: Remaining places, effects, overlays, camera and captions

**Files:**
- Create:
  - `hf-kit/places/{city-street,home,classroom,forest,ocean,space,inside-body,sky-fantasy,rooftop-night}/…`
  - `hf-kit/src/world/{effects,overlays}.js`
  - `hf-kit/test/{effects,overlays}.test.js`
- Modify: `hf-kit/src/timing.js` (world camera limits, `cut`), `hf-kit/src/kit.js` (`tokens.sizes.caption = 60`), `hf-kit/src/shell.js` (caption pill, `captions.position`)

**Interfaces:**
- Consumes: the place contract (Task 2) and the style rules from Task 3.
- Produces:
  - Places:
    - each place has ≥ 2 variants and ≥ 4 anchors;
    - `ocean` has variants `surface` and `underwater`;
    - `inside-body` has anchors `heart`, `lungs`, `vessel`, `stomach`.
  - `HFKit.effects[name](layerEl, params, idPrefix) -> {update(t), box(t)}` for `burst`, `rings`, `pulse_along`, `speed_lines`, `splash`, `sparkle`, `smoke`, `glow`. `pulse_along` exposes `anchor(t)` named `pulse`.
  - `HFKit.overlays.tag(el, {text, target}, idPrefix) -> {update(t, screenPoint), box(t)}` and `HFKit.overlays.label(...)`.
    - A tag whose point leaves the frame is clamped to the frame edge (safe 96 px) while the point is less than 200 px outside, then fades out.
    - Text over 4 words throws.
  - `HFKit.WORLD_LIMITS = {minZoom:0.6, maxZoom:5, maxPanPerSec, maxZoomPerSec}`. Keep the existing pan limit; zoom rate ≤ 1.6×/s.
  - `resolveCamera` accepts keys `{t, frame, cut:true}`: a cut snaps with no slew and no overrun.
- [ ] **Step 1: Failing tests:**
  - each new place meets the contract;
  - each effect is deterministic, and its `box` is empty before `at` and non-empty after;
  - **Review Focus 3:** a tag at screen point (2100, 500) is clamped to x ≤ 1824, and at (2400, 500) its opacity is 0;
  - a camera key with zoom 5 following a moving anchor gives `cameraOverrun` ≤ 0.25 s, or reports it;
  - zoom 6 is clamped to 5;
  - a cut changes the view within one frame;
  - `captionReserve` uses 60 px;
  - schema-1 kit scenes still pass their tests at the new caption size.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Run `npm run world-sheet` (it now includes all places and an effects strip) and LOOK at every sheet.
- [ ] **Step 4: Run** `(cd hf-kit && npm test)` and the browser tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: places library, effects, tags, world camera and bigger captions`

---

### Task 5: Moves compiler and the world scene

**Files:**
- Create: `hf-kit/src/world/{moves,world}.js`, `hf-kit/test/moves.test.js`, `hf-kit/test/browser/world.mjs`
- Modify: `hf-kit/src/composition.js` (`kind: "world"`), `hf-kit/src/kit.js`

**Interfaces:**
- Consumes: actors (Task 1), places, effects, overlays and camera (Tasks 2 and 4), `wordTime`.
- Produces:
  - `HFKit.MOVES`: the vocabulary from the pinned table, as `{name: {group, required:[…], optional:[…]}}`.
  - `HFKit.compileMoves(scene, words, world) -> {actors:{id:[{t, state…}]}, effects:[…], overlays:[…], camera:[{t, frame, cut?}], errors:[…]}`.
    - Pure function.
    - `world` = `{anchors, paths, actors, effects:Object.keys(HFKit.effects), customs}`.
    - Errors read like `scene 2 beat 1 move 3 (walk_to): unknown anchor "rail-mid"`.
    - `walk_to` duration comes from the distance at a walking speed of 420 world px/s.
    - `enter`/`exit` walk in from, or out to, the frame edge.
    - `dive` = push to zoom ≥ 3 on `target`, then a cut to an inside view drawn by `HFKit.insides[into]`. Ship `lattice` (particles: `solid`, `liquid`, `gas`) and `cells`.
  - `HFKit.mountWorld(el, scene, ctx) -> {update(t), boxes(t) -> [{kind:"face"|"tag"|"label", id, x, y, w, h}]}`.
  - `HFKit.validateWorld(scene, words) -> errors[]` (used by `kit_check.mjs`).
- [ ] **Step 1: Failing tests** in `moves.test.js`:
  - each move group compiles;
  - unknown `do`, `who`, anchor, path or effect → an error naming the scene, beat and move index;
  - a move `at` word outside the scene → error;
  - `walk_to` duration matches the speed;
  - a beat with `moves: []` → error `scene 1 beat 0: no moves (show, don't tell)`;
  - `custom` without a registered `HFKit.customs[name]` → error.

  In `world.mjs` (browser): the spike's railway beat (above) mounts and updates at 5 times with no console errors; `boxes(t)` contains the host's face; two world scenes on one page show no duplicate ids.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: moves vocabulary and world scenes`

---

### Task 6: Schema 2 in shots, build and snapshot (overlap report)

**Files:**
- Modify: `tools/hf/shots.py`, `tools/hf/build.py`, `tools/hf/snapshot.py`, `tools/hf/kit_check.mjs`
- Test: `tests/hf/test_shots.py`, `tests/hf/test_build.py`, `tests/hf/test_snapshot.py`

**Interfaces:**
- Consumes: `HFKit.validateWorld`, `MOVES`, `places`, `cast` (via `kit_check.mjs`). The move vocabulary lives only in the kit.
- Produces:
  - `validate_shots(...)` (same signature as today) dispatches on `shots.get("schema")`. Schema 2 checks:
    - `type` is `explainer` or `what-if`; `story`, `action` and `other` → `type "story" is coming in a later phase — use explainer or what-if`;
    - `audience` is valid;
    - every scene is `kind: "world"`;
    - the place exists, or `new_place` is set with its module present;
    - variants and actors are valid;
    - the cast has a `host`;
    - every beat has moves;
    - text limits (labels and tags ≤ 4 words, title in scene 1 only);
    - step-ins 1–2, unless `allow_step_ins=True`;
    - camera overrun;
    - Review Focus 2 errors from the kit.
  - CLI flags: `shots validate --allow-step-ins`; `build --allow-step-ins` (`--allow-hero-count` stays for schema 1).
  - `build` for schema 2:
    - loads `kit/places/<name>/place.js`, or `scenes/place-<name>.js` when `new_place` is set;
    - loads `scenes/scene-<id>.js` for customs;
    - passes each actor's mouth (the host = narration);
    - reads `captions` from `style.json`.
  - `python -m tools.hf.snapshot <run> --overlap` writes `04-video/hf/overlap.json` = `[{scene, t, a:{kind,id}, b:{kind,id}}]`. It samples every 0.5 s and flags any tag or label box that intersects a face box or another tag or label. The command exits with code 1 if the list is non-empty.
- [ ] **Step 1: Failing tests:**
  - **Review Focus 4:** the existing schema-1 tests are unchanged and still pass, and the tests/fixtures/hf volcano run builds byte-identical `data.json` as before;
  - schema-2 validation errors, one test each, for the rules above;
  - **Review Focus 2**, end to end through the CLI;
  - **Review Focus 5:** a fixture where a tag sits on the host's face → `overlap.json` has 1 entry and the exit code is 1;
  - slow test: a 2-scene schema-2 fixture (FakeEngine voice) renders, and the video duration equals the manifest total ±0.1 s.
- [ ] **Step 2: Run** `.venv/bin/python -m pytest tests/hf -q` and `-m slow tests/hf`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS. The full fast suite still passes.
- [ ] **Step 5: Commit** `feat: shots schema 2, world builds and overlap report`

---

### Task 7: Agents switch to world shot lists, types and show-don't-tell

**Files:**
- Modify: `.claude/agents/{story,voice,design,animator,reviewer}.md`, `.claude/commands/make-video.md`
- Test: `tests/agents/test_agent_files.py`, `tests/agents/test_orchestrator_file.py`

**Interfaces:**
- Consumes: the CLIs from Task 6, `hf-kit/places/README.md`, `props/README.md`, `HFKit.MOVES` (agents read them from `hf-kit/src/world/moves.js` comments or a generated `hf-kit/MOVES.md`; Task 5 writes `MOVES.md`).
- Produces (agent rules, from spec §5, §7 and §9):
  - **make-video:**
    - arguments `"<topic>" [--type explainer|what-if] [--audience all-ages|teens|adults] [notes]`;
    - `story`, `action` and `other` → tell the owner they're coming in a later phase, and stop;
    - with no type, Quill proposes one;
    - type and audience are stored in the run state and shown at script approval;
    - the §6.1 post-approval save step extends from props to new places.
  - **story (Quill):**
    - recipe shapes: explainer = hook → 3–5 ideas → recap; what-if = question → step-by-step consequences → twist/answer;
    - the script header carries `type`, `audience` and the host outfit;
    - write sentences that can be *shown*.
  - **design (Iris):**
    - writes schema 2, library-first: places README, then props README;
    - every beat has an `action` and `moves`;
    - one idea per shot;
    - host step-ins 1–2;
    - data shown as tags, true to scale or with `"not to scale"`;
    - abstract ideas become metaphor scenes, never slides;
    - run `shots validate` until it's clean.
  - **animator (Flip):**
    - composes from the library and writes modules only for `custom` moves and new places;
    - build, then `snapshot` and `snapshot --overlap`, which must be clean, then LOOK at every snapshot;
    - render with the 2-hour background timeout;
    - after the owner's final approval, save new places as `hf-kit/places/<name>/` (`place.js`, `preview.png`, README line) alongside new props.
  - **reviewer (Sage):**
    - **gate 3:** type recipe followed; every beat's moves actually *show* the sentence; one idea per shot; facts and scale; what-if science plausible and the imagined part signposted; audience-suitable.
    - **gate 4:** overlap report clean; no text carrying what the picture should; host lively, with step-ins present; captions readable.
    - the props gate also covers places.
  - **voice:** unchanged except `words.json` stays per scene. *(Dialogue is phase 2.)*
- [ ] **Step 1: Failing tests:**
  - each agent file contains its new rules and commands (`--type`, `what-if`, `"schema":2`, `moves`, `snapshot --overlap`, `places/README.md`, `not to scale`, `later phase`);
  - make-video refuses `--type story` before any agent starts;
  - status commands still pass the real-parser test;
  - existing tests are updated, none weakened.
- [ ] **Step 2: Run** `.venv/bin/python -m pytest tests/agents -q`. Expected: FAIL.
- [ ] **Step 3: Edit the agent files.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: agents make world-scene explainers and what-if videos`

---

### Task 8: Fixtures in the new look, timings, docs (step 1 is controller-supervised)

**Files:**
- Create: `tests/fixtures/hf/{sound,volcano,process,whatif}/` (schema 2, real Kokoro voice, `am_adam`)
- Modify: `docs/hf/README.md`, `docs/TEST-CHECKLIST.md`, `docs/SETUP.md` (if needed)

- [ ] **Step 1: Make the four fixtures.**
  - Remake `sound` (speed of sound, same narration as the spike), `volcano` and `process` (clouds) in the new look, and write one new `whatif` ("What if the Moon disappeared?", about 20–30 s, with facts checked).
  - Each fixture follows the agent files' steps end to end: validate, build, snapshot, overlap, render `--engine hyperframes`, mix.
  - Commit only the inputs and the contact sheets `docs/hf/world-<name>-sheet.png` (≤ 1.5 MB each). The mp4s go in `docs/hf/world-<name>.mp4` and stay git-ignored.
  - Record authoring time (wall clock) and render time in `docs/hf/README.md`, and compare them with the target: about 3–4 h for a 2-minute video at first, falling toward 1–1.5 h.
  - LOOK at every sheet and fix what's visible.
- [ ] **Step 2: Update TEST-CHECKLIST.** Add: run one `/make-video "…" --type what-if`; check that the host steps into the scene, that captions are readable on a phone, and that no scene is a slide.
- [ ] **Step 3: Run** the full fast suite, `(cd hf-kit && npm test)`, the browser tests and the slow hf tests. Expected: all PASS.
- [ ] **Step 4: Commit** `docs: world-look fixtures, timings and owner checklist`
