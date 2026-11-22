# Storyboard: Where Do Clouds Come From?

Type: explainer · Audience: all-ages · Host outfit: explorer
Music mood: calm
Total: 24.5 s, 4 scenes, host step-ins: scene 4; new place: none; custom moves: scene 2 air-parcel, scene 3 droplets and cumulus, scene 4 rain (and cumulus again); 0 sound effects

One natural setting throughout: the sea by a sailing boat (`ocean`, `surface`), then the sky over
that same sea (the `sky` anchor, right of the mast), where the cloud forms and from where the rain
falls back into the sea beside the boat.

## Scene 1: The Sun warms the sea
- **Place:** `ocean`, variant `surface` (library)
- **Duration:** 6.875 s (207 frames)
- **Idea:** Warmed water evaporates into invisible water vapour.
- **Host:** talks from the right slot
- **Cast:** none
- **Beats:**
  1. "The…" (0) — sunlight warms the sea: a warm glow spreads over the water by the boat. Moves: camera pull_out `surface` ×0.85 on "sea" (4); gesture wave host; glow surface on "warms" (2)
  2. "and…" (5) — faint wisps of water vapour rise from the warm sea into the air; the host points at them. Moves: point host on "water" (7); react curious host on "invisible" (14); gesture think host on "water" (16); smoke surface on "escapes" (8); smoke boat on "into" (9); label "Water vapour" on `surface` on "water" (16)
- **Text on screen:** "Water vapour" (2 words in 6.875 s)
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** the Sun's heat makes sea water evaporate; water vapour is an invisible gas (the wisps only hint where it rises)
- **Kit warnings:** none
- **Transition:** fade
- **SFX:** none

## Scene 2: Rising and cooling
- **Place:** `ocean`, variant `surface` (library) — the sky over the sea
- **Duration:** 5.325 s (160 frames)
- **Idea:** Rising air spreads out (expands) and so cools.
- **Host:** talks from the right slot
- **Cast:** none
- **Beats:**
  1. "The…" (0) — over the sea beside the boat, a bubble of warm, moist air lifts off the water and starts to climb. Moves: camera cut `sky` ×0.75 at the start; point host at `surface` on "warm" (1); custom `air-parcel` on "air" (3); label "Warm, moist air" on `sky` (below) on "warm" (1) until "it" (6)
  2. "As…" (5) — as it rises the bubble swells (little arrows point outward) and turns from warm orange to cool blue. Moves: point host at `sky` on "it" (6); react curious host on "spreads" (10); label "Spreads out, cools" on `sky` (above) on "spreads" (10)
- **Text on screen:** "Warm, moist air", "Spreads out, cools" (6 words in 5.325 s)
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** warm, moist air rises; as it rises the air pressure around it drops, so the air expands (spreads out) and cools; the drawing swells and turns from orange to blue as it climbs
- **Kit warnings:** none
- **Custom:** `air-parcel` (scene-2.js) — a translucent bubble of air with a dashed rim and a few moisture dots, starting small and warm orange just above the water under the `sky` anchor; over 2.7 s it climbs to just below the cloud level, and as it rises its radius grows from 80 to 190 world px (outward chevrons while it swells) and its colour turns from orange to blue; faint wavy lines trail below while it climbs.
- **Transition:** fade
- **SFX:** none

## Scene 3: Droplets make a cloud
- **Place:** `ocean`, variant `surface` (library) — the sky over the sea
- **Duration:** 6.35 s (191 frames)
- **Idea:** Condensed droplets form a cloud.
- **Host:** talks from the right slot
- **Cast:** none
- **Beats:**
  1. "Cooled…" (0) — where the air cooled, tiny water droplets appear in the sky over the sea. Moves: camera cut `sky` ×0.9 at the start; point host at `sky` on "condenses" (2); custom `droplets` on "condenses" (2) until "Billions" (6); label "Tiny droplets" on `sky` (below) on "droplets" (5) until "together" (9)
  2. "Billions…" (6) — billions of droplets build a real cumulus cloud: a flat base and a puffy top billowing up. Moves: custom `cumulus` (grow 1.6 s) on "Billions" (6); react surprised host on "Billions" (6); gesture celebrate host on "cloud" (12); label "Cloud" on `sky` (left) on "cloud" (12)
- **Text on screen:** "Tiny droplets", "Cloud" (3 words in 6.35 s)
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** cooled water vapour condenses into tiny droplets; a cloud is made of a huge number of droplets; a cumulus cloud has a flat base, where rising air has cooled enough for vapour to condense, and a puffy, heaped top
- **Kit warnings:** none
- **Custom:** `droplets` (scene-3.js) — about 110 tiny blue-white droplets with a glint fade in one by one over 1.4 s in a band at the cloud-base level, drifting gently, and fade out from `until` as the cloud takes over. `cumulus` (scene-3.js) — a fair-weather cumulus centred on `sky`: 15 rounded puffs cut flat at the base (sky.y + 90), white on top shading to grey-blue at the base, a soft outline on the silhouette and a sunlit glow on the top turrets; the puffs swell in from the base upward over 1.6 s so the cloud billows up.
- **Transition:** fade
- **SFX:** none

## Scene 4: Rain
- **Place:** `ocean`, variant `surface` (library)
- **Duration:** 5.975 s (180 frames)
- **Idea:** Grown droplets fall as rain, back to the sea.
- **Host:** step-in — stands on the boat (`boat`) in the world
- **Cast:** none
- **Beats:**
  1. "The…" (0) — back on the boat: the cloud beside it turns grey and heavy as its droplets bump together and grow. Moves: camera cut `sky` ×0.7 at the start; custom `cumulus` (grown, dark 1) on "bump" (2); gesture think host on "bump" (2)
  2. "When…" (6) — rain falls from the cloud's base back into the sea beside the boat; the host is surprised and shrugs. Moves: point host at `sky` on "When" (6); custom `rain` on "fall" (14); react surprised host on "fall" (14); gesture shrug host on "as" (15); label "Rain" on `sky` (below) on "rain" (16)
- **Text on screen:** "Rain" (1 word in 5.975 s)
- **Scale:** no sizes, speeds or ratios shown
- **Facts:** droplets collide and grow; the cloud turns grey and heavy; drops too heavy to stay up fall as rain, back into the sea
- **Kit warnings:** none
- **Custom:** `cumulus` with `grown: true, dark: 1` — the scene-3 cloud, fully formed from the start, turns grey and heavy and swells a little over 1.6 s from "bump". `rain` (scene-4.js) — from "fall", about 70 slanted drops leave the cloud base one by one and fall into the sea beside the boat (a rain front reaching the water in about 0.4 s), with small rings spreading where they land. No rainbow.
- **Transition:** fade
- **SFX:** none
