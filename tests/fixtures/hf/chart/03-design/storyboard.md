# Storyboard: How Fast Is Sound?

Music mood: curious
Total: 22.6 s, 3 scenes (heroes: none — kit-only fixture, built with --allow-hero-count), 0 sound effects

## Scene 1: Speed in three materials
- **Kind:** kit — `chart` (bar)
- **Duration:** 11.975 s (360 frames)
- **Camera:** none
- **Cues:** bar 0 on "air" (7); bar 1 on "water" (16); bar 2 on "steel" (21); highlight on "6,000" (23)
- **Presenter:** pose=point-left, expression=curious, position=right, size=small
- **Transition:** fade
- **SFX:** none
- **Props:**
```json
{"title": "Speed of sound", "kind": "bar", "unit": "m/s", "data": [{"label": "Air", "value": 343}, {"label": "Water", "value": 1480}, {"label": "Steel", "value": 5960}], "highlight": 2}
```

## Scene 2: Why solids are faster
- **Kind:** kit — `compare`
- **Duration:** 7.375 s (222 frames)
- **Camera:** none
- **Cues:** left on "gas" (2); left point 0 on "particles" (4); right on "solid" (10); right point 0 on "tightly" (13); verdict on "passed" (19)
- **Presenter:** pose=point-left, expression=neutral, position=right, size=small
- **Transition:** slide
- **SFX:** none
- **Props:**
```json
{"title": "Why solids win", "left": {"label": "Gas", "icon": "cloud", "points": ["Particles far apart"]}, "right": {"label": "Solid", "icon": "layers", "points": ["Particles tightly linked"]}, "verdict": "Each push is passed on quickly"}
```

## Scene 3: The rule
- **Kind:** kit — `kinetic`
- **Duration:** 3.275 s (99 frames)
- **Camera:** none
- **Cues:** word 0–4 on "Sound" (0), "travels" (1), "fastest" (2), "through" (3), "solids" (4)
- **Presenter:** pose=talk, expression=happy, position=right, size=large
- **Transition:** zoom
- **SFX:** none
- **Props:**
```json
{"text": "Sound travels fastest through solids", "emphasis": ["fastest", "solids"]}
```
