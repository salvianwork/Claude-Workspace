# Vertical Short-Form (TikTok / YouTube Shorts) — Design

**Date:** 2026-11-24
**Status:** Approved by owner 2026-11-24
**Builds on:** `2026-11-21-world-kit-and-video-types-design.md` (world kit, phase 1),
`2026-11-24-feedback-notebook-design.md`; agreed notes in `docs/roadmap/vertical-phase-notes.md`.

## 1. Intent and why
The owner's goal is posting on **TikTok and YouTube Shorts**. Today every video is landscape
1920×1080, which shows tiny with black bars on a phone. This phase makes the team produce
**vertical 1080×1920 videos built for phones**: framed for a tall screen, captions clear of the
apps' buttons, a fast hook, 45–75 s, and a host whose face reads at phone size.

## 2. Goals, non-goals, anti-goals
**Goals**
- Vertical 1080×1920 is the **default** for every new video; landscape 1920×1080 stays
  available on request (`--format landscape`).
- The approved places get **taller** (extended up and down) so the camera can still pull out,
  reveal and move vertically.
- Captions, labels and tags always sit inside the **safe zone** (not under app buttons/text),
  checked automatically.
- A **short recipe**: hook in the first 2 s, one idea every 5–8 s, 45–75 s, an ending that
  invites a rewatch or comment.
- The host's **phone-ready refresh** (owner approved): head ~20% bigger, bolder brows/eyes/mouth,
  softer body; keeps curly hair, skin `#F0CDAE`, clean jaw, chunky lime acetate glasses.

**Non-goals**
- Producing both formats from one run (owner chose vertical only, option A).
- Redrawing places from scratch (owner chose extending them, option 1).
- Publishing/upload, titles, hashtags, cover (that is Pip, the next phase).
- Vertical for the Remotion fallback (it stays landscape-only).

**Anti-goals**
- Captions or labels hidden under TikTok/Shorts buttons or text.
- Cramped shots with no pull-out or reveal (the owner asked for a dynamic camera).
- A host too small or too subtle to read on a phone.
- Visible seams where a place was extended.
- Breaking landscape videos or existing fixtures.

## 3. Constraints
- Everything from the world-kit phase still holds (offline render, telemetry off, pinned
  HyperFrames 0.9.72, classic-script kit, Windows-safe, no settings.json widening, Lemo text
  never copied, owner approvals unchanged, lessons notebook read by every agent).
- 30 fps; frames = ceil(duration × 30) as today.

## 4. Approaches
| Approach | Trade-off | Decision |
|---|---|---|
| **1. Extend existing places up and down** | Keeps approved art; camera gets room; medium work; extensions simpler than the centre | **Chosen by owner** |
| 2. Redraw all 11 places tall | Best vertical look; roughly the original drawing effort again; restarts style approval | Rejected |
| 3. Crop existing places only | Cheapest; no pull-outs or reveals, cramped | Rejected (against dynamic camera) |

Formats: vertical-only per video with landscape on request (**owner: A**) vs both every time (B, rejected).

## 5. Design

### 5.1 Format switch
- `03-design/shots.json` (schema 2) gains top-level `"format": "vertical" | "landscape"`;
  default `vertical`. `/make-video` gains `--format landscape` (default vertical), stored in the
  run like `type` and `audience` and shown at script approval.
- The kit's canvas becomes per-composition: `HFKit.CANVAS` is set from `data.canvas`
  (`1080×1920` or `1920×1080`). Everything that assumed 1920×1080 (layout, captions, camera,
  overlays, world, presenter slot, overlap checker, build, render, snapshot) reads the canvas.
- Schema-1 videos and landscape schema-2 videos render exactly as today (golden checks).

### 5.2 Taller places
- Each place's world grows from 3840×2160 to **3840×3600**: about **720 px of extension above**
  (sky: gradient continued, clouds, birds or stars, sun/moon placement unchanged) and **720 px
  below** (ground: soil/rock strata, roots, deeper water, floor, etc., per place).
- The original drawing stays untouched in the middle band; all existing anchors and paths move
  down by the top extension automatically (the contract adds the offset), so shot lists keep
  using the same anchor names.
- Each place declares `meta.extend` (what is drawn above/below) and gets a new sheet section
  showing the full tall world and three vertical shots (wide, mid, close).
- Extensions must blend without seams; any place that looks weak can be properly redrawn later.

### 5.3 Vertical camera and layout
- Same zoom range (0.6×–5×) and the same smooth, peak-limited motion (2.5×/s zoom, pan limit,
  dives 4×/s), applied to a tall frame: at 0.6× the view is 1800×3200 world px, which the taller
  world now covers.
- Default framing moves the action to the **middle band** of the frame; vertical pans (sky →
  ground, top → bottom reveals) become first-class moves (`pan_up`, `pan_down` added to the
  moves vocabulary; `follow` and `dive` work as before).

### 5.4 Safe zones and captions (vertical)
- **Safe zone** (my call, conservative across both apps): text and labels stay inside
  x 64–940, y 200–1420 of the 1080×1920 frame — clear of the right-side button column, the
  bottom caption/username area and the top bar.
- **Captions** sit in the lower-middle of the safe zone (around y 1180–1400), 64 px, max width
  about 860 px, two lines max, word highlight as today.
  > 2026-11-25 owner: host bigger in vertical (face zone 1060–1400, captions 840–1020).
  > 2026-11-26: captions use a top band (y 220–400, `HFKit.VERTICAL.captionTopBand`) while the host is out of his slot (stepping in, walking, in the world); 0.2 s fade, never in both bands; back to 840–1020 when he returns to the slot.
- `python -m tools.hf.snapshot <run> --safe-zone` reports any caption, label or tag box outside
  the safe zone (like the overlap report; exit 1 if any). Sage treats it as must-fix.

### 5.5 Host in vertical
- No side slot. Default host position: **lower part of the frame**, shown from about the waist
  up, beside the action (left or right of centre, alternating as the shot list says), and he can
  still step into the world (1–2 step-ins per video as today).
- He must never cover captions or tags (overlap check) and never sit in the bottom unsafe band.

### 5.6 Host phone-ready refresh (style check first)
- Head about 20% bigger relative to the body; bolder eyebrows, larger eyes, clearer mouth shapes;
  slight waist taper, softer casual sweater, softer/bendier arms. Same face design, curly hair,
  skin `#F0CDAE`, clean jaw, chunky lime acetate glasses (`#9CD62B`).
- Applies to both formats (one host).
- **Owner style check:** before/after sheet of the host (all outfits, key poses, walk) plus two
  extended places (countryside, lab) in vertical shots. Up to 2 rounds of changes before the
  rest of the places are extended.

### 5.7 Short recipe and agents
- **Quill:** for vertical, a **short** recipe: hook in the first 2 s (a question or surprising
  fact), one idea per 5–8 s, 45–75 s total (hard limits 30–180 s), last line invites a rewatch or
  comment. Explainer and what-if types both have a short version.
- **Iris:** frames every shot for the tall screen (action in the middle band, vertical reveals),
  respects the safe zone, uses the extended places.
- **Flip:** builds/renders vertical; runs `snapshot --overlap` and `--safe-zone`.
- **Sage:** gate 1 checks the hook (first sentence ≤ ~2 s of speech, compelling) and length;
  gate 3 checks vertical framing; gate 4 checks safe zone, readability on a phone-size preview,
  hook timing.
- **Make-video:** `--format`; everything else unchanged (approvals, notebook, resume).

### 5.8 Fixtures and tests
- Remake two world fixtures vertically (speed of sound, the Moon what-if) plus one new short
  explainer written to the short recipe; contact sheets and timings recorded.
- Tests: vertical canvas maths, extended-place contract (offset anchors, seams sampled), safe-zone
  checker, golden checks that landscape output is unchanged.

## 6. Order of work (for the plan)
1. Format switch in the kit and tools (landscape unchanged).
2. Host refresh + countryside and lab extended → **owner style check**.
3. Remaining 9 places extended; vertical camera moves; safe zones and captions.
4. Agents and short recipe.
5. Vertical fixtures, timings, docs; final review; owner approves → merge.

## 7. Risks
| Risk | Mitigation |
|---|---|
| Extensions look plain or seamed | Per-place drawing above/below, sheet review, owner style check on two places first |
| Real app UI differs from the safe zone | Conservative margins; easy to tune in one place |
| Bigger head changes approved look | Same face design; owner before/after approval |
| Landscape regressions | Golden checks on existing fixtures |
| 45–75 s feels rushed for some topics | Hard limit up to 180 s; Quill can propose longer with a reason |

## 8. Left to the builder
- Exact extension drawings per place, safe-zone numbers tuning within the stated box, new move
  parameter names, file layout.

## 9. Decisions from the builder check (my calls)
1. **Goldens and the host refresh.** Step 1 captures goldens before any change and proves the
   format switch leaves landscape/schema-1 output byte-identical. The host refresh (step 2) is an
   intended change: after the owner approves it, goldens and parity images are re-baselined in
   the same commit, with the reason in the message. No old-look version switch is kept.
2. **One host.** The refresh is done in the shared face/body parts, so the side presenter and the
   world actor both get it. In vertical, the host is the **world actor** placed in a new
   screen-anchored **"bottom" slot** (the rig already supports slots); landscape keeps its side
   slot.
3. **Host, captions and safe zone.** The safe zone binds **text only** (captions, labels, tags).
   In vertical the host stands in the left or right lower part, cropped by the frame bottom, with
   his **face between y ≈ 1150 and 1400** (above the apps' bottom text band). Captions move up to
   the **middle-lower band (y ≈ 940–1120)** so they never cover his face; the overlap check keeps
   flagging any text on a face. Exact numbers are tuned on the vertical sheets within these bands.
   > 2026-11-25 owner: host bigger in vertical (face zone 1060–1400, captions 840–1020).
4. **Wide shots in a narrow frame.** The zoom floor stays 0.6×. A tall frame shows about 1800
   world px across, so "wide" in vertical means **tall reveals and pans**, not side-by-side.
   Shot validation **warns** when anchors used in one shot are more than about 1700 px apart
   horizontally; Iris plans a pan or a cut instead (e.g. rail-near → pan → rail-far).
5. **Non-world kit scenes** (title/chart/compare/…) are schema-1 only and stay landscape. Vertical
   videos are schema-2 world scenes only (old kit pieces still usable as overlays inside a world).
6. **Remotion fallback.** It stays landscape-only. If a vertical HyperFrames build/render fails,
   the run stops with the error on the board/chat (stuck-gate flow); the owner may choose to
   re-run as landscape. No silent switch of format.
7. **Indoor and special places** (lab, home, classroom, inside-body, space, ocean underwater) get
   ceiling/floor (or space/deep-water) extensions that must pass the **same seam and quality
   review** on the sheets as outdoor places; simpler detail is fine, visible seams are not.
8. **Owner gate.** One plan end to end; the owner style check after step 2 is a blocking task
   (as in the world-kit phase), up to 2 rounds.

## 10. Open questions
- None. Ready for owner approval.
