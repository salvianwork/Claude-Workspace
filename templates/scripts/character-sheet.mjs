// Renders the presenter character sheet (every pose, mouth shape and expression) to a PNG.
//
//   npm run character-sheet                                -> out/character-sheet.png
//   npm run character-sheet -- --props=path/to/scenes.json  -> with that video's style colours
//   npm run character-sheet -- --out=path/to/sheet.png
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const propsFile = path.resolve(arg("props", path.join(root, "fixtures", "sample-scenes.json")));
const output = path.resolve(arg("out", path.join(root, "out", "character-sheet.png")));
const inputProps = { style: JSON.parse(readFileSync(propsFile, "utf8")).style };
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
const logLevel = "error";

console.log("Bundling...");
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts") });
const composition = await selectComposition({ serveUrl, id: "CharacterSheet", inputProps, browserExecutable, logLevel });
await renderStill({ composition, serveUrl, inputProps, output, browserExecutable, logLevel });
console.log(`Done: ${path.relative(root, output) || output}`);
