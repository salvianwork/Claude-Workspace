// Moves vocabulary and compiler (src/world/moves.js): HFKit.MOVES is the pinned table, and
// HFKit.compileMoves turns a world scene's beats into actor tracks, effects, overlays and camera
// keys (a pure function), with errors that name the scene, beat and move. HFKit.validateWorld adds
// the scene-level checks (place, variant, actors, cast). MOVES.md is generated from HFKit.MOVES.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/kit.js";
import "../src/timing.js";
import "../src/presenter/look.js";
import "../src/presenter/motion.js";
import "../src/presenter/poses.js";
import "../src/presenter/parts.js";
import "../src/presenter/figure.js";
import "../src/actor/rig.js";
import "../src/actor/host.js";
import "../src/actor/actor.js";
import "../src/draw.js";
import "../src/world/place.js";
import "../src/world/effects.js";
import "../src/world/overlays.js";
import "../src/world/moves.js";
import "../src/world/insides.js";
import "../src/world/world.js";
import "../places/countryside/place.js";
import "../places/lab/place.js";

const K = globalThis.HFKit;
const KIT = new URL("../", import.meta.url);

/* 30 words, 0.4 s apart from 0.3 s (word i starts at 0.3 + 0.4 i). */
const WORDS = Array.from({ length: 30 }, (_, i) => ({ i, text: "w" + i, start: +(0.3 + 0.4 * i).toFixed(3), end: +(0.3 + 0.4 * i + 0.35).toFixed(3) }));
const CAST = [{ id: "host", character: "host", outfit: "lab-coat" }];

/* The plan's pinned railway example (schema 2), as one scene. */
function railway(extra = {}) {
  return Object.assign({
    id: 1, kind: "world", place: "countryside", variant: "day",
    actors: [{ id: "host", start: { slot: "right" } }, { id: "friend", character: "extra-1", outfit: "casual", start: { anchor: "rail-far" } }],
    beats: [
      { at: { word: 0 }, action: "host waves from the side; camera pulls out over the railway",
        moves: [{ do: "gesture", who: "host", name: "wave" }, { do: "pull_out", zoom: 0.8 }] },
      { at: { word: 9 }, action: "host walks in and strikes the rail; a pulse races along it",
        moves: [{ do: "walk_to", who: "host", to: "rail-near" }, { do: "use", who: "host", prop: "hammer", at: { word: 12 } },
          { do: "pulse_along", path: "rail", from: "rail-near", to: "rail-far", speed: "fast", at: { word: 12 } },
          { do: "tag_follow", target: "pulse", text: "≈5,960 m/s" }, { do: "push_in", target: "rail-far", zoom: 2.2 }] },
    ],
    transition: "fade",
  }, extra);
}
const compile = (scene, words = WORDS, opts = {}) => K.compileMoves(scene, words, K.worldFor(scene, Object.assign({ cast: CAST }, opts)));
const errorsOf = (scene, words, opts) => compile(scene, words, opts).errors;
/* One beat with the given moves (scene id 2, beat 1 is the one under test). */
function oneBeat(moves, sceneExtra = {}) {
  return railway(Object.assign({ id: 2, beats: [{ at: { word: 0 }, moves: [{ do: "react", who: "host", expression: "happy" }] }, { at: { word: 3 }, moves }] }, sceneExtra));
}

test("HFKit.MOVES is the pinned vocabulary, by group", () => {
  const want = {
    actor: ["enter", "exit", "walk_to", "run_to", "jump", "point", "gesture", "react", "hold", "use", "say"],
    effect: ["burst", "rings", "pulse_along", "speed_lines", "splash", "sparkle", "smoke", "glow"],
    overlay: ["tag_follow", "label", "title"],
    camera: ["push_in", "pull_out", "follow", "cut", "dive", "pan_up", "pan_down"],
    custom: ["custom"],
  };
  const names = Object.values(want).flat();
  assert.deepEqual(Object.keys(K.MOVES).sort(), names.slice().sort());
  for (const [group, list] of Object.entries(want)) for (const n of list) {
    const m = K.MOVES[n];
    assert.equal(m.group, group, n);
    assert.ok(Array.isArray(m.required) && Array.isArray(m.optional), n);
    assert.equal(typeof m.doc, "string", n);
  }
  // the pinned parameters
  assert.deepEqual(K.MOVES.walk_to.required, ["who", "to"]);
  assert.deepEqual(K.MOVES.pulse_along.required, ["path"]);
  for (const p of ["from", "to", "speed"]) assert.ok(K.MOVES.pulse_along.optional.includes(p));
  assert.deepEqual(K.MOVES.tag_follow.required, ["target", "text"]);
  assert.deepEqual(K.MOVES.push_in.required, ["target", "zoom"]);
  assert.deepEqual(K.MOVES.dive.required, ["target", "into"]);
  assert.deepEqual(K.MOVES.custom.required, ["name"]);
  for (const n of ["pan_up", "pan_down"]) {
    assert.deepEqual(K.MOVES[n].required, [], n);
    assert.deepEqual(K.MOVES[n].optional, ["to", "by", "at"], n);
  }
  // every effect move is a registered effect
  for (const n of want.effect) assert.equal(typeof K.effects[n], "function", n);
  assert.ok(K.SCRIPTS.indexOf("src/world/moves.js") > K.SCRIPTS.indexOf("src/world/overlays.js"));
  assert.ok(K.SCRIPTS.indexOf("src/world/world.js") > K.SCRIPTS.indexOf("src/world/moves.js"));
  assert.ok(K.SCRIPTS.indexOf("src/world/insides.js") < K.SCRIPTS.indexOf("src/world/world.js"));
});

test("the pinned railway example compiles with no errors", () => {
  const c = compile(railway());
  assert.deepEqual(c.errors, []);
  assert.ok(c.actors.host.length > 0 && c.actors.friend.length > 0);
  assert.equal(c.effects.length, 1);
  assert.equal(c.effects[0].name, "pulse_along");
  assert.equal(c.overlays.length, 1);
  assert.ok(c.camera.length >= 3 && c.camera[0].t === 0);
  for (const k of c.camera) assert.ok(Number.isFinite(k.t) && k.frame);
});

test("each move group compiles", () => {
  K.customs.spin = { mount() { return { update() {} }; } };
  const scene = oneBeat([
    { do: "enter", who: "friend", side: "right" }, { do: "walk_to", who: "host", to: "rail-near" }, { do: "run_to", who: "friend", to: "bridge", at: { word: 8 } },
    { do: "jump", who: "friend", at: { word: 15 } }, { do: "point", who: "host", target: "barn", at: { word: 12 } }, { do: "gesture", who: "host", name: "shrug", at: { word: 14 } },
    { do: "react", who: "friend", expression: "surprised" }, { do: "hold", who: "friend", prop: "book" }, { do: "use", who: "host", prop: "hammer", at: { word: 16 } },
    { do: "say", who: "friend", at: { word: 17 } }, { do: "exit", who: "friend", side: "left", at: { word: 20 } },
    { do: "burst", target: "rail-near" }, { do: "rings", target: "host", count: 3 }, { do: "pulse_along", path: "rail" }, { do: "speed_lines", target: "friend" },
    { do: "splash", target: "lake" }, { do: "sparkle", target: "barn" }, { do: "smoke", target: "barn", duration: 2 }, { do: "glow", target: "sky", rays: 6 },
    { do: "tag_follow", target: "pulse", text: "343 m/s" }, { do: "label", target: "barn", text: "red barn" },
    { do: "push_in", target: "rail-near", zoom: 1.6 }, { do: "follow", target: "friend", at: { word: 9 } }, { do: "pull_out", zoom: 0.8, at: { word: 22 } },
    { do: "cut", target: "barn", zoom: 1.4, at: { word: 24 } }, { do: "dive", target: "lake", into: "lattice", params: { state: "liquid" }, at: { word: 25 } },
    { do: "custom", name: "spin", params: { turns: 2 } },
  ]);
  const c = compile(scene, WORDS, { customs: K.customs });
  delete K.customs.spin;
  assert.deepEqual(c.errors, []);
  assert.equal(c.effects.filter((e) => e.name !== "custom").length, 8);
  assert.equal(c.effects.filter((e) => e.name === "custom").length, 1);
  assert.deepEqual(c.overlays.map((o) => o.kind).sort(), ["label", "tag"]);
  assert.ok(c.camera.some((k) => k.cut), "cut key");
  assert.equal(c.dives.length, 1);
  assert.equal(c.dives[0].into, "lattice");
  const types = new Set(Object.values(c.actors).flat().map((e) => e.type));
  for (const ty of ["start", "move", "pose", "expression", "held", "jump", "say"]) assert.ok(types.has(ty), ty);
  // a title compiles in scene 1
  assert.deepEqual(errorsOf(railway({ beats: [{ at: { word: 0 }, moves: [{ do: "title", text: "Speed of sound" }] }] })), []);
});

test("errors name the scene, beat and move index", () => {
  assert.deepEqual(errorsOf(oneBeat([{ do: "react", who: "host", expression: "happy" }, { do: "burst", target: "barn" }, { do: "label", target: "barn", text: "barn" },
    { do: "walk_to", who: "host", to: "rail-mid" }])), ['scene 2 beat 1 move 3 (walk_to): unknown anchor "rail-mid"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "fly", who: "host" }])), ['scene 2 beat 1 move 0 (fly): unknown move "fly"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "jump", who: "bob" }])), ['scene 2 beat 1 move 0 (jump): unknown actor "bob"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "pulse_along", path: "river" }])), ['scene 2 beat 1 move 0 (pulse_along): unknown path "river"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "smoke", target: "barn" }]), WORDS, { effects: ["burst"] }), ['scene 2 beat 1 move 0 (smoke): unknown effect "smoke"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "burst", target: "moon" }])), ['scene 2 beat 1 move 0 (burst): unknown target "moon"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "walk_to", who: "host" }])), ['scene 2 beat 1 move 0 (walk_to): missing "to"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "jump", who: "host", height: 3 }])), ['scene 2 beat 1 move 0 (jump): unknown parameter "height"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "gesture", who: "host", name: "moonwalk" }])), ['scene 2 beat 1 move 0 (gesture): unknown gesture "moonwalk"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "use", who: "host", prop: "kazoo" }])), ['scene 2 beat 1 move 0 (use): unknown prop "kazoo"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "tag_follow", target: "barn", text: "a very long tag here" }])), ['scene 2 beat 1 move 0 (tag_follow): text "a very long tag here" has 5 words (at most 4)']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "dive", target: "lake", into: "atoms" }])), ['scene 2 beat 1 move 0 (dive): unknown inside "atoms"']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "dive", target: "lake", into: "lattice", params: { state: "plasma" } }])), ['scene 2 beat 1 move 0 (dive): lattice state must be solid, liquid or gas (got "plasma")']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "pull_out", zoom: 9 }])), ['scene 2 beat 1 move 0 (pull_out): zoom 9 is outside 0.6 to 5']);
  assert.deepEqual(errorsOf(oneBeat([{ do: "title", text: "Late title" }])), ['scene 2 beat 1 move 0 (title): a title belongs in scene 1 only']);
});

test("a tag on the pulse of an invalid pulse_along reports the pulse error (no crash)", () => {
  assert.deepEqual(errorsOf(oneBeat([{ do: "pulse_along", path: "road", from: "rail-near", to: "rail-far" },
    { do: "tag_follow", target: "pulse", text: "fast" }])), ['scene 2 beat 1 move 0 (pulse_along): unknown path "road"']);
});

test("a move `at` word outside the scene is an error", () => {
  assert.deepEqual(errorsOf(oneBeat([{ do: "jump", who: "host", at: { word: 99 } }])), ["scene 2 beat 1 move 0 (jump): no word 99 in this scene"]);
  assert.deepEqual(errorsOf(railway({ beats: [{ at: { word: 40 }, moves: [{ do: "jump", who: "host" }] }] })), ["scene 1 beat 0: no word 40 in this scene"]);
  const d = WORDS[29].end + 0.5;
  assert.deepEqual(errorsOf(oneBeat([{ do: "jump", who: "host", at: { t: 30 } }])), [`scene 2 beat 1 move 0 (jump): at 30.00 s is after the scene ends (${d.toFixed(2)} s)`]);
});

test("a beat with no moves is an error (show, don't tell)", () => {
  assert.deepEqual(errorsOf(railway({ beats: [{ at: { word: 0 }, action: "host explains", moves: [] }] })), ["scene 1 beat 0: no moves (show, don't tell)"]);
  assert.deepEqual(errorsOf(railway({ beats: [{ at: { word: 0 }, action: "host explains" }] })), ["scene 1 beat 0: no moves (show, don't tell)"]);
  assert.deepEqual(errorsOf(railway({ beats: [] })), ["scene 1: no beats"]);
});

test("custom without a registered HFKit.customs[name] is an error", () => {
  assert.deepEqual(errorsOf(oneBeat([{ do: "custom", name: "volcano-blast" }])),
    ['scene 2 beat 1 move 0 (custom): no HFKit.customs["volcano-blast"] (register it in 04-video/hf/scenes/scene-2.js)']);
});

test("walk_to and run_to durations come from the distance (420 / 640 world px/s)", () => {
  assert.deepEqual(K.MOTION, { walk: 420, run: 640, ramp: 0.3, turn: 0.25 });
  const c = compile(oneBeat([{ do: "walk_to", who: "friend", to: "rail-near" }, { do: "run_to", who: "friend", to: "barn", at: { word: 20 } }]));
  assert.deepEqual(c.errors, []);
  const A = K.places.countryside.anchorsFor({ variant: "day" }).anchors;
  const far = A["rail-far"](0), near = A["rail-near"](0), barn = A.barn(0);
  const [walk, run] = c.actors.friend.filter((e) => e.type === "move");
  const d1 = Math.hypot(near.x - far.x, near.y - far.y), d2 = Math.hypot(barn.x - near.x, barn.y - near.y);
  assert.equal(walk.gait, "walk");
  assert.ok(Math.abs(walk.t - WORDS[3].start) < 1e-9);
  assert.ok(Math.abs(walk.t1 - walk.t - (d1 / 420 + 0.3)) < 1e-6, `walk ${walk.t1 - walk.t} vs ${d1 / 420 + 0.3}`);
  assert.ok(Math.abs(run.t1 - run.t - (d2 / 640 + 0.3)) < 1e-6);
  // feet never slide: the cycle phase advances by distance / (STRIDE * px per body unit)
  const k = K.mountActor.WORLD_K || 0.3;
  const a = K.actorAt(c.actors.friend, walk.t + 1.2), b = K.actorAt(c.actors.friend, walk.t + 2.2);
  assert.equal(a.state.cycle, "walk");
  const moved = Math.hypot(b.x - a.x, b.y - a.y);
  assert.ok(Math.abs((b.state.phase - a.state.phase) - moved / (K.rig.STRIDE.walk * k * a.scale)) < 1e-6);
  assert.ok(Math.abs(moved - 420) < 1e-6, "cruising at 420 px/s, got " + moved);
  // turning into and out of the walk is eased, and he stands front-on once he has stopped
  assert.equal(K.actorAt(c.actors.friend, walk.t).state.turn, 0);
  assert.ok(Math.abs(K.actorAt(c.actors.friend, walk.t + 0.5).state.turn) === 1);
  const mid = K.actorAt(c.actors.friend, walk.t + 0.12).state.turn;
  assert.ok(mid < 0 && mid > -1, "eased turn " + mid);
  assert.equal(K.actorAt(c.actors.friend, walk.t1 + 0.5).state.turn, 0);
  assert.equal(K.actorAt(c.actors.friend, walk.t1 + 0.5).state.cycleAmount, 0);
});

test("camera: push-ins land on their word, within the limits; a dive pushes to zoom >= 3 then cuts inside", () => {
  const scene = oneBeat([{ do: "react", who: "host", expression: "happy" }, { do: "push_in", target: "rail-far", zoom: 2, at: { word: 25 } }]);
  const c = compile(scene);
  assert.deepEqual(c.errors, []);
  const land = WORDS[25].start, far = K.places.countryside.anchorsFor({}).anchors["rail-far"](0);
  const cam = (t) => K.worldCamera(c, t);
  const at = cam(land);
  assert.ok(Math.abs(at.zoom - 2) < 1e-6, "zoom " + at.zoom);
  // the target is framed in the middle, just below centre (55 % of the height), clear of the captions
  const sp = K.worldMath.toScreen(far, at);
  assert.ok(Math.abs(sp.x - 960) < 1 && Math.abs(sp.y - 594) < 1, JSON.stringify(sp));
  assert.ok(cam(land - 1.5).zoom < 1.98, "still moving before the word");
  for (let t = 0; t < land; t += 1 / 30) { // multiplicative zoom rate <= 2.5x/s
    const r = Math.abs(Math.log(cam(t + 1 / 30).zoom / cam(t).zoom)) * 30;
    assert.ok(r <= Math.log(2.5) * 1.02, `zoom rate ${r} at ${t}`);
  }
  // dive
  const dv = compile(oneBeat([{ do: "dive", target: "lake", into: "lattice", params: { state: "solid" } }]));
  assert.deepEqual(dv.errors, []);
  const d = dv.dives[0];
  assert.ok(d.zoom >= 3);
  assert.ok(d.t1 > d.t0);
  const before = K.worldCamera(dv, d.t1 - 1 / 60), after = K.worldCamera(dv, d.t1 + 0.01);
  assert.ok(before.zoom > 2.9 && !before.inside, JSON.stringify(before));
  assert.equal(after.inside, "lattice");
  for (let t = d.t0; t < d.t1 - 1 / 30; t += 1 / 30) {
    const r = Math.abs(Math.log(K.worldCamera(dv, t + 1 / 30).zoom / K.worldCamera(dv, t).zoom)) * 30;
    assert.ok(r <= Math.log(4) * 1.02, `dive zoom rate ${r}`);
  }
  // overrun is reported against the scene duration
  // (a camera move never starts before its beat: a big push-in in a late beat runs past the end)
  const lateScene = railway({ id: 2, beats: [{ at: { word: 0 }, moves: [{ do: "react", who: "host", expression: "happy" }] }, { at: { word: 25 }, moves: [{ do: "push_in", target: "rail-far", zoom: 5 }] }] });
  const late = compile(lateScene);
  assert.ok(late.overrun > 0.25, "overrun " + late.overrun);
  assert.ok(K.validateWorld(lateScene, WORDS, { cast: CAST }).some((e) => /^scene 2: camera finishes/.test(e)));
  assert.ok(compile(scene).overrun <= 0.25);
  // the pinned beat (0.4 s words): the 2.2x push-in on rail-far crops the listener standing there, and
  // the strike slips well past "word 12" while the host is still walking: warnings, not errors
  const pinned = compile(railway(), WORDS, { duration: 20 });
  assert.deepEqual(pinned.errors, []);
  assert.equal(pinned.warnings.length, 2, pinned.warnings.join("\n"));
  assert.ok(pinned.warnings.some((w) => /^scene 1 beat 1 move 4 \(push_in\): zoom 2.2 on "rail-far" crops "friend" standing there \(at most 1\.\d\d shows all of them; or push_in on "friend"\)$/.test(w)), pinned.warnings.join("\n"));
  const slip = pinned.warnings.find((w) => w.startsWith("scene 1 beat 1 move 1 (use): the strike lands "));
  assert.match(slip, /^scene 1 beat 1 move 1 \(use\): the strike lands \d+\.\d\d s after its word \("host" is still on the way\): start the walk_to earlier \(at word \d+\) or use run_to$/);
  // a zoom that fits him, and a walk started early enough: no warnings
  const fixed = railway({ beats: [Object.assign({}, railway().beats[0], { moves: railway().beats[0].moves.concat([{ do: "walk_to", who: "host", to: "rail-near", at: { word: 1 } }]) }),
    Object.assign({}, railway().beats[1], { moves: railway().beats[1].moves.slice(1, 4).concat([{ do: "push_in", target: "rail-far", zoom: 1.4 }]) })] });
  const fw = compile(fixed, WORDS, { duration: 20 });
  assert.deepEqual(fw.errors, []);
  assert.deepEqual(fw.warnings, []);
});

test("the pulse tag rides the effect's own anchor, and the pulse runs from `from` to `to`", () => {
  const c = compile(railway());
  const fx = c.effects[0], A = K.places.countryside.anchorsFor({}).anchors;
  const p0 = fx.params.path[0], p1 = fx.params.path[fx.params.path.length - 1];
  assert.ok(Math.abs(p0.x - A["rail-near"](0).x) < 1 && Math.abs(p1.x - A["rail-far"](0).x) < 1);
  // he strikes when he has arrived (not mid-walk), and the pulse leaves when the hammer hits
  const walk = c.actors.host.find((e) => e.type === "move"), strike = c.actors.host.find((e) => e.type === "pose" && e.pose === "strike");
  assert.ok(strike.t >= walk.t1 + 0.4, `strike ${strike.t} after arriving ${walk.t1}`);
  assert.ok(strike.t > WORDS[12].start);
  assert.equal(fx.params.at, strike.t);
  const tag = c.overlays[0];
  assert.equal(tag.at, fx.params.at, "a tag on the pulse appears with the pulse");
  // with time to arrive, the strike lands on its own word
  const early = compile(railway({ beats: [{ at: { word: 0 }, moves: [{ do: "walk_to", who: "friend", to: "bridge" }] },
    { at: { word: 25 }, moves: [{ do: "use", who: "friend", prop: "hammer", at: { word: 26 } }, { do: "burst", target: "bridge", at: { word: 26 } }] }] }));
  assert.equal(early.actors.friend.find((e) => e.pose === "strike").t, WORDS[26].start);
  assert.equal(early.effects[0].at, WORDS[26].start);
  assert.ok(tag.until > tag.at);
});

test("compileMoves is pure and deterministic; validateWorld checks the scene", () => {
  const s = railway(), copy = JSON.parse(JSON.stringify(s));
  const strip = (c) => JSON.parse(JSON.stringify(c));
  assert.deepEqual(strip(compile(s)), strip(compile(s)));
  assert.deepEqual(s, copy, "the scene is not mutated");
  const src = readFileSync(new URL("src/world/moves.js", KIT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /document|window\.|Math\.random|Date\.now/);
  // the pinned beat fits a 12 s scene now (its push-in takes under 2 s, alongside the strike)
  assert.deepEqual(K.validateWorld(railway(), WORDS, { cast: CAST }), []);
  assert.deepEqual(K.validateWorld(railway({ place: "moon-base" }), WORDS, { cast: CAST }), ['scene 1: unknown place "moon-base"']);
  assert.deepEqual(K.validateWorld(railway({ variant: "x" }), WORDS, { cast: CAST }), ['scene 1: place countryside: unknown variant "x"']);
  assert.deepEqual(K.validateWorld(railway({ actors: [{ id: "host", start: { anchor: "attic" } }] }), WORDS, { cast: CAST }).slice(0, 1), ['scene 1 actor host: unknown anchor "attic"']);
  assert.deepEqual(K.validateWorld(railway({ actors: [{ id: "host", start: { slot: "right" } }, { id: "bob", start: { slot: "left" } }] }), WORDS, { cast: CAST }).slice(0, 1),
    ['scene 1 actor bob: not in the cast (add it to "cast", or give it a character "extra-<n>")']);
  assert.deepEqual(K.validateWorld(railway(), WORDS, { cast: [] }).slice(0, 1), ['cast: needs the host (character "host")']);
});

test("MOVES.md is generated from HFKit.MOVES and up to date (npm run moves-doc)", () => {
  const md = readFileSync(new URL("MOVES.md", KIT), "utf8");
  assert.equal(md, K.movesMarkdown(), "hf-kit/MOVES.md is out of date: run npm run moves-doc in hf-kit/");
  for (const n of Object.keys(K.MOVES)) assert.ok(md.includes("`" + n + "`"), n);
  const pkg = JSON.parse(readFileSync(new URL("package.json", KIT), "utf8"));
  assert.ok(pkg.scripts["moves-doc"]);
});

test("insides: lattice (solid, liquid, gas) and cells", () => {
  assert.deepEqual(Object.keys(K.insides).sort(), ["cells", "lattice"]);
  assert.deepEqual(K.insides.lattice.meta.params.state, ["solid", "liquid", "gas"]);
});

test("the camera follows a walker by default, keeps a slot step-in readable, and push-ins run alongside the strike", () => {
  const A = K.places.countryside.anchorsFor({}).anchors;
  // no camera moves: the camera follows the friend walking to the bridge
  const walk = compile(railway({ beats: [{ at: { word: 0 }, moves: [{ do: "walk_to", who: "friend", to: "bridge", at: { word: 2 } }] }] }));
  assert.deepEqual(walk.errors, []);
  const w = walk.actors.friend.find((e) => e.type === "move");
  for (const t of [w.t + 1.2, (w.t + w.t1) / 2, w.t1 + 0.5]) {
    const a = K.actorAt(walk.actors.friend, t), cam = K.worldCamera(walk, t), sp = K.worldMath.toScreen(a, cam);
    assert.ok(Math.abs(sp.x - 960) < 160, `friend on screen at ${sp.x.toFixed(0)} (t ${t.toFixed(2)})`);
  }
  // the host stepping out of the side slot stays at least ~45 % of the frame height on screen
  const step = compile(railway({ beats: [{ at: { word: 0 }, moves: [{ do: "walk_to", who: "host", to: "rail-near", at: { word: 1 } }] }] }));
  const sm = step.actors.host.find((e) => e.type === "move");
  for (let t = sm.t; t <= sm.t1; t += 0.05) {
    const a = K.actorAt(step.actors.host, t), cam = K.worldCamera(step, t);
    const blend = Math.min(1, a.u / 0.25), slotH = K.rig.SLOT.k * K.worldMath.TOP, worldH = 0.3 * a.scale * cam.zoom * K.worldMath.TOP;
    const h = slotH + (worldH - slotH) * blend * blend * (3 - 2 * blend); // as world.js blends it
    assert.ok(h >= 0.45 * 1080 * 0.97, `host ${h.toFixed(0)} px tall at ${t.toFixed(2)}`);
  }
  // a push-in without `at` starts on the beat's strike, not after the beat's walk
  const c = compile(railway(), WORDS, { duration: 20 });
  const strike = c.actors.host.find((e) => e.pose === "strike").t;
  const hold = c.camera.filter((k) => k.t <= strike + 1e-6).pop(), next = c.camera.find((k) => k.t > strike + 1e-6);
  assert.ok(Math.abs(hold.t - strike) < 1e-6, `the push-in starts on the strike (${hold.t} vs ${strike})`);
  assert.ok(next.frame.zoom === 2.2 && next.t - strike < 2.2, `and lands ${(next.t - strike).toFixed(2)} s later`);
  void A;
});

test("a frame edge cutting an actor's head where the camera lands is a warning", () => {
  const c = compile(oneBeat([{ do: "cut", target: "rail-far", zoom: 2.2 }]));
  assert.deepEqual(c.errors, []);
  assert.ok(c.warnings.some((x) => /^scene 2 beat 1 move 0 \(cut\): the frame edge cuts "friend"'s head where the camera lands \(\d+\.\d\d s\)/.test(x)), c.warnings.join("\n"));
  assert.deepEqual(compile(oneBeat([{ do: "cut", target: "rail-far", zoom: 1 }])).warnings, []);
});

test("the side-slot host talks while the narration speaks (talk rest, gently varied, deterministic)", () => {
  // narration spans: words closer than 0.7 s join one span
  assert.deepEqual(K.narrationSpans(WORDS), [[0.3, 12.25]]);
  const gap = [{ i: 0, start: 0.2, end: 0.6 }, { i: 1, start: 0.9, end: 1.2 }, { i: 2, start: 3, end: 3.4 }];
  assert.deepEqual(K.narrationSpans(gap), [[0.2, 1.2], [3, 3.4]]);
  const scene = railway({ id: 3, beats: [
    { at: { word: 0 }, moves: [{ do: "react", who: "host", expression: "happy" }] },
    { at: { word: 10 }, moves: [{ do: "gesture", who: "host", name: "think" }] },
  ] });
  const c = compile(scene), host = c.actors.host;
  assert.ok(host.some((e) => e.type === "narration"), "the host's track carries the narration spans");
  assert.ok(!c.actors.friend.some((e) => e.type === "narration"), "an extra does not narrate");
  // speaking, no other pose: idle rests most of the way to talk, and the amount varies gently
  const ks = [1, 1.8, 2.6, 3.4, 4.1].map((t) => K.actorAt(host, t).state);
  for (const st of ks) {
    assert.equal(st.pose, "idle");
    assert.equal(st.rest.pose, "talk");
    assert.ok(st.rest.k >= 0.6 && st.rest.k <= 1, String(st.rest.k));
  }
  assert.ok(new Set(ks.map((st) => st.rest.k)).size > 1, "the talk rest varies");
  // eased in at the start (before the first word), gone well after the narration
  assert.equal(K.actorAt(host, 0).state.rest, undefined);
  assert.equal(K.actorAt(host, 13.5).state.rest, undefined);
  // a gesture still wins while it runs (blending from and back to the talk rest)
  const g = K.actorAt(host, WORDS[10].start + 1).state;
  assert.equal(g.pose, "think");
  // deterministic: the same scene compiles to the same states
  const again = compile(scene).actors.host;
  for (const t of [0.5, 2.2, 4.4, 6.6]) assert.deepEqual(K.actorAt(again, t).state, K.actorAt(host, t).state);
});

test("the talk rest is for the side slot only: a host in the world, or walking, rests idle", () => {
  const inWorld = railway({ id: 4, actors: [{ id: "host", start: { anchor: "rail-near" } }],
    beats: [{ at: { word: 0 }, moves: [{ do: "react", who: "host", expression: "happy" }] }] });
  const c = compile(inWorld);
  assert.equal(K.actorAt(c.actors.host, 3).state.rest, undefined);
  const walks = compile(railway({ id: 5 }));
  const walk = walks.actors.host.find((e) => e.type === "move");
  assert.equal(K.actorAt(walks.actors.host, walk.t + 0.5).state.rest, undefined);
  assert.equal(K.actorAt(walks.actors.host, walk.t1 + 0.5).state.rest, undefined);
});

test("rig: state.rest blends idle toward its pose (k 0 = idle, more k = closer to that pose)", () => {
  const R = K.rig, base = { outfit: "explorer", expression: "happy", mouth: 0, blink: 0, breath: 0 };
  const idle = R.svg(Object.assign({ pose: "idle" }, base), "p");
  const talk = R.svg(Object.assign({ pose: "talk" }, base), "p");
  assert.equal(R.svg(Object.assign({ pose: "idle", rest: { pose: "talk", k: 0 } }, base), "p"), idle);
  assert.notEqual(R.svg(Object.assign({ pose: "idle", rest: { pose: "talk", k: 1 } }, base), "p"), idle);
  const half = R.svg(Object.assign({ pose: "idle", rest: { pose: "talk", k: 0.5 } }, base), "p");
  assert.notEqual(half, idle); assert.notEqual(half, talk);
  // another pose ignores the rest; blending out of it lands on the rest
  assert.equal(R.svg(Object.assign({ pose: "wave", rest: { pose: "talk", k: 1 } }, base), "p"), R.svg(Object.assign({ pose: "wave" }, base), "p"));
  assert.throws(() => R.svg(Object.assign({ pose: "idle", rest: { pose: "nope", k: 1 } }, base), "p"), /unknown pose nope/);
});

test("point at another actor: he points toward that actor (no crash before the tracks exist)", () => {
  // host at rail-near, the friend at rail-far (to his right)
  const scene = railway({ id: 6, actors: [{ id: "host", start: { anchor: "rail-near" } }, { id: "friend", character: "extra-1", outfit: "casual", start: { anchor: "rail-far" } }],
    beats: [{ at: { word: 0 }, moves: [{ do: "point", who: "host", target: "friend", at: { word: 2 } }, { do: "point", who: "friend", target: "host", at: { word: 2 } }] }] });
  const c = compile(scene);
  assert.deepEqual(c.errors, []);
  const near = K.places.countryside.anchorsFor({ variant: "day" }).anchors;
  const right = near["rail-far"](0).x > near["rail-near"](0).x;
  assert.equal(K.actorAt(c.actors.host, WORDS[2].start + 0.5).state.pose, right ? "point-right" : "point-left");
  assert.equal(K.actorAt(c.actors.friend, WORDS[2].start + 0.5).state.pose, right ? "point-left" : "point-right");
});

// ---- extended places (vertical): the camera stays inside the taller world (Review Focus 4) ----
test("vertical: an extended place is a 3840x3600 world and a 0.6x pull-out at its top or bottom never shows past the edge", () => {
  K.setCanvas(K.FORMATS.vertical);
  try {
    const scene = railway({
      id: 7,
      actors: [{ id: "host", start: { slot: "right" } }],
      beats: [
        { at: { word: 0 }, moves: [{ do: "cut", target: "sky", zoom: 0.6 }, { do: "gesture", who: "host", name: "wave" }] },
        { at: { word: 6 }, moves: [{ do: "push_in", target: "sky", zoom: 1.2 }] },
        { at: { word: 12 }, moves: [{ do: "cut", target: "lake", zoom: 0.6 }] },
        { at: { word: 18 }, moves: [{ do: "pull_out", target: "lake", zoom: 0.6, from: 1 }] },
      ],
    });
    const w = K.worldFor(scene, { cast: CAST });
    assert.equal(w.extended, true);
    assert.deepEqual(w.bounds, { width: 3840, height: 3600 });
    assert.deepEqual(w.anchors.sky(0), { x: 1920, y: 560 + 720 }, "anchors move down by the top extension");
    const c = K.compileMoves(scene, WORDS, w);
    assert.deepEqual(c.errors, []);
    let top = Infinity, bottom = -Infinity;
    for (let t = 0; t <= c.duration; t += 0.05) {
      const cam = K.worldCamera(c, t), hx = 540 / cam.zoom, hy = 960 / cam.zoom;
      assert.ok(cam.x - hx >= -1e-6 && cam.x + hx <= 3840 + 1e-6, `t=${t.toFixed(2)}: view x past the edge ${JSON.stringify(cam)}`);
      assert.ok(cam.y - hy >= -1e-6 && cam.y + hy <= 3600 + 1e-6, `t=${t.toFixed(2)}: view y past the edge ${JSON.stringify(cam)}`);
      top = Math.min(top, cam.y - hy); bottom = Math.max(bottom, cam.y + hy);
    }
    // the shots really reach both edges of the tall world (so the clamp was exercised)
    assert.ok(top < 1, "reaches the top: " + top);
    assert.ok(bottom > 3599, "reaches the bottom: " + bottom);
    // landscape: the same place mounts as today (no extension, 3840 x 2160)
    K.setCanvas(K.FORMATS.landscape);
    const l = K.worldFor(scene, { cast: CAST });
    assert.equal(l.extended, false);
    assert.deepEqual(l.bounds, { width: 3840, height: 2160 });
    assert.deepEqual(l.anchors.sky(0), { x: 1920, y: 560 });
  } finally { K.setCanvas(null); }
});

test("vertical: a place without meta.extend keeps the 3840x2160 world; extended can be forced off", () => {
  K.setCanvas(K.FORMATS.vertical);
  try {
    const fake = { meta: { name: "flat", variants: ["a"], anchors: [], paths: [] }, anchorsFor: () => ({ anchors: {}, paths: {} }), mount() {} };
    const w = K.worldFor({ id: 1, place: "flat", actors: [] }, { places: { flat: fake } });
    assert.equal(w.extended, false);
    assert.deepEqual(w.bounds, { width: 3840, height: 2160 });
    const off = K.worldFor(railway(), { cast: CAST, extended: false });
    assert.equal(off.extended, false);
    assert.deepEqual(off.anchors.sky(0), { x: 1920, y: 560 });
  } finally { K.setCanvas(null); }
});

// ---- vertical camera: pan_up / pan_down, and the anchor-spread warning (Task 6) ----
function vertical(fn) {
  K.setCanvas(K.FORMATS.vertical);
  try { return fn(); } finally { K.setCanvas(null); }
}
function panScene(moves, first = [{ do: "cut", target: "lake", zoom: 1 }]) {
  return railway({ id: 5, actors: [{ id: "host", start: { slot: "right" } }],
    beats: [{ at: { word: 0 }, moves: [{ do: "gesture", who: "host", name: "wave" }, ...first] }, { at: { word: 8 }, moves }] });
}
function viewOf(c, t) { const cam = K.worldCamera(c, t); return { cam, top: cam.y - 960 / cam.zoom, bottom: cam.y + 960 / cam.zoom }; }

test("pan_up by N world px moves the view up N at the same zoom, within the pan limit", () => vertical(() => {
  const c = compile(panScene([{ do: "pan_up", by: 900 }]));
  assert.deepEqual(c.errors, []);
  const before = K.worldCamera(c, WORDS[8].start - 0.05), after = K.worldCamera(c, c.duration);
  assert.ok(Math.abs(after.zoom - before.zoom) < 1e-6, "zoom unchanged");
  assert.ok(Math.abs(after.x - before.x) < 1e-6, "no sideways drift");
  assert.ok(Math.abs(before.y - after.y - 900) < 1, `moved up ${before.y - after.y}`);
  let peak = 0;
  for (let t = WORDS[8].start; t < c.duration; t += 1 / 30) { // world px/s x zoom <= 0.6 x 3840 (the pan limit)
    const a = K.worldCamera(c, t), b = K.worldCamera(c, t + 1 / 30);
    peak = Math.max(peak, Math.hypot(b.x - a.x, b.y - a.y) * 30 * a.zoom);
  }
  assert.ok(peak <= 0.6 * 3840 * 1.02, `pan speed ${peak}`);
  assert.ok(peak > 100, "it really moves");
}));

test("pan_down mirrors pan_up; `to` frames an anchor (below centre, like a push-in)", () => vertical(() => {
  const down = compile(panScene([{ do: "pan_down", by: 700 }], [{ do: "cut", target: "sky", zoom: 1 }]));
  assert.deepEqual(down.errors, []);
  const b = K.worldCamera(down, WORDS[8].start - 0.05), a = K.worldCamera(down, down.duration);
  assert.ok(Math.abs(a.y - b.y - 700) < 1, `moved down ${a.y - b.y}`);
  const to = compile(panScene([{ do: "pan_down", to: "lake" }], [{ do: "cut", target: "sky", zoom: 1 }]));
  assert.deepEqual(to.errors, []);
  const lake = K.worldFor(panScene([]), { cast: CAST }).anchors.lake(0), end = K.worldCamera(to, to.duration);
  const sp = K.worldMath.toScreen(lake, end);
  assert.ok(Math.abs(sp.x - 540) < 1 && Math.abs(sp.y - 1056) < 1.5, JSON.stringify(sp));
  assert.ok(end.y > K.worldCamera(to, WORDS[8].start - 0.05).y, "moved down");
}));

test("pan_up / pan_down stop at the world edge (the camera clamps to world.bounds)", () => vertical(() => {
  for (const [name, edge] of [["pan_up", "top"], ["pan_down", "bottom"]]) {
    const c = compile(panScene([{ do: name, by: 99999 }], [{ do: "cut", target: "lake", zoom: 0.6 }]));
    assert.deepEqual(c.errors, [], name);
    for (let t = 0; t <= c.duration; t += 0.05) {
      const { top, bottom } = viewOf(c, t);
      assert.ok(top >= -1e-6 && bottom <= 3600 + 1e-6, `${name} t=${t.toFixed(2)}: ${top}..${bottom}`);
    }
    const end = viewOf(c, c.duration);
    assert.ok(edge === "top" ? end.top < 1 : end.bottom > 3599, `${name} reaches the ${edge}`);
  }
}));

test("pan moves are checked: to or by (not both), an anchor, a positive number, no zoom", () => {
  const errs = (mv) => K.validateWorld(panScene([mv]), WORDS, { cast: CAST });
  assert.ok(errs({ do: "pan_up" }).some((e) => /^scene 5 beat 1 move 0 \(pan_up\): needs `to`/.test(e)));
  assert.ok(errs({ do: "pan_up", to: "sky", by: 5 }).some((e) => /needs `to`/.test(e)));
  assert.ok(errs({ do: "pan_down", to: "nowhere" }).some((e) => /unknown anchor "nowhere"/.test(e)));
  assert.ok(errs({ do: "pan_down", by: -3 }).some((e) => /`by` must be a number of world px above 0/.test(e)));
  assert.ok(errs({ do: "pan_down", by: 3, zoom: 2 }).some((e) => /unknown parameter "zoom"/.test(e)));
  assert.deepEqual(errs({ do: "pan_up", by: 300 }), []);
});

test("pan_up after a push_in keeps its zoom, and a later pull_out is not undone by it", () => vertical(() => {
  const c = compile(railway({ id: 6, actors: [{ id: "host", start: { slot: "right" } }], beats: [
    { at: { word: 0 }, moves: [{ do: "gesture", who: "host", name: "wave" }, { do: "cut", target: "lake", zoom: 1.5 }] },
    { at: { word: 8 }, moves: [{ do: "pan_up", by: 500 }] },
    { at: { word: 16 }, moves: [{ do: "pull_out", zoom: 1 }] }] }));
  assert.deepEqual(c.errors, []);
  assert.ok(Math.abs(K.worldCamera(c, WORDS[15].start).zoom - 1.5) < 1e-6, "the pan keeps zoom 1.5");
  const y15 = K.worldCamera(c, WORDS[15].start).y, yEnd = K.worldCamera(c, c.duration).y;
  assert.ok(Math.abs(y15 - yEnd) < 400, `the pull-out stays where the pan left it (${y15} -> ${yEnd})`);
}));

test("Review Focus 2: anchors far apart in one vertical beat warn, naming scene, beat and spread", () => {
  const far = railway({ id: 3, actors: [{ id: "host", start: { slot: "right" } }], beats: [
    { at: { word: 0 }, moves: [{ do: "gesture", who: "host", name: "wave" }] },
    { at: { word: 6 }, moves: [{ do: "walk_to", who: "host", to: "rail-near" }, { do: "burst", target: "barn" }] }] });
  const near = railway({ id: 3, actors: [{ id: "host", start: { slot: "right" } }], beats: [
    { at: { word: 0 }, moves: [{ do: "gesture", who: "host", name: "wave" }] },
    { at: { word: 6 }, moves: [{ do: "walk_to", who: "host", to: "rail-near" }, { do: "burst", target: "rail-near" }] },
    { at: { word: 14 }, moves: [{ do: "pan_up", by: 400 }, { do: "burst", target: "barn" }] }] });
  vertical(() => {
    const w = compile(far).warnings.filter((x) => /apart horizontally/.test(x));
    assert.equal(w.length, 1, w.join("\n"));
    assert.match(w[0], /^scene 3 beat 1: anchors "rail-near" and "barn" are 2700 world px apart horizontally \(more than 1700;/);
    assert.deepEqual(compile(near).warnings.filter((x) => /apart horizontally/.test(x)), [], "one anchor per beat: no warning");
  });
  assert.deepEqual(compile(far).warnings.filter((x) => /apart horizontally/.test(x)), [], "landscape shows the whole width");
});
