# World Kit and Video Types — Design

> 2026-11-24 owner update: skin #F0CDAE, no glasses (the text below is the original decision).

**Date:** 2026-11-21
**Status:** Approved by owner 2026-11-21
**Builds on:** `2026-11-21-hyperframes-switch-design.md` (HyperFrames, hero scenes,
prop library), `2026-11-19-video-agent-team-design.md` (pipeline, approvals, audio, presenter)

---

## 1. Intent and why

The owner watched the first three HyperFrames test videos and said "not yet": they
still feel like **slides** (charts and text cards on dark backgrounds, a small presenter
stuck in a corner with one pose). The owner wants videos that feel like a **real
cartoon**: every idea shown as a concrete, everyday picture the viewer can imagine.

A throwaway test (speed of sound redone on a countryside railway — presenter walks in and
strikes the rail, sound shown as visible waves, camera dives *into* the rail) confirmed the
direction: "yes, that's more like it."

The owner also wants the agent team to make **many kinds of short videos**, not only
explainers — stories, "what if" videos, superhero/action shorts and others — choosing the
kind when they run `/make-video`. Whenever there is narration, it must be **acted out in
pictures and motion, never told with on-screen text**. The look should be **generic**
(fit any kind of video), **keeping the presenter's face**.

## 2. Goals, non-goals, anti-goals

**Goals**
- Every scene is a **drawn place** that fills the frame; no slide-style scenes.
- **Show, don't tell:** every narrated sentence has a matching on-screen action.
- **Video types:** explainer, what-if, story, action/superhero, and "other" (free form).
- **The host:** the presenter keeps his face (curly hair, glasses, skin `#E3B28A`) and
  becomes a full-body character with any outfit; narrator, story character, or absent.
- **A cast:** other characters built from parts, with their own voices, saved for reuse.
- **Dialogue** between characters with different voices and moving mouths.
- **Cartoon action:** walk, run, jump, fly, fall, impacts, speed lines.
- Livelier host, fuller scenes, **bigger captions**, **bolder camera** (owner's picks).
- Reusable **places library** so videos get faster over time.

**Non-goals**
- Paid tools or voices; downloaded images or footage; 3D; realistic humans.
- Anime-style fight choreography or long action sequences.
- Interactive videos; languages other than English (Indonesian later).

**Anti-goals (a failure even if it "works")**
- A scene that is a chart, bullet list or text card on a plain background.
- The narrator *saying* something the picture doesn't *show*.
- A drawing that misleads (wrong facts, false scale without a "not to scale" note).
- Copies of existing characters (Spider-Man, Superman, any existing franchise) — all
  characters are original.
- Gore, realistic weapons, or content unsuitable for the chosen audience.
- Scenes so busy they steal attention from the voice; dizzying camera.
- Videos so slow to make that the owner stops using the tool.

## 3. Constraints

- Everything from the HyperFrames design still applies: Windows PC, Node ≥ 22,
  HyperFrames core only (pinned 0.9.72), telemetry off, offline render, vendored GSAP and
  fonts, 1920×1080 at 30 fps, captions on, Lemo-Opuscar text never copied.
- Voices: local Kokoro only (several free English voices; the host stays `am_adam`).
- Length: 1–3 minutes per video, as today.
- Owner approvals unchanged: script, voice, final video. The board stays the channel.
- Built **on top of the current HyperFrames branch** (reviewed, all tests passing); merged
  to main together after the owner approves phase-1 videos (§12).
- The `.claude/settings.json` allow-list is not widened without the owner's approval.

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Grow the HyperFrames kit into a "world kit"**: places, actors (host + cast), props, data as overlays inside the picture, show-don't-tell rules in the agents | Largest up-front build (about 2× the last one); every later video gets faster; reuses all current tooling | **Chosen** (owner: "do as you think is best") |
| B. Illustrated backgrounds behind today's kit scenes | About a third of the work, but charts and cards stay in front — still slides | Rejected: fails the owner's main ask |
| C. Switch to a character-animation tool (Rive, Lottie, Spine) | Smoother characters; rebuild of presenter and pipeline; good versions paid or need a design app | Rejected: free-tools rule |

The spike (speed of sound, 22.7 s, ~3–4 h hand-authored, render ~5.7× real time) proved A
works and showed what the kit lacks (§6).

## 5. Video types (recipes)

The owner gives a topic and, optionally, a type (`/make-video "<topic>" --type story`).
Without a type, Quill proposes one in the script; the owner sees it at script approval.

| Type | Script shape | On screen | Text allowed | Sage checks | Music |
|---|---|---|---|---|---|
| **Explainer** | hook → 3–5 ideas, each shown → recap | Host narrates, steps in 1–2 times | labels ≤ 4 words, numbers, title | facts; to-scale; every claim shown | light, curious |
| **What if** | the question → what would happen, step by step → twist/answer | Host as guide; world changes | as explainer | science is plausible; the imagined part is signposted | wonder, building |
| **Story** | setup → problem → attempts → turn → ending | Cast; host optional (narrator voice or a character) | title card, sound words ("BOOM") | plot makes sense; pacing; characters consistent; audience-suitable | follows the mood per beat |
| **Action / superhero** | as story, with 1–3 action set pieces | Original hero(es) and villain(s) | as story | as story + action is readable, cartoon-level, no gore | heroic, tense |
| **Other** | Quill writes a short recipe for it in the script; owner approves it with the script | per recipe | per recipe | per recipe + show-don't-tell | per recipe |

**Audience:** every video has an audience setting — default **all ages (family-friendly)**;
the owner may set "teens" or "adults" per video. Sage checks content against it. *(My call.)*

## 6. The world kit (shared, in `hf-kit/`)

### 6.1 Art style
Flat-shaded cartoon with soft gradients, simple outlines, warm light — the spike's look.
Neutral enough for any type; colour mood set per video (`style.json`).

### 6.2 Actors: the host and the cast
- **One actor system** for everyone (from the spike's `actor.js`): full body, layered SVG,
  per-instance unique ids (fixes the spike's duplicate-id/mask bugs).
- **Body parts and wardrobe:** body shapes, skin tones, hair, faces, outfits (casual, lab
  coat, blazer, explorer, superhero suit, uniforms…), held props (hammer, book, phone…).
- **Motion:** idle breathing + blinks, expressions, gestures on words, walk / run / jump /
  fly / fall cycles, enter / exit, sit, point, react; mouth from each character's voice.
- **The host** = a saved actor with a **fixed face** (curly hair, glasses, `#E3B28A`);
  outfit chosen per video. Default outfits stay: blazer, lab coat for science/health/tech.
- **Cast library** `hf-kit/cast/<name>/`: parameters, voice, preview sheet, one-line
  description — recurring characters come back looking the same.
- Placement: at the side (narrator slot) **or in the world** at a world point.

### 6.3 Places library
`hf-kit/places/<name>/` — layered scenes (sky, far, mid, ground, foreground) for depth and
camera, with variants (time of day, weather). Start with ~10: city street, home interior,
school/classroom, forest, ocean (surface + underwater), space, lab, inside the body,
sky/fantasy, rooftop at night. Plus a **"zoom-into" helper** (the rail dive) for micro views.
Each place has named anchor points (where actors stand, where things happen).

### 6.4 Props and effects
The existing prop library continues (`hf-kit/props/`, saved after the owner's final
approval). New effects: sound/impact bursts, speed lines, dust, sparkles, waves/rings,
splash, glow, smoke. **Data overlays:** small tags that follow a point in the world
(e.g. "343 m/s" riding on a sound wave), replacing chart scenes; true ratios or "not to scale".

### 6.5 Captions and camera
- Captions 60 px (was 40), dark pill, word highlight; size and position configurable.
- Camera: zoom range 0.6×–5× within a scene, moving targets (follow an actor or wave),
  cuts between shots inside a scene, push-in on key words, pull-out reveals. Speed limits
  stay (no whip pans); `cameraOverrun` check stays.

### 6.6 Old kit scenes
`title/steps/compare/chart/kinetic/recap/diagram` stop being whole scenes. Their parts are
reused as overlays inside places (e.g. a step badge floating over a world). *(My call.)*

## 7. Show, don't tell

- `shots.json` gains, per sentence (beat), a required **`action`**: what is seen happening
  (e.g. "host strikes rail; pulse races along rail; friend reacts"). Beats are tied to word
  indexes as today.
- On-screen text is limited to: labels ≤ 4 words, numbers, a title, story sound words.
  No bullet lists, no sentences on screen (captions excepted).
- Sage fails a shot list where any narrated beat has no visible action, and a video where
  text carries what the picture should.

## 8. Dialogue and voices

- **Script format** gains speaker lines: `NARRATOR:` / `<CHARACTER>:` per line. Explainers
  stay single-voice.
- Each character has a Kokoro voice (from the free English set) saved in its cast entry;
  the host keeps `am_adam`.
- Echo records per line per voice; `words.json` gains `speaker` per line; mouths move only
  for the speaking character. The owner still approves the whole voice track.

## 9. What changes, agent by agent

- **Quill:** picks/uses the type recipe; story structure; dialogue format; lists the cast
  (new or reused) in the script header; for "other", writes the recipe.
- **Echo:** multi-voice recording; speaker in `words.json`.
- **Iris:** shot list built from places/cast/props in the library first; `action` per beat;
  marks new places/characters/props needed; host placement and step-in moments.
- **Flip:** builds scenes from places + actors + effects; draws new items only when the
  library lacks them; saves new places/characters/props after the owner's final approval
  (same rule as props today).
- **Sage:** per-type checklist (§5), show-don't-tell, overlap check (tags never cover
  scenery or faces), originality of characters, audience suitability, facts and scale.
- **Orchestrator / dashboard / approvals:** unchanged, except `--type` and the cast shown
  at script approval.

## 10. Owner approvals

Unchanged: script (now with type and cast list), voice, final video. New recurring
characters are approved as part of the script. No new approval steps.

## 11. Testing

- Kit: unit tests for the actor system (poses, cycles, unique ids), places (anchors,
  layers), overlays (follow points), camera range/cuts; preview sheets checked by eye.
- One fixture per type, rendered end to end with the real voice and checked by eye:
  phase 1 — speed of sound (explainer) and one what-if; phase 2 — a ~1-minute story with
  two speaking characters; phase 3 — a short action/superhero piece.
- Authoring and render times recorded per fixture.

## 12. Phases and delivery

1. **New look for explainers and what-if:** actor system + host (full body, outfits,
   motion), ~10 places, effects and overlays, captions/camera, show-don't-tell in all
   agents, recipes for explainer/what-if. Then the owner tests on Windows and approves
   the look → **merge to main** (with the HyperFrames switch).
2. **Stories:** cast builder and library, dialogue and multi-voice, story recipe and checks.
3. **Action / superhero:** run/jump/fly/fall cycles, impact effects, action recipe and checks.

Each phase is its own plan and build; each reuses the previous. The Remotion fallback is
removed after the owner approves 3 real videos (unchanged).

**Time target:** about 3–4 h per 2-minute video at first, falling toward 1–1.5 h as the
places, cast and prop libraries grow. Measured on fixtures and reported.

## 13. Risks

| Risk | Mitigation |
|---|---|
| New topics need new places — slow at first | ~10 places up front; one new place per video goes into the library |
| More drawing → more ways to mislead | `action` per beat reviewed; to-scale rule; Sage web-checks |
| Busy scenes distract | One idea per shot; overlap check |
| Abstract topics (maths, history, economics) have nothing physical to draw | Metaphor scenes (money as water in pipes, timeline as a road trip) — never slides |
| Character animation looks stiff | Actor system built once, carefully, with preview sheets reviewed by the owner |
| Copyright in superhero videos | Original characters only; Sage checks for look-alikes |
| Bigger build delays everything | Phases; phase 1 is usable on its own |

## 14. Left to the builder

- Exact actor rig (bones/parts), file layout, parameter names.
- Which ~10 places first if the list must shrink, and their variants.
- How dialogue lines map to scenes in `manifest.json`.
- Effect implementations; caption pill style details.

## 15. Decisions from the builder check (my calls)

1. **Authoring is library-first, data-driven.** Places, actors, effects and overlays are
   kit components configured from `shots.json`; Flip's per-scene module mostly *composes*
   kit calls (`place`, `actor`, `moves`, `effects`, `camera`) and draws custom SVG only for
   items the library lacks. This is what makes the 1–1.5 h target reachable; the spike was
   slow because everything was hand-drawn.
2. **`action` is structured.** Each beat keeps a free-text `action` (for humans) **plus**
   `moves`: a list from a controlled vocabulary tied to the kit —
   actors (`enter`, `exit`, `walk_to`, `run_to`, `jump`, `fly_to`, `fall`, `point`,
   `gesture`, `react:<expression>`, `hold:<prop>`, `use:<prop>`, `say`),
   effects (`burst`, `rings`, `pulse_along`, `speed_lines`, `splash`, `sparkle`, `smoke`,
   `glow`), overlays (`tag_follow`, `label`), camera (`push_in`, `pull_out`, `follow`,
   `cut`, `dive`). Anything else is `custom:<name>` and needs a drawn module.
   `shots validate` fails a beat with no `moves` (the show-don't-tell check is mechanical);
   Sage still judges whether the moves *show* the sentence.
3. **The spike is a reference, not a base.** Its files are copied into
   `docs/hf/spike-world/` for reference; the actor system is rewritten in `hf-kit/src/`
   with tests, per-instance ids and the full motion set.
4. **Style lock checkpoint in phase 1.** After the host (full body, 3 outfits, motion
   sheet) and the first 2 places are built, the owner sees preview sheets on the board and
   approves the style before the other places are drawn. Up to 2 redraw rounds are planned.
5. **Migration:** `shots.json` gets `"schema": 2`; schema 1 still validates and builds,
   so the current agents and the three test videos keep working until phase 1 switches
   the agents over. Old scene modules stay as overlay sources. Remotion is untouched.
   The three fixtures are remade in the new look in phase 1.
6. **Checks:** overlap is automated — the snapshot tool reports any tag or label box that
   covers an actor's face or another label, and Sage treats it as must-fix. Character
   originality and audience suitability are Sage's visual and script review.

## 16. Open questions

- None. Ready for owner approval.
