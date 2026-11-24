# Feedback Notebook — Design (short)

**Date:** 2026-11-24
**Status:** Waiting for owner approval
**Builds on:** `2026-11-19-video-agent-team-design.md`, `2026-11-21-world-kit-and-video-types-design.md`

## Intent
The team should get better at making the owner's kind of video over time. Today the owner's
change requests are saved per video (`review/owner-gate-<n>-<k>.md`) and forgotten afterwards.
The notebook keeps **lasting taste** ("captions too small", "slower pacing") and leaves out
**one-off fixes** ("make the volcano redder").

## Approaches
| Approach | Trade-off | Decision |
|---|---|---|
| A. Every comment becomes a lesson automatically | Simplest; one-off fixes pollute later videos | Rejected |
| **B. Sage proposes lessons, owner confirms** (owner can also edit the file by hand — C) | One small extra step per video; notebook stays clean | **Chosen by owner** |
| C. Owner writes lessons by hand only | Full control; easy to forget | Kept as an always-available extra |

## Design
- **The notebook:** `lessons.md` at the project root (next to `team.json`), plain Markdown the
  owner can open and edit. Sections: **Everyone**, **Quill (script)**, **Echo (voice)**,
  **Iris (design)**, **Flip (animation)**, **Sage (review)**. One lesson per line:
  `- <lesson> _(from <run folder>, <date>)_`. *(Section for Pip is added when Pip exists.)*
- **Reading:** every agent reads **Everyone** + its own section before it starts work, and
  follows them unless the current video's brief or the owner's notes say otherwise (this
  video's instructions win). Sage's gate checklists add: "the work follows `lessons.md`".
- **Proposing (after the owner approves the final video):** if the run has any owner feedback,
  Sage reads all of it (every `owner-gate-*` file and final-video comments) and proposes at most
  **5** short candidate lessons, each with a section, phrased as a general rule ("Keep labels to
  3 words or fewer"), skipping one-off fixes. Saved as `review/lessons-proposed.md`.
  No feedback in the run → this step is skipped silently.
- **Confirming:** a board card **"Lessons from this video"** (and the same question in chat when
  the board is closed) lists the numbered candidates with options **keep all / choose / skip**;
  *choose* takes the numbers to keep (e.g. `1,3`).
- **Writing:** a small tool `python -m tools.lessons` (`add`, `list`, `check`) appends kept
  lessons to the right section, skips exact duplicates, and keeps the file tidy. Using a
  `python -m tools.*` command keeps it inside the existing permission allow-list.
- **Conflicts:** if a new lesson contradicts an existing one, Sage says so in the proposal and the
  new one, when kept, replaces the old one (the tool removes the old line by its number).
- **Size cap:** when the notebook passes **40** lessons, Sage's proposal also suggests merging or
  removing old ones (owner confirms the same way) so agents never read a wall of text.
- **Studio:** the new card uses the existing board; no new character (Sage does the work).

## Goals / non-goals / anti-goals
- Goals: lasting taste carried across videos; owner stays in control; zero effort when a video
  had no feedback.
- Non-goals: automatic learning without confirmation; per-topic memory (facts per subject).
- Anti-goals: a lesson silently overriding the owner's instructions for the current video;
  one-off fixes leaking into every video; private info in the notebook (lessons are about style
  only).

## Constraints
- No widening of `.claude/settings.json`; no network; works the same on Windows.
- Existing approvals, gates and resume (`make-video` §8) keep working; resume covers the new step.

## Left to the builder
- Exact tool arguments and file-tidy rules; wording of the board card; tests.
