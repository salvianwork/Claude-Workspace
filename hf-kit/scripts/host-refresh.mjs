// node scripts/host-refresh.mjs --before=<kit dir> [--out=<png>]: the owner's before / after sheet of a
// host change (sample/world-sheet/host-refresh.png). The same column is drawn twice, once with the
// kit in --before (e.g. hf-kit extracted from the base commit with `git archive <base> hf-kit | tar -x`)
// and once with this kit, then the two columns are set side by side (left before, right after):
//   4 outfits x idle / talk / point / celebrate, a walk strip, face close-ups in 4 expressions and a
//   vertical 1080 x 1920 mock frame (countryside, caption band at y 840–1020, host bottom-right).
// The "before" kit has no bottom slot: its host stands at the same feet point and body scale.
// Offline (every http(s) request is aborted); the PNG is quantized to fit in 1.5 MB.
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : undefined; };
const before = arg("before") ? resolve(arg("before")) : null;
if (!before || !existsSync(join(before, "src", "kit.js"))) {
  console.error("usage: node scripts/host-refresh.mjs --before=<kit dir with src/kit.js> [--out=<png>]");
  process.exit(2);
}
const out = resolve(arg("out") || join(KIT, "sample", "world-sheet", "host-refresh.png"));
const MAX_BYTES = 1.5 * 1024 * 1024;

/* The kit's script list, read from its own kit.js (the before kit may list other files). */
function scriptsOf(dir) {
  const src = readFileSync(join(dir, "src", "kit.js"), "utf8");
  const list = /SCRIPTS\s*=\s*\[([\s\S]*?)\]/.exec(src)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  return [...list, "places/countryside/place.js"].map((s) => join(dir, s));
}

const COL_W = 1040;
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(KIT, "vendor", "fonts", "fonts.css"))}">
<style>html,body{margin:0;background:#F6ECDC}body{font-family:Poppins,Inter,sans-serif;color:#3A2F28}
#col{width:${COL_W}px;padding:28px 24px 32px;box-sizing:border-box;background:linear-gradient(#FBF3E6,#F1E2CB)}
h1{margin:0 0 4px;font-size:40px;font-weight:700;letter-spacing:1px}h2{margin:22px 0 10px;font-size:24px;font-weight:700}
.row{display:flex;gap:10px;align-items:center;margin-bottom:10px}.rowlab{width:110px;font:700 20px Poppins,sans-serif}
.cell{position:relative;width:210px;height:300px;border-radius:14px;background:#FCF5EA;box-shadow:inset 0 0 0 2px #E6D3B5;overflow:hidden}
.wcell{width:160px;height:280px}.face{width:240px;height:290px}
.lab{position:absolute;left:0;right:0;bottom:6px;text-align:center;font:600 15px Inter,sans-serif;color:#7A6656}
.strip{display:flex;gap:8px}
.frame{position:relative;width:${1080 * 0.5}px;height:${1920 * 0.5}px;overflow:hidden;border-radius:18px;box-shadow:0 6px 22px rgba(58,47,40,.3);background:#000}
.frame>.inner{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;transform:scale(.5);transform-origin:0 0}
.note{font:500 17px Inter,sans-serif;color:#7A6656;max-width:440px;line-height:1.45}
</style></head><body><div id="col"></div></body></html>`;

function build(title) {
  const K = window.HFKit, col = document.getElementById("col");
  const el = (p, tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; p.appendChild(e); return e; };
  let n = 0;
  const actor = (cell, outfit, x, y, scale, state) => {
    n += 1;
    const holder = el(cell, "div");
    const a = K.mountActor(holder, { id: "h" + n, character: "host", outfit, scale, start: { x, y } }, { sceneId: 1 });
    a.update(1, Object.assign({ blink: 0 }, state));
    return a;
  };
  el(col, "h1", "", title);
  el(col, "h2", "", "Outfits × idle / talk / point / celebrate");
  const POSES = [["idle", "neutral", 0], ["talk", "happy", 0.55], ["point-right", "curious", 0], ["celebrate", "happy", 0.8]];
  for (const outfit of ["blazer", "lab-coat", "casual", "explorer"]) {
    const row = el(col, "div", "row");
    el(row, "div", "rowlab", outfit);
    for (const [pose, expression, mouth] of POSES) {
      const c = el(row, "div", "cell");
      actor(c, outfit, 105, 262, 0.6, { pose, expression, mouth, facing: 0 });
      el(c, "div", "lab", pose);
    }
  }
  el(col, "h2", "", "Walk (blazer, facing right)");
  const strip = el(col, "div", "strip");
  for (let i = 0; i < 6; i++) {
    const c = el(strip, "div", "cell wcell");
    actor(c, "blazer", 76, 244, 0.56, { pose: "idle", cycle: "walk", phase: i / 6, facing: 1 });
    el(c, "div", "lab", "phase " + (i / 6).toFixed(2));
  }
  el(col, "h2", "", "Face close-ups");
  const faces = el(col, "div", "strip");
  for (const [label, st] of [["neutral", { expression: "neutral" }], ["talk", { expression: "happy", mouth: 0.6 }],
    ["happy", { expression: "happy" }], ["surprised", { expression: "surprised" }]]) {
    const c = el(faces, "div", "cell face");
    const state = Object.assign({ pose: "idle", facing: 0 }, st);
    let a = actor(c, "blazer", 0, 0, 2, state), b = a.box(1);
    // same on-screen head height in both columns: the close-up compares the face design
    c.innerHTML = "";
    a = actor(c, "blazer", 0, 0, 2 * 215 / b.height, state); b = a.box(1);
    a.el.style.transform = `translate(${120 - (b.x + b.width / 2)}px, ${136 - (b.y + b.height / 2)}px)`;
    el(c, "div", "lab", label);
  }
  // vertical mock frame: 1080 x 1920, countryside, caption band at y 840–1020, host bottom-right
  el(col, "h2", "", "Vertical 1080×1920: host in the bottom-right slot");
  const row = el(col, "div", "row");
  row.style.alignItems = "flex-start"; row.style.gap = "24px";
  const wrap = el(row, "div", "frame"), inner = el(wrap, "div", "inner");
  K.setCanvas({ width: 1080, height: 1920 });
  const layers = K.placeLayers(inner, "vmock");
  const place = K.places.countryside.mount(layers, { variant: "day", idPrefix: "vmock" });
  const p = place.anchors["rail-near"](2);
  const cam = { x: p.x + 160, y: 1080, zoom: 1.05 };
  place.update(2, cam);
  const cap = el(inner, "div");
  cap.style.cssText = "position:absolute;left:110px;top:840px;width:860px;height:180px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 64px/1.2 Poppins,sans-serif;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.55),0 0 18px rgba(0,0,0,.5)";
  cap.innerHTML = "Sound races down the <span style='color:#FFD43B'>rail</span>";
  const band = el(inner, "div");
  band.style.cssText = "position:absolute;left:0;top:840px;width:1080px;height:180px;border-top:6px dashed rgba(255,255,255,.9);border-bottom:6px dashed rgba(255,255,255,.9);box-sizing:border-box";
  const host = el(inner, "div");
  host.style.cssText = "position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:50";
  cap.style.zIndex = 61;
  const light = (K.places.countryside.meta.actorLight || {}).day || null;
  const slot = K.rig.SLOT && K.rig.SLOT.bottom;
  let a;
  const st = { pose: "talk", expression: "happy", mouth: 0.5 };
  if (slot) {
    a = K.mountActor(host, { id: "vh", character: "host", start: { slot: "bottom-right" }, light }, { sceneId: 9 });
  } else { // before: no bottom slot; same feet point and body scale as the new slot
    const k = window.__slot.k, x = window.__slot.right.x, y = window.__slot.feetY;
    a = K.mountActor(host, { id: "vh", character: "host", scale: k / 0.3, start: { x, y }, light }, { sceneId: 9 });
  }
  a.update(1, st);
  const fb = a.box(1);
  const face = el(inner, "div");
  face.style.cssText = `position:absolute;left:${fb.x}px;top:${fb.y}px;width:${fb.width}px;height:${fb.height}px;outline:6px dotted rgba(230,40,40,.95)`;
  for (const e of [band, face]) e.style.zIndex = 60;
  const zone = el(inner, "div");
  zone.style.cssText = "position:absolute;left:0;top:1060px;width:1080px;height:340px;z-index:59;background:rgba(255,80,80,.16);border-top:4px solid rgba(230,40,40,.8);border-bottom:4px solid rgba(230,40,40,.8);box-sizing:border-box";
  const note = el(row, "div", "note");
  note.innerHTML = "Dashed white: caption band y 840–1020.<br>Pink band: face zone y 1060–1400.<br>Dotted red: his face box (" +
    Math.round(fb.y) + "–" + Math.round(fb.y + fb.height) + ").<br><br>He stands in the lower right, cropped by the frame bottom, below the caption band.";
  K.setCanvas(null);
}

const stage = mkdtempSync(join(tmpdir(), "hf-host-refresh-"));
const pagePath = join(stage, "page.html");
writeFileSync(pagePath, PAGE);
const browser = await chromium.launch();
const problems = [];
let slot = null;
const shots = [];
try {
  for (const [title, dir] of [["AFTER", KIT], ["BEFORE", before]]) { // after first: it knows the slot
    const page = await browser.newPage({ viewport: { width: COL_W, height: 1200 }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => problems.push(`${title}: ${e}`));
    page.on("console", (m) => { if (m.type() === "error") problems.push(`${title}: ${m.text()}`); });
    await page.route(/^https?:/, (r) => { problems.push(`${title}: network request ${r.request().url()}`); return r.abort(); });
    await page.goto(pathToFileURL(pagePath).href);
    for (const s of scriptsOf(dir)) await page.addScriptTag({ path: s });
    if (title === "AFTER") slot = await page.evaluate(() => { window.HFKit.setCanvas({ width: 1080, height: 1920 }); const b = window.HFKit.rig.SLOT.bottom; window.HFKit.setCanvas(null); return b; });
    await page.evaluate((s) => { window.__slot = s; }, slot);
    await page.evaluate(build, title);
    await page.evaluate(() => document.fonts.ready);
    const file = join(stage, title + ".png");
    await page.locator("#col").screenshot({ path: file });
    shots.push(file);
    await page.close();
  }
} finally {
  await browser.close();
}
// before | after, with a gap
const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", shots[1], "-i", shots[0], "-filter_complex",
  "[0]pad=iw+24:ih:0:0:color=0x3A2F28[l];[l][1]hstack,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a", join(stage, "sheet.png")], { stdio: "inherit" });
if (r.status !== 0) problems.push("ffmpeg failed");
else copyFileSync(join(stage, "sheet.png"), out);
rmSync(stage, { recursive: true, force: true });
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const size = statSync(out).size;
console.log(`Done: ${out} (${(size / 1048576).toFixed(2)} MB)`);
if (size > MAX_BYTES) { console.error("over 1.5 MB"); process.exit(1); }
