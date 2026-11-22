import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import "../src/kit.js";
import "../src/draw.js";
import "../src/world/place.js";
import "../places/countryside/place.js";
import "../places/lab/place.js";
import "../places/city-street/place.js";
import "../places/home/place.js";
import "../places/classroom/place.js";
import "../places/forest/place.js";
import "../places/ocean/place.js";
import "../places/space/place.js";
import "../places/inside-body/place.js";
import "../places/sky-fantasy/place.js";
import "../places/rooftop-night/place.js";

const K = globalThis.HFKit;
const KIT = new URL("../", import.meta.url);
const WORLD = { width: 3840, height: 2160 };
const EXPECT = {
  countryside: { variants: ["day", "sunset", "night"], anchors: ["rail-near", "rail-far", "bridge", "lake", "barn", "sky"], paths: ["rail"] },
  lab: { variants: ["bright", "dim"], anchors: ["bench", "screen", "door", "window"], paths: ["bench-top"] },
  "city-street": { variants: ["day", "night"], anchors: ["sidewalk", "crosswalk", "shop-door", "bus-stop", "road", "sky"], paths: ["sidewalk", "road"] },
  home: { variants: ["day", "evening"], anchors: ["sofa", "table", "kitchen", "window", "door", "floor"], paths: ["floor"] },
  classroom: { variants: ["day", "afternoon"], anchors: ["board", "desk", "front", "window", "seats"], paths: ["aisle"] },
  forest: { variants: ["day", "night", "moonless"], anchors: ["trail", "clearing", "log", "stream", "tree", "canopy"], paths: ["trail"] },
  ocean: { variants: ["surface", "underwater"], anchors: ["surface", "boat", "deep", "reef", "seabed", "sky"], paths: ["current"] },
  space: { variants: ["earth-orbit", "deep-space"], anchors: ["planet", "moon", "craft", "star", "open"], paths: ["orbit"] },
  "inside-body": { variants: ["organs", "scan"], anchors: ["heart", "lungs", "vessel", "stomach", "liver", "trachea"], paths: ["bloodstream"] },
  "sky-fantasy": { variants: ["day", "twilight"], anchors: ["island", "waterfall", "tower", "balloon", "sky", "cloud-sea"], paths: ["flight"] },
  "rooftop-night": { variants: ["clear", "rain"], anchors: ["ledge", "telescope", "door", "tank", "skyline", "sky"], paths: ["roof"] },
};
// night-time variants: the actor is clearly darker and cooler, with a rim from the moon or a lamp
const NIGHT = new Set(["night", "dim", "clear", "rain", "moonless"]);
// every place folder: the library above plus any place saved after an owner-approved video
// (the animator's step 7); those load here and meet the same contract
const DIRS = readdirSync(new URL("places/", KIT)).filter((d) => statSync(new URL("places/" + d, KIT)).isDirectory()).sort();
for (const d of DIRS) if (!(d in EXPECT)) await import(new URL(`places/${d}/place.js`, KIT));

test("place.js is a kit script after draw.js and exposes the contract helpers", () => {
  const s = K.SCRIPTS;
  assert.ok(s.includes("src/world/place.js"));
  assert.ok(s.indexOf("src/world/place.js") > s.indexOf("src/draw.js"));
  assert.equal(typeof K.placeLayers, "function");
  assert.deepEqual(K.place.WORLD, WORLD);
  assert.deepEqual(K.place.LAYERS, ["sky", "far", "mid", "ground", "front"]);
  assert.deepEqual(K.place.PARALLAX, { sky: 0.2, far: 0.45, mid: 0.75, ground: 1, front: 1.15 });
});

test("the places library folder matches the registered places", () => {
  const dirs = DIRS;
  for (const name of Object.keys(EXPECT)) assert.ok(dirs.includes(name), "places/" + name + " is in the library");
  for (const d of dirs) assert.ok(K.places[d] && K.places[d].meta.name === d, `places/${d}/place.js registers HFKit.places["${d}"]`);
  const readme = readFileSync(new URL("places/README.md", KIT), "utf8");
  for (const d of dirs) {
    for (const f of ["place.js", "preview.png", "README.md"]) assert.ok(statSync(new URL(`places/${d}/${f}`, KIT)).size > 0, `${d}/${f}`);
    assert.match(readme, new RegExp("`" + d + "`"), "places/README.md lists " + d);
  }
});

for (const name of DIRS) {
  const want = EXPECT[name]; // undefined for a place saved after an approved video: the contract only
  test(`${name}: meta.actorLight lights an actor in every variant`, () => {
    const p = K.places[name];
    for (const variant of p.meta.variants) {
      const l = p.meta.actorLight && p.meta.actorLight[variant];
      assert.ok(l, variant + " has no actorLight");
      assert.match(l.tint, /^#[0-9A-Fa-f]{6}$/, variant);
      assert.ok(l.amount >= 0 && l.amount <= 1, variant);
      if (l.rim !== undefined) assert.match(l.rim, /^#[0-9A-Fa-f]{6}$/, variant);
      if (NIGHT.has(variant)) {
        // clearly darker and cooler, with a soft rim from the moon / the lamp
        const [r, , b] = [1, 3, 5].map((i) => parseInt(l.tint.slice(i, i + 2), 16));
        assert.ok(l.amount >= 0.5 && b > r && l.rim, variant + " is not dark, cool and rim-lit");
      }
    }
  });

  test(`${name}: meta lists its variants, anchors and paths`, () => {
    const p = K.places[name];
    assert.ok(p, "registered");
    assert.equal(typeof p.mount, "function");
    assert.equal(p.meta.name, name);
    assert.ok(p.meta.description.length > 10);
    assert.ok(p.meta.variants.length >= 1);
    if (!want) return;
    assert.deepEqual(p.meta.variants, want.variants);
    for (const a of want.anchors) assert.ok(p.meta.anchors.includes(a), "anchor " + a);
    for (const a of want.paths) assert.ok(p.meta.paths.includes(a), "path " + a);
  });

  test(`${name}: at least 2 variants, 4 anchors and 1 path; an actor scale`, () => {
    const m = K.places[name].meta;
    assert.ok(m.variants.length >= 2 && m.anchors.length >= 4 && m.paths.length >= 1, name);
    assert.ok(m.actorScale > 0.2 && m.actorScale < 3, "actorScale " + m.actorScale);
  });

  test(`${name}: an unknown variant throws before anything is drawn`, () => {
    assert.throws(() => K.places[name].mount({}, { variant: "x", idPrefix: "s1-place-0" }), new RegExp(`^Error: place ${name}: unknown variant "x"$`));
    assert.throws(() => K.places[name].anchorsFor({ variant: "x" }), /unknown variant "x"/);
  });

  test(`${name}: every anchor and path point lies inside the 3840x2160 world, for every variant`, () => {
    const p = K.places[name];
    for (const variant of p.meta.variants) {
      const { anchors, paths } = p.anchorsFor({ variant, seed: 3 });
      assert.deepEqual(Object.keys(anchors).sort(), [...p.meta.anchors].sort(), variant + " anchors");
      assert.deepEqual(Object.keys(paths).sort(), [...p.meta.paths].sort(), variant + " paths");
      const inside = (q, what) => {
        assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y), what + " finite");
        assert.ok(q.x >= 0 && q.x <= WORLD.width && q.y >= 0 && q.y <= WORLD.height, `${what} ${JSON.stringify(q)} outside the world`);
      };
      for (const [a, fn] of Object.entries(anchors)) {
        assert.equal(typeof fn, "function", a + " is a function of t");
        for (const t of [0, 1.5, 7, 30]) inside(fn(t), `${variant} ${a}(${t})`);
      }
      for (const [k, pts] of Object.entries(paths)) {
        assert.ok(pts.length >= 2, k + " has points");
        pts.forEach((q, i) => inside(q, `${variant} ${k}[${i}]`));
      }
    }
  });
}

test("parallax: the ground layer maps world to screen with the camera; other layers by their factor", () => {
  const cam = { x: 2400, y: 1300, zoom: 2 };
  // ground (factor 1): the camera centre lands on the frame centre
  assert.deepEqual(K.place.toScreen({ x: 2400, y: 1300 }, cam, 1), { x: 960, y: 540 });
  assert.deepEqual(K.place.toScreen({ x: 2500, y: 1300 }, cam, 1), { x: 1160, y: 540 });
  // at the reference camera (world centre, zoom 1) every layer lines up
  const ref = { x: 1920, y: 1080, zoom: 1 };
  for (const f of [0.2, 0.45, 0.75, 1, 1.15]) assert.deepEqual(K.place.toScreen({ x: 100, y: 200 }, ref, f), { x: -860, y: -340 });
  // a far layer moves less than the ground when the camera pans
  const pan = { x: 2420, y: 1080, zoom: 1 };
  const g = K.place.toScreen({ x: 2420, y: 1080 }, pan, 1), s = K.place.toScreen({ x: 2420, y: 1080 }, pan, 0.2);
  assert.equal(g.x, 960);
  assert.ok(s.x > 960 && s.x < 1460, "sky lags the pan: " + s.x);
});

test("places are offline and deterministic (no network, Math.random, Date.now or timers)", () => {
  for (const f of ["src/world/place.js", ...DIRS.map((n) => `places/${n}/place.js`)]) {
    const src = readFileSync(new URL(f, KIT), "utf8");
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3\.org)/, f);
    assert.doesNotMatch(src, /Math\.random|Date\.now|setTimeout|setInterval|requestAnimationFrame/, f);
  }
});

test("inside-body: anchors are anatomically sensible (front view: the body's left is the viewer's right)", () => {
  const p = K.places["inside-body"];
  const mid = p.meta.midline;
  assert.ok(Math.abs(mid - 1920) < 200, "body centred in the world");
  for (const variant of p.meta.variants) {
    const a = Object.fromEntries(Object.entries(p.anchorsFor({ variant }).anchors).map(([k, f]) => [k, f(0)]));
    // heart: just left of the body's midline (viewer's right), between the lungs, above the diaphragm
    assert.ok(a.heart.x > mid && a.heart.x - mid < 260, "heart slightly to the body's left");
    // lungs: the anchor is in the right lung (viewer's left), level with the heart, above the stomach and liver
    assert.ok(a.lungs.x < mid - 250 && Math.abs(a.lungs.y - a.heart.y) < 260, "lung beside the heart");
    assert.ok(a.lungs.y < a.stomach.y - 300 && a.lungs.y < a.liver.y - 200, "lungs above the abdomen");
    // stomach: upper abdomen, body's left (viewer's right), below the heart; liver: body's right, opposite
    assert.ok(a.stomach.x > mid + 100 && a.stomach.y > a.heart.y + 300, "stomach left upper abdomen");
    assert.ok(a.liver.x < mid - 100 && a.liver.y > a.heart.y + 150 && a.liver.y < a.stomach.y + 200, "liver right upper abdomen");
    // trachea: on the midline above the heart; vessel: the aorta, near the midline
    assert.ok(Math.abs(a.trachea.x - mid) < 60 && a.trachea.y < a.heart.y - 250, "trachea above the heart");
    assert.ok(Math.abs(a.vessel.x - mid) < 220, "vessel (aorta) near the midline");
    // the bloodstream path leaves the heart
    const path = p.anchorsFor({ variant }).paths.bloodstream;
    assert.ok(Math.hypot(path[0].x - a.heart.x, path[0].y - a.heart.y) < 200, "bloodstream starts at the heart");
  }
});

test("ocean: surface above the deep water, the reef and the seabed in both variants", () => {
  const p = K.places.ocean;
  for (const variant of ["surface", "underwater"]) {
    const a = Object.fromEntries(Object.entries(p.anchorsFor({ variant }).anchors).map(([k, f]) => [k, f(0)]));
    assert.ok(a.boat.y <= a.surface.y + 40 && a.surface.y < a.deep.y && a.deep.y < a.reef.y && a.reef.y <= a.seabed.y, variant);
    assert.ok(a.sky.y < a.boat.y - 100 && a.sky.y < a.surface.y, variant + ": the sky is above the sea");
  }
});

test("forest: an actor is darker on the moonless night than under the Moon (the sky: test/browser/places.mjs)", () => {
  const lit = K.places.forest.meta.actorLight;
  assert.ok(lit.moonless.amount > lit.night.amount, "an actor is darker without the Moon");
});

test("package.json has the world-sheet script", () => {
  const pkg = JSON.parse(readFileSync(new URL("package.json", KIT), "utf8"));
  assert.equal(pkg.scripts["world-sheet"], "node scripts/world-sheet.mjs");
});
