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
    character: "host", face: { hair: "curly", glasses: "lime-thick", skin: "#F0CDAE" }, voice: "am_adam", defaultOutfit: "blazer",
  });
  assert.equal(K.cast.host.face.skin, P.LOOK.skinTone);
});

test("the host's SVG has the thick lime glasses and uses skin #F0CDAE", () => {
  assert.equal(K.cast.host.face.glasses, "lime-thick");
  for (const outfit of ["blazer", "lab-coat"])
    for (const st of [base({ outfit }), base({ outfit, cycle: "walk", phase: 0.25, facing: 1 }), base({ outfit, cycle: "run", phase: 0.5, facing: 1 }),
      base({ outfit, cycle: "jump", phase: 0.4 }), base({ outfit, expression: "surprised" }), base({ outfit, expression: "happy" })]) {
      const svg = K.rig.svg(st, "g");
      const up = svg.toUpperCase();
      assert.ok(/data-part="glasses"[^>]*data-glasses="lime-thick"(?![^>]*display="none")/.test(svg), outfit + ": glasses group");
      assert.ok(up.includes("#B9E83A") && up.includes("#7FB51F") && up.includes("#E2FA8A"), outfit + ": translucent lime frame, edge and inner edge");
      assert.ok(/fill-rule="evenodd"/.test(svg) && !/stroke-width="1[01]\.5"/.test(svg), outfit + ": flat filled band, not a thick stroke");
      assert.ok(up.includes("#F0CDAE"), outfit + ": skin #F0CDAE");
      assert.ok(!up.includes("#E3B28A"), outfit + ": old skin");
    }
  const side = P.figureSVG({ pose: P.POSES.idle, face: P.faceAt("neutral", "neutral", 1), mouth: 0, blink: 0, t: 0,
    side: "center", width: 434, height: 288, still: true });
  assert.ok(/data-glasses="lime-thick"/.test(side) && side.toUpperCase().includes("#B9E83A") && side.toUpperCase().includes("#F0CDAE"));
});

test("clean-shaven: no stubble shading on the jaw", () => {
  const svg = K.rig.svg(base({}), "g");
  assert.ok(!/stubble/i.test(svg));
  // the old stubble path (hair colour at opacity 0.13 along the jaw) is gone
  assert.ok(!svg.includes("C 74 268 44 278 24 276"));
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
  // glasses are the host's signature: no extra has them, and the SVG of an extra has no glasses
  for (let n = 1; n <= 24; n++) {
    const e = K.cast.extra(n);
    assert.ok(!("glasses" in e.face), "extra " + n + " has a glasses field");
    assert.ok(!/data-glasses|#B9E83A/i.test(K.rig.svg(base({ character: e }), "x")), "extra " + n + " draws glasses");
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

// ---------- style-lock round: hip-length blazer, three-quarter cycles, lighting by place ----------

test("blazer is hip length; the lab coat stays long", () => {
  const R = K.rig;
  assert.ok(R.OUTFITS.blazer.coat > 860 && R.OUTFITS.blazer.coat < 920, "blazer hem " + R.OUTFITS.blazer.coat);
  assert.ok(R.OUTFITS["lab-coat"].coat > 1000, "lab coat hem " + R.OUTFITS["lab-coat"].coat);
  // the drawn coat tails stop above the hip threshold too
  const svg = R.svg(base({ outfit: "blazer" }), "b");
  const coat = /data-part="coat">(.*?)<\/g>/.exec(svg)[1];
  // coat paths use absolute M / L / C pairs only: every second number is a y
  const ys = [...coat.matchAll(/ d="([^"]+)"/g)].flatMap((m) => (m[1].match(/-?[\d.]+/g) || []).map(Number).filter((v, i) => i % 2 === 1));
  assert.ok(Math.max(...ys) < 930, "blazer coat drawn down to " + Math.max(...ys));
});

test("cycles turn the body three-quarters toward travel; a turn blend eases back to front", () => {
  const R = K.rig;
  assert.equal(R.layout(base({ cycle: "walk", phase: 0.3, facing: 1 })).turn, 1);
  assert.equal(R.layout(base({ cycle: "run", phase: 0.3, facing: -1 })).turn, -1);
  assert.equal(R.layout(base({ cycle: "walk", phase: 0.3, facing: 0 })).turn, 1, "walking with no facing goes right");
  assert.equal(R.layout(base({})).turn, 0, "standing is front-on");
  assert.equal(R.layout(base({ cycle: "walk", phase: 0.3, facing: 1, turn: 0.4 })).turn, 0.4);
  // the head leads the turn
  const front = R.head(base({})).x;
  const right = R.head(base({ cycle: "walk", phase: 0, facing: 1 })).x;
  const left = R.head(base({ cycle: "walk", phase: 0, facing: -1 })).x;
  assert.ok(right > front + 5 && left < front - 5, [left, front, right].join(" "));
  // the turn blend changes the drawing continuously
  const sv = (t) => R.svg(base({ cycle: "walk", phase: 0.2, facing: 1, turn: t }), "t");
  assert.notEqual(sv(0.5), sv(1));
  assert.notEqual(sv(0.5), sv(0));
  // cycleAmount 0 is standing still (legs as idle)
  const still = R.layout(base({ cycle: "walk", phase: 0.3, facing: 1, cycleAmount: 0, turn: 0 }));
  const idle = R.layout(base({}));
  for (const s of ["left", "right"]) {
    assert.ok(Math.abs(still.legs[s].ankle.x - idle.legs[s].ankle.x) < 1e-6 && Math.abs(still.legs[s].ankle.y - idle.legs[s].ankle.y) < 1e-6, s);
  }
  assert.ok(R.STRIDE.walk > 200 && R.STRIDE.run > R.STRIDE.walk, JSON.stringify(R.STRIDE));
  // a realistic stride: about 0.8 body heights (1260 units) a cycle, so 420 world px/s at scale 1
  // (0.3 px a unit) walks at 1.3-1.4 cycles a second
  assert.ok(R.STRIDE.walk / 1260 > 0.72 && R.STRIDE.walk / 1260 < 0.9, "walk stride " + R.STRIDE.walk);
  const cadence = 420 / (R.STRIDE.walk * 0.3);
  assert.ok(cadence >= 1.3 && cadence <= 1.45, "walk cadence " + cadence);
});

test("cycles are smooth: no pops between phases, arms swing opposite to the legs", () => {
  const R = K.rig;
  const angles = (c) => [c.legs.left.swing, c.legs.left.knee, c.legs.left.foot, c.legs.right.swing, c.legs.right.knee, c.legs.right.foot,
    c.arms.left.shoulder, c.arms.left.elbow, c.arms.right.shoulder, c.arms.right.elbow, c.lean || 0, c.nod || 0, c.sway || 0];
  for (const name of ["walk", "run", "jump"]) {
    const N = 240;
    let prev = angles(R.CYCLES[name](0)), prevLift = R.CYCLES[name](0).lift;
    for (let i = 1; i <= N; i++) {
      const c = R.CYCLES[name](i / N), a = angles(c);
      a.forEach((v, j) => assert.ok(Math.abs(v - prev[j]) < 5, `${name} jumps ${(v - prev[j]).toFixed(1)} in value ${j} at ${(i / N).toFixed(3)}`));
      assert.ok(Math.abs(c.lift - prevLift) < 12, `${name} lift pops at ${i / N}`);
      prev = a; prevLift = c.lift;
    }
  }
  for (const ph of [0.15, 0.25, 0.35, 0.65, 0.75, 0.85]) {
    const c = R.CYCLES.walk(ph);
    // left leg forward (+) -> left arm back (left shoulder +) and right arm forward (mirrored: right shoulder +)
    assert.equal(Math.sign(c.arms.left.shoulder - 3), Math.sign(c.legs.left.swing), "left arm at " + ph);
    assert.equal(Math.sign(c.arms.right.shoulder - 3), Math.sign(c.legs.left.swing), "right arm at " + ph);
  }
  // the walk bobs slightly: hips lower at contact than at passing
  const dys = Array.from({ length: 40 }, (_, i) => R.layout(base({ cycle: "walk", phase: i / 40, facing: 1 })).dy);
  const bob = Math.max(...dys) - Math.min(...dys);
  // (a full stride, about 0.8 body heights a cycle, bobs about 4.5 % of the height)
  assert.ok(bob > 6 && bob < 70, "bob " + bob);
  // the jump starts and ends standing
  for (const ph of [0, 1]) assert.ok(Math.abs(R.CYCLES.jump(ph).legs.left.knee) < 1e-6 && R.CYCLES.jump(ph).lift === 0, "jump rest at " + ph);
});

test("actor light: tint, amount and rim are deterministic and scoped to the instance", () => {
  const R = K.rig;
  const night = { tint: "#4A5C9A", amount: 0.7, rim: "#CFE0FF" };
  const a = R.svg(base({ light: night }), "s2-host-0");
  assert.equal(R.svg(base({ light: { ...night } }), "s2-host-0"), a);
  assert.notEqual(a, R.svg(base({}), "s2-host-0"));
  assert.notEqual(a, R.svg(base({ light: { tint: "#FFB68A", amount: 0.35 } }), "s2-host-0"));
  assert.match(a, /<filter id="s2-host-0-light"/);
  assert.match(a, /filter="url\(#s2-host-0-light\)"/);
  assert.match(a, /CFE0FF/i);
  // no light, or amount 0 with no rim: no filter at all
  assert.doesNotMatch(R.svg(base({}), "x"), /<filter/);
  assert.doesNotMatch(R.svg(base({ light: { tint: "#FFFFFF", amount: 0 } }), "x"), /<filter/);
  assert.throws(() => R.svg(base({ light: { tint: "blue", amount: 0.5 } }), "x"), /light/);
  // ids stay unique per instance with light on
  const ids = (p) => [...R.svg(base({ light: night }), p).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const A1 = ids("s1-host-0"), B1 = new Set(ids("s1-extra-1-0"));
  assert.ok(A1.every((id) => !B1.has(id)));
});
