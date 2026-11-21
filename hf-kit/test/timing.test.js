import { test } from "node:test";
import assert from "node:assert/strict";
import "../src/kit.js";
import "../src/timing.js";

const T = globalThis.HFKitTiming;
const { wordTime, cameraAt, cueState, captionPage, resolveCamera } = T;

const words = [
  { i: 0, text: "Deep", start: 0.12, end: 0.38 },
  { i: 1, text: "under", start: 0.4, end: 0.61 },
  { i: 2, text: "the", start: 0.7, end: 0.8 },
  { i: 3, text: "under", start: 1.5, end: 1.9 },
];
const LIM = { maxZoom: 2.5, maxPanPerSec: 0.35, maxZoomPerSec: 0.6 };

test("kit.js re-exports the timing functions", () => {
  assert.equal(globalThis.HFKit.wordTime, wordTime);
  assert.equal(globalThis.HFKit.cameraAt, cameraAt);
});

test("wordTime: word index and absolute time", () => {
  assert.ok(Math.abs(wordTime(words, { word: 1 }) - 0.4) < 0.01);
  assert.equal(wordTime(words, { word: 3 }), 1.5); // repeated text, index honoured
  assert.equal(wordTime(words, { t: 2.25 }), 2.25);
});

test("wordTime: missing word throws with scene id", () => {
  assert.throws(() => wordTime(words, { word: 9 }, 4), { message: "scene 4: no word 9" });
});

test("cueState: starts at the word, ramps 0.25 s, stays visible", () => {
  const cues = [{ at: { word: 3 }, show: "label", target: "chamber" }];
  assert.deepEqual(cueState(cues, words, 1.49), []);
  const a = cueState(cues, words, 1.5);
  assert.equal(a.length, 1);
  assert.equal(a[0].target, "chamber");
  assert.equal(a[0].opacity, 0);
  const b = cueState(cues, words, 1.625);
  assert.ok(Math.abs(b[0].opacity - 0.5) < 1e-9 && Math.abs(b[0].progress - 0.5) < 1e-9);
  const c = cueState(cues, words, 99);
  assert.equal(c[0].opacity, 1);
  assert.equal(c[0].progress, 1);
});

test("cueState: until fades out over 0.25 s", () => {
  const cues = [{ at: { word: 0 }, until: { word: 2 }, target: "x" }];
  assert.equal(cueState(cues, words, 0.69)[0].opacity, 1);
  assert.ok(Math.abs(cueState(cues, words, 0.825)[0].opacity - 0.5) < 1e-9);
  assert.equal(cueState(cues, words, 1.0)[0].opacity, 0);
});

test("cueState: missing word throws with scene id", () => {
  assert.throws(() => cueState([{ at: { word: 7 } }], words, 1, 2), { message: "scene 2: no word 7" });
});

test("cameraAt: holds wide, reaches focus, no keys = wide", () => {
  const anchors = { chamber: { x: 0.3, y: 0.7 } };
  const keys = [
    { t: 0, frame: "wide" },
    { t: 10, frame: { focus: "chamber", zoom: 1.8 } },
  ];
  assert.deepEqual(cameraAt([], 3, anchors, LIM), { x: 0.5, y: 0.5, zoom: 1 });
  assert.deepEqual(cameraAt(keys, -1, anchors, LIM), { x: 0.5, y: 0.5, zoom: 1 });
  const end = cameraAt(keys, 100, anchors, LIM);
  assert.ok(Math.abs(end.x - 0.3) < 1e-9 && Math.abs(end.y - 0.7) < 1e-9 && Math.abs(end.zoom - 1.8) < 1e-9);
  const mid = cameraAt(keys, 5, anchors, LIM);
  assert.ok(Math.abs(mid.zoom - 1.4) < 1e-9); // easeInOutCubic(0.5) = 0.5
});

test("cameraAt: pathological wide -> zoom 2.5 in 0.1 s never exceeds limits, never jumps", () => {
  const anchors = { a: { x: 0.9, y: 0.1 } };
  const keys = [
    { t: 0, frame: "wide" },
    { t: 0.1, frame: { focus: "a", zoom: 2.5 } },
  ];
  const dt = 0.001;
  let prev = cameraAt(keys, 0, anchors, LIM);
  let ended = false;
  for (let t = dt; t < 30; t += dt) {
    const c = cameraAt(keys, t, anchors, LIM);
    const dz = Math.abs(c.zoom - prev.zoom) / dt;
    const pan = (Math.hypot(c.x - prev.x, c.y - prev.y) * Math.max(c.zoom, prev.zoom)) / dt;
    assert.ok(dz <= LIM.maxZoomPerSec * 1.01, `zoom speed ${dz} at ${t}`);
    assert.ok(pan <= LIM.maxPanPerSec * 1.01, `pan speed ${pan} at ${t}`);
    assert.ok(c.zoom <= LIM.maxZoom + 1e-9);
    prev = c;
    ended = Math.abs(c.zoom - 2.5) < 1e-6;
  }
  assert.ok(ended, "move completes, just later");
  assert.ok(cameraAt(keys, 0.1, anchors, LIM).zoom < 1.1); // not arrived at the nominal end
});

test("cameraAt: a stretched move pushes later keys after it", () => {
  const anchors = { a: { x: 0.9, y: 0.1 }, b: { x: 0.2, y: 0.2 } };
  const keys = [
    { t: 0, frame: "wide" },
    { t: 0.1, frame: { focus: "a", zoom: 2.5 } },
    { t: 0.2, frame: { focus: "b", zoom: 1.5 } },
  ];
  const dt = 0.002;
  let prev = cameraAt(keys, 0, anchors, LIM);
  for (let t = dt; t < 40; t += dt) {
    const c = cameraAt(keys, t, anchors, LIM);
    assert.ok(Math.abs(c.zoom - prev.zoom) / dt <= LIM.maxZoomPerSec * 1.01);
    assert.ok((Math.hypot(c.x - prev.x, c.y - prev.y) * Math.max(c.zoom, prev.zoom)) / dt <= LIM.maxPanPerSec * 1.01);
    prev = c;
  }
  assert.ok(Math.abs(prev.zoom - 1.5) < 1e-6 && Math.abs(prev.x - 0.2) < 1e-6);
});

test("cameraAt: follow tracks a moving anchor", () => {
  const anchors = { tip: (t) => ({ x: 0.2 + 0.01 * t, y: 0.5 }) };
  const keys = [{ t: 0, frame: "wide" }, { t: 20, frame: { follow: "tip" } }];
  const c = cameraAt(keys, 60, anchors, LIM);
  assert.ok(Math.abs(c.x - 0.8) < 1e-9);
});

test("resolveCamera maps at -> t using words", () => {
  const r = resolveCamera([{ at: { word: 2 }, frame: "wide" }, { at: { t: 5 }, frame: "wide" }], words, 1);
  assert.deepEqual(r.map((k) => k.t), [0.7, 5]);
  assert.throws(() => resolveCamera([{ at: { word: 8 }, frame: "wide" }], words, 1), { message: "scene 1: no word 8" });
});

test("captionPage: fixed pages and current word", () => {
  const w = Array.from({ length: 25 }, (_, i) => ({ i, text: "w" + i, start: i, end: i + 0.5 }));
  let p = captionPage(w, -1);
  assert.equal(p.words.length, 10);
  assert.equal(p.words[0].i, 0);
  assert.equal(p.current, -1);
  p = captionPage(w, 9.5);
  assert.equal(p.words[0].i, 0);
  assert.equal(p.current, 9);
  p = captionPage(w, 10);
  assert.equal(p.words[0].i, 10);
  assert.equal(p.current, 0);
  p = captionPage(w, 99);
  assert.equal(p.words.length, 5);
  assert.equal(p.words[0].i, 20);
  assert.equal(p.current, 4);
  assert.equal(captionPage(w, 12, 4).words[0].i, 12);
  assert.deepEqual(captionPage([], 3), { words: [], current: -1 });
});
