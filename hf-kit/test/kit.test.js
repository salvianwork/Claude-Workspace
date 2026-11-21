import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import "../src/kit.js";

const kit = globalThis.HFKit;

test("canvas is 1920x1080 at 30 fps", () => {
  assert.deepEqual(kit.CANVAS, { width: 1920, height: 1080, fps: 30 });
});

test("frames round up like the voice manifest rule", () => {
  assert.equal(kit.frames(2.1), 63);
  assert.equal(kit.frames(12.41), 373);
  assert.equal(kit.frames(3), 90);
});

test("caption band matches the Remotion layout", () => {
  assert.equal(kit.captionReserve(), 172);
  assert.equal(kit.captionTop(), 1080 - 96 - 172);
});

test("timeline is paused and registered", () => {
  const made = [];
  globalThis.gsap = { timeline: (vars) => { made.push(vars); return { vars }; } };
  const tl = kit.timeline("main", { paused: false, defaults: { ease: "none" } });
  assert.equal(made[0].paused, true);
  assert.equal(globalThis.__timelines.main, tl);
  delete globalThis.gsap;
});

test("kit sources and fonts.css reference no remote URL", () => {
  const files = [new URL("../src/kit.js", import.meta.url), new URL("../vendor/fonts/fonts.css", import.meta.url)];
  for (const f of files) assert.doesNotMatch(readFileSync(f, "utf8"), /https?:\/\//);
});

test("every font face in fonts.css ships its file", () => {
  const dir = new URL("../vendor/fonts/", import.meta.url);
  const have = new Set(readdirSync(dir));
  const css = readFileSync(new URL("fonts.css", dir), "utf8");
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 12);
  for (const u of urls) assert.ok(have.has(u), u);
});
