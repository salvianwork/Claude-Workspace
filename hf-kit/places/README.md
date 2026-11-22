# Places library

Layered world scenes that actors, effects and tags live in. Check this list before asking for a
new place; reuse a place (or one of its variants) when it fits. One line per place:

- `countryside` — railway through farmland, cut away: sky, hills, windmill, barn and silo, meadow, a lake under a trestle bridge, soil in section. Variants `day`, `sunset`, `night`. Anchors `rail-near`, `rail-far`, `bridge`, `lake`, `barn`, `sky`. Path `rail`. Actor scale 1.
- `lab` — warm science lab: window, wall screen, shelves of glassware, door, a long workbench, tiled floor. Variants `bright`, `dim`. Anchors `bench`, `screen`, `door`, `window`. Path `bench-top`. Actor scale 1.6.
- `city-street` — downtown street from the near sidewalk: shopfronts across the road, the city behind, cars, a zebra crossing, a bus shelter. Variants `day`, `night`. Anchors `sidewalk`, `crosswalk`, `shop-door`, `bus-stop`, `road`, `sky`. Path `sidewalk`, `road`. Actor scale 1.
- `home` — cosy living room and kitchen: bookshelf, window over a sofa, coffee table, inner door, kitchen counter, hob and fridge. Variants `day`, `evening`. Anchors `sofa`, `table`, `kitchen`, `window`, `door`, `floor`. Path `floor`. Actor scale 1.6.
- `classroom` — bright classroom: tall windows, a green chalkboard, bunting, a pin board and map, the teacher's desk, pupils' desks. Variants `day`, `afternoon`. Anchors `board`, `desk`, `front`, `window`, `seats`. Path `aisle`. Actor scale 1.6.
- `forest` — woodland: misty layers of trees, light shafts, a deer, a winding trail, a mossy log, a stream with a plank bridge, a huge oak. Variants `day`, `night`. Anchors `trail`, `clearing`, `log`, `stream`, `tree`, `canopy`. Path `trail`. Actor scale 1.
- `ocean` — the sea: a sailing boat on rolling waves cut away to the reef below (surface), or down among the coral, kelp and fish (underwater). Variants `surface`, `underwater`. Anchors `surface`, `boat`, `deep`, `reef`, `seabed`. Path `current`. Actor scale 1.
- `space` — outer space: Earth's limb from orbit with the Sun, the Moon and a space station; or a ringed gas giant, an icy moon and a probe in deep space. Variants `earth-orbit`, `deep-space`. Anchors `planet`, `moon`, `craft`, `star`, `open`. Path `orbit`. Actor scale 0.6.
- `inside-body` — front view into the torso: windpipe, lungs, heart, aorta, diaphragm, liver, stomach and intestines (illustrated, or as a glowing scan). Variants `organs`, `scan`. Anchors `heart`, `lungs`, `vessel`, `stomach`, `liver`, `trachea`. Path `bloodstream`. Actor scale 0.5.
- `sky-fantasy` — floating islands over a sea of clouds: a grassy island with a tree, cottage and waterfall, a rope bridge to a tower island, a hot-air balloon. Variants `day`, `twilight`. Anchors `island`, `waterfall`, `tower`, `balloon`, `sky`, `cloud-sea`. Path `flight`. Actor scale 0.8.
- `rooftop-night` — a cosy city rooftop at night: the glowing city past a parapet, a stair hut, water tank, telescope, fairy lights, deck chairs. Variants `clear`, `rain`. Anchors `ledge`, `telescope`, `door`, `tank`, `skyline`, `sky`. Path `roof`. Actor scale 1.1.

Review sheet: `npm run world-sheet` (in `hf-kit/`) writes `sample/world-sheet/place-<name>.png`
(every variant, anchors and paths marked) and `host.png`. New places are saved here only after
the owner's final approval (the props rule, extended to places).

## Place contract (`hf-kit/places/<name>/`)

The helpers are in `hf-kit/src/world/place.js` (`HFKit.place`, `HFKit.placeLayers`); its header
comment is the full contract.

- `place.js` — classic script (no imports, no network, no `Math.random`/`Date.now`/timers),
  loaded after the kit scripts: `HFKit.places["<name>"] = {meta, anchorsFor, mount}`, drawn with
  the `HFKit.draw` and `HFKit.place.svg` helpers so places look consistent.
  - `meta = {name, description, variants: [...], anchors: [...], paths: [...], actorScale, actorLight}`.
    The first variant is the default. `actorScale` is the `mountActor` scale that fits the place.
    `actorLight[variant] = {tint, amount 0..1, rim?, rimSide?}` is how an actor there is lit
    (pass it as `mountActor` `spec.light` / `ctx.light`): night and dim variants darken and cool
    the actor and add a soft rim from the moon or the lamp.
  - World: 3840 × 2160 world px (twice the frame), so a 0.6× pull-out still fills the frame.
  - Layers, back to front: `sky`, `far`, `mid`, `ground`, `front`, parallax factors
    `0.2 / 0.45 / 0.75 / 1 / 1.15`. `HFKit.placeLayers(el, idPrefix)` builds them as five
    world-sized `<svg>`s in `el` (the 1920 × 1080 frame). Actors go between `ground` and `front`.
  - `mount(layers, {variant, seed, idPrefix}) -> {update(t, cam), anchors, paths}`.
    `cam = {x, y, zoom}` is the world point at the frame centre and the zoom. A layer with factor
    f sees the camera `REF + (cam - REF) * f` at zoom `cam.zoom ^ f`, where REF is the world
    centre at zoom 1 (all layers line up there). `update` is a pure function of `(t, cam)`.
  - `anchors[name]` is `(t) => {x, y}` and `paths[name]` is `[{x, y}, ...]`, both in
    ground-layer world px inside the world. Anything an anchor names is drawn on the ground layer.
  - `anchorsFor({variant, seed}) -> {anchors, paths}`: the same without a DOM (for validation).
  - An unknown variant throws `place <name>: unknown variant "<v>"` before anything is drawn.
  - Every SVG id starts with `idPrefix + "-"` (`s<scene>-place-<n>`), so two places, or one place
    in two scenes, never share a gradient or clip.
  - Shared art helpers are in `HFKit.place.art` (`cloud`, `tree`, `stars`, `glint`, `toner`,
    `wrap` and `wrapFade`). Anything that drifts (clouds, motes, cars, birds) wraps round a span
    with both ends off view, so a long scene never runs out of it.
  - An anchor may carry `scale` (e.g. `city-street` `shop-door` across the road: 0.7): multiply
    `actorScale` by it for an actor standing there. `inside-body` also has `meta.midline`.
  - Leave clear sky or wall above each anchor, so tags never land on scenery. A layer with
    factor f ≠ 1 only shows part of itself (the sky layer about x 700–3200, y 400–1700): compose
    it inside that window.
- `preview.png` — the default variant at a 0.6× pull-out, 960 × 540
  (`npm run world-sheet -- --preview`).
- `README.md` — one line describing it (and add the line above).
