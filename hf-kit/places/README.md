# Places library

Layered world scenes that actors, effects and tags live in. Check this list before asking for a
new place; reuse a place (or one of its variants) when it fits. One line per place:

- `countryside` — railway through farmland, cut away: sky, hills, windmill, barn and silo, meadow, a lake under a trestle bridge, soil in section. Variants `day`, `sunset`, `night`. Anchors `rail-near`, `rail-far`, `bridge`, `lake`, `barn`, `sky`. Path `rail`. Actor scale 1. Extended for vertical (sky with cirrus, contrails, a balloon, birds or stars above; clay, groundwater, bedrock, roots and a fossil below).
- `lab` — warm science lab: window, wall screen, shelves of glassware, door, a long workbench, tiled floor. Variants `bright`, `dim`. Anchors `bench`, `screen`, `door`, `window`. Path `bench-top`. Actor scale 1.6. Extended for vertical (a duct run, a high shelf and the ceiling above; floor, lower cabinets and under-bench storage below).
- `city-street` — downtown street from the near sidewalk: shopfronts across the road, the city behind, cars, a zebra crossing, a bus shelter. Variants `day`, `night`. Anchors `sidewalk`, `crosswalk`, `shop-door`, `bus-stop`, `road`, `sky`. Path `sidewalk`, `road`. Actor scale 1. Extended for vertical (upper floors, rooftops, a water tower, a crane and a blimp above; a street cutaway with pipes, sewers, subway stairs and a train below).
- `home` — cosy living room and kitchen: bookshelf, window over a sofa, coffee table, inner door, kitchen counter, hob and fridge. Variants `day`, `evening`. Anchors `sofa`, `table`, `kitchen`, `window`, `door`, `floor`. Path `floor`. Actor scale 1.6. Extended for vertical (rafters, a skylight, a turning fan and fairy lights above; the floor with a rug, a sleeping dog, toys and a basket below).
- `classroom` — bright classroom: tall windows, a green chalkboard, bunting, a pin board and map, the teacher's desk, pupils' desks. Variants `day`, `afternoon`. Anchors `board`, `desk`, `front`, `window`, `seats`. Path `aisle`. Actor scale 1.6. Extended for vertical (ceiling tiles and panels, a projector, a planet mobile and lanterns above; the floor and a nearer row of desks below).
- `forest` — woodland: misty layers of trees, light shafts, a deer, a winding trail, a mossy log, a stream with a plank bridge, a huge oak. Variants `day`, `night` (moonlit), `moonless` (no Moon: a starry sky and the Milky Way, starlight only). Anchors `trail`, `clearing`, `log`, `stream`, `tree`, `canopy`. Path `trail`. Actor scale 1. Extended for vertical, every variant (the canopy, the oak's crown and a bough above, with birds or bats and stars; the floor cut away with roots, a burrow, a mole and an ant nest below).
- `ocean` — the sea: a sailing boat on rolling waves cut away to the reef below (surface), or down among the coral, seagrass and fish (underwater). Variants `surface`, `underwater`. Anchors `surface`, `boat`, `deep`, `reef`, `seabed`, `sky` (open sky above the boat). Path `current`. Actor scale 1. Extended for vertical (surface: more sky, a plane and a kite above, the sand bed cut away with a sea cave below; underwater: the bright underside with rays above, the near seabed with corals, a clam and a crab below).
- `space` — outer space: Earth's limb from orbit with the Sun, the Moon and a space station; or a ringed gas giant, an icy moon and a probe in deep space. Variants `earth-orbit`, `deep-space`. Anchors `planet`, `moon`, `craft`, `star`, `open`. Path `orbit`. Actor scale 0.6. Extended for vertical (stars, a nebula, a galaxy and a comet above, with a telescope and a capsule or a small moon; the Earth continued, or an asteroid field and a lander, below).
- `inside-body` — front view into the torso: windpipe, lungs, heart, aorta, diaphragm, liver, stomach and intestines (illustrated, or as a glowing scan). Variants `organs`, `scan`. Anchors `heart`, `lungs`, `vessel`, `stomach`, `liver`, `trachea`. Path `bloodstream`. Actor scale 0.5. Extended for vertical (the neck up to the jaw: larynx, thyroid, carotids and jugulars above; the pelvis and thighs: appendix, bladder, pelvic bones, femurs and femoral vessels below).
- `sky-fantasy` — floating islands over a sea of clouds: a grassy island with a tree, cottage and waterfall, a rope bridge to a tower island, a hot-air balloon. Variants `day`, `twilight`. Anchors `island`, `waterfall`, `tower`, `balloon`, `sky`, `cloud-sea`. Path `flight`. Actor scale 0.8. Extended for vertical (far and small floating islands, an observatory, a windmill and puffs above; the deepening sea of clouds with a sky-ship, a cloud whale and a lighthouse islet below).
- `rooftop-night` — a cosy city rooftop at night: the glowing city past a parapet, a stair hut, water tank, telescope, fairy lights, deck chairs. Variants `clear`, `rain`. Anchors `ledge`, `telescope`, `door`, `tank`, `skyline`, `sky`. Path `roof`. Actor scale 1.1. Extended for vertical (stars and the Milky Way or rain clouds, a skyscraper, a plane and a drone above; the roof's edge and the lower floors' lit windows below).

Review sheet: `npm run world-sheet` (in `hf-kit/`) writes `sample/world-sheet/place-<name>.png`
(every variant, anchors and paths marked) and `host.png`; an extended place also gets
`place-<name>-vertical.png` (the tall world and 1080 × 1920 shots: wide, mid with the host in the
bottom-right slot, close, the top and bottom of the world). New places are saved here only after
the owner's final approval (the props rule, extended to places).

## Place contract (`hf-kit/places/<name>/`)

The helpers are in `hf-kit/src/world/place.js` (`HFKit.place`, `HFKit.placeLayers`); its header
comment is the full contract.

- `place.js` — classic script (no imports, no network, no `Math.random`/`Date.now`/timers),
  loaded after the kit scripts: `HFKit.places["<name>"] = {meta, anchorsFor, mount}`, drawn with
  the `HFKit.draw` and `HFKit.place.svg` helpers so places look consistent.
  - `meta = {name, description, variants: [...], anchors: [...], paths: [...], actorScale, actorLight, notToScale?}`.
    The first variant is the default. `actorScale` is the `mountActor` scale that fits the place.
    `notToScale: true` (optional) marks a place whose sizes and distances are not true to scale
    (`space`, `inside-body`): `shots validate` then needs a `"not to scale"` tag or label in
    every scene that uses it.
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
  - Extended (vertical videos): `meta.extend = {top: {draws, seamAllow}, bottom: {draws, seamAllow}}`
    says what the place draws 720 px above and 720 px below its world. Mounted with
    `{extended: true}` on `HFKit.placeLayers(el, idPrefix, HFKit.placeWorld(place, true))` the
    world is 3840 × 3600: the original untouched in the middle (y 720–2880), every anchor and path
    720 lower (`anchorsFor({..., extended: true})` too), REF the tall world's centre. Use
    `HFKit.place.extendLayers` (original drawn in a group moved down 720, bands in `under` / `over`
    groups via `HFKit.place.band`). The bands must blend with no seam: the browser test samples
    the rows at y 720 and 2880 at REF and fails on a straight colour step, except the
    `seamAllow` x ranges (real scene edges crossing the row). A vertical canvas mounts a place
    with `meta.extend` extended (`HFKit.place.extendedFor`) and the camera stays inside the tall
    world; landscape (and any place without `meta.extend`) mounts exactly as before (3840 × 2160).
    Every place in the library is extended. Parallax limits what a camera sees of each band: the
    sky layer's top band is almost never in a shot (only the whole tall world shows it), so the
    nearer layers carry the visible detail (see the header of `src/world/place.js`); the browser
    test also checks the seams layer by layer at the extreme cameras (zoom 0.6 at the very top
    and bottom).
- `preview.png` — the default variant at a 0.6× pull-out, 960 × 540
  (`npm run world-sheet -- --preview`).
- `README.md` — one line describing it (and add the line above).
