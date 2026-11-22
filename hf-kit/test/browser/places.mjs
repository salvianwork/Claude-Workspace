// Mounts every place (every variant) on ONE page in a real Chromium (the preinstalled Node Playwright)
// and checks what node --test cannot: placeLayers builds the five layers in order, no SVG id is
// shared between mounts (two countrysides with different prefixes included: Review Focus 1), every
// url(#...) resolves, the live anchors and paths equal anchorsFor, the frame is fully covered at the
// camera limits (zoom 0.6 at the world's corners, zoom 5 at its edges), seeking back gives the same
// DOM, there are no page errors or network requests, and the forest's moonless night draws no
// Moon and many more stars than its moonlit night.
//
//   node test/browser/places.mjs            -> prints a JSON report, exit 1 on any failure
import { createRequire } from "node:module";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "../../src/kit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLACES = readdirSync(join(KIT, "places")).filter((d) => statSync(join(KIT, "places", d)).isDirectory());
const SCRIPTS = [...globalThis.HFKit.SCRIPTS, ...PLACES.map((p) => `places/${p}/place.js`)].map((s) => join(KIT, s));

function pageChecks() {
  const fails = [];
  const K = window.HFKit, PL = K.place;
  const root = document.getElementById("root");
  const mounts = [];
  let n = 0;
  for (const name of Object.keys(K.places)) {
    for (const variant of K.places[name].meta.variants) {
      const frame = document.createElement("div");
      frame.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;visibility:hidden";
      root.appendChild(frame);
      const prefix = "s1-place-" + n++;
      const layers = K.placeLayers(frame, prefix);
      const order = [...frame.children].map((e) => e.getAttribute("data-layer"));
      if (order.join() !== PL.LAYERS.join()) fails.push(`${prefix}: layer order ${order}`);
      let m;
      try { m = K.places[name].mount(layers, { variant, idPrefix: prefix, seed: 3 }); } catch (e) { fails.push(`${name}/${variant} mount threw: ${e.message}`); continue; }
      mounts.push({ name, variant, prefix, frame, layers, m });
      const ref = K.places[name].anchorsFor({ variant, seed: 3 });
      for (const a of K.places[name].meta.anchors) {
        if (typeof m.anchors[a] !== "function") { fails.push(`${name}/${variant}: anchor ${a} missing`); continue; }
        if (JSON.stringify(m.anchors[a](2)) !== JSON.stringify(ref.anchors[a](2))) fails.push(`${name}/${variant}: anchor ${a} differs from anchorsFor`);
      }
      if (JSON.stringify(m.paths) !== JSON.stringify(ref.paths)) fails.push(`${name}/${variant}: paths differ from anchorsFor`);
    }
  }
  // a second countryside with its own prefix (two scenes with the same place)
  {
    const frame = document.createElement("div");
    frame.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;visibility:hidden";
    root.appendChild(frame);
    const layers = K.placeLayers(frame, "s2-place-0");
    mounts.push({ name: "countryside", variant: "day", prefix: "s2-place-0", frame, layers, m: K.places.countryside.mount(layers, { idPrefix: "s2-place-0" }) });
  }
  const ids = [...root.querySelectorAll("[id]")].map((e) => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) fails.push("duplicate ids: " + [...new Set(dup)].slice(0, 6).join(", "));
  for (const { prefix, frame } of mounts) for (const e of frame.querySelectorAll("[id]")) if (!e.id.startsWith(prefix + "-")) fails.push(`${prefix}: id ${e.id} lacks its prefix`);
  for (const e of root.querySelectorAll("*")) for (const at of ["clip-path", "mask", "fill", "filter", "stroke"]) {
    const v = /url\(#([^)]+)\)/.exec(e.getAttribute(at) || "");
    if (v && !document.getElementById(v[1])) fails.push("unresolved url(#" + v[1] + ")");
  }
  // coverage at the camera limits: every sampled frame point hits a drawn element of the place
  const W = PL.WORLD, cams = [];
  for (const zoom of [0.6, 5]) {
    const hx = 960 / zoom, hy = 540 / zoom;
    for (const x of [hx, W.width / 2, W.width - hx]) for (const y of [hy, W.height / 2, W.height - hy]) cams.push({ x, y, zoom });
  }
  // hit-test painted shapes only (the <svg> boxes themselves are not paint)
  const css = document.createElement("style");
  css.textContent = "svg[data-layer] *{pointer-events:visiblePainted}";
  document.head.appendChild(css);
  for (const mt of mounts.slice(0, -1)) {
    mt.frame.style.visibility = "visible";
    for (const cam of cams) {
      mt.m.update(3, cam);
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 4; j++) {
        const x = Math.min(1919, i * 320), y = Math.min(1079, j * 270);
        const hit = document.elementFromPoint(x, y);
        if (!hit || !mt.frame.contains(hit) || hit === mt.frame || hit.tagName.toLowerCase() === "svg")
          { fails.push(`${mt.name}/${mt.variant}: frame point ${x},${y} not covered at cam ${JSON.stringify(cam)} (hit ${hit && (hit.tagName + " " + (hit.id || hit.getAttribute("data-layer") || hit.parentNode.getAttribute("data-part")))})`); i = 99; break; }
      }
    }
    // seeking back reproduces the DOM
    mt.m.update(0, PL.REF);
    const a = mt.frame.innerHTML;
    mt.m.update(7.3, { x: 2600, y: 1300, zoom: 2 });
    mt.m.update(0, PL.REF);
    if (mt.frame.innerHTML !== a) fails.push(`${mt.name}/${mt.variant}: DOM differs after seeking back`);
    mt.frame.style.visibility = "hidden";
  }
  // forest: the moonless night has no Moon disc and many more stars than the moonlit night
  const skyOf = (variant) => mounts.find((mt) => mt.name === "forest" && mt.variant === variant).layers.sky.innerHTML;
  if (K.places.forest) {
    const moonlit = skyOf("night"), moonless = skyOf("moonless"), stars = (h) => (h.match(/data-star=/g) || []).length;
    if (!/#F6F2DC/i.test(moonlit)) fails.push("forest/night: no Moon drawn");
    if (/#F6F2DC/i.test(moonless)) fails.push("forest/moonless: a Moon is drawn");
    if (!(stars(moonless) > 2 * stars(moonlit))) fails.push(`forest/moonless: ${stars(moonless)} stars, not many more than the moonlit ${stars(moonlit)}`);
  }
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
