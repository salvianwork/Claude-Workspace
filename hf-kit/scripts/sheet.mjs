// npm run sheet: render the presenter character sheet (sample/presenter-sheet/index.html) to a PNG
// with HyperFrames (`hyperframes snapshot`, telemetry off, offline).
//
//   npm run sheet                        -> sample/presenter-sheet.png
//   npm run sheet -- --out=path/to.png
//
// The sheet is its own composition folder (one root composition per folder). HyperFrames only
// serves files inside it, so it is staged in a temp folder with the kit copied next to it (as
// tools.hf.render.install_kit), leaving the source folder clean.
import { cpSync, copyFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const kitDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const hit = process.argv.find((a) => a.startsWith("--out="));
const out = resolve(hit ? hit.slice(6) : join(kitDir, "sample", "presenter-sheet.png"));

const stage = mkdtempSync(join(tmpdir(), "hf-sheet-"));
try {
  const comp = join(stage, "sheet");
  for (const part of ["vendor", "src"]) cpSync(join(kitDir, part), join(comp, "kit", part), { recursive: true });
  copyFileSync(join(kitDir, "sample", "presenter-sheet", "index.html"), join(comp, "index.html"));
  const shots = join(stage, "shots");
  const cli = join(kitDir, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
  const r = spawnSync(process.execPath, [cli, "snapshot", "--at", "0", "--no-end", "--output", shots, comp], {
    cwd: comp,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const png = readdirSync(shots).find((f) => f.startsWith("frame-") && f.endsWith(".png"));
  if (!png) throw new Error("hyperframes snapshot wrote no frame");
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(join(shots, png), out);
  console.log(`Done: ${out}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
