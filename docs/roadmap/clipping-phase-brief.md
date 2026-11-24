# Clipping Phase — Ready-to-Use Brief

**Status:** Future idea — not scheduled (owner, 2026-11-24). Not designed or built yet. Start only when the owner asks.
**Use:** When you want to start this phase, open Claude Code in this project and paste the
prompt in the box at the bottom. Everything Claude needs is in this file and the repo.

---

## 1. What this phase adds

A **clipping mode** for the video team. It takes an existing long video by another
creator and turns it into short vertical highlight clips (15–60 s) for TikTok and
YouTube Shorts. Each clip has captions, a hook title and a credit line. The
clipping mode runs alongside the existing animated-video pipeline; it does not
replace it.

## 2. Decisions already made (with the owner)

- **Source:** other creators' videos (option C). Used **only with documented
  permission**.
- **Permission is a hard stop:** with no proof of permission, the run makes no clips.
- **New agents:**
  - **Scout** (working name; the owner may rename it): reads the transcript and
    proposes the best moments. Each moment needs a strong hook, must stand on its
    own as a complete thought, and should carry an emotional peak or a surprise.
    Scout scores each moment and says why.
  - **Rights checker** (working name; the owner may rename it): checks permission
    before anything is cut and blocks the run when there is none.
- **Extended agents:**
  - **Flip:** cut, reframe to vertical keeping the speaker centred, word-timed
    captions.
  - **Sage:** checks that each clip makes sense on its own, with no mid-sentence
    cuts and no context that changes the meaning, and that permission was recorded.
  - **Pip** (the publisher): title, hashtags, cover frame, and a **credit line to
    the original creator**.
- **Studio dashboard:** each new agent gets a pixel character and desk. The board
  gets cards for "Pick clips" and "Ready to post".
- **Order:** this phase comes **after** the vertical short-form phase and Pip,
  because it needs both.

## 3. What the Rights checker can and cannot do

- **It can:** verify **documented** permission and record it with the run. Accepted
  forms are:
  - a reuse-allowing licence, such as a Creative Commons licence that permits
    derivatives (check its terms, e.g. NonCommercial);
  - the creator's official clipping-programme terms;
  - written permission the owner provides.
- **It cannot:** give legal advice or decide "fair use". If permission is unclear,
  the answer is **don't post**.

## 4. Platform notes (check the current rules when building, because they change)

- YouTube and TikTok limit reach and monetisation for **reused / unoriginal
  content**. Clips should **add value**, for example commentary, context, a summary,
  or a short on-screen intro or reaction by our animated host.
- Captions must sit inside the vertical **safe zone**, away from the app's buttons.
- Credit the original creator in the description, and on screen if the creator's
  terms require it.

## 5. Reuse vs new work

| Need | Status |
|---|---|
| Word-timed transcription | Reuse local faster-whisper |
| Cutting, joining, audio mix | Reuse FFmpeg + audio tools |
| Word-by-word captions | Reuse hf-kit captions |
| Review gates, owner approvals, dashboard board | Reuse |
| Titles, hashtags, cover, checklist | Reuse Pip (built in an earlier phase) |
| Vertical layout + safe zones | Reuse (vertical phase) |
| Import a source video (file; link only where allowed) | **New** |
| Highlight scoring (Scout) | **New** |
| Permission check and record (Rights checker) | **New** |
| Speaker-tracking reframe 16:9 → 9:16 (face detection, smooth pan) | **New: the hardest part** |
| Optional host intro or reaction for added value | **New, reuses the world kit** |

## 6. Constraints (same as the rest of the project)

- Free and local tools first; no paid services without the owner's approval.
- Telemetry off; nothing is uploaded automatically. The owner uploads by hand until
  automation is decided separately.
- Don't widen `.claude/settings.json` without the owner's approval.
- The owner's personal info never goes into files or requests.
- Windows-safe: paths with spaces, list-argument subprocesses.
- The owner approves the clip list and the final clips, as with the existing gates.
- Lessons from `lessons.md` apply. Add sections for the new agents.

## 7. Open questions to settle in the design conversation

1. Names for Scout and the Rights checker.
2. Input: local files only, or also links (only from sources whose terms allow
   downloading)?
3. How many clips per source, and how long each?
4. Added value: should every clip get a host intro or reaction, or only some?
5. Credit line wording and placement.
6. Face tracking approach (a local, free library), and what to do with two speakers.

---

## Copy-paste prompt

```
I want to start the clipping phase for the video agent team.
Read docs/roadmap/clipping-phase-brief.md first; it has the decisions already made,
the constraints and the open questions. Also read lessons.md and the latest specs in
docs/superpowers/specs/.

Please:
1. Check that the vertical short-form phase and the publisher agent Pip are already
   built and merged. If not, tell me and stop.
2. Use the brainstorming skill: ask me the open questions one at a time (with your
   recommendation), then lay out approaches and write the design doc.
3. After I approve the design, write the plan and build it with subagent-driven
   development: a review after each task, a final whole-branch review, then show me
   test clips before merging to main.
4. Keep the rule: no proof of permission, no clip.
Don't merge to main until I approve the test clips.
```
