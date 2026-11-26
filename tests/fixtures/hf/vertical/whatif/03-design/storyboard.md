# Storyboard: What If the Moon Disappeared?

Type: what-if · Audience: all-ages · Format: vertical · Host outfit: explorer
Music mood: inspiring
Total: 45.5 s, 7 scenes, host step-ins: scene 4; new place: none; custom moves: scene 1 moon-vanish, scene 2 tide-gauge, scene 3 tide-gauge, scene 5 coral-spawn, scene 6 axis-wobble, scene 6 moon-vanish; 0 sound effects

## Scene 1: The question
- **Place:** `space`, variant `earth-orbit` (library)
- **Duration:** 6.475 s (195 frames)
- **Framing:** vertical — the Moon at zoom 1.0, `pan_down` by 460 as the scene opens so the Moon settles in the middle band with Earth's limb below, behind the host; the labels left and right of the Moon
- **Idea:** We are imagining a world with no Moon.
- **Host:** talks from the bottom-right slot
- **Cast:** none
- **Beats:**
  1. "What" (0) — the Moon hangs above Earth's bright limb; the host wonders from the bottom-right corner as the view settles on the Moon. Moves: cut target `moon` ×1.0 on 0 s; pan_down by 460 on 0 s; gesture who `host` name `think`; react who `host` expression `curious`; label target `moon` "not to scale" (left) on "disappeared" (4) until "vanished" (8)
  2. "Imagine" (5) — imagined: the Moon flashes and vanishes, leaving empty space; the host is amazed. Moves: label target `moon` "Imagine…" (right) on "Imagine" (5); point who `host` target `moon` on "Imagine" (5); custom name `moon-vanish` on "vanished" (8); sparkle target `moon` on "vanished" (8); react who `host` expression `surprised` on "vanished" (8); gesture who `host` name `shrug` on "What" (13)
- **Text on screen:** "not to scale", "Imagine…" (4 words in 6.475 s)
- **Scale:** not to scale — label "not to scale" on the Moon
- **Facts:** imagined: the Moon vanishes (a thought experiment, labelled Imagine…); not to scale: the Moon is drawn near Earth for the picture
- **Kit warnings:** none
- **Custom:** `moon-vanish` (scene-1.js, from the world fixture) — at its word the Moon flashes softly, a ring of light spreads and empty space fades over it in about 0.9 s: the imagined moment, signposted by the label "Imagine…".
- **Transition:** fade
- **SFX:** none

## Scene 2: The Moon's pull
- **Place:** `ocean`, variant `surface` (library)
- **Duration:** 7.1 s (213 frames)
- **Framing:** vertical — opens on the open sky above the sea and `pan_down` by 820 (a tall reveal) to the tide pole, which lands in the middle band; the label above the water
- **Idea:** The Moon raises most of our tides.
- **Host:** talks from the bottom-left slot
- **Cast:** none
- **Beats:**
  1. "First" (0) — the view drops from the open sky to a tide pole in the sea, where the water and its float rise and fall over today's full range. Moves: cut target `sky` ×1.0 on 0 s; pan_down by 820 on "First" (0); custom name `tide-gauge` params {"period": 2.0, "range": 150, "ratio": 1, "bands": false} on 0 s; gesture who `host` name `think` on "tides" (2)
  2. "Today" (5) — the host points at the pole: the Moon's pull, about twice the Sun's, lifts most of today's tide. Moves: point who `host` target `surface` on "Moon" (7); label target `surface` "Moon: 2× Sun's pull" (above) on "about" (12); react who `host` expression `happy` on "twice" (13)
- **Text on screen:** "Moon: 2× Sun's pull" (4 words in 7.1 s)
- **Scale:** true to scale (no sizes, speeds or ratios shown)
- **Facts:** the Moon's tide-raising pull is about twice the Sun's; time is sped up: each rise and fall of the float stands for a tide of about 12 hours
- **Kit warnings:** none
- **Custom:** `tide-gauge` (scene-2.js, from the world fixture, plus a `bands` switch) — a striped tide pole at `surface` with a red float on the water line; time runs fast (one tide every 2 s); here the float rides today's full range between the white marks (ratio 1, no orange bands).
- **Transition:** fade
- **SFX:** none

## Scene 3: Smaller tides
- **Place:** `ocean`, variant `surface` (library)
- **Duration:** 6.075 s (183 frames)
- **Framing:** vertical — closer on the tide pole (zoom 1.25), `pan_down` by 300 at the start so the water line sits above the caption band; the label right of the pole
- **Idea:** Without the Moon, only the Sun's much smaller tides remain.
- **Host:** talks from the bottom-left slot
- **Cast:** none
- **Beats:**
  1. "Only" (0) — close on the tide pole: still the full range of today's tides. Moves: cut target `surface` ×1.25 on 0 s; pan_down by 300 on 0 s; custom name `tide-gauge` params {"period": 2.0, "range": 150, "ratio": 0.42, "band": [0.333, 0.5]} on "tides" (5); say who `host` until "remain" (7)
  2. "a" (8) — the rise and fall shrinks to a smaller bob inside the new orange bands, a third to a half of the old range; the host points at it. Moves: point who `host` target `surface` on "a" (8); label target `surface` "Tides: 1/3 to 1/2" (right) on "third" (9); gesture who `host` name `think` on "big" (14)
- **Text on screen:** "Tides: 1/3 to 1/2" (4 words in 6.075 s)
- **Scale:** true to scale (no sizes, speeds or ratios shown)
- **Facts:** with no Moon, only the Sun's tides remain: a third to a half of today's (the Sun's tide is about 0.46 of the Moon's); time is sped up: each rise and fall stands for a tide of about 12 hours
- **Kit warnings:** none
- **Custom:** `tide-gauge` (registered in scene-2.js) — from "a" (third) the range shrinks over 1.2 s to 0.42 of today's and two orange bands mark the new range: a third to a half of today's (params ratio 0.42, band [0.333, 0.5]).
- **Transition:** cut
- **SFX:** none

## Scene 4: Darker nights
- **Place:** `forest`, variant `moonless` (library)
- **Duration:** 6.125 s (184 frames)
- **Framing:** vertical — the host by the log at zoom 1.1 (captions in the top band while he is in the world), the starry sky above the trees; then `pan_up` by 700 as he points, a tall reveal up to the stars; the label beside the log, below the top band
- **Idea:** No Moon means no moonlight, so nights are darker.
- **Host:** step-in — stands at `log` in the world
- **Cast:** none
- **Beats:**
  1. "Nights" (0) — the host stands by a mossy log in the dark forest on a moonless night: no Moon in the sky, only the stars. Moves: cut target `log` ×1.1 on 0 s; gesture who `host` name `think` on "Nights" (0); label target `log` "No moonlight" (right) on "With" (6) until "only" (11)
  2. "only" (11) — the host stops and points up at the stars, the only light on the trail; the view rises from him up to the starry sky. Moves: point who `host` target `canopy` on "only" (11); react who `host` expression `curious` on "only" (11); pan_up by 700 on "stars" (13); react who `host` expression `happy` on "light" (15)
- **Text on screen:** "No moonlight" (2 words in 6.125 s)
- **Scale:** true to scale (no sizes, speeds or ratios shown)
- **Facts:** without the Moon there is no moonlight; nights are lit only by the stars (and are darker): a moonless night with the stars and the Milky Way
- **Kit warnings:** none
- **Transition:** fade
- **SFX:** none

## Scene 5: Lost clocks
- **Place:** `ocean`, variant `underwater` (library)
- **Duration:** 5.475 s (165 frames)
- **Framing:** vertical — the reef at zoom 1.0, `pan_down` by 330 at the start so the corals sit in the middle band and the rising bundles fill the water above; the label above the reef
- **Idea:** Some living things time their lives by the Moon.
- **Host:** talks from the bottom-left slot
- **Cast:** none
- **Beats:**
  1. "On" (0) — down on the reef at night-blue depth; the host points at the corals from the bottom-left corner. Moves: cut target `reef` ×1.0 on 0 s; pan_down by 330 on 0 s; point who `host` target `reef` on "reef" (2)
  2. "corals" (3) — the corals release clouds of tiny pink bundles that drift up toward the moonlit surface. Moves: custom name `coral-spawn` on "spawn" (5); label target `reef` "Moon-timed spawning" (above) on "light" (8); gesture who `host` name `surprised` on "by" (6); gesture who `host` name `shrug` on "lose" (14)
- **Text on screen:** "Moon-timed spawning" (2 words in 5.475 s)
- **Scale:** not to scale — the bundles are drawn larger than life (stated in the facts; the reef itself is true to its look)
- **Facts:** many corals time their mass spawning by the Moon (after a full moon); moonlight is one of their cues; the bundles are drawn larger than life
- **Kit warnings:** none
- **Custom:** `coral-spawn` (scene-5.js, new) — from "spawn" the corals around `reef` release about 70 tiny pink and peach egg bundles over 1.6 s; each rises slowly toward the bright surface, swaying, and fades after about 900 world px; a soft pink haze glows over the reef.
- **Transition:** slide
- **SFX:** none

## Scene 6: A wobblier Earth
- **Place:** `space`, variant `earth-orbit` (library)
- **Duration:** 6.725 s (202 frames)
- **Framing:** vertical — the empty patch of sky where the Moon was (zoom 0.8), `pan_down` by 820 at the start so Earth's limb sits low and the axis stands in the middle band, the space station out of frame; labels above and left of the Moon's (empty) place
- **Idea:** The Moon helps keep Earth's tilt steady over very long times.
- **Host:** talks from the bottom-right slot
- **Cast:** none
- **Beats:**
  1. "And" (0) — Earth's spin axis sticks out of the planet, swaying only slightly; still the imagined world, so the Moon stays gone. Moves: cut target `moon` ×0.8 on 0 s; pan_down by 820 on 0 s; custom name `moon-vanish` params {"gone": true} on 0 s; gesture who `host` name `think`; label target `moon` "not to scale" (above) on "of" (3); point who `host` target `moon` on "Earth's" (5)
  2. "Earth's" (5) — the axis starts to swing wider and wider; the host is surprised. Moves: custom name `axis-wobble` params {"swing": 5, "base": -15} on "tilt" (6); label target `moon` "Tilt: less steady" (left) on "far" (10); react who `host` expression `surprised` on "far" (10); gesture who `host` name `surprised` on "and" (13)
- **Text on screen:** "not to scale", "Tilt: less steady" (6 words in 6.725 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** the Moon helps keep Earth's axial tilt steady; without it the tilt could vary much more over millions of years, and the seasons with it (the swing drawn is illustrative); not to scale
- **Kit warnings:** none
- **Custom:** `axis-wobble` (scene-6.js, from the world fixture, now placed from the `planet` anchor so it fits the extended world) — Earth's spin axis as a dashed line and arrow out of the limb, leaning left (−15°); it sways a little, then from "tilt" the sway grows to 5° each way over 2 s (illustrative). `moon-vanish` with `gone: true` covers the place's Moon from the start (still the Moon-free world).
- **Transition:** fade
- **SFX:** none

## Scene 7: Back to the real world
- **Place:** `space`, variant `earth-orbit` (library)
- **Duration:** 7.525 s (226 frames)
- **Framing:** vertical — the same framing as scene 1 (a bookend): the real Moon in the middle band above Earth's limb; the label right of the Moon
- **Idea:** The real Moon steadies our tides and seasons.
- **Host:** talks from the bottom-left slot
- **Cast:** none
- **Beats:**
  1. "But" (0) — back in the real world: the Moon is there again above Earth, glowing softly; the host points at it, happy. Moves: cut target `moon` ×1.0 on 0 s; pan_down by 460 on 0 s; glow target `moon` on "Moon" (3); point who `host` target `moon` on "the" (1); react who `host` expression `happy` on "Moon" (3); label target `moon` "not to scale" (right) on "still" (5)
  2. "Which" (13) — the host turns to the viewer and asks which change they would miss most. Moves: gesture who `host` name `think` on "Which" (13); gesture who `host` name `wave` on "Tell" (19)
- **Text on screen:** "not to scale" (3 words in 7.525 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** the real Moon drives most of Earth's tides and helps keep the tilt, and so the seasons, steady; not to scale: the Moon is drawn near Earth for the picture
- **Kit warnings:** none
- **Transition:** fade
- **SFX:** none
