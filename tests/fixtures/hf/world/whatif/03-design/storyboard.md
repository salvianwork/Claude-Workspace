# Storyboard: What If the Moon Disappeared?

Type: what-if · Audience: all-ages · Host outfit: explorer
Music mood: inspiring
Total: 26.4 s, 5 scenes, host step-ins: scene 3; new place: none; custom moves: scene 1 moon-vanish (and again in scene 4, gone), scene 2 tide-gauge, scene 4 axis-wobble; 0 sound effects

## Scene 1: The question
- **Place:** `space`, variant `earth-orbit` (library)
- **Duration:** 4.75 s (143 frames)
- **Idea:** We are imagining a world with no Moon.
- **Host:** talks from the right slot
- **Cast:** none
- **Beats:**
  1. "What…" (0) — Earth and the Moon from orbit; the host wonders as the camera pushes in on the Moon. Moves: camera cut `open` ×0.8 at the start; gesture host; label "not to scale" on `moon` (above) on "What" (0) until "vanished" (8); camera push_in `moon` ×1.4 on "disappeared" (4)
  2. "Imagine…" (5) — imagined: the Moon flashes and vanishes, leaving empty space; the host is amazed. Moves: label "Imagine…" on `moon` on "Imagine" (5); point host on "Imagine" (5); custom `moon-vanish` on "vanished" (8); sparkle moon on "vanished" (8); react host on "vanished" (8); gesture surprised host on "tonight" (9)
- **Text on screen:** "not to scale", "Imagine…" (4 words in 4.75 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** imagined: the Moon vanishes (a thought experiment, labelled Imagine…); not to scale: the Moon is shown near Earth for the picture
- **Kit warnings:** none
- **Custom:** `moon-vanish` (scene-1.js) — at its word the Moon flashes softly, a ring of light spreads and empty space fades over it in about 0.9 s: the imagined moment, signposted by the label "Imagine…".
- **Transition:** fade
- **SFX:** none

## Scene 2: Smaller tides
- **Place:** `ocean`, variant `surface` (library)
- **Duration:** 6.625 s (199 frames)
- **Idea:** Without the Moon, only the Sun's much smaller tides remain.
- **Host:** talks from the right slot
- **Cast:** none
- **Beats:**
  1. "The…" (0) — a tide pole in the sea: the water and its float rise and fall over today's full range. Moves: camera cut `surface` ×1.15 at the start; say host; custom `tide-gauge` on "shrink" (3); label "Without the Moon" on `boat` on "tides" (1)
  2. "Only…" (4) — the rise and fall shrinks to a smaller bob inside the new orange bands, a third to a half of the old range; the host points at it. Moves: point host on "the" (5); label "Tides: 1/3 to 1/2" on `surface` on "a" (10); gesture think host on "as" (15)
- **Text on screen:** "Without the Moon", "Tides: 1/3 to 1/2" (7 words in 6.625 s)
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** the Sun also raises tides; with no Moon, tides would be a third to a half of today's size (the Sun's tide is about 0.46 of the Moon's: a third of today's spring tides, about half of an average tide); time is sped up: each rise and fall of the float stands for a tide of about 12 hours
- **Kit warnings:** none
- **Custom:** `tide-gauge` (scene-2.js) — a striped tide pole at `surface` with a red float on the water line; time runs fast (one tide every 2 s); before its word the float rides today's full range between white marks; from its word the range shrinks over 1.2 s to 0.42 of it, and two orange bands mark where the new range lies: a third to a half of today's (params ratio 0.42, band [0.333, 0.5]).
- **Transition:** slide
- **SFX:** none

## Scene 3: Darker nights
- **Place:** `forest`, variant `moonless` (library: a night with no Moon, a starry sky and the Milky Way)
- **Duration:** 5.575 s (168 frames)
- **Idea:** No Moon means no moonlight, so nights are darker.
- **Host:** step-in — stands at `trail` in the world, walks to `log`
- **Cast:** none
- **Beats:**
  1. "Nights…" (0) — the host walks the dark forest trail on a moonless night: no Moon in the sky, only the stars and the faint Milky Way. Moves: camera cut `log` ×0.75 at the start; walk_to host to `log` on "Nights" (0); label "No moonlight" on `host` (above) on "With" (5) until "would" (11)
  2. "only…" (8) — the host stops and points up at the stars, the only light on the trail; the camera eases back to show the starry sky. Moves: camera pull_out `log` ×0.62 on "stars" (10); point host at `canopy` on "the" (9); react curious host on "the" (9); react happy host on "light" (12)
- **Text on screen:** "No moonlight" (2 words in 5.575 s)
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** without the Moon there is no moonlight; nights are lit only by the stars (and are darker): a moonless night with the stars and the Milky Way
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
  1. "And…" (0) — Earth's spin axis sticks out of the planet, swaying only slightly; still the imagined world, so the Moon stays gone. Moves: camera pull_out `planet` ×0.6 (from 0.72) on "far" (9); gesture think host; label "not to scale" on `open` on "And" (0); point host at `planet` on "Earth's" (5); custom `moon-vanish` (gone) at the start
  2. "Earth's…" (5) — the axis starts to swing wider and wider as the camera eases back; the host is surprised. Moves: custom `axis-wobble` (base −9°, swing 6°) on "tilt" (6); label "Tilt: less steady" on `planet` on "far" (9); react host on "far" (9); gesture surprised host on "less" (10)
- **Text on screen:** "not to scale", "Tilt: less steady" (6 words in 4.725 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** the Moon helps keep Earth's axial tilt (about 23.4 degrees) steady; without it the tilt could vary much more over millions of years (the size of the swing drawn is illustrative); not to scale
- **Kit warnings:** none
- **Custom:** `axis-wobble` (scene-4.js) — Earth's spin axis as a dashed line and arrow out of the planet's limb, leaning left (−9°) so it stays clear of the space station on the right; it sways a little, then from its word the sway grows to 6° each way over 2 s (−15° to −3°: illustrative, not a predicted angle; the drawn tilt is compressed to fit the limb view). `moon-vanish` with `gone: true` (scene-1.js) covers the place's Moon from the start, with no flash, because this scene is still the Moon-free world.
- **Transition:** fade
- **SFX:** none

## Scene 5: Back to the real world
- **Place:** `rooftop-night`, variant `clear` (library)
- **Duration:** 4.75 s (143 frames)
- **Idea:** The real Moon steadies our tides and seasons.
- **Host:** talks from the left slot
- **Cast:** none
- **Beats:**
  1. "But…" (0) — back in the real world: over a city rooftop at night the bright full Moon shines; the host points up at it. Moves: camera cut `sky` ×0.75 at the start; point host on "the" (1); react happy host on "the" (1)
  2. "keeping…" (6) — the camera pulls back over the moonlit rooftop and the host celebrates. Moves: camera pull_out `sky` ×0.62 on "steady" (12); gesture host on "tides" (8)
- **Text on screen:** none
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** back in the real world: the Moon is still here; the Moon drives most of the tides and steadies Earth's tilt, and so the seasons
- **Kit warnings:** none
- **Transition:** fade
- **SFX:** none
