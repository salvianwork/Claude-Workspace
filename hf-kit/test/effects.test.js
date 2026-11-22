// World effects (src/world/effects.js): every effect is a pure function of t (seekable and
// deterministic), its box is empty before `at` and non-empty once it plays, and its ids carry the
// mount prefix. Mounted on a tiny fake DOM (the browser checks are in test/browser/world-kit.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/kit.js";
import "../src/draw.js";
import "../src/world/place.js";
import "../src/world/effects.js";
import { fakeDocument, serialize, all } from "./helpers/fake-dom.js";

const K = globalThis.HFKit;
const NAMES = ["burst", "rings", "pulse_along", "speed_lines", "splash", "sparkle", "smoke", "glow"];
const AT = 1.2;
const PATH = [{ x: 600, y: 1500 }, { x: 1400, y: 1480 }, { x: 2200, y: 1500 }, { x: 3200, y: 1420 }];
const PARAMS = {
  burst: { at: AT, x: 1800, y: 1200 },
  rings: { at: AT, x: 1800, y: 1200, count: 3 },
  pulse_along: { at: AT, path: PATH, duration: 2 },
  speed_lines: { at: AT, x: 1800, y: 1200, angle: 0, duration: 1.5 },
  splash: { at: AT, x: 1800, y: 1600 },
  sparkle: { at: AT, x: 1800, y: 1100 },
  smoke: { at: AT, x: 1800, y: 1400, duration: 3 },
  glow: { at: AT, x: 1800, y: 1100, duration: 3 },
};

function mount(name, prefix = "s1-fx-0", params = PARAMS[name]) {
  const doc = fakeDocument();
  const layer = doc.createElementNS("svg", "svg");
  const fx = K.effects[name](layer, params, prefix);
  return { layer, fx };
}

test("effects.js is a kit script after place.js and registers every effect", () => {
  assert.ok(K.SCRIPTS.indexOf("src/world/effects.js") > K.SCRIPTS.indexOf("src/world/place.js"));
  assert.deepEqual(Object.keys(K.effects).sort(), [...NAMES].sort());
});

for (const name of NAMES) {
  test(`${name}: deterministic and seekable`, () => {
    const a = mount(name), b = mount(name);
    for (const t of [0, AT + 0.1, AT + 0.6, AT + 1.4, AT + 3.5]) {
      a.fx.update(t);
      b.fx.update(t);
      assert.equal(serialize(a.layer), serialize(b.layer), `${name} at ${t}`);
    }
    // seeking back reproduces the frame
    a.fx.update(AT + 0.5);
    const s = serialize(a.layer);
    a.fx.update(AT + 2.7);
    a.fx.update(AT + 0.5);
    assert.equal(serialize(a.layer), s);
  });

  test(`${name}: box is empty before at, non-empty while it plays, inside sensible bounds`, () => {
    const { fx } = mount(name);
    for (const t of [0, AT - 0.5, AT - 0.01]) {
      const b = fx.box(t);
      assert.ok(b && b.width === 0 && b.height === 0, `${name} box at ${t}: ${JSON.stringify(b)}`);
    }
    for (const t of [AT + 0.15, AT + 0.4]) {
      const b = fx.box(t);
      assert.ok(b.width > 0 && b.height > 0, `${name} box at ${t}: ${JSON.stringify(b)}`);
      assert.ok(b.width < 4000 && b.height < 2500, `${name} box at ${t} too big: ${JSON.stringify(b)}`);
      for (const k of ["x", "y", "width", "height"]) assert.ok(Number.isFinite(b[k]));
    }
    // box is a pure function of t: it does not depend on the last update
    fx.update(AT + 2);
    assert.deepEqual(fx.box(AT + 0.4), mount(name).fx.box(AT + 0.4));
  });

  test(`${name}: every id carries the mount prefix; nothing shows before at`, () => {
    const { layer, fx } = mount(name, "s4-fx-2");
    fx.update(AT + 0.5);
    for (const e of all(layer)) if (e.attrs.id) assert.ok(e.attrs.id.startsWith("s4-fx-2-"), e.attrs.id);
    fx.update(AT - 0.2);
    const root = layer.children[0];
    assert.equal(root.getAttribute("opacity"), "0", `${name} root hidden before at`);
  });
}

test("pulse_along exposes anchor(t) named pulse that travels the path", () => {
  const { fx } = mount("pulse_along");
  assert.equal(typeof fx.anchor, "function");
  assert.equal(fx.anchors.pulse, fx.anchor);
  assert.deepEqual(fx.anchor(0), PATH[0]);
  assert.deepEqual(fx.anchor(AT), PATH[0]);
  const end = fx.anchor(AT + 2);
  assert.ok(Math.abs(end.x - PATH[3].x) < 1e-6 && Math.abs(end.y - PATH[3].y) < 1e-6);
  let prev = -1;
  for (let t = AT; t <= AT + 2; t += 0.1) { const p = fx.anchor(t); assert.ok(p.x >= prev - 1e-9); prev = p.x; }
  // a speed instead of a duration
  const s = mount("pulse_along", "s1-fx-1", { at: 0, path: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], speed: 500 }).fx;
  assert.ok(Math.abs(s.anchor(1).x - 500) < 1e-6);
  // the pulse head is inside its box
  const b = fx.box(AT + 1), p = fx.anchor(AT + 1);
  assert.ok(p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height);
});

test("effects refuse missing or bad params with a clear message", () => {
  const doc = fakeDocument(), layer = doc.createElementNS("svg", "svg");
  assert.throws(() => K.effects.burst(layer, { at: 1 }, "p"), /^Error: effect burst: needs a numeric x and y$/);
  assert.throws(() => K.effects.pulse_along(layer, { at: 1, path: [{ x: 0, y: 0 }] }, "p"), /^Error: effect pulse_along: needs a path of at least 2 points$/);
  assert.throws(() => K.effects.rings(layer, { x: 1, y: 2 }, "p"), /^Error: effect rings: needs a numeric at$/);
  assert.throws(() => K.effects.glow(layer, { at: 0, x: 0, y: 0 }), /^Error: effect glow: needs an idPrefix$/);
});

test("effects.js is offline and deterministic", () => {
  const src = readFileSync(new URL("../src/world/effects.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /https?:\/\//);
  assert.doesNotMatch(src, /Math\.random|Date\.now|setTimeout|setInterval|requestAnimationFrame|innerHTML/);
});
