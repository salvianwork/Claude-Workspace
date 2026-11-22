// Effects, overlays and captions in a real Chromium (the preinstalled Node Playwright): every effect
// mounted twice on one page shares no SVG id and resolves every url(#...), seeking back reproduces
// its DOM, and the drawn shapes sit inside box(t) (with a small margin); a tag whose point leaves
// the frame is clamped inside the 96 px safe frame (its rendered pill, not just box) and is hidden
// from 280 px out; captions render at 60 px in a dark pill, at the bottom or (style captions) top.
//
//   node test/browser/world-kit.mjs     -> prints a JSON report, exit 1 on any failure
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "../../src/kit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPTS = globalThis.HFKit.SCRIPTS.map((s) => join(KIT, s));

function pageChecks() {
  const fails = [], K = window.HFKit, root = document.getElementById("root");
  const P = { at: 1, x: 900, y: 600 };
  const params = {
    burst: P, rings: Object.assign({ count: 3 }, P), pulse_along: { at: 1, path: [{ x: 200, y: 600 }, { x: 900, y: 500 }, { x: 1700, y: 650 }], duration: 1.5 },
    speed_lines: P, splash: P, sparkle: P, smoke: Object.assign({ duration: 2 }, P), glow: Object.assign({ rays: 6 }, P),
  };
  const NS = "http://www.w3.org/2000/svg";
  const mounts = [];
  for (const k of [0, 1]) for (const name of Object.keys(params)) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", 1920); svg.setAttribute("height", 1080);
    svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
    root.appendChild(svg);
    const prefix = `s${k + 1}-fx-${name}`;
    mounts.push({ name, prefix, svg, fx: K.effects[name](svg, params[name], prefix) });
  }
  const ids = [...root.querySelectorAll("[id]")].map((e) => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) fails.push("duplicate ids: " + dup.slice(0, 5).join(", "));
  for (const e of root.querySelectorAll("*")) for (const at of ["fill", "stroke", "filter", "clip-path"]) {
    const m = /url\(#([^)]+)\)/.exec(e.getAttribute(at) || "");
    if (m && !document.getElementById(m[1])) fails.push("unresolved url(#" + m[1] + ")");
  }
  for (const m of mounts) {
    for (const t of [1.15, 1.5, 2.1]) {
      m.fx.update(t);
      const b = m.fx.box(t), g = m.svg.firstChild;
      let bb = null;
      for (const e of g.querySelectorAll("circle,ellipse,path")) {
        if (e.closest('[visibility="hidden"]') || +e.getAttribute("opacity") === 0 || e.getAttribute("d") === "M0 0") continue;
        const r = e.getBoundingClientRect(); if (!r.width && !r.height) continue;
        bb = bb ? { x0: Math.min(bb.x0, r.x), y0: Math.min(bb.y0, r.y), x1: Math.max(bb.x1, r.x + r.width), y1: Math.max(bb.y1, r.y + r.height) } : { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height };
      }
      if (bb && b.width > 0) {
        const M = 40;
        if (bb.x0 < b.x - M || bb.y0 < b.y - M || bb.x1 > b.x + b.width + M || bb.y1 > b.y + b.height + M) fails.push(`${m.prefix} at ${t}: drawn ${JSON.stringify(bb)} outside box ${JSON.stringify(b)}`);
      }
    }
    m.fx.update(1.4); const a = m.svg.innerHTML; m.fx.update(2.6); m.fx.update(1.4);
    if (m.svg.innerHTML !== a) fails.push(m.prefix + ": DOM differs after seeking back");
  }
  // tags: rendered pill inside the safe frame
  const ov = document.createElement("div"); ov.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px"; root.appendChild(ov);
  const tag = K.overlays.tag(ov, { text: "343 m/s", target: "pulse" }, "s1-tag-0");
  for (const pt of [{ x: 1000, y: 500 }, { x: 2100, y: 500 }, { x: -150, y: 300 }, { x: 900, y: -100 }, { x: 2400, y: 500 }]) {
    const st = tag.update(2, pt), pill = ov.querySelector(".hf-tag").getBoundingClientRect();
    if (st.opacity > 0 && (pill.left < 95 || pill.top < 95 || pill.right > 1825 || pill.bottom > 985)) fails.push(`tag at ${JSON.stringify(pt)} drawn outside the safe frame: ${JSON.stringify(pill)}`);
    if (pt.x === 2400 && getComputedStyle(tag.el).visibility !== "hidden") fails.push("tag 480 px out is not hidden");
    const text = ov.querySelector(".hf-tag");
    if (text.scrollWidth > text.clientWidth + 1) fails.push("tag text overflows its pill");
  }
  // captions: 60 px pill, bottom and top
  for (const position of ["bottom", "top"]) {
    const box = document.createElement("div"); box.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px"; document.body.appendChild(box);
    const sh = K.shell(box, { style: { captions: { position } } });
    const words = [{ i: 0, text: "Sound", start: 0, end: 0.4 }, { i: 1, text: "travels", start: 0.4, end: 0.9 }, { i: 2, text: "fast", start: 0.9, end: 1.3 }];
    const cap = K.mountCaptions(sh.layers.captions, { words, style: { captions: { position } } });
    cap.update(0.5);
    const r = cap.el.getBoundingClientRect(), cs = getComputedStyle(cap.el);
    if (cs.fontSize !== "60px") fails.push(position + " caption font " + cs.fontSize);
    if (parseFloat(cs.borderTopLeftRadius) < r.height / 2 - 1) fails.push(position + " caption is not a pill");
    if (position === "bottom" && !(r.top >= sh.captionTop && r.bottom <= 1080 - 60)) fails.push("bottom caption at " + JSON.stringify(r));
    if (position === "top" && !(r.top >= 40 && r.bottom <= sh.content.y)) fails.push("top caption at " + JSON.stringify(r) + " content.y " + sh.content.y);
    box.remove();
  }
  return fails;
}

const browser = await chromium.launch();
const report = { fails: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => { if (/^https?:/.test(r.url())) errors.push("network request: " + r.url()); });
  await page.goto("file://" + join(KIT, "test", "browser", "harness.html"));
  for (const s of SCRIPTS) await page.addScriptTag({ path: s });
  report.fails = await page.evaluate(pageChecks);
  report.fails.push(...errors);
} finally { await browser.close(); }
console.log(JSON.stringify(report, null, 1));
process.exit(report.fails.length ? 1 : 0);
