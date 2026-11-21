import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/kit.js";
import "../src/presenter/look.js";
import "../src/presenter/motion.js";
import "../src/presenter/poses.js";
import "../src/presenter/parts.js";
import "../src/presenter/figure.js";
import "../src/actor/rig.js";
import "../src/actor/host.js";
import "../src/actor/actor.js";

const K = globalThis.HFKit;
const P = globalThis.HFKitPresenter;
const KIT = new URL("../", import.meta.url);

const POSES = ["idle", "talk", "point-left", "point-right", "wave", "raise", "shrug", "think", "strike", "carry", "celebrate"];
const CYCLES = ["walk", "run", "jump"];
const OUTFITS = ["blazer", "lab-coat", "casual", "explorer"];
const HELD = ["hammer", "book", "phone", "pointer"];
const PRESENTER_POSES = ["idle", "talk", "point-left", "point-right", "think", "surprised", "celebrate", "wave"];

const base = (patch) => Object.assign({
  pose: "idle", outfit: "blazer", expression: "neutral", mouth: 0, blink: 0, breath: 0, facing: 0,
}, patch || {});

test("kit exposes rig, cast and mountActor; actor scripts load after the presenter", () => {
  assert.equal(typeof K.rig, "object");
  assert.equal(typeof K.cast, "object");
  assert.equal(typeof K.mountActor, "function");
  const s = K.SCRIPTS;
  for (const f of ["src/actor/rig.js", "src/actor/host.js", "src/actor/actor.js"]) {
    assert.ok(s.includes(f), f);
    assert.ok(s.indexOf(f) > s.indexOf("src/presenter/figure.js"), f + " after the presenter");
  }
  assert.ok(s.indexOf("src/actor/rig.js") < s.indexOf("src/actor/host.js"));
  assert.ok(s.indexOf("src/actor/host.js") < s.indexOf("src/actor/actor.js"));
});

test("every listed pose, cycle, outfit, held item and expression exists", () => {
  const R = K.rig;
  for (const p of POSES) assert.ok(R.POSES[p], "pose " + p);
  for (const c of CYCLES) assert.equal(typeof R.CYCLES[c], "function", "cycle " + c);
  assert.deepEqual(Object.keys(R.CYCLES).sort(), [...CYCLES].sort());
  for (const o of OUTFITS) assert.ok(R.OUTFITS[o], "outfit " + o);
  for (const hd of HELD) assert.ok(R.HELD[hd], "held " + hd);
  for (const e of Object.keys(P.EXPRESSIONS)) assert.ok(R.EXPRESSIONS[e], "expression " + e);
  assert.ok(R.EXPRESSIONS.surprised, "expression surprised");
});

test("loading the rig leaves the presenter's names untouched", () => {
  assert.deepEqual(Object.keys(P.POSES), PRESENTER_POSES);
  assert.deepEqual(P.PRESENTER_OUTFITS, ["blazer", "labcoat"]);
});

test("cycles are pure functions of the phase and return legs and arms", () => {
  for (const c of CYCLES) {
    const f = K.rig.CYCLES[c];
    for (const ph of [0, 0.13, 0.25, 0.5, 0.77, 0.999]) {
      const a = f(ph);
      assert.deepEqual(f(ph), a, c + " deterministic at " + ph);
      for (const side of ["left", "right"]) {
        assert.ok(Number.isFinite(a.legs[side].swing), c + " legs." + side + ".swing");
        assert.ok(Number.isFinite(a.legs[side].knee), c + " legs." + side + ".knee");
        assert.ok(Number.isFinite(a.arms[side].shoulder), c + " arms." + side + ".shoulder");
        assert.ok(Number.isFinite(a.arms[side].elbow), c + " arms." + side + ".elbow");
      }
    }
  }
  // walk and run loop seamlessly
  for (const c of ["walk", "run"]) {
    const a = K.rig.CYCLES[c](0), b = K.rig.CYCLES[c](1);
    assert.ok(Math.abs(a.legs.left.swing - b.legs.left.swing) < 1e-9, c + " loops");
  }
  // walking alternates the legs
  const w = K.rig.CYCLES.walk;
  assert.ok(w(0.25).legs.left.swing > 0 && w(0.75).legs.left.swing < 0);
  assert.ok(w(0.25).legs.right.swing < 0);
  // a jump leaves the ground in the middle and lands at the end
  assert.ok(K.rig.CYCLES.jump(0.55).lift > 100);
  assert.equal(K.rig.CYCLES.jump(0).lift, 0);
  assert.equal(K.rig.CYCLES.jump(1).lift, 0);
});

test("rig.svg is deterministic for the same state", () => {
  const st = base({ pose: "talk", cycle: "walk", phase: 0.3, held: "book", mouth: 0.6, blink: 0.2, breath: 0.5, facing: 1, expression: "happy" });
  const a = K.rig.svg(st, "s1-host-0");
  assert.equal(K.rig.svg(JSON.parse(JSON.stringify(st)), "s1-host-0"), a);
  assert.match(a, /^<svg[\s>]/);
  assert.notEqual(K.rig.svg(base({ outfit: "lab-coat" }), "x"), K.rig.svg(base({ outfit: "blazer" }), "x"));
});

test("rig.svg draws every pose, cycle, outfit, held item and expression", () => {
  const R = K.rig;
  const seen = new Set();
  for (const pose of Object.keys(R.POSES)) seen.add(R.svg(base({ pose }), "p"));
  for (const outfit of OUTFITS) seen.add(R.svg(base({ outfit }), "p"));
  for (const held of HELD) seen.add(R.svg(base({ held, pose: "carry" }), "p"));
  for (const expression of Object.keys(R.EXPRESSIONS)) seen.add(R.svg(base({ expression }), "p"));
  for (const cycle of CYCLES) for (const phase of [0.1, 0.6]) for (const facing of [-1, 1]) seen.add(R.svg(base({ cycle, phase, facing }), "p"));
  const n = Object.keys(R.POSES).length + OUTFITS.length + HELD.length + Object.keys(R.EXPRESSIONS).length + CYCLES.length * 4;
  assert.ok(seen.size >= n - 2, "states draw differently (" + seen.size + " of " + n + ")");
  assert.throws(() => R.svg(base({ pose: "moonwalk" }), "p"), /pose/);
  assert.throws(() => R.svg(base({ outfit: "tuxedo" }), "p"), /outfit/);
  assert.throws(() => R.svg(base({ held: "sword" }), "p"), /held/);
  assert.throws(() => R.svg(base({ cycle: "fly" }), "p"), /cycle/);
});

test("feet stand at y = 1300 in body units", () => {
  const R = K.rig;
  for (const outfit of OUTFITS) assert.ok(Math.abs(R.feet(base({ outfit })).y - 1300) < 1, outfit);
  for (const ph of [0, 0.2, 0.45, 0.7]) assert.ok(Math.abs(R.feet(base({ cycle: "walk", phase: ph, facing: 1 })).y - 1300) < 1, "walk " + ph);
  assert.ok(R.feet(base({ cycle: "jump", phase: 0.55 })).y < 1200, "in the air mid-jump");
  const hb = R.headBox(base());
  assert.ok(hb.width > 150 && hb.height > 200 && hb.y + hb.height < 400, JSON.stringify(hb));
});

test("the host's face constants are exact", () => {
  assert.deepEqual(K.cast.host, {
    character: "host", face: { hair: "curly", glasses: true, skin: "#E3B28A" }, voice: "am_adam", defaultOutfit: "blazer",
  });
  assert.equal(K.cast.host.face.skin, P.LOOK.skinTone);
});

test("cast.extra(n) is stable, varied and never the host's face", () => {
  const e1 = K.cast.extra(1);
  assert.deepEqual(K.cast.extra(1), e1);
  assert.notEqual(e1.character, "host");
  assert.notDeepEqual(e1.face, K.cast.host.face);
  const faces = new Set(), skins = new Set(), hairs = new Set(), outfits = new Set();
  for (let n = 1; n <= 24; n++) {
    const e = K.cast.extra(n);
    assert.notEqual(e.face.skin.toUpperCase(), K.cast.host.face.skin.toUpperCase(), "extra " + n + " has the host's skin");
    assert.ok(K.rig.OUTFITS[e.defaultOutfit], "extra " + n + " outfit");
    faces.add(JSON.stringify(e.face)); skins.add(e.face.skin); hairs.add(e.face.hair); outfits.add(e.defaultOutfit);
  }
  assert.ok(skins.size >= 4 && hairs.size >= 3 && outfits.size >= 3 && faces.size >= 12, "varied extras");
  // an extra draws differently from the host in the same state
  assert.notEqual(K.rig.svg(base({ character: e1 }), "a"), K.rig.svg(base({ character: K.cast.host }), "a"));
});

/* Review Focus 1: two actors on one page never share an SVG id, and every url(#...) reference
 * points at an id of its own instance. */
test("two rig.svg outputs share no id and every url(#) resolves within its own prefix", () => {
  const R = K.rig;
  const pairs = [
    [base({ character: K.cast.host, held: "hammer", pose: "raise" }), "s1-host-0"],
    [base({ character: K.cast.extra(1), outfit: "lab-coat", cycle: "walk", phase: 0.4, mouth: 0.8, held: "phone" }), "s1-extra-1-0"],
  ];
  const ids = pairs.map(([st, prefix]) => {
    const svg = R.svg(st, prefix);
    const list = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(list.length > 0, prefix + " has ids");
    assert.equal(new Set(list).size, list.length, prefix + " has duplicate ids");
    for (const id of list) assert.ok(id.startsWith(prefix + "-"), id + " lacks prefix " + prefix);
    const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
    assert.ok(refs.length > 0, prefix + " uses references");
    for (const r of refs) {
      assert.ok(r.startsWith(prefix + "-"), "url(#" + r + ") lacks prefix " + prefix);
      assert.ok(list.includes(r), "url(#" + r + ") does not resolve in " + prefix);
    }
    return new Set(list);
  });
  for (const id of ids[0]) assert.ok(!ids[1].has(id), "shared id " + id);
});

test("actor sources stay offline and deterministic", () => {
  for (const f of ["rig.js", "host.js", "actor.js"]) {
    const src = readFileSync(new URL("src/actor/" + f, KIT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3\.org)/, f);
    assert.doesNotMatch(src, /Math\.random|Date\.now|setInterval|setTimeout|requestAnimationFrame/, f);
  }
});

test("side slot is about 1.35x the old presenter", () => {
  const box = P.presenterSize("small");
  const oldK = box.height / (724 - 34); // px per body unit of the old (calm) presenter framing
  assert.ok(Math.abs(K.rig.SLOT.k / oldK - 1.35) < 0.03, "slot k " + K.rig.SLOT.k + " vs " + oldK);
});
