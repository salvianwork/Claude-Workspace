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
