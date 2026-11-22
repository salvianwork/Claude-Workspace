# Storyboard: What If the Moon Disappeared?

Type: what-if · Audience: all-ages · Host outfit: explorer
Music mood: inspiring
Total: 26.2 s, 5 scenes, host step-ins: scenes 3; new place: none; custom moves: scene 1 moon-vanish, scene 2 tide-gauge, scene 4 axis-wobble; 0 sound effects

## Scene 1: The question
- **Place:** `space`, variant `earth-orbit` (library)
- **Duration:** 4.75 s (143 frames)
- **Idea:** We are imagining a world with no Moon.
- **Host:** talks from the right slot
- **Cast:** none
- **Beats:**
  1. "What…" (0) — Earth and the Moon from orbit; the host wonders as the camera pushes in on the Moon. Moves: camera cut `open` ×0.8 at the start; gesture host; label "not to scale" on `open` on "What" (0); camera push_in `moon` ×1.4 on "disappeared" (4)
  2. "Imagine…" (5) — imagined: the Moon flashes and vanishes, leaving empty space; the host is amazed. Moves: label "Imagine…" on `moon` on "Imagine" (5); point host on "Imagine" (5); custom `moon-vanish` on "vanished" (8); sparkle moon on "vanished" (8); react host on "vanished" (8)
- **Text on screen:** "not to scale", "Imagine…" (4 words in 4.75 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** imagined: the Moon vanishes (a thought experiment, labelled Imagine…); not to scale: the Moon is shown near Earth for the picture
- **Kit warnings:** none
- **Custom:** `moon-vanish` (scene-1.js) — at its word the Moon flashes softly, a ring of light spreads and empty space fades over it in about 0.9 s: the imagined moment, signposted by the label "Imagine…".
- **Transition:** fade
- **SFX:** none

## Scene 2: Smaller tides
- **Place:** `ocean`, variant `surface` (library)
- **Duration:** 6.425 s (193 frames)
- **Idea:** Without the Moon, only the Sun's much smaller tides remain.
- **Host:** talks from the right slot
- **Cast:** none
- **Beats:**
  1. "The…" (0) — a tide pole in the sea: the water and its float rise and fall over today's full range. Moves: camera cut `surface` ×1.15 at the start; say host; custom `tide-gauge` on "shrink" (3); label "Without the Moon" on `boat` on "tides" (1)
  2. "Only…" (4) — the rise and fall shrinks to a small bob between new orange marks, a third of the old range; the host points at it. Moves: point host on "the" (5); label "Tides: a third" on `surface` on "roughly" (10)
- **Text on screen:** "Without the Moon", "Tides: a third" (6 words in 6.425 s)
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** the Sun also raises tides; with no Moon, tides would be roughly a third of today's size; time is sped up: each rise and fall of the float stands for a tide of about 12 hours
- **Kit warnings:** none
- **Custom:** `tide-gauge` (scene-2.js) — a striped tide pole at `surface` with a red float on the water line; time runs fast (one tide every 2 s); before its word the float rides today's full range between white marks; from its word the range shrinks over 1.2 s to a third (orange marks).
- **Transition:** slide
- **SFX:** none

## Scene 3: Darker nights
- **Place:** `forest`, variant `night` (library)
- **Duration:** 5.575 s (168 frames)
- **Idea:** No Moon means no moonlight, so nights are darker.
- **Host:** step-in — stands at `trail` in the world, walks to `log`
- **Cast:** none
- **Beats:**
  1. "Nights…" (0) — the host walks the dark forest trail at night: no moon in the sky, only the dim blue starlight. Moves: camera cut `trail` ×1.25 at the start; walk_to host on "Nights" (0); label "No moonlight" on `host` on "With" (5)
  2. "only…" (8) — the host stops and peers up at the faint stars, the only light on the trail. Moves: point host on "the" (9); react host on "the" (9)
- **Text on screen:** "No moonlight" (2 words in 5.575 s)
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** without the Moon there is no moonlight; nights are lit only by the stars (and are darker)
- **Kit warnings:** none
- **Transition:** fade
- **SFX:** none

## Scene 4: A wobblier Earth
- **Place:** `space`, variant `earth-orbit` (library)
- **Duration:** 4.725 s (142 frames)
- **Idea:** The Moon helps keep Earth's tilt steady over very long times.
- **Host:** talks from the right slot
- **Cast:** none
- **Beats:**
  1. "And…" (0) — Earth's spin axis sticks out of the planet, swaying only slightly. Moves: camera pull_out `planet` ×0.72 on "far" (9); gesture host; label "not to scale" on `open` on "And" (0)
  2. "Earth's…" (5) — the axis starts to swing wider and wider as the camera eases back; the host is surprised. Moves: custom `axis-wobble` on "tilt" (6); label "Tilt: less steady" on `planet` on "far" (9); react host on "far" (9)
- **Text on screen:** "not to scale", "Tilt: less steady" (6 words in 4.725 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** the Moon helps keep Earth's axial tilt (about 23.4 degrees) steady; without it the tilt could vary much more over millions of years (the size of the swing drawn is illustrative); not to scale
- **Kit warnings:** none
- **Custom:** `axis-wobble` (scene-4.js) — Earth's spin axis as a dashed line and arrow out of the planet's limb; it sways a little, then from its word the sway grows to 12° each way over 2 s (illustrative, not a predicted angle; the drawn tilt is compressed to fit the limb view).
- **Transition:** fade
- **SFX:** none

## Scene 5: Back to the real world
- **Place:** `rooftop-night`, variant `clear` (library)
- **Duration:** 4.75 s (143 frames)
- **Idea:** The real Moon steadies our tides and seasons.
- **Host:** talks from the left slot
- **Cast:** none
- **Beats:**
  1. "But…" (0) — back in the real world: over a city rooftop at night the bright full Moon shines; the host points up at it. Moves: camera cut `sky` ×0.75 at the start; point host on "the" (1)
  2. "keeping…" (6) — the camera pulls back over the moonlit rooftop and the host celebrates. Moves: camera pull_out `sky` ×0.62 on "steady" (12); gesture host on "tides" (8)
- **Text on screen:** none
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** back in the real world: the Moon is still here; the Moon drives most of the tides and steadies Earth's tilt, and so the seasons
- **Kit warnings:** none
- **Transition:** fade
- **SFX:** none
