// Per-composition canvas (vertical short-form, Task 1): HFKit.FORMATS, HFKit.setCanvas and every
// module reading HFKit.CANVAS at mount / call time instead of a 1920 x 1080 cached at load time.
// mountComposition(data) sets the canvas from data.canvas (default 1920 x 1080).
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fakeDocument, all } from "./helpers/fake-dom.js";
import "../src/kit.js";
import "../src/timing.js";
import "../src/presenter/look.js";
import "../src/presenter/motion.js";
import "../src/presenter/poses.js";
import "../src/presenter/parts.js";
import "../src/presenter/figure.js";
import "../src/actor/rig.js";
import "../src/actor/host.js";
import "../src/actor/actor.js";
import "../src/draw.js";
import "../src/world/place.js";
import "../src/world/effects.js";
import "../src/world/overlays.js";
import "../src/world/moves.js";
import "../src/world/insides.js";
import "../src/world/world.js";
import "../src/icons.js";
import "../src/shell.js";
import "../src/stage.js";
import "../src/blocks/kinetic-center-build.js";
import "../src/blocks/transitions.js";
import "../src/scenes/common.js";
import "../src/composition.js";

const K = globalThis.HFKit;
const VERTICAL = { width: 1080, height: 1920 };

afterEach(() => K.setCanvas());

test("FORMATS: vertical 1080 x 1920, landscape 1920 x 1080", () => {
  assert.deepEqual(K.FORMATS, { vertical: { width: 1080, height: 1920 }, landscape: { width: 1920, height: 1080 } });
});

test("setCanvas sets HFKit.CANVAS (fps kept); no argument is the 1920 x 1080 default", () => {
  assert.deepEqual(K.setCanvas(VERTICAL), { width: 1080, height: 1920, fps: 30 });
  assert.deepEqual(K.CANVAS, { width: 1080, height: 1920, fps: 30 });
  assert.equal(K.frames(2.1), 63);
  K.setCanvas();
  assert.deepEqual(K.CANVAS, { width: 1920, height: 1080, fps: 30 });
  K.setCanvas(K.FORMATS.landscape);
  assert.deepEqual(K.CANVAS, { width: 1920, height: 1080, fps: 30 });
});

test("setCanvas refuses sizes that are not positive whole px", () => {
  for (const bad of [{ width: 0, height: 1920 }, { width: 1080 }, { width: 1080.5, height: 1920 }, { width: "1080", height: 1920 }, "vertical"]) {
    assert.throws(() => K.setCanvas(bad), /setCanvas/, JSON.stringify(bad));
  }
  assert.deepEqual(K.CANVAS, { width: 1920, height: 1080, fps: 30 }); // unchanged after a refusal
});

test("setCanvas moves captionTop to the new frame foot", () => {
  assert.equal(K.captionTop(), 1080 - 96 - 226);
  K.setCanvas(VERTICAL);
  assert.equal(K.captionTop(), 1920 - 96 - 226);
});

test("setCanvas changes the shell layout boxes", () => {
  const before = K.layout(undefined, { position: "right", size: "small" });
  K.setCanvas(VERTICAL);
  const L = K.layout(undefined, { position: "right", size: "small" });
  assert.deepEqual(L.canvas, { width: 1080, height: 1920 });
  assert.equal(L.captionTop, 1920 - 96 - 226);
  assert.deepEqual(L.captionBand, { x: 96, y: 1598, width: 1080 - 192, height: 1920 - 1598 });
  const pw = Math.round(1080 * 0.22);
  assert.deepEqual(L.presenterBox, { x: 1080 - 24 - pw, y: 1598 - Math.round(pw * 1.08), width: pw, height: Math.round(pw * 1.08) });
  assert.equal(L.content.x, 96);
  assert.equal(L.content.width, L.presenterBox.x - 40 - 96);
  assert.equal(L.content.height, 1598 - 96);
  const none = K.layout();
  assert.deepEqual(none.content, { x: 96, y: 96, width: 1080 - 192, height: 1598 - 96 });
  const top = K.layout({ captions: { position: "top" } });
  assert.equal(top.captionTop, 1920 - 96);
  assert.equal(top.captionBand.width, 1080 - 192);
  assert.deepEqual(K.kitFrame(), { origin: { x: 0, y: 0, width: 1080, height: 1920 }, center: { x: 540, y: 960 }, scale: 1 });
  // and back: the landscape boxes are what they were
  K.setCanvas();
  assert.deepEqual(K.layout(undefined, { position: "right", size: "small" }), before);
});

test("the shell element and its layers take the canvas size", () => {
  K.setCanvas(VERTICAL);
  const doc = fakeDocument(), el = doc.createElement("div");
  const sh = K.shell(el, {});
  assert.equal(el.style.width, "1080px");
  assert.equal(el.style.height, "1920px");
  for (const k of ["stage", "overlay"]) {
    assert.equal(sh.layers[k].style.width, "1080px", k);
    assert.equal(sh.layers[k].style.height, "1920px", k);
  }
  assert.equal(sh.layers.captions.style.top, "1598px");
});

test("world camera maths centre on the canvas", () => {
  const cam = { x: 2000, y: 1000, zoom: 1 };
  assert.deepEqual(K.worldMath.toScreen({ x: 2000, y: 1000 }, cam), { x: 960, y: 540 });
  assert.deepEqual(K.place.toScreen({ x: 2000, y: 1000 }, cam), { x: 960, y: 540 });
  K.setCanvas(VERTICAL);
  assert.deepEqual(K.worldMath.toScreen({ x: 2000, y: 1000 }, cam), { x: 540, y: 960 });
  assert.deepEqual(K.worldMath.unproject({ x: 540, y: 960 }, cam), { x: 2000, y: 1000 });
  assert.deepEqual(K.place.toScreen({ x: 2000, y: 1000 }, cam), { x: 540, y: 960 });
  assert.match(K.place.layerTransform(cam, 1), /^translate\(540px,960px\)/);
  assert.deepEqual(K.place.FRAME, { width: 1080, height: 1920, fps: 30 });
  // a tall frame shows more world height: the focus clamp keeps the view inside 3840 x 2160
  assert.equal(K.worldMath.clampFocus({ x: 100, y: 100 }, 1).x, 540);
  assert.equal(K.worldMath.clampFocus({ x: 100, y: 100 }, 1).y, 960);
});

test("overlays keep inside the canvas safe frame", () => {
  K.setCanvas(VERTICAL);
  const doc = fakeDocument(), el = doc.createElement("div");
  const tag = K.overlays.tag(el, { text: "343 m/s", at: 0 }, "t1");
  const L = tag.update(1, { x: 1060, y: 1800 }); // near the bottom-right corner of the tall frame
  assert.ok(L.x + L.width <= 1080 - 96 + 0.01, JSON.stringify(L));
  assert.ok(L.y + L.height <= 1920 - 96 + 0.01, JSON.stringify(L));
  assert.ok(L.y > 1080, "a point low in the tall frame keeps its tag low: " + JSON.stringify(L));
  const svg = all(el).find((e) => e.tagName === "svg");
  assert.equal(svg.attrs.viewBox, "0 0 1080 1920");
  // a point 1500 px down is inside a vertical frame (no chevron), outside a landscape one
  assert.equal(tag.update(1, { x: 500, y: 1500 }).outside, false);
  K.setCanvas();
  const tag2 = K.overlays.tag(el, { text: "343 m/s", at: 0 }, "t2");
  assert.equal(tag2.update(1, { x: 500, y: 1500 }).outside, true);
});

test("the presenter box follows the canvas width", () => {
  assert.equal(K.presenter.presenterSize("small").width, Math.round(1920 * 0.22));
  K.setCanvas(VERTICAL);
  assert.equal(K.presenter.presenterSize("small").width, Math.round(1080 * 0.22));
});

/* The fake DOM refuses innerHTML (the insides write their frames with it): keep it as a string. */
function htmlDocument() {
  const doc = fakeDocument(), mk = doc.createElementNS;
  doc.createElementNS = (ns, tag) => {
    const e = mk(ns, tag);
    let html = "";
    Object.defineProperty(e, "innerHTML", { get: () => html, set: (v) => { html = String(v); } });
    return e;
  };
  doc.createElement = (tag) => doc.createElementNS(null, tag);
  return doc;
}

test("inside views cover a tall canvas (centred, cropped at the sides); landscape is unchanged", () => {
  const doc = htmlDocument();
  const flat = doc.createElement("div");
  K.insides.lattice.mount(flat, { params: { state: "solid" }, idPrefix: "a", seed: 1 });
  const svgL = all(flat).find((e) => e.tagName === "svg");
  assert.equal(svgL.attrs.width, "1920");
  assert.equal(svgL.attrs.height, "1080");
  assert.equal(svgL.attrs.preserveAspectRatio, undefined);
  K.setCanvas(VERTICAL);
  const tall = doc.createElement("div");
  K.insides.lattice.mount(tall, { params: { state: "solid" }, idPrefix: "b", seed: 1 });
  const svgV = all(tall).find((e) => e.tagName === "svg");
  assert.equal(svgV.attrs.width, "1080");
  assert.equal(svgV.attrs.height, "1920");
  assert.equal(svgV.attrs.viewBox, "0 0 1920 1080");
  assert.equal(svgV.attrs.preserveAspectRatio, "xMidYMid slice");
});

test("mountComposition sets the canvas from data.canvas, and the default without one", () => {
  const doc = fakeDocument();
  globalThis.gsap = { timeline: () => ({ eventCallback() {}, set() {}, time: () => 0 }) };
  try {
    K.mountComposition({ fps: 30, total: 1, canvas: { width: 1080, height: 1920 }, scenes: [] }, { document: doc });
    assert.deepEqual(K.CANVAS, { width: 1080, height: 1920, fps: 30 });
    K.mountComposition({ fps: 30, total: 1, scenes: [] }, { document: doc });
    assert.deepEqual(K.CANVAS, { width: 1920, height: 1080, fps: 30 });
  } finally {
    delete globalThis.gsap;
  }
});

test("a mounted scene element takes the canvas size", () => {
  const doc = fakeDocument();
  const clip = doc.createElement("div");
  doc.getElementById = (id) => (id === "scene-1" ? clip : null);
  globalThis.gsap = { timeline: () => ({ eventCallback() {}, set() {}, time: () => 0 }) };
  const errors = [], orig = console.error;
  console.error = (m) => errors.push(m);
  try {
    // an unknown kit scene fails to mount (reported), but the scene element is sized first
    K.mountComposition({ fps: 30, total: 1, canvas: { width: 1080, height: 1920 },
      scenes: [{ id: 1, kind: "kit", scene: "nope", start: 0, duration: 1, words: [], cues: [], camera: [] }] }, { document: doc });
    const el = clip.children[0];
    assert.match(el.style.cssText, /width:1080px;height:1920px/);
    assert.equal(errors.length, 1);
  } finally {
    console.error = orig;
    delete globalThis.gsap;
  }
});


test("HFKit.VERTICAL pins the vertical zones (owner 2026-11-25: host bigger, captions above his face)", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(globalThis.HFKit.VERTICAL)), {
    captionBand: { top: 840, bottom: 1020 }, faceZone: { top: 1060, bottom: 1400 }, safe: { x0: 64, x1: 940, y0: 200, y1: 1420 } });
  assert.ok(globalThis.HFKit.VERTICAL.captionBand.bottom + 40 <= globalThis.HFKit.VERTICAL.faceZone.top, "40 px gap above the face zone");
});
