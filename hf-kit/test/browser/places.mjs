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
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "../../src/kit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLACES = readdirSync(join(KIT, "places")).filter((d) => statSync(join(KIT, "places", d)).isDirectory());
const GOLDEN = join(KIT, "test", "browser", "places-landscape-golden.json");
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

/* The extended-place contract (vertical, 1080 x 1920): every place with meta.extend mounts on
 * world-sized layers (HFKit.placeWorld(place, true): 3840 x 3600), its live anchors and paths are
 * anchorsFor({extended: true}) = the originals + 720, ids stay unique and resolve, the tall frame
 * is covered at the camera limits of the taller world (zoom 0.6 at its corners, zoom 5 at its
 * edges), seeking back gives the same DOM, an extended mount on landscape-sized layers throws,
 * and mountWorld on a vertical canvas mounts the extension (layers and effects 3840 x 3600). */
function extendedChecks() {
  const fails = [];
  const K = window.HFKit, PL = K.place;
  const root = document.getElementById("root");
  root.innerHTML = "";
  document.documentElement.style.height = document.body.style.height = "1920px";
  root.style.width = "1080px"; root.style.height = "1920px";
  K.setCanvas(K.FORMATS.vertical);
  const mounts = [];
  let n = 0;
  try {
    const names = Object.keys(K.places).filter((name) => K.places[name].meta.extend);
    if (names.length < 2) fails.push("expected at least countryside and lab to have meta.extend, got " + names);
    for (const name of names) {
      const P = K.places[name], W = K.placeWorld(P, true);
      if (W.height !== 3600) fails.push(name + ": placeWorld height " + W.height);
      // an extended mount needs world-sized layers
      {
        const f = document.createElement("div");
        root.appendChild(f);
        let threw = false;
        try { P.mount(K.placeLayers(f, "bad-place-0"), { variant: P.meta.variants[0], idPrefix: "bad-place-0", extended: true }); } catch (e) { threw = /extended/.test(e.message); }
        if (!threw) fails.push(name + ": an extended mount on 3840x2160 layers did not throw");
        f.remove();
      }
      for (const variant of P.meta.variants) {
        const frame = document.createElement("div");
        frame.style.cssText = "position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;visibility:hidden";
        root.appendChild(frame);
        const prefix = "x1-place-" + n++;
        const layers = K.placeLayers(frame, prefix, W);
        for (const e of frame.children) if (e.getAttribute("height") !== "3600" || e.getAttribute("viewBox") !== "0 0 3840 3600") fails.push(`${prefix}: layer ${e.getAttribute("data-layer")} is not 3840x3600`);
        let m;
        try { m = P.mount(layers, { variant, idPrefix: prefix, seed: 3, extended: true }); } catch (e) { fails.push(`${name}/${variant} extended mount threw: ${e.message}`); continue; }
        mounts.push({ name, variant, frame, m, W });
        const ref = P.anchorsFor({ variant, seed: 3, extended: true }), base = P.anchorsFor({ variant, seed: 3 });
        for (const a of P.meta.anchors) {
          const q = m.anchors[a](2), b = base.anchors[a](2);
          if (JSON.stringify(q) !== JSON.stringify(ref.anchors[a](2))) fails.push(`${name}/${variant}: extended anchor ${a} differs from anchorsFor`);
          if (q.x !== b.x || q.y !== b.y + 720) fails.push(`${name}/${variant}: extended anchor ${a} is not the original + 720`);
        }
        if (JSON.stringify(m.paths) !== JSON.stringify(ref.paths)) fails.push(`${name}/${variant}: extended paths differ from anchorsFor`);
        if (!frame.querySelector('[data-extend="top"]') || !frame.querySelector('[data-extend="bottom"]')) fails.push(`${name}/${variant}: no top / bottom band drawn`);
      }
    }
    const ids = [...root.querySelectorAll("[id]")].map((e) => e.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) fails.push("extended: duplicate ids: " + [...new Set(dup)].slice(0, 6).join(", "));
    for (const e of root.querySelectorAll("*")) for (const at of ["clip-path", "mask", "fill", "filter", "stroke"]) {
      const v = /url\(#([^)]+)\)/.exec(e.getAttribute(at) || "");
      if (v && !document.getElementById(v[1])) fails.push("extended: unresolved url(#" + v[1] + ")");
    }
    const css = document.createElement("style");
    css.textContent = "svg[data-layer] *{pointer-events:visiblePainted}";
    document.head.appendChild(css);
    for (const mt of mounts) {
      const W = mt.W, cams = [];
      for (const zoom of [0.6, 5]) {
        const hx = 540 / zoom, hy = 960 / zoom;
        for (const x of [hx, W.width / 2, W.width - hx]) for (const y of [hy, W.height / 2, W.height - hy]) cams.push({ x, y, zoom });
      }
      mt.frame.style.visibility = "visible";
      for (const cam of cams) {
        mt.m.update(3, cam);
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 8; j++) {
          const x = Math.min(1079, i * 270), y = Math.min(1919, j * 240);
          const hit = document.elementFromPoint(x, y);
          if (!hit || !mt.frame.contains(hit) || hit === mt.frame || hit.tagName.toLowerCase() === "svg")
            { fails.push(`${mt.name}/${mt.variant} extended: frame point ${x},${y} not covered at cam ${JSON.stringify(cam)}`); i = 99; break; }
        }
      }
      const R = PL.refOf(W);
      mt.m.update(0, R);
      const a = mt.frame.innerHTML;
      mt.m.update(7.3, { x: 2600, y: 2400, zoom: 2 });
      mt.m.update(0, R);
      if (mt.frame.innerHTML !== a) fails.push(`${mt.name}/${mt.variant} extended: DOM differs after seeking back`);
      mt.frame.style.visibility = "hidden";
    }
    // mountWorld on the vertical canvas mounts the extension
    const wf = document.createElement("div");
    root.appendChild(wf);
    const scene = { id: 9, kind: "world", place: "countryside", variant: "day", actors: [{ id: "host", start: { slot: "right" } }],
      beats: [{ at: { t: 0 }, moves: [{ do: "cut", target: "sky", zoom: 0.6 }] }] };
    const w = K.mountWorld(wf, scene, { words: [], duration: 3, cast: [{ id: "host", character: "host", outfit: "blazer" }], captions: false });
    if (!w.world.extended) fails.push("mountWorld (vertical): the world is not extended");
    for (const e of wf.querySelectorAll("svg[data-layer]")) if (e.getAttribute("height") !== "3600") fails.push("mountWorld (vertical): layer " + e.getAttribute("data-layer") + " height " + e.getAttribute("height"));
    const cam = w.camera(1);
    if (Math.abs(cam.y - 1600) > 1e-6) fails.push("mountWorld (vertical): a 0.6x cut on the sky is not clamped to the top of the tall world: " + JSON.stringify(cam));
  } finally {
    K.setCanvas(null);
  }
  return fails;
}

/* Seam rows: the tall world at the reference camera (every layer as drawn) on a 3840 x 3600
 * canvas. Returns the frame's screen rows around y (y - 2 and y + 1) for the node side. */
function seamSetup(spec) {
  const K = window.HFKit;
  const root = document.getElementById("root");
  root.innerHTML = "";
  document.documentElement.style.cssText = document.body.style.cssText = "width:3840px;height:3600px";
  root.style.width = "3840px"; root.style.height = "3600px";
  K.setCanvas({ width: 3840, height: 3600 });
  try {
    const P = K.places[spec.name], W = K.placeWorld(P, true);
    const frame = document.createElement("div");
    frame.style.cssText = "position:absolute;left:0;top:0;width:3840px;height:3600px;overflow:hidden";
    root.appendChild(frame);
    const layers = K.placeLayers(frame, "seam-place-0", W);
    P.mount(layers, { variant: spec.variant, idPrefix: "seam-place-0", seed: 3, extended: true }).update(2, K.place.refOf(W));
    return P.meta.extend;
  } finally { K.setCanvas(null); }
}
async function rowDiff(page, y) {
  const shot = await page.screenshot({ clip: { x: 0, y: y - 2, width: 3840, height: 4 } });
  return page.evaluate(async (b64) => {
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext("2d");
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, w = c.width, out = [];
    for (let x = 0; x < w; x++) { // row 0 = y - 2, row 3 = y + 1
      const a = x * 4, b = (3 * w + x) * 4;
      out.push(Math.max(Math.abs(d[a] - d[b]), Math.abs(d[a + 1] - d[b + 1]), Math.abs(d[a + 2] - d[b + 2])));
    }
    return out;
  }, shot.toString("base64"));
}
/* A seam is a straight horizontal colour step: fail on a run of RUN columns that all step more
 * than STEP, or on more than 3 % of the columns stepping, outside the place's allowlist. */
const STEP = 24, RUN = 48;
function seamFails(diff, allow, what) {
  const ok = (x) => allow.some((r) => x >= r[0] && x <= r[1]);
  let run = 0, worst = 0, count = 0, total = 0, at = -1;
  for (let x = 0; x < diff.length; x++) {
    if (ok(x)) { run = 0; continue; }
    total += 1;
    if (diff[x] > STEP) { count += 1; run += 1; if (run > worst) { worst = run; at = x; } } else run = 0;
  }
  const f = [];
  if (worst >= RUN) f.push(`${what}: a hard step over ${worst} columns (ending at x ${at})`);
  if (count > total * 0.03) f.push(`${what}: ${count} of ${total} columns step more than ${STEP}`);
  return f;
}

/* Landscape is unchanged (controller ruling D): every place and variant mounted without
 * `extended` (and with extended: false) gives the same DOM as before the extended-place contract.
 * Hashes of the frame's innerHTML after mount and after one update, per place / variant. */
function landscapeHashes() {
  const K = window.HFKit, PL = K.place, out = {};
  const root = document.getElementById("root");
  const fnv = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16) + ":" + s.length; };
  for (const name of Object.keys(K.places).sort()) {
    for (const variant of K.places[name].meta.variants) {
      const row = [];
      for (const opts of [{}, { extended: false }]) {
        const frame = document.createElement("div");
        root.appendChild(frame);
        const layers = K.placeLayers(frame, "g-place-0");
        const m = K.places[name].mount(layers, Object.assign({ variant, idPrefix: "g-place-0", seed: 3 }, opts));
        const a = fnv(frame.innerHTML);
        m.update(3, { x: 2600, y: 1300, zoom: 2 });
        row.push(a + "/" + fnv(frame.innerHTML));
        frame.remove();
      }
      out[name + "/" + variant] = row;
    }
  }
  return out;
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
  const hashes = await page.evaluate(landscapeHashes);
  await page.setViewportSize({ width: 1920, height: 1920 });
  report.fails.push(...await page.evaluate(extendedChecks));
  const extended = await page.evaluate(() => Object.keys(window.HFKit.places).filter((n) => window.HFKit.places[n].meta.extend).map((n) => [n, window.HFKit.places[n].meta.variants]));
  const seam = await browser.newPage({ viewport: { width: 3840, height: 3600 } });
  seam.on("pageerror", (e) => errors.push(String(e)));
  await seam.goto("file://" + join(KIT, "test", "browser", "harness.html"));
  for (const s of SCRIPTS) await seam.addScriptTag({ path: s });
  report.seams = {};
  for (const [name, variants] of extended) for (const variant of variants) {
    const ext = await seam.evaluate(seamSetup, { name, variant });
    for (const [band, y] of [["top", 720], ["bottom", 2880]]) {
      const d = await rowDiff(seam, y);
      report.seams[`${name}/${variant}/${y}`] = Math.max(...d);
      report.fails.push(...seamFails(d, ext[band].seamAllow, `${name}/${variant}: seam at y ${y}`));
    }
  }
  if (process.argv.includes("--write-golden")) writeFileSync(GOLDEN, JSON.stringify(Object.fromEntries(Object.entries(hashes).map(([k, v]) => [k, v[0]])), null, 1) + "\n");
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
  for (const [k, [plain, off]] of Object.entries(hashes)) {
    if (off !== plain) report.fails.push(`${k}: mount with extended: false differs from the plain mount`);
    if (golden[k] !== undefined && golden[k] !== plain) report.fails.push(`${k}: the landscape mount changed (golden ${golden[k]}, now ${plain})`);
  }
  report.fails.push(...errors);
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
process.exit(report.fails.length ? 1 : 0);
