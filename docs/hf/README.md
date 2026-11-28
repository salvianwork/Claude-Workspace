# HyperFrames fixture videos

Three short test videos made end to end with the real tools, as a run would make them: script →
Kokoro voice (`am_adam`, speed 1.0, `.venv-voice`, offline) → shot list, style and sound →
`tools.hf.shots validate` → `tools.hf.build` (with `hyperframes check`) → `tools.hf.snapshot` →
`tools.audio.mix` → `tools.render.render --engine hyperframes`. Telemetry off
(`HYPERFRAMES_NO_TELEMETRY=1`), nothing loaded from the network at render time.

| Fixture | Inputs | What it tests | Contact sheet | Video (not in git) |
|---|---|---|---|---|
| volcano | `tests/fixtures/hf/volcano/` | 2 hero scenes reusing the library prop `volcano` (camera focus, phases, labels) + recap | `fixture-volcano-sheet.png` | `fixture-volcano.mp4` |
| chart | `tests/fixtures/hf/chart/` | kit only: bar chart, compare, kinetic text | `fixture-chart-sheet.png` | `fixture-chart.mp4` |
| process | `tests/fixtures/hf/process/` | title, one new hero drawn in the run (`04-video/hf/scenes/scene-2.js`, prop `cloud-formation`, moving anchor followed by camera and label), cycle diagram | `fixture-process-sheet.png` | `fixture-process.mp4` |

The wavs, `04-video/` outputs and mp4s are git-ignored; to remake a video, run the voice step
and then the commands above on the fixture folder. The chart and process fixtures have fewer
than 2 heroes on purpose (they test kit scenes and one new drawing), so they are built and
rendered with `--allow-hero-count`; `tools.hf.shots validate` (which has no such switch) reports
the hero rule as their only problem. `cloud-formation` was **not** saved to `hf-kit/props/`:
props are saved only after the owner approves a video.

## Timings (cloud machine: Linux, 4 CPUs, 15 GB RAM; render workers = 2, the default half of the CPUs)

| Fixture | Length | Scenes (heroes) | Voice (synth) | Build + check | Render (`hyperframes render`) | Render ÷ length |
|---|---|---|---|---|---|---|
| volcano | 21.3 s | 3 (2) | 114 s (first call: model load) | 18.8 s / 18.3 s | 220.1 s / 155.6 s (two runs) | 10.3× / 7.3× |
| chart | 22.7 s | 3 (0) | 11.6 s | 13.0 s | 153.3 s | 6.8× |
| process | 20.7 s | 3 (1) | 12.2 s | 11.3 s / 11.2 s | 122.9 s / 139.0 s (two runs) | 5.9× / 6.7× |

- Build = `python -m tools.hf.build` including `hyperframes check`. Snapshots (9 PNGs) took about
  9 s per video; the audio mix a few seconds. The full `tools.render.render` call adds about
  1.5 s (its own build and the ffmpeg mux) to the render time above.
- Render time varies between runs on the same machine (volcano: 220 s, then 156 s). The heavy
  scenes are the drawn heroes with many particles (the eruption).
- Authoring (writing the script, shot list and the hero drawing, looking at snapshots) is not
  included; it will be measured on the first real `/make-video` run.

### Is 1.5–3 h per 2-minute video realistic?

On this machine the render is about **6–10× the video length**, so a 2-minute video renders in
about **12–20 minutes**, plus about 1–2 minutes of voice, builds, checks and snapshots. With one
re-render after a review round, the machine time is roughly **30–45 minutes**. That leaves
about 1–2 hours for the agents' authoring and reviews inside the 1.5–3 h target, which looks
reachable but is **not proven** here: authoring time was not measured, a 2-minute video has
6–10 scenes (2–4 drawn heroes, each new one written from scratch), and the owner's Windows PC
may render slower or faster than this cloud machine. The first real `/make-video` run
(TEST-CHECKLIST step 4) gives the real number.

## Problems found and fixed

- **volcano, scene 1:** a zoom of 1.5 on the chamber followed by a move back made the camera
  finish after the scene (the kit keeps moves calm, so big moves take time); the validator
  caught it. Zoom reduced to 1.25 and the move back starts on "As".
- **volcano, scenes 1–2:** zooming onto the magma tip or the lava pushed the chamber behind the
  captions. Scene 1 now pulls back to wide as pressure builds; scene 2 focuses on the crater.
- **volcano, scene 2:** the "Lava" label first pointed at the bare right flank (the flows had
  not reached it yet when the word "lava" is said). It now points at the lava fountain at the
  crater.
- **process, scene 2:** the vapour wisps were too faint to see and its label sat on the
  captions; wisps made a little stronger (still faint: vapour is invisible), the label moved
  above-right, and the rising-air arrow made more visible.

## Known limits (not fixed)

- No music is installed in the cloud copy of the audio library, so the mixes used a generated
  stand-in pad (a scratch library outside the repo, not committed). On the owner's PC the real
  library is used.
- The voice check (`tools.review.transcript voice`) flags spelling only: "metres" heard as
  "meters" (chart) and "vapour" as "vapor" (process); the audio is right.
- chart: on a 0–6,000 m/s scale the air bar (343 m/s) is very small. That is the true ratio.
  Bar values count up, so a frame taken mid-animation shows an in-between number.
- volcano prop: the "new layer" on the cone is subtle; its `lava` anchor is a fixed point on
  the right flank.

## World look (World Kit phase 1, schema-2 shot lists)

Four short test videos made end to end the way the agent team makes them, following the agent
files step by step (story → voice → design → animator): script with key claims (`checks story`),
Kokoro voice `am_adam` at speed 1.0 (`.venv-voice`, `HF_HUB_OFFLINE=1`) checked with
`tools.review.transcript voice`, a schema-2 world shot list with storyboard, style and sound
(`tools.hf.shots validate`), then `tools.hf.build` (with `hyperframes check`), `tools.hf.snapshot`,
`tools.hf.snapshot --overlap`, `tools.audio.mix` and `tools.render.render --engine hyperframes`.
No reviewer subagents were run (this was a supervised fixture task); I looked at every snapshot
set and contact sheet myself and fixed what I saw (below).

| Video | Inputs | Type, places | Host step-ins | New drawing | Contact sheet | Video (not in git) |
|---|---|---|---|---|---|---|
| sound | `tests/fixtures/hf/world/sound/` | explainer; countryside (rings, ripples, pulse, two dives into lattice gas and solid) | 2 (scenes 1, 3) | none (kit only) | `world-sound-sheet.png` | `world-sound.mp4` |
| volcano | `tests/fixtures/hf/world/volcano/` | explainer; new place `volcano` (adapted from the prop) | 1 (scene 1) | place `volcano` + customs `magma-rise`, `eruption` | `world-volcano-sheet.png` | `world-volcano.mp4` |
| process | `tests/fixtures/hf/world/process/` | explainer; ocean surface, then the sky over the same sea (cloud, rain back into the sea) | 1 (scene 4, on the boat) | customs `air-parcel`, `droplets`, `cumulus`, `rain` | `world-process-sheet.png` | `world-process.mp4` |
| whatif | `tests/fixtures/hf/world/whatif/` | what-if; space, ocean, forest `moonless` (stars), rooftop-night | 1 (scene 3) | customs `moon-vanish`, `tide-gauge`, `axis-wobble` | `world-whatif-sheet.png` | `world-whatif.mp4` |

All four: `shots validate` OK with no warnings, `hyperframes check` clean, overlap report `[]`,
`tools.audio.measure` no problems, render log ends with `video written` and has no warning or
error line. The scripts are deliberately 51–67 words (15–30 s), so `checks story` reports only
the 150–450-word rule and the voice is under the 60–180 s range of a real video. The `volcano`
place was **not** saved to `hf-kit/places/` (places are saved only after the owner approves a
video); it lives in the fixture as `04-video/hf/scenes/place-volcano.js`. Music: the same
generated stand-in pad as above (a scratch library outside the repo); no sound effects were
planned (every possible spot was within 0.6 s of a key word).

### Timings (same cloud machine: Linux, 4 CPUs, 15 GB RAM; render workers = 2)

Authoring = wall clock of my own work (reading the plan and the kit is counted once, as shared
setup), from the first script line to a shot list I was happy with after looking at the frames.
The render column is `hyperframes render took … s` from `render.log`; the full
`tools.render.render` call adds its rebuild, `hyperframes check` and the mux.

| Video | Length | Scenes | Authoring (wall clock) | Voice synth | Build + check | Render (`hyperframes render`) | Full render call | Render ÷ length |
|---|---|---|---|---|---|---|---|---|
| shared setup | – | – | 4.5 min reading + 4 min four scripts (fact search) + 5 min voice and transcript checks | – | – | – | – | – |
| sound | 22.7 s | 3 | ≈ 4 min shot list + 3 look/fix rounds | 44 s (first call: model load) | 61 s | 231 s | 289 s | 10.2× |
| volcano | 21.3 s | 3 | ≈ 6 min: new place + 2 customs (from the prop) + 3 look/fix rounds | 13 s | 33 s | 135 s | 168 s | 6.4× |
| process | 25.2 s | 4 | ≈ 3 min + 3 look/fix rounds | 14 s | 42 s | 93.0 s / 87.9 s (two runs) | 130 s / 124 s | 3.7× / 3.5× |
| whatif | 26.3 s | 5 | ≈ 6 min: 3 customs + 5 look/fix rounds | 13 s | 45 s | 93.8 s / 86.1 s (two runs) | 139 s / 126 s | 3.6× / 3.3× |

Snapshots (start/mid/end per scene) took 9–12 s per video, the overlap report about 1.5 s, the
mix a few seconds. Storyboards, notes and the final checks took about 8 minutes for all four.

**After the final-review fix wave** (all four re-rendered; same machine, one render at a time):

| Video | Length | Voice re-synth | Build + check (first build after a change) | Render (`hyperframes render`) | Full render call | Render ÷ length |
|---|---|---|---|---|---|---|
| sound | 22.7 s | – (unchanged) | ≈ 25–30 s | 183.4 s | 223 s | 8.1× |
| volcano | 21.3 s | – (unchanged) | ≈ 25–30 s | 250.9 s | 272 s | 11.8× |
| process | 24.6 s (was 25.2) | scene 2: 107 s (first call: model load) | 24 s | 78.1 s | 104 s | 3.2× |
| whatif | 26.5 s (was 26.3) | scene 2: 8 s | 31 s | 71.0 s / 73.7 s (two runs) | 104 s / 105 s | 2.7× / 2.8× |

Snapshots took about 7–10 s per video, the overlap report about 2 s, the mix about 2 s. A
build with nothing changed reuses `hyperframes check`'s cache and takes under a second.

### Against the target (3–4 h per 2-minute video at first, falling toward 1–1.5 h)

All in, the four videos (about 95 s of finished video, 15 scenes) took about **45 minutes of
authoring** (shared setup included) and about **15 minutes of machine time** (voice, builds,
snapshots, overlap, mixes, first renders), plus two re-renders after the last fixes. Per minute
of video that is roughly 30 min authoring + 10 min machine. Scaled to a **2-minute video**
(8–10 scenes, 1–2 new drawings): about **1–1.5 h of authoring, 15–20 min of render, 30–45 min
of machine time in all with one re-render** (at 4–10× the length), i.e. **about 1.5–2 h end to end**. That is inside
the 3–4 h first target and close to the 1–1.5 h goal. Honest caveats: this is the agent's own
wall clock working alone, without the five-agent hand-offs, the reviewer's four gates (web
searches, frame checks, transcripts) or the owner's checkpoints, which in a real `/make-video`
run add review rounds and waiting time; and a real 2-minute script needs 4–6× the beats of
these fixtures. Render speed here was 3.3–10× the length (sound, the first and heaviest render, 10×; the
later ones 3.3–6.4×), similar to or faster than the schema-1 fixtures (6–10×); the owner's PC may differ. The first real `/make-video` run (TEST-CHECKLIST 4 and 4b) gives the
real number.

### What I saw and fixed (two or more look/fix rounds per video)

- **sound:** the opening framing (zoom 1.65) cropped the host's head under the title → opens
  at 0.85 and pulls out to 0.7, then pushes in on the strike; the "Water: 1,480 m/s" label sat
  under the captions → moved above the lake, ripples made whiter; the lake push-in cut the
  friend's head (kit warning) → zoom 0.95; the recap framed the bridge and lost the host → frames
  the whole line from `rail-near` at 0.6; a glow on the bridge meant nothing → replaced by the
  friend jumping as the pulse arrives. Speeds on screen are in the true ratio 343 : 1,480 : 5,960
  (rings 172 px/s, ripples 745, pulse 3,000), so the scene needs no "not to scale" tag.
- **volcano:** the chamber sat under the caption band in the wide shots → chamber and vent
  raised; the new-layer outline bridged the crater with a straight line → drawn as two flank
  lines; "New layer" covered the host's head → label on the left of the slope; the recap was a
  dot climbing an empty vent → reuses `magma-rise` and `eruption` (with `vent: false`) so the
  whole story replays in 4.5 s; the host stands at the volcano's foot (farm moved left).
- **process:** the side-slot host hid the boat → right slot; vapour wisps too strong for an
  "invisible gas" → smaller; the storm cloud was half off the top → wider framing (0.62) and a
  darker cloud; rain streaks too pale to read → bluer, more of them (second render).
- **whatif:** the "not to scale" label was hidden at the bottom → on `open`; "Without the
  Moon" covered the host's face → host in the right slot; the forest night variant draws a Moon
  in the sky layer, and the pull-out showed it (wrong for "no moonlight") → a tight framing that
  keeps the sky out, label "No moonlight" rides the host; the swinging axis left the frame
  after a push-in and crossed the space station → no push-in, axis centred, swing 12°; the
  rooftop glow lit an empty spot instead of the Moon → removed, the host points up from the slot
  with the real Moon in frame; after the Moon vanished a dark disc showed on the Milky Way →
  soft-edged cover with a few faint stars (second render).

### Final review fixes (one fix wave)

- **process, physics:** "Higher up, the air is colder, so it cools as it climbs" was wrong
  (rising air cools mainly because it expands as the pressure drops) → scene 2 now says "As it
  rises, the air spreads out and cools." (script, voice copy, key claim, facts; scene 2
  re-recorded and re-timed).
- **process, look:** out of the fairy-tale `sky-fantasy` into one natural setting: the sea by the
  boat, then the sky over the same sea (the `ocean` place has a new `sky` anchor, right of the
  mast). New customs in the fixture: `air-parcel` (a bubble of warm air that swells and turns
  from orange to blue as it climbs), `droplets`, `cumulus` (a real cumulus: flat base, puffy
  heaped top, billowing up; later grey and heavy) and `rain` (from the cloud base back into the
  sea beside the boat, with rings where it lands). No rainbow. The host steps onto the boat in
  scene 4 (1 step-in).
- **whatif:** the tide claim is now "a third to a half" (the Sun's tide is about 0.46 of the
  Moon's; scene 2 re-recorded and re-timed; the gauge shows two orange bands for the new range,
  label "Tides: 1/3 to 1/2"); scene 3 uses the forest's new `moonless` variant (no Moon, many
  stars and the Milky Way, lower far woods, darker starlit actor) and pulls back to show the
  starry sky; scene 4's axis leans left so it never crosses the space station, and the place's
  Moon stays covered (`moon-vanish` with `gone: true`) because it is still the Moon-free world.
- **All four, livelier host:** `gesture` / `point` / `react` on key words in most beats, and a
  kit default: while the narration speaks and the side-slot host has no other pose, he uses
  the talk pose, gently varied, instead of standing with his hands clasped.
- **Kit bug found on the way:** `point` at another actor crashed the compile (no tracks yet in
  the first pass) → it uses where that actor starts; tested.

### Known limits (not fixed)

- whatif: the axis swing (6° each way around a 9° lean) and its drawn tilt are illustrative; the narration
  says only "far less steady" (studies differ on how large the swing would be).
- volcano: the eruption's sub-timings (`flow`, `cool`, `grow`) are seconds after the burst
  word, taken from the word times; a re-recorded voice would need them updated.
- The transcript check flags spelling only ("metres"/"meters", "vapour"/"vapor").

## Vertical (Vertical Short-Form, 1080 × 1920 shorts)

Three vertical shorts made end to end the way the agent team makes them, following the agent
files step by step for `format: vertical` (the default): a script to the **short recipe** (hook
of about 2 s as the first sentence, one idea per 5–8 s, a last line that invites a rewatch or a
comment, `checks story --format vertical`), Kokoro voice `am_adam` at speed 1.0 (`.venv-voice`,
`HF_HUB_OFFLINE=1`) checked with `tools.review.transcript voice`, a vertical schema-2 shot list
(bottom slots, tall reveals with `pan_down` / `pan_up`, tags and labels clear of the active
caption band), then `tools.hf.shots validate`, `tools.hf.build` (with `hyperframes check`),
`tools.hf.snapshot`, `--overlap`, `--safe-zone`, `tools.audio.mix` and
`tools.render.render --engine hyperframes --workers 1`. No reviewer subagents were run (a
supervised fixture task); I looked at every snapshot set, extra frames at chosen times and each
contact sheet, and fixed what I saw (below). A fast test (`tests/hf/test_vertical_fixtures.py`)
validates every `tests/fixtures/hf/vertical/*` shot list, warnings included.

| Video | Inputs | Type, places | Host step-ins | New drawing | Contact sheet | Video (not in git) |
|---|---|---|---|---|---|---|
| sound | `tests/fixtures/hf/vertical/sound/` | explainer; countryside (rings, ripples, pulse, dives into gas and solid lattices) | 2 (scenes 2, 4) | none (kit only) | `vertical-sound-sheet.png` | `vertical-sound.mp4` |
| whatif | `tests/fixtures/hf/vertical/whatif/` | what-if; space, ocean surface and underwater, forest `moonless` | 1 (scene 4) | customs `moon-vanish`, `tide-gauge`, `axis-wobble` (from the world fixture) and a new `coral-spawn` | `vertical-whatif-sheet.png` | `vertical-whatif.mp4` |
| short | `tests/fixtures/hf/vertical/short/` | explainer "Why is the sky blue?"; countryside `day` and `sunset` | 1 (scene 5) | customs `white-light`, `wave-hit`, `sky-rays`, `sunset-beam` | `vertical-short-sheet.png` | `vertical-short.mp4` |

All three: `shots validate` OK with no warnings, `hyperframes check` clean, overlap report `[]`,
safe-zone report `[]`, render log ends with `video written` and has no warning or error line,
1080 × 1920 at 30 fps. `sound` and `whatif` keep the facts of the world fixtures (the tide claim
stays "a third to a half"), rewritten as shorts; `short` is new. Music: the same generated
stand-in pad as above (a scratch library outside the repo), no sound effects.

### Timings (same cloud machine: Linux, 4 CPUs, 15 GB RAM; render workers = 1)

Every render ran with `--workers 1`, one at a time: on this machine vertical renders with 2
workers were cancelled under load ("render_cancelled_parent_exited") during Task 6. The render
column is `hyperframes render took … s` from `render.log`; the full `tools.render.render` call
adds its rebuild, `hyperframes check` and the mux.

| Video | Length | Scenes | Voice synth (all scenes) | Build + check | Snapshots / overlap / safe-zone | Render (`hyperframes render`) | Full render call | Render ÷ length |
|---|---|---|---|---|---|---|---|---|
| sound | 52.0 s | 8 | 128 s (first call: model load) | 130 s | 17 s / 2 s / 3 s | 288.8 s | 417 s | 5.6× |
| whatif | 45.5 s | 7 | 19 s (+ 3 short re-records, 10–13 s each, to reach 45 s) | 82–85 s | 16 s / 2 s / 3 s | 408.8 s | 496 s | 9.0× |
| short | 46.5 s | 7 | 21 s (+ 1 re-record, 11 s) | 127 s | 16 s / 2 s / 3 s | 336.5 s | 468 s | 7.2× |

**Re-render after the 2026-11-28 fix wave** (new camera aim and text sizes; same voice and mix; one
render at a time, `--workers 1`, no retry needed):

| Video | Length | Build + check | Snapshots / overlap / safe-zone | Render (`hyperframes render`) | Full render call | Render ÷ length |
|---|---|---|---|---|---|---|
| sound | 52.1 s | 105 s | 15 s / 2 s / 2 s | 451.4 s | 562 s | 8.7× |
| whatif | 45.6 s | 61 s | 13 s / 2 s / 2 s | 398.1 s | 465 s | 8.7× |
| short | 46.6 s | 101–104 s | 14 s / 2 s / 2 s | 262.7 s (first run after the aim change: 353.4 s) | 265 s | 5.6× |

The same machine gave 263–451 s for videos of almost the same length, so treat these as a range
(about 5.5–9× the video's length with one worker), not exact figures.

The audio mix took about 3 s per video. Authoring (my own wall clock, from the first script line
to the last fix): about 10 minutes reading the plan, agent files and kit; 5 minutes for three
scripts; 5 minutes of voice and transcript checks; then about 11 minutes for `sound` (kit only,
3 look/fix rounds), about 20 minutes for `whatif` (one new custom, 3 adapted, 4 rounds) and about
30 minutes for `short` (four new customs, 3 rounds and one bug), partly while the previous video
rendered. In all about **75 minutes for 144 s of finished vertical video**, of which about
**17 minutes of render** with one worker (23 minutes for the full render calls).

**Honest note.** One worker renders a 45–52 s short in 5–7 minutes here (5.6–9× its length;
the space and ocean scenes of `whatif` are the slowest). That is a safe setting, not a fast one:
the landscape fixtures above rendered with 2 workers (3.3–10× their length, not measured
side by side), but vertical renders with 2 workers were cancelled under load on this 4-CPU machine.
The render tool picks its workers in `tools/hf/render.py`: `--workers N` when given
(`tools.render.render` and `tools.hf.render` both pass it through), otherwise half the CPUs (at
least 1), **capped at 2 for a vertical video**. Since the 2026-11-28 fix wave a render that is
cancelled with more than 1 worker (`render_cancelled…`, a worker cancelled) is **retried once
with 1 worker**, with the message "Render was interrupted; retrying with 1 worker, this is
slower." (`render.log` then says `note: the render was interrupted and finished on a retry with
1 worker`). Without `ffprobe` the size check of the finished video cannot run: the render now
prints a clear warning (install FFmpeg) instead of skipping it silently.

### What I saw and fixed (three or more look/fix rounds per video)

The main lesson, for every vertical shot (as first made): a camera move onto an **anchor** put
that point at 55 % of the frame height (y ≈ 1056), right under the caption band, so most anchor
shots opened with a short `pan_down` to lift it. **Fixed in the 2026-11-28 fix wave:** in a
vertical frame the camera now puts an anchor at **y 640** while the host is in his slot (clear
above the captions, 840–1020) and at **y 1040** while he is out of it (the captions are then in
the top band, 220–400); an actor's feet go to y 780 (y 1040 while the host is out). The lift
pans were removed from the three fixtures; the pans left are real reveals or framing choices
(sound scene 1 sky → bridge, whatif scene 2 sky → sea and scene 6, short scenes 5 and 6, the
forest pan up). Near the world's bottom edge at low zoom the camera still clamps, so a target
there sits lower (the lake at zoom 1 sits at y ≈ 870): zoom in a little.

- **sound:** the rail sat under the captions in every anchor shot → the opening pans to the lake
  so the bridge rail lands above the captions; the lake shot is closer (zoom 1.4) with a pan down
  (at zoom 1.0 the world edge stopped the pan); the host's step-ins first framed him small with
  the top caption band over his head → framed on the rail at zoom 1.5 so his head sits below the
  band; "Air: later" covered the friend's face → moved to the rail; the last scene's tag on the
  pulse crossed the captions → framed on the friend instead, the pulse races in.
- **whatif:** the Moon was under the captions and the frame was mostly black → zoom 1.0 and a pan
  down, with Earth's limb behind the host; two labels on the Moon overlapped → left and right; the
  forest walk framed the host tiny in a dark frame → he stands by the log at zoom 1.1 and the view
  pans up to the stars; the axis sat outside the narrow frame and later swung across the space
  station → framed on the Moon's (covered) place, axis leaning −15° with a 5° swing; the rooftop
  Moon of `rooftop-night` stays at the right edge of a vertical frame at any zoom (parallax and
  the world edge) → the last scene returns to the space view of scene 1 with the real Moon back
  (a bookend). New custom `coral-spawn` (pink bundles rising from the reef).
- **short:** the molecules and light waves were too small to read on a phone → a `scale`
  parameter (×2) with labels above and below; the custom's arrows were `NaN` in the browser (a
  loop variable shadowed the scale) → fixed, checked with a small node harness, and the build
  check is clean; scene 2's beam showed a prism with nothing coming out → no prism there; the
  host's step-in was small with soil filling the frame → zoom 1.4 with a pan up; the
  sky-rays label covered his face when he turned → moved to his feet; two sunset labels touched
  for one sample → the first ends a word earlier. Fix wave (2026-11-28): the air molecules of
  `wave-hit` sat on the caption band's edges → they now sit around and above the hit molecule.

### Known limits (not fixed)

- Labels and tags were small on a phone (34–38 px text). **Fixed 2026-11-28:** in vertical, tags
  are 56 px and labels 50 px (about 1.5×; captions are 64 px), shrunk only as far as a long text
  needs to fit the safe zone's width.
- Many anchor shots spend their lower half on the cut-away ground under the host (soil, rock):
  it is drawn and not empty, but it is the part of the frame the viewer looks at least.
- (Fixed 2026-11-28: anchor shots no longer need an opening lift pan, so the first frames no
  longer show the target under the captions.)
- `rooftop-night`'s Moon cannot be centred in a vertical frame (see whatif above).
- The transcript check flags spelling only ("metres"/"meters", "colour"/"color").
