# Storyboard: Why Is the Sky Blue?

Type: explainer · Audience: all-ages · Format: vertical · Host outfit: explorer
Music mood: curious
Total: 46.525 s, 7 scenes, host step-ins: scene 5; new place: none; custom moves: scene 1 white-light, scene 2 white-light, scene 3 wave-hit, scene 4 wave-hit, scene 5 sky-rays, scene 6 sunset-beam, scene 7 wave-hit; 0 sound effects

## Scene 1: White sunlight
- **Place:** `countryside`, variant `day` (library)
- **Duration:** 5.875 s (177 frames)
- **Framing:** vertical — the open sky at zoom 0.85, `pan_down` by 450 as the scene opens so the prism hangs in the middle band; the rainbow fans out above the caption band; labels above the prism
- **Idea:** White sunlight is a mix of all the colours.
- **Host:** talks from the bottom-left slot
- **Cast:** none
- **Beats:**
  1. "Why" (0) — the clear blue sky over the farm; the host asks from the bottom-left corner, thinking. Moves: cut target `sky` ×0.85 on 0 s; pan_down by 450 on 0 s; gesture who `host` name `think`; react who `host` expression `curious`
  2. "Sunlight" (5) — a beam of white sunlight slants in and passes through a glass prism, which fans it out into all the colours of the rainbow. Moves: custom name `white-light` params {"from": {"x": 700, "y": -300}, "split": 1.68, "prismSize": 190} on "Sunlight" (5); point who `host` target `sky` on "looks" (6); label target `sky` "White light" (above) on "white" (7) until "every" (11); label target `sky` "Every colour" (above) on "colour" (12); react who `host` expression `surprised` on "colour" (12)
- **Text on screen:** "White light", "Every colour" (4 words in 5.875 s)
- **Scale:** the prism and beam are illustrative (a metaphor drawn in the sky)
- **Facts:** white sunlight is a mix of all the colours of the rainbow (a prism spreads them out: red bent least, violet most)
- **Kit warnings:** none
- **Custom:** `white-light` (scene-1.js, new) — a white sunbeam slants in from the right (from the Sun, off frame) into a glass prism (params prismSize 190) hanging in the sky; 1.68 s later (on "every") the light leaving the prism fans into the seven rainbow colours, red bent least and violet most.
- **Transition:** fade
- **SFX:** none

## Scene 2: Into the air
- **Place:** `countryside`, variant `day` (library)
- **Duration:** 6.25 s (188 frames)
- **Framing:** vertical — the same sky framing as scene 1 (the white beam crossing it), then `dive` into the air on "cross"
- **Idea:** Sunlight passes through air made of tiny molecules.
- **Host:** talks from the bottom-right slot
- **Cast:** none
- **Beats:**
  1. "To" (0) — the white sunbeam crosses the sky; the host points at it. Moves: cut target `sky` ×0.85 on 0 s; pan_down by 450 on 0 s; custom name `white-light` params {"from": {"x": 700, "y": -300}, "split": 99, "showPrism": false} on 0.1 s; point who `host` target `sky` on "that" (4)
  2. "cross" (8) — the camera dives into the air the light crosses: tiny gas molecules fly about, far apart. Moves: dive target `sky` into `lattice` params {"state": "gas"} on "cross" (8); gesture who `host` name `think` on "which" (11)
- **Text on screen:** none
- **Scale:** true to scale (no sizes, speeds or ratios shown)
- **Facts:** air is made of tiny gas molecules (mostly nitrogen and oxygen) that sunlight passes through
- **Kit warnings:** none
- **Custom:** `white-light` (registered in scene-1.js) with no split and no prism (showPrism false): the white sunbeam crossing the sky.
- **Transition:** cut
- **SFX:** none

## Scene 3: Blue bounces
- **Place:** `countryside`, variant `day` (library)
- **Duration:** 7.3 s (219 frames)
- **Framing:** vertical — the sky framing of scene 1: the molecules spread over the middle band, the wave travelling at the height of the middle molecule (above the caption band); labels above and left of it
- **Idea:** Air molecules scatter blue light in all directions.
- **Host:** talks from the bottom-right slot
- **Cast:** none
- **Beats:**
  1. "Blue" (0) — in the sky, drawn huge, a short choppy blue light wave travels in toward the air molecules. Moves: cut target `sky` ×0.85 on 0 s; pan_down by 450 on 0 s; custom name `wave-hit` params {"color": "#2F7BFF", "wavelength": 70, "hit": 4.5, "scatter": true, "scale": 2.0, "spread": 1.2, "packet": 700, "from": 900} on 0.2 s; label target `sky` "Blue: short waves" (above) on "short" (4); label target `sky` "not to scale" (below) on "short" (4); gesture who `host` name `talk` on "travels" (2)
  2. "When" (7) — the wave hits a molecule, which flashes and sends blue light off in every direction. Moves: point who `host` target `sky` on "hits" (9); react who `host` expression `surprised` on "bounces" (13); gesture who `host` name `surprised` on "off" (14)
- **Text on screen:** "Blue: short waves", "not to scale" (6 words in 7.3 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** blue light has a shorter wavelength than red; air molecules scatter blue light strongly, in all directions; not to scale: a molecule is far smaller than a light wave
- **Kit warnings:** none
- **Custom:** `wave-hit` (scene-3.js, new) — seven air molecules (pairs of balls, like nitrogen and oxygen) float in the sky; a short, choppy blue wave packet (wavelength 70) travels in from the left and reaches the middle molecule at 4.5 s (on "bounces"): the molecule flashes and eight small blue wavy arrows fly off in every direction, with two spreading rings. Drawn large for a phone: params scale 2.0 (molecules, waves, arrows), spread 1.2, the packet starting 900 world px left of the middle molecule.
- **Transition:** cut
- **SFX:** none

## Scene 4: Red passes
- **Place:** `countryside`, variant `day` (library)
- **Duration:** 5.55 s (167 frames)
- **Framing:** vertical — the same framing as scene 3
- **Idea:** Red light is scattered much less and goes straight on.
- **Host:** talks from the bottom-left slot
- **Cast:** none
- **Beats:**
  1. "Red" (0) — a long, lazy red light wave travels in toward the same molecules. Moves: cut target `sky` ×0.85 on 0 s; pan_down by 450 on 0 s; custom name `wave-hit` params {"color": "#E53935", "wavelength": 170, "hit": 3.4, "scatter": false, "scale": 2.0, "spread": 1.2, "packet": 800, "from": 900} on 0.2 s; label target `sky` "Red: long waves" (above) on "long" (4); label target `sky` "not to scale" (below) on "long" (4); gesture who `host` name `think` on "travels" (2)
  2. "so" (7) — the red wave passes straight through and carries on, the molecule barely stirring. Moves: point who `host` target `sky` on "most" (8); react who `host` expression `happy` on "straight" (12)
- **Text on screen:** "Red: long waves", "not to scale" (6 words in 5.55 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** red light has a longer wavelength and is scattered much less: most of it passes straight through; not to scale
- **Kit warnings:** none
- **Custom:** `wave-hit` (registered in scene-3.js) with a long, lazy red wave (wavelength 170) that reaches the middle molecule at 3.4 s (on "passes") and passes straight through, carrying on to the right; the molecule barely stirs and one faint wavelet leaves it. Drawn large for a phone: params scale 2.0 (molecules, waves, arrows), spread 1.2, the packet starting 900 world px left of the middle molecule.
- **Transition:** cut
- **SFX:** none

## Scene 5: Blue from everywhere
- **Place:** `countryside`, variant `day` (library)
- **Duration:** 6.2 s (186 frames)
- **Framing:** vertical — the host at `rail-near` at zoom 1.4, then `pan_up` by 250 at the start so he stands lower in the frame with the big sky above him (captions in the top band while he is out of his slot); the label beside his feet
- **Idea:** The scattered blue light comes from every part of the sky, so the sky looks blue.
- **Host:** step-in — stands at `rail-near` and looks up
- **Cast:** none
- **Beats:**
  1. "So" (0) — the host stands by the meadow rail and looks up; blue light streams down to him from every part of the sky. Moves: cut target `rail-near` ×1.4 on 0 s; pan_up by 250 on 0 s; react who `host` expression `curious`; custom name `sky-rays` params {"anchor": "rail-near", "eye": 380} on "wherever" (1); point who `host` target `sky` on "wherever" (1)
  2. "scattered" (8) — more blue rays arrive from left and right; the host turns and smiles. Moves: gesture who `host` name `point-left` on "scattered" (8); label target `rail-near` "Blue from everywhere" (right) on "blue" (9); react who `host` expression `happy` on "all" (14)
- **Text on screen:** "Blue from everywhere" (3 words in 6.2 s)
- **Scale:** true to scale (no sizes, speeds or ratios shown)
- **Facts:** scattered blue light reaches the eye from every part of the sky, so the sky looks blue
- **Kit warnings:** none
- **Custom:** `sky-rays` (scene-5.js, new) — 15 thin blue rays come in toward the host's eyes from points spread over the whole sky above, each carrying bright dashes of light; they appear one after another over 1.2 s and a soft blue glow gathers at his head.
- **Transition:** fade
- **SFX:** none

## Scene 6: Sunset
- **Place:** `countryside`, variant `sunset` (library)
- **Duration:** 8.3 s (249 frames)
- **Framing:** vertical — a tall reveal: opens high in the sunset sky at zoom 0.8 and `pan_down` by 850 to the horizon; the beam crosses just above the caption band, the labels below the sky anchor in the middle band
- **Idea:** At sunset the long path through the air scatters the blue out, so the sky looks red and orange.
- **Host:** talks from the bottom-left slot
- **Cast:** none
- **Beats:**
  1. "At" (0) — the view slides down the evening sky to the horizon, where the Sun is low. Moves: cut target `sky` ×0.8 on 0 s; pan_down by 850 on 0 s; gesture who `host` name `think`
  2. "the" (2) — a long, low beam of sunlight crosses the sky; blue sparks peel off it along the way and only orange and red reach the far end. Moves: custom name `sunset-beam` params {"sun": {"x": 480, "y": 520}, "to": {"x": -700, "y": 420}} on "light" (3); label target `sky` "Long path through air" (below) on "crosses" (4) until "Most" (8); point who `host` target `sky` on "crosses" (4); label target `sky` "Blue scattered away" (below) on "blue" (11); react who `host` expression `surprised` on "bounces" (12); gesture who `host` name `celebrate` on "leaving" (18)
- **Text on screen:** "Long path through air", "Blue scattered away" (7 words in 8.3 s)
- **Scale:** illustrative (the beam's length stands for the long path through the air)
- **Facts:** at sunset sunlight crosses much more of the atmosphere; most blue light is scattered out of the beam, leaving reds and oranges
- **Kit warnings:** none
- **Custom:** `sunset-beam` (scene-6.js, new) — a big low evening Sun near the horizon on the right sends a long, low beam left across the sky; it draws on over 1.2 s from "light"; along its length it turns from white-yellow to orange to red, and blue sparks peel off it and drift upward over its first two thirds (the blue scattered away).
- **Transition:** fade
- **SFX:** none

## Scene 7: The answer
- **Place:** `countryside`, variant `day` (library)
- **Duration:** 7.05 s (212 frames)
- **Framing:** vertical — the sky framing of scene 1 in daylight again
- **Idea:** A blue sky is sunlight scattered by the air.
- **Host:** talks from the bottom-right slot
- **Cast:** none
- **Beats:**
  1. "So" (0) — back in the blue sky: once more a blue wave hits a molecule and bounces off in every direction. Moves: cut target `sky` ×0.85 on 0 s; pan_down by 450 on 0 s; custom name `wave-hit` params {"color": "#2F7BFF", "wavelength": 70, "hit": 2.0, "scatter": true, "scale": 2.0, "spread": 1.2, "packet": 700, "from": 900} on 0.1 s; label target `sky` "not to scale" (below) on "sunlight" (5); gesture who `host` name `talk` on "a" (1)
  2. "Look" (9) — the host invites the viewer to look at the next sunset and tell him the colours. Moves: gesture who `host` name `wave` on "Look" (9); react who `host` expression `happy` on "Look" (9); gesture who `host` name `celebrate` on "tell" (16)
- **Text on screen:** "not to scale" (3 words in 7.05 s)
- **Scale:** not to scale (the molecule and wave are drawn huge)
- **Facts:** a blue sky is sunlight scattered by the molecules of the air; not to scale
- **Kit warnings:** none
- **Custom:** `wave-hit` (registered in scene-3.js) — the blue scattering replayed: the wave reaches the middle molecule at 2.0 s (on "off") and bounces off in every direction. Drawn large for a phone: params scale 2.0 (molecules, waves, arrows), spread 1.2, the packet starting 900 world px left of the middle molecule.
- **Transition:** fade
- **SFX:** none
