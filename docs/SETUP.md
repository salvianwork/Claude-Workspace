# Setting up the video team on Windows

Do these steps once, in order. Copy each grey command box exactly, paste it, press Enter.
"Terminal" means **Windows Terminal** or **PowerShell** (press the Windows key, type `PowerShell`, Enter).
After each `winget` install, **close the terminal and open a new one** so Windows finds the new program.

Your project folder is `C:\Users\PC\Documents\Claude Workspace`. Every command below is run inside it,
so first do:

```
cd "C:\Users\PC\Documents\Claude Workspace"
```

## 1. Install the programs

Run these one at a time. If one says "already installed", that is fine.

```
winget install -e --id Python.Python.3.12
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Gyan.FFmpeg
winget install -e --id Git.Git
```

Optional (not needed: the voice engine brings its own copy of eSpeak):

```
winget install -e --id eSpeak-NG.eSpeak-NG
```

Notes:
- It must be **Python 3.12**. Python 3.13 does not work with the voice engine.
- Git for Windows is needed because Claude Code runs its helper hooks through "Git Bash".
- The eSpeak line is optional. If you run it and it says no package was found, just skip it.

What success looks like: each line ends with "Successfully installed" (or says it is already installed).

Close the terminal and open a new one, then go back to the project folder (`cd` line above).

### Install Claude Code

Claude Code is the program that runs the video team. Install it from the official page
**https://claude.ai/download**, or, in a new terminal (Node.js from the list above must be installed):

```
npm install -g @anthropic-ai/claude-code
```

What success looks like: `claude --version` prints a version number.

## 2. Create the Python environment

```
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -e ".[voice,review,dev]"
python -m spacy download en_core_web_sm
```

What success looks like: you see `(.venv)` at the start of the line, `pip` ends with
"Successfully installed …" and the spaCy line ends with "Download and installation successful".

**Every time you open a new terminal** for this project, run `cd "C:\Users\PC\Documents\Claude Workspace"`
and `.venv\Scripts\activate` first.

**How to start Claude Code (always like this):** open a terminal in the project folder, run
`.venv\Scripts\activate`, then type `claude` in that SAME terminal. Claude Code started any
other way (from the Start menu, or in a terminal without `(.venv)`) cannot find the voice
engine, and `/make-video` will stop and tell you to do this.

If PowerShell says "running scripts is disabled", run this once and try the activate line again:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

## 3. Install the video (Remotion) packages

```
cd templates
npm install
cd ..
```

What success looks like: npm ends with "added … packages" (warnings in yellow are fine).

## 4. Install the two Claude Code plugins

1. Open Claude Code: in the terminal with `(.venv)` (see step 2), type `claude`.
2. Type `/plugin` and press Enter.
3. Find **Remotion** in the Anthropic Directory and install it.
4. Find **watch-video** and install it. (Optional: without it the reviewer uses its built-in
   still-picture checks.)
5. Restart Claude Code (type `/exit`, then `claude` again in the same terminal).

What success looks like: `/plugin` lists Remotion (and watch-video) as installed.

## 5. Fill the music and sound library

- 6 basic sound effects are already in the project.
- **Music you must download yourself** (free, no sign-up needed for most). Open
  `assets\audio\DOWNLOAD-LIST.md`: it lists where to download from and what to search for.
  You need **at least 2 tracks for each of 6 moods** (curious, upbeat, calm, inspiring, dramatic, playful).
- Only tracks with the licence `Pixabay-Content-License` or `CC0-1.0` are accepted.
- For each downloaded file, run (change the path, mood and page address):

```
python -m tools.audio.library add "C:\Users\PC\Downloads\my-track.mp3" --kind music --tags curious --licence Pixabay-Content-License --source-url "https://pixabay.com/music/the-page-of-this-track/"
```

  What success looks like: it prints `added <name> (<seconds>s, LUFS <number>)`.

- When all are added, check:

```
python -m tools.audio.library validate
```

It should print `OK`.

## 6. First-run downloads (internet needed once)

The first time you use them, these download automatically, so just let them finish:
- the Kokoro voice model and the Whisper `small.en` listening model (from HuggingFace),
- Remotion's own hidden browser (on the first video render).

What success looks like: the first video finishes; later videos start faster.

Optional, after your first successful video: stop the voice and listening models from checking
for updates online every time (faster start, works offline). Run once, then open a new terminal:

```
setx HF_HUB_OFFLINE 1
```

To undo it: `setx HF_HUB_OFFLINE 0`.

## 7. Check everything

```
python -m tools.check_setup
```

What success looks like: every line shows a green tick (✅) and the last line says `Ready.`
A yellow warning is fine to ignore. A red cross shows a
"fix:" line underneath: do that, then run the check again.

## 8. Open the studio (optional)

The studio is a small page that shows the team at work and lets you approve with a button.
In a **second** terminal (with `(.venv)`), run:

```
cd "C:\Users\PC\Documents\Claude Workspace"
.venv\Scripts\activate
python -m tools.dashboard
```

Keep it open while you make videos. What success looks like: the terminal prints
`Studio running at http://127.0.0.1:8765/?key=...` and your browser opens the studio.
More in [`docs/dashboard/README.md`](dashboard/README.md).

## Things you can change

**The narrator's voice.** The default is `am_adam` (male, chosen to match the presenter). Other choices
include `am_michael`, `am_fenrir`, `am_puck`, `bm_george`, `bm_fable`
(British voices such as `bm_george`, `bm_fable`, `bm_lewis` get a British accent automatically).
To switch, ask Claude Code: "change the default voice to am_fenrir". It is one line in
`tools/voice/synth.py` (`DEFAULT_VOICE`) and the same name in `.claude/agents/voice.md`.

**The presenter's look** (skin, hair, shirt, glasses): `templates/src/presenter/look.ts`.
To see him:

```
cd templates
npm run character-sheet
cd ..
```

Open `templates\out\character-sheet.png`.

**Desktop notifications.** Test one (PowerShell):

```
'{"message":"Test notification"}' | powershell -NoProfile -ExecutionPolicy Bypass -File "tools/notify/notify.ps1"
```

A pop-up titled "Video Agent Team" should appear at the bottom right. If nothing appears:
1. Turn off Focus Assist / Do Not Disturb (Settings, System, Notifications).
2. In Settings, System, Notifications, make sure notifications are On and that
   **Windows PowerShell** is allowed to send them.
3. Make sure Git for Windows is installed (step 1): Claude Code runs the hook through Git Bash,
   which is how the project-folder path in the hook gets filled in.

## Where to go next

Follow `docs\TEST-CHECKLIST.md` for the first real test run.
