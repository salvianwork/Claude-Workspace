// npm run world-sheet: render the world-kit review sheets with the preinstalled Node Playwright
// (offline: every http(s) request is aborted and reported).
//
//   sample/world-sheet/host.png            the host through the rig: 4 outfits x 6 poses, walk / run / jump strips
//                                          and a stop (turn back to front); places light the actor (meta.actorLight)
//   sample/world-sheet/place-<name>.png    every variant of each place: the whole world with its anchors
//                                          and paths marked, plus two in-camera shots with the host
//
//   npm run world-sheet                          -> sample/world-sheet/*.png
//   npm run world-sheet -- --out=<dir>           write the sheets there instead
//   npm run world-sheet -- --frames=<dir>        also save every place shot full size (1920 x 1080)
//   npm run world-sheet -- --preview             also refresh places/<name>/preview.png
//
// Each PNG must stay <= 1.5 MB: a sheet over that is quantized to 256 colours (ffmpeg on PATH) or
// captured smaller; the script fails if it still does not fit.
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import "../src/kit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}`)); return a === undefined ? undefined : a.split("=")[1] ?? true; };
const outDir = resolve(arg("out") || join(KIT, "sample", "world-sheet"));
const framesDir = arg("frames") ? resolve(arg("frames")) : null;
const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_WIDTH = 2000; // sheet PNGs are at most this wide
const PLACES = readdirSync(join(KIT, "places")).filter((d) => statSync(join(KIT, "places", d)).isDirectory()).sort();
const SCRIPTS = [...globalThis.HFKit.SCRIPTS, ...PLACES.map((p) => `places/${p}/place.js`)].map((s) => join(KIT, s));

/* The in-camera shots per place: [label, cam, host actor or null]. Anchors are looked up in the page. */
const SHOTS = {
  countryside: [
    ["rail-near, zoom 1", { anchor: "rail-near", dy: -300, zoom: 1 }, { anchor: "rail-near", dx: -40, outfit: "explorer", pose: "point-right", expression: "happy" }],
    ["lake and bridge, zoom 1.4", { anchor: "lake", dy: -170, zoom: 1.4 }, null],
  ],
  lab: [
    ["bench, zoom 1", { anchor: "bench", dy: 0, zoom: 1 }, { anchor: "bench", dx: -420, dy: 330, outfit: "lab-coat", pose: "point-right", expression: "happy" }],
    ["door, zoom 1.3", { anchor: "door", dx: -500, dy: -360, zoom: 1.3 }, { anchor: "door", dx: -40, dy: 0, outfit: "lab-coat", pose: "wave", expression: "happy" }],
  ],
};

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(KIT, "vendor", "fonts", "fonts.css"))}">
<style>html,body{margin:0;background:#2B2622}body{font-family:Poppins,Inter,sans-serif;color:#3A2F28}
#sheet{display:inline-block;padding:40px 48px 48px;background:linear-gradient(#FBF3E6,#F1E2CB)}
h1{margin:0 0 6px;font-size:44px;font-weight:700}h2{margin:26px 0 12px;font-size:30px;font-weight:700}
.sub{font:500 22px Inter,sans-serif;color:#7A6656;margin-bottom:18px}
.row{display:flex;gap:20px;align-items:flex-start}.col{display:flex;flex-direction:column;gap:20px}
.frame{position:relative;overflow:hidden;border-radius:14px;box-shadow:0 6px 22px rgba(58,47,40,.25);background:#000}
.frame>.inner{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;transform-origin:0 0}
.cap{position:absolute;left:14px;top:12px;font:700 22px Poppins,sans-serif;color:#fff;background:rgba(20,16,30,.62);padding:4px 14px;border-radius:999px}
.cell{position:relative;width:280px;height:460px;border-radius:18px;background:#FCF5EA;box-shadow:inset 0 0 0 2px #E6D3B5;overflow:hidden}
.cell .lab{position:absolute;left:0;right:0;bottom:10px;text-align:center;font:600 20px Inter,sans-serif;color:#7A6656}
.rowlab{width:150px;font:700 24px Poppins,sans-serif;align-self:center}
.grid{display:flex;flex-direction:column;gap:16px}.strip{display:flex;gap:10px}
</style></head><body><div id="sheet"></div></body></html>`;

/* ---- page side ---------------------------------------------------------------------------- */
function pageBuild(spec) {
  const K = window.HFKit, sheet = document.getElementById("sheet");
  const el = (parent, tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; parent.appendChild(e); return e; };
  let n = 0;

  function frame(parent, o) {
    n += 1;
    const wrap = el(parent, "div", "frame");
    wrap.style.width = 1920 * o.scale + "px"; wrap.style.height = 1080 * o.scale + "px";
    const inner = el(wrap, "div", "inner");
    inner.style.transform = "scale(" + o.scale + ")";
    const prefix = "sheet-place-" + n;
    const layers = K.placeLayers(inner, prefix);
    const place = K.places[o.place].mount(layers, { variant: o.variant, idPrefix: prefix, seed: o.seed });
    const anchor = (name, t) => place.anchors[name](t);
    const cam = o.cam.anchor ? { x: anchor(o.cam.anchor, o.t).x + (o.cam.dx || 0), y: anchor(o.cam.anchor, o.t).y + (o.cam.dy || 0), zoom: o.cam.zoom } : o.cam;
    if (o.actor) {
      const box = document.createElement("div");
      box.style.cssText = "position:absolute;left:0;top:0;width:3840px;height:2160px;transform-origin:0 0";
      inner.insertBefore(box, layers.front);
      box.style.transform = K.place.layerTransform(cam, 1);
      const p = anchor(o.actor.anchor, o.t);
      const holder = el(box, "div");
      const meta = K.places[o.place].meta;
      const light = (meta.actorLight || {})[o.variant] || null; // the actor takes on the place's light
      const a = K.mountActor(holder, { id: "host", character: "host", outfit: o.actor.outfit, start: { x: p.x + (o.actor.dx || 0), y: p.y + (o.actor.dy || 0) }, scale: meta.actorScale || 1, light }, { sceneId: n });
      a.update(o.t, { pose: o.actor.pose, expression: o.actor.expression });
    }
    place.update(o.t, cam);
    if (o.marks) {
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("width", 1920); svg.setAttribute("height", 1080);
      svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
      let s = "";
      for (const [name, pts] of Object.entries(place.paths)) {
        const q = pts.map((p) => K.place.toScreen(p, cam, 1));
        s += `<polyline points="${q.map((p) => p.x + "," + p.y).join(" ")}" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="4 14" stroke-linecap="round" opacity="0.95"/>` +
          q.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="6" fill="#7048E8" stroke="#fff" stroke-width="3"/>`).join("");
        const end = q[q.length - 1];
        s += `<g transform="translate(${Math.min(end.x, 1800) - 60} ${end.y + 34})"><rect x="-8" y="-24" width="${name.length * 15 + 54}" height="36" rx="18" fill="#7048E8"/><text x="12" y="1" font-family="Poppins" font-weight="700" font-size="22" fill="#fff">⟿ ${name}</text></g>`;
      }
      for (const name of Object.keys(place.anchors)) {
        const p = K.place.toScreen(anchor(name, o.t), cam, 1), w = name.length * 15 + 40;
        s += `<circle cx="${p.x}" cy="${p.y}" r="13" fill="#E8590C" stroke="#fff" stroke-width="5"/>` +
          `<line x1="${p.x}" y1="${p.y - 13}" x2="${p.x}" y2="${p.y - 44}" stroke="#fff" stroke-width="4"/>` +
          `<rect x="${p.x - w / 2}" y="${p.y - 84}" width="${w}" height="40" rx="20" fill="#fff" stroke="#E8590C" stroke-width="4"/>` +
          `<text x="${p.x}" y="${p.y - 56}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="24" fill="#3A2F28">${name}</text>`;
      }
      svg.innerHTML = s;
      inner.appendChild(svg);
    }
    if (o.caption) el(wrap, "div", "cap", o.caption);
    return wrap;
  }

  if (spec.kind === "frame") {
    sheet.style.padding = "0";
    frame(sheet, Object.assign({ scale: spec.scale || 1 }, spec)).style.borderRadius = "0";
    return;
  }

  if (spec.kind === "place") {
    const P = K.places[spec.place];
    el(sheet, "h1", "", "Place: " + spec.place);
    el(sheet, "div", "sub", P.meta.description + "  Variants: " + P.meta.variants.join(", ") + ". Left: the whole 3840×2160 world (zoom 0.5) with anchors and paths; right: in-camera shots.");
    for (const variant of P.meta.variants) {
      el(sheet, "h2", "", variant);
      const row = el(sheet, "div", "row");
      frame(row, { place: spec.place, variant, t: 2, cam: { x: 1920, y: 1080, zoom: 0.5 }, scale: 0.72, marks: true, caption: "whole world · " + variant });
      const col = el(row, "div", "col");
      for (const [cap, cam, actor] of spec.shots) frame(col, { place: spec.place, variant, t: 2, cam, actor, scale: 0.36, caption: cap });
    }
    return;
  }

  if (spec.kind === "host") {
    el(sheet, "h1", "", "Host: outfits × poses");
    el(sheet, "div", "sub", "Rendered through HFKit.rig / mountActor. Fixed face: curly hair, glasses, skin #E3B28A.");
    const grid = el(sheet, "div", "grid");
    let id = 0;
    const cell = (parent, label, outfit, state) => {
      const c = el(parent, "div", "cell");
      const holder = el(c, "div");
      id += 1;
      const a = K.mountActor(holder, { id: "h" + id, character: "host", outfit, scale: 0.95, start: { x: 140, y: 418 } }, { sceneId: 1 });
      a.update(1, state);
      el(c, "div", "lab", label);
    };
    for (const outfit of spec.outfits) {
      const row = el(grid, "div", "row");
      el(row, "div", "rowlab", outfit);
      for (const [pose, expression] of spec.poses) cell(row, pose, outfit, { pose, expression, facing: 0 });
    }
    const ph = (v) => v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    for (const [cycle, outfit, facing] of spec.cycles) {
      el(sheet, "h2", "", cycle + " cycle (" + outfit + (facing ? ", facing " + (facing > 0 ? "right" : "left") : ", in place") + ")");
      const strip = el(sheet, "div", "strip");
      for (let i = 0; i < 8; i++) {
        const phase = cycle === "jump" ? [0, 0.1, 0.18, 0.3, 0.54, 0.76, 0.86, 1][i] : i / 8;
        cell(strip, "phase " + ph(phase), outfit, { pose: "idle", cycle, phase, facing, expression: cycle === "jump" ? "happy" : cycle === "run" ? "happy" : "neutral" });
      }
    }
    // stopping: the stride eases out (cycleAmount) and the body turns back to front (turn)
    el(sheet, "h2", "", "stop: walk eases out and turns to front over 0.25 s (blazer)");
    const strip = el(sheet, "div", "strip");
    for (let i = 0; i < 8; i++) {
      const k = 1 - i / 7, e = k * k * (3 - 2 * k);
      cell(strip, "turn " + ph(e), "blazer", { pose: "idle", cycle: "walk", phase: 0.25 + (i / 7) * 0.12, facing: 1, turn: e, cycleAmount: e });
    }
  }
}

/* ---- node side ---------------------------------------------------------------------------- */
const stage = mkdtempSync(join(tmpdir(), "hf-world-sheet-"));
const pagePath = join(stage, "sheet.html");
writeFileSync(pagePath, PAGE);
mkdirSync(outDir, { recursive: true });
if (framesDir) mkdirSync(framesDir, { recursive: true });
const browser = await chromium.launch();
const problems = [];

/* 256-colour PNG (dithered) with ffmpeg: flat cartoon art keeps its look at about a quarter of the size. */
function quantize(file) {
  const tmp = file + ".q.png";
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a", tmp], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg failed to quantize " + file + " (is ffmpeg on PATH?)");
  renameSync(tmp, file);
  return statSync(file).size;
}

/* Render one spec to a PNG. A sheet is captured at the largest device scale <= 1 that keeps it at
 * most MAX_WIDTH px wide; if the PNG is over 1.5 MB it is quantized to 256 colours, and if it is
 * still too big the scale steps down. A single frame is captured as is. */
async function render(spec, out, viewport) {
  const sheet = spec.kind !== "frame";
  let scales = [1], measured = !sheet;
  for (let attempt = 0; attempt < scales.length; attempt++) {
    const dsf = scales[attempt];
    const page = await browser.newPage({ viewport: viewport || { width: 2400, height: 1200 }, deviceScaleFactor: dsf });
    page.on("pageerror", (e) => problems.push(`${out}: ${e}`));
    page.on("console", (m) => { if (m.type() === "error") problems.push(`${out}: ${m.text()}`); });
    await page.route(/^https?:/, (r) => { problems.push(`${out}: network request ${r.request().url()}`); return r.abort(); });
    await page.goto(pathToFileURL(pagePath).href);
    for (const s of SCRIPTS) await page.addScriptTag({ path: s });
    await page.evaluate(pageBuild, spec);
    await page.evaluate(() => document.fonts.ready);
    if (!measured) {
      measured = true;
      const width = await page.evaluate(() => document.getElementById("sheet").getBoundingClientRect().width);
      const top = Math.min(1, MAX_WIDTH / width);
      scales = [];
      for (let k = top; k >= 0.4; k -= 0.05) scales.push(Math.round(k * 100) / 100);
      if (scales[0] !== 1) { await page.close(); attempt = -1; continue; }
    }
    await page.locator("#sheet").screenshot({ path: out, animations: "disabled" });
    await page.close();
    let size = statSync(out).size, note = "";
    if (sheet && size > MAX_BYTES) { size = quantize(out); note = ", 256 colours"; }
    if (sheet && size > MAX_BYTES && attempt < scales.length - 1) continue;
    if (size > MAX_BYTES) problems.push(`${out}: ${(size / 1048576).toFixed(2)} MB is over 1.5 MB`);
    console.log(`Done: ${out} (${(size / 1048576).toFixed(2)} MB${sheet ? ", scale " + dsf + note : ""})`);
    return;
  }
}

try {
  await render({
    kind: "host", outfits: ["blazer", "lab-coat", "casual", "explorer"],
    poses: [["idle", "neutral"], ["talk", "happy"], ["point-right", "curious"], ["wave", "happy"], ["think", "thinking"], ["celebrate", "happy"]],
    cycles: [["walk", "blazer", 1], ["run", "casual", 1], ["walk", "lab-coat", -1], ["jump", "explorer", 1], ["jump", "blazer", 0]],
  }, join(outDir, "host.png"));
  for (const name of PLACES) {
    await render({ kind: "place", place: name, shots: SHOTS[name] || [] }, join(outDir, `place-${name}.png`));
    if (framesDir || arg("preview")) {
      const shots = [["world", { x: 1920, y: 1080, zoom: 0.6 }, null], ...(SHOTS[name] || [])];
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.goto(pathToFileURL(pagePath).href);
      for (const s of SCRIPTS) await page.addScriptTag({ path: s });
      const list = await page.evaluate((n) => window.HFKit.places[n].meta.variants, name);
      await page.close();
      for (const variant of list) {
        for (const [i, [, cam, actor]] of shots.entries()) {
          if (!framesDir && !(i === 0 && variant === list[0])) continue;
          const spec = { kind: "frame", place: name, variant, t: 2, cam, actor };
          if (framesDir) await render(spec, join(framesDir, `${name}-${variant}-${i}.png`), { width: 1920, height: 1080 });
          if (arg("preview") && i === 0 && variant === list[0]) await render(Object.assign({}, spec, { scale: 0.5 }), join(KIT, "places", name, "preview.png"), { width: 960, height: 540 });
        }
      }
    }
  }
} finally {
  await browser.close();
  rmSync(stage, { recursive: true, force: true });
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
