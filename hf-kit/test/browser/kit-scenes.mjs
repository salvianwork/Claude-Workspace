// Mounts every kit scene and every prop in a real Chromium (the preinstalled Node Playwright) and
// checks what node --test cannot: no runtime errors, same pixels-in-DOM after seeking backwards,
// text >= 32 px on screen, text inside the content box and not overlapping, nothing over the
// presenter or the captions, and items appearing on their cue word (+-0.3 s).
//
//   node test/browser/kit-scenes.mjs            -> prints a JSON report, exit 1 on any failure
//
// Run by tests/hf/test_kit_scenes.py (slow). Pages are loaded from file:// with the kit's scripts
// injected in HFKit.SCRIPTS order (test/browser/harness.html), so no server and no network.
import { createRequire } from "node:module";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "../../src/kit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPTS = globalThis.HFKit.SCRIPTS.map((s) => join(KIT, s));
const PROPS = readdirSync(join(KIT, "props")).filter((d) => statSync(join(KIT, "props", d)).isDirectory());

const WORDS = Array.from({ length: 40 }, (_, i) => ({ i, text: "w" + i, start: 0.3 + i * 0.3, end: 0.5 + i * 0.3 }));
const W = (i) => WORDS[i].start;

const CASES = [
  { scene: "title", props: { title: "How volcanoes work", subtitle: "From magma chamber to mountain", kicker: "Earth science", icon: "mountain" },
    cues: [{ at: { word: 4 }, show: "subtitle" }], expect: [["subtitle", 4]] },
  { scene: "steps", props: { title: "How an eruption builds", steps: [{ text: "Pressure", icon: "gauge" }, { text: "Rise", icon: "arrow-up" }, { text: "Burst", icon: "bolt" }, { text: "Flow", icon: "drop" }] },
    cues: [{ at: { word: 3 }, show: "step", index: 0 }, { at: { word: 8 }, show: "step", index: 1 }, { at: { word: 13 }, show: "step", index: 2 }, { at: { word: 18 }, show: "step", index: 3 }],
    expect: [["step-0", 3], ["step-1", 8], ["step-3", 18]] },
  { scene: "compare", props: { title: "Two kinds of eruption", left: { label: "Effusive", icon: "drop", points: ["Runny lava", "Gentle flows"] },
    right: { label: "Explosive", icon: "bolt", points: ["Sticky magma", "Ash clouds"] }, verdict: "Gas makes the difference" },
    cues: [{ at: { word: 2 }, show: "left" }, { at: { word: 9 }, show: "right" }, { at: { word: 20 }, show: "verdict" }],
    expect: [["left", 2], ["right", 9], ["verdict", 20]] },
  { scene: "chart", props: { title: "Lava temperature", unit: "°C", highlight: 0, data: [{ label: "Basalt", value: 1200 }, { label: "Andesite", value: 1000 }, { label: "Rhyolite", value: 800 }] },
    cues: [{ at: { word: 5 }, show: "bar", index: 0 }, { at: { word: 10 }, show: "bar", index: 1 }, { at: { word: 15 }, show: "bar", index: 2 }],
    expect: [["bar-0", 5], ["bar-2", 15]] },
  { scene: "chart", label: "chart-line", props: { title: "Eruptions per year", kind: "line", data: [{ label: "2019", value: 4 }, { label: "2020", value: 7 }, { label: "2021", value: 5 }, { label: "2022", value: 9 }] },
    cues: [], expect: [] },
  { scene: "kinetic", props: { text: "Magma that reaches the surface is lava", emphasis: ["lava"] },
    cues: [{ at: { word: 2 }, show: "word", index: 0 }, { at: { word: 12 }, show: "word", index: 6 }], expect: [["word-0", 2], ["word-6", 12]] },
  { scene: "recap", props: { title: "Remember", points: ["Magma waits in a chamber", "Pressure pushes it up", "Lava builds the cone"] },
    cues: [{ at: { word: 4 }, show: "point", index: 0 }, { at: { word: 12 }, show: "point", index: 1 }, { at: { word: 20 }, show: "point", index: 2 }],
    expect: [["point-0", 4], ["point-2", 20]] },
  { scene: "diagram", props: { title: "The rock cycle", layout: "cycle", nodes: [{ label: "Magma", icon: "flame" }, { label: "Igneous rock", icon: "mountain" }, { label: "Sediment", icon: "drop" }, { label: "Heat & pressure", icon: "gauge" }] },
    cues: [{ at: { word: 3 }, show: "node", index: 0 }, { at: { word: 8 }, show: "node", index: 1 }], expect: [["node-0", 3], ["node-1", 8]] },
  { scene: "diagram", label: "diagram-flow", props: { layout: "flow", nodes: [{ label: "Rain", icon: "cloud" }, { label: "River", icon: "water" }, { label: "Sea", icon: "wave" }] },
    cues: [], expect: [] },
  { scene: "kinetic", label: "kinetic-short", props: { text: "Lava is hot", emphasis: ["hot"] }, cues: [], expect: [] },
  { scene: "diagram", label: "diagram-hub", props: { title: "What a volcano needs", layout: "hub", nodes: [{ label: "Volcano", icon: "mountain" }, { label: "Heat", icon: "flame" }, { label: "Gas", icon: "cloud" }, { label: "Magma", icon: "drop" }] },
    cues: [], expect: [] },
];
const PRESENTERS = [{ position: "right", size: "small" }, { position: "left", size: "large" }, { position: "none", size: "small" }];
const DURATION = 12;

/* In-page checks; returns a list of failure strings. */
function pageChecks(c) {
  const fails = [];
  const K = window.HFKit;
  const root = document.getElementById("root");
  const words = c.words;
  const at = (i) => words[i].start;
  root.innerHTML = "";
  let api;
  try {
    api = K.scenes[c.scene].mount(root, { props: c.props, cues: c.cues, words, duration: c.duration, presenter: c.presenter, camera: [], drift: c.drift, sceneId: 1 });
  } catch (e) { return ["mount threw: " + e.message]; }
  const L = K.layout(undefined, c.presenter);
  // determinism: same DOM at t after seeking elsewhere
  api.update(2.5); const a = root.innerHTML;
  api.update(9.1); api.update(0.2); api.update(2.5);
  if (root.innerHTML !== a) fails.push("DOM differs after seeking back to 2.5 s");
  // cue timing: hidden just before the word, visible 0.3 s after
  for (const [key, wi] of c.expect) {
    const el = root.querySelector('[data-key="' + key + '"]');
    if (!el) { fails.push("no element data-key=" + key); continue; }
    api.update(at(wi) - 0.05);
    const o0 = +getComputedStyle(el).opacity;
    api.update(at(wi) + 0.3);
    const o1 = +getComputedStyle(el).opacity;
    if (o0 > 0.01) fails.push(key + " visible before its word (" + o0 + ")");
    if (o1 < 0.5) fails.push(key + " not shown 0.3 s after its word (" + o1 + ")");
  }
  // settled frame: everything revealed
  api.update(c.duration - 0.05);
  const texts = [...root.querySelectorAll(".hf-text")].filter((e) => +getComputedStyle(e).opacity > 0.05 && e.textContent.trim());
  if (!texts.length) fails.push("no visible text at the end");
  const rects = texts.map((e) => ({ e, r: e.getBoundingClientRect(), key: e.dataset.key || ("\"" + e.textContent.trim().slice(0, 24) + "\"") }));
  for (const { e, r, key } of rects) {
    const fs = parseFloat(getComputedStyle(e).fontSize) * (r.height / (e.offsetHeight || r.height));
    if (fs < 31.5) fails.push(key + ": text " + fs.toFixed(1) + " px on screen");
    if (e.scrollWidth > e.clientWidth + 2) fails.push(key + ": text overflows its box (" + e.scrollWidth + " > " + e.clientWidth + ")");
    if (!c.drift) {
      const b = L.content;
      if (r.left < b.x - 1 || r.top < b.y - 1 || r.right > b.x + b.width + 1 || r.bottom > b.y + b.height + 1)
        fails.push(key + ": text outside the content box " + JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round)));
    }
    if (r.bottom > L.captionTop + 1) fails.push(key + ": text in the caption band");
    const p = L.presenterBox;
    if (p && r.left < p.x + p.width && p.x < r.right && r.top < p.y + p.height && p.y < r.bottom) fails.push(key + ": text under the presenter");
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const A = rects[i].r, B = rects[j].r;
    if (A.left < B.right - 2 && B.left < A.right - 2 && A.top < B.bottom - 2 && B.top < A.bottom - 2
        && !rects[i].e.contains(rects[j].e) && !rects[j].e.contains(rects[i].e))
      fails.push("text overlap: " + rects[i].key + " / " + rects[j].key);
  }
  // the content block (text, discs, cards, rows) is centred and fills the content box
  if (!c.drift) {
    const parts = [...root.querySelectorAll(".hf-text, .hf-disc, .hf-card, .hf-recap-row")].filter((e) => +getComputedStyle(e).opacity > 0.05 && !e.closest(".hf-captions"))
      .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.width < 1900);
    const top = Math.min(...parts.map((r) => r.top)), bottom = Math.max(...parts.map((r) => r.bottom));
    const b = L.content, mid = b.y + b.height / 2;
    if (Math.abs((top + bottom) / 2 - mid) > 0.12 * b.height) fails.push("content block not centred: " + Math.round(top) + ".." + Math.round(bottom) + " in " + b.y + ".." + (b.y + b.height));
    if (bottom - top < 0.45 * b.height) fails.push("content block too small: " + Math.round(bottom - top) + " px of " + b.height);
  }
  if (!api.anchors || !api.anchors.center) fails.push("no anchors.center");
  return fails;
}

function heroChecks(c) {
  const fails = [];
  const K = window.HFKit;
  const root = document.getElementById("root");
  root.innerHTML = "";
  let api;
  try {
    api = K.mountHero(root, { prop: c.prop, params: {}, words: c.words, cues: c.cues, camera: c.camera, duration: c.duration, presenter: { position: "right", size: "small" }, sceneId: 1 });
  } catch (e) { return ["mountHero threw: " + e.message]; }
  api.update(5); const a = root.innerHTML;
  api.update(11); api.update(1); api.update(5);
  if (root.innerHTML !== a) fails.push("DOM differs after seeking back to 5 s");
  for (const name of K.props[c.prop].meta.anchors) {
    const an = api.anchors[name];
    const p = typeof an === "function" ? an(6) : an;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) fails.push("anchor " + name + " not finite");
  }
  const lab = root.querySelector('[data-key="label-chamber"]');
  if (!lab) fails.push("no chamber label");
  else {
    api.update(c.words[3].start - 0.05); const o0 = +getComputedStyle(lab).opacity;
    api.update(c.words[3].start + 0.3); const o1 = +getComputedStyle(lab).opacity;
    if (o0 > 0.01 || o1 < 0.5) fails.push("chamber label timing " + o0 + " -> " + o1);
    const r = lab.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(lab).fontSize);
    if (fs < 32) fails.push("label font " + fs);
    const L = K.layout(undefined, { position: "right", size: "small" });
    if (r.right > L.presenterBox.x || r.bottom > L.captionTop) fails.push("label over presenter or captions");
  }
  return fails;
}

const browser = await chromium.launch();
const report = { cases: [], failures: 0 };
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { if (/^https?:/.test(r.url())) errors.push("network request: " + r.url()); });
  await page.goto("file://" + join(KIT, "test", "browser", "harness.html"));
  for (const s of SCRIPTS) await page.addScriptTag({ path: s });
  for (const p of PROPS) await page.addScriptTag({ path: join(KIT, "props", p, "prop.js") });
  await page.evaluate(() => document.fonts.ready);
  for (const c of CASES) for (const presenter of PRESENTERS) for (const drift of [false, true]) {
    const name = (c.label || c.scene) + " " + presenter.position + "/" + presenter.size + (drift ? " drift" : "");
    const fails = await page.evaluate(pageChecks, { ...c, presenter, drift, words: WORDS, duration: DURATION });
    report.cases.push({ name, fails });
    report.failures += fails.length;
  }
  for (const prop of PROPS) {
    const words = WORDS;
    const cues = [{ at: { word: 3 }, show: "label", target: "chamber", text: "Magma chamber" },
      { at: { word: 15 }, show: "phase", target: "rise" }, { at: { word: 25 }, show: "phase", target: "burst" },
      { at: { word: 22 }, show: "label", target: "vent", text: "Vent" }];
    const camera = [{ at: { word: 0 }, frame: "wide" }, { at: { word: 5 }, frame: { focus: "chamber", zoom: 1.6 } }, { at: { word: 18 }, frame: "wide" }];
    if (prop !== "volcano") { cues.length = 0; camera.length = 0; }
    const fails = prop === "volcano" ? await page.evaluate(heroChecks, { prop, words, cues, camera, duration: DURATION }) : [];
    report.cases.push({ name: "prop " + prop, fails });
    report.failures += fails.length;
  }
  if (errors.length) { report.cases.push({ name: "page errors", fails: errors }); report.failures += errors.length; }
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
process.exit(report.failures ? 1 : 0);
