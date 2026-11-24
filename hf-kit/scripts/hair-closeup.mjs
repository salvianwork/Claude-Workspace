// node scripts/hair-closeup.mjs --out=<png>: head close-ups (about 4x) of the host through the rig,
// one per pose / cycle frame, side by side on a light backdrop. Used to check the curly hair has no skin
// gap between the fringe curls and the main mass (compare a run before and after a hair change).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { writeFileSync } from "node:fs";
import "../src/kit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = globalThis.HFKit.SCRIPTS.map((s) => join(KIT, s));
const a = process.argv.find((x) => x.startsWith("--out="));
const out = resolve(a ? a.slice(6) : "hair-closeup.png");

const STATES = [
  ["idle", { pose: "idle", expression: "neutral" }],
  ["talk", { pose: "talk", expression: "happy" }],
  ["think", { pose: "think", expression: "curious" }],
  ["celebrate", { pose: "celebrate", expression: "happy" }],
  ["walk 0.25", { pose: "idle", cycle: "walk", phase: 0.25, facing: 1 }],
  ["run 0.5", { pose: "idle", cycle: "run", phase: 0.5, facing: 1 }],
];
const W = 330, H = 300;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W * STATES.length, height: H }, deviceScaleFactor: 2 });
await page.goto("file://" + join(KIT, "test", "browser", "harness.html"));
for (const s of SCRIPTS) await page.addScriptTag({ path: s });
await page.evaluate(({ STATES, W, H }) => {
  const root = document.getElementById("root");
  root.style.background = "#f6ecdc"; root.style.width = W * STATES.length + "px"; root.style.height = H + "px";
  STATES.forEach(([name, st], i) => {
    const cell = document.createElement("div");
    cell.style.cssText = `position:absolute;left:${i * W}px;top:0;width:${W}px;height:${H}px;overflow:hidden`;
    const holder = document.createElement("div");
    cell.appendChild(holder); root.appendChild(cell);
    const act = window.HFKit.mountActor(holder, { id: "host", character: "host", outfit: "blazer", scale: 4, start: { x: 500, y: 1000 } }, { sceneId: i });
    act.update(1, st);
    const b = act.box(1);
    // move the actor so the head box is centred in the cell
    const dx = W / 2 - (b.x + b.width / 2), dy = H / 2 - (b.y + b.height / 2) - 10;
    holder.style.cssText = `position:absolute;left:${dx}px;top:${dy}px;width:1920px;height:1080px`;
    act.el.style.pointerEvents = "none";
    const lab = document.createElement("div");
    lab.textContent = name; lab.style.cssText = "position:absolute;left:8px;bottom:6px;font:12px sans-serif;color:#555";
    cell.appendChild(lab);
  });
}, { STATES, W, H });
writeFileSync(out, await page.screenshot());
await browser.close();
console.log("wrote", out);
