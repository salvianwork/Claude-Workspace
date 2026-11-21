// npm run sample: copy the kit into sample/kit (as tools.hf.render.install_kit does), then
// render sample/ to sample/out.mp4 with the pinned CLI and telemetry off.
import { cpSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const kitDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sample = join(kitDir, "sample");
for (const part of ["vendor", "src"]) {
  cpSync(join(kitDir, part), join(sample, "kit", part), { recursive: true });
}
const cli = join(kitDir, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
const r = spawnSync(process.execPath, [cli, "render", "--output", "out.mp4", "--fps", "30", "--workers", "1"], {
  cwd: sample,
  stdio: "inherit",
  env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" },
});
process.exit(r.status ?? 1);
