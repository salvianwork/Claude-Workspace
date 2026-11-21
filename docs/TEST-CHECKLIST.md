# First test on your Windows PC

Tick each box as you go. If something fails, copy the red text and tell Claude Code.
Start with the setup from `docs\SETUP.md`.

Before you start, make sure **Claude Code is installed** (official page https://claude.ai/download,
or `npm install -g @anthropic-ai/claude-code`). `claude --version` should print a version number.

## 1. HyperFrames sample clip (do this first)

Videos are now made with HyperFrames (the kit in `hf-kit`). Check it renders on your PC:

```
cd "C:\Users\PC\Documents\Claude Workspace\hf-kit"
npm run sample
cd ..
```

- [ ] It ends without a red error, and `hf-kit\sample\out.mp4` exists.
- [ ] Open it: you should see a 3-second clip (dark background, the kit's sample scene).
- [ ] If it fails with "Cannot find module" or "hyperframes": run `npm ci` in `hf-kit` (SETUP step 3) and try again.

## 2. Setup check

Open a terminal, then:

```
cd "C:\Users\PC\Documents\Claude Workspace"
.venv\Scripts\activate
python -m tools.check_setup
```

- [ ] No red crosses. (Yellow warnings are OK; a missing plugin only gets a warning.)
- [ ] The music line says you have at least 2 tracks per mood (or at least some music).

## 3. Notification test

```
'{"message":"Test notification"}' | powershell -NoProfile -ExecutionPolicy Bypass -File "tools/notify/notify.ps1"
```

- [ ] A "Video Agent Team" pop-up appears at the bottom right.
- [ ] If not: see "Desktop notifications" at the end of `docs\SETUP.md`.

## 4. A real video

Write down the time when you start: ________ (the whole video, from `/make-video` to the
finished film, is the number to report).

Open a terminal in the project folder, run `.venv\Scripts\activate`, then type `claude` in that
SAME terminal (Claude Code must start inside the `(.venv)` terminal, or it cannot find the voice).
In Claude Code, type:

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
- [ ] You like the voice (default `am_adam`). If not, say which of `am_michael`, `am_fenrir`, `am_puck`, `bm_george`, `bm_fable` to try.

**Step 3 - Design (automatic, reviewed).** Style and sound plan.
- [ ] Nothing for you to do; wait for the next message.

**Step 4 - Video (automatic, reviewed).** The final film is `videos\<run>\04-video\out\video.mp4`.
- [ ] The render takes a while (on the test computer about 12-15 times the video's length,
      so 25-30 minutes for a 2-minute video). The first render may also download a browser once.
- [ ] Write down: finish time ________, total time ________, render time (from
      `videos\<run>\04-video\render.log`, the line `hyperframes render took … s`) ________.
- [ ] 2 to 4 scenes are custom drawings (the "hero" scenes, e.g. the volcano); the others are
      kit scenes (titles, steps, charts, comparisons, recap). Labels appear on the word that names the part.
- [ ] Length is 60-180 seconds, picture is sharp (1920 x 1080), captions are readable.
- [ ] The presenter appears, never covers text or captions, and his mouth moves while he talks.
- [ ] Music is quiet under the voice; you can always hear the voice clearly.
- [ ] No more than about one sound effect per scene, and none that drowns a word.
- [ ] `videos\<run>\04-video\credits.md` lists the music and sound effects used (the video
      itself is `videos\<run>\04-video\out\video.mp4`).

## 5. Approve (or not) the HyperFrames look

- [ ] Do you like how the video looks (drawings, movement, captions, presenter)? Tell Claude
      "I approve the HyperFrames look" or what you do not like.
- [ ] Each approved HyperFrames video counts. After **3 approved videos**, ask Claude to remove the
      old Remotion engine (`templates\` and `--engine remotion`). Until then it stays as a fallback.
- Approved videos so far: [ ] 1  [ ] 2  [ ] 3

## 6. The studio dashboard

Open a second terminal in the project folder, run `.venv\Scripts\activate`, then
`python -m tools.dashboard`. Keep it open for the checks below (you can do them during the
video from section 4, or with a short topic such as `/make-video "Why the sky is blue"`).

1. [ ] **Start the studio.** The browser opens a studio with five characters.
   You should see: the board shows your latest video, or "No video running" if there are none.
2. [ ] **Answer gate 1 on the board.** Start `/make-video`; when the script is ready, click
   **Approve** on the board (do not type in the chat).
   You should see: the board says "Sent", and within a few seconds Claude Code continues by
   itself with the voice step, without you typing anything. (This is the Windows proof of the
   background wake-up. If Claude Code stays still for more than about 30 seconds, tell Claude.)
3. [ ] **Answer gate 2 in the chat.** When the voice is ready, type your answer in Claude Code
   instead of using the board.
   You should see: the board changes to "Answered in chat".
4. [ ] **Rename an agent.** Open `team.json` in Notepad, change one `name` (for example
   `"Quill"` to `"Maya"`), save, and refresh the browser page.
   You should see: the new name on the map and on the board.

## 7. If a run stops

- Type `/video-status` to see where it is.
- Type `/make-video --resume videos\<run folder>` to continue.
- After 3 failed fix rounds on one step, the team stops and asks you what to do. That is by design.

## 8. Tell Claude what you saw

Report: what was good, what was wrong, which step, and the run folder name.
