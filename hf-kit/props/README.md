# Prop library

Reusable illustrations for hero scenes. Check this list before asking for a new drawing; reuse
or adapt a prop when it fits. One line per prop:

- `volcano` — cut-away stratovolcano: magma chamber, vent, eruption (lava fountain, ash plume), lava flows, cone growth. Anchors `chamber`, `vent`, `crater`, `magma-tip` (moves), `lava`. Phases `pressure`, `rise`, `burst`, `flow`, `grow`. Params `sky` (dusk|day), `intensity`, `seed`.

## Using a prop (shots.json)

```json
{"id": 1, "kind": "hero", "prop": "volcano", "new_prop": false,
 "camera": [{"at": {"word": 0}, "frame": "wide"}, {"at": {"word": 5}, "frame": {"focus": "chamber", "zoom": 1.6}},
            {"at": {"word": 14}, "frame": {"follow": "magma-tip", "zoom": 1.3}}],
 "cues": [{"at": {"word": 5}, "show": "label", "target": "chamber", "text": "Magma chamber"},
          {"at": {"word": 12}, "show": "phase", "target": "rise"},
          {"at": {"word": 20}, "show": "phase", "target": "burst"},
          {"at": {"word": 24}, "show": "highlight", "target": "crater"}]}
```

- `phase` cues time the prop's own story (the word where it should happen); a prop never uses
  fixed seconds. Missing phases are derived (see the prop's header comment).
- `label` cues pin a pill label with a leader line to an anchor (`text` <= 28 characters; optional
  `side`: above-left, above-right, left, right, below-left, below-right, above, below).
- `highlight` cues pulse a ring on an anchor. `until: {word}` hides a label or highlight again.
- Camera `focus` / `follow` name the prop's anchors; zoom <= 2.5 (calm limits from the kit).
- The host is `HFKit.mountHero(el, {prop, params, words, cues, camera, duration, presenter})`
  (hf-kit/src/stage.js): it fits the prop's `meta.frame` into the content box beside the
  presenter, moves the camera, draws labels and calls the prop every frame.

## Prop contract (for new props: `hf-kit/props/<name>/`)

- `prop.js` — classic script (no imports, no network, no `Math.random`/`Date.now`/timers):
  `HFKit.props["<name>"] = {meta, mount}`, using `HFKit.draw` helpers (gradients, glows,
  particles, eases, seeded random) so props look consistent.
  - `meta = {name, description, world: {width, height}, frame: {x, y, width, height}, anchors: [...],
    params: {...}, phases?: {...}}` — `frame` is the part of the world that "wide" shows.
  - `mount(root, {params, style})` draws into `root` (a world-sized layer) and returns
    `{update(t, cueState), anchors}`. `update` must be a pure function of `t` (seconds in the
    scene) so any frame can be rendered in any order. `cueState` is `HFKit.cueState(...)` for the
    scene's cues. `anchors[name]` is `{x, y}` in world px, or a function `t -> {x, y}` for a
    moving part. `params.phases` holds the phase times in seconds.
- `preview.png` — a snapshot of the prop mid-story (from `python -m tools.hf.snapshot`).
- `README.md` — one line describing it (and add the line above).
