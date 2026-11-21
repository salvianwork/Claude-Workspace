# HyperFrames Switch — Design

**Date:** 2026-11-21
**Status:** Waiting for owner approval
**Builds on:** `2026-11-19-video-agent-team-design.md` (pipeline) and
`2026-11-20-studio-dashboard-design.md` (studio)

---

## 1. Intent and why

The owner wants videos that are **fully animated, natural and attractive** —
illustrated scenes that move and explain, not text slides. A 15-second test
(volcano) showed the difference: a hand-built illustrated scene with a moving
camera and labels timed to the narration looked far better than our template
version. The owner chose to build that look with **HyperFrames** (HTML → video,
by HeyGen, Apache-2.0) instead of extending Remotion.

## 2. Goals, non-goals, anti-goals

**Goals**
- Every scene is an **animated illustration** of the idea being explained,
  with a **camera** (push-in, pan, follow, pull-out) and **labels that appear on
  the word** the narrator says.
- The presenter (same look: glasses, curly hair, light tan skin, blazer or lab
  coat) appears and lip-moves with the voice, as today.
- Captions stay on, now timed word by word.
- The rest of the pipeline is unchanged: Quill, Echo, Sage, the owner's two
  approvals, music/sound mixing, the studio dashboard.

**Non-goals**
- HyperFrames' paid features (HyperFrames Pro, HeyGen voices/music/avatars,
  `style-sampling`, `reverse-any-video`) and its Studio app.
- Photo-realistic footage or downloaded images (all drawn in code, as now).
- Interactive videos (an MP4 can't be clicked).

**Anti-goals (a failure even if it "works")**
- An illustration that is **scientifically wrong or misleading** (e.g. a
  volcano diagram with the magma chamber in the wrong place).
- Camera motion that is dizzying or fights the narration.
- Labels or animations out of sync with the words.
- Anything sent to the internet during a render (code, fonts, usage data).
- A video that takes so long to make that the owner stops using the tool —
  target about 1.5–3 h per 2-minute video at first, faster as the prop library
  grows (§12).

## 3. Constraints

- Windows PC, Node ≥ 22 (HyperFrames requirement; the setup already installs
  Node LTS 22), FFmpeg, Python 3.12 venv.
- HyperFrames core only (Apache-2.0); **telemetry off**
  (`HYPERFRAMES_NO_TELEMETRY=1` set by our render tool).
- **Offline renders:** HyperFrames' default project loads GSAP from a CDN and
  fonts from Google Fonts; we vendor both locally (GSAP is free to use,
  including commercially; fonts under the SIL Open Font Licence).
- Lemo-Opuscar's guides are licensed non-commercial: we may use the installed
  skill for ideas, never copy its text into the repo.
- 1920×1080, 30 fps, captions on, presenter rules from the pipeline spec §6.6.

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. HyperFrames as the animation engine** for Design + Animator; everything else unchanged | 450-block registry, agent tooling (`check`, `snapshot`), strong motion guidance; full rebuild of the visual layer and presenter | **Chosen by the owner** |
| A′. Keep Remotion, add illustrated scenes + camera + word-timed labels | Same visual result per the test, less rebuilding (Claude's recommendation) | Not chosen |
| B. Lemo-Opuscar makes the whole film | Fast to wire; loses review gates, approvals and presenter | Rejected |

The test showed the look comes mostly from **custom illustrated scenes**, not
from the framework; this design therefore puts most effort into how Iris plans
and Flip draws scenes.

## 5. What changes, agent by agent

**Quill (Story) — unchanged.**

**Echo (Voice) — one addition.** After recording, run a new tool that writes
**word timings** (`02-voice/words.json`: each word's start/end in seconds per
scene), using the local Whisper already installed for checks. These drive
labels, captions and camera cues.

**Iris (Design) — plans shots instead of choosing templates.** For each scene
the storyboard becomes a **shot list**:
- *Illustration brief:* what is drawn, as layers (e.g. sky, mountain, cut-away
  rock, magma chamber, vent), with the facts it must show correctly.
- *Camera:* a few keyframes (start framing → moves → end framing) tied to words.
- *Cues:* which label/arrow/highlight appears on which word.
- *Blocks:* HyperFrames registry blocks to reuse (transitions, kinetic text,
  charts, maps) where they fit.
- Presenter pose/outfit/position (as today), sound plan (as today).
Output files: `03-design/shots.json` (machine-readable) and `storyboard.md`
(readable), `style.json`, `sound.json`.

**Flip (Animator) — builds a HyperFrames project per video.**
- In `04-video/hf/`, using a shared **studio kit** (§6): one composition, one
  HTML/SVG/JS module per scene drawing its illustration from the brief, the
  camera and cues from `shots.json` + `words.json`.
- **Custom drawing per video is now expected** (this replaces the v1 "no
  custom components" rule); shared parts come from the kit so every video
  looks consistent.
- Self-check before Sage: `hyperframes check` must pass, and Flip looks at a
  snapshot of every scene (start / middle / end) and fixes problems first.
- Render a silent MP4 with HyperFrames; the existing audio mix and mux step
  then adds voice, music and effects exactly as today.

**Sage (Reviewer) — updated gates 3 and 4.**
- Gate 3 (shot list): every key claim is visualised; illustration brief is
  factually right (web-checked for anything non-obvious); camera moves are
  calm and purposeful; every cue's word exists in `words.json`.
- Gate 4 (video): as today (sync, overlap, loudness, credits) **plus**
  `hyperframes check` passed, illustrations match the brief, labels land on
  their words (±0.3 s), no dizzying motion.

**Orchestrator, dashboard, owner approvals — unchanged.** (Flip's studio
animation reads "rendering" as before.)

## 6. The studio kit (shared, reused by every video)

`hf-kit/` — a small HyperFrames library in the repo:
- **Presenter** redrawn as an HTML/SVG component with the same parts, poses,
  expressions, outfits and mouth shapes as today (mouth driven by the existing
  `mouth.json`, converted to time).
- **Scene shell:** safe margins, presenter area vs content area (same layout
  rules as now), caption bar.
- **Camera helper:** keyframe interpolation (ease in/out), "follow" a point,
  limits on speed/zoom so motion stays calm.
- **Cue helper:** show/hide labels, arrows, highlights at word times.
- **Captions:** word-highlighted, from `words.json`.
- **Style tokens:** colours, fonts (bundled locally), sizes — the current
  dark-navy + warm-orange look by default.
- **Illustration helpers:** gradients, simple shading, outlines, particles
  (bubbles, sparks, smoke) so scene drawings look consistent and rich.
- Vendored GSAP and fonts; pinned `hyperframes` version; telemetry off.

## 7. What happens to Remotion

Kept **as a fallback until the owner approves the first three HyperFrames
videos**, then removed in a separate cleanup (templates, Remotion presenter,
related tests and docs). This avoids being left without a working renderer
if HyperFrames disappoints on Windows. *(My call; owner can choose to remove
it immediately.)*

## 8. Testing

- Kit: unit tests for camera/cue/caption timing maths; snapshot images of the
  presenter in every pose and of a sample scene, checked by eye.
- A fixture video (the volcano scene + two others: a chart scene and a
  process scene) rendered end-to-end in the cloud and checked by eye; render
  time recorded.
- Word timings: test on a real Kokoro recording that words and times match.
- Owner on Windows: setup check, one full `/make-video`, render time noted.

## 9. Left to the builder

- Exact kit API and file layout inside `hf-kit/`.
- Which registry blocks to adopt for the first version.
- How snapshots are captured for Flip's self-check (HyperFrames CLI vs our own
  Playwright helper).

## 10. Risks

| Risk | Mitigation |
|---|---|
| Custom illustrations vary in quality from video to video | Shared kit + illustration helpers; shot-list review at gate 3; Flip's snapshot self-check; owner sees the result |
| Wrong facts in drawings | Fact list in each illustration brief; Sage web-checks; anti-goal |
| Much slower per video (custom code per scene) | 90-minute target tracked on the fixture video; reuse of kit parts; registry blocks where they fit |
| HyperFrames render problems on Windows | Owner test early; Remotion fallback kept until 3 approved videos |
| Hidden network use (CDN, fonts, telemetry) | Vendored assets, telemetry env var, a test that renders with the network blocked |
| HyperFrames upstream changes | Pinned version; upgrade only on purpose |

## 11. Decisions from the builder check (my calls unless noted)

1. **Presenter is ported** to an HTML/SVG kit component. Target: *visually
   equivalent*, not pixel-identical — checked side by side against renders of
   the current Remotion presenter for every pose, expression, outfit and mouth
   shape (the Remotion version stays available as the reference while it
   remains as fallback).
2. **Word timings come from Kokoro itself** (its per-token timestamps match
   the recorded audio and the script text exactly); local Whisper is the
   fallback. Cues reference `scene` + `word index` (with the word's text kept
   alongside for readability), so repeated words are unambiguous.
3. **One composition per video.** Scenes are sequenced inside HyperFrames;
   scene lengths equal the voice manifest durations; transitions happen within
   scene time so timing never shifts. HyperFrames renders one silent MP4; the
   existing mix + mux step is unchanged.
4. **Why HyperFrames (owner's choice):** its registry blocks, `check` /
   `snapshot` loop and motion guidance are used directly — the package is a
   real dependency, pinned.
5. **Offline means at render time.** Registry blocks are added once during
   the build and committed into `hf-kit/`; GSAP and fonts are vendored.
6. **Windows render check comes early:** the owner's checklist starts with a
   one-command test render of the kit sample on the PC, as soon as the kit
   exists, before the agents are switched over.

## 12. Owner decision: hero scenes + kit + prop library

- Each video has **2–4 custom-drawn "hero" scenes** (the moments that carry
  the explanation, e.g. the eruption, the heart pumping). Iris marks them in
  the shot list; Sage checks the choice at gate 3.
- **All other scenes use kit and registry pieces**: charts, step-by-step
  diagrams, comparisons, kinetic text, transitions — still animated, with
  camera and word-timed cues.
- **Prop library:** every custom illustration Flip draws is saved as a
  reusable, parameterised prop in `hf-kit/props/<name>/` (with a preview
  image and a one-line description). Iris checks the library first and reuses
  or adapts a prop before asking for a new drawing, so videos get faster over
  time.
- **Time target:** about 1.5–3 hours per 2-minute video at first, falling as
  the library grows. Real times are measured on the fixture videos and
  reported to the owner.

## 13. Open questions

- None. Ready for owner approval.
