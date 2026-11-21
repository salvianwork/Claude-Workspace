// Composition runtime (src/composition.js): the pure transition timing. Mounting a whole
// composition is covered by tests/hf/test_build.py (hyperframes check / render, slow).
import { test } from "node:test";
import assert from "node:assert/strict";
import "../src/kit.js";
import "../src/timing.js";
import "../src/draw.js";
import "../src/icons.js";
import "../src/shell.js";
import "../src/stage.js";
import "../src/blocks/kinetic-center-build.js";
import "../src/blocks/transitions.js";
import "../src/scenes/common.js";
import "../src/composition.js";

const K = globalThis.HFKit;
const T = K.compositionTransition;

test("a scene enters with its own transition inside its first 0.5 s", () => {
  assert.equal(T("fade", null, 0, 5).opacity, 0);
  assert.ok(T("fade", null, 0.25, 5).opacity > 0 && T("fade", null, 0.25, 5).opacity < 1);
  assert.deepEqual(T("fade", null, 0.5, 5), { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 });
  assert.ok(T("slide", null, 0.1, 5).x > 0);
  assert.equal(T("cut", null, 0, 5).opacity, 1);
});

test("a scene leaves with the next scene's transition inside its last 0.3 s", () => {
  assert.equal(T(null, "fade", 4.7, 5).opacity, 1);
  const mid = T(null, "blur", 4.85, 5);
  assert.ok(mid.opacity < 1 && mid.blur > 0);
  assert.ok(T(null, "fade", 5, 5).opacity < 0.001);
  assert.equal(T(null, "cut", 4.99, 5).opacity, 1);
});

test("short scenes keep both transitions inside the scene", () => {
  // 0.8 s scene: entry and exit each take a quarter of it
  assert.equal(T("fade", "fade", 0.2, 0.8).opacity, 1);
  assert.equal(T("fade", "fade", 0.6, 0.8).opacity, 1);
  assert.ok(T("fade", "fade", 0.1, 0.8).opacity < 1);
});

test("composition.js loads last in HFKit.SCRIPTS", () => {
  assert.equal(K.SCRIPTS[K.SCRIPTS.length - 1], "src/composition.js");
  assert.equal(typeof K.mountComposition, "function");
});
