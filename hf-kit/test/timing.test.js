import { test } from "node:test";
import assert from "node:assert/strict";
import "../src/kit.js";
import "../src/timing.js";

const T = globalThis.HFKitTiming;
const { wordTime, cameraAt, cueState, captionPage, resolveCamera, cameraSchedule, cameraOverrun } = T;

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

function sweep(keys, anchors, to, dt = 0.001) {
  let prev = cameraAt(keys, 0, anchors, LIM);
  let maxPan = 0, maxDz = 0, last = prev;
  for (let t = dt; t < to; t += dt) {
    const c = cameraAt(keys, t, anchors, LIM);
    maxPan = Math.max(maxPan, (Math.hypot(c.x - prev.x, c.y - prev.y) * Math.max(c.zoom, prev.zoom)) / dt);
    maxDz = Math.max(maxDz, Math.abs(c.zoom - prev.zoom) / dt);
    prev = last = c;
  }
  return { maxPan, maxDz, last };
}

test("follow: fast anchor (1 unit/s) never exceeds the pan limit or jumps, in transition and hold", () => {
  const anchors = { run: (t) => ({ x: 0.5 + t, y: 0.5 }) };
  const keys = [{ t: 0, frame: "wide" }, { t: 1, frame: { follow: "run", zoom: 1.5 } }];
  const r = sweep(keys, anchors, 30);
  assert.ok(r.maxPan <= LIM.maxPanPerSec * 1.01, `pan ${r.maxPan}`);
  assert.ok(r.maxDz <= LIM.maxZoomPerSec * 1.01);
  assert.ok(r.maxPan > LIM.maxPanPerSec * 0.9, "holds full speed while lagging");
  assert.ok(Math.abs(r.last.zoom - 1.5) < 1e-9);
});

test("follow: fast anchor on the very first key is slew-limited too", () => {
  const anchors = { run: (t) => ({ x: 0.2 + 0.5 * t, y: 0.5 }) };
  const r = sweep([{ t: 0, frame: { follow: "run" } }], anchors, 10);
  assert.ok(r.maxPan <= LIM.maxPanPerSec * 1.01);
});

test("follow: a slow anchor is tracked closely", () => {
  const anchors = { tip: (t) => ({ x: 0.3 + 0.02 * t, y: 0.4 + 0.01 * t }) };
  const keys = [{ t: 0, frame: "wide" }, { t: 3, frame: { follow: "tip", zoom: 1.4 } }];
  for (const t of [20, 25, 30]) {
    const c = cameraAt(keys, t, anchors, LIM);
    const a = anchors.tip(t);
    assert.ok(Math.hypot(c.x - a.x, c.y - a.y) < 1e-3, `at ${t}`);
  }
  const r = sweep(keys, anchors, 30);
  assert.ok(r.maxPan <= LIM.maxPanPerSec * 1.01);
});

test("follow: leaving a follow key to a static focus obeys the limit", () => {
  const anchors = { run: (t) => ({ x: 0.5 + 0.3 * t, y: 0.5 }), home: { x: 0.1, y: 0.9 } };
  const keys = [{ t: 0, frame: "wide" }, { t: 2, frame: { follow: "run", zoom: 2 } }, { t: 6, frame: { focus: "home", zoom: 1.2 } }];
  const r = sweep(keys, anchors, 60);
  assert.ok(r.maxPan <= LIM.maxPanPerSec * 1.01);
  assert.ok(r.maxDz <= LIM.maxZoomPerSec * 1.01);
  assert.ok(Math.abs(r.last.x - 0.1) < 1e-6 && Math.abs(r.last.y - 0.9) < 1e-6);
});

test("cameraAt: stretch driven by pan (small zoom change) obeys the limit", () => {
  const anchors = { far: { x: 0.95, y: 0.05 } };
  const keys = [{ t: 0, frame: "wide" }, { t: 0.1, frame: { focus: "far", zoom: 1.2 } }];
  const sched = cameraSchedule(keys, anchors, LIM);
  assert.ok(sched[0].end > 6, `pan-stretched end ${sched[0].end}`);
  const r = sweep(keys, anchors, 10);
  assert.ok(r.maxPan <= LIM.maxPanPerSec * 1.01);
  assert.ok(r.maxPan > LIM.maxPanPerSec * 0.8, "pan is the binding limit");
});

test("cameraSchedule: effective, chained move times", () => {
  const anchors = { a: { x: 0.9, y: 0.1 }, b: { x: 0.2, y: 0.2 } };
  const keys = [
    { t: 0, frame: "wide" },
    { t: 0.1, frame: { focus: "a", zoom: 2.5 } },
    { t: 0.2, frame: { focus: "b", zoom: 1.5 } },
  ];
  const s = cameraSchedule(keys, anchors, LIM);
  assert.equal(s.length, 2);
  assert.equal(s[0].start, 0);
  assert.ok(s[0].end >= 7.5 - 1e-9);
  assert.equal(s[1].start, s[0].end);
  assert.ok(s[1].end > s[1].start);
  assert.deepEqual(cameraSchedule([], {}, LIM), []);
  assert.deepEqual(cameraSchedule([keys[0]], {}, LIM), []);
});

test("cameraSchedule: a calm move keeps its nominal times", () => {
  const anchors = { c: { x: 0.4, y: 0.5 } };
  const s = cameraSchedule([{ t: 1, frame: "wide" }, { t: 9, frame: { focus: "c", zoom: 1.5 } }], anchors, LIM);
  assert.deepEqual(s, [{ start: 1, end: 9 }]);
});

test("cameraOverrun: seconds past the scene end, 0 if none", () => {
  const anchors = { a: { x: 0.9, y: 0.1 } };
  const keys = [{ t: 0, frame: "wide" }, { t: 0.1, frame: { focus: "a", zoom: 2.5 } }];
  const end = cameraSchedule(keys, anchors, LIM)[0].end;
  assert.ok(Math.abs(cameraOverrun(keys, anchors, LIM, 5) - (end - 5)) < 1e-9);
  assert.equal(cameraOverrun(keys, anchors, LIM, end + 1), 0);
  assert.equal(cameraOverrun([], anchors, LIM, 5), 0);
});

test("resolveCamera: sorts stably and validates", () => {
  const r = resolveCamera([
    { at: { t: 3 }, frame: "wide" },
    { at: { word: 0 }, frame: { focus: "a", zoom: 2 } },
    { at: { t: 3 }, frame: { follow: "b" } },
  ], words, 1);
  assert.deepEqual(r.map((k) => k.t), [0.12, 3, 3]);
  assert.equal(r[1].frame, "wide"); // stable among equal times
  assert.throws(() => resolveCamera([{ at: { t: 0 }, frame: "wide" }, { at: { t: 1 }, frame: { zoom: 2 } }], words, 5),
    { message: /^scene 5: camera key 1 / });
  assert.throws(() => resolveCamera([{ at: { t: 0 }, frame: "close" }], words, 5), { message: /^scene 5: camera key 0 / });
  assert.throws(() => resolveCamera([{ at: { t: 0 }, frame: { focus: "nope", zoom: 2 } }], words, 5, { a: { x: 0, y: 0 } }),
    { message: /^scene 5: camera key 0 .*nope/ });
});

test("HFKit re-exports timing in both load orders", async () => {
  const saved = [globalThis.HFKit, globalThis.HFKitTiming];
  try {
    for (const order of [["kit", "timing"], ["timing", "kit"]]) {
      delete globalThis.HFKit;
      delete globalThis.HFKitTiming;
      for (const m of order) await import(`../src/${m}.js?order=${order.join("-")}`);
      for (const name of ["wordTime", "cameraAt", "cueState", "captionPage", "cameraSchedule", "cameraOverrun"]) {
        assert.equal(typeof globalThis.HFKit[name], "function", `${order} ${name}`);
        assert.equal(globalThis.HFKit[name], globalThis.HFKitTiming[name]);
      }
    }
  } finally {
    [globalThis.HFKit, globalThis.HFKitTiming] = saved;
  }
});

// ---- world camera (Task 4): zoom 0.6x-5x, cuts, overrun of a lagging follow ----------------

const WL = globalThis.HFKitTiming.WORLD_LIMITS;

const LN_RATE = Math.log(1.6);
/* peak |d ln z / dt| over a sweep */
function logZoomRate(keys, anchors, to, dt = 0.002) {
  let prev = cameraAt(keys, 0, anchors, WL), max = 0;
  for (let t = dt; t < to; t += dt) { const c = cameraAt(keys, t, anchors, WL); max = Math.max(max, Math.abs(Math.log(c.zoom) - Math.log(prev.zoom)) / dt); prev = c; }
  return { max, last: prev };
}

test("WORLD_LIMITS: zoom 0.6x-5x, the kit pan limit, a multiplicative zoom rate of at most 1.6x per second", () => {
  assert.equal(globalThis.HFKit.WORLD_LIMITS, WL);
  assert.equal(WL.minZoom, 0.6);
  assert.equal(WL.maxZoom, 5);
  assert.equal(WL.maxPanPerSec, LIM.maxPanPerSec, "keeps the existing pan limit");
  assert.equal(WL.zoomMode, "log");
  assert.ok(WL.maxZoomPerSec > 1 && WL.maxZoomPerSec <= 1.6, `zoom rate ${WL.maxZoomPerSec}`);
  // the kit default is unchanged (schema-1 scenes keep their calm camera)
  assert.deepEqual(globalThis.HFKitTiming.CAMERA_LIMITS, { maxZoom: 2.5, maxPanPerSec: 0.35, maxZoomPerSec: 0.6 });
});

test("world camera: zoom 6 is clamped to 5, zoom 0.3 to 0.6; the kit camera still never goes below 1", () => {
  const anchors = { a: { x: 0.5, y: 0.5 } };
  const k6 = [{ t: 0, frame: { focus: "a", zoom: 6 } }];
  assert.equal(cameraAt(k6, 1, anchors, WL).zoom, 5);
  assert.equal(cameraAt([{ t: 0, frame: { focus: "a", zoom: 0.3 } }], 1, anchors, WL).zoom, 0.6);
  assert.equal(cameraAt([{ t: 0, frame: { focus: "a", zoom: 0.3 } }], 1, anchors, LIM).zoom, 1);
  // a pull-out to 0.6 and a push-in to 5 obey the multiplicative rate and never jump
  const keys = [{ t: 0, frame: "wide" }, { t: 1, frame: { focus: "a", zoom: 0.6 } }, { t: 2, frame: { focus: "a", zoom: 5 } }];
  const r = logZoomRate(keys, anchors, 25);
  assert.ok(r.max <= LN_RATE * 1.01, `|d ln z/dt| ${r.max}`);
  assert.ok(r.max > LN_RATE * 0.9, "the rate is the binding limit");
  assert.ok(Math.abs(r.last.zoom - 5) < 1e-9);
});

test("world camera: a 0.6x -> 1.2x move doubles the zoom no faster than 1.6x per second (and the kit rate is still additive)", () => {
  const anchors = { a: { x: 0.5, y: 0.5 } };
  const keys = [{ t: 0, frame: { focus: "a", zoom: 0.6 } }, { t: 0.5, frame: { focus: "a", zoom: 1.2 } }];
  const r = logZoomRate(keys, anchors, 8, 0.001);
  assert.ok(r.max <= LN_RATE * 1.01, `|d ln z/dt| ${r.max}`);
  assert.ok(Math.abs(r.last.zoom - 1.2) < 1e-9);
  const end = cameraSchedule(keys, anchors, WL)[0].end;
  assert.ok(Math.abs(end - 3 * Math.log(2) / LN_RATE) < 1e-9, "stretched to 3 ln 2 / ln 1.6 s: " + end);
  // a follow that zooms is held to the same rate
  const mv = { m: (t) => ({ x: 0.4 + 0.005 * t, y: 0.5 }) };
  const f = logZoomRate([{ t: 0, frame: { focus: "m", zoom: 0.6 } }, { t: 1, frame: { follow: "m", zoom: 1.2 } }], mv, 10);
  assert.ok(f.max <= LN_RATE * 1.01, `follow |d ln z/dt| ${f.max}`);
});

test("world camera: zoom 5 following a moving anchor stays within the pan limit; its overrun is reported", () => {
  // a slow target (world-normalised 0.02/s): the follower keeps up, no overrun
  const slow = { run: (t) => ({ x: 0.3 + 0.02 * t, y: 0.5 }) };
  const keys = [{ t: 0, frame: "wide" }, { t: 1, frame: { follow: "run", zoom: 5 } }];
  let prev = cameraAt(keys, 0, slow, WL), maxPan = 0;
  const dt = 0.002;
  for (let t = dt; t < 12; t += dt) {
    const c = cameraAt(keys, t, slow, WL);
    maxPan = Math.max(maxPan, (Math.hypot(c.x - prev.x, c.y - prev.y) * Math.max(c.zoom, prev.zoom)) / dt);
    assert.ok(Math.abs(Math.log(c.zoom) - Math.log(prev.zoom)) / dt <= LN_RATE * 1.01);
    prev = c;
  }
  assert.ok(maxPan <= WL.maxPanPerSec * 1.01, `pan ${maxPan}`);
  // the 1x -> 5x push-in takes 3 ln 5 / ln 1.6 = 10.3 s, so a 12 s scene has no overrun
  assert.ok(cameraOverrun(keys, slow, WL, 12) <= 0.25, "slow target: overrun " + cameraOverrun(keys, slow, WL, 12));
  assert.ok(cameraOverrun(keys, slow, WL, 6) > 0.25, "a zoom that cannot finish in the scene is reported");
  // a fast target (0.2/s at zoom 5 = 1 frame width per second): the camera lags, and the lag is
  // reported as an overrun (> 0.25 s), never hidden by a pan faster than the limit
  const fast = { run: (t) => ({ x: 0.2 + 0.2 * t, y: 0.5 }) };
  const at5 = [{ t: 0, frame: { follow: "run", zoom: 5 } }]; // already at 5x: only the lag can overrun
  assert.deepEqual(cameraSchedule(at5, fast, WL), []);
  const over = cameraOverrun(at5, fast, WL, 4);
  assert.ok(over > 0.25, "fast target overrun " + over);
  assert.ok(cameraOverrun(at5, slow, WL, 4) <= 0.25, "slow target at 5x keeps up");
  prev = cameraAt(at5, 0, fast, WL); maxPan = 0;
  for (let t = dt; t < 4; t += dt) {
    const c = cameraAt(at5, t, fast, WL);
    maxPan = Math.max(maxPan, (Math.hypot(c.x - prev.x, c.y - prev.y) * Math.max(c.zoom, prev.zoom)) / dt);
    prev = c;
  }
  assert.ok(maxPan <= WL.maxPanPerSec * 1.01, `pan ${maxPan}`);
});

test("resolveCamera accepts {t, frame, cut:true}; a cut changes the view within one frame, no slew, no overrun", () => {
  const anchors = { a: { x: 0.2, y: 0.3 }, b: { x: 0.85, y: 0.7 } };
  const keys = resolveCamera([
    { t: 0, frame: { focus: "a", zoom: 2 } },
    { at: { t: 2 }, frame: { focus: "b", zoom: 4 }, cut: true },
  ], words, 3, anchors);
  assert.deepEqual(keys, [{ t: 0, frame: { focus: "a", zoom: 2 } }, { t: 2, frame: { focus: "b", zoom: 4 }, cut: true }]);
  const before = cameraAt(keys, 2 - 1 / 30, anchors, WL), after = cameraAt(keys, 2, anchors, WL);
  assert.ok(Math.abs(before.x - 0.2) < 1e-9 && before.zoom === 2, "holds until the cut");
  assert.deepEqual(after, { x: 0.85, y: 0.7, zoom: 4 }, "snaps at the cut");
  assert.equal(cameraOverrun(keys, anchors, WL, 2), 0);
  assert.deepEqual(cameraSchedule(keys, anchors, WL), [{ start: 2, end: 2 }]);
  // a cut interrupts a move still running, and later moves chain from the cut
  const k2 = resolveCamera([
    { t: 0, frame: "wide" },
    { t: 0.2, frame: { focus: "a", zoom: 5 } }, // stretched far past t = 1
    { t: 1, frame: { focus: "b", zoom: 1.5 }, cut: true },
    { t: 4, frame: { focus: "b", zoom: 2 } },
  ], words, 3, anchors);
  assert.deepEqual(cameraAt(k2, 1, anchors, WL), { x: 0.85, y: 0.7, zoom: 1.5 });
  assert.ok(Math.abs(cameraAt(k2, 30, anchors, WL).zoom - 2) < 1e-9);
  const s = cameraSchedule(k2, anchors, WL);
  assert.ok(s[0].end <= 1 + 1e-9, "the interrupted move ends at the cut");
  assert.deepEqual(s[1], { start: 1, end: 1 });
  // a cut onto a moving anchor lands on it and then follows
  const mv = { m: (t) => ({ x: 0.4 + 0.01 * t, y: 0.5 }) };
  const k3 = [{ t: 0, frame: "wide" }, { t: 3, frame: { follow: "m", zoom: 3 }, cut: true }];
  const c3 = cameraAt(k3, 3, mv, WL);
  assert.ok(Math.abs(c3.x - 0.43) < 1e-9 && c3.zoom === 3);
  assert.ok(Math.abs(cameraAt(k3, 5, mv, WL).x - 0.45) < 1e-6);
  assert.throws(() => resolveCamera([{ t: 0, frame: "wide", cut: "yes" }], words, 3), { message: /^scene 3: camera key 0 .*cut/ });
});
