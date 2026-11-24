# Feedback Notebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `lessons.md` notebook that every agent reads before working. After each approved video, Sage proposes up to 5 lessons from the owner's feedback and the owner keeps all, chooses some, or skips.

**Architecture:**
- A small stdlib Python tool, `tools/lessons`, owns the file format: read, add, replace and check.
- The dashboard board gains a `lessons` checkpoint.
- The agent files and `make-video.md` gain the read rule, Sage's proposal step, and the owner confirmation after final approval.

**Tech Stack:** Python 3.12 stdlib, pytest; Markdown agent files; the existing dashboard (`tools/dashboard`).

**Spec:** `docs/superpowers/specs/2026-11-24-feedback-notebook-design.md`

## Global Constraints

- **Notebook file:** `lessons.md` at the project root, in plain Markdown, UTF-8.
- **Sections, in order:**
  - `## Everyone`
  - `## Quill (script)`
  - `## Echo (voice)`
  - `## Iris (design)`
  - `## Flip (animation)`
  - `## Sage (review)`
- **Section keys:** `everyone`, `quill`, `echo`, `iris`, `flip`, `sage`.
- **Lesson line:** `- <lesson> _(from <run folder name>, <YYYY-MM-DD>)_`. Lines the owner writes by hand need no suffix.
- **Proposals:** at most **5** per video. Skipped silently when the run has no owner feedback.
- **Size:** a soft cap of **40** lessons. Above it, `check` warns and Sage's proposal also suggests merges or removals.
- **Lesson text:** one line, ≤ 160 characters. No e-mail addresses and no URLs (privacy).
- **Precedence:** the current video's brief and the owner's notes win over the notebook.
- **Compatibility:**
  - Do not widen `.claude/settings.json`: the agents use only `python -m tools.lessons …`.
  - No network.
  - Windows-safe: UTF-8, CRLF tolerated, atomic replace via `tools.pipeline.fsutil.replace_retry`.
  - Existing gates, approvals and §8 resume keep working.

## Review Focus

1. **`lessons.md` missing** on the first run. `list` prints nothing and exits 0. `add` creates the file with all 6 headings. Test in Task 1.
2. **The owner has hand-edited the file:** blank lines, a lesson without a suffix, CRLF endings, or an extra heading or text the tool doesn't know. `load` keeps it all, and `add` changes only the target section and leaves every other byte intact. Test in Task 1.
3. **Duplicates:** a duplicate lesson, ignoring case and spacing, is skipped with "already there" and exit 0. Test in Task 1.
4. **A bad `--replace` number** (`sage#9` when Sage has 2) is an error naming the section and its count, and the file is unchanged. Test in Task 1.
5. **A resumed run** whose lessons card was already answered is not asked again. Test in Task 2.

---

### Task 1: The lessons tool, the notebook template and the board checkpoint

**Files:**
- Create: `tools/lessons/__init__.py`, `tools/lessons/__main__.py`, `tools/lessons/notebook.py`, `lessons.md`, `tests/lessons/test_notebook.py`
- Modify: `tools/dashboard/answers.py` (add `"lessons"` to `CHECKPOINTS`), `tools/dashboard/state.py` (`_owner_text` maps a detail containing `lessons` to `Waiting for you: lessons from this video`)
- Test: also `tests/dashboard/` (the existing test files for answers and state)

**Interfaces — Produces:**
- `SECTIONS: dict[str, str]`: key to heading, in order (Global Constraints).
- `@dataclass Lesson(text: str, source: str | None, date: str | None)`.
- `load(path: Path) -> dict[str, list[Lesson]]`: every key is present; a missing file gives empty lists.
- `add(path, key, text, run_dir: Path | None, today: str, replace: str | None = None) -> str`:
  - returns `"added"`, `"already there"` or `"replaced"`;
  - `replace` has the form `"<key>#<n>"` (1-based, within that key's section);
  - raises `LessonError` for an unknown key, bad text, or a bad replace number.
- `check(path) -> list[str]`: problems, such as a missing heading, plus a warning above 40 lessons. An empty list means fine.
- CLI:
  - `python -m tools.lessons list [--section KEY] [--file PATH]` prints `KEY#N <text>` per lesson;
  - `add --section KEY --text TEXT [--run RUN_DIR] [--replace KEY#N] [--file PATH]`;
  - `check [--file PATH]`;
  - `--file` defaults to `<repo root>/lessons.md`;
  - exit 0 on success, 1 on `LessonError` or check problems, printing `error: …`.
- The committed `lessons.md`:
  - a two-line header: "Lessons the team follows. Edit freely; the current video's own instructions always win.";
  - all 6 headings, with empty sections.

- [ ] **Step 1: Failing tests** in `tests/lessons/test_notebook.py`:
  - Review Focus 1–4 as stated above;
  - `add` writes the exact line format, with the source being the run folder's name and today's date;
  - text over 160 characters, or containing `@x.com` / `http://`, raises;
  - `list --section sage` numbers only Sage's lessons;
  - `check` warns at 41 lessons;
  - a CLI round trip through `python -m tools.lessons` (subprocess with list args).

  In the dashboard tests: `write_request(run, "lessons", …)` is accepted, and the state shows `Waiting for you: lessons from this video`.
- [ ] **Step 2: Run** `.venv/bin/python -m pytest tests/lessons tests/dashboard -q`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Parse the file line by line, keeping a list of raw lines plus a section index, so writes splice into the original text.
  - Write through a temp file + `replace_retry`.
- [ ] **Step 4: Run** the same command, then the full fast suite with `.venv/bin/python -m pytest -m "not slow" -q`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: lessons notebook tool and board checkpoint`

---

### Task 2: Agents read the notebook; Sage proposes; the owner confirms

**Files:**
- Modify: `.claude/agents/{story,voice,design,animator,reviewer}.md`, `.claude/commands/make-video.md`
- Test: `tests/agents/test_agent_files.py`, `tests/agents/test_orchestrator_file.py`

**Interfaces — Consumes:** the Task 1 CLI and the `lessons` checkpoint.

**Produces (rules, from the spec):**
- **Every agent file:** "Before you start, run `python -m tools.lessons list --section everyone` and `--section <your key>` and follow them, unless this video's brief, the owner's notes or `feedback_file` say otherwise." The reviewer's key is `sage`; the story agent's is `quill`, and so on.
- **reviewer.md:**
  - Each gate checklist adds "the work follows `lessons.md` (Everyone plus the step's agent section)".
  - A new **"Lessons proposal (after the owner's final approval)"** section, `gate: lessons`. Sage:
    - reads every `review/owner-gate-*.md` file and the final-video comments;
    - writes `review/lessons-proposed.md`: at most 5 numbered lessons, each as `N. [key] <rule>`;
    - phrases them as general rules and leaves out one-off fixes;
    - notes any lesson that contradicts an existing one (`replaces sage#2`);
    - above 40 lessons, adds merge/removal suggestions;
    - writes `none` when there is nothing lasting.
- **make-video.md, a new §6.2 after the §6.1 props/places step and before "owner approved final video" / done:**
  1. If the run has no `review/owner-gate-*` files and no final-video comments, skip.
  2. Otherwise start the reviewer with `gate: lessons` (event `lessons proposed`).
  3. If the proposal is `none`, skip.
  4. Otherwise open the board request: `--checkpoint lessons --title "Lessons from this video" --options keep-all,choose,skip --link "Proposed lessons=review/lessons-proposed.md"`. Ask the same in chat when the board is closed.
  5. On the answer:
     - `keep-all` → run `python -m tools.lessons add --section <key> --text "<rule>" --run "<run_dir>" [--replace <key#n>]` for each lesson;
     - `choose` → the same for the numbers in the answer text (for example `1,3`);
     - `skip` → nothing.
  6. Record the event `lessons saved` with detail `<k> kept`.
- **§8 resume:** an existing answer for the lessons request, or the `lessons saved` event, means the step is done and is not asked again (Review Focus 5). `lessons proposed` without an answer means re-open the same request.
- All status commands use real `tools.pipeline.status` arguments.

- [ ] **Step 1: Failing tests:**
  - each agent file contains `python -m tools.lessons list --section everyone` and its own key, plus the precedence sentence;
  - reviewer.md has `gate: lessons`, `review/lessons-proposed.md`, `at most 5` and `none`;
  - make-video.md §6.2 has its order (props step, then lessons proposed, then the lessons request, then lessons saved, then owner approved final video, then done), the skip rules and the resume rules;
  - every status command passes the real-parser test;
  - existing tests are unchanged and not weakened.
- [ ] **Step 2: Run** `.venv/bin/python -m pytest tests/agents -q`. Expected: FAIL.
- [ ] **Step 3: Edit the files.**
- [ ] **Step 4: Run** the agent tests and the full fast suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat: agents read the lessons notebook; Sage proposes lessons after final approval`
