# Storyboard: Where Do Clouds Come From?

Music mood: curious
Total: 20.6 s, 3 scenes (hero: scene 2 only — one hero, built with --allow-hero-count), 0 sound effects

## Scene 1: The question
- **Kind:** kit — `title`
- **Duration:** 2.625 s (79 frames)
- **Camera:** none
- **Cues:** title on "Where" (0)
- **Presenter:** pose=think, expression=curious, position=right, size=large
- **Transition:** fade
- **SFX:** none
- **Props:**
```json
{"title": "Where do clouds come from?", "icon": "cloud"}
```

## Scene 2: Evaporation and condensation
- **Kind:** hero — new prop `cloud-formation` (anchors sun, sea, vapour, cool, droplets, cloud; phases warm, evaporate, rise, condense, cloud)
- **Duration:** 12.65 s (380 frames)
- **Why a hero:** the change from invisible vapour to visible droplets, and where it happens, needs a picture
- **Illustration brief:** Sun high on the left over the sea; sunlight warms the sea; faint see-through wisps of vapour rise; a soft arrow for the rising warm, moist air; a dashed line high up marks the cooler air; tiny droplets appear above it and gather into a white cloud.
- **Facts:** the Sun's heat makes sea water evaporate; water vapour is an invisible gas; rising air cools; the vapour condenses into tiny droplets; a cloud is made of droplets
- **Camera:** wide on "The" (0) → follow vapour ×1.2 on "vapour" (10) → focus cloud ×1.25 on "condenses" (24)
- **Cues:** phase warm on "warms" (2); phase evaporate on "evaporates" (8); label "Water vapour (invisible)" on "vapour" (10) until "and" (21); phase rise on "rises" (18); label "Cooler air" on "cools" (20) until "form" (29); phase condense on "condenses" (24); label "Tiny droplets" on "droplets" (27) until "cloud" (31); phase cloud on "form" (29); label "Cloud" on "cloud" (31)
- **Presenter:** pose=point-left, expression=curious, position=right, size=small
- **Transition:** fade
- **SFX:** none

## Scene 3: Round and round
- **Kind:** kit — `diagram` (cycle)
- **Duration:** 5.35 s (161 frames)
- **Camera:** none
- **Cues:** node 0 on "When" (0); node 1 and link 0 on "droplets" (2); node 2 and link 1 on "fall" (6); link 2 on "cycle" (11)
- **Presenter:** pose=point-left, expression=happy, position=right, size=small
- **Transition:** slide
- **SFX:** none
- **Props:**
```json
{"title": "The water cycle", "layout": "cycle", "nodes": [{"label": "Evaporation", "icon": "sun"}, {"label": "Condensation", "icon": "cloud"}, {"label": "Rain", "icon": "drop"}]}
```
