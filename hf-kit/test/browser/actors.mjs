// Mounts the host (side slot) and one extra (in the world) on ONE page in a real Chromium (the
// preinstalled Node Playwright) and checks what node --test cannot: both actors are visible with
// non-empty boxes at t = 0 and t = 2, no SVG id is shared between them (Review Focus 1: the spike's
// duplicate-id bug), every url(#...) resolves, seeking backwards gives the same DOM, and no page
// errors or network requests.
//
//   node test/browser/actors.mjs            -> prints a JSON report, exit 1 on any failure
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "../../src/kit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPTS = globalThis.HFKit.SCRIPTS.map((s) => join(KIT, s));

function pageChecks() {
  const fails = [];
  const K = window.HFKit;
  const root = document.getElementById("root");
  root.innerHTML = '<div id="a"></div><div id="b"></div>';
  const mouth = Array.from({ length: 120 }, (_, i) => 0.5 + 0.5 * Math.sin(i / 3));
  let host, extra;
  try {
    host = K.mountActor(root.querySelector("#a"), { id: "host", character: "host", start: { slot: "right" } }, { sceneId: 1, mouth });
    extra = K.mountActor(root.querySelector("#b"), { id: "extra-1", character: K.cast.extra(1), outfit: "explorer", start: { x: 700, y: 900 } }, { sceneId: 1 });
  } catch (e) { return ["mountActor threw: " + e.message]; }
  const states = {
    0: [{ pose: "talk", expression: "happy" }, { pose: "idle", cycle: "walk", phase: 0, facing: 1, held: "hammer" }],
    2: [{ pose: "point-left", expression: "curious" }, { pose: "carry", cycle: "walk", phase: 0.5, facing: 1, held: "hammer", x: 900 }],
  };
  for (const t of [0, 2]) {
    host.update(t, states[t][0]);
    extra.update(t, states[t][1]);
    for (const [name, api, el] of [["host", host, "#a"], ["extra", extra, "#b"]]) {
      const svg = root.querySelector(el + " svg");
      if (!svg) { fails.push(name + " has no svg at t=" + t); continue; }
      const r = svg.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) fails.push(name + " svg empty at t=" + t);
      const g = svg.querySelector('[data-part="face"]');
      const gr = g && g.getBoundingClientRect();
      if (!gr || !(gr.width > 0 && gr.height > 0)) fails.push(name + " face not drawn at t=" + t);
      const b = api.box(t);
      if (!b || !(b.width > 0 && b.height > 0)) fails.push(name + " box(" + t + ") empty: " + JSON.stringify(b));
      else if (gr && (gr.left < b.x - 40 || gr.right > b.x + b.width + 40 || gr.top < b.y - 40 || gr.bottom > b.y + b.height + 40))
        fails.push(name + " box(" + t + ") misses the face: " + JSON.stringify(b) + " vs " + JSON.stringify([gr.left, gr.top, gr.right, gr.bottom].map(Math.round)));
      for (const k of ["head", "hand", "feet"]) {
        const p = api.anchors[k](t);
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) fails.push(name + " anchor " + k + " not finite");
      }
    }
    const ids = [...root.querySelectorAll("[id]")].map((e) => e.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) fails.push("duplicate ids at t=" + t + ": " + [...new Set(dup)].slice(0, 5).join(", "));
    for (const e of root.querySelectorAll("*")) for (const at of ["clip-path", "mask", "fill", "filter"]) {
      const m = /url\(#([^)]+)\)/.exec(e.getAttribute(at) || "");
      if (m && !document.getElementById(m[1])) fails.push("unresolved url(#" + m[1] + ")");
    }
  }
  // anchors follow the latest state: the extra moved from x 700 to 900
  extra.update(0, states[0][1]);
  const f0 = extra.anchors.feet(0);
  extra.update(2, states[2][1]);
  const f2 = extra.anchors.feet(2);
  if (!(f2.x > f0.x + 100)) fails.push("extra feet anchor did not follow x: " + f0.x + " -> " + f2.x);
  if (Math.abs(f0.y - 900) > 2) fails.push("extra feet not at y 900: " + f0.y);
  // seeking back reproduces the DOM
  host.update(0, states[0][0]); extra.update(0, states[0][1]);
  const a = root.innerHTML;
  host.update(2, states[2][0]); extra.update(2, states[2][1]);
  host.update(0, states[0][0]); extra.update(0, states[0][1]);
  if (root.innerHTML !== a) fails.push("DOM differs after seeking back to 0");
  return fails;
}

const browser = await chromium.launch();
const report = { fails: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { if (/^https?:/.test(r.url())) errors.push("network request: " + r.url()); });
  await page.goto("file://" + join(KIT, "test", "browser", "harness.html"));
  for (const s of SCRIPTS) await page.addScriptTag({ path: s });
  report.fails = await page.evaluate(pageChecks);
  report.fails.push(...errors);
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
process.exit(report.fails.length ? 1 : 0);
