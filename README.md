# Video Agent Team

A team of Claude Code subagents that turns a topic into a narrated 1920×1080 explainer video
(60–180 s, captions, a presenter, licensed music and sound effects), using free local tools
only. Five agents — story, voice, design, animator and reviewer — work through four steps,
each checked by the reviewer before you see it. You approve the script and the voice.

## Commands (in Claude Code, from this folder)

- `/make-video "<topic>" [notes]` — make a new video. `/make-video --resume <run_dir>` picks
  up an interrupted run.
- `/video-status [run_dir]` — show a run's step, state and round, or list all runs.

A Windows notification appears whenever the team is waiting for you.

## Folder map

- `.claude/agents/` — the five subagents (story, voice, design, animator, reviewer).
- `.claude/commands/` — `/make-video` (the orchestrator) and `/video-status`.
- `.claude/settings.json` — the Notification hook that runs `tools/notify/notify.ps1`.
- `tools/pipeline/` — run folders, `status.json`, script parsing and story checks.
- `tools/voice/` — local Kokoro voice synthesis and mouth-movement data.
- `tools/audio/` — the audio library, mixing and loudness checks.
- `tools/render/` — renders and muxes the final MP4.
- `tools/review/` — transcripts and keyframes for the reviewer.
- `tools/notify/` — the Windows desktop notification script.
- `templates/` — the Remotion project with the scene templates and the presenter.
- `assets/audio/` — the CC0 / no-attribution music and sound library.
- `videos/` — one folder per run (not in git).
- `tests/` — pytest tests (`pytest`).
- `docs/` — the design spec and plans.

## More

- Setup on Windows: [`docs/SETUP.md`](docs/SETUP.md).
- Design: [`docs/superpowers/specs/2026-11-19-video-agent-team-design.md`](docs/superpowers/specs/2026-11-19-video-agent-team-design.md).
