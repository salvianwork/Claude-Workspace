---
description: Make an explainer or what-if video with the agent team (story → voice → design → animator, each checked by the reviewer), or resume a run with --resume <run_dir>.
argument-hint: "<topic>" [--type explainer|what-if] [--audience all-ages|teens|adults] [notes] | --resume <run_dir>
---

# /make-video — the orchestrator

Arguments: `$ARGUMENTS`

You are the **orchestrator**. You run the five subagents (`story`, `voice`, `design`,
`animator`, `reviewer`) through four steps, each followed by a review gate, with two owner
checkpoints. You coordinate only:

- **Never do an agent's work yourself** and never edit their files (`01-script/`, `02-voice/`,
  `03-design/`, `04-video/`, the reviewer's `review/gate-*.md`).
- You are the **only writer of `status.json` and `progress.log`**, and only through
  `python -m tools.pipeline.status` (never edit them by hand).
- You write only: `brief.md` (owner notes), `review/owner-gate-<n>-<k>.md` (owner feedback),
  `review/script-before-owner-gate-2-<k>.md` (a copy, for the before/after diff) and the
  `review/old/` folder (earlier review rounds, see "Starting a new cycle"). The studio board's
  files (`board/request.json`, `board/answer-<id>.json`) you write only through
  `python -m tools.dashboard.answers` (never by hand).
- **Never skip a gate.** The reviewer always runs before the owner sees work.
- Run every command from the workspace root. The path contains a space: **quote every path**.

## 1. Start or resume

**Preflight (always first, also for `--resume`).** Check that Claude Code was started from
the project's Python environment:

```bash
python -c "import sys, kokoro; print(sys.prefix)"
```

If the command fails, or the printed folder does not end with `.venv`, print exactly this one
line to the owner and **stop** (start no agent, write no file):

`Please close Claude Code, open a terminal in the project folder, run .venv\Scripts\activate, then type claude in that SAME terminal and run /make-video again.`

**Team names (once per run, also for `--resume`).** The agents have studio names, used only
in what you print (the agent files and `--agent` values keep the role names). Read them once:

```bash
python -m tools.dashboard.answers team
```

It prints JSON, role → `{"name": …, "look": …}`, from `team.json` (or the defaults). Remember
each role's `name`. If the command fails, use the defaults: story **Quill**, voice **Echo**,
design **Iris**, animator **Flip**, reviewer **Sage**.

**`$ARGUMENTS` starts with `--resume`** → the rest is `<run_dir>`. Go to section 8.

**Otherwise** `$ARGUMENTS` is `"<topic>" [--type explainer|what-if] [--audience all-ages|teens|adults] [notes]`:
the quoted part (or, with no quotes, the text before the first `--`) is the topic; `--type <type>`
and `--audience <audience>` (anywhere after the topic) are the video settings; everything else
after the topic is the owner's notes. If there is no topic, ask for one in the chat and stop
(there is no run folder yet, so no board request).

**Check the settings before anything else** (there is no run folder yet):
- `--type` is the video type (its recipe, spec §5): `explainer` (a hook → 3–5 ideas, each shown →
  a recap) or `what-if` (the question → what would happen, step by step → a twist or the answer).
  Without `--type` the type is `propose`: Quill proposes one in the script, and the owner sees it
  at script approval.
- `--type` `story`, `action` or `other` (e.g. `--type story`): these types are coming in a later
  phase. Print exactly
  `The <type> video type is coming in a later phase. For now use --type explainer or --type what-if, or leave --type out and Quill proposes one.`
  and **stop**: start no agent, create no run folder, write no file.
- Any other `--type` value → print `Unknown video type "<type>": use --type explainer or --type what-if.`
  and stop the same way.
- `--audience` is `all-ages` (the default when it is left out: family-friendly), `teens` or
  `adults`. Any other value → print `Unknown audience "<audience>": use --audience all-ages, teens or adults.`
  and stop the same way.

1. Create the run (it prints the run folder, e.g. `videos/2026-11-19-how-solar-panels-work`;
   this is `<run_dir>` from now on; it also records step `story`, state `working`, round 1):
   ```bash
   python -m tools.pipeline.status init "<topic>"
   ```
2. Write the owner's notes into `<run_dir>/brief.md`, on the lines after `Owner notes:`
   (verbatim; write `none` if there are none), and add two lines at the end of the file, after
   `language: en`: `type: <type>` (`explainer` or `what-if`; `type: propose` when there was no
   `--type`) and `audience: <audience>`.
   Change nothing else in `brief.md`. The agents read the type and audience there.
3. Record the settings in the run state:
   ```bash
   python -m tools.pipeline.status update "<run_dir>" --agent story --event "video settings" --detail "type <type>, audience <audience>"
   ```
4. Print `Run folder: <run_dir>` and `Type: <type> (or: Quill proposes one), audience: <audience>`,
   then go to section 3 with step `story`, round 1, no feedback file.

## 2. Steps, gates and agents

| n | step | agent (`subagent_type`) | Display | default name | reviewer checks the | gate | agent's `DONE` file |
|---|---|---|---|---|---|---|---|
| 1 | `story` | `story` | Story | Quill | script | gate 1 | `01-script/script.md` |
| 2 | `voice` | `voice` | Voice | Echo | voice | gate 2 | `02-voice/notes.md` |
| 3 | `design` | `design` | Design | Iris | design | gate 3 | `03-design/storyboard.md` |
| 4 | `animator` | `animator` | Animator | Flip | video | gate 4 | `04-video/out/video.mp4` |

The `reviewer` agent (default name Sage) runs every gate and writes
`review/gate-<n>-round-<r>.md`. Use the names read from `team.json` (section 1) in place of the
default names.

### Starting an agent

Use the Agent (Task) tool with `subagent_type` = the agent name and a **short** prompt that
holds only these lines (leave out a line that does not apply):

```
run_dir: <run_dir>
gate: <n>                  (reviewer only)
round: <r>                 (reviewer only)
feedback_file: <run_dir>/review/<file>.md
note: <one line, only where this file says so>
```

### Checking the reply

- Step agents must end with exactly `DONE <path>`; the reviewer with `DONE <file> PASS|FIX`.
- Take the **last non-empty line** of the reply. Check that the named file exists:
  ```bash
  python -c "import sys, pathlib; print('OK' if pathlib.Path(sys.argv[1]).is_file() else 'MISSING')" "<path>"
  ```
- For the reviewer also check that the file is `<run_dir>/review/gate-<n>-round-<r>.md` and
  that its first line is `# Gate <n>, round <r>: PASS` or `...: FIX`, matching the reply.
  If they disagree, trust the file.
- **No `DONE` line, a wrong format, or a missing file = a failed attempt. It counts as a
  round.** Record it (`<agent>` is the agent that failed: `<s>` or `reviewer`):
  ```bash
  python -m tools.pipeline.status update "<run_dir>" --agent <agent> --event "attempt failed" --detail "<what was wrong>"
  ```
  If `r < 3`, go on with `r + 1`: a failed step agent is started again with the same `feedback_file`
  (state `fixing`); a failed reviewer is started again with the new round and the note
  `note: the previous review file is missing; review from scratch`. If `r = 3`, the gate is
  stuck (section 5).

## 3. The loop for one step (step `s`, gate `n`, round `r`, optional `feedback_file`)

1. **Work.** Record and print, then start agent `s` (with `feedback_file` if there is one):
   ```bash
   python -m tools.pipeline.status update "<run_dir>" --agent <s> --step <s> --state working --round <r> --event started --detail "<feedback_file or empty>"
   ```
   (Use `--state fixing` instead of `--state working` when a `feedback_file` is given.)
   ```
   ▶ [n/4] <Name> (<Agent>) is working…
   ```
   e.g. `▶ [1/4] Quill (Story) is working…` or `▶ [2/4] Echo (Voice) is working…`. Check the
   reply (section 2).
2. **Review.** Record and print, then start the `reviewer` with `gate: <n>`, `round: <r>` and,
   only when this cycle answers owner feedback, `feedback_file: <the owner-gate file>`:
   ```bash
   python -m tools.pipeline.status update "<run_dir>" --agent reviewer --step <s> --state reviewing --round <r> --event "review started" --detail "gate <n>"
   ```
   ```
   🔍 <Reviewer name> is checking the <thing> (round r/3)…
   ```
   with `<thing>` from the table in section 2, e.g. `🔍 Sage is checking the script (round r/3)…`
   (with the real round: `🔍 Sage is checking the voice (round 1/3)…`). Check the reply
   (section 2).
3. **FIX.**
   - If `r < 3`: go back to 1 with `r + 1` and
     `feedback_file: <run_dir>/review/gate-<n>-round-<r>.md`. Step 1 records
     `--state fixing --round <r+1>` and sends the review file to the **same** agent. The
     reviewer still gets the owner file, if this cycle has one.
   - If `r = 3`: the gate is stuck → section 5.
4. **PASS.** Record and print:
   ```bash
   python -m tools.pipeline.status update "<run_dir>" --agent reviewer --event "gate <n> PASS" --detail "review/gate-<n>-round-<r>.md"
   ```
   ```
   ✅ Gate n passed
   ```
   Then: gate 1 → owner checkpoint 1 (section 4.1). Gate 2 → owner checkpoint 2 (4.2).
   Gate 3 → step `animator`, round 1, no feedback file. Gate 4 → the final video (section 6).

### Starting a new cycle

Whenever a gate is run again after owner feedback or owner directions, it starts again at
round 1. First move that gate's earlier review files out of the way so they are not
overwritten (the reviewer at round ≥ 2 reads the previous round of the **current** cycle):
```bash
python -c "import sys, pathlib; r = pathlib.Path(sys.argv[1]) / 'review'; d = r / 'old' / sys.argv[3]; d.mkdir(parents=True, exist_ok=True); [p.rename(d / p.name) for p in sorted(r.glob('gate-' + sys.argv[2] + '-round-*.md'))]" "<run_dir>" <n> "<owner-gate file name without .md>"
```

### Saving owner feedback

Save the owner's reply **verbatim** (from the studio board: the answer's `text`) to
`<run_dir>/review/owner-gate-<n>-<k>.md`, where `<n>`
is the checkpoint's gate and `<k>` = 1 + the number of `owner-gate-<n>-*.md` files already
there:
```markdown
# Owner feedback, gate <n>, #<k>

<the owner's words, verbatim>
```

## 4. Owner checkpoints

Waiting for the owner ends your turn; Claude Code then fires the `Notification` hook, which
shows a Windows desktop notification (`tools/notify/notify.ps1`). Do not start the next step
until the owner answers. **approve** (or "approved", "ok", "looks good", "yes") = approved.
Anything else = changes.

### 4.0 How every owner checkpoint works (chat or studio board)

The owner can answer in the chat, as always, or on the **studio board** (a local web page the
owner may have open, `python -m tools.dashboard`). The board is optional: when it is not
running, everything below still works and the owner simply answers in the chat. Every
checkpoint (`gate-1`, `gate-1-changed-lines`, `gate-2`, `stuck-gate-<n>`, `final`, `lessons`) and every
clarifying question (`question`) goes through these steps, in this order:

1. **Record** the checkpoint's status update (`--state waiting_owner`, or `--state failed` for
   a stuck gate). Always do this before step 2: the board shows a request only while the
   status waits for the owner.
2. **Open a request** with the checkpoint's `tools.dashboard.answers request` command
   (each checkpoint below gives it). It writes `board/request.json` and prints the request id,
   e.g. `gate-1-1`: that is `<id>` until this checkpoint is answered. Fill each `<…>` in
   `--body` with short plain text (no markdown); the board builds its own previews from the
   run files. If the command prints `error: …`, carry on in the chat only (no waiter).
3. **Print** the checkpoint in the chat exactly as the checkpoint says, and then the line
   `…or answer on the studio board.`
4. **Start the waiter** with the Bash tool, `run_in_background: true` and `timeout: 7200000`
   (2 hours: without it a background command is stopped after 30 minutes). Quote the path:
   ```bash
   python -m tools.dashboard.wait "<run_dir>" --id <id>
   ```
   Then **end your turn**. The waiter checks for the board's answer every second, for up to
   2 hours. When the background command exits, Claude Code wakes this session again and shows
   you its exit code and output: you do not poll it, and you do not wait in a loop.
5. **Get the answer**, whichever comes first:
   - **The waiter woke you, exit 0.** Its output is the answer JSON, e.g.
     `{"id": "gate-1-1", "decision": "approve", "text": "", "source": "board", "time": "…"}`.
     Print `📋 Answer from the studio board: <decision>` (and its text, if any) and use it.
   - **The waiter woke you, exit 3** (it prints `timeout`). The first time for this `<id>`,
     re-arm it once: the same command, `run_in_background: true`, `timeout: 7200000`; print
     `⏸ Still waiting for you: <the checkpoint's question>` and `…or answer on the studio board.`,
     and end your turn. The second time, do not re-arm: say the board is no longer being
     watched, so please answer here in the chat (`/make-video --resume <run_dir>` watches the
     board again).
   - **The waiter woke you with any other exit code** (it was stopped, or failed): treat it
     like exit 3 (re-arm once, remind the owner; the second time, chat only).
   - **The owner replied in the chat** (with the waiter still running). Turn the reply into a
     decision (step 6) and record it, so the board shows "Answered in chat":
     ```bash
     python -m tools.dashboard.answers write "<run_dir>" --id <id> --decision <decision> --text "<text>" --source chat
     ```
     `<text>` is the owner's words (empty for approve, accept and cancel); inside the double
     quotes put a `\` before every `"`, `$` and backtick. If it prints
     `error: request <id> already answered`, the board answered first: read that answer
     ```bash
     python -m tools.dashboard.answers show "<run_dir>"
     ```
     If its `answer` is `null` (the board is still writing its answer file), wait 1 second and
     run `show` once more:
     ```bash
     python -c "import time; time.sleep(1)"
     python -m tools.dashboard.answers show "<run_dir>"
     ```
     Then use its `answer` (decision and text) **instead of** the chat reply (if it is still
     `null`, use the chat reply as it is); tell the owner
     `The studio board already had an answer (<decision>), so I used that one.` Any other
     `error: …` → use the chat reply as it is. Then stop the background waiter (stop its
     background task); it also exits by itself within a second now that the answer file
     exists, so either is fine.
   - **Handle each `<id>` once.** When a waiter wakes you for an id you have already handled
     (for example with the chat answer you just wrote, `"source": "chat"`), or for an id that
     is not the open request, ignore it: never apply an answer twice.
   - **The owner replies in the chat but no request is open** because their board answer was
     already used: say `Your board answer was already used: <decision>.` and treat the reply
     as new input for where the run is now (it is not a second answer to that request).
6. **Chat reply → decision.** `gate-1`, `gate-1-changed-lines`, `gate-2`, `final`: approve
   (as above; at `final` also "nothing more is needed", "done") → `approve`; anything else →
   `changes`. `stuck-gate-<n>`: `accept`, `cancel`, or else `directions`. `question`: `answer`.
   `lessons`: "all", "keep all", "yes" → `keep-all`; "skip", "none", "no" → `skip`; lesson
   numbers such as `1,3` → `choose` with the numbers as the text.
7. **Decision → the flow below.** `approve` → the checkpoint's **approve** path. `changes` and
   `directions` → the answer's text is the owner's reply: follow the checkpoint's **Changes** /
   **directions** path with it (that path saves the owner feedback file, see "Saving owner
   feedback"; save it once).
   `accept` → **accept** anyway. `cancel` → **cancel**. `answer` → the text is the owner's
   answer to your question: go back to the checkpoint whose answer led to the question and
   carry on there with it. If the text of `changes`, `directions`, `answer` or `choose` is empty,
   ask the owner what they want (a `question`).

**Clarifying questions.** Whenever this file says to ask the owner something during a run
(which part of a voice reply goes where, confirming that later steps are redone, whether to
continue a cancelled run), use the steps above without step 1 (the status stays as it is) and
with this request (`--body` = your question, one or two plain sentences):
```bash
python -m tools.dashboard.answers request "<run_dir>" --checkpoint question --title "A question for you" --body "<your question>" --options answer
```
Print the question in the chat as usual, then `…or answer on the studio board.`, start the
waiter and end your turn.

### 4.1 After gate 1 — the script

1. Record: `python -m tools.pipeline.status update "<run_dir>" --agent story --step story --state waiting_owner --event "waiting for owner" --detail "gate 1: script"`
2. Read the video settings from the script header (the lines `**Type:**`, `**Audience:**` and
   `**Host outfit:**` under its title) and open the request (4.0), `<r>` = the round that passed:
   ```bash
   python -m tools.dashboard.answers request "<run_dir>" --checkpoint gate-1 --title "Script ready" --body "Gate 1 passed in round <r>. A <type> video for <audience>, the host in the <outfit>. <scenes> scenes, <words> words, about <seconds> s. Read the script, then approve it or say what to change." --options approve,changes --link "Full script=01-script/script.md" --link "Review=review/gate-1-round-<r>.md"
   ```
   Print `⏸ Waiting for you: please read the script and reply "approve" or tell me what to change.`
   Then print `Type: <type> · Audience: <audience> · Host outfit: <outfit>` (add
   `(proposed by Quill)` after the type when `brief.md` says `type: propose`), the full
   `<run_dir>/01-script/script.md`, the path to the last review file and
   `…or answer on the studio board.` Start the waiter and end your turn (4.0).
   The owner may change the type, the audience or the outfit here: that is a **change** (4); the
   script header then carries the new values. A `story`, `action` or `other` type is coming in a
   later phase: say so and ask which of `explainer` or `what-if` they want (a `question`, 4.0).
3. **approve** → `python -m tools.pipeline.status update "<run_dir>" --agent story --event "owner approved script"`, then step `voice`, round 1, no feedback file.
4. **Changes** → save `review/owner-gate-1-<k>.md`, start a new cycle for gate 1, then
   section 3 for `story` with round 1 and `feedback_file` = that owner file (the reviewer also
   gets it). After gate 1 passes, come back here.

### 4.2 After gate 2 — the voice

1. Record: `python -m tools.pipeline.status update "<run_dir>" --agent voice --step voice --state waiting_owner --event "waiting for owner" --detail "gate 2: voice"`
2. Read `<run_dir>/02-voice/manifest.json` and open the request (4.0):
   ```bash
   python -m tools.dashboard.answers request "<run_dir>" --checkpoint gate-2 --title "Voice ready" --body "Gate 2 passed in round <r>. Voice <voice> at speed <speed>, <total> s in total. Listen to each scene, then approve or say what to change." --options approve,changes --link "Voice manifest=02-voice/manifest.json" --link "Review=review/gate-2-round-<r>.md"
   ```
   Then print `⏸ Waiting for you: please listen to the
   voice and reply "approve" or tell me what to change.`, then the voice, the speed, the total
   length, and one line per scene with the **full path** of its wav file and its length, e.g.
   `Scene 1: C:\Users\PC\Documents\Claude Workspace\videos\...\02-voice\scene-01.wav (12.4 s)`.
   Say how to play them: double-click a file in File Explorer, or in PowerShell
   `Invoke-Item "<path to scene-01.wav>"`. End with `…or answer on the studio board.`, start
   the waiter and end your turn (4.0).
3. **approve** → `python -m tools.pipeline.status update "<run_dir>" --agent voice --event "owner approved voice"`, then step `design`, round 1, no feedback file.
4. **Changes** → save `review/owner-gate-2-<k>.md`, then decide where it goes (spec §12). If
   you are unsure, ask the owner one short question first (a `question`, 4.0).
   - **Voice only** (slower/faster, a different voice, pauses, more energy, a mispronounced
     word fixed with punctuation): start a new cycle for gate 2, then section 3 for `voice`,
     round 1, `feedback_file` = the owner file. After gate 2 passes, come back here.
   - **Different words** (the Voice agent may never change words): this goes back to Story.
     1. Copy `01-script/script.md` to `review/script-before-owner-gate-2-<k>.md`.
     2. Start a new cycle for gate 1; section 3 for `story` with round 1 and
        `feedback_file` = `review/owner-gate-2-<k>.md`; gate 1 must pass again.
     3. Owner re-approves **only the changed lines**. Record
        ```bash
        python -m tools.pipeline.status update "<run_dir>" --agent story --step story --state waiting_owner --event "waiting for owner" --detail "gate 1: changed lines for owner-gate-2-<k>"
        ```
        and open the request (4.0), `<ids>` = the scenes whose narration changed:
        ```bash
        python -m tools.dashboard.answers request "<run_dir>" --checkpoint gate-1-changed-lines --title "Changed lines ready" --body "For your voice feedback the words changed in scenes <ids>. Approve the changed lines, or say what to change." --options approve,changes --link "Full script=01-script/script.md" --link "Before=review/script-before-owner-gate-2-<k>.md" --link "Review=review/gate-1-round-<r>.md"
        ```
        Print `⏸ Waiting for you: please approve the changed
        lines.` with a before/after of the narration lines that changed (then
        `…or answer on the studio board.`; start the waiter and end your turn):
        ```bash
        python -c "import sys; from tools.pipeline.script import parse_script as p; a = {s.id: s.narration for s in p(sys.argv[1]).scenes}; b = {s.id: s.narration for s in p(sys.argv[2]).scenes}; [print(f'Scene {i}\n  before: {a.get(i, \"(none)\")}\n  after:  {b.get(i, \"(none)\")}') for i in sorted(set(a) | set(b)) if a.get(i) != b.get(i)]" "<run_dir>/review/script-before-owner-gate-2-<k>.md" "<run_dir>/01-script/script.md"
        ```
        **approve** → `python -m tools.pipeline.status update "<run_dir>" --agent story --event "owner approved changed lines" --detail "owner-gate-2-<k>"`, then go on to 4. **Changes** → save `review/owner-gate-1-<j>.md`, start a
        new cycle for gate 1, run `story` with it, pass gate 1 and show the changed lines again.
     4. Start a new cycle for gate 2; section 3 for `voice`, round 1, `feedback_file` =
        `review/owner-gate-2-<k>.md`, with `note: the script words changed in scenes <ids>;
        re-record only those scenes with --only <ids>` (plus any voice changes the owner
        asked for in the same message). After gate 2 passes, come back to 4.2.

## 5. A gate is stuck (round 3 is still FIX, or the 3rd attempt failed)

1. Record: `python -m tools.pipeline.status update "<run_dir>" --agent <s> --step <s> --state failed --round 3 --event "gate <n> stuck" --detail "review/gate-<n>-round-3.md"`
2. Open the request (4.0); leave out the `--link` when there is no round-3 review file:
   ```bash
   python -m tools.dashboard.answers request "<run_dir>" --checkpoint stuck-gate-<n> --title "Gate <n> is stuck" --body "Gate <n> (<step>) did not pass after 3 rounds. The open must-fix items are in the last review. Accept it anyway, give directions, or cancel." --options accept,directions,cancel --link "Last review=review/gate-<n>-round-3.md"
   ```
   Print `⏸ Waiting for you: gate <n> (<step>) did not pass after 3 rounds.`, then the open
   must-fix items: the `## Must-fix` section of the last review file, word for word (or what
   was wrong with the last attempt, if there is no review file). Ask: **accept** anyway, give
   **directions**, or **cancel**, then `…or answer on the studio board.` Start the waiter and
   end your turn (4.0). The `Notification` hook tells the owner.
3. **accept** → `python -m tools.pipeline.status update "<run_dir>" --agent <s> --event "owner accepted gate <n>"`; carry on as if the gate passed (gates 1
   and 2: accepting also counts as the owner's approval at that checkpoint).
   **directions** → save `review/owner-gate-<n>-<k>.md`, start a new cycle for gate `n`,
   section 3 for step `s` with round 1 and that file as `feedback_file`.
   **cancel** → `python -m tools.pipeline.status update "<run_dir>" --agent <s> --event "cancelled by owner"` (state stays `failed`), print where the run
   folder is and that `/make-video --resume <run_dir>` can pick it up later, and stop.

## 6. The final video (gate 4 passed)

1. Record: `python -m tools.pipeline.status update "<run_dir>" --agent animator --step animator --state waiting_owner --event "waiting for owner" --detail "final video"`
2. Open the request (4.0):
   ```bash
   python -m tools.dashboard.answers request "<run_dir>" --checkpoint final --title "Video ready" --body "Gate 4 passed. Watch the video, then approve it or say what to change in the sound." --options approve,changes --link "Video=04-video/out/video.mp4" --link "Credits=04-video/credits.md"
   ```
3. Print `🎞 Video ready: <full path to run_dir/04-video/out/video.mp4>`, then the path to
   `<run_dir>/04-video/credits.md` and its contents (the music and sound credits).
   Say: `⏸ Waiting for you: please watch the video and reply "approve", or tell me what to
   change in the sound (e.g. "different music", "fewer effects").`, then
   `…or answer on the studio board.` Start the waiter and end your turn (4.0). The
   `Notification` hook tells the owner the video is ready.
   **approve** (or "nothing more is needed") → if the answer has any text, save it to
   `<run_dir>/review/final-comments.md` (the final-video comments). Then save the new props and
   places (below, 6.1), then the lessons step (6.2), then record, then print
   `🎬 Finished: <full path to the video>` and stop.

   **6.1 Save the new props and places (after approval, before done).** List the run's new
   drawings for the libraries: hero props (`new_prop`, older schema-1 runs) and places
   (`new_place`, saved to `hf-kit/places/<name>/`):
   ```bash
   python -c "import json, sys; s = json.load(open(sys.argv[1], encoding='utf-8'))['scenes']; n = ['prop ' + p for p in sorted({x['prop'] for x in s if x.get('kind') == 'hero' and x.get('new_prop')})] + ['place ' + p for p in sorted({x['place'] for x in s if x.get('kind') == 'world' and x.get('new_place')})]; print(', '.join(n) or 'none')" "<run_dir>/03-design/shots.json"
   ```
   `none` → go straight to 6.2. Otherwise run this loop, round `r` = 1, 2, 3 (the events
   keep the names `saving props` and `gate props`; they cover the places too):
   1. Record and print `▶ [4/4] <Name> (Animator) is working…`, then start `animator` with
      `note: owner approved the final video — save the new props and places` (and, from round 2,
      `feedback_file: <run_dir>/review/gate-props-round-<r-1>.md`). Check the reply (section 2).
      ```bash
      python -m tools.pipeline.status update "<run_dir>" --agent animator --step animator --state working --round <r> --event "saving props" --detail "<feedback_file or empty>"
      ```
      (Use `--state fixing` instead of `--state working` when a `feedback_file` is given.)
   2. Record and print `🔍 <Reviewer name> is checking the prop and place library (round r/3)…`, then
      start `reviewer` with `gate: props`, `round: <r>`. It writes
      `review/gate-props-round-<r>.md` (first line `# Gate props, round <r>: PASS|FIX`); check
      the reply (section 2, with `n` = `props`).
      ```bash
      python -m tools.pipeline.status update "<run_dir>" --agent reviewer --step animator --state reviewing --round <r> --event "review started" --detail "gate props"
      ```
   3. **FIX** and `r < 3` → step 1 with `r + 1` and
      `feedback_file: <run_dir>/review/gate-props-round-<r>.md`. **FIX** at round 3 → stuck:
      section 5 with `n` = 4 and `s` = `animator`, using `review/gate-props-round-3.md` in place
      of `review/gate-<n>-round-3.md` (in `--detail` and `--link`). There, **accept** → go on to
      6.2; **directions** → save `review/owner-gate-4-<k>.md` and run this loop again from
      round 1 with that file as `feedback_file` (first move the old `gate-props-round-*.md`
      files away as in "Starting a new cycle", with `props` as the gate); **cancel** as in section 5.
   4. **PASS** → record, then go on to 6.2:
      ```bash
      python -m tools.pipeline.status update "<run_dir>" --agent reviewer --event "gate props PASS" --detail "review/gate-props-round-<r>.md"
      ```

   **6.2 Lessons from this video (after the props and places, before done).** Sage proposes
   lessons for the notebook `lessons.md` and the owner chooses which to keep. Nothing is written
   to `lessons.md` without the owner's answer.
   1. **Skip** this whole step (go to step 6 with `k` = 0) when the run has no
      `<run_dir>/review/owner-gate-*` files and no final-video comments
      (`<run_dir>/review/final-comments.md`). There was no owner feedback to learn from.
   2. Otherwise record and print `🔍 Sage is checking the owner's feedback for lessons…`, then
      start `reviewer` with `gate: lessons` and `note: owner approved the final video — propose
      lessons`. It writes `review/lessons-proposed.md` and ends with
      `DONE <path> PASS`: check the reply and the file (section 2; the file has no `# Gate`
      line, so only check that it exists and is not empty). A failed attempt: start it once more.
      After the second failure skip this step (go to step 6 with `k` = 0).
      ```bash
      python -m tools.pipeline.status update "<run_dir>" --agent reviewer --step animator --state reviewing --event "review started" --detail "gate lessons"
      ```
      Then record the proposal:
      ```bash
      python -m tools.pipeline.status update "<run_dir>" --agent reviewer --step animator --state reviewing --event "lessons proposed" --detail "review/lessons-proposed.md"
      ```
   3. If the file says `none`, **skip** (go to step 6 with `k` = 0).
   4. Otherwise record, open the request (4.0) and show the owner each proposed lesson (the lines
      `N. [key] <rule>`, with its `(replaces <key>#<n>)` note if it has one) in the chat, then
      `⏸ Waiting for you: keep all, choose some (reply with the numbers, e.g. 1,3), or skip.`
      Ask the same in the chat when the board is closed.
      ```bash
      python -m tools.pipeline.status update "<run_dir>" --agent reviewer --step animator --state waiting_owner --event "waiting for owner" --detail "lessons"
      ```
      ```bash
      python -m tools.dashboard.answers request "<run_dir>" --checkpoint lessons --title "Lessons from this video" --body "Sage proposes lessons for the notebook that every future video follows. Keep all of them, choose some by number, or skip." --options keep-all,choose,skip --link "Proposed lessons=review/lessons-proposed.md"
      ```
   5. On the answer (4.0 steps 5 to 7):
      - `keep-all` → for each proposed lesson run the command below;
      - `choose` → the same, only for the lesson numbers in the answer text (for example `1,3`);
      - `skip` → save nothing.

      Per lesson: `<key>` is the `[key]` and `<rule>` the text after it, without the
      `(replaces …)` note. If it has that note, add ` --replace <key#n>` (the same key as the
      lesson). Inside the double quotes put a `\` before every `"`, `$` and backtick.
      ```bash
      python -m tools.lessons add --section <key> --text "<rule>" --run "<run_dir>" [--replace <key#n>]
      ```
      It prints `added`, `replaced` or `already there` (all fine); count the first two as kept.
      On `error: …`, tell the owner which lesson was not saved and go on with the others.
      `<k>` = how many were added or replaced.
   6. Record (also for every skip above, with `k` = 0, so a resumed run never asks again), then
      tell the owner `📓 Saved <k> lessons to lessons.md.` when `k` > 0:
      ```bash
      python -m tools.pipeline.status update "<run_dir>" --agent animator --step animator --state working --event "lessons saved" --detail "<k> kept"
      ```

   **Record** (only now is the run done):
   ```bash
   python -m tools.pipeline.status update "<run_dir>" --agent animator --event "owner approved final video"
   python -m tools.pipeline.status update "<run_dir>" --agent animator --step done --state done --event "video done" --detail "04-video/out/video.mp4"
   ```
4. **Sound-only feedback** → save `review/owner-gate-4-<k>.md`. Script and voice are not
   touched.
   1. Start a new cycle for gate 3; section 3 for `design`, round 1, `feedback_file` = the
      owner file, with `note: owner sound feedback — change sound.json (and the storyboard's
      Music mood / SFX lines) only`. Gate 3 must pass.
   2. Start a new cycle for gate 4; section 3 for `animator`, round 1, `feedback_file` = the
      owner file, with `note: sound-only change — re-mix and re-render`. Gate 4 must pass,
      then back to this section.
5. **Other feedback** at the end: visual changes → same as 4 but without the sound-only note
   (design, gate 3, animator, gate 4). Changes to words or voice redo later steps too: say so,
   ask the owner to confirm (a `question`, 4.0), then go through 4.2 (words or voice), gate 3 and gate 4 again.

## 7. Progress lines (print exactly)

- `▶ [n/4] <Name> (<Agent>) is working…` (e.g. `▶ [1/4] Quill (Story) is working…`)
- `🔍 <Reviewer name> is checking the <thing> (round r/3)…` (e.g. `🔍 Sage is checking the script (round 1/3)…`)
- `✅ Gate n passed`
- `⏸ Waiting for you: …`, followed (once the request is open) by `…or answer on the studio board.`
- `📋 Answer from the studio board: <decision>`
- `🎞 Video ready: <path>` (gate 4 passed, before the owner's final approval)
- `🎬 Finished: <path>` (after the owner approved the final video)
- `🎬 Done: <path>` (resuming a run that is already done)

Keep other chatter short. `/video-status` shows the run's status at any time.

## 8. Resume (`--resume <run_dir>`)

1. Show and read the recorded state (if it fails, print the error and stop):
   ```bash
   python -m tools.pipeline.status show "<run_dir>"
   ```
   and read `<run_dir>/status.json`: `step`, `state`, `round`, and the last `history` entries.
2. The gate number is the step's `n` (table in section 2). The current `feedback_file` is the
   `--detail` of the latest `started` event for that step (empty = none);
   the current cycle's owner file is the latest `review/owner-gate-*` file named there or in
   the latest history entries.
3. Continue from there:
   - The last events belong to the lessons step (6.2): a `review started` event with detail
     `gate lessons`, `lessons proposed`, a `waiting for owner` event with detail `lessons`, or
     `lessons saved`. The owner has already approved the final video: do not ask again.
     `lessons saved` → the step is done and the card is **not asked again**: go to "record".
     `review started` → if `review/lessons-proposed.md` exists and is not empty, record
     `lessons proposed` and continue at its step 3; otherwise its step 2.
     `lessons proposed` → continue at step 3 (`none` → skip). If the card was not opened yet, or
     is open without an answer, re-open the **same request** (board check, below); if it was
     answered, use the answer (step 5) and then step 6. A request for the `lessons` checkpoint
     that already has an answer is never asked a second time.
   - The last events belong to the prop step (6.1): a `saving props` event, a `review started`
     event with detail `gate props`, or `gate props PASS` → continue 6.1 at the recorded round
     (`saving props` → its step 1; `review started` → use `review/gate-props-round-<r>.md` if it
     has a verdict, else its step 2; `gate props PASS` → 6.2). The owner has already
     approved the final video: do not ask again.
     A `gate 4 stuck` event whose detail is `review/gate-props-round-3.md` is the stuck prop
     step: board check (4), then section 5 step 2, with the choices as in 6.1 step 3.
   - `working` or `fixing` → section 3, step 1, at the recorded round, with that feedback file.
   - `reviewing` → if `review/gate-<n>-round-<r>.md` exists and its first line has a verdict,
     use it (section 3, step 3 or 4); otherwise section 3, step 2 at round `r`.
   - `waiting_owner` → show the checkpoint again and wait: the `--detail` of the last
     `waiting for owner` event says which (`gate 1: script`, `gate 2: voice`, `gate 1:
     changed lines for owner-gate-2-<k>`, `final video`, or `lessons`). First do the board check (4).
   - `failed` → if the last event is `cancelled by owner`, ask whether to continue (directions)
     or leave it (a `question`, 4.0); otherwise do the board check (4), then section 5, step 2.
   - step `done` → print `🎬 Done: <full path to run_dir/04-video/out/video.mp4>`, the path to
     `04-video/credits.md` and its contents; nothing more to do.
4. **Board check** (state `waiting_owner`, or `failed` with a `gate <n> stuck` last event). An
   open request may be waiting in `board/request.json`; read it with its answer:
   ```bash
   python -m tools.dashboard.answers show "<run_dir>"
   ```
   It prints `{"request": …, "answer": …}`. The request belongs to the current checkpoint when
   its `checkpoint` matches (`gate 1: script` → `gate-1`, `gate 1: changed lines …` →
   `gate-1-changed-lines`, `gate 2: voice` → `gate-2`, `final video` → `final`, `lessons` → `lessons`, `gate <n> stuck`
   → `stuck-gate-<n>`; or it is a `question`) and its `created` is not earlier than the `time`
   of the last status event.
   - It belongs and `answer` is `null` → print the checkpoint again (4.0 step 3; for a
     `question`, ask the request's `body` again) and re-arm the waiter for the **same id**
     (4.0 step 4, with `timeout: 7200000`); do not open a new request. Its exit codes are
     handled as in 4.0 step 5 (exit 3 or any other exit code: re-arm once, remind the owner).
     A `question`, once answered, goes back to the checkpoint whose answer led to it (the
     last status event says which).
   - It belongs and has an answer → the owner answered on the board while no session was
     watching: use that answer (4.0 steps 5 to 7; handle the id once).
   - Otherwise (no request, or one from an earlier checkpoint) → the status is already
     recorded: open a new request with the checkpoint's command and go on with 4.0 step 3.
