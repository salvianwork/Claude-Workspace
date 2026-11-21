# Places library

Layered world scenes that actors, effects and tags live in. Check this list before asking for a
new place; reuse a place (or one of its variants) when it fits. One line per place:

- `countryside` — railway through farmland, cut away: sky, hills, windmill, barn and silo, meadow, a lake under a trestle bridge, soil in section. Variants `day`, `sunset`, `night`. Anchors `rail-near`, `rail-far`, `bridge`, `lake`, `barn`, `sky`. Path `rail`. Actor scale 1.
- `lab` — warm science lab: window, wall screen, shelves of glassware, door, a long workbench, tiled floor. Variants `bright`, `dim`. Anchors `bench`, `screen`, `door`, `window`. Path `bench-top`. Actor scale 1.6.

Review sheet: `npm run world-sheet` (in `hf-kit/`) writes `sample/world-sheet/place-<name>.png`
(every variant, anchors and paths marked) and `host.png`. New places are saved here only after
the owner's final approval (the props rule, extended to places).

## Place contract (`hf-kit/places/<name>/`)

The helpers are in `hf-kit/src/world/place.js` (`HFKit.place`, `HFKit.placeLayers`); its header
comment is the full contract.

- `place.js` — classic script (no imports, no network, no `Math.random`/`Date.now`/timers),
  loaded after the kit scripts: `HFKit.places["<name>"] = {meta, anchorsFor, mount}`, drawn with
  the `HFKit.draw` and `HFKit.place.svg` helpers so places look consistent.
  - `meta = {name, description, variants: [...], anchors: [...], paths: [...], actorScale}`. The
    first variant is the default. `actorScale` is the `mountActor` scale that fits the place.
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
  - Leave clear sky or wall above each anchor, so tags never land on scenery. A layer with
    factor f ≠ 1 only shows part of itself (the sky layer about x 700–3200, y 400–1700): compose
    it inside that window.
- `preview.png` — the default variant at a 0.6× pull-out, 960 × 540
  (`npm run world-sheet -- --preview`).
- `README.md` — one line describing it (and add the line above).
