// Renders one still per scene of a scenes.json file (default: the fixture) for visual checks.
//
//   npm run stills                                 -> frame 30 of each scene
//   npm run stills -- --props=path/to/scenes.json  -> another scenes file
//   npm run stills -- --frame=120                  -> another frame within each scene
//   npm run stills -- --frame=80%                  -> a fraction of each scene's length
//
// Output: out/stills/scene-<n>-<Template>.png
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const propsFile = path.resolve(arg("props", path.join(root, "fixtures", "sample-scenes.json")));
const frameArg = arg("frame", "30");
const outDir = path.resolve(arg("out", path.join(root, "out", "stills")));
const inputProps = JSON.parse(readFileSync(propsFile, "utf8"));
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;

mkdirSync(outDir, { recursive: true });

console.log("Bundling...");
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts") });
const logLevel = "error";
const puppeteerInstance = await openBrowser("chrome", { browserExecutable, logLevel });
const composition = await selectComposition({ serveUrl, id: "Video", inputProps, puppeteerInstance, logLevel });

let offset = 0;
for (const [i, scene] of inputProps.scenes.entries()) {
  const d = scene.durationInFrames;
  const local = frameArg.endsWith("%")
    ? Math.floor((d * parseFloat(frameArg)) / 100)
    : Math.min(parseInt(frameArg, 10), d - 1);
  const output = path.join(outDir, `scene-${i + 1}-${scene.template}.png`);
  await renderStill({ composition, serveUrl, inputProps, frame: offset + local, output, puppeteerInstance, logLevel });
  console.log(`scene ${i + 1} ${scene.template}: frame ${offset + local} -> ${path.relative(root, output)}`);
  offset += d;
}
await puppeteerInstance.close({ silent: true });
console.log(`Done: ${inputProps.scenes.length} stills in ${path.relative(root, outDir) || outDir}`);
