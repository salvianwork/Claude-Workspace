# First test on your Windows PC

Tick each box as you go. If something fails, copy the red text and tell Claude Code.
Start with the setup from `docs\SETUP.md`.

## 1. Setup check

Open a terminal, then:

```
cd "C:\Users\PC\Documents\Claude Workspace"
.venv\Scripts\activate
python -m tools.check_setup
```

- [ ] No red crosses. (Yellow warnings are OK; a missing plugin only gets a warning.)
- [ ] The music line says you have at least 2 tracks per mood (or at least some music).

## 2. Notification test

```
'{"message":"Test notification"}' | powershell -NoProfile -ExecutionPolicy Bypass -File "tools/notify/notify.ps1"
```

- [ ] A "Video Agent Team" pop-up appears at the bottom right.
- [ ] If not: see "Desktop notifications" at the end of `docs\SETUP.md`.

## 3. A real video

Open Claude Code in the project folder and type:

```
/make-video "How volcanoes work"
```

It works in four steps. At each checkpoint, check these things:

**Step 1 - Script (you approve).** You get a notification, then the script.
- [ ] 150-450 words in total, split into short scenes (about 6 to 10).
- [ ] Simple language, true statements, a clear start and ending.
- [ ] The reviewer's note says PASS. Reply with changes, or approve.

**Step 2 - Voice (you approve).** A notification, then the narration recordings in `videos\<run>\02-voice\`.
- [ ] Open the `.wav` files and listen. Clear, natural, right speed, no missing or changed words.
- [ ] You like the voice. If not, say which of `am_michael`, `am_fenrir`, `am_puck`, `am_adam`, `bm_george`, `bm_fable` to try.

**Step 3 - Design (automatic, reviewed).** Style and sound plan.
- [ ] Nothing for you to do; wait for the next message.

**Step 4 - Video (automatic, reviewed).** The final film is `videos\<run>\04-video\out\video.mp4`.
- [ ] The first render downloads a browser and takes a few minutes. That is normal.
- [ ] Length is 60-180 seconds, picture is sharp (1920 x 1080), captions are readable.
- [ ] The presenter appears, never covers text or captions, and his mouth moves while he talks.
- [ ] Music is quiet under the voice; you can always hear the voice clearly.
- [ ] No more than about one sound effect per scene, and none that drowns a word.
- [ ] `credits.md` sits next to the video and lists the music used.

## 4. If a run stops

- Type `/video-status` to see where it is.
- Type `/make-video --resume videos\<run folder>` to continue.
- After 3 failed fix rounds on one step, the team stops and asks you what to do. That is by design.

## 5. Tell Claude what you saw

Report: what was good, what was wrong, which step, and the run folder name.
