# Getting Started: Your First Video, Step by Step

This guide is for a Windows PC. Do the steps in order. Details for any step are in
`docs/SETUP.md`. If something fails, copy the error message and paste it to Claude.

> Your project folder below is `C:\Users\PC\Documents\Claude Workspace`.
> If yours is somewhere else, use that path instead.

---

## Part A — One-time setup (skip it if you have already done this)

1. **Install the programs.** Open PowerShell and run these one at a time. After each one,
   close PowerShell and open a new window.
   ```
   winget install -e --id Python.Python.3.12
   winget install -e --id OpenJS.NodeJS.LTS
   winget install -e --id Gyan.FFmpeg
   winget install -e --id Git.Git
   winget install -e --id eSpeak-NG.eSpeak-NG
   ```
   Also install **Claude Code** (see `docs/SETUP.md`, "Install Claude Code").
2. **Go to your project folder:**
   ```
   cd "C:\Users\PC\Documents\Claude Workspace"
   ```
3. **Create the Python environment** (`docs/SETUP.md` §2):
   ```
   py -3.12 -m venv .venv
   .venv\Scripts\activate
   pip install -e ".[voice,review,dev]"
   python -m spacy download en_core_web_sm
   ```
4. **Install the video kit:**
   ```
   cd hf-kit
   npm ci
   npm run sample
   cd ..
   ```
   `npm run sample` should make a 3-second test clip at `hf-kit\sample\out.mp4`.
5. **Add music and sound effects.** Only use tracks you are allowed to use (for example from
   Pixabay). See `docs/SETUP.md` §5 for the command. **Without music, videos have voice only.**
6. **Check everything:**
   ```
   python -m tools.check_setup
   ```
   Every line should say OK. Fix any that don't before you continue (ask Claude if unsure).

---

## Part B — Get the latest version (do this every time there is an update)

```
cd "C:\Users\PC\Documents\Claude Workspace"
git pull
```
If the update notes mention new packages, also run `cd hf-kit`, then `npm ci`, then `cd ..`.

---

## Part C — Make a video

1. **Start everything with one command.** In the project folder:
   ```
   .\studio
   ```
   Or double-click **`studio.cmd`** in File Explorer.
   - Your browser opens the **pixel studio**, with the team at their desks.
   - **Claude Code** starts in the same window.
2. **Ask for a video.** Type into Claude Code, for example:
   ```
   /make-video "Why is the sky blue?"
   ```
   - This makes a **vertical short** (1080 × 1920, for phones), the default: about 45–75 seconds,
     a hook in the first two seconds, one idea every 5–8 seconds, and a last line that invites a
     rewatch or a comment. The host talks from the bottom corner of the tall frame and steps into
     the scene once or twice; captions sit in the middle of the screen (at the top while he is in
     the scene), and labels and tags stay inside the phone-safe area.
   - Want the old wide video (1920 × 1080, 1–3 minutes) instead? Add `--format landscape`:
     ```
     /make-video "Why is the sky blue?" --format landscape
     ```
   - Types available now: `explainer` and `what-if` (add `--type what-if`, e.g.
     `/make-video "What if the Moon disappeared?" --type what-if`). Story, action and other types
     come later.
   - Optional: `--audience teens` or `--audience adults` (the default is all ages).
   - Examples of finished vertical shorts: `docs\hf\vertical-*-sheet.png`.
3. **Watch the team work** in the studio: Quill writes, Echo records, Iris plans,
   Flip animates, and Sage checks each step.
4. **Approve when asked.** A card appears on the studio's big board (or a question in the chat):
   - **Script**: read it, then approve or type what to change.
   - **Voice**: listen, then approve or type what to change.
   - **Final video**: watch it, then approve or type what to change.
   - Tip: type your comments clearly. They can become lessons for future videos.
5. **Lessons** (only if you gave feedback): after you approve the final video, a card
   "Lessons from this video" asks **Keep all / Choose some (e.g. `1,3`) / Skip**.
   Kept lessons go into `lessons.md`, which you can open and edit at any time.

---

## Part D — Where your video is

The run folder is printed at the start, for example:
`videos\2026-11-26-why-is-the-sky-blue\`
- **Final video:** `04-video\out\video.mp4`
- **Script:** `01-script\script.md`
- **Music and sound credits:** `04-video\credits.md` (keep these for posting)

---

## Part E — When you're done

- Type `/exit` in Claude Code, or press **Ctrl+C** twice. The studio closes by itself.
- To keep the studio open, start with `.\studio --keep-studio` instead.
- To continue an unfinished video later: `/make-video --resume <run folder>`.

---

## Part F — Tell Claude how it went (this helps the next steps)

Please note and share:
1. **Setup problems**: any error messages (copy them).
2. **Time**: how long from your request to the final video.
3. **Usage**: whether you hit a Claude usage limit, and when.
4. **Your opinion**: what looked great and what didn't.

---

## If something goes wrong

| Problem | What to do |
|---|---|
| "Run the setup first: see docs\SETUP.md" | Part A isn't finished: do step 3 |
| The browser doesn't open | Open `.studio\studio.log` and paste its contents to Claude |
| "claude not found" | Install Claude Code (Part A, step 1) |
| `check_setup` says Node is too old | `winget upgrade -e --id OpenJS.NodeJS.LTS`, then open a new PowerShell |
| "Cannot find module" / "hyperframes" | `cd hf-kit`, then `npm ci`, then `cd ..` |
| A step is stuck after 3 review rounds | A "stuck" card appears: choose accept, give directions, or cancel |
| The first render takes long or downloads something | Normal: it downloads a browser once (internet needed that one time) |
