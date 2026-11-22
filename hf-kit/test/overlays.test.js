// Data overlays (src/world/overlays.js): tags that follow a world point and labels. Review Focus 3:
// a tag whose point leaves the frame is clamped to the frame edge (safe 96 px) while the point is
// less than 200 px outside, then it fades out; it is never drawn half off the frame.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/kit.js";
import "../src/draw.js";
import "../src/world/overlays.js";
import { fakeDocument, serialize } from "./helpers/fake-dom.js";

const K = globalThis.HFKit;
const O = K.overlays;

function mount(kind, opts, prefix = "s1-tag-0") {
  const doc = fakeDocument();
  const el = doc.createElement("div");
  return { el, o: O[kind](el, opts, prefix) };
}
const inside = (b, edge = 96) => b.x >= edge - 1e-6 && b.y >= edge - 1e-6 && b.x + b.width <= 1920 - edge + 1e-6 && b.y + b.height <= 1080 - edge + 1e-6;

test("overlays.js is a kit script after draw.js", () => {
  assert.ok(K.SCRIPTS.indexOf("src/world/overlays.js") > K.SCRIPTS.indexOf("src/draw.js"));
  assert.equal(typeof O.tag, "function");
  assert.equal(typeof O.label, "function");
});

test("Review Focus 3: a tag at (2100, 500) is clamped to x <= 1824; at (2400, 500) it is hidden", () => {
  const { o } = mount("tag", { text: "343 m/s", target: "pulse" });
  const s1 = o.update(3, { x: 2100, y: 500 });
  const b1 = o.box(3);
  assert.ok(b1.x + b1.width <= 1824 + 1e-6, JSON.stringify(b1));
  assert.ok(s1.opacity > 0.5 && s1.clamped, JSON.stringify(s1));
  assert.ok(inside(b1));
  const s2 = o.update(3, { x: 2400, y: 500 });
  assert.equal(s2.opacity, 0);
  assert.deepEqual([o.box(3).width, o.box(3).height], [0, 0], "a hidden tag has an empty box");
});

test("a tag inside the frame sits by its point, unclamped, with its leader to the point", () => {
  const { o } = mount("tag", { text: "hot rock", target: "lava" });
  const s = o.update(2, { x: 1000, y: 600 });
  const b = o.box(2);
  assert.equal(s.clamped, false);
  assert.equal(s.opacity, 1);
  assert.ok(Math.abs(b.x + b.width / 2 - 1000) < 1, "centred above the point");
  assert.ok(b.y + b.height < 600, "above the point");
  assert.deepEqual(s.point, { x: 1000, y: 600 });
});

test("a tag is never drawn half off the frame, for points all around and outside it", () => {
  const { o } = mount("tag", { text: "Speed of sound", target: "pulse" });
  for (let x = -400; x <= 2320; x += 40) for (let y = -300; y <= 1380; y += 60) {
    const s = o.update(4, { x, y });
    if (s.opacity > 0) assert.ok(inside(o.box(4)), `point ${x},${y}: ${JSON.stringify(o.box(4))}`);
    const out = Math.max(0, -x, x - 1920, -y, y - 1080);
    if (out < 200) assert.ok(s.opacity > 0.99, `visible while < 200 px out (${x},${y})`);
    if (out >= 280) assert.equal(s.opacity, 0, `hidden far outside (${x},${y})`);
  }
  // a point near the top puts the tag below it
  o.update(4, { x: 900, y: 120 });
  assert.ok(o.box(4).y > 120 - 1e-6 || inside(o.box(4)));
});

test("tag and label: fade in at `at`, out after `until`; deterministic", () => {
  const { o, el } = mount("tag", { text: "Big", target: "a", at: 1, until: 3 });
  assert.equal(o.update(0.5, { x: 900, y: 500 }).opacity, 0);
  assert.ok(o.update(1.1, { x: 900, y: 500 }).opacity > 0 && o.update(1.1, { x: 900, y: 500 }).opacity < 1);
  assert.equal(o.update(2, { x: 900, y: 500 }).opacity, 1);
  assert.equal(o.update(3.6, { x: 900, y: 500 }).opacity, 0);
  const b = mount("tag", { text: "Big", target: "a", at: 1, until: 3 });
  for (const t of [0.2, 1.1, 2, 3.1]) { o.update(t, { x: 1700, y: 900 }); b.o.update(t, { x: 1700, y: 900 }); assert.equal(serialize(el), serialize(b.el)); }
  const L = mount("label", { text: "magma chamber", target: "chamber" }, "s1-label-0");
  const ls = L.o.update(2, { x: 960, y: 700 });
  assert.equal(ls.opacity, 1);
  const lb = L.o.update(2, { x: 1990, y: 700 }) && L.o.box(2);
  assert.ok(inside(lb), JSON.stringify(lb));
  assert.equal(L.o.update(2, { x: 2400, y: 700 }).opacity, 0);
});

test("tags and labels: at most 4 words (a number and its unit count as one)", () => {
  assert.equal(O.countWords("343 m/s"), 1);
  assert.equal(O.countWords("Sound at 343 m/s"), 3);
  assert.equal(O.countWords("1,200 km per hour"), 3);
  assert.equal(O.countWords("  the   magma chamber "), 3);
  assert.throws(() => mount("tag", { text: "this is far too long", target: "a" }), /^Error: tag "this is far too long": 5 words \(at most 4\)$/);
  assert.throws(() => mount("label", { text: "one two three four five", target: "a" }), /^Error: label "one two three four five": 5 words \(at most 4\)$/);
  assert.throws(() => mount("tag", { text: "", target: "a" }), /needs text/);
  mount("tag", { text: "Sound at 343 m/s", target: "a" });
});

test("overlays.js is offline and deterministic", () => {
  const src = readFileSync(new URL("../src/world/overlays.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /https?:\/\//);
  assert.doesNotMatch(src, /Math\.random|Date\.now|setTimeout|setInterval|requestAnimationFrame/);
});
