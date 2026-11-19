# Video Agent Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/make-video "<topic>"` command in Claude Code that runs five agents (Story, Voice, Design, Animator, Reviewer) with a review gate after every step and two owner checkpoints, and outputs a 1–3 minute narrated MP4 with music and sound effects.

**Architecture:** Claude Code subagents (`.claude/agents/*.md`) do the creative work. An orchestrator command (`.claude/commands/make-video.md`) runs the steps and gates. Every mechanical job (parsing, text-to-speech, audio mixing, loudness checks, transcription, rendering, run state) lives in small, tested Python tools under `tools/` and a Remotion project under `templates/`, which the agents call. Agents hand off through files in one folder per video.

**Tech Stack:** Python 3.11 (pytest, kokoro, faster-whisper, soundfile, numpy, pyloudnorm, num2words), Node.js 20 + Remotion 4 + TypeScript + zod + vitest, ffmpeg, espeak-ng, PowerShell (Windows notifications).

**Spec:** `docs/superpowers/specs/2026-11-19-video-agent-team-design.md`

> **Execution order (scope change, owner-approved 2026-11-19):** Tasks 1–8, then **Task 12 → Task 13** (presenter, spec §6.6), then Tasks 9, 10, 11.

## Global Constraints

- Runs on the owner's Windows PC in `C:\Users\PC\Documents\Claude Workspace`. **The path contains a space**: every subprocess call passes arguments as a list, never as one shell string. Use `pathlib` everywhere.
- Free tools only. No paid APIs, no per-use billing, no network calls per video except the Reviewer's web search.
- Narration: 150–450 words; video length 60–180 s; English (`language: "en"`) in v1, language kept as a setting.
- Video: 1920×1080, 30 fps, 16:9, captions on.
- Review: verdict `PASS` or `FIX`; must-fix vs suggestion; PASS = zero must-fix; **max 3 fix rounds per gate**, then stop and ask the owner.
- Owner checkpoints after gate 1 (script) and gate 2 (voice); Reviewer always runs before the owner sees work.
- Voice agent may change only punctuation, pauses, voice and speed, never words.
- Audio: music ≥ **12 dB** below voice while the voice speaks; final mix **−14 LUFS** (±1); on average no more than one sound effect per scene (total SFX ≤ number of scenes); no SFX overlapping a key narration word.
- Audio library: only licences in `ALLOWED_LICENCES = {"CC0-1.0", "Pixabay-Content-License"}`; every file records source URL and licence; each video gets `credits.md`.
- No downloaded images in v1; icons come from the bundled `lucide-react` package (MIT).
- Never send the owner's personal data to outside services.
- Presenter (spec §6.6): flat-vector male presenter, dark-brown curly hair, waist-up, front-facing; poses `idle talk point-left point-right think surprised celebrate wave`; expressions `neutral happy curious surprised thinking`; position `left right none`; size `large small`; mouth driven by voice loudness; never overlaps content or captions; scene durations must not change (no overlapping transitions).
- Python tools are run as `python -m tools.<pkg>.<module> ...` from the workspace root.

## Review Focus

1. **Numbers and symbols in narration** ("1,000 °C", "CO2", "3.5%"): the transcript comparison must not report false mismatches when Whisper writes "one thousand" for "1,000". Test in Task 4.
2. **A topic with spaces, accents or symbols** ("Why is the sky blue? (Rayleigh)") must give a safe ASCII folder name on Windows. Test in Task 1.
3. **An interrupted run** must resume from `status.json`; a missing or corrupt `status.json` gives a clear error, not a crash trace. Test in Task 1.
4. **Video longer than every library track for the mood, or no track for the mood at all**: loop with a crossfade / fall back to the closest mood with a warning. Test in Tasks 5 and 6.
5. **A silent or near-silent voice scene** must fail the mix check clearly instead of dividing by zero. Test in Task 6.

---

## File Structure

```
Claude Workspace/
├── pyproject.toml                      Python deps + pytest config
├── .claude/
│   ├── agents/  story.md voice.md design.md animator.md reviewer.md
│   ├── commands/ make-video.md video-status.md
│   └── settings.json                   Notification hook
├── tools/
│   ├── pipeline/ status.py  script.py  checks.py
│   ├── voice/    engine.py  synth.py
│   ├── audio/    library.py  mix.py  measure.py
│   ├── review/   transcript.py  keyframes.py
│   ├── render/   render.py
│   ├── notify/   notify.ps1
│   └── check_setup.py
├── templates/                          Remotion project
│   ├── package.json  remotion.config.ts  tsconfig.json
│   └── src/ Root.tsx  Video.tsx  schema.ts  Captions.tsx
│           templates/ TitleCard.tsx Bullets.tsx Diagram.tsx Comparison.tsx
│                      BigNumber.tsx Steps.tsx Chart.tsx Quote.tsx Recap.tsx
├── assets/audio/  music/  sfx/  library.json  usage.json  DOWNLOAD-LIST.md
├── tests/  (pytest)                    + templates/src/**/*.test.ts (vitest)
├── docs/SETUP.md  docs/TEST-CHECKLIST.md
└── videos/<yyyy-mm-dd>-<slug>/         created per run (see spec §8)
```

### Shared file formats (pinned here, used by many tasks)

**`01-script/script.md`**
```markdown
# <Video title>

## Scene 1: <short title>
**Narration:** <spoken text>
**Viewer should understand:** <one line>
**Visual idea:** <one line>

## Scene 2: ...

## Key claims
- [S1] <claim>
```

**`02-voice/manifest.json`**
```json
{"language":"en","engine":"kokoro","voice":"af_heart","speed":1.0,"sample_rate":24000,
 "scenes":[{"id":1,"file":"scene-01.wav","duration_s":12.4}],"total_s":96.2}
```

**`03-design/style.json`** — `{"colors":{"background","surface","primary","accent","text"},"fonts":{"heading","body"},"sizes":{"title","heading","body","caption"}}` (hex colours, font names, px numbers).

**`03-design/sound.json`**
```json
{"music_mood":"curious","sfx":[{"scene":3,"at_s":2.1,"type":"whoosh"}]}
```
`at_s` is seconds from the start of that scene.

**`04-video/scenes.json`** — `{"fps":30,"width":1920,"height":1080,"style":<style.json>,"scenes":[{"id":1,"template":"TitleCard","durationInFrames":372,"props":{...},"narration":"<text for captions>"}]}`. `template` is one of the nine names in `templates/src/templates/`.

**`status.json`**
```json
{"topic":"...","slug":"...","created":"2026-11-19T10:00:00",
 "step":"story","state":"working","round":1,
 "history":[{"time":"...","agent":"story","event":"started","detail":""}]}
```
`step` ∈ `story, voice, design, animator, done`. `state` ∈ `working, reviewing, waiting_owner, fixing, failed, done`.

**`progress.log`** — one line per event: `2026-11-19 10:02:13 | [2/4] Voice    | reviewing (round 1)`.

---

### Task 1: Project setup, run state and progress tracking

**Files:**
- Create: `pyproject.toml`, `tools/__init__.py`, `tools/pipeline/__init__.py`, `tools/pipeline/status.py`
- Test: `tests/pipeline/test_status.py`

**Interfaces:**
- Produces:
  - `slugify(topic: str) -> str` — ASCII, lowercase, `a-z0-9-`, max 50 chars, never empty (fallback `"video"`).
  - `init_run(topic: str, videos_root: Path, today: date | None = None) -> Path` — creates `videos/<yyyy-mm-dd>-<slug>/` (adds `-2`, `-3` if taken), the subfolders `01-script 02-voice 03-design 04-video review`, `brief.md` (topic, owner notes, `language: en`), `status.json`, `progress.log`.
  - `load_status(run_dir: Path) -> dict` — raises `RunStateError` with a plain message if the file is missing or not valid JSON.
  - `update(run_dir: Path, *, step: str | None = None, state: str | None = None, round: int | None = None, agent: str, event: str, detail: str = "") -> dict` — validates values, appends to `history` and one line to `progress.log`.
  - `format_status(run_dir: Path) -> str` — human-readable summary: topic, current step as `[n/4] Name`, state, round, last 5 events.
  - CLI: `python -m tools.pipeline.status init "<topic>"`, `... update <run_dir> --agent voice --state reviewing --round 1 --event "..."`, `... show <run_dir>`, `... list` (all runs in `videos/` with their step and state).

- [ ] **Step 1: Write failing tests**

```python
def test_slugify_handles_symbols_and_accents():
    assert slugify("Why is the sky blue? (Rayleigh) — café") == "why-is-the-sky-blue-rayleigh-cafe"
    assert slugify("???") == "video"
    assert len(slugify("a" * 200)) == 50

def test_init_run_creates_layout(tmp_path):
    run = init_run("How volcanoes work", tmp_path, today=date(2026, 11, 19))
    assert run.name == "2026-11-19-how-volcanoes-work"
    for sub in ["01-script", "02-voice", "03-design", "04-video", "review"]:
        assert (run / sub).is_dir()
    s = load_status(run)
    assert (s["step"], s["state"], s["round"]) == ("story", "working", 1)

def test_init_run_does_not_overwrite(tmp_path):
    a = init_run("X", tmp_path, today=date(2026, 11, 19))
    b = init_run("X", tmp_path, today=date(2026, 11, 19))
    assert b.name == a.name + "-2"

def test_update_appends_history_and_log(tmp_path):
    run = init_run("X", tmp_path)
    update(run, step="voice", state="reviewing", round=1, agent="reviewer", event="gate 2 started")
    assert load_status(run)["step"] == "voice"
    assert "[2/4] Voice" in (run / "progress.log").read_text().splitlines()[-1]

def test_update_rejects_bad_state(tmp_path):
    run = init_run("X", tmp_path)
    with pytest.raises(ValueError):
        update(run, state="sleeping", agent="x", event="y")

def test_missing_or_corrupt_status_gives_clear_error(tmp_path):
    with pytest.raises(RunStateError, match="status.json"):
        load_status(tmp_path)
    (tmp_path / "status.json").write_text("{not json")
    with pytest.raises(RunStateError, match="corrupt"):
        load_status(tmp_path)

def test_format_status_shows_step(tmp_path):
    run = init_run("Volcanoes", tmp_path)
    assert "[1/4] Story" in format_status(run)
```

- [ ] **Step 2: Run** `pytest tests/pipeline/test_status.py -v`. Expected: FAIL (module not found).
- [ ] **Step 3: Create `pyproject.toml`** (project `video-agent-team`, Python ≥3.11, deps: `numpy soundfile pyloudnorm num2words faster-whisper kokoro`, dev: `pytest`; pytest `markers = ["slow: needs models or ffmpeg"]`), then implement `status.py` with the interfaces above. Slug uses `unicodedata.normalize("NFKD")` then strips non-ASCII. Write `status.json` atomically (write a temp file, then `os.replace`).
- [ ] **Step 4: Run** `pytest tests/pipeline/test_status.py -v`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: run folders, status and progress log"`

---

### Task 2: Script parser and story checks

**Files:**
- Create: `tools/pipeline/script.py`, `tools/pipeline/checks.py`
- Test: `tests/pipeline/test_script.py`, `tests/fixtures/script_ok.md`

**Interfaces:**
- Produces:
  - `@dataclass Scene(id: int, title: str, narration: str, understand: str, visual: str)`
  - `@dataclass Script(title: str, scenes: list[Scene], claims: list[str])`
  - `parse_script(path: Path) -> Script` — raises `ScriptFormatError` naming the scene and missing field.
  - `word_count(script: Script) -> int` (narration only).
  - `estimate_seconds(script: Script, wpm: int = 150) -> float`
  - `check_story(script: Script) -> list[str]` — returns must-fix strings for: word count outside 150–450, scene ids not 1..n in order, empty narration, no key claims.
  - CLI: `python -m tools.pipeline.checks story <script.md>` prints JSON `{"words":..,"est_seconds":..,"problems":[..]}`.

- [ ] **Step 1: Write failing tests** — `test_parse_fixture` (fixture with 3 scenes and 2 claims → `len(scenes)==3`, `scenes[1].title`, `claims[0].startswith("[S1]")`); `test_missing_narration_names_scene` (`match="Scene 2.*Narration"`); `test_word_count_limits` (120 words → problem contains `"150–450"`; 300 words → `[]`); `test_estimate_seconds` (300 words → `120.0`).
- [ ] **Step 2: Run** `pytest tests/pipeline/test_script.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** with a line-based parser keyed on `## Scene <n>:` and the three bold labels.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: script parser and story checks"`

---

### Task 3: Voice tool (text-to-speech per scene)

**Files:**
- Create: `tools/voice/__init__.py`, `tools/voice/engine.py`, `tools/voice/synth.py`
- Test: `tests/voice/test_synth.py`

**Interfaces:**
- Consumes: `parse_script` (Task 2).
- Produces:
  - `class TTSEngine(Protocol): name: str; sample_rate: int; def synth(self, text: str, voice: str, speed: float) -> np.ndarray` (mono float32).
  - `class KokoroEngine(TTSEngine)` — `KPipeline(lang_code="a")` for American English; joins the generator's audio chunks; `sample_rate = 24000`.
  - `get_engine(name: str, language: str) -> TTSEngine` — `"kokoro"` + `"en"` only in v1; anything else raises `ValueError("No voice engine for language ...")`. This is the single swap point for Indonesian later.
  - `synth_scenes(script_path: Path, out_dir: Path, engine: TTSEngine, voice: str = "af_heart", speed: float = 1.0, only: list[int] | None = None, language: str = "en") -> dict` — writes `scene-XX.wav` (re-records only `only` scenes when given, keeping the others), adds 0.4 s of silence at the end of each scene, writes and returns `manifest.json` in the pinned format.
  - CLI: `python -m tools.voice.synth <run_dir> [--voice af_heart] [--speed 1.0] [--only 2,4]`.

- [ ] **Step 1: Write failing tests** using a `FakeEngine` (returns a 1 s sine wave per 10 words): `test_writes_one_wav_per_scene_and_manifest` (3 files, `manifest["scenes"][0]["file"] == "scene-01.wav"`, `total_s` equals the sum of durations to 0.01); `test_only_rerecords_selected_scenes` (`mtime` of scene-01 unchanged, scene-02 changed); `test_unknown_language_raises` (`get_engine("kokoro", "id")` → `ValueError`). Add `@pytest.mark.slow test_kokoro_real_voice` (synthesise "Hello there." → duration between 0.5 and 3 s).
- [ ] **Step 2: Run** `pytest tests/voice -v -m "not slow"`. Expected: FAIL.
- [ ] **Step 3: Implement** `engine.py` and `synth.py` (write with `soundfile`, measure duration from the samples).
- [ ] **Step 4: Run** `pytest tests/voice -v -m "not slow"`, then `pytest tests/voice -v -m slow` (needs Kokoro + espeak-ng). Expected: PASS both.
- [ ] **Step 5: Commit** `git commit -m "feat: per-scene voice synthesis with swappable engine"`

---

### Task 4: Transcript check and keyframes (review helpers)

**Files:**
- Create: `tools/review/__init__.py`, `tools/review/transcript.py`, `tools/review/keyframes.py`
- Test: `tests/review/test_transcript.py`

**Interfaces:**
- Produces:
  - `normalize_words(text: str) -> list[str]` — lowercase, numbers to words via `num2words` (`"1,000"` → `one thousand`, `"3.5"` → `three point five`), `%` → `percent`, `°C` → `degrees celsius`, strips punctuation.
  - `compare(expected: str, heard: str) -> list[str]` — `difflib.SequenceMatcher` on normalised words; returns readable problems like `missing: "molten rock"`, `wrong: "lava" heard as "larva"`; `[]` when equal.
  - `transcribe(path: Path, model: str = "small.en") -> str` — faster-whisper, CPU, `compute_type="int8"`.
  - `extract_keyframes(video: Path, out_dir: Path, every_s: float = 2.0) -> list[Path]` — ffmpeg `fps=1/every_s` fallback for gate 4.
  - CLI: `python -m tools.review.transcript voice <run_dir>` (each scene's wav against its narration → JSON per scene) and `... final <run_dir>` (final MP4 against the whole script, plus a comparison with the voice-only transcripts).

- [ ] **Step 1: Write failing tests**: `test_numbers_match_spoken_form` (`compare("Lava is 1,000 °C.", "lava is one thousand degrees celsius") == []`); `test_reports_missing_words`; `test_reports_wrong_word` (`"lava"` vs `"larva"` → one problem containing both); `test_punctuation_and_case_ignored`.
- [ ] **Step 2: Run** `pytest tests/review -v -m "not slow"`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions above.
- [ ] **Step 4: Run** the tests. Expected: PASS. Add `@pytest.mark.slow test_transcribe_kokoro_output` (Task 3 output for "Hello there." → `compare` returns `[]`).
- [ ] **Step 5: Commit** `git commit -m "feat: transcript comparison and keyframe extraction"`

---

### Task 5: Audio library

**Files:**
- Create: `tools/audio/__init__.py`, `tools/audio/library.py`, `assets/audio/library.json` (`{"items": []}`), `assets/audio/usage.json` (`{}`), `assets/audio/DOWNLOAD-LIST.md`
- Test: `tests/audio/test_library.py`

**Interfaces:**
- Produces:
  - Library item: `{"id","path","kind":"music"|"sfx","tags":[...],"duration_s","licence","source_url","lufs"}`.
  - `ALLOWED_LICENCES = {"CC0-1.0", "Pixabay-Content-License"}`
  - `MUSIC_MOODS = ["curious","upbeat","calm","inspiring","dramatic","playful"]`
  - `SFX_TYPES = ["whoosh","pop","ding","click","swoosh-in","reveal"]`
  - `add_item(lib_root: Path, file: Path, kind: str, tags: list[str], licence: str, source_url: str) -> dict` — refuses licences outside the set, measures duration and LUFS, copies the file into `music/` or `sfx/`.
  - `pick_music(lib_root: Path, mood: str, min_length_s: float) -> tuple[dict, list[str]]` — least recently used (from `usage.json`) among tracks with the mood, preferring tracks ≥ `min_length_s`; no track for the mood → nearest by tag overlap, any track as last resort, with a warning in the returned list; raises `LibraryError` if there is no music at all.
  - `pick_sfx(lib_root: Path, type_: str) -> dict` — least recently used of that type.
  - `mark_used(lib_root: Path, item_ids: list[str]) -> None`
  - `write_credits(items: list[dict], out: Path) -> None` — Markdown table: file, kind, licence, source.
  - CLI: `python -m tools.audio.library add|list|validate` (`validate` checks every file exists and every licence is allowed).

- [ ] **Step 1: Write failing tests**: `test_add_rejects_cc_by` (`licence="CC-BY-4.0"` → `ValueError`); `test_pick_music_least_recently_used` (two "calm" tracks; mark A used → B picked); `test_pick_music_prefers_long_enough`; `test_missing_mood_falls_back_with_warning`; `test_empty_library_raises`; `test_credits_lists_every_file`.
- [ ] **Step 2: Run** `pytest tests/audio/test_library.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `library.py`. Write `DOWNLOAD-LIST.md`: a table of ~15–20 music tracks (≥2 per mood) and ~40 SFX (≥5 per type), each from a CC0 / Pixabay source with its URL, plus the exact `add` command per file. Download automatically what the licence and site allow; the rest stays on the list for the owner.
- [ ] **Step 4: Run** the tests. Expected: PASS. Run `python -m tools.audio.library validate`. Expected: `OK` (or a list of files still to download).
- [ ] **Step 5: Commit** `git commit -m "feat: licensed audio library with LRU picking"`

---

### Task 6: Audio mixing and clarity check

**Files:**
- Create: `tools/audio/mix.py`, `tools/audio/measure.py`
- Test: `tests/audio/test_mix.py`

**Interfaces:**
- Consumes: manifest (Task 3), `sound.json`, `pick_music` / `pick_sfx` / `mark_used` / `write_credits` (Task 5).
- Produces:
  - `build_mix(run_dir: Path, lib_root: Path) -> MixResult` — writes stems `04-video/audio/voice.wav`, `music.wav`, `sfx.wav` and `mix.wav` (48 kHz stereo), plus `04-video/credits.md`. Voice scenes are placed back to back. SFX are placed at scene start + `at_s`. Music is looped with a 2 s crossfade if too short, gets a 1.5 s fade-in and a 3 s fade-out, and is ducked by a gain envelope wherever voice RMS (50 ms windows) is above −45 dBFS, with 150 ms attack and 400 ms release. The mix is normalised to −14 LUFS with `pyloudnorm`.
  - `@dataclass MixResult(mix: Path, stems: dict[str, Path], warnings: list[str])`
  - `speech_mask(voice: np.ndarray, sr: int, threshold_dbfs: float = -45) -> np.ndarray[bool]`
  - `voice_music_gap_db(voice: np.ndarray, music: np.ndarray, sr: int) -> float` — RMS gap over speech windows only; raises `MixCheckError("no speech found")` if the mask is empty.
  - `check_mix(run_dir: Path) -> dict` — `{"gap_db":..,"lufs":..,"sfx_count":..,"scenes":..,"problems":[..]}`; problems when gap < 12, LUFS outside −15..−13, or `sfx_count > scenes`.
  - CLI: `python -m tools.audio.mix <run_dir>`, `python -m tools.audio.measure <run_dir>` (prints the `check_mix` JSON).

- [ ] **Step 1: Write failing tests** with synthetic signals (voice = tone bursts, music = steady noise): `test_ducking_meets_12db_gap` (after `build_mix`, `check_mix(...)["gap_db"] >= 12`); `test_mix_loudness_is_minus_14` (within ±1); `test_short_music_is_looped_to_video_length`; `test_silent_voice_raises_clear_error` (`match="no speech"`); `test_too_many_sfx_reported` (4 SFX for 3 scenes → problem); `test_credits_written`.
- [ ] **Step 2: Run** `pytest tests/audio/test_mix.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** in numpy (resample the 24 kHz voice with `numpy` interpolation or `soundfile`/ffmpeg).
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: audio mix with ducking and measured clarity check"`

---

### Task 7: Remotion template project

**Files:**
- Create: `templates/package.json`, `templates/remotion.config.ts`, `templates/tsconfig.json`, `templates/src/Root.tsx`, `templates/src/Video.tsx`, `templates/src/schema.ts`, `templates/src/Captions.tsx`, the nine files in `templates/src/templates/`, `templates/fixtures/sample-scenes.json`
- Test: `templates/src/schema.test.ts`, `templates/scripts/render-stills.mjs`

**Interfaces:**
- Consumes: `scenes.json` format (pinned above).
- Produces:
  - `schema.ts`: `StyleSchema`, `SceneSchema` (a discriminated union on `template`, one props schema per template), `VideoSchema`; `export const TEMPLATE_NAMES = ["TitleCard","Bullets","Diagram","Comparison","BigNumber","Steps","Chart","Quote","Recap"] as const`.
  - Composition id `"Video"`, which takes `VideoSchema` as `inputProps` and computes its duration from the sum of `durationInFrames`. Renders scenes in a `<Series>`, each with `Captions` from `narration` (word-by-word timing spread evenly across the scene). **No audio inside Remotion**: the render is muted and the audio is added in Task 8.
  - Each template uses only `style` colours and fonts, enters and exits with a 12-frame animation, and keeps text inside a 96 px safe margin.
  - Icons: `lucide-react` by icon name in props (e.g. `"icon": "flame"`).
  - npm scripts: `test` (vitest), `stills` (renders frame 30 of each scene in the fixture to `out/stills/`), `render` (`remotion render Video --props=<file> --muted <out>`).

- [ ] **Step 1: Write failing tests**: `rejects unknown template`; `rejects bullets with more than 5 items` (readability limit); `accepts sample-scenes.json`; `TEMPLATE_NAMES has 9 entries`.
- [ ] **Step 2: Run** `cd templates && npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the schema, `Video`, `Captions` and the nine templates. Use the Remotion plugin's best-practices skill for animation patterns.
- [ ] **Step 4: Run** `npm test` → PASS; `npm run stills` → nine PNGs in `out/stills/`. Open each still and check that nothing is cut off and the text is readable.
- [ ] **Step 5: Commit** `git commit -m "feat: Remotion scene templates and schema"`

---

### Task 8: Render and final assembly

**Files:**
- Create: `tools/render/__init__.py`, `tools/render/render.py`
- Test: `tests/render/test_render.py`

**Interfaces:**
- Consumes: `scenes.json`, `MixResult.mix` (Task 6), the npm `render` script (Task 7).
- Produces:
  - `durations_to_frames(manifest: dict, fps: int = 30) -> dict[int, int]` — `ceil(duration_s * fps)` per scene.
  - `validate_scene_timing(scenes_json: dict, manifest: dict) -> list[str]` — a problem if any scene's frames differ from the voice duration by more than one frame.
  - `render_video(run_dir: Path, templates_dir: Path) -> Path` — runs the muted Remotion render to `04-video/out/silent.mp4`, then muxes `mix.wav` into `04-video/out/video.mp4` with ffmpeg (`-c:v copy -c:a aac -b:a 192k -shortest`).
  - CLI: `python -m tools.render.render <run_dir>`.

- [ ] **Step 1: Write failing tests**: `test_frames_round_up` (12.41 s → 373); `test_timing_mismatch_reported`; `@pytest.mark.slow test_render_fixture_end_to_end` (fixture run folder with fake voice → `video.mp4` exists and its ffprobe duration is within 0.1 s of `total_s`).
- [ ] **Step 2: Run** `pytest tests/render -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `render.py` (subprocess with list args; `npx` resolved via `shutil.which("npx")`, which finds `npx.cmd` on Windows).
- [ ] **Step 4: Run** `pytest tests/render -v` (including slow). Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: render and mux final video"`

---

### Task 9: The five agents

**Files:**
- Create: `.claude/agents/story.md`, `voice.md`, `design.md`, `animator.md`, `reviewer.md`
- Test: `tests/agents/test_agent_files.py`

**Interfaces:**
- Consumes: the tool CLIs from Tasks 1–8 and the file formats above.
- Produces: subagents named `story`, `voice`, `design`, `animator`, `reviewer`. Each takes `run_dir` (and for reviewer, `gate` 1–4 and `round`) in its prompt and writes only its own folder (reviewer writes only `review/gate-<n>-round-<m>.md`).

Each file has front matter (`name`, `description`, `tools`) and a body containing: its job, its input files, its output files in the pinned format, the tool commands it must run, its hard rules, and the line `When done, reply with exactly: DONE <path to main output>`.

Rules that must appear, copied from the spec:
- **story:** 150–450 words; written for speaking; a "Key claims" section; run `checks story` before replying.
- **voice:** may change only punctuation, pauses, voice and speed, never words; run `tools.voice.synth`, then `tools.review.transcript voice`.
- **design:** never writes code; produces `storyboard.md` (including a presenter line per scene: pose, expression, position, size — `large` only on TitleCard/BigNumber/Quote/Recap, `small` or `none` on Diagram/Chart/Comparison), `style.json`, `sound.json`; picks only templates in `TEMPLATE_NAMES`, a mood in `MUSIC_MOODS`, SFX types in `SFX_TYPES`; SFX count ≤ scenes; no SFX on key words.
- **animator:** fills `scenes.json` from the storyboard (including each scene's `presenter`); runs `python -m tools.voice.mouth <run_dir>` to add mouth data; a custom component only if no template fits, and it says so; runs `tools.audio.mix`, then `tools.render.render`.
- **reviewer:** per-gate checklist (spec §6.2, all four gates, written out); gate 3 adds the presenter checks of spec §6.6 (missing presenter fields; `large` on a dense scene); gate 4 adds presenter overlap and mouth-moves-only-while-speaking checks (keyframes); gate 1 must web-search every key claim and cite a URL; gate 2 runs the voice transcript check; gate 4 uses the watch-video skill (fallback: `extract_keyframes` + `transcript final`) and `tools.audio.measure`; output template:

```markdown
# Gate <n>, round <m>: <PASS|FIX>
## Must-fix
- [Scene 3] <specific, actionable problem and the fix>
## Suggestions
- ...
## Sources (gate 1)
- [S1] <url>
```

- [ ] **Step 1: Write a failing test** that parses each agent file's front matter and checks: `name` matches the file name, `tools` is present, the body contains `DONE`, and reviewer.md contains `Gate 1`–`Gate 4`, `Must-fix`, `Suggestions`, `PASS`, `FIX`.
- [ ] **Step 2: Run** `pytest tests/agents -v`. Expected: FAIL.
- [ ] **Step 3: Write the five agent files.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: story, voice, design, animator and reviewer agents"`

---

### Task 10: Orchestrator, status command and notifications

**Files:**
- Create: `.claude/commands/make-video.md`, `.claude/commands/video-status.md`, `.claude/settings.json`, `tools/notify/notify.ps1`
- Test: `tests/agents/test_orchestrator_file.py`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `/make-video "<topic>" [notes]` and `/make-video --resume <run_dir>`.
  - `/video-status [run_dir]` — runs `python -m tools.pipeline.status show` (or `list` with no argument) and prints the result.

The orchestrator's loop, for each step `story → voice → design → animator`:
1. `status update --state working`, print `▶ [n/4] <Agent> agent is working…`, start the agent subagent.
2. `status update --state reviewing --round r`, print `🔍 Reviewer checking <step> (round r/3)…`, start the reviewer with the gate number.
3. On FIX: if r < 3, `--state fixing`, send the review file to the same agent, and repeat from 2 with r+1. If r = 3: `--state failed`, notify, show the open must-fix items, and ask the owner: accept / give directions / cancel.
4. On PASS after gates 1 and 2: `--state waiting_owner`, notify, show the script (gate 1) or the wav paths (gate 2), and wait for **approve** or changes. Word changes requested at gate 2 go back to `story` and pass gate 1 again, then only the changed scenes are re-recorded (`--only`).
5. After gate 4 PASS: `--step done --state done`, notify, print the MP4 path and `credits.md`. Sound-only feedback goes back to `design` (sound.json only), then `animator` re-mixes and re-renders.

On `--resume`: read `status.json` and continue from the recorded step, state and round.

`settings.json` hook: `{"hooks":{"Notification":[{"hooks":[{"type":"command","command":"powershell -NoProfile -ExecutionPolicy Bypass -File tools/notify/notify.ps1"}]}]}}`. `notify.ps1` reads the hook JSON from stdin and shows a Windows toast titled "Video Agent Team" with the message (built-in `Windows.UI.Notifications` API, no extra modules; if that fails, a `System.Windows.Forms.NotifyIcon` balloon tip).

- [ ] **Step 1: Write a failing test** that checks `make-video.md` mentions all four steps, all four gates, `round`, `3`, `waiting_owner`, `--resume`, and `video-status.md` calls `tools.pipeline.status`; and that `settings.json` is valid JSON with a `Notification` hook.
- [ ] **Step 2: Run** `pytest tests/agents -v`. Expected: FAIL.
- [ ] **Step 3: Write** the two commands, `settings.json` and `notify.ps1`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: make-video orchestrator, status command, notifications"`

---

### Task 11: Setup check, owner guides and Linux smoke test

**Files:**
- Create: `tools/check_setup.py`, `docs/SETUP.md`, `docs/TEST-CHECKLIST.md`, `tests/test_smoke.py`

**Interfaces:**
- Produces:
  - `python -m tools.check_setup` — checks: Python ≥3.11, Node ≥20, `ffmpeg` and `ffprobe` on PATH, `espeak-ng` on PATH, `import kokoro`, `import faster_whisper`, `templates/node_modules` exists, `assets/audio` validates, and the Remotion and watch-video plugins appear under the user's Claude plugins folder (a warning only if they can't be found). Prints ✅/❌ per line with a one-line fix for each ❌; exit code 1 if anything required fails.
  - `docs/SETUP.md` — step-by-step Windows install with `winget` commands (Python, Node.js LTS, ffmpeg, espeak-ng), `pip install -e .`, `cd templates && npm install`, how to install the two plugins, and how to fill the audio library from `DOWNLOAD-LIST.md`.
  - `docs/TEST-CHECKLIST.md` — what the owner runs on Windows: `check_setup`, a desktop notification test, and one real `/make-video "How volcanoes work"` run, with what to look for at each checkpoint.

- [ ] **Step 1: Write a failing smoke test** (`@pytest.mark.slow`): build a fixture run folder (fixture script → `FakeEngine` voice → fixture `scenes.json` and `sound.json`) → `build_mix` → `check_mix` has no problems → `render_video` → `video.mp4` exists → `transcript final` contains no missing scenes.
- [ ] **Step 2: Run** `pytest tests/test_smoke.py -v -m slow`. Expected: FAIL.
- [ ] **Step 3: Implement** `check_setup.py`, the two docs, and any glue the smoke test exposes.
- [ ] **Step 4: Run** `pytest -v` (all tests, including slow) and `python -m tools.check_setup`. Expected: all PASS; check_setup is ✅ for everything installed in the build environment.
- [ ] **Step 5: Commit** `git commit -m "feat: setup check, owner guides, smoke test"`

---

### Task 12: Mouth movement data from the voice

**Files:**
- Create: `tools/voice/mouth.py`
- Test: `tests/voice/test_mouth.py`

**Interfaces:**
- Consumes: `02-voice/manifest.json` + `scene-XX.wav` (Task 3), `04-video/scenes.json` (format above).
- Produces:
  - `mouth_envelope(samples: np.ndarray, sr: int, n_frames: int, fps: int = 30) -> list[float]` — per video frame, RMS in dBFS mapped linearly from −45 dB → 0.0 to −12 dB → 1.0 (clamped), then smoothed with a 3-frame moving average; values rounded to 2 decimals; output length exactly `n_frames` (zero-padded or trimmed).
  - `add_mouth_to_scenes(run_dir: Path) -> None` — for every scene in `scenes.json`, sets `scene["mouth"]` to `mouth_envelope(...)` of that scene's wav with `n_frames = durationInFrames`; writes the file back (atomic).
  - CLI: `python -m tools.voice.mouth <run_dir>`.

- [ ] **Step 1: Write failing tests**: `test_silence_is_closed` (zeros → all 0.0); `test_loud_tone_opens_mouth` (−6 dBFS sine → mean > 0.8); `test_length_matches_frames` (1.0 s at 30 fps, n_frames=31 → len 31, last value 0.0); `test_add_mouth_to_scenes` (tmp run dir with 2 scenes → each scene has `mouth` of length `durationInFrames`).
- [ ] **Step 2: Run** `.venv/bin/pytest tests/voice/test_mouth.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `mouth.py`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: mouth movement data from voice loudness"`

---

### Task 13: Presenter character, alive layer and character sheet

**Files:**
- Create: `templates/src/presenter/look.ts`, `templates/src/presenter/Presenter.tsx`, `templates/src/presenter/parts/*.tsx` (head, hair, face, torso, arms), `templates/src/presenter/poses.ts`, `templates/src/alive/Background.tsx`, `templates/src/alive/motion.ts`, `templates/src/CharacterSheet.tsx`, `templates/scripts/character-sheet.mjs`
- Modify: `templates/src/schema.ts`, `templates/src/Root.tsx`, `templates/src/Video.tsx`, `templates/src/theme.ts` (content box), the nine templates (use the content box and pop-in motion), `templates/fixtures/sample-scenes.json`, `templates/README.md`
- Test: `templates/src/presenter/presenter.test.ts`, `templates/src/layout.test.ts`

**Interfaces:**
- Consumes: `scene.mouth` (Task 12), `scenes.json`, style.
- Produces:
  - Schema: `PRESENTER_POSES`, `PRESENTER_EXPRESSIONS` (the exact lists in Global Constraints); `PresenterSchema = {pose, expression, position: "left"|"right"|"none", size: "large"|"small"}` with default `{pose:"idle", expression:"neutral", position:"none", size:"small"}`; `scene.presenter` optional (defaulted); `scene.mouth: number[]` optional (default `[]` → mouth closed).
  - `contentBox(presenter) -> {x, y, width, height}` and `presenterBox(presenter) -> {...} | null` in `theme.ts`: presenter `large` takes 34% of the canvas width, `small` 22%, on its side; the two boxes never intersect and both stay above the caption reserve.
  - `<Presenter pose expression mouth size side />` — SVG built from parts per `look.ts` (`skinTone`, `hairColor`, `shirtColor` from style accent by default, `glasses: false`); mouth shape from `mouth[frame]`: <0.15 closed, <0.4 slight, <0.7 open, else wide; seeded blink every 2–5 s (deterministic per scene id); breathing (±1.5% torso scale, 4 s cycle); gentle bob (±4 px); curls sway (±2°); pose changes between consecutive scenes blend over 8 frames.
  - Alive layer: `Background` with 5–8 softly drifting translucent shapes in style colours; `popIn(frame, delay)` spring helper used by icons, numbers and list items; arrows/lines in Diagram and Steps draw themselves (stroke-dashoffset). **No `TransitionSeries` or overlapping transitions** — scene in/out stays inside each scene's own 12-frame entry/exit so durations never change.
  - Composition `"CharacterSheet"` (1920×1080 still): a grid of every pose (rows) with the talk mouth shapes and every expression (one strip), labelled. `npm run character-sheet` → `out/character-sheet.png`.

- [ ] **Step 1: Write failing tests**: presenter schema defaults and rejects an unknown pose; `contentBox`/`presenterBox` never intersect for every position × size, and both end above the caption reserve; `presenter: none` → `contentBox` equals the full safe box; fixture parses and uses at least 5 different poses.
- [ ] **Step 2: Run** `cd templates && npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the presenter, the alive layer, layout changes and `CharacterSheet`; update the fixture so scenes carry presenter lines and synthetic `mouth` arrays.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit` → PASS. Run `npm run character-sheet` and `npm run stills`; LOOK at every image: the presenter must look friendly and polished (not stiff), hair clearly curly, hands and arms anatomically plausible, and he must not overlap content or captions. Iterate until it does. Render the fixture to MP4 and confirm its duration is unchanged.
- [ ] **Step 5: Commit** `git commit -m "feat: presenter character, alive animation and character sheet"`

---

### Task 14: Presenter look update and two outfits (owner-approved scope change)

**Files:**
- Modify: `templates/src/presenter/look.ts`, `templates/src/presenter/parts/*.tsx`, `templates/src/presenter/poses.ts` (idle), `templates/src/presenter/Presenter.tsx`, `templates/src/schema.ts` (StyleSchema), `templates/src/CharacterSheet.tsx`, `templates/fixtures/sample-scenes.json`, `templates/README.md`, `.claude/agents/design.md`, `.claude/agents/reviewer.md`, `docs/presenter-character-sheet.png`, `docs/presenter-in-scene.png`
- Test: `templates/src/presenter/presenter.test.ts`, `tests/agents/test_agent_files.py`

**Interfaces:**
- Produces: `PRESENTER_OUTFITS = ["blazer", "labcoat"] as const`; `StyleSchema.presenterOutfit` optional, default `"blazer"`; `<Presenter outfit=... />`; CharacterSheet shows every pose in **both** outfits plus mouth shapes and expressions.
- Look per spec §6.6 "Look update": glasses, neater curls, late 20s–30s, calm confident neutral expression, thicker natural arms, open idle (hands loosely together in front), no orange clothing; blazer = navy blazer + light-blue collared shirt; labcoat = white coat + teal shirt.
- design.md: pick `presenterOutfit` per video (`labcoat` for science/health/technology topics, else `blazer`) into style.json; reviewer.md gate 3: must-fix if outfit missing/invalid or clearly mismatched to the topic.

- [ ] **Step 1: Failing tests**: schema default `blazer`, rejects unknown outfit; fixture uses a valid outfit; agent files mention `presenterOutfit`, `blazer`, `labcoat`.
- [ ] **Step 2: Run** `cd templates && npm test` and `.venv/bin/pytest tests/agents -q` → FAIL.
- [ ] **Step 3: Implement**, re-render `npm run character-sheet` and stills; art-direct by eye until he reads as a trustworthy expert in both outfits.
- [ ] **Step 4: Run** tests + `npx tsc --noEmit` → PASS; fixture render duration unchanged.
- [ ] **Step 5: Commit** `feat: expert presenter look with blazer and lab coat outfits`

