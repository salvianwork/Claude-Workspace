// World scenes in a real Chromium (the preinstalled Node Playwright): the plan's pinned railway beat
// (sample/railway-beat.json) mounts through HFKit.mountWorld and updates at 5 times with no console
// or page errors and no network; boxes(t) holds the host's face (inside the drawn face) and the pulse
// tag; two world scenes on one page share no SVG id and resolve every url(#...); seeking back gives
// the same DOM; remounting the same scene draws the same frame (ids aside); a dive cuts to its inside
// view; and mountComposition mounts a kind "world" scene.
//
//   node test/browser/world.mjs     -> prints a JSON report, exit 1 on any failure
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "../../src/kit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPTS = ["vendor/gsap.min.js", ...globalThis.HFKit.SCRIPTS, "places/countryside/place.js", "places/lab/place.js"].map((s) => join(KIT, s));
const FIX = JSON.parse(readFileSync(join(KIT, "sample", "railway-beat.json"), "utf8"));

function pageChecks(fix) {
  const fails = [], K = window.HFKit, root = document.getElementById("root");
  const ctx = { words: fix.words, mouth: fix.mouth, duration: fix.duration, cast: fix.cast };
  const box = (cls) => { const d = document.createElement("div"); d.className = cls; d.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px"; root.appendChild(d); return d; };
  let w;
  try { w = K.mountWorld(box("a"), fix.scene, ctx); } catch (e) { return ["mountWorld threw: " + e.message]; }
  const times = [0.2, 3, 6, 8.5, fix.duration - 0.2];
  for (const t of times) {
    try { w.update(t); } catch (e) { fails.push("update(" + t + ") threw: " + e.message); continue; }
    const b = w.boxes(t);
    const face = b.find((x) => x.kind === "face" && x.id === "host");
    // the host until the camera follows the pulse away from him; then the listener
    if (t < 7 && !face) fails.push("no host face box at " + t + ": " + JSON.stringify(b));
    if (t > 8 && !b.some((x) => x.kind === "face" && x.id === "friend")) fails.push("no friend face box at " + t + ": " + JSON.stringify(b));
    if (face) { // the box contains the drawn face (the presenter face group inside the host's svg)
      const svg = root.querySelector('[data-actor-id="s1-host-0"] svg');
      const head = svg && svg.querySelector('[id^="s1-host-0-"]');
      const r = svg ? svg.getBoundingClientRect() : null;
      if (!r || r.width === 0) fails.push("host not drawn at " + t);
      if (face.w <= 0 || face.h <= 0 || !Number.isFinite(face.x)) fails.push("bad face box " + JSON.stringify(face));
      if (!head) fails.push("host svg has no prefixed ids");
    }
    for (const x of b) for (const k of ["x", "y", "w", "h"]) if (!Number.isFinite(x[k])) fails.push("non-finite box " + JSON.stringify(x));
  }
  // the tag rides the pulse once the hammer has struck
  const strike = w.compiled.actors.host.find((e) => e.pose === "strike").t;
  const tb = w.boxes(strike + 0.6).filter((x) => x.kind === "tag");
  if (tb.length !== 1) fails.push("pulse tag not in boxes after the strike: " + JSON.stringify(w.boxes(strike + 0.6)));
  // seek back reproduces the DOM
  w.update(4); const a = root.innerHTML; w.update(9); w.update(4);
  if (root.innerHTML !== a) fails.push("DOM differs after seeking back");
  // a second world scene (another scene id) and a remount of the same scene id on one page
  const scene2 = Object.assign({}, fix.scene, { id: 2 });
  const w2 = K.mountWorld(box("b"), scene2, ctx);
  const w3 = K.mountWorld(box("c"), fix.scene, ctx);
  w2.update(6); w3.update(6); w.update(6);
  const ids = [...root.querySelectorAll("[id]")].map((e) => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) fails.push("duplicate ids: " + [...new Set(dup)].slice(0, 6).join(", "));
  for (const e of root.querySelectorAll("*")) for (const at of ["fill", "stroke", "filter", "clip-path", "mask"]) {
    const m = /url\(#([^)]+)\)/.exec(e.getAttribute(at) || "");
    if (m && !document.getElementById(m[1])) { fails.push("unresolved url(#" + m[1] + ")"); break; }
  }
  // the same scene mounted again (a rebuild) draws the same frames: only the id prefix differs, and
  // the host's blinks are seeded by {scene, actor}, not by how many times he was mounted
  const w4 = K.mountWorld(box("f"), fix.scene, ctx);
  const norm = (el, p) => el.innerHTML.split(p + "-").join("P-").split('data-world="' + p + '"').join("").split('data-place="' + p).join('data-place="P');
  w3.update(6); w4.update(6);
  if (norm(w3.el, w3.prefix) !== norm(w4.el, w4.prefix)) fails.push("remounting the same scene draws a different frame");
  const host = (x) => x.el.querySelector('[data-actor-id="' + x.prefix + '-host-0"]');
  for (let f = 0; f < 300; f += 2) {
    w3.update(f / 30); w4.update(f / 30);
    if (host(w3).innerHTML.split(w3.prefix + "-").join("") !== host(w4).innerHTML.split(w4.prefix + "-").join("")) { fails.push("the remounted host differs at frame " + f + " (blink seed?)"); break; }
  }
  // a dive cuts to the inside view, with no console errors
  const dive = Object.assign({}, fix.scene, { id: 3, beats: [{ at: { word: 0 }, moves: [{ do: "push_in", target: "lake", zoom: 1.6, at: { word: 4 } }] },
    { at: { word: 8 }, moves: [{ do: "dive", target: "lake", into: "lattice", params: { state: "liquid" } }] },
    { at: { word: 20 }, moves: [{ do: "cut", target: "rail-near", zoom: 1 }] }] });
  const wd = K.mountWorld(box("d"), dive, ctx), dv = wd.compiled.dives[0];
  wd.update(dv.t1 + 0.5);
  const inside = wd.el.querySelector(".hf-world-inside");
  if (!inside || inside.style.visibility !== "visible" || !inside.querySelector("circle")) fails.push("inside view not shown after the dive");
  if (wd.el.querySelector(".hf-world-place").style.visibility !== "hidden") fails.push("world still drawn inside the dive");
  if (wd.boxes(dv.t1 + 0.5).some((x) => x.kind === "face")) fails.push("faces reported while inside");
  wd.update(dv.until + 0.3);
  if (inside.style.visibility !== "hidden") fails.push("inside view still shown after the cut back");
  for (const kind of ["cells"]) for (const type of ["animal", "plant", "blood"]) {
    const d = box("i"); const api = K.insides[kind].mount(d, { params: { type }, idPrefix: "t-" + type });
    api.update(1.3); if (!d.querySelector("path,ellipse,rect")) fails.push(kind + " " + type + " drew nothing");
  }
  for (const state of ["solid", "gas"]) {
    const d = box("i"); const api = K.insides.lattice.mount(d, { params: { state }, idPrefix: "t-" + state }); api.update(2.1);
    if (d.querySelectorAll("circle").length < 10) fails.push("lattice " + state + " drew too few particles");
  }
  // an invalid scene throws a message naming the move
  try { K.mountWorld(box("e"), Object.assign({}, fix.scene, { beats: [{ at: { word: 0 }, moves: [{ do: "walk_to", who: "host", to: "rail-mid" }] }] }), ctx); fails.push("bad scene did not throw"); }
  catch (e) { if (!/scene 1 beat 0 move 0 \(walk_to\): unknown anchor "rail-mid"/.test(e.message)) fails.push("bad error: " + e.message); }
  return fails;
}

function compositionCheck(fix) {
  const K = window.HFKit, fails = [];
  document.getElementById("root").innerHTML = "";
  const clip = document.createElement("div"); clip.id = "scene-1"; clip.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px";
  document.getElementById("root").appendChild(clip);
  const errs = []; const orig = console.error; console.error = (m) => { errs.push(String(m)); orig(m); };
  const data = { fps: 30, total: fix.duration, cast: fix.cast, scenes: [{ id: 1, kind: "world", start: 0, duration: fix.duration, world: fix.scene, words: fix.words, mouth: fix.mouth, transition: "fade", next: null }] };
  const c = K.mountComposition(data);
  for (const t of [0.6, 5, 9]) c.render(t);
  console.error = orig;
  if (errs.length) fails.push("composition errors: " + errs.join(" | "));
  if (!clip.querySelector(".hf-world [data-layer=ground]")) fails.push("composition did not mount the world");
  if (!clip.querySelector(".hf-caption-bar")) fails.push("composition did not mount captions");
  return fails;
}

const browser = await chromium.launch();
const report = { fails: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("request", (r) => { if (/^https?:/.test(r.url())) errors.push("network request: " + r.url()); });
  await page.goto("file://" + join(KIT, "test", "browser", "harness.html"));
  for (const s of SCRIPTS) await page.addScriptTag({ path: s });
  report.fails = await page.evaluate(pageChecks, FIX);
  report.fails.push(...errors);
  errors.length = 0;
  report.fails.push(...await page.evaluate(compositionCheck, FIX));
  report.fails.push(...errors);
} finally { await browser.close(); }
console.log(JSON.stringify(report, null, 1));
process.exit(report.fails.length ? 1 : 0);
