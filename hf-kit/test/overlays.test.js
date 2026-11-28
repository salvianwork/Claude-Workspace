// Data overlays (src/world/overlays.js): tags that follow a world point and labels. Review Focus 3:
// a tag whose point leaves the frame is clamped to the frame edge (safe 96 px) while the point is
// less than 200 px outside, then it fades out; it is never drawn half off the frame.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/kit.js";
import "../src/draw.js";
import "../src/timing.js";
import "../src/world/overlays.js";
import "../src/shell.js";
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
  // only real units merge with a number: "2 big dogs ran off" is 5 words
  assert.equal(O.countWords("2 big dogs ran off"), 5);
  assert.throws(() => mount("tag", { text: "2 big dogs ran off", target: "a" }), /5 words \(at most 4\)/);
  assert.equal(O.countWords("≈5,960 m/s fast"), 2);
  mount("tag", { text: "≈5,960 m/s fast", target: "a" });
  for (const u of ["m", "km/h", "°C", "%", "kHz", "dB", "ly", "au", "K"]) assert.equal(O.countWords("12 " + u), 1, u);
  for (const w of ["big", "the", "cat", "M", "kg/day"]) assert.equal(O.countWords("12 " + w), 2, w);
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

// ---- vertical captions (Task 6; Review Focus 3): 64 px, 860 px, 2 lines, in the band ----
const SENTENCE = "The sound of a hammer on a steel rail races ahead of the train because steel carries a wave far faster than air does so a careful listener hears it coming";
const capWords = (text) => text.split(" ").map((w, i) => ({ i, text: w, start: +(0.3 + 0.3 * i).toFixed(2), end: +(0.3 + 0.3 * i + 0.25).toFixed(2) }));

test("Review Focus 3: a long vertical caption pages into pills of at most 2 lines inside 860 px", () => {
  const words = capWords(SENTENCE);
  const pages = K.captionPages(words);
  assert.ok(pages.length >= 3, "a 29-word sentence needs several pages");
  assert.equal(pages.flatMap((p) => p.words).length, words.length, "every word is shown, in order");
  pages.forEach((p, k) => {
    assert.ok(p.lines <= 2, `page ${k}: ${p.lines} lines`);
    assert.ok(p.width <= 860, `page ${k}: ${p.width} px`);
    assert.equal(p.over, false);
  });
  assert.ok(pages[0].words.length >= 4, "pages are not needlessly short");
  assert.equal(K.captionPageAt(pages, words, 0).words[0].i, 0);
  const late = K.captionPageAt(pages, words, words[20].start + 0.01);
  assert.equal(late.words[late.current].i, 20, "the spoken word is the current one");
});

test("a word wider than a caption line is flagged (the build warns); the pill still stays in the band", () => {
  const words = capWords("so supercalifragilisticexpialidocious it is");
  const pages = K.captionPages(words);
  assert.ok(pages.some((p) => p.over), JSON.stringify(pages.map((p) => [p.lines, p.over])));
  assert.ok(pages.every((p) => p.width <= 860));
});

test("vertical mountCaptions: 64 px words, max width 860, word highlight; its box sits in the band and the safe zone", () => {
  K.setCanvas(K.FORMATS.vertical);
  try {
    const doc = fakeDocument(), el = doc.createElement("div");
    const words = capWords(SENTENCE);
    const caps = K.mountCaptions(el, { words });
    caps.update(2.0);
    assert.equal(caps.el.style.fontSize, "64px");
    assert.equal(caps.el.style.maxWidth, "860px");
    const spans = caps.el.children;
    assert.ok(spans.length >= 4 && spans.length < words.length);
    const accent = spans.filter((s) => s.style.color === K.tokens.colors.accent);
    assert.equal(accent.length, 1, "one highlighted word");
    for (let t = 0; t <= words[words.length - 1].end + 1; t += 0.25) {
      const b = caps.box(t);
      if (!(b.width > 0)) continue;
      assert.ok(b.x >= 64 && b.x + b.width <= 940, `t=${t}: x ${b.x}..${b.x + b.width}`);
      assert.ok(b.y >= K.VERTICAL.captionBand.top && b.y + b.height <= K.VERTICAL.captionBand.bottom, `t=${t}: y ${b.y}..${b.y + b.height}`);
    }
    assert.equal(caps.box(0).width, 0, "hidden before the first word");
  } finally { K.setCanvas(null); }
});

test("landscape captions are unchanged (60 px, fixed pages of 7, no box)", () => {
  const doc = fakeDocument(), el = doc.createElement("div");
  const caps = K.mountCaptions(el, { words: capWords(SENTENCE) });
  caps.update(2.0);
  assert.equal(caps.el.style.fontSize, "60px");
  assert.equal(caps.el.style.top, "28px");
  assert.equal(caps.el.children.length, 7);
  assert.equal(caps.box(2).width, 0);
});

test("vertical: tags and labels clamp to the text safe zone (x 64-940, y 200-1420); landscape keeps 96 px", () => {
  K.setCanvas(K.FORMATS.vertical);
  try {
    for (const kind of ["tag", "label"]) {
      const { o } = mount(kind, { text: "Far rail", target: "rail-far" });
      for (const q of [{ x: 1000, y: 700 }, { x: 1060, y: 1300 }, { x: 20, y: 120 }, { x: 540, y: 1900 - 480 }]) {
        const s = o.update(4, q);
        if (!(s.opacity > 0)) continue;
        const b = o.box(4);
        assert.ok(b.x >= 64 - 1e-6 && b.x + b.width <= 940 + 1e-6 && b.y >= 200 - 1e-6 && b.y + b.height <= 1420 + 1e-6, `${kind} at ${q.x},${q.y}: ${JSON.stringify(b)}`);
      }
      assert.ok(o.update(4, { x: 1000, y: 700 }).clamped);
    }
  } finally { K.setCanvas(null); }
  const { o } = mount("tag", { text: "Far rail", target: "rail-far" });
  o.update(4, { x: 1850, y: 500 });
  assert.ok(Math.abs(o.box(4).x + o.box(4).width - 1824) < 1e-6, "landscape: 96 px margin");
});

test("vertical captions swap to the top band (220-400) while the host is away, with a 0.2 s fade and never in both", () => {
  K.setCanvas(K.FORMATS.vertical);
  try {
    const doc = fakeDocument(), el = doc.createElement("div");
    const words = capWords(SENTENCE);
    const T = K.VERTICAL.captionTopBand, B = K.VERTICAL.captionBand;
    assert.deepEqual({ ...T }, { top: 220, bottom: 400 });
    const away = (t) => t >= 3 && t < 5;   // out of the slot from 3.0 s to 5.0 s
    const caps = K.mountCaptions(el, { words, duration: 9, hostAway: away });
    const inBand = (b, band) => b.y >= band.top && b.y + b.height <= band.bottom;
    const at = (t) => { const b = caps.box(t); return { b, op: Number(caps.el.style.opacity) }; };
    assert.ok(inBand(at(2.5).b, B) && at(2.5).op === 1, "down while he is in the slot");
    assert.ok(inBand(at(4).b, T) && at(4).op === 1, "up while he is away");
    assert.ok(inBand(at(6).b, B) && at(6).op === 1, "back down when he returns");
    // the swap at 3.0 s: old band fades out over 0.1 s, then the new band fades in over 0.1 s
    assert.ok(inBand(at(3.04).b, B) && at(3.04).op > 0 && at(3.04).op < 1, "old band fading out");
    assert.ok(at(3.1 + 1 / 60).op < 0.2, "dark between");
    assert.ok(inBand(at(3.15).b, T) && at(3.15).op > 0 && at(3.15).op < 1, "new band fading in");
    assert.equal(at(3.2 + 1 / 30).op, 1);
    // never both: sample densely, the box is always in exactly one band (or hidden)
    for (let t = 2.8; t < 5.4; t += 1 / 60) {
      const { b, op } = at(t);
      if (op > 0) assert.ok(inBand(b, B) !== inBand(b, T), `t=${t.toFixed(3)} ${JSON.stringify(b)}`);
    }
    // no host function: always the bottom band (as before)
    const plain = K.mountCaptions(doc.createElement("div"), { words });
    assert.ok(inBand(plain.box(4), B));
  } finally { K.setCanvas(null); }
});

// ---- fix wave 2026-11-28: tags and labels read on a phone ----
test("vertical: tags (56 px) and labels (50 px) are about 1.5x the landscape size; landscape keeps 38 / 34", () => {
  const size = (kind, text) => parseFloat(mount(kind, { text, target: "x" }).o.el.children.find((c) => c.tagName !== "svg" && c.tagName !== "SVG" && /hf-/.test(c.getAttribute("class") || "")).style.fontSize);
  assert.equal(size("tag", "Every colour"), 38);
  assert.equal(size("label", "not to scale"), 34);
  K.setCanvas(K.FORMATS.vertical);
  try {
    const tag = size("tag", "Every colour"), label = size("label", "not to scale");
    assert.equal(tag, 56); assert.equal(label, 50);
    assert.ok(tag / 38 >= 1.4 && tag / 38 <= 1.6 && label / 34 >= 1.4 && label / 34 <= 1.6);
    // a long four-word text shrinks only as far as it must to fit the safe zone's 876 px width
    const { o } = mount("label", { text: "Massive woman swims somewhere", target: "x" });
    o.update(4, { x: 540, y: 700 });
    const b = o.box(4);
    assert.ok(O.verticalMetrics("label", "Massive woman swims somewhere").size < 50, "shrunk");
    assert.ok(b.width <= 876 && b.x >= 64 - 1e-6 && b.x + b.width <= 940 + 1e-6, JSON.stringify(b));
    const m = O.verticalMetrics("tag", "Every colour");
    assert.equal(m.size, 56);
    assert.equal(m.height, Math.round(56 * 1.28 + 2 * Math.round(56 * 0.24)));
  } finally { K.setCanvas(null); }
});
