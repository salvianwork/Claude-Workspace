// npm run world-sheet: render the world-kit review sheets with the preinstalled Node Playwright
// (offline: every http(s) request is aborted and reported).
//
//   sample/world-sheet/host.png            the host through the rig: 4 outfits x 6 poses, walk / run / jump strips
//                                          and a stop (turn back to front); places light the actor (meta.actorLight)
//   sample/world-sheet/place-<name>.png    every variant of each place: the whole world with its anchors
//                                          and paths marked, plus two in-camera shots with the host
//   sample/world-sheet/effects.png         every effect over time (frames after its start), box(t) dashed
//   sample/world-sheet/overlays.png        the tag clamp demo: a tag / label whose point leaves the frame
//   sample/world-sheet/world-railway.png   a world scene through HFKit.mountWorld: the plan's pinned railway
//                                          beat (sample/railway-beat.json) at 9 times, plus every inside view
//
//   npm run world-sheet                          -> sample/world-sheet/*.png
//   npm run world-sheet -- --out=<dir>           write the sheets there instead (absolute, or relative to
//                                                the current folder; also: node hf-kit/scripts/world-sheet.mjs ...)
//   npm run world-sheet -- --frames=<dir>        also save every place shot full size (1920 x 1080)
//   npm run world-sheet -- --preview             also refresh places/<name>/preview.png
//   npm run world-sheet -- --only=effects,lab    render only those sheets (host, effects, overlays, world, <place>)
//
// Each PNG must stay <= 1.5 MB: a sheet over that is quantized to 256 colours (ffmpeg on PATH) or
// captured smaller; the script fails if it still does not fit.
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import "../src/kit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
// --name=value (the value may itself hold "=" or a drive letter, e.g. --out=C:\runs\a=b)
const arg = (name) => { const a = process.argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`)); if (a === undefined) return undefined; const i = a.indexOf("="); return i < 0 ? true : a.slice(i + 1); };
// --out / --frames: an absolute path (Windows or POSIX) is used as is; a relative one is from the
// current folder (from the workspace root: node hf-kit/scripts/world-sheet.mjs --out="<run_dir>/...")
const outDir = resolve(arg("out") || join(KIT, "sample", "world-sheet"));
const framesDir = arg("frames") ? resolve(arg("frames")) : null;
const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_WIDTH = 2000; // sheet PNGs are at most this wide
const ALL_PLACES = readdirSync(join(KIT, "places")).filter((d) => statSync(join(KIT, "places", d)).isDirectory()).sort();
const ONLY = arg("only") ? String(arg("only")).split(",") : null; // --only=host,effects,overlays,<place>,... renders just those
const PLACES = ONLY ? ALL_PLACES.filter((p) => ONLY.includes(p)) : ALL_PLACES;
const wants = (name) => !ONLY || ONLY.includes(name);
const SCRIPTS = [...globalThis.HFKit.SCRIPTS, ...ALL_PLACES.map((p) => `places/${p}/place.js`)].map((s) => join(KIT, s));

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
  "city-street": [
    ["sidewalk, zoom 1", { anchor: "sidewalk", dx: 300, dy: -260, zoom: 1 }, { anchor: "sidewalk", outfit: "casual", pose: "wave", expression: "happy" }],
    ["crossing, zoom 1.3", { anchor: "crosswalk", dx: -200, dy: -60, zoom: 1.3 }, null],
  ],
  home: [
    ["sofa, zoom 1", { anchor: "sofa", dx: 250, dy: 160, zoom: 1 }, { anchor: "floor", dx: -80, outfit: "casual", pose: "talk", expression: "happy" }],
    ["kitchen, zoom 1.4", { anchor: "kitchen", dy: 40, zoom: 1.4 }, null],
  ],
  classroom: [
    ["board, zoom 1", { anchor: "board", dy: 230, zoom: 1 }, { anchor: "front", dx: -300, outfit: "blazer", pose: "point-right", expression: "happy" }],
    ["seats, zoom 1.1", { anchor: "seats", dx: 250, dy: 80, zoom: 1.1 }, null],
  ],
  forest: [
    ["trail, zoom 1", { anchor: "trail", dx: 300, dy: -250, zoom: 1 }, { anchor: "trail", outfit: "explorer", pose: "point-right", expression: "curious" }],
    ["stream and log, zoom 1.3", { anchor: "stream", dx: -200, dy: -150, zoom: 1.3 }, null],
  ],
  ocean: [
    ["boat, zoom 1.2", { anchor: "boat", dy: 120, zoom: 1.2 }, null],
    ["reef, zoom 1.3", { anchor: "reef", dy: -120, zoom: 1.3 }, null],
  ],
  space: [
    ["craft, zoom 1.2", { anchor: "craft", dx: -150, dy: 60, zoom: 1.2 }, { anchor: "craft", dx: -380, dy: 150, outfit: "explorer", pose: "wave", expression: "happy" }],
    ["planet limb, zoom 0.8", { anchor: "planet", dy: -300, zoom: 0.8 }, null],
  ],
  "inside-body": [
    ["heart and lungs, zoom 1.3", { anchor: "heart", dx: -150, dy: -40, zoom: 1.3 }, null],
    ["stomach, zoom 1.4", { anchor: "stomach", dx: -120, zoom: 1.4 }, { anchor: "stomach", dx: -330, dy: 140, outfit: "lab-coat", pose: "point-right", expression: "curious" }],
  ],
  "sky-fantasy": [
    ["island, zoom 1", { anchor: "island", dx: 200, dy: -250, zoom: 1 }, { anchor: "island", outfit: "explorer", pose: "celebrate", expression: "happy" }],
    ["balloon and tower, zoom 0.9", { anchor: "balloon", dx: 300, dy: 200, zoom: 0.9 }, null],
  ],
  "rooftop-night": [
    ["telescope, zoom 1", { anchor: "telescope", dx: 200, dy: -250, zoom: 1 }, { anchor: "telescope", dx: -260, outfit: "casual", pose: "point-right", expression: "curious" }],
    ["ledge and skyline, zoom 1.2", { anchor: "ledge", dy: -250, zoom: 1.2 }, null],
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
    if (o.effect) { // an effect on its own world-sized layer above the ground, with its box(t) dashed
      const NS = "http://www.w3.org/2000/svg", fxl = document.createElementNS(NS, "svg");
      fxl.setAttribute("width", 3840); fxl.setAttribute("height", 2160);
      fxl.style.cssText = "position:absolute;left:0;top:0;overflow:visible;transform-origin:0 0";
      fxl.style.transform = K.place.layerTransform(cam, 1);
      inner.insertBefore(fxl, layers.front);
      const fx = K.effects[o.effect.name](fxl, o.effect.params, "sheet-fx-" + n);
      fx.update(o.t);
      const b = fx.box(o.t);
      if (b.width > 0) fxl.insertAdjacentHTML("beforeend", `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="14 12" opacity="0.8"/>`);
      if (fx.anchor) { const q = fx.anchor(o.t); fxl.insertAdjacentHTML("beforeend", `<circle cx="${q.x}" cy="${q.y}" r="12" fill="#E8590C" stroke="#fff" stroke-width="5"/>`); }
    }
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

  if (spec.kind === "world" || spec.kind === "world-frame") { // a world scene through mountWorld
    const fix = spec.fix, ctx = { words: fix.words, mouth: fix.mouth, duration: fix.duration, cast: fix.cast };
    const shot = (parent, t, S, caption) => {
      n += 1;
      const wrap = el(parent, "div", "frame");
      wrap.style.width = 1920 * S + "px"; wrap.style.height = 1080 * S + "px";
      const inner = el(wrap, "div", "inner");
      inner.style.transform = "scale(" + S + ")";
      const w = K.mountWorld(inner, fix.scene, Object.assign({ idPrefix: "sheet-w" + n }, ctx));
      w.update(t);
      if (caption) el(wrap, "div", "cap", caption);
      return w;
    };
    if (spec.kind === "world-frame") { sheet.style.padding = "0"; shot(sheet, spec.t, 1, null).el.parentNode.parentNode.style.borderRadius = "0"; return; }
    el(sheet, "h1", "", "World scene: the railway beat");
    el(sheet, "div", "sub", "The plan's pinned railway beat through HFKit.compileMoves + mountWorld (made-up narration timings, captions on). Re-authored at a natural pace (~13 s): beat 0, the host waves from the side slot, steps into the world and walks to rail-near (the camera follows him, readable); beat 1, the strike lands on 'rail', the pulse races to rail-far with its tag (the camera follows it), the listener is surprised, the camera pushes in on him.");
    const grid = el(sheet, "div", "row");
    grid.style.cssText = "display:flex;flex-wrap:wrap;gap:18px;max-width:" + (3 * 1920 * 0.3 + 2 * 18) + "px";
    for (const [t, label] of spec.times) shot(grid, t, 0.3, "t = " + t.toFixed(1) + " s · " + label);
    el(sheet, "h2", "", "Inside views (a dive cuts to these): lattice solid / liquid / gas, cells animal / plant / blood");
    const row = el(sheet, "div", "row");
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:18px;max-width:" + (3 * 1920 * 0.3 + 2 * 18) + "px";
    for (const [name, params] of [["lattice", { state: "solid" }], ["lattice", { state: "liquid" }], ["lattice", { state: "gas" }], ["cells", { type: "animal" }], ["cells", { type: "plant" }], ["cells", { type: "blood" }]]) {
      n += 1;
      const wrap = el(row, "div", "frame"); wrap.style.width = 1920 * 0.3 + "px"; wrap.style.height = 1080 * 0.3 + "px";
      const inner = el(wrap, "div", "inner"); inner.style.transform = "scale(0.3)";
      K.insides[name].mount(inner, { params, idPrefix: "sheet-in-" + n, seed: n }).update(1.7);
      el(wrap, "div", "cap", name + " · " + Object.values(params)[0]);
    }
    return;
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

  if (spec.kind === "effects") {
    el(sheet, "h1", "", "Effects over time");
    el(sheet, "div", "sub", "HFKit.effects in the countryside (day), pushed in (zoom 1.3 to 1.8) except smoke and speed_lines (zoom 1). Each row: the same effect at increasing times after its start (at = 0.5 s). Dashed: box(t); orange dot: pulse_along's anchor \"pulse\".");
    for (const [title, params, cam, times] of spec.rows) {
      const name = title.split(" ")[0];
      el(sheet, "h2", "", title);
      const strip = el(sheet, "div", "strip");
      for (const t of times) frame(strip, { place: "countryside", variant: "day", t, cam, scale: 0.2, effect: { name, params }, caption: "t = " + t.toFixed(2) });
    }
    return;
  }

  if (spec.kind === "overlays") {
    el(sheet, "h1", "", "Tags: following a point that leaves the frame");
    el(sheet, "div", "sub", "The frame (1920×1080, solid edge) with 400 px of the world around it (hatched). Red cross: the tag's true point. Inside the safe line (96 px, dotted) the pill is clamped to the edge, a chevron points at the point; from 200 px outside it fades and is gone by 280 px.");
    for (const [title, points, kind, text] of spec.rows) {
      el(sheet, "h2", "", title);
      const strip = el(sheet, "div", "strip");
      strip.style.cssText = "flex-wrap:wrap;max-width:2520px";
      for (const pt of points) {
        n += 1;
        const S = 0.3, M = 400, wrap = el(strip, "div", "frame");
        wrap.style.width = (1920 + 2 * M) * S + "px"; wrap.style.height = (1080 + 2 * M) * S + "px"; wrap.style.background = "repeating-linear-gradient(45deg,#E9DCC8 0 18px,#DCCBB2 18px 36px)";
        const outer = el(wrap, "div"); outer.style.cssText = `position:absolute;left:0;top:0;width:${1920 + 2 * M}px;height:${1080 + 2 * M}px;transform:scale(${S});transform-origin:0 0`;
        const inner = el(outer, "div"); inner.style.cssText = `position:absolute;left:${M}px;top:${M}px;width:1920px;height:1080px;overflow:hidden;outline:6px solid #3A2F28`;
        const layers = K.placeLayers(inner, "sheet-ov-" + n);
        const cam = { x: 1600, y: 1000, zoom: 1 };
        K.places["city-street"].mount(layers, { variant: "day", idPrefix: "sheet-ov-" + n }).update(2, cam);
        const ov = el(inner, "div"); ov.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px";
        const safe = el(inner, "div"); safe.style.cssText = "position:absolute;left:96px;top:96px;width:1728px;height:888px;outline:4px dotted rgba(255,255,255,.8)";
        const o = K.overlays[kind](ov, { text, target: "point" }, "sheet-ov-" + n + "-tag");
        const st = o.update(2, pt);
        const mark = el(outer, "div"); mark.style.cssText = `position:absolute;left:${M + pt.x - 30}px;top:${M + pt.y - 30}px;width:60px;height:60px;background:linear-gradient(45deg,transparent 42%,#E03131 42% 58%,transparent 58%),linear-gradient(-45deg,transparent 42%,#E03131 42% 58%,transparent 58%)`;
        el(wrap, "div", "cap", `(${pt.x}, ${pt.y}) · opacity ${st.opacity}${st.clamped ? " · clamped" : ""}`);
      }
    }
    return;
  }

  if (spec.kind === "host") {
    el(sheet, "h1", "", "Host: outfits × poses");
    el(sheet, "div", "sub", "Rendered through HFKit.rig / mountActor. Fixed face: curly hair, no glasses, skin #F0CDAE.");
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

const RAILWAY = JSON.parse(readFileSync(join(KIT, "sample", "railway-beat.json"), "utf8"));
const RAILWAY_TIMES = [[0.6, "host waves from the slot"], [1.9, "steps out, camera follows"], [3.4, "walking to the rail"], [5.6, "arrives"],
  [6.2, "hammer raised"], [6.4, "the strike on 'rail'"], [6.9, "pulse and tag race, camera follows"], [8.4, "the listener, surprised"], [11.0, "pushed in on him"]];

try {
  if (wants("world")) {
    await render({ kind: "world", fix: RAILWAY, times: RAILWAY_TIMES }, join(outDir, "world-railway.png"));
    if (framesDir) for (const [i, [t]] of RAILWAY_TIMES.entries()) await render({ kind: "world-frame", fix: RAILWAY, t }, join(framesDir, `world-railway-${i}.png`), { width: 1920, height: 1080 });
  }
  if (wants("host")) await render({
    kind: "host", outfits: ["blazer", "lab-coat", "casual", "explorer"],
    poses: [["idle", "neutral"], ["talk", "happy"], ["point-right", "curious"], ["wave", "happy"], ["think", "thinking"], ["celebrate", "happy"]],
    cycles: [["walk", "blazer", 1], ["run", "casual", 1], ["walk", "lab-coat", -1], ["jump", "explorer", 1], ["jump", "blazer", 0]],
  }, join(outDir, "host.png"));
  if (wants("effects")) {
    const T = [0.5, 0.65, 0.85, 1.1, 1.45, 2.0];
    const sky = { x: 1920, y: 820, zoom: 1.8 };
    await render({ kind: "effects", rows: [
      ["burst", { at: 0.5, x: 1920, y: 820, color: "#FFB43C" }, sky, T],
      ["rings (sound from the rail, laid on the ground plane)", { at: 0.5, x: 1500, y: 1500, count: 3, interval: 0.3, squash: 0.45, color: "#7FE3FF" }, { x: 1650, y: 1400, zoom: 1.4 }, T],
      ["rings (directional wavefront)", { at: 0.5, x: 1600, y: 820, arc: { angle: 0, spread: 70 }, count: 4, interval: 0.25, color: "#FFD43B" }, sky, T],
      ["pulse_along (the rail path)", { at: 0.5, path: [{ x: 1300, y: 1500 }, { x: 1900, y: 1500 }, { x: 2600, y: 1500 }], duration: 1.6 }, { x: 1900, y: 1380, zoom: 1.3 }, [0.5, 0.7, 1.0, 1.4, 1.9, 2.3]],
      ["speed_lines (moving right, at zoom 1)", { at: 0.5, x: 2150, y: 820, angle: 0, duration: 1.6, color: "#FFFFFF" }, { x: 1920, y: 900, zoom: 1 }, T],
      ["splash (on the lake)", { at: 0.5, x: 2240, y: 1616, color: "#7FD3F5" }, { x: 2240, y: 1480, zoom: 1.6 }, [0.5, 0.6, 0.8, 1.05, 1.4, 1.85]],
      ["sparkle", { at: 0.5, x: 1920, y: 820 }, sky, T],
      ["smoke (at zoom 1)", { at: 0.5, x: 1920, y: 1100, duration: 3 }, { x: 1920, y: 900, zoom: 1 }, [0.5, 0.8, 1.3, 2.0, 2.8, 3.8]],
      ["glow", { at: 0.5, x: 1920, y: 820, rays: 8, duration: 3 }, sky, [0.5, 0.6, 0.8, 1.2, 2.0, 3.3]],
    ] }, join(outDir, "effects.png"));
  }
  if (wants("overlays")) await render({ kind: "overlays", rows: [
    ["tag \"343 m/s\": the point runs off the right edge", [{ x: 1500, y: 500 }, { x: 1850, y: 500 }, { x: 2000, y: 500 }, { x: 2100, y: 500 }, { x: 2250, y: 500 }, { x: 2400, y: 500 }], "tag", "343 m/s"],
    ["tag \"Speed of sound\": off the top, the left and a corner", [{ x: 900, y: 140 }, { x: 900, y: -120 }, { x: -150, y: 700 }, { x: -260, y: 700 }, { x: 2060, y: 1180 }, { x: 960, y: -320 }], "tag", "Speed of sound"],
    ["label \"magma chamber\"", [{ x: 960, y: 600 }, { x: 1880, y: 600 }, { x: 2050, y: 600 }, { x: 960, y: 1060 }, { x: 960, y: 1250 }, { x: 960, y: 1380 }], "label", "magma chamber"],
  ] }, join(outDir, "overlays.png"));
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
