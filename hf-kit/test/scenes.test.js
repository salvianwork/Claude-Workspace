// Scene shell, kit scenes, drawing helpers, registry blocks and the prop library: the pure parts.
// Mounting in a real browser is covered by tests/hf/test_kit_scenes.py (Playwright, slow).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import "../src/kit.js";
import "../src/timing.js";
import "../src/draw.js";
import "../src/icons.js";
import "../src/shell.js";
import "../src/stage.js";
import "../src/blocks/kinetic-center-build.js";
import "../src/blocks/transitions.js";
import "../src/scenes/common.js";
import "../src/scenes/title.js";
import "../src/scenes/steps.js";
import "../src/scenes/compare.js";
import "../src/scenes/chart.js";
import "../src/scenes/kinetic.js";
import "../src/scenes/recap.js";
import "../src/scenes/diagram.js";

const K = globalThis.HFKit;
const KIT = new URL("../", import.meta.url);
const SCENES = ["title", "steps", "compare", "chart", "kinetic", "recap", "diagram"];

const POSITIONS = ["left", "right", "none"];
const SIZES = ["small", "large"];

function intersects(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// ---- shell layout -------------------------------------------------------------------------

test("layout keeps the Remotion rule: presenter 22 % / 34 % on his side, never over content or captions", () => {
  for (const position of POSITIONS) for (const size of SIZES) {
    const L = K.layout(undefined, { position, size });
    assert.equal(L.captionTop, K.captionTop());
    assert.ok(L.content.y >= K.tokens.safe && L.content.x >= K.tokens.safe, `${position}/${size}`);
    assert.ok(L.content.x + L.content.width <= 1920 - K.tokens.safe);
    assert.ok(L.content.y + L.content.height <= L.captionTop);
    if (position === "none") { assert.equal(L.presenterBox, null); continue; }
    const p = L.presenterBox;
    assert.equal(p.width, Math.round(1920 * (size === "large" ? 0.34 : 0.22)));
    assert.equal(p.y + p.height, L.captionTop, "stands on the caption line");
    assert.ok(!intersects(p, L.content), `${position}/${size} presenter over content`);
    assert.ok(position === "left" ? p.x < L.content.x : p.x > L.content.x);
  }
});

test("layout matches the Remotion numbers (small right presenter) at their 40 px captions", () => {
  const R = { sizes: { caption: 40 } };
  const L = K.layout(R, { position: "right", size: "small" });
  assert.deepEqual(L.presenterBox, { x: 1474, y: 356, width: 422, height: 456 });
  assert.deepEqual(L.content, { x: 96, y: 96, width: 1338, height: 716 });
  assert.deepEqual(K.layout(R).content, { x: 96, y: 96, width: 1728, height: 716 });
});

test("layout at the 60 px default captions: the band grows, content and presenter stand above it", () => {
  const L = K.layout(undefined, { position: "right", size: "small" });
  assert.equal(L.captionTop, 1080 - 96 - 226);
  assert.deepEqual(L.presenterBox, { x: 1474, y: 758 - 456, width: 422, height: 456 });
  assert.deepEqual(L.content, { x: 96, y: 96, width: 1338, height: 758 - 96 });
  assert.deepEqual(L.captionBand, { x: 96, y: 758, width: 1728, height: 1080 - 758 });
  assert.equal(L.captions.position, "bottom");
});

test("style.json captions {size, position}: size overrides the token, top moves the band up", () => {
  const s = K.resolveStyle({ captions: { size: 72, position: "top" } });
  assert.equal(s.sizes.caption, 72);
  assert.equal(s.captions.position, "top");
  assert.equal(K.resolveStyle({}).captions.position, "bottom");
  assert.throws(() => K.resolveStyle({ captions: { position: "middle" } }), /captions\.position must be "bottom" or "top"/);
  const L = K.layout({ captions: { position: "top" } }, { position: "left", size: "small" });
  const reserve = K.captionReserve(K.resolveStyle({}));
  assert.deepEqual(L.captionBand, { x: 96, y: 0, width: 1728, height: 96 + reserve });
  assert.equal(L.content.y, 96 + reserve);
  assert.equal(L.content.y + L.content.height, 1080 - 96);
  assert.equal(L.captionTop, 1080 - 96, "nothing but the safe margin below the content");
  assert.ok(L.presenterBox.y >= 96 + reserve && L.presenterBox.y + L.presenterBox.height <= 1080);
});

test("resolveStyle fills missing tokens from the default look", () => {
  const s = K.resolveStyle({ colors: { accent: "#22C55E" } });
  assert.equal(s.colors.accent, "#22C55E");
  assert.equal(s.colors.background, "#0F172A");
  assert.equal(s.sizes.body, 40);
  assert.equal(K.resolveStyle().colors.accent, "#F59E0B");
});

test("layout rejects an unknown presenter position or size", () => {
  assert.throws(() => K.layout(undefined, { position: "top", size: "small" }), /position/);
  assert.throws(() => K.layout(undefined, { position: "left", size: "huge" }), /size/);
});

// ---- camera view maths --------------------------------------------------------------------

test("view: the wide pose is the identity for kit scenes", () => {
  const v = K.view({ x: 0.5, y: 0.5, zoom: 1 }, K.kitFrame());
  assert.deepEqual(v.toScreen(100, 200), { x: 100, y: 200 });
});

test("view: a focus pose puts the anchor at the frame centre", () => {
  const frame = K.kitFrame();
  const v = K.view({ x: 0.25, y: 0.75, zoom: 2 }, frame);
  const p = v.toScreen(480, 810);
  assert.ok(Math.abs(p.x - 960) < 1e-9 && Math.abs(p.y - 540) < 1e-9);
});

test("view: a hero frame fits the prop's focus region into the content box", () => {
  const box = K.layout(undefined, { position: "right", size: "small" }).content;
  const region = { x: 200, y: 100, width: 1000, height: 1000 };
  const frame = K.heroFrame(region, box);
  const v = K.view({ x: 0.5, y: 0.5, zoom: 1 }, frame);
  const tl = v.toScreen(200, 100), br = v.toScreen(1200, 1100);
  assert.ok(tl.x >= box.x - 1e-6 && tl.y >= box.y - 1e-6 && br.x <= box.x + box.width + 1e-6 && br.y <= box.y + box.height + 1e-6);
  assert.ok(Math.abs((br.y - tl.y) - box.height) < 1e-6, "fills the limiting side");
});

test("drift is calm and a pure function of t", () => {
  const a = K.drift(3.2, 8, 4), b = K.drift(3.2, 8, 4);
  assert.deepEqual(a, b);
  for (let t = 0; t <= 8; t += 0.1) {
    const d = K.drift(t, 8, 4);
    assert.ok(d.zoom >= 1 && d.zoom <= 1.04, `zoom ${d.zoom}`);
    assert.ok(Math.abs(d.x) <= 10 && Math.abs(d.y) <= 10);
  }
});

// ---- drawing helpers ----------------------------------------------------------------------

test("draw: seeded random is repeatable and in [0, 1)", () => {
  const a = K.draw.rng(7), b = K.draw.rng(7), c = K.draw.rng(8);
  const xs = Array.from({ length: 50 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 50 }, () => b()));
  assert.notDeepEqual(xs, Array.from({ length: 50 }, () => c()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test("draw: eases start at 0 and end at 1", () => {
  for (const [name, f] of Object.entries(K.draw.ease)) {
    assert.ok(Math.abs(f(0)) < 1e-9, name);
    assert.ok(Math.abs(f(1) - 1) < 1e-9, name);
  }
  assert.equal(K.draw.prog(5, 4, 6), 0.5);
  assert.equal(K.draw.prog(9, 4, 6), 1);
});

test("draw: cubic path points and length", () => {
  const c = K.draw.cubic([0, 0], [0, 0], [100, 0], [100, 0]);
  assert.deepEqual(c.at(0), { x: 0, y: 0 });
  assert.deepEqual(c.at(1), { x: 100, y: 0 });
  assert.ok(Math.abs(c.length - 100) < 0.5);
  const mid = c.atLength(50);
  assert.ok(Math.abs(mid.x - 50) < 1);
  assert.match(c.d, /^M0 0 C/);
});

test("draw: colour mixing", () => {
  assert.equal(K.draw.mix("#000000", "#FFFFFF", 0.5), "#808080");
  assert.equal(K.draw.shade("#FF8000", 0), "#ff8000");
  assert.equal(K.draw.alpha("#FF8000", 0.5), "rgba(255,128,0,0.5)");
});

test("draw: particles are deterministic and seek backwards", () => {
  const p = K.draw.particles({ count: 12, seed: 3, life: 2, spawn: [0, 4] });
  const s1 = JSON.stringify(p.at(2.5));
  p.at(3.9); p.at(0.2);
  assert.equal(JSON.stringify(p.at(2.5)), s1);
  assert.ok(p.at(2.5).some((q) => q.alive));
});

test("icons: every icon has drawable markup, the set is small and offline", () => {
  assert.ok(K.icons.names.length >= 20 && K.icons.names.length <= 60);
  for (const n of K.icons.names) {
    const m = K.icons.markup(n);
    assert.match(m, /<(path|circle|rect|line|polyline|ellipse)/, n);
    assert.doesNotMatch(m, /NaN|undefined|https?:/, n);
  }
  assert.throws(() => K.icons.markup("nope"), /unknown icon/);
  assert.match(K.icons.svg("flame", 64, "#fff"), /^<svg[^>]*width="64"/);
});

// ---- registry blocks (ported) -------------------------------------------------------------

test("kinetic-center-build: every intermediate phrase is centred", () => {
  const B = K.blocks.kineticCenterBuild;
  const pos = B.positions([100, 200, 50], 10);
  assert.deepEqual(pos[0], [0]);
  // two words: total 310 -> spans -155..-55 and -45..155
  assert.deepEqual(pos[1], [-105, 55]);
  const last = pos[2];
  assert.ok(Math.abs((last[0] - 50) + (last[2] + 25)) < 1e-9, "outer edges symmetric");
});

test("kinetic-center-build: word state is a pure function of t, landing on its start time", () => {
  const B = K.blocks.kineticCenterBuild;
  const starts = [0.5, 1.2, 2.0];
  const pos = B.positions([100, 200, 50], 10);
  const before = B.wordState(1, 1.0, starts, pos, 88);
  assert.equal(before.opacity, 0);
  const after = B.wordState(1, 5, starts, pos, 88);
  assert.equal(after.opacity, 1);
  assert.equal(after.x, pos[2][1]);
  assert.deepEqual(B.wordState(1, 1.4, starts, pos, 88), B.wordState(1, 1.4, starts, pos, 88));
});

test("transitions: fade, blur, slide and zoom go from hidden to shown", () => {
  for (const kind of K.blocks.TRANSITIONS) {
    const a = K.blocks.transition(kind, 0, "in"), b = K.blocks.transition(kind, 1, "in");
    assert.equal(b.opacity, 1, kind);
    assert.equal(b.x, 0); assert.equal(b.scale, 1); assert.equal(b.blur, 0);
    if (kind !== "cut") assert.ok(a.opacity < 1 || a.x !== 0, kind);
    const o = K.blocks.transition(kind, 1, "out");
    assert.ok(kind === "cut" || o.opacity < 1 || o.x !== 0, kind);
  }
  assert.throws(() => K.blocks.transition("spin", 0.5, "in"), /unknown transition/);
});

test("blocks keep their licence notes", () => {
  const lic = readFileSync(new URL("src/blocks/LICENSES.md", KIT), "utf8");
  for (const needle of ["kinetic-center-build", "MIT", "Remocn", "transitions-dissolve", "Apache-2.0", "0.9.72",
    "LICENSE-Apache-2.0.txt", "github.com/heygen-com/hyperframes", "Modified: ported to a cue-driven classic script, GSAP removed"]) {
    assert.ok(lic.includes(needle), needle);
  }
  const apache = readFileSync(new URL("src/blocks/LICENSE-Apache-2.0.txt", KIT), "utf8");
  assert.match(apache, /Apache License\s+Version 2\.0, January 2004/);
  assert.match(apache, /END OF TERMS AND CONDITIONS/);
  for (const f of readdirSync(new URL("src/blocks/", KIT))) {
    if (f.endsWith(".js")) assert.doesNotMatch(readFileSync(new URL("src/blocks/" + f, KIT), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""), /https?:\/\//, f);
  }
});

// ---- kit scenes: registry, validation, cue timing -----------------------------------------

const GOOD = {
  title: { title: "How volcanoes work", subtitle: "From magma to mountain", icon: "mountain" },
  steps: { title: "How an eruption builds", steps: ["Pressure", { text: "Rise", icon: "arrow-up" }, "Burst"] },
  compare: { title: "Two kinds of eruption", left: { label: "Effusive", icon: "drop", points: ["Runny lava", "Gentle flows"] },
    right: { label: "Explosive", icon: "bolt", points: ["Sticky magma", "Ash clouds"] }, verdict: "Gas decides" },
  chart: { title: "Lava temperature", data: [{ label: "Basalt", value: 1200 }, { label: "Andesite", value: 1000 }, { label: "Rhyolite", value: 800 }], unit: "°C", highlight: 0 },
  kinetic: { text: "Magma that reaches the surface is called lava", emphasis: ["lava"] },
  recap: { title: "Remember", points: ["Magma waits in a chamber", "Pressure pushes it up", "Lava builds the cone"] },
  diagram: { title: "The rock cycle", layout: "cycle", nodes: [{ label: "Magma", icon: "flame" }, { label: "Rock", icon: "mountain" }, { label: "Sediment", icon: "drop" }] },
};

test("every kit scene is registered with validate, plan and mount", () => {
  assert.deepEqual([...K.SCENE_NAMES].sort(), [...SCENES].sort());
  for (const n of SCENES) {
    const s = K.scenes[n];
    assert.equal(s.name, n);
    assert.equal(typeof s.validate, "function");
    assert.equal(typeof s.validateCues, "function");
    assert.equal(typeof s.plan, "function");
    assert.equal(typeof s.mount, "function");
    assert.ok(s.meta.description.length > 10, n);
    assert.ok(Array.isArray(s.meta.cues), n);
  }
});

test("good props validate clean", () => {
  for (const n of SCENES) assert.deepEqual(K.scenes[n].validate(GOOD[n]), [], n);
});

test("readability limits: at most 5 items, titles at most 60 characters", () => {
  const long = "x".repeat(61);
  const six = ["a", "b", "c", "d", "e", "f"];
  const cases = {
    title: [{ title: long }, /title.*60/],
    steps: [{ title: "Ok", steps: six }, /at most 5/],
    compare: [{ left: { label: "A", points: ["1", "2", "3", "4"] }, right: { label: "B" } }, /at most 3/],
    chart: [{ title: "Ok", data: six.map((label, i) => ({ label, value: i })) }, /at most 5/],
    kinetic: [{ text: long }, /60/],
    recap: [{ title: "Ok", points: six }, /at most 5/],
    diagram: [{ layout: "flow", nodes: six.map((label) => ({ label })) }, /at most 5/],
  };
  for (const [n, [props, re]] of Object.entries(cases)) {
    const errs = K.scenes[n].validate(props);
    assert.ok(errs.some((e) => re.test(e)), `${n}: ${errs.join("; ")}`);
    assert.ok(errs.every((e) => e.startsWith(n + ":")), `${n} messages name the scene: ${errs}`);
  }
  assert.ok(K.scenes.steps.validate({ steps: ["a"] }).some((e) => /at least 2/.test(e)));
  assert.ok(K.scenes.title.validate({ title: long }).length > 0);
});

test("validators catch missing fields, wrong types and unknown icons", () => {
  assert.ok(K.scenes.title.validate({}).some((e) => /title.*required/.test(e)));
  assert.ok(K.scenes.steps.validate({ steps: "abc" }).some((e) => /steps.*list/.test(e)));
  assert.ok(K.scenes.chart.validate({ title: "T", data: [{ label: "a", value: "x" }, { label: "b", value: 1 }] }).some((e) => /number/.test(e)));
  assert.ok(K.scenes.steps.validate({ steps: [{ text: "a", icon: "unicorn" }, "b"] }).some((e) => /unknown icon unicorn/.test(e)));
  assert.ok(K.scenes.diagram.validate({ layout: "spiral", nodes: [{ label: "a" }, { label: "b" }] }).some((e) => /layout/.test(e)));
  assert.ok(K.scenes.kinetic.validate({ text: "Lava flows", emphasis: ["magma"] }).some((e) => /emphasis/.test(e)));
  assert.ok(K.scenes.chart.validate({ title: "T", data: [{ label: "a", value: 1 }, { label: "b", value: 2 }], highlight: 5 }).some((e) => /highlight/.test(e)));
  for (const n of SCENES) assert.ok(K.scenes[n].validate(null).length > 0, n);
});

test("cue validation names unknown kinds and out-of-range indexes", () => {
  assert.deepEqual(K.scenes.steps.validateCues(GOOD.steps, [{ at: { word: 1 }, show: "step", index: 2 }]), []);
  assert.ok(K.scenes.steps.validateCues(GOOD.steps, [{ at: { word: 1 }, show: "step", index: 3 }])[0].match(/index 3/));
  assert.ok(K.scenes.steps.validateCues(GOOD.steps, [{ at: { word: 1 }, show: "wiggle" }])[0].match(/unknown cue.*wiggle/));
  assert.deepEqual(K.scenes.compare.validateCues(GOOD.compare, [{ at: { word: 0 }, show: "point", side: "right", index: 1 }]), []);
  assert.ok(K.scenes.compare.validateCues(GOOD.compare, [{ at: { word: 0 }, show: "point", side: "up", index: 0 }]).length);
});

const WORDS = Array.from({ length: 30 }, (_, i) => ({ i, text: "w" + i, start: 0.3 + i * 0.32, end: 0.3 + i * 0.32 + 0.25 }));

test("cued items build in on their word (within 0.3 s, here exactly)", () => {
  const opts = { props: GOOD.steps, words: WORDS, duration: 10, cues: [
    { at: { word: 3 }, show: "step", index: 0 }, { at: { word: 9 }, show: "step", index: 1 }, { at: { word: 20 }, show: "step", index: 2 }] };
  const plan = K.scenes.steps.plan(opts);
  assert.deepEqual(plan.reveal.step, [WORDS[3].start, WORDS[9].start, WORDS[20].start]);
});

test("uncued items are spread through the first part of the scene, in order", () => {
  const plan = K.scenes.recap.plan({ props: GOOD.recap, words: WORDS, duration: 9, cues: [] });
  const ts = plan.reveal.point;
  assert.equal(ts.length, 3);
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i] > ts[i - 1]);
  assert.ok(ts[0] >= 0.3 && ts[ts.length - 1] <= 9 * 0.7);
});

test("a partly cued list keeps order: uncued items fill the gaps", () => {
  const plan = K.scenes.steps.plan({ props: { steps: ["a", "b", "c", "d"] }, words: WORDS, duration: 12,
    cues: [{ at: { word: 10 }, show: "step", index: 2 }] });
  const ts = plan.reveal.step;
  assert.equal(ts[2], WORDS[10].start);
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i] > ts[i - 1], ts.join(","));
});

test("kinetic words follow the narration: each phrase word lands on the matching spoken word", () => {
  const words = ["Magma", "that", "reaches", "the", "surface", "is", "called", "lava"].map((text, i) => ({ i, text, start: 1 + i * 0.4, end: 1.3 + i * 0.4 }));
  const plan = K.scenes.kinetic.plan({ props: { text: "Magma reaches the surface: lava!" }, words, duration: 6, cues: [] });
  assert.deepEqual(plan.reveal.word, [0, 2, 3, 4, 7].map((i) => words[i].start));
});

test("every scene exports anchors inside the canvas, a 'center' one included", () => {
  for (const n of SCENES) for (const position of POSITIONS) {
    const plan = K.scenes[n].plan({ props: GOOD[n], words: WORDS, duration: 8, cues: [], presenter: { position, size: "small" } });
    assert.ok(plan.anchors.center, n);
    for (const [k, a] of Object.entries(plan.anchors)) {
      assert.ok(a.x >= 0 && a.x <= 1920 && a.y >= 0 && a.y <= 1080, `${n}/${position} anchor ${k}`);
    }
  }
  const steps = K.scenes.steps.plan({ props: GOOD.steps, words: WORDS, duration: 8, cues: [] });
  assert.ok(steps.anchors["step-0"] && steps.anchors["step-2"] && !steps.anchors["step-3"]);
});

test("scene plans stay inside the content box for every presenter layout", () => {
  for (const n of SCENES) for (const position of POSITIONS) for (const size of SIZES) {
    const presenter = { position, size };
    const box = K.layout(undefined, presenter).content;
    const plan = K.scenes[n].plan({ props: GOOD[n], words: WORDS, duration: 8, cues: [], presenter });
    for (const r of plan.boxes) {
      assert.ok(r.x >= box.x - 0.5 && r.y >= box.y - 0.5 && r.x + r.width <= box.x + box.width + 0.5 && r.y + r.height <= box.y + box.height + 0.5,
        `${n} ${position}/${size}: ${r.name} ${JSON.stringify(r)} outside ${JSON.stringify(box)}`);
    }
    for (let i = 0; i < plan.boxes.length; i++) for (let j = i + 1; j < plan.boxes.length; j++) {
      const a = plan.boxes[i], b = plan.boxes[j];
      assert.ok(!intersects(a, b), `${n} ${position}/${size}: ${a.name} overlaps ${b.name}`);
    }
  }
});

test("the content block is vertically centred (+-12 %) and fills >= 45 % of the content box", () => {
  for (const n of SCENES) for (const position of POSITIONS) for (const size of SIZES) {
    const presenter = { position, size };
    const box = K.layout(undefined, presenter).content;
    const plan = K.scenes[n].plan({ props: GOOD[n], words: WORDS, duration: 8, cues: [], presenter });
    const top = Math.min(...plan.boxes.map((b) => b.y)), bottom = Math.max(...plan.boxes.map((b) => b.y + b.height));
    const where = `${n} ${position}/${size}: block ${Math.round(top)}..${Math.round(bottom)} in ${box.y}..${box.y + box.height}`;
    assert.ok(Math.abs((top + bottom) / 2 - (box.y + box.height / 2)) <= 0.12 * box.height, where);
    assert.ok(bottom - top >= 0.45 * box.height, where);
  }
});

test("captions show the word as written (display) when words.json has it", () => {
  assert.equal(K.captionWord({ text: "chamber", display: "chamber," }), "chamber,");
  assert.equal(K.captionWord({ text: "rock" }), "rock");
});

test("on-screen text is at least 32 px", () => {
  for (const n of SCENES) for (const size of SIZES) {
    const plan = K.scenes[n].plan({ props: GOOD[n], words: WORDS, duration: 8, cues: [], presenter: { position: "left", size } });
    for (const f of plan.fonts) assert.ok(f.size >= 32, `${n}: ${f.name} ${f.size}px`);
  }
});

// ---- hero stage: phases from cues --------------------------------------------------------

test("phaseTimes turns phase cues into seconds", () => {
  const cues = [{ at: { word: 4 }, show: "phase", target: "burst" }, { at: { word: 2 }, show: "label", target: "vent", text: "Vent" },
    { at: { t: 1.5 }, show: "phase", target: "rise" }];
  assert.deepEqual(K.phaseTimes(cues, WORDS, 1), { burst: WORDS[4].start, rise: 1.5 });
  assert.throws(() => K.phaseTimes([{ at: { word: 99 }, show: "phase", target: "burst" }], WORDS, 3), /scene 3: no word 99/);
});

// ---- prop library contract ----------------------------------------------------------------

const PROPS = new URL("props/", KIT);
const propDirs = readdirSync(PROPS).filter((d) => statSync(new URL(d, PROPS)).isDirectory());

test("the prop library has the volcano", () => {
  assert.ok(propDirs.includes("volcano"));
});

for (const name of propDirs) {
  test(`prop contract: ${name}`, async () => {
    const dir = new URL(name + "/", PROPS);
    for (const f of ["prop.js", "preview.png", "README.md"]) assert.ok(existsSync(new URL(f, dir)), `${name}/${f} missing`);
    const readme = readFileSync(new URL("README.md", dir), "utf8").trim();
    assert.equal(readme.split("\n").length, 1, `${name}/README.md is one line`);
    const png = readFileSync(new URL("preview.png", dir));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    await import(new URL("prop.js", dir));
    const prop = K.props[name];
    assert.ok(prop, `${name}/prop.js registers HFKit.props["${name}"]`);
    const m = prop.meta;
    assert.equal(m.name, name);
    assert.ok(typeof m.description === "string" && m.description.length > 10);
    assert.ok(Array.isArray(m.anchors) && m.anchors.length > 0);
    assert.equal(typeof m.params, "object");
    assert.ok(m.world && m.world.width > 0 && m.world.height > 0);
    const r = m.frame;
    assert.ok(r && r.width > 0 && r.height > 0, "focus frame");
    assert.equal(typeof prop.mount, "function");
    assert.doesNotMatch(readFileSync(new URL("prop.js", dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""), /https?:\/\/(?!www\.w3\.org)|Math\.random|Date\.now|setInterval|setTimeout/);
    const list = readFileSync(new URL("README.md", PROPS), "utf8");
    assert.match(list, new RegExp("^- `" + name + "`", "m"), `props/README.md lists ${name}`);
  });
}

test("volcano: anchors, phases and a moving magma tip, all pure", async () => {
  await import(new URL("volcano/prop.js", PROPS));
  const V = K.props.volcano;
  assert.deepEqual([...V.meta.anchors].sort(), ["chamber", "crater", "lava", "magma-tip", "vent"]);
  assert.deepEqual(Object.keys(V.meta.phases), ["pressure", "rise", "burst", "flow", "grow"]);
  const ph = V.phases({ burst: 9.6 });
  assert.ok(ph.pressure < ph.rise && ph.rise < ph.burst && ph.burst < ph.flow, JSON.stringify(ph));
  assert.equal(ph.burst, 9.6);
  const none = V.phases({});
  assert.equal(none.burst, Infinity, "no burst cue: the volcano stays quiet");
  const tip = V.anchorsFor({ phases: { burst: 9.6, rise: 6 } })["magma-tip"];
  assert.equal(typeof tip, "function");
  const a = tip(5), b = tip(8), c = tip(9.6);
  assert.ok(b.y < a.y && c.y < b.y, "tip rises");
  assert.deepEqual(tip(8), b);
  const st = V.anchorsFor({});
  for (const k of ["chamber", "vent", "crater", "lava"]) assert.ok(Number.isFinite(st[k].x) && Number.isFinite(st[k].y), k);
});

test("props/README.md tells agents how to use a prop", () => {
  const t = readFileSync(new URL("README.md", PROPS), "utf8");
  for (const needle of ["meta", "mount", "update(t, cueState)", "anchors", "preview.png", "phase"]) assert.ok(t.includes(needle), needle);
});

test("kit sources stay offline and deterministic", () => {
  const files = ["draw.js", "icons.js", "shell.js", "stage.js", ...SCENES.map((s) => "scenes/" + s + ".js"), "scenes/common.js"];
  for (const f of files) {
    const src = readFileSync(new URL("src/" + f, KIT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3\.org)/, f);
    assert.doesNotMatch(src, /Math\.random|Date\.now|setInterval|setTimeout|requestAnimationFrame/, f);
  }
});

test("HFKit.SCRIPTS lists every kit script in load order", () => {
  const s = K.SCRIPTS;
  assert.equal(s[0], "src/kit.js");
  assert.ok(s.indexOf("src/timing.js") < s.indexOf("src/shell.js"));
  assert.ok(s.indexOf("src/scenes/common.js") < s.indexOf("src/scenes/steps.js"));
  for (const f of s) assert.ok(existsSync(new URL(f, KIT)), f);
});
