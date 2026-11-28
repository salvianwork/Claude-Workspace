// Samples the face, tag and label boxes of every world scene of a built composition, in the
// browser HyperFrames renders with (puppeteer-core from hf-kit's own install), for the overlap
// report (python -m tools.hf.snapshot <run> --overlap).
//
//   node tools/hf/overlap.mjs < request.json > report.json
//
// request = {kit: "<hf-kit dir>", comp: "<04-video/hf>", browser: "<Chrome executable>", step: 0.5,
//            width, height}   (the composition size, data.json; default 1920 x 1080)
// report  = {samples: [{scene, t, boxes: [{kind: "face" | "tag" | "label" | "caption", id, x, y, w, h}]}],
//            errors: ["..."], viewport: {width, height}, canvas: {width, height} (HFKit.CANVAS),
//            safe: {x0, x1, y0, y1} (HFKit.VERTICAL.safe, the text safe zone of a vertical frame)}
//            "caption" boxes (the pill) are reported for vertical videos only.
//            t = the scene's own time (s), sampled every `step` s from 0.
// The page is opened from disk (file://); it loads nothing from the network. Each world scene is
// updated to t (mountComposition's mounted[i].update) and its boxes read with api.boxes(t).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const req = JSON.parse(readFileSync(0, "utf8"));
const require = createRequire(join(req.kit, "package.json"));
const puppeteer = require("puppeteer-core");

const browser = await puppeteer.launch({
  executablePath: req.browser, headless: true,
  args: ["--no-sandbox", "--allow-file-access-from-files", "--disable-gpu"],
});
const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: req.width || 1920, height: req.height || 1080 });
  page.on("pageerror", (e) => errors.push(String(e && e.message || e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { if (/^https?:/.test(r.url())) errors.push("network request: " + r.url()); });
  await page.goto(pathToFileURL(join(req.comp, "index.html")).href, { waitUntil: "load", timeout: 120000 });
  const out = await page.evaluate((step) => {
    const v = window.video;
    const size = { viewport: { width: window.innerWidth, height: window.innerHeight },
      canvas: window.HFKit ? { width: window.HFKit.CANVAS.width, height: window.HFKit.CANVAS.height } : null,
      safe: window.HFKit && window.HFKit.VERTICAL ? { ...window.HFKit.VERTICAL.safe } : null };
    if (!v || !v.mounted) return { samples: [], errors: ["the composition did not mount (no window.video)"], ...size };
    const samples = [], errs = [];
    v.mounted.forEach((m, i) => {
      if (!m) { errs.push("a scene failed to mount (scene index " + i + ")"); return; }
      if (m.s.kind !== "world") return;
      const n = Math.floor(m.s.duration / step + 1e-9);
      for (let k = 0; k <= n; k++) {
        const t = Math.min(+(k * step).toFixed(3), m.s.duration - 1e-3);
        m.update(t);
        samples.push({ scene: m.s.id, t: +(k * step).toFixed(3), boxes: m.api.boxes(t) });
      }
    });
    return { samples, errors: errs, ...size };
  }, req.step || 0.5);
  out.errors = errors.concat(out.errors);
  process.stdout.write(JSON.stringify(out));
} finally {
  await browser.close();
}
