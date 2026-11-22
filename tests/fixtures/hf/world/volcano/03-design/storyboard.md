# Storyboard: How a Volcano Erupts

Type: explainer · Audience: all-ages · Host outfit: explorer
Music mood: dramatic
Total: 21.3 s, 3 scenes, host step-ins: scenes 1; new place: volcano; custom moves: scene 1 magma-rise, scene 2 eruption, scene 3 eruption, scene 3 magma-rise; 0 sound effects

## Scene 1: The chamber below
- **Place:** `volcano`, variant `day` (new place, `04-video/hf/scenes/place-volcano.js`)
- **Duration:** 8.925 s (268 frames)
- **Idea:** Magma is stored in a chamber under the volcano and rises through a vent.
- **Host:** step-in — stands at `foot` in the world
- **Cast:** none
- **Beats:**
  1. "Deep…" (0) — the whole volcano, cut away: the host at its foot points down at the chamber; the camera pushes down to the glowing pool of molten rock. Moves: camera cut `chamber` ×0.6 at the start; label "not to scale" on `sky` on "Deep" (0); point host on "volcano" (3); camera push_in `chamber` ×1.2 on "chamber" (7); label "Magma chamber" on `chamber` on "chamber" (7); glow chamber on "molten" (11)
  2. "As…" (13) — pressure pulses through the chamber, then magma climbs the vent toward the crater as the camera rises with it. Moves: rings chamber on "pressure" (14); custom `magma-rise` on "magma" (17); gesture host on "magma" (17); camera pull_out `vent` ×0.7 on "vent" (23); label "Vent" on `vent` on "narrow" (22)
- **Text on screen:** "not to scale", "Magma chamber", "Vent" (6 words in 8.925 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** the magma chamber lies deep beneath the volcano; magma is molten rock; pressure pushes magma up through a narrow vent; not to scale: a real volcano is thousands of times taller than a person
- **Kit warnings:** none
- **Place brief:** `volcano` (new; adapted from the prop library's `volcano` cut-away): sky (blue day / violet-orange dusk with stars), far blue mountains, mid hills with trees, ground = farmland with a little farm at the left, the cone cut away down the middle (rock beds), an empty dark vent from the crater down to the magma chamber deep in the soil section (molten, churning), front = grass tufts at the edges. Variants `day`, `dusk`. Anchors `foot`, `chamber`, `vent`, `crater`, `slope`, `sky`. Paths `vent` (chamber to crater), `lava-flow` (crater down the right slope). Actor scale 1. notToScale (a real volcano is thousands of times taller than a person).
- **Custom:** `magma-rise` (scene-1.js, from the prop's rise phase) — from its word, magma climbs the `vent` path from the chamber to the crater (accelerating, glowing tip) in `params.duration` s and waits under the crater.
- **Transition:** fade
- **SFX:** none

## Scene 2: The eruption
- **Place:** `volcano`, variant `day` (new place, `04-video/hf/scenes/place-volcano.js`)
- **Duration:** 7.8 s (234 frames)
- **Idea:** Erupted magma is called lava; cooled lava adds a layer to the cone.
- **Host:** talks from the right slot
- **Cast:** none
- **Beats:**
  1. "At…" (0) — at the crater the magma bursts out: a fountain of glowing lava and a column of ash; the host is startled. Moves: camera cut `crater` ×0.9 at the start; say host; custom `eruption` on "bursts" (4); burst crater on "bursts" (4); react host on "bursts" (4); pulse_along lava-flow on "lava" (7); tag_follow "Lava" on `pulse`
  2. "The…" (8) — lava runs down both slopes as the camera pulls back, then darkens as it cools and hardens; the cone grows a new dark layer. Moves: camera pull_out `vent` ×0.65 on "slopes" (13); point host on "cools" (14); label "not to scale" on `sky` on "cools" (14); label "New layer" on `slope` on "a" (21)
- **Text on screen:** "Lava", "not to scale", "New layer" (6 words in 7.8 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** magma that bursts out at the surface is called lava; lava flows down the slopes, cools and hardens; each eruption adds a new layer to the cone; not to scale
- **Kit warnings:** none
- **Custom:** `eruption` (scene-2.js, from the prop's burst/flow/grow phases) — the vent is full; at its word a lava fountain (ballistic bombs) and an ash plume burst from the crater; lava runs down both slopes from `flow` s later, cools from `cool` s and hardens into a new dark layer along the cone from `grow` s (seconds after the burst word, from the word times of "cools" and "grows").
- **Transition:** fade
- **SFX:** none

## Scene 3: Remember
- **Place:** `volcano`, variant `dusk` (new place, `04-video/hf/scenes/place-volcano.js`)
- **Duration:** 4.55 s (137 frames)
- **Idea:** The three steps in order.
- **Host:** talks from the left slot
- **Cast:** none
- **Beats:**
  1. "So…" (0) — at dusk, magma races up the vent, erupts from the crater and runs down the slopes, hardening into a new layer, as the camera pulls back to the whole mountain; the host celebrates. Moves: camera cut `vent` ×0.9 at the start; gesture host on "So" (0); custom `magma-rise` on "magma" (1); custom `eruption` on "erupts" (3); burst crater on "erupts" (3); sparkle slope on "builds" (7); gesture host on "builds" (7); label "not to scale" on `sky` on "and" (6); camera pull_out `vent` ×0.6 on "mountain" (9)
- **Text on screen:** "not to scale" (3 words in 4.55 s)
- **Scale:** not to scale — label "not to scale"
- **Facts:** magma rises, erupts as lava and builds the mountain; not to scale
- **Kit warnings:** none
- **Custom:** `magma-rise` and `eruption` again (registered by scene-1.js and scene-2.js; `eruption` with `vent: false` so the rising magma shows) — the whole story in 4.5 s for the recap.
- **Transition:** fade
- **SFX:** none
