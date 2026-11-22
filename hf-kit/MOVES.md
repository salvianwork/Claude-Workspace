# World scene moves

<!-- Generated from HFKit.MOVES (hf-kit/src/world/moves.js) by `npm run moves-doc` in hf-kit/. Do not edit by hand. -->

Every beat of a `kind: "world"` scene lists its `moves`: `{"do": <move>, ...parameters}`. A beat
with no moves fails validation (show, don't tell). `HFKit.validateWorld` (via `shots validate`)
names any problem as `scene <id> beat <b> move <m> (<do>): <what>`, counting from 0.

- `at`: `{"word": i}` (that word's start in the scene's words.json) or `{"t": seconds}`; a move's
  `at` defaults to its beat's. `until` takes the same form.
- `who`: an id from the scene's `actors`. `to`, `from`: a place anchor (hf-kit/places/README.md).
- `target`: a place anchor, an actor id, or `pulse` (the scene's pulse_along). `path`: a place path.
- Actor moves of one actor never overlap: a move waits for the one before it. Walking is 420 world px/s,
  running 640 (times the actor's scale), with 0.3 s ease in and out; feet never slide.
- Camera: zoom 0.6 to 5, at most 2.5x zoom per second (a dive up to 4x), no whip pans.
  Moves ease smoothly (sine). push_in and pull_out LAND on their `at` word, starting as late as the
  limits allow but never before their beat. Without `at`, a push_in starts on its beat's strike
  (`use`), else with the beat, alongside the action; a pull_out lands on the next beat's word. follow,
  cut and dive start at `at` (default: the beat). While an actor walks or runs and no camera move
  runs, the camera follows him; stepping out of the side slot he is framed at least 45 % of the
  frame tall. A camera that finishes more than 0.25 s after the scene ends fails validation.
- Warnings (allowed, worth a look): the frame edge cuts an actor's head where the camera lands;
  a `use` strike slips more than 0.5 s past its word because its actor is still on the way.
- Text: tags and labels at most 4 words (a number and its unit count as one: `343 m/s`), the title at most 6.

## Actor moves

| Move | Required | Optional | What it does |
|---|---|---|---|
| `enter` | `who` | `side`, `at` | walk in from the frame edge (`side` left \| right) to the actor's start; the actor is off stage until then |
| `exit` | `who` | `side`, `at` | walk out to the frame edge (`side` left \| right) and leave |
| `walk_to` | `who`, `to` | `at` | walk to a place anchor (420 world px/s; feet never slide); from the side slot he steps into the world |
| `run_to` | `who`, `to` | `at` | run to a place anchor (640 world px/s) |
| `jump` | `who` | `at` | jump in place (1 s) |
| `point` | `who`, `target` | `at`, `until` | point at an anchor, actor or `pulse` (2.2 s) |
| `gesture` | `who`, `name` | `at`, `until` | a pose for 2 s: `talk`, `point-left`, `point-right`, `think`, `surprised`, `celebrate`, `wave`, `raise`, `strike`, `carry`, `shrug`, `point-across` |
| `react` | `who`, `expression` | `at` | change expression: `neutral`, `happy`, `curious`, `surprised`, `thinking` |
| `hold` | `who`, `prop` | `at` | hold a prop from now on: `hammer`, `book`, `phone`, `pointer` |
| `use` | `who`, `prop` | `at` | use a prop ON the word (hammer: raise, then strike on `at`). It waits until the actor has arrived; the beat's moves on the same word wait with it |
| `say` | `who` | `at`, `until` | talk (gestures follow the voice) until `until` or the beat's end |

## Effects

| Move | Required | Optional | What it does |
|---|---|---|---|
| `burst` | — | `target`, `path`, `from`, `at`, `color`, `size`, `duration`, `seed`, `radius` | impact burst: flash, shock ring, spikes, debris (at `target`, or the start of `path`) |
| `rings` | — | `target`, `path`, `from`, `at`, `color`, `size`, `duration`, `seed`, `count`, `interval`, `speed`, `radius`, `width`, `squash`, `arc` | sound or energy waves spreading from the target (at `target`, or the start of `path`) |
| `pulse_along` | `path` | `from`, `to`, `speed`, `at`, `color`, `size`, `duration`, `seed`, `trail`, `ease` | a glowing pulse racing along a place path, `from` one anchor `to` another; `speed` slow \| medium \| fast \| px/s. Tag it with target `pulse` |
| `speed_lines` | — | `target`, `path`, `from`, `at`, `color`, `size`, `duration`, `seed`, `angle`, `edge`, `length`, `spread`, `count` | streaks trailing a moving thing (at `target`, or the start of `path`) |
| `splash` | — | `target`, `path`, `from`, `at`, `color`, `size`, `duration`, `seed` | a splash at a water surface (at `target`, or the start of `path`) |
| `sparkle` | — | `target`, `path`, `from`, `at`, `color`, `size`, `duration`, `seed`, `radius`, `count` | twinkling stars (at `target`, or the start of `path`) |
| `smoke` | — | `target`, `path`, `from`, `at`, `color`, `size`, `duration`, `seed`, `life`, `wind`, `rise` | soft puffs rising (at `target`, or the start of `path`) |
| `glow` | — | `target`, `path`, `from`, `at`, `color`, `size`, `duration`, `seed`, `radius`, `rays` | a soft breathing light (at `target`, or the start of `path`) |

## Overlays (on-screen text)

| Move | Required | Optional | What it does |
|---|---|---|---|
| `tag_follow` | `target`, `text` | `at`, `until` | a data tag riding a point (an anchor, an actor, `pulse`): at most 4 words, a number and its unit count as one |
| `label` | `target`, `text` | `at`, `until`, `side` | a name label on a thing (at most 4 words; `side` center \| above \| below \| left \| right) |
| `title` | `text` | `at`, `until` | the video's one title (scene 1 only, at most 6 words) |

## Camera

| Move | Required | Optional | What it does |
|---|---|---|---|
| `push_in` | `target`, `zoom` | `at` | push in on a target; it LANDS on its `at` word; without `at` it starts on the beat's strike (`use`), else with the beat, alongside the action |
| `pull_out` | `zoom` | `target`, `from`, `at` | pull out to reveal; lands like push_in (as the scene's first move it opens tight, at `from` or 1.5x the zoom) |
| `follow` | `target` | `zoom`, `at` | follow a moving actor or `pulse` (slew-limited, never a whip pan). Walkers are followed by default while no camera move runs |
| `cut` | `target` | `zoom`, `at` | an instant cut to a target (after a dive: back out of the inside view) |
| `dive` | `target`, `into` | `params`, `zoom`, `at` | push in to zoom >= 3 (default 3.2, up to 3x/s) on the target, then cut to the inside view HFKit.insides[into]: `lattice` (params `state`: solid \| liquid \| gas), `cells` (params `type`: animal \| plant \| blood) |

## Custom

| Move | Required | Optional | What it does |
|---|---|---|---|
| `custom` | `name` | `params`, `at`, `until` | a scene-specific piece: needs 04-video/hf/scenes/scene-<id>.js registering HFKit.customs[name] |

## Example

The plan's pinned railway beat (beat 1 of its scene), as written:

```json
{"at": {"word": 9}, "action": "host walks in and strikes the rail; a pulse races along it",
 "moves": [{"do": "walk_to", "who": "host", "to": "rail-near"},
           {"do": "use", "who": "host", "prop": "hammer", "at": {"word": 12}},
           {"do": "pulse_along", "path": "rail", "from": "rail-near", "to": "rail-far", "speed": "fast", "at": {"word": 12}},
           {"do": "tag_follow", "target": "pulse", "text": "≈5,960 m/s"},
           {"do": "push_in", "target": "rail-far", "zoom": 2.2}]}
```
