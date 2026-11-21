import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import "../src/kit.js";
import "../src/draw.js";
import "../src/world/place.js";
import "../places/countryside/place.js";
import "../places/lab/place.js";

const K = globalThis.HFKit;
const KIT = new URL("../", import.meta.url);
const WORLD = { width: 3840, height: 2160 };
const EXPECT = {
  countryside: { variants: ["day", "sunset", "night"], anchors: ["rail-near", "rail-far", "bridge", "lake", "barn", "sky"], paths: ["rail"] },
  lab: { variants: ["bright", "dim"], anchors: ["bench", "screen", "door", "window"], paths: ["bench-top"] },
};

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
  const dirs = readdirSync(new URL("places/", KIT)).filter((d) => statSync(new URL("places/" + d, KIT)).isDirectory()).sort();
  assert.deepEqual(dirs, Object.keys(EXPECT).sort());
  const readme = readFileSync(new URL("places/README.md", KIT), "utf8");
  for (const d of dirs) {
    for (const f of ["place.js", "preview.png", "README.md"]) assert.ok(statSync(new URL(`places/${d}/${f}`, KIT)).size > 0, `${d}/${f}`);
    assert.match(readme, new RegExp("`" + d + "`"), "places/README.md lists " + d);
  }
});

for (const [name, want] of Object.entries(EXPECT)) {
  test(`${name}: meta lists its variants, anchors and paths`, () => {
    const p = K.places[name];
    assert.ok(p, "registered");
    assert.equal(typeof p.mount, "function");
    assert.equal(p.meta.name, name);
    assert.ok(p.meta.description.length > 10);
    assert.ok(p.meta.variants.length >= 1);
    assert.deepEqual(p.meta.variants, want.variants);
    for (const a of want.anchors) assert.ok(p.meta.anchors.includes(a), "anchor " + a);
    for (const a of want.paths) assert.ok(p.meta.paths.includes(a), "path " + a);
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
  for (const f of ["src/world/place.js", "places/countryside/place.js", "places/lab/place.js"]) {
    const src = readFileSync(new URL(f, KIT), "utf8");
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3\.org)/, f);
    assert.doesNotMatch(src, /Math\.random|Date\.now|setTimeout|setInterval|requestAnimationFrame/, f);
  }
});

test("package.json has the world-sheet script", () => {
  const pkg = JSON.parse(readFileSync(new URL("package.json", KIT), "utf8"));
  assert.equal(pkg.scripts["world-sheet"], "node scripts/world-sheet.mjs");
});
