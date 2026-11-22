// npm run moves-doc: write hf-kit/MOVES.md (the world-scene moves reference for the agents) from
// HFKit.MOVES. test/moves.test.js fails when MOVES.md is out of date.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => vm.runInThisContext(readFileSync(join(KIT, f), "utf8"), { filename: f });
load("src/kit.js");
for (const s of globalThis.HFKit.SCRIPTS.slice(1)) load(s);
const out = join(KIT, "MOVES.md");
writeFileSync(out, globalThis.HFKit.movesMarkdown());
console.log("Done: " + out);
