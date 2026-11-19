# Video Agent Team — Design

**Date:** 2026-11-19
**Status:** Waiting for owner approval
**Runs on:** the owner's Windows PC, in `C:\Users\PC\Documents\Claude Workspace`

---

## 1. Intent and why

The owner wants a team of AI agents that turns a topic into a finished
**1–3 minute video**, with as little manual work as possible. Every step is
quality-checked before the next one starts, and the owner keeps control at
the two points where personal taste matters most: the script and the voice.

**First focus is educational videos** (explainers). The design must not
lock out other categories later (stories, product explainers, etc.).

**Cost rule for v1:** free tools only. No paid video or image generators,
no paid voice services, no per-use API billing. The only cost is the
owner's existing Claude plan.

## 2. Goals, non-goals, anti-goals

**Goals**
- One command (`/make-video "<topic>"`) produces an MP4 of 1–3 minutes.
- Clear narration with natural intonation (not robotic).
- Background music and sound effects that match the video's mood and make
  it more engaging, **without ever making the voice harder to hear**.
- A review gate after every step; feedback goes back to that step's agent
  before the pipeline continues.
- The owner approves the script and the voice before work continues.
- Every step's output is a file the owner can open, so a run can be
  inspected and resumed from the middle.

**Non-goals (v1)**
- Realistic or filmed-looking footage. (A flat-vector presenter character
  *is* in scope; see §6.6.)
- The hand-drawn cartoon style (`animation-studio`). Planned for v2.
- AI-generated or code-synthesised music (v1 uses a curated library).
- Uploading or publishing anywhere.
- Running unattended or on a schedule.

**Anti-goals (a failure even if it "works")**
- A polished video with **wrong facts**.
- Endless review loops over nitpicks.
- A video where the visuals don't match what the voice is saying.
- Music or sound effects that drown out the narration, or so many effects
  that the video feels noisy.
- Silent costs: anything that starts billing without the owner deciding it.
- Sending the owner's personal data to outside services.

## 3. Constraints

- **Platform:** Windows PC, Claude Code (CLI or desktop app).
- **Free tools only** in v1 (see §5).
- **Length:** 1–3 minutes ≈ 150–450 spoken words at ~150 words/minute.
- **Agents can't make pixels or sound by themselves.** Visuals come from
  Remotion (video written as React code); the voice comes from a local
  text-to-speech model.
- **Remotion licence (fact):** free for individuals and companies with up
  to 3 employees; larger companies need a paid company licence. Fine for
  the owner's personal use; recheck before commercial use by a bigger team.
- **The Reviewer is the same model as the other agents**, so it shares
  their blind spots. Fact checks must use web sources, not just re-reading.

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Claude Code agents + one slash command**, handing off through files | No extra cost; easy to read and edit; runs while the owner's session is open | **Chosen by the owner** |
| B. Standalone Python program with the Claude Agent SDK | Can run unattended, more control; needs an API key billed per use, which breaks the free rule | Rejected for v1 |
| C. One agent with all the skills | Simplest; but the reviewer grades its own work, which defeats the review gates | Rejected |

**Visual style options considered:** Remotion motion graphics (chosen for
v1), `animation-studio` hand-drawn (v2), paid AI video generators (rejected:
cost, inconsistent characters across 1–3 minutes, feedback hard to act on).

**Voice options considered:** Kokoro TTS (chosen: free, local, natural
intonation), Piper (backup: faster, flatter), `edge-tts` (rejected: uses
Microsoft's service unofficially and could stop working), paid voices like
ElevenLabs (rejected for v1: cost).

**Music and sound-effect options considered:** a curated library of free
CC0 / no-attribution tracks and sounds downloaded once (**chosen by the
owner**), music synthesised in code (rejected for music: sounds basic; kept
as a backup for simple effects like pops and clicks), local AI music models
such as MusicGen or Stable Audio Open (rejected: need a strong GPU, slow,
and their free licences mostly forbid commercial use).

## 5. Tools (decided)

| Purpose | Tool | Notes |
|---|---|---|
| Agent orchestration | Claude Code subagents (`.claude/agents/*.md`) + a `/make-video` command | Built in |
| Visuals and rendering | **Remotion** plugin (community, Anthropic Directory) | Needs Node.js |
| Review of the finished video | **watch-video** plugin (community) | Needs ffmpeg + faster-whisper (local transcription) |
| Voice | **Kokoro TTS**, run locally in Python | Backup: Piper |
| Music and sound effects | Local **audio library** of CC0 / no-attribution files (e.g. Pixabay Music, Kenney sound packs, CC0 sounds on Freesound) | Downloaded once; nothing sent out per video |
| Audio mixing and loudness checks | ffmpeg (ducking, fades, loudness measurement) | Already needed for review |
| Fact checking | Claude's web search | Reviewer cites sources |
| Notifications | Claude Code `Notification` hook → Windows desktop toast | Fires when the pipeline waits for the owner |

## 6. The pipeline

```
/make-video "<topic>"
   │
   ▼
1. Story ──► Review gate 1 ──► ✋ Owner approves script
   ▼
2. Voice ──► Review gate 2 ──► ✋ Owner approves voice
   ▼
3. Design (storyboard + style guide) ──► Review gate 3
   ▼
4. Animator (builds + renders from templates) ──► Review gate 4
   ▼
🎬 Final MP4 handed to the owner
```

At each gate: the Reviewer returns **PASS** or **FIX**. On FIX, the
feedback goes back to **that step's agent only**, which revises and is
reviewed again. Earlier steps are never redone by a later fix.

### 6.1 Agents

All agents are subagents started fresh for each task, so each works from a
clean, focused context. The orchestrator (the `/make-video` command running
in the main session) passes file paths between them and runs the gates.

**Story agent**
- Input: topic, plus optional notes from the owner (audience, angle, length).
- Output: `01-script/script.md`, split into numbered **scenes**. Each scene
  has: narration text (written to be *spoken*: short sentences, natural
  pauses, emphasis shown with punctuation), what the viewer should
  understand, and a rough visual idea.
- Also lists the **key factual claims** it makes, so the Reviewer can check them.
- Target: 150–450 narration words total.

**Voice agent**
- Input: approved `script.md`.
- Output: one audio file per scene (`02-voice/scene-01.wav` …) and
  `02-voice/manifest.json` with each scene's duration in seconds.
- Generating audio **per scene** gives exact timings, so visuals can be
  synced to the voice, and one scene can be re-recorded without redoing
  the rest.
- Picks one voice and speed for the whole video and records it in the manifest.

**Design agent**
- Input: approved script + voice manifest.
- Output: `03-design/storyboard.md` and `03-design/style.json`.
  - Storyboard: for each scene, which **template** to use (see §7), the
    on-screen text, layout, what moves and when, and the scene duration
    (taken from the voice manifest).
  - Style guide: colours, fonts, sizes. One style for the whole video.
  - **Sound plan:** one music mood for the whole video (picked from the
    library's mood tags), and sound-effect cues per scene (e.g. "scene 3,
    when the arrow appears: whoosh"). See §6.5.
- **Does not write animation code.** It plans; the Animator builds.

**Animator agent**
- Input: storyboard, style guide, audio files.
- Output: `04-video/scenes.json` (the storyboard turned into template data),
  any custom components a scene truly needs, and the rendered
  `04-video/out/video.mp4`.
- Works by **filling in templates** from the shared library (§7). Writes a
  new custom component only when no template fits, and says so in its notes.
- Burns in captions by default (my call: helps learning and accessibility).
- Places the music and sound effects from the sound plan and mixes them
  with the voice (see §6.5). Writes `04-video/credits.md` listing every
  music and sound file used, with source and licence.

**Reviewer agent**
- Started fresh at every gate with that gate's checklist (§6.2).
- Writes `review/gate-<n>-round-<m>.md` containing: verdict (PASS/FIX),
  **must-fix** items (block the gate), and **suggestions** (noted, never
  block). PASS means zero must-fix items.
- Must-fix items must be specific and actionable ("Scene 3 says lava is
  1,000 °C; sources say 700–1,200 °C — give the range"), never vague
  ("make it better").

### 6.2 What each gate checks

| Gate | Must-fix if… | How |
|---|---|---|
| **1 Story** | A factual claim is wrong or unsupported; the length is outside 150–450 words; the order is confusing; the narration is hard to say aloud | Reads the script; checks every key claim with web search and cites a source |
| **2 Voice** | A word is missing, wrong, or mispronounced; a scene is missing; the total length is outside 1–3 min | Transcribes the audio locally (faster-whisper) and compares it to the script. **Cannot judge intonation**; that's the owner's job at the checkpoint |
| **3 Design** | A scene has no template or plan; on-screen text is too long to read in the scene's time; the style is inconsistent; a visual contradicts the narration; the music mood doesn't fit the topic; more sound effects than the limit in §6.5; a sound-effect cue lands on a key narration word | Reads the storyboard, style guide and sound plan |
| **4 Final video** | Visuals are out of sync with the voice; text is cut off or overlapping; a scene is missing; there are rendering glitches; **the voice is not clearly louder than the music** (fails the measured check in §6.5); the transcript of the final MP4 misses words that the voice-only transcript had (a sign the mix is hiding speech); a music or sound file isn't in `credits.md` | watch-video: keyframes + transcript of the MP4, checked against the storyboard; ffmpeg loudness measurement |

### 6.3 Loop limits and escalation

- **Max 3 fix rounds per gate.** If round 3 still fails, the pipeline
  **stops**, notifies the owner, and shows the open must-fix items. The
  owner decides: accept anyway, give directions, or cancel.
- The orchestrator never skips a gate.

### 6.4 Owner checkpoints

- After gate 1 PASS: the pipeline pauses, a desktop notification fires, and
  the script is shown. The owner replies **approve** or gives changes.
  Changes go back to the Story agent and through gate 1 again.
- After gate 2 PASS: same, with the path to the audio files so the owner
  can listen. Changes go back to the Voice agent (e.g. "slower", "more
  energy in scene 2", or a different voice).
- Order is always **Reviewer first, then owner**, so the owner never sees
  work with obvious errors.

### 6.5 Music and sound effects

**Library.** A local folder `assets/audio/` holds:
- `music/` — background tracks, each tagged with moods (e.g. curious,
  upbeat, calm, inspiring, dramatic, playful).
- `sfx/` — short effects, each tagged with a type (e.g. whoosh, pop, ding,
  click, swoosh-in, reveal).
- `library.json` — one entry per file: path, type, tags, length, licence,
  source URL, and its measured loudness.

**Licence rule:** only **CC0 or no-attribution** licences go in the
library. Every entry records its source and licence. *Fact:* even free
music can occasionally trigger an automatic YouTube copyright claim; CC0
sources lower that risk and `credits.md` gives proof of where each file
came from.

**Choosing (Design agent):** one music mood per video; prefer a track at
least as long as the video, otherwise the Animator loops it with a
crossfade. To stop videos sounding alike, the library tracks how recently
each track was used, and the least recently used track for the mood wins.

**Sound-effect limit (my call):** effects mark key moments only (a
reveal, a new step, a big number). Roughly **no more than one effect per
scene on average**, and never on top of a key word of narration.

**Mixing (Animator agent):**
- Music fades in at the start and out at the end.
- **Ducking:** the music automatically drops whenever the voice is
  speaking and comes back up in pauses.
- **Measured clarity check (my call; builder may tune the numbers):** while
  the voice speaks, the music must sit at least **12 dB below** the voice.
  The final mix is normalised to about **−14 LUFS** (a common loudness
  level for online video).

**Owner feedback on sound:** at the final hand-off the owner can say e.g.
"different music" or "fewer effects". That goes back to the Design agent
(sound plan only) and the Animator re-mixes and re-renders. The script
and voice are not touched.

### 6.6 Presenter character and "alive" animation

*Added 2026-11-19 at the owner's request: "add animation like a character
and make it alive and attractive". Owner chose a **male human presenter
with curly hair**.*

**The presenter**
- One recurring presenter, drawn in code as layered SVG parts (no
  downloads, no licence issues, identical in every video).
- **Style:** clean flat-vector explainer style that matches the template
  look; shown **from the waist up, facing forward** (with small head tilts).
- **Look (my defaults, changeable in one settings file
  `templates/src/presenter/look.ts`):** male, dark-brown curly hair, warm
  medium skin tone, shirt in the video's style colours, no glasses.
- **Poses:** idle, talk (natural hand gestures), point-left, point-right
  (towards the content), think (hand on chin), surprised, celebrate, wave.
- **Expressions:** neutral, happy, curious, surprised, thinking (eyes,
  eyebrows, mouth).
- **Talking:** the mouth opens and closes with the **loudness of the voice**
  (measured per video frame from the scene's audio), using 4 mouth shapes
  (closed, slight, open, wide). *Honest limit:* this is loudness-based, not
  true phoneme lip-sync; it looks convincing at explainer size.
- **Always alive:** blinks every 2–5 s, breathes, gently bobs, curls sway
  slightly. Pose changes blend over ~8 frames, never snap.

**Where and how big (Design agent decides per scene)**
- Each scene in the storyboard gets a presenter line: pose, expression,
  position `left` / `right` / `none`, size `large` / `small`.
- Rules: `large` on title, quote, big-number and recap scenes; `small` or
  `none` on dense scenes (diagram, chart, comparison) so content stays big.
  When the presenter is shown, templates give the content the remaining
  width; **the presenter never covers content or captions**.

**"Alive" layer for every scene**
- Softly drifting background shapes; icons and numbers pop in with a small
  bounce; arrows and lines draw themselves; smooth transitions between
  scenes (slide / fade).
- Motion stays calm: nothing loops fast or flashes, so it never distracts
  from the narration.

**Review and owner checks**
- Gate 3 must-fix if: presenter missing a pose/expression/position, or
  `large` presenter on a dense scene.
- Gate 4 must-fix if: presenter overlaps content or captions; mouth moving
  while the voice is silent (or still while it speaks).
- **Character sheet first:** before the first real video, a one-page image
  of the presenter in every pose and expression is shown to the owner for
  approval, so the look is settled once, not per video.

**Non-goals for the presenter (v1):** walking or turning around, 3D,
several characters, true phoneme lip-sync, a likeness of any real person.

## 7. Scene template library

The biggest lever for quality and reliability. A shared Remotion project
holds ready-made, tested scene components that the Animator fills in with
data instead of writing animation code from scratch.

**v1 templates (my proposal; the builder may adjust):**
1. Title card (topic + subtitle)
2. Bullet points that appear one by one
3. Labelled diagram with arrows / highlights
4. Side-by-side comparison
5. Big number / key fact
6. Step-by-step process or timeline
7. Simple chart (bar / line)
8. Quote or definition
9. Closing summary / recap

Each template takes the style guide (colours, fonts) as input, so every
video is consistent and changing the look means changing one file.

## 8. File layout

```
Claude Workspace/
├── .claude/
│   ├── agents/          story.md, voice.md, design.md, animator.md, reviewer.md
│   ├── commands/        make-video.md   (the orchestrator)
│   └── settings.json    Notification hook → Windows toast
├── templates/           shared Remotion project with the scene templates
├── assets/audio/       music/, sfx/, library.json  (curated CC0 / no-attribution library)
├── tools/voice/         Kokoro script: script scenes → wav files + manifest
└── videos/
    └── <yyyy-mm-dd>-<topic-slug>/
        ├── brief.md
        ├── status.json      current step, gate, round — used to resume
        ├── 01-script/script.md
        ├── 02-voice/scene-XX.wav, manifest.json
        ├── 03-design/storyboard.md, style.json
        ├── 04-video/scenes.json, credits.md, out/video.mp4
        └── review/gate-<n>-round-<m>.md
```

**Resume:** if a run is interrupted, `/make-video --resume <folder>` reads
`status.json` and continues from the last unfinished step.

## 9. Defaults (my calls, owner can change)

- Format: 16:9, 1920×1080, 30 fps. Vertical 9:16 as an option later.
- Captions: on.
- Music: on, from the curated library; sound effects used sparingly (§6.5).
- One narrator voice per video.
- Language: **English** (v1). See §13.

## 10. Left to the builder

- Exact Kokoro voice choice and speed (pick the clearest, most natural
  English voice; document it).
- Exact Remotion version and project setup.
- The design of each template component and its data format.
- How the orchestrator stores state in `status.json`.
- The PowerShell command used for the Windows notification.
- **Building the starter audio library:** roughly 15–20 music tracks across
  ~6 moods and ~40 sound effects, all CC0 / no-attribution, with
  `library.json` filled in. If a source can't be downloaded automatically,
  give the owner a short download list with links and the target folder.
- Exact ducking settings (how fast the music drops and recovers).
- A one-time setup guide for the owner: Node.js, Python, ffmpeg,
  espeak-ng (needed by Kokoro), Kokoro, faster-whisper, and the Remotion
  and watch-video plugins.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Wrong facts slip through (same model reviews) | Reviewer must cite web sources for key claims; owner approves the script |
| Reviewer nitpicks forever | Must-fix vs suggestion; 3-round cap with escalation |
| Free voice sounds flat | Script written for speech; per-scene re-recording; owner checkpoint; Piper/other voices as fallback; paid voice is a v2 option |
| Setup on Windows is fiddly (Python + Node + ffmpeg + espeak-ng) | Step-by-step setup guide plus a "check setup" command |
| Visuals look generic | Template library with a good default style; style guide per video |
| Music drowns out the voice | Automatic ducking; measured 12 dB check at gate 4; transcript of the final mix compared to the voice-only transcript |
| Presenter looks stiff or awkward (human figures are hardest in code) | Flat-vector style, waist-up, front-facing only; character sheet approved by owner before first video; poses blend smoothly |
| Character motion distracts from learning | Presenter small or hidden on dense scenes; calm "alive" motion only; gate 4 overlap check |
| Videos start sounding alike | Least-recently-used track choice; grow the library over time |
| Copyright claim on "free" music | CC0 / no-attribution only; source and licence recorded per file; `credits.md` per video |
| Uses a lot of the Claude plan per video | Gates catch problems early, before expensive steps; reviewer reads files, not long conversations |

## 12. Decisions from the builder check

- **Plugins (answered):** "Remotion" = the *Remotion* plugin by Remotion in
  the Anthropic Directory (skills only: best-practices, create, captions,
  render, etc.). "watch-video" = the *watch-video* plugin by Marcin Sufa
  (a skill that runs ffmpeg + faster-whisper locally). Both are skills,
  not services, so the setup guide installs them plus their local tools.
  If watch-video misbehaves, gate 4 falls back to a plain ffmpeg keyframe
  extraction + faster-whisper step (*builder's call to implement*).
- **Images (my call):** v1 uses **no downloaded images**. Visuals are text,
  shapes, charts, and **icons/illustrations drawn in code** from a free,
  bundled icon set (e.g. Lucide, MIT licence). This keeps v1 free, offline,
  licence-safe and private. Free stock images (e.g. Wikimedia) are a v2 option.
- **Voice feedback that needs a text change (my call):** the Voice agent may
  change only **punctuation, pauses, voice and speed**, never words. If the
  owner's feedback needs different words, it goes back to the **Story
  agent → gate 1 → owner re-approves the script** (shown as a short
  before/after of the changed lines), then voice re-records only the
  affected scenes.
- **Testing (my call):** the owner runs the end-to-end acceptance test on the
  Windows PC. The builder tests what it can on Linux (templates, render,
  voice script), and ships a `check-setup` script plus a short test
  checklist for each step for the owner to run.

## 13. Language

- **v1: English only** (owner's decision). Kokoro English voices,
  English faster-whisper model, ~150 words/minute target.
- **Later: Indonesian** (owner's wish, not committed). Kokoro does not
  support Indonesian, so this needs a different free voice tool, to be
  researched then. To keep that door open, the builder makes **language a
  setting** in `brief.md` and keeps the voice step behind one small script
  interface (text in → wav files + manifest out), so a different TTS engine
  can be swapped in without touching the other agents.

## 14. Open questions

- None. Ready for owner approval.
