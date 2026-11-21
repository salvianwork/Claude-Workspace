// npm run kit-sheet: snapshot every kit scene and prop in sample/kit-sheet/index.html at the
// moments listed in its #sheet-plan (HyperFrames `snapshot`, telemetry off, offline) and save one
// contact sheet per scene (moments side by side, half size) to docs/hf/kit-sheet-<name>.png.
//
//   npm run kit-sheet                         -> docs/hf/kit-sheet-*.png
//   npm run kit-sheet -- --frames=<dir>       also keep the full-size frames there
//   npm run kit-sheet -- --preview            also refresh props/volcano/preview.png
//
// The sheet is staged in a temp folder with the kit copied next to it (as install_kit), so the
// source folder stays clean. Needs ffmpeg on PATH for the contact sheets.
import { cpSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const kitDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}`)); return a === undefined ? undefined : a.split("=")[1] ?? true; };
const outDir = resolve(arg("out") || join(kitDir, "..", "docs", "hf"));
const keep = arg("frames") ? resolve(arg("frames")) : null;
const html = readFileSync(join(kitDir, "sample", "kit-sheet", "index.html"), "utf8");
const plan = JSON.parse(html.match(/<script id="sheet-plan" type="application\/json">([\s\S]*?)<\/script>/)[1]).scenes;

const stage = mkdtempSync(join(tmpdir(), "hf-kit-sheet-"));
try {
  const comp = join(stage, "sheet");
  for (const part of ["vendor", "src", "props"]) cpSync(join(kitDir, part), join(comp, "kit", part), { recursive: true });
  copyFileSync(join(kitDir, "sample", "kit-sheet", "index.html"), join(comp, "index.html"));
  const times = plan.flatMap((s) => s.moments.map((m) => +(s.start + m).toFixed(2)));
  const shots = join(stage, "shots");
  const cli = join(kitDir, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
  const r = spawnSync(process.execPath, [cli, "snapshot", "--at", times.join(","), "--no-end", "--output", shots, comp], {
    cwd: comp, stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const files = readdirSync(shots).filter((f) => /^frame-.*\.png$/.test(f));
  const byTime = new Map(files.map((f) => [+(f.match(/at-([0-9.]+)s/)[1]), join(shots, f)]));
  const frameAt = (t) => {
    let best = null, d = Infinity;
    for (const [k, v] of byTime) if (Math.abs(k - t) < d) { d = Math.abs(k - t); best = v; }
    if (d > 0.05) throw new Error(`no snapshot at ${t}s`);
    return best;
  };
  mkdirSync(outDir, { recursive: true });
  if (keep) mkdirSync(keep, { recursive: true });
  for (const s of plan) {
    const frames = s.moments.map((m) => frameAt(+(s.start + m).toFixed(2)));
    if (keep) frames.forEach((f, i) => copyFileSync(f, join(keep, `${s.name}-${i + 1}.png`)));
    const inputs = frames.flatMap((f) => ["-i", f]);
    const scale = frames.map((_, i) => `[${i}]scale=960:540[s${i}]`).join(";");
    const filter = `${scale};${frames.map((_, i) => `[s${i}]`).join("")}hstack=inputs=${frames.length}`;
    const out = join(outDir, `kit-sheet-${s.name}.png`);
    const f = spawnSync("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", filter, out], { stdio: "inherit" });
    if (f.status !== 0) process.exit(f.status ?? 1);
    console.log(`Done: ${out}`);
    if (s.name === "volcano" && arg("preview")) {
      const prev = join(kitDir, "props", "volcano", "preview.png");
      const p = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", frames[2], "-vf", "scale=960:540", prev], { stdio: "inherit" });
      if (p.status !== 0) process.exit(p.status ?? 1);
      console.log(`Done: ${prev}`);
    }
  }
} finally {
  rmSync(stage, { recursive: true, force: true });
}
