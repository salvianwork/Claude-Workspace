---
description: Show the status of a video run (step, state, round, last events), or list all runs when no run folder is given.
argument-hint: [run_dir]
---

# /video-status

Run folder: `$ARGUMENTS`

Run from the workspace root and quote the path (it may contain spaces). This command only
reads; it never changes `status.json`.

- **A run folder was given** (`$ARGUMENTS` is not empty):
  ```bash
  python -m tools.pipeline.status show "$ARGUMENTS"
  ```
- **No argument**: list every run in `videos/`:
  ```bash
  python -m tools.pipeline.status list
  ```

Print the command's output exactly as it is, in a code block. If it prints an `Error: …`
line, show it and suggest `/video-status` with no argument to see the run folders.
