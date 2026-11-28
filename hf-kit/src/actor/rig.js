/* hf-kit actor, part 1/3: the full-body rig (HFKit.rig). Pure SVG-string builders, no DOM.
 *
 * The head, face, hair (curly), glasses, palette, mouth, arms and the blazer / lab-coat torso
 * are the presenter's own parts (src/presenter/*.js); this file adds what a full body needs:
 * legs and shoes, coat tails, two more outfits (casual, explorer), other hair styles for extras,
 * held props, extra poses and the walk / run / jump cycles.
 *
 * Body units (the presenter's): x = 0 is the body's centre line, y grows downwards, the head top
 * is near y = 40 and the soles of the feet stand at y = FEET = 1300. Arms follow the presenter's
 * convention (left = screen-left arm, the right arm is drawn mirrored).
 *
 *   HFKit.rig.svg(state, idPrefix) -> "<svg ...>"   every id starts with idPrefix + "-"
 *   state = {pose, cycle?, phase?, outfit, held?, expression, mouth, blink, breath, facing,
 *            character?, frame?, track?, blend?, rest?, gazeBias?}
 *     pose        name in POSES, or an arm-pose object {left, right, tilt, gazeX, gazeY}
 *     cycle/phase "walk" | "run" | "jump" and its phase 0..1 (legs; arms too while pose is idle)
 *     outfit      name in OUTFITS (character.defaultOutfit when missing)
 *     held        name in HELD, carried in the screen-right hand
 *     expression  name in EXPRESSIONS, or a face object (presenter faceAt)
 *     mouth       loudness 0..1;  blink 0..1 (1 = shut);  breath -1..1 (breathing wave)
 *     facing      -1 (screen left), 0 (front), 1 (screen right): stride and gaze direction
 *     character   {face: {hair, glasses?: "lime-thick", skin, hairColor?}, colors?} (default: the host's face)
 *     frame       frame number: adds the pose's living motion, hair sway and head tilt
 *     track       the scene's mouth array (talk gestures follow the voice)
 *     blend       {pose, expression, k}: blend from that pose/expression to this one (k 0..1)
 *     rest        {pose, k}: "idle" rests k (0..1) of the way to that pose (the side-slot host
 *                 talks while the narration speaks: moves.js sets {pose: "talk", k})
 *     turn        -1..1 three-quarter turn (default: facing; +-1 while walking / running)
 *     cycleAmount 0..1 blend of the cycle toward standing (smooth starts and stops)
 *     light       {tint, amount 0..1, rim?, rimSide?}: take on the place's light
 *                 (places give it as meta.actorLight[variant]) */
(function (root) {
  "use strict";
  var P = root.HFKitPresenter;
  if (!P || !P.parts) throw new Error("actor/rig.js: load the presenter scripts first");
  var A = (root.HFKitActor = root.HFKitActor || {});
  var h = P.h;
  var capsule = P.capsule;

  var FEET = 1300;
  var HIP_X = 62, HIP_Y = 822, THIGH = 226, SHIN = 222, SOLE = 30; // 822 + 226 + 222 + 30 = 1300
  var STRIDE_HIP_X = 24; // hips closer together while striding, so the legs swing past each other
  var VIEW = { x: -800, y: -500, w: 1600, h: 1900 }; // room for raised arms, props and jumps
  var LINE = 3.5;
  var WX = P.WAIST_X; // the torso's half width at the waist (the lower body meets it)

  function show(on) { return on ? undefined : "none"; }
  function rad(d) { return (d * Math.PI) / 180; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function f2(v) { return Math.round(v * 100) / 100; }

  // ---------- names ----------

  function arm(shoulder, elbow, hand, wrist, upper, fore) {
    return { shoulder: shoulder, elbow: elbow, hand: hand, wrist: wrist || 0,
      upper: upper === undefined ? 1 : upper, fore: fore === undefined ? 1 : fore };
  }
  var REST = P.POSES["point-left"].right;

  /* The presenter's poses plus the full-body ones (the presenter's own table is not changed). */
  var POSES = {};
  Object.keys(P.POSES).forEach(function (k) { POSES[k] = P.POSES[k]; });
  POSES.raise = { left: arm(40, 70, "open", -10), right: arm(150, 168, "fist", 0), tilt: -4, gazeX: 0.8, gazeY: -0.4 };
  POSES.strike = { left: arm(40, 20, "open", -10), right: arm(25, 25, "fist", 0), tilt: 5, gazeX: 0.9, gazeY: 0.8 };
  POSES.carry = { left: P.POSES.idle.left, right: arm(14, 8, "fist", 0, 0.95, 0.95), tilt: 2, gazeX: 0.4, gazeY: 0.1 };
  POSES.shrug = { left: arm(26, 112, "open", -14, 0.92, 0.9), right: arm(26, 112, "open", -14, 0.92, 0.9), tilt: 6, gazeX: 0, gazeY: -0.2 };
  POSES["point-across"] = { left: arm(-58, -96, "point", -2), right: REST, tilt: 3, gazeX: 1, gazeY: -0.1 };

  /* The presenter's expressions; "surprised" is guaranteed (eyes wide, round "oh" mouth). */
  var EXPRESSIONS = {};
  Object.keys(P.EXPRESSIONS).forEach(function (k) { EXPRESSIONS[k] = P.EXPRESSIONS[k]; });
  if (!EXPRESSIONS.surprised) throw new Error("actor/rig.js: the presenter lost its surprised face");

  /* Outfits: colours for the presenter palette (jacket*, shirt*, rim, button) plus the legs.
   * `torso` picks the drawing, `coat` the hem below the waist (y), `shoe` the footwear. */
  var OUTFITS = {
    blazer: {
      palette: "blazer", torso: "presenter", coat: 892, shoe: "dress", // hip length
      trousers: "#2B3245", trousersShade: "#20263A", trousersLine: "#0C101C",
      shoeColor: "#3A2A22", shoeLight: "#6B4E3D", shoeLine: "#160C07", sole: "#1C130E",
    },
    "lab-coat": {
      palette: "labcoat", torso: "presenter", coat: 1078, shoe: "dress",
      trousers: "#2C3550", trousersShade: "#222A42", trousersLine: "#0F1424",
      shoeColor: "#3A2A22", shoeLight: "#6B4E3D", shoeLine: "#160C07", sole: "#1C130E",
    },
    casual: {
      palette: "casual", torso: "sweater", coat: 0, shoe: "sneaker",
      jacket: "#3E7C6B", jacketShade: "#2F6255", jacketLight: "#5A9A88", jacketLine: "#163A31",
      rim: "#9FD3C4", shirt: "#2F6255", shirtShade: "#264F45", shirtLine: "#163A31", button: "#163A31", accent: "#F4E3C1",
      trousers: "#3E5F8F", trousersShade: "#304C75", trousersLine: "#15243D",
      shoeColor: "#F3F1EC", shoeLight: "#FFFFFF", shoeLine: "#4A4F5A", sole: "#C9CDD4", stripe: "#D9534F",
    },
    explorer: {
      palette: "explorer", torso: "explorer", coat: 0, shoe: "boot",
      jacket: "#C9AA6E", jacketShade: "#A88A52", jacketLight: "#E0C792", jacketLine: "#5A4527",
      rim: "#F0DDB0", shirt: "#B39457", shirtShade: "#977A42", shirtLine: "#5A4527", button: "#6E5530", accent: "#B4472F",
      trousers: "#66703F", trousersShade: "#525B31", trousersLine: "#262B14",
      shoeColor: "#6B4426", shoeLight: "#93653D", shoeLine: "#2A1709", sole: "#2E2016",
      belt: "#4E321B", buckle: "#C9A44C",
    },
  };

  var HELD = {
    hammer: { hand: "fist" },
    book: { hand: "fist" },
    phone: { hand: "fist" },
    pointer: { hand: "fist" },
  };

  var HAIR = ["curly", "short", "long", "bun", "bald"];

  /* The host's face when the state names no character (host.js holds the cast entry). */
  var HOST_FACE = { hair: "curly", glasses: "lime-thick", skin: P.LOOK.skinTone };

  // ---------- palette ----------

  var PRESENTER_KEYS = ["jacket", "jacketShade", "jacketLight", "jacketLine", "rim", "shirt", "shirtShade", "shirtLine", "button"];

  function paletteFor(character, outfitName) {
    var o = OUTFITS[outfitName];
    if (!o) throw new Error("rig: unknown outfit " + outfitName);
    var face = (character && character.face) || HOST_FACE;
    var colors = Object.assign({}, P.LOOK.outfits[o.palette] || {}, o, (character && character.colors) || {});
    var cloth = {};
    PRESENTER_KEYS.forEach(function (k) { cloth[k] = colors[k]; });
    var outfits = {};
    outfits[o.palette] = cloth;
    var look = {
      skinTone: face.skin || P.LOOK.skinTone,
      hairColor: face.hairColor || P.LOOK.hairColor,
      eyeColor: face.eyeColor || P.LOOK.eyeColor,
      glasses: face.glasses === "lime-thick" ? "lime-thick" : false,
      glassesColor: P.LOOK.glassesColor,
      glassesEdge: P.LOOK.glassesEdge,
      glassesLight: P.LOOK.glassesLight,
      outfits: outfits,
    };
    var pal = P.palette(look, o.palette);
    Object.keys(colors).forEach(function (k) { if (!(k in pal)) pal[k] = colors[k]; });
    pal.look = look;
    pal.hairStyle = face.hair || "curly";
    if (HAIR.indexOf(pal.hairStyle) < 0) throw new Error("rig: unknown hair " + pal.hairStyle);
    return pal;
  }

  // ---------- cycles: pure functions of the phase, drawn facing screen-right ----------
  //
  // Arms use the presenter's convention (screen-left arm; the right arm is drawn mirrored), so
  // for a figure travelling right: left arm forward = shoulder < 0, right arm forward = > 0.
  // Every value is a smooth function of the phase (no case splits that jump), so consecutive
  // frames never pop; walk and run loop (phase 0 = phase 1).

  function legPose(swing, knee, foot) { return { swing: swing, knee: knee, foot: foot || 0 }; }
  function smooth01(t) { var c = clamp(t, 0, 1); return c * c * (3 - 2 * c); }
  function pos(v, k) { return Math.pow(Math.max(0, v), k); }
  function mixArm(a, b, t) {
    return arm(lerp(a.shoulder, b.shoulder, t), lerp(a.elbow, b.elbow, t), t < 0.5 ? a.hand : b.hand,
      lerp(a.wrist, b.wrist, t), lerp(a.upper, b.upper, t), lerp(a.fore, b.fore, t));
  }

  /* One stride (two steps) per phase 0..1. Contact at phase 0.25 / 0.75 (legs apart, hips
   * low), passing at 0 / 0.5 (swing knee bent, hips high): the bob comes from the legs. */
  var WALK_SWING = 39, RUN_SWING = 48; // thigh swing amplitude (degrees): sets STRIDE and the cadence
  function walk(phase) {
    var th = 2 * Math.PI * phase;
    var s = Math.sin(th), c = Math.cos(th);
    // swing leg: knee bends while it travels forward (c > 0 for the left leg)
    // knee flexion peaks just after passing, so the knee leads the swing
    var cl = Math.cos(th - 0.35);
    var kneeL = 4 + 40 * pos(cl, 1.5) + 6 * pos(-c, 2) * pos(s, 1);
    var kneeR = 4 + 40 * pos(-cl, 1.5) + 6 * pos(c, 2) * pos(-s, 1);
    // toes point down as the foot lifts, up a little for the heel strike
    var footL = -0.45 * (kneeL - 4) + 9 * pos(s, 3) * pos(c, 0.5);
    var footR = -0.45 * (kneeR - 4) + 9 * pos(-s, 3) * pos(-c, 0.5);
    var sl = Math.sin(th + 0.45); // the thigh leads the knee: at passing the swing knee is already forward
    var sw = 18 * sl; // arms opposite to the legs: left arm back while the left leg is forward
    return {
      // a full stride (about 0.8 body heights a cycle): 420 world px/s walks at about 1.35 cycles/s
      legs: { left: legPose(WALK_SWING * sl, kneeL, footL), right: legPose(-WALK_SWING * sl, kneeR, footR), spread: 1.2 },
      arms: {
        left: arm(3 + sw, 3 + sw - 14 - 12 * pos(-sl, 1), "relaxed", -8, 0.96, 0.93),
        right: arm(3 + sw, 3 + sw + 14 + 12 * pos(sl, 1), "relaxed", -8, 0.96, 0.93),
      },
      lean: 3, lift: 0,
      nod: 1.4 * Math.sin(2 * th - 2.2), // a small head nod, lagging the bob
      sway: -10 - 5 * Math.sin(2 * th - 1.3), // coat tails trail and lag the hips
    };
  }

  function run(phase) {
    var th = 2 * Math.PI * phase;
    var s = Math.sin(th), c = Math.cos(th);
    // the knee folds early in the swing and opens out before contact; the thigh leads
    var kc = Math.cos(th + 0.45), sl = Math.sin(th + 0.6);
    var kneeL = 16 + 108 * pos(kc, 1.6) + 8 * pos(-c, 2);
    var kneeR = 16 + 108 * pos(-kc, 1.6) + 8 * pos(c, 2);
    var footL = -0.4 * (kneeL - 16) + 8 * pos(sl, 3);
    var footR = -0.4 * (kneeR - 16) + 8 * pos(-sl, 3);
    var sw = 30 * sl;
    return {
      legs: { left: legPose(RUN_SWING * sl, kneeL, footL), right: legPose(-RUN_SWING * sl, kneeR, footR), spread: 0.8 },
      arms: { left: arm(4 + sw, 4 + sw - 96, "fist", 0, 0.93, 0.82), right: arm(4 + sw, 4 + sw + 96, "fist", 0, 0.93, 0.82) },
      lean: 10,
      lift: 30 * pos(-Math.cos(2 * th + 1.94), 1.5), // flight just before each contact
      nod: 2 * Math.sin(2 * th - 2),
      sway: -22 - 8 * Math.sin(2 * th - 1.2),
    };
  }

  /* Anticipation crouch with the arms swung back (0-0.2), push off with the arms thrown up,
   * flight with a tuck (0.26-0.82, peak about 280 units at 0.54), landing squash with the
   * arms forward, recover to standing at 1. Starts and ends exactly at the standing pose. */
  function jump(phase) {
    var p = clamp(phase, 0, 1);
    var bell = function (a, m, b) { return p <= a || p >= b ? 0 : p < m ? smooth01((p - a) / (m - a)) : 1 - smooth01((p - m) / (b - m)); };
    var crouch = bell(0, 0.17, 0.3);
    var land = bell(0.72, 0.86, 1);
    var u = clamp((p - 0.26) / 0.56, 0, 1);
    var air = p > 0.26 && p < 0.82 ? Math.sin(Math.PI * u) : 0;
    var lift = 280 * (p > 0.26 && p < 0.82 ? 4 * u * (1 - u) : 0);
    var tuck = air * air;
    var up = bell(0.13, 0.4, 0.92);
    var back = smooth01(clamp(p / 0.17, 0, 1)) * (1 - smooth01(clamp((p - 0.17) / 0.12, 0, 1)));
    var rest = P.POSES.idle;
    var armsAt = function (side) {
      var m = side < 0 ? 1 : -1; // left arm back = +, right arm back = -
      var a = mixArm(rest[side < 0 ? "left" : "right"], arm(26 * m, 14 * m, "relaxed", -8, 0.96, 0.95), back);
      a = mixArm(a, arm(152, 170, "open", 4), up);
      return mixArm(a, arm(-30 * m, -60 * m, "open", -6, 0.96, 0.92), land * (1 - up));
    };
    var sw = 30 * crouch + 30 * tuck + 26 * land;
    var kn = 82 * crouch + 70 * tuck + 74 * land;
    return {
      legs: { left: legPose(sw + 3 * air, kn, -18 * tuck), right: legPose(sw - 3 * air, kn + 8 * tuck, -24 * tuck), spread: 2.5 },
      arms: { left: armsAt(-1), right: armsAt(1) },
      lean: 9 * crouch + 6 * land - 3 * air, lift: lift, nod: 4 * crouch + 3 * land - 2 * air, sway: -16 * tuck + 10 * land,
    };
  }

  var CYCLES = { walk: walk, run: run, jump: jump };

  /* Standing still: feet a little apart, toes out. */
  var STAND = { legs: { left: legPose(0, 0), right: legPose(0, 0), spread: 3 }, arms: null, lean: 0, lift: 0, sway: 0, nod: 0 };

  /* Blend a cycle toward standing (amount 0 = standing, arms from `pose`). */
  function cycleBlend(cyc, amount, pose) {
    if (amount >= 1) return cyc;
    var k = clamp(amount, 0, 1);
    var leg = function (a, b) { return legPose(lerp(a.swing, b.swing, k), lerp(a.knee, b.knee, k), lerp(a.foot, b.foot, k)); };
    return {
      legs: { left: leg(STAND.legs.left, cyc.legs.left), right: leg(STAND.legs.right, cyc.legs.right), spread: lerp(STAND.legs.spread, cyc.legs.spread, k) },
      arms: cyc.arms && pose ? { left: mixArm(pose.left, cyc.arms.left, k), right: mixArm(pose.right, cyc.arms.right, k) } : cyc.arms,
      lean: lerp(0, cyc.lean || 0, k), lift: lerp(0, cyc.lift || 0, k), sway: lerp(0, cyc.sway || 0, k), nod: lerp(0, cyc.nod || 0, k),
    };
  }

  // ---------- poses over time ----------

  function wave(frame, period, phase) { return Math.sin((2 * Math.PI * frame) / period + (phase || 0)); }

  /* A named pose at `frame` with its living motion (the presenter's for its poses). */
  function animatedPose(name, frame, track) {
    if (!POSES[name]) throw new Error("rig: unknown pose " + name);
    if (P.POSES[name]) return P.animatedPose(name, frame, track || []);
    var base = POSES[name];
    var w = wave(frame, 130);
    var mv = function (a, ds, de) { return Object.assign({}, a, { shoulder: a.shoulder + ds, elbow: a.elbow + de }); };
    if (name === "shrug") return Object.assign({}, base, { left: mv(base.left, 2 * w, 4 * w), right: mv(base.right, 2 * w, 4 * w) });
    return Object.assign({}, base, { left: mv(base.left, w, 1.5 * w), right: mv(base.right, -w, -1.5 * w) });
  }

  /* A named pose; "idle" with st.rest = {pose, k} rests partly in that pose instead (the side-slot
   * host talking while the narration speaks: idle blended k of the way to talk). */
  function namedPose(name, st) {
    if (!POSES[name]) throw new Error("rig: unknown pose " + name);
    var p = st.frame === undefined ? POSES[name] : animatedPose(name, st.frame, st.track);
    if (name === "idle" && st.rest && st.rest.k > 0) {
      if (!POSES[st.rest.pose]) throw new Error("rig: unknown pose " + st.rest.pose);
      var q = st.frame === undefined ? POSES[st.rest.pose] : animatedPose(st.rest.pose, st.frame, st.track);
      p = P.blendPoses(p, q, clamp(st.rest.k, 0, 1));
    }
    return p;
  }
  function poseOf(st) {
    var p = st.pose === undefined ? "idle" : st.pose;
    if (typeof p === "string") p = namedPose(p, st);
    if (st.blend && st.blend.pose !== undefined && st.blend.k < 1) {
      var from = poseOf({ pose: st.blend.pose, frame: st.frame, track: st.track, rest: st.rest });
      p = P.blendPoses(from, p, st.blend.k);
    }
    return p;
  }

  function faceOf(st) {
    var e = st.expression === undefined ? "neutral" : st.expression;
    if (typeof e !== "string") return e;
    if (!EXPRESSIONS[e]) throw new Error("rig: unknown expression " + e);
    var from = st.blend && typeof st.blend.expression === "string" && st.blend.k < 1 ? st.blend.expression : e;
    return P.faceAt(from, e, st.blend && st.blend.k < 1 ? st.blend.k : 1);
  }

  // ---------- geometry ----------

  /* Everything that places the parts, in body units.
   *   turn  -1..1: 0 = front-on, +-1 = three-quarters toward screen right / left. Default: the
   *         facing, and +-1 while walking or running (a jump with no facing stays front-on).
   *         Task 5 eases it (about 0.25 s) to turn back to front when the actor stops.
   *   cycleAmount 0..1 (default 1): blends the cycle toward standing, for a smooth start / stop. */
  function layout(st) {
    var facing = st.facing || 0;
    var dir = facing < 0 ? -1 : 1;
    var turn = st.turn !== undefined ? clamp(+st.turn || 0, -1, 1)
      : facing ? dir : st.cycle && st.cycle !== "jump" ? 1 : 0;
    var ta = Math.abs(turn);
    var pose = poseOf(st);
    var cyc = STAND;
    if (st.cycle) {
      if (!CYCLES[st.cycle]) throw new Error("rig: unknown cycle " + st.cycle);
      var raw = CYCLES[st.cycle](st.phase || 0);
      // facing left mirrors the figure: legs and arms swap sides
      cyc = Object.assign({}, raw, dir > 0 ? {} : {
        legs: { left: raw.legs.right, right: raw.legs.left, spread: raw.legs.spread },
        arms: { left: raw.arms.right, right: raw.arms.left },
      });
      cyc = cycleBlend(cyc, st.cycleAmount === undefined ? 1 : st.cycleAmount, pose);
    }
    var poseName = typeof st.pose === "string" ? st.pose : null;
    if (cyc.arms && (poseName === "idle" || st.pose === undefined)) {
      pose = Object.assign({}, pose, { left: cyc.arms.left, right: cyc.arms.right });
    }
    if (st.held) {
      if (!HELD[st.held]) throw new Error("rig: unknown held item " + st.held);
      pose = Object.assign({}, pose, { right: Object.assign({}, pose.right, { hand: HELD[st.held].hand }) });
    }
    var spread = cyc.legs.spread;
    var hipX = lerp(HIP_X, STRIDE_HIP_X, ta);
    var L = legPoints(cyc.legs.left, -1, dir, ta, spread, hipX);
    var R = legPoints(cyc.legs.right, 1, dir, ta, spread, hipX);
    var ground = FEET - Math.max(L.sole, R.sole);
    var b = 0.015 * (st.breath || 0);
    // three-quarter view: the torso narrows and its front shifts toward the travel side, the far
    // arm tucks in behind the body, the head and the face features lead the turn
    var sx = 1 - 0.2 * ta, tx = 24 * turn;
    return {
      dir: dir, facing: facing, turn: turn, ta: ta, pose: pose, legs: { left: L, right: R }, cycle: cyc, hipX: hipX,
      // lean, nod and the trailing hem act toward the travel direction: front-on they point at the camera and do not show sideways
      dy: ground - (cyc.lift || 0), lean: (cyc.lean || 0) * dir * ta, sway: (cyc.sway || 0) * dir * ta, nod: (cyc.nod || 0) * dir * ta,
      b: b, lift: -b * (P.RIG.waist - 344),
      torsoSX: sx, torsoTX: tx, headTX: 12 * turn,
      armXL: 150 * (1 - sx) + tx + (turn < 0 ? 22 * ta : 0),
      armXR: -150 * (1 - sx) + tx - (turn > 0 ? 22 * ta : 0),
      front: ta < 0.5,
    };
  }

  /* Hip, knee and ankle of one leg; `side` -1 = screen-left leg. Two views, blended by the
   * turn: in three-quarter view (ta 1) the leg strides in the travel direction with the knee
   * bending back; front-on (ta 0) the knee comes toward the camera, so the thigh foreshortens,
   * the knee opens out a little and the shin stays near vertical (a squat, not a diamond). */
  function legPoints(leg, side, dir, ta, spread, hipX) {
    var hip = { x: side * hipX, y: HIP_Y };
    var at = function (x0, y0, len, deg) { return { x: x0 + len * Math.sin(rad(deg)), y: y0 + len * Math.cos(rad(deg)) }; };
    // side view
    var a = side * spread + dir * leg.swing;
    var kS = at(hip.x, hip.y, THIGH, a);
    var aS = at(kS.x, kS.y, SHIN, a - dir * leg.knee);
    // front view
    var bend = Math.max(0, leg.knee);
    var af = side * (spread + 0.18 * bend);
    var kF = at(hip.x, hip.y, THIGH * Math.max(0.35, Math.cos(rad(Math.max(Math.abs(leg.swing), bend * 0.6)))), af);
    var aF = at(kF.x, kF.y, SHIN, side * spread * 0.5 - side * 0.06 * bend);
    var knee = { x: lerp(kF.x, kS.x, ta), y: lerp(kF.y, kS.y, ta) };
    var ankle = { x: lerp(aF.x, aS.x, ta), y: lerp(aF.y, aS.y, ta) };
    var bAng = Math.atan2(ankle.x - knee.x, ankle.y - knee.y) * 180 / Math.PI;
    return { hip: hip, knee: knee, ankle: ankle, a: a, b: bAng, foot: (leg.foot || 0) * dir * ta, side: side, sole: ankle.y + SOLE };
  }

  /* Rotate a point of the upper body by the lean (around the hips) and lift it. */
  function upper(lay, p) {
    var c = Math.cos(rad(lay.lean)), s = Math.sin(rad(lay.lean));
    var x = p.x, y = p.y - HIP_Y;
    return { x: x * c - y * s, y: HIP_Y + x * s + y * c + lay.dy };
  }

  /* Fist centre of the screen-right hand, in the right arm's own (unmirrored) space. */
  function gripLocal(a) {
    var pts = P.armPoints(a);
    var w = pts.w, e = pts.e;
    var fl = Math.hypot(w.x - e.x, w.y - e.y) || 1;
    var fx = (w.x - e.x) / fl, fy = (w.y - e.y) / fl;
    var th = rad(a.elbow + a.wrist);
    return { x: w.x + fx * 8 - 32 * Math.sin(th), y: w.y + fy * 8 + 32 * Math.cos(th), angle: a.elbow + a.wrist };
  }

  // ---------- legs ----------

  function shoeNode(pal, kind, front, side, dir) {
    var line = { stroke: pal.shoeLine, "stroke-width": 5, "stroke-linejoin": "round" };
    var boot = kind === "boot", sneaker = kind === "sneaker";
    if (front) {
      return h("g", { transform: "translate(" + side * 6 + " 0) rotate(" + -side * 6 + ")" }, [
        h("path", Object.assign({ d: "M -24 -52 L 24 -52 L 26 0 L -26 0 Z", fill: pal.shoeColor, display: show(boot) }, line)),
        h("path", Object.assign({ d: "M -36 -6 C -48 2 -50 22 -38 28 L 38 28 C 50 22 48 2 36 -6 C 22 -14 -22 -14 -36 -6 Z", fill: pal.shoeColor }, line)),
        h("ellipse", { cx: -10, cy: 4, rx: 16, ry: 6, fill: pal.shoeLight, opacity: sneaker ? 0.9 : 0.55 }),
        h("path", { d: "M -40 20 L 40 20 L 38 30 L -38 30 Z", fill: pal.sole, stroke: pal.shoeLine, "stroke-width": 3, "stroke-linejoin": "round" }),
        h("path", { d: "M -30 8 L 30 8", stroke: pal.stripe || pal.shoeLine, "stroke-width": 4, "stroke-linecap": "round", display: show(sneaker) }),
      ]);
    }
    return h("g", { transform: "scale(" + dir + " 1)" }, [
      h("path", Object.assign({ d: "M -26 -54 L 22 -54 L 24 -6 L -28 -6 Z", fill: pal.shoeColor, display: show(boot) }, line)),
      h("path", Object.assign({ d: "M -28 -12 L 18 -12 C 40 -8 62 -2 74 8 C 84 16 84 28 72 28 L -24 28 C -32 28 -34 20 -32 12 Z", fill: pal.shoeColor }, line)),
      h("path", { d: "M 22 -8 C 40 -4 58 2 66 10", fill: "none", stroke: pal.shoeLight, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.7 }),
      h("path", { d: "M -34 20 L 82 20 C 84 26 80 31 72 31 L -26 31 C -32 31 -35 26 -34 20 Z", fill: pal.sole, stroke: pal.shoeLine, "stroke-width": 3, "stroke-linejoin": "round" }),
      h("path", { d: "M -12 4 L 40 8", stroke: pal.stripe || pal.shoeLine, "stroke-width": 5, "stroke-linecap": "round", display: show(sneaker) }),
    ]);
  }

  function legNode(pal, o, lp, lay, part, far) {
    var hip = lp.hip, k = lp.knee, an = lp.ankle;
    var thigh = capsule(hip.x, hip.y, 42, k.x, k.y, 33);
    var shin = capsule(k.x, k.y, 33, an.x, an.y, 27);
    // shade on the side turned from the light (screen-right of each leg)
    var shade = capsule(hip.x + 20, hip.y + 12, 18, k.x + 15, k.y, 13);
    var shade2 = capsule(k.x + 15, k.y, 13, an.x + 11, an.y - 6, 10);
    var nx = Math.cos(rad(lp.b)), ny = -Math.sin(rad(lp.b)); // across the shin
    // shoes cross-fade from the front view to the side view as the body turns
    var sideK = smooth01((lay.ta - 0.25) / 0.5);
    var shoeAt = "translate(" + f2(an.x) + " " + f2(an.y) + ") rotate(" + f2(lp.foot) + ")";
    return h("g", { "data-part": part }, [
      h("g", { fill: pal.trousersLine, stroke: pal.trousersLine, "stroke-width": 7, "stroke-linejoin": "round" }, [h("path", { d: thigh }), h("path", { d: shin })]),
      h("g", { fill: pal.trousers }, [h("path", { d: thigh }), h("path", { d: shin })]),
      h("path", { d: shade, fill: pal.trousersShade, opacity: 0.8 }),
      h("path", { d: shade2, fill: pal.trousersShade, opacity: 0.8 }),
      // the far leg sits a little in shadow
      h("g", { fill: pal.trousersLine, opacity: f2(0.22 * far), display: show(far > 0.01) }, [h("path", { d: thigh }), h("path", { d: shin })]),
      // knee fold and the trouser hem
      h("path", { d: "M " + f2(k.x - 14) + " " + f2(k.y - 6) + " q 12 10 26 2", fill: "none", stroke: pal.trousersLine, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.5 }),
      h("path", { d: "M " + f2(an.x - nx * 29) + " " + f2(an.y - ny * 29 - 6) + " L " + f2(an.x + nx * 29) + " " + f2(an.y + ny * 29 - 6), stroke: pal.trousersLine, "stroke-width": 4, "stroke-linecap": "round" }),
      h("g", { transform: shoeAt, opacity: f2(1 - sideK), display: show(sideK < 0.99) }, [shoeNode(pal, o.shoe, true, lp.side, lay.dir)]),
      h("g", { transform: shoeAt, opacity: f2(sideK), display: show(sideK > 0.01) }, [shoeNode(pal, o.shoe, false, lp.side, lay.dir)]),
    ]);
  }

  /* Seat of the trousers: covers the hip joints; outlined on the sides only. It tapers to the
   * legs, so it narrows while striding (hips closer together). */
  function pelvisNode(pal, hipX) {
    var o = hipX + 44, m = hipX + 84, c = Math.min(22, hipX - 2);
    var X = WX - 12; // inside the tapered waist (it never peeks past a hem in three-quarter view)
    var d = "M " + -X + " 770 L " + X + " 770 C " + X + " 826 " + m + " 878 " + o + " 906 L " + c + " 906 Q 0 918 " + -c + " 906 L " + -o + " 906 C " + -m + " 878 " + -X + " 826 " + -X + " 770 Z";
    var sides = "M " + -X + " 770 C " + -X + " 826 " + -m + " 878 " + -o + " 906 M " + X + " 770 C " + X + " 826 " + m + " 878 " + o + " 906";
    return h("g", { "data-part": "pelvis" }, [
      h("path", { d: d, fill: pal.trousers }),
      h("path", { d: "M 120 800 C 128 840 " + (o + 16) + " 880 " + (o - 6) + " 904 L " + (o - 46) + " 904 C 84 880 96 840 92 800 Z", fill: pal.trousersShade, opacity: 0.8, display: show(hipX > 40) }),
      h("path", { d: sides + (hipX > 40 ? " M " + -c + " 906 Q 0 918 " + c + " 906" : ""), fill: "none", stroke: pal.trousersLine, "stroke-width": LINE, "stroke-linecap": "round" }),
      h("path", { d: "M 0 870 L 0 910", stroke: pal.trousersLine, "stroke-width": 3, opacity: 0.5, display: show(hipX > 40) }),
    ]);
  }

  // ---------- below the waist: coat tails, sweater hem, belt ----------

  function coatNode(pal, o, lay) {
    var hem = o.coat;
    var lab = o.palette === "labcoat";
    var sw = lay.sway * (lab ? 1 : 0.45); // hem trails the stride (a short blazer moves less)
    var flare = lab ? 11 : 4;
    var gap = lab ? 14 : 32;
    var line = { stroke: pal.jacketLine, "stroke-width": LINE, "stroke-linejoin": "round" };
    var left = "M " + -WX + " 800 L " + f2(-WX - flare + sw) + " " + (hem - 6) + " C " + f2(-130 + sw) + " " + (hem + 8) + " " + f2(-64 + sw * 0.6) + " " + (hem + 10) + " " + f2(-gap + sw * 0.4) + " " + hem + " L -1 800 Z";
    var right = "M " + WX + " 800 L " + f2(WX + flare + sw) + " " + (hem - 6) + " C " + f2(130 + sw) + " " + (hem + 8) + " " + f2(64 + sw * 0.6) + " " + (hem + 10) + " " + f2(gap + 4 + sw * 0.4) + " " + hem + " L 5 800 Z";
    // outlines leave the top edge open: the panels continue the torso without a seam
    var open = function (d) { return d.replace(/ Z$/, ""); };
    var kids = [
      h("path", { d: left, fill: pal.jacket }),
      h("path", { d: right, fill: pal.jacket }),
      h("path", Object.assign({ d: open(left), fill: "none" }, line)),
      // shade on the right side, as on the torso above
      h("path", { d: "M 108 802 L " + (WX - 2) + " 802 L " + f2(WX - 4 + flare + sw) + " " + (hem - 8) + " C " + f2(160 + sw) + " " + (hem + 2) + " " + f2(130 + sw) + " " + (hem + 5) + " " + f2(118 + sw * 0.8) + " " + (hem + 6) + " Z", fill: pal.jacketShade }),
      h("path", { d: "M -150 820 L " + f2(-160 + sw * 0.8) + " " + (hem - 20), stroke: pal.jacketLight, "stroke-width": 10, "stroke-linecap": "round", opacity: 0.5 }),
      // redraw the outlines over the shade
      h("path", Object.assign({ d: open(right), fill: "none" }, line)),
    ];
    if (lab) {
      [-1, 1].forEach(function (s) {
        var x0 = s < 0 ? -152 : 76;
        kids.push(h("path", { d: "M " + x0 + " 884 L " + (x0 + 76) + " 884 L " + (x0 + 76) + " 952 C " + (x0 + 76) + " 958 " + (x0 + 72) + " 962 " + (x0 + 66) + " 962 L " + (x0 + 10) + " 962 C " + (x0 + 4) + " 962 " + x0 + " 958 " + x0 + " 952 Z", fill: s > 0 ? pal.jacketShade : pal.jacket, stroke: pal.jacketLine, "stroke-width": 2.5, "stroke-linejoin": "round" }));
      });
    } else {
      [-1, 1].forEach(function (s) {
        kids.push(h("path", { d: "M " + s * 146 + " 836 L " + s * 74 + " 830 L " + s * 76 + " 848 L " + s * 148 + " 854 Z", fill: s > 0 ? pal.jacketShade : pal.jacket, stroke: pal.jacketLine, "stroke-width": 2.5, "stroke-linejoin": "round" }));
      });
    }
    return h("g", { "data-part": "coat" }, kids);
  }

  /* The sweater below the waist (refresh: soft, not boxy): the knit blouses a little over a
   * gathered ribbed hem band. */
  function sweaterHemNode(pal) {
    var X = WX, B = X - 10, O = X + 3; // the band is gathered narrower than the body
    var edge = "M " + -X + " 780 C " + -O + " 806 " + -O + " 836 " + -(X - 10) + " 850 C -100 866 100 866 " + (X - 10) + " 850 C " + O + " 836 " + O + " 806 " + X + " 780";
    var band = "M " + -B + " 846 C -100 860 100 860 " + B + " 846 L " + (B - 2) + " 884 C 100 896 -100 896 " + -(B - 2) + " 884 Z";
    var ribs = [];
    for (var x = -128; x <= 128; x += 16) ribs.push("M " + x + " " + (858 - Math.abs(x) * 0.03) + " L " + x + " " + (890 - Math.abs(x) * 0.04));
    return h("g", { "data-part": "coat" }, [
      h("path", { d: band, fill: pal.jacketShade, stroke: pal.jacketLine, "stroke-width": LINE, "stroke-linejoin": "round" }),
      h("path", { d: ribs.join(" "), stroke: pal.jacketLine, "stroke-width": 2, opacity: 0.3, "stroke-linecap": "round" }),
      h("path", { d: edge + " Z", fill: pal.jacket }),
      h("path", { d: "M 112 780 L " + X + " 780 C " + O + " 806 " + O + " 836 " + (X - 10) + " 850 C 140 855 126 858 112 859 C 120 830 118 806 112 780 Z", fill: pal.jacketShade, opacity: 0.85 }),
      // soft drapes where the knit gathers into the band
      h("path", { d: "M -140 822 C -124 842 -98 852 -70 852 M 36 856 C 62 856 88 850 108 840 M -34 858 C -20 850 -2 850 10 858", fill: "none", stroke: pal.jacketShade, "stroke-width": 4.5, "stroke-linecap": "round", opacity: 0.85 }),
      h("path", { d: edge, fill: "none", stroke: pal.jacketLine, "stroke-width": LINE, "stroke-linejoin": "round", "stroke-linecap": "round" }),
    ]);
  }

  function beltNode(pal) {
    return h("g", { "data-part": "coat" }, [
      h("path", { d: "M " + -(WX + 1) + " 806 L " + (WX + 1) + " 806 L " + WX + " 842 L " + -WX + " 842 Z", fill: pal.belt, stroke: pal.shoeLine, "stroke-width": 3, "stroke-linejoin": "round" }),
      h("path", { d: "M -116 806 L -116 842 M 116 806 L 116 842", stroke: pal.shoeLine, "stroke-width": 3, opacity: 0.6 }),
      h("rect", { x: -22, y: 800, width: 44, height: 48, rx: 6, fill: pal.buckle, stroke: "#5A4318", "stroke-width": 3 }),
      h("rect", { x: -11, y: 812, width: 22, height: 24, rx: 3, fill: pal.belt }),
    ]);
  }

  // ---------- torsos for the new outfits (the presenter draws blazer and lab coat) ----------

  /* Casual knit sweater (refresh: softer, less boxy): curved chest stripes that follow the body's
   * volume, soft drapes instead of hard folds, a rounded ribbed crew neck. */
  function sweaterNode(pal) {
    var clip = "{uid}-torso";
    var bow = function (y, dy) { return "M -220 " + y + " C -120 " + (y + dy) + " 120 " + (y + dy) + " 220 " + y; };
    return h("g", { "data-part": "torso" }, [
      h("defs", {}, [h("clipPath", { id: clip }, [h("path", { d: P.TORSO_PATH })])]),
      h("path", { d: P.TORSO_PATH, fill: pal.jacket }),
      h("g", { "clip-path": "url(#" + clip + ")" }, [
        h("path", { d: P.TORSO_PATH, fill: "none", stroke: pal.rim, "stroke-width": 14, opacity: 0.3 }),
        // a band across the chest, bowed with the chest
        h("path", { d: bow(490, 26), fill: "none", stroke: pal.accent, "stroke-width": 32 }),
        h("path", { d: bow(536, 26), fill: "none", stroke: pal.accent, "stroke-width": 10 }),
        h("path", { d: "M 104 360 C 156 370 178 398 176 432 C 172 500 162 570 152 640 L 156 840 L 110 840 C 120 700 124 560 120 450 C 118 410 112 380 104 360 Z", fill: pal.jacketShade, opacity: 0.85 }),
        h("path", { d: "M -176 420 C -156 396 -130 384 -104 382 C -132 402 -152 440 -162 490 Z", fill: pal.jacketLight, opacity: 0.7 }),
        // soft knit drapes toward the waist
        h("path", { d: "M -136 650 C -120 700 -100 730 -70 748 M 132 650 C 118 700 96 730 66 748 M -40 700 C -30 724 -14 738 4 744", fill: "none", stroke: pal.jacketShade, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.7 }),
      ]),
      h("path", { d: P.TORSO_OUTLINE, fill: "none", stroke: pal.jacketLine, "stroke-width": LINE, "stroke-linejoin": "round" }),
      // ribbed crew neck, rounded
      h("path", { d: "M -50 340 C -30 388 30 388 50 340", fill: "none", stroke: pal.jacketShade, "stroke-width": 17, "stroke-linecap": "round" }),
      h("path", { d: "M -59 342 C -32 398 32 398 59 342", fill: "none", stroke: pal.jacketLine, "stroke-width": 3, "stroke-linecap": "round" }),
      h("path", { d: "M -42 338 C -22 376 22 376 42 338", fill: "none", stroke: pal.jacketLine, "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0.7 }),
    ]);
  }

  function explorerNode(pal) {
    var clip = "{uid}-torso";
    var line = function (a) { return Object.assign({ stroke: pal.jacketLine, "stroke-width": 2.5, "stroke-linejoin": "round" }, a); };
    var kids = [
      h("defs", {}, [h("clipPath", { id: clip }, [h("path", { d: P.TORSO_PATH })])]),
      h("path", { d: P.TORSO_PATH, fill: pal.jacket }),
      h("g", { "clip-path": "url(#" + clip + ")" }, [
        h("path", { d: P.TORSO_PATH, fill: "none", stroke: pal.rim, "stroke-width": 14, opacity: 0.35 }),
        h("path", { d: "M 104 360 C 156 370 178 398 176 432 C 172 500 162 570 152 640 L 156 840 L 110 840 C 120 700 124 560 120 450 C 118 410 112 380 104 360 Z", fill: pal.jacketShade }),
        h("path", { d: "M -176 420 C -156 396 -130 384 -104 382 C -132 402 -152 440 -162 490 Z", fill: pal.jacketLight, opacity: 0.7 }),
        // placket
        h("path", { d: "M -8 404 L -8 850 M 12 404 L 12 850", stroke: pal.jacketShade, "stroke-width": 3 }),
        // tucked-in folds above the belt
        h("path", { d: "M -120 790 C -110 770 -96 762 -80 760 M 40 796 C 52 776 66 768 84 766 M -40 800 C -34 786 -24 780 -12 778", fill: "none", stroke: pal.jacketShade, "stroke-width": 4, "stroke-linecap": "round" }),
      ]),
      h("path", { d: P.TORSO_OUTLINE, fill: "none", stroke: pal.jacketLine, "stroke-width": LINE, "stroke-linejoin": "round" }),
      h("path", { d: "M -24 350 L 0 414 L 24 350 Z", fill: pal.skin }),
      h("path", { d: "M -24 350 L 0 414 L 24 350 C 10 362 -10 362 -24 350 Z", fill: pal.skinShade, opacity: 0.6 }),
      // neckerchief knot
      h("path", { d: "M -26 352 C -10 372 10 372 26 352 L 14 384 L 0 410 L -14 384 Z", fill: pal.accent, stroke: "#5E1E12", "stroke-width": 2.5, "stroke-linejoin": "round" }),
    ];
    [-1, 1].forEach(function (s) {
      // camp collar
      kids.push(h("path", line({ d: "M " + s * 50 + " 330 C " + s * 40 + " 362 " + s * 26 + " 396 " + s * 4 + " 420 L " + s * 54 + " 430 C " + s * 62 + " 404 " + s * 70 + " 376 " + s * 74 + " 352 C " + s * 66 + " 342 " + s * 58 + " 334 " + s * 50 + " 330 Z", fill: s > 0 ? pal.jacketShade : pal.jacket })));
      // flap pockets
      var x0 = s < 0 ? -142 : 58;
      kids.push(h("path", line({ d: "M " + x0 + " 474 L " + (x0 + 84) + " 474 L " + (x0 + 84) + " 556 C " + (x0 + 84) + " 562 " + (x0 + 80) + " 566 " + (x0 + 74) + " 566 L " + (x0 + 10) + " 566 C " + (x0 + 4) + " 566 " + x0 + " 562 " + x0 + " 556 Z", fill: s > 0 ? pal.jacketShade : pal.jacket })));
      kids.push(h("path", line({ d: "M " + (x0 - 4) + " 470 L " + (x0 + 88) + " 470 L " + (x0 + 86) + " 500 L " + (x0 + 42) + " 508 L " + (x0 - 2) + " 500 Z", fill: s > 0 ? pal.jacketShade : pal.jacketLight })));
      kids.push(h("circle", { cx: x0 + 42, cy: 498, r: 5, fill: pal.button }));
    });
    [480, 580, 680].forEach(function (y) { kids.push(h("circle", { cx: 2, cy: y, r: 6, fill: pal.button, stroke: pal.jacketLine, "stroke-width": 1.5 })); });
    return h("g", { "data-part": "torso" }, kids);
  }

  // ---------- hair styles for extras (the host's curls are the presenter's) ----------

  function hairBack(pal, style, sway) {
    if (style === "curly") return P.parts.hairBack(pal, sway);
    var kids = [];
    if (style === "short") kids.push(h("path", { d: "M -94 214 C -102 120 -60 62 0 60 C 60 62 102 120 94 214 Z", fill: pal.hairShade, stroke: pal.hairLine, "stroke-width": 2.5 }));
    if (style === "long") kids.push(h("path", { d: "M -104 380 C -128 250 -118 70 0 58 C 118 70 128 250 104 380 C 90 396 66 394 54 376 L -54 376 C -66 394 -90 396 -104 380 Z", fill: pal.hairShade, stroke: pal.hairLine, "stroke-width": 2.5, "stroke-linejoin": "round" }));
    if (style === "bun") {
      kids.push(h("path", { d: "M -92 200 C -100 116 -58 64 0 62 C 58 64 100 116 92 200 Z", fill: pal.hairShade, stroke: pal.hairLine, "stroke-width": 2.5 }));
      kids.push(h("circle", { cx: 0, cy: 40, r: 44, fill: pal.hair, stroke: pal.hairLine, "stroke-width": 2.5 }));
      kids.push(h("path", { d: "M -24 22 C -10 6 14 8 24 22", fill: "none", stroke: pal.hairLight, "stroke-width": 5, "stroke-linecap": "round" }));
    }
    return h("g", { "data-part": "hair-back", transform: "rotate(" + f2(sway(0.8) * 0.5) + " 0 140)" }, kids);
  }

  function hairFront(pal, style, sway) {
    if (style === "curly") return P.parts.hairFront(pal, sway);
    var line = { stroke: pal.hairLine, "stroke-width": 2.5, "stroke-linejoin": "round" };
    var kids = [];
    if (style === "short") {
      kids.push(h("path", Object.assign({ d: "M -90 198 C -98 110 -52 62 2 62 C 56 64 98 110 90 198 C 86 170 82 150 72 136 C 40 126 -6 146 -40 128 C -62 140 -82 160 -90 198 Z", fill: pal.hair }, line)));
      kids.push(h("path", { d: "M -60 96 C -40 76 -10 70 14 72", fill: "none", stroke: pal.hairLight, "stroke-width": 6, "stroke-linecap": "round" }));
    } else if (style === "long") {
      kids.push(h("path", Object.assign({ d: "M -96 250 C -104 110 -52 60 4 60 C 62 62 104 112 96 250 C 90 200 84 164 70 140 C 34 148 -6 136 -26 112 C -46 146 -72 170 -96 250 Z", fill: pal.hair }, line)));
      kids.push(h("path", Object.assign({ d: "M -96 200 C -104 260 -98 330 -86 368 L -70 360 C -80 320 -84 260 -80 210 Z", fill: pal.hair }, line)));
      kids.push(h("path", Object.assign({ d: "M 96 200 C 104 260 98 330 86 368 L 70 360 C 80 320 84 260 80 210 Z", fill: pal.hairShade }, line)));
      kids.push(h("path", { d: "M -66 104 C -44 78 -14 70 12 70", fill: "none", stroke: pal.hairLight, "stroke-width": 6, "stroke-linecap": "round" }));
    } else if (style === "bun") {
      kids.push(h("path", Object.assign({ d: "M -88 192 C -94 110 -50 64 0 64 C 50 64 94 110 88 192 C 82 150 50 124 0 122 C -50 124 -82 150 -88 192 Z", fill: pal.hair }, line)));
      kids.push(h("path", { d: "M -56 98 C -36 80 -8 74 16 76 M 20 80 C 44 84 64 98 74 116", fill: "none", stroke: pal.hairLight, "stroke-width": 4, "stroke-linecap": "round" }));
    } else if (style === "bald") {
      [-1, 1].forEach(function (s) {
        kids.push(h("path", Object.assign({ d: "M " + s * 86 + " 150 C " + s * 96 + " 170 " + s * 96 + " 196 " + s * 88 + " 212 L " + s * 78 + " 206 C " + s * 82 + " 190 " + s * 82 + " 170 " + s * 76 + " 156 Z", fill: s > 0 ? pal.hairShade : pal.hair }, line)));
      });
      kids.push(h("ellipse", { cx: -30, cy: 136, rx: 26, ry: 10, fill: pal.skinLight, opacity: 0.55, transform: "rotate(-14 -30 136)" }));
    }
    // sideburns, as the presenter's
    [-1, 1].forEach(function (s) {
      kids.push(h("path", { d: "M " + s * 88 + " 160 L " + s * 76 + " 160 L " + s * 78 + " 196 C " + s * 80 + " 200 " + s * 85 + " 200 " + s * 87 + " 194 Z", fill: pal.hair, stroke: pal.hairLine, "stroke-width": 2, display: show(style !== "bald" && style !== "long") }));
    });
    return h("g", { "data-part": "hair-front" }, kids);
  }

  // ---------- held props (drawn in the right arm's unmirrored space; +y = along the fingers) ----------

  function heldNode(name, pose) {
    var g = gripLocal(pose.right);
    var kids;
    if (name === "hammer") {
      kids = [
        h("rect", { x: -11, y: -40, width: 22, height: 420, rx: 10, fill: "#B07A45", stroke: "#4A2E16", "stroke-width": 5 }),
        h("rect", { x: -11, y: -40, width: 7, height: 420, rx: 4, fill: "#D9A56B", opacity: 0.7 }),
        h("rect", { x: -70, y: 340, width: 140, height: 96, rx: 12, fill: "#5F6B78", stroke: "#1E242B", "stroke-width": 6 }),
        h("rect", { x: -60, y: 350, width: 120, height: 24, rx: 6, fill: "#A9B6C3", opacity: 0.8 }),
      ];
    } else if (name === "book") {
      kids = [
        h("rect", { x: -50, y: -14, width: 104, height: 140, rx: 8, fill: "#9E3B32", stroke: "#3E120D", "stroke-width": 5 }),
        h("rect", { x: -50, y: -14, width: 16, height: 140, rx: 4, fill: "#6E241D" }),
        h("rect", { x: 48, y: -6, width: 8, height: 124, fill: "#F5EEDC", stroke: "#3E120D", "stroke-width": 2 }),
        h("rect", { x: -20, y: 22, width: 54, height: 12, rx: 3, fill: "#E9C46A" }),
      ];
    } else if (name === "phone") {
      kids = [
        h("rect", { x: -26, y: -20, width: 52, height: 96, rx: 10, fill: "#1D2230", stroke: "#0A0D14", "stroke-width": 4 }),
        h("rect", { x: -20, y: -12, width: 40, height: 78, rx: 5, fill: "#5FA8D3" }),
        h("path", { d: "M -16 30 L 12 -6", stroke: "#FFFFFF", "stroke-width": 4, "stroke-linecap": "round", opacity: 0.35 }),
      ];
    } else {
      kids = [ // pointer stick
        h("rect", { x: -5, y: -30, width: 10, height: 380, rx: 5, fill: "#3B3F4A", stroke: "#15171C", "stroke-width": 3 }),
        h("circle", { cx: 0, cy: 354, r: 11, fill: "#E04F3A", stroke: "#5E1A10", "stroke-width": 3 }),
      ];
    }
    return h("g", { "data-part": "held", "data-held": name, transform: "scale(-1 1)" }, [
      h("g", { transform: "translate(" + f2(g.x) + " " + f2(g.y) + ") rotate(" + f2(g.angle) + ")" }, kids),
    ]);
  }

  // ---------- the whole figure ----------

  function tree(st) {
    st = st || {};
    var character = st.character || null;
    var outfitName = st.outfit || (character && character.defaultOutfit) || "blazer";
    var o = OUTFITS[outfitName];
    if (!o) throw new Error("rig: unknown outfit " + outfitName);
    var pal = paletteFor(character, outfitName);
    var lay = layout(st);
    var pose = lay.pose;
    var face = faceOf(st);
    var frame = st.frame;
    var sway = function (phase) { return frame === undefined ? 0 : P.sway(frame, phase); };
    var tilt = (pose.tilt || 0) + (frame === undefined ? 0 : P.headTilt(frame));
    var gazeX = clamp((pose.gazeX || 0) + 0.35 * lay.facing + (st.gazeBias || 0), -1, 1);
    var gazeY = pose.gazeY || 0;

    var torso = o.torso === "presenter" ? P.parts.torso(pal) : o.torso === "sweater" ? sweaterNode(pal) : explorerNode(pal);
    var below = o.coat ? coatNode(pal, o, lay) : o.torso === "sweater" ? sweaterHemNode(pal) : beltNode(pal);
    var T = lay.turn, ta = lay.ta;
    var headT = "translate(" + f2(lay.headTX) + " " + f2(lay.lift) + ") rotate(" + f2(tilt + lay.nod) + " 0 " + P.RIG.headPivotY + ")";
    // the back hair goes behind the neck and shoulders (long hair falls behind them)
    var hs = P.headScaleTransform(P.LOOK); // the head drawn bigger about the chin (every character)
    var back = h("g", { transform: headT }, [h("g", { "data-part": "head-group-back", transform: hs }, [
      h("g", { transform: "translate(" + f2(-8 * T) + " 0)" }, [hairBack(pal, pal.hairStyle, sway)])])]);
    var head = h("g", { transform: headT }, [h("g", { "data-part": "head-group", transform: hs }, [
      turnHead(P.parts.head(pal), T),
      // the face features slide toward the turn and narrow a little (three-quarter view); on the
      // side he turns toward they stop at the face line (the near temple arm goes behind the cheek)
      h("defs", {}, [h("clipPath", { id: "{uid}-turn" }, [
        h("path", { d: P.FACE_PATH }),
        h("rect", { x: -400, y: -200, width: T < -0.01 ? 0 : 400, height: 800 }),
        h("rect", { x: 0, y: -200, width: T > 0.01 ? 0 : 400, height: 800 }),
      ])]),
      h("g", { "clip-path": "url(#{uid}-turn)" }, [
        h("g", { transform: "translate(" + f2(20 * T) + " 0) scale(" + f2(1 - 0.1 * ta) + " 1)" }, [
          P.parts.face(pal, face, clamp(st.mouth || 0, 0, 1), clamp(st.blink || 0, 0, 1), gazeX, gazeY, pal.look.glasses),
        ]),
      ]),
      h("g", { transform: "translate(" + f2(3 * T) + " 0)" }, [hairFront(pal, pal.hairStyle, sway)]),
    ])]);
    var armL = h("g", { transform: "translate(" + f2(lay.armXL) + " 0)" }, [P.parts.arm(pose.left, false, pal, "arm-left")]);
    var armR = h("g", { transform: "translate(" + f2(lay.armXR) + " 0)" },
      (st.held ? [heldNode(st.held, pose)] : []).concat([P.parts.arm(pose.right, true, pal, "arm-right")]));
    // in three-quarter view the far arm (screen-right when turning right) goes behind the body
    var farArm = ta > 0.5 ? (T > 0 ? armR : armL) : null;
    var arms = farArm ? [T > 0 ? armL : armR] : [armL, armR];
    var armLift = function (list) { return h("g", { transform: "translate(0 " + f2(lay.lift) + ")" }, list); };
    // the near leg is drawn last; the far one sits a little in shadow
    var legL = legNode(pal, o, lay.legs.left, lay, "leg-left", T < 0 ? ta : 0);
    var legR = legNode(pal, o, lay.legs.right, lay, "leg-right", T > 0 ? ta : 0);

    var air = clamp(1 - (lay.cycle.lift || 0) / 400, 0.4, 1);
    var waist = P.RIG.waist;
    var light = lightOf(st.light);
    var body = h("g", { "data-part": "body", transform: "translate(0 " + f2(lay.dy) + ")", filter: light ? "url(#{uid}-light)" : undefined }, [
      T > 0 ? legR : legL,
      T > 0 ? legL : legR,
      // the trouser seat narrows with the torso so it never pokes out behind it
      h("g", { transform: "translate(" + f2(lay.torsoTX * 0.5) + " 0) scale(" + f2(lay.torsoSX) + " 1)" }, [pelvisNode(pal, lay.hipX / lay.torsoSX)]),
      h("g", { "data-part": "upper", transform: "rotate(" + f2(lay.lean) + " 0 " + HIP_Y + ")" }, [
        back,
        farArm ? armLift([farArm]) : null,
        h("g", { transform: "translate(" + f2(lay.headTX * 0.6) + " " + f2(lay.lift) + ")" }, [P.parts.collarBack(pal), P.parts.neck(pal)]),
        h("g", { transform: "translate(0 " + waist + ") scale(" + f2(1 + lay.b * 0.4) + " " + f2(1 + lay.b) + ") translate(0 " + -waist + ")" }, [
          h("g", { transform: "translate(" + f2(lay.torsoTX) + " 0) scale(" + f2(lay.torsoSX) + " 1)" }, [torso, below]),
        ]),
        head,
        armLift(arms),
      ].filter(Boolean)),
    ]);
    var top = [];
    if (light) top.push(h("defs", {}, [lightFilter(light)]));
    top.push(h("ellipse", { "data-part": "shadow", cx: f2(4 * T), cy: FEET + 4, rx: f2(210 * air), ry: f2(28 * air), fill: "#000", opacity: f2(0.18 * air) }));
    top.push(body);
    return h("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      "data-actor": outfitName,
      viewBox: VIEW.x + " " + VIEW.y + " " + VIEW.w + " " + VIEW.h,
      width: st.width, height: st.height,
      preserveAspectRatio: "xMidYMid meet",
      style: "overflow: visible",
    }, top);
  }

  /* The presenter's head (ears + face skin) turned: the far ear fades behind the cheek and the
   * near ear moves in a little. The presenter's head node starts with its two ears (left, right). */
  function turnHead(node, T) {
    var ta = Math.abs(T);
    if (ta < 0.01) return node;
    var kids = node.c.slice();
    [0, 1].forEach(function (i) {
      var side = i === 0 ? -1 : 1;
      var far = side * T > 0;
      kids[i] = h("g", { transform: far ? undefined : "translate(" + f2(-side * 12 * ta) + " 0)", opacity: far ? f2(1 - smooth01(ta / 0.6)) : undefined }, [node.c[i]]);
    });
    return h(node.tag, node.a, kids);
  }

  // ---------- light: the actor takes on the place's light ----------

  var HEX = /^#[0-9a-fA-F]{6}$/;

  /* {tint, amount 0..1, rim?, rimSide? (1 = light from the right, -1 = left)} or null. */
  function lightOf(l) {
    if (!l) return null;
    if (!HEX.test(l.tint || "")) throw new Error("rig: light.tint must be #rrggbb, got " + l.tint);
    if (l.rim !== undefined && !HEX.test(l.rim)) throw new Error("rig: light.rim must be #rrggbb, got " + l.rim);
    var amount = clamp(+l.amount || 0, 0, 1);
    if (amount === 0 && !l.rim) return null;
    return { tint: l.tint.toUpperCase(), amount: amount, rim: l.rim ? l.rim.toUpperCase() : null, rimSide: l.rimSide < 0 ? -1 : 1 };
  }

  /* Multiply by the tint (mixed by amount), then a soft rim on the edges facing the light. */
  function lightFilter(l) {
    var k = function (v) { return String(Math.round(v * 1000) / 1000); };
    var kids = [
      h("feFlood", { "flood-color": l.tint, result: "tint" }),
      h("feBlend", { in: "SourceGraphic", in2: "tint", mode: "multiply", result: "mul" }),
      h("feComposite", { in: "mul", in2: "SourceAlpha", operator: "in", result: "mulin" }),
      h("feComposite", { in: "mulin", in2: "SourceGraphic", operator: "arithmetic", k1: "0", k2: k(l.amount), k3: k(1 - l.amount), k4: "0", result: "lit" }),
    ];
    if (l.rim) {
      kids.push(
        h("feOffset", { in: "SourceAlpha", dx: -12 * l.rimSide, dy: 10, result: "off" }),
        h("feComposite", { in: "SourceAlpha", in2: "off", operator: "out", result: "edge" }),
        h("feGaussianBlur", { in: "edge", stdDeviation: 4, result: "soft" }),
        h("feFlood", { "flood-color": l.rim, "flood-opacity": "0.9", result: "rimc" }),
        h("feComposite", { in: "rimc", in2: "soft", operator: "in", result: "glow" }),
        h("feComposite", { in: "glow", in2: "SourceAlpha", operator: "in", result: "rimin" }),
        h("feMerge", {}, [h("feMergeNode", { in: "lit" }), h("feMergeNode", { in: "rimin" })])
      );
    }
    return h("filter", { id: "{uid}-light", filterUnits: "userSpaceOnUse", x: -1000, y: -900, width: 2000, height: 2600, "color-interpolation-filters": "sRGB" }, kids);
  }

  /* The figure as an SVG string; every id (and url(#...) reference) starts with idPrefix + "-". */
  function svg(st, idPrefix) {
    if (!idPrefix) throw new Error("rig.svg: an id prefix is required (scene-actor-n)");
    return P.serialize(tree(st), idPrefix);
  }

  // ---------- anchor points (body units, feet at FEET when standing) ----------

  /* A head-local y (unscaled drawing) after the head scale about the chin. */
  function headY(y) { var S = P.RIG.headScaleY; return S + (y - S) * (P.LOOK.headScale || 1); }

  /* The head and hair box (the face area tags must not cover): the unscaled box x +-114, y 40..318,
   * scaled with the head. */
  function headBox(st) {
    var lay = layout(st || {});
    var k = P.LOOK.headScale || 1;
    var top = headY(40), bottom = headY(318);
    var c = upper(lay, { x: lay.headTX, y: (top + bottom) / 2 + lay.lift });
    return { x: c.x - 114 * k, y: c.y - (bottom - top) / 2, width: 228 * k, height: bottom - top };
  }

  function head(st) {
    var lay = layout(st || {});
    return upper(lay, { x: lay.headTX, y: headY(200) + lay.lift });
  }

  /* The screen-right hand (the one that holds props). */
  function hand(st) {
    var lay = layout(st || {});
    var g = gripLocal(lay.pose.right);
    return upper(lay, { x: -g.x + lay.armXR, y: g.y + lay.lift });
  }

  function feet(st) {
    var lay = layout(st || {});
    var L = lay.legs.left, R = lay.legs.right;
    return { x: (L.ankle.x + R.ankle.x) / 2, y: Math.max(L.sole, R.sole) + lay.dy };
  }

  /* Screen slots for a canvas {width, height} (HFKit.slots reads it per call, so a mount sees its
   * composition's canvas):
   *   landscape side slots: about 1.35x the old side presenter (its calm framing showed 690 body
   *     units in 456 px of a 1920 x 1080 frame): k 0.892, x 300 / 1620, feet at y 1470 (below the
   *     frame edge); scaled with the canvas for other landscape sizes.
   *   bottom: {left: {x}, right: {x}, k, feetY}, the vertical host: shown from about the waist up,
   *     cropped by the frame bottom, face box 320-330 px tall between y 1060 and 1400 on 1080 x 1920 (centred on
   *     y 1230), left or right of centre.
   * On a portrait canvas there is no side slot: "left" / "right" are the bottom slot's sides. */
  var SIDE_K = Math.round((1.35 * 456 / (724 - 34)) * 1000) / 1000; // 0.892
  var BOTTOM_K = 0.97, BOTTOM_X = 205, BOTTOM_FACE_Y = 1230;

  function slots(canvas) {
    var W = (canvas && canvas.width) || 1920, H = (canvas && canvas.height) || 1080;
    var bk = Math.round(BOTTOM_K * Math.min(W / 1080, H / 1920) * 1000) / 1000;
    var faceMid = (headY(40) + headY(318)) / 2; // the head box centre in body units (standing)
    var bx = Math.round(BOTTOM_X * W / 1080);
    var bottom = {
      left: { x: bx }, right: { x: W - bx }, k: bk,
      feetY: Math.round(BOTTOM_FACE_Y * H / 1920 + (FEET - faceMid) * bk),
    };
    if (H > W) return { k: bk, left: bottom.left.x, right: bottom.right.x, feetY: bottom.feetY, bottom: bottom };
    var sx = W / 1920, sy = H / 1080;
    return { k: Math.round(SIDE_K * sy * 1000) / 1000, left: Math.round(300 * sx), right: Math.round(1620 * sx), feetY: Math.round(1470 * sy), bottom: bottom };
  }
  function canvasNow() { return (root.HFKit && root.HFKit.CANVAS) || { width: 1920, height: 1080 }; }

  /* Ground covered by one cycle (body units): the planted foot's travel, twice per stride.
   * Move the actor by STRIDE[cycle] * k px per cycle and the feet do not slide. */
  function strideOf(name) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < 120; i++) {
      var x = layout({ cycle: name, phase: i / 120, facing: 1 }).legs.left.ankle.x;
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
    return Math.round(2 * (hi - lo));
  }
  var STRIDE = { walk: strideOf("walk"), run: strideOf("run") };

  A.rig = {
    FEET: FEET, VIEW: VIEW, slots: slots, STRIDE: STRIDE, cycleBlend: cycleBlend, light: lightOf,
    POSES: POSES, CYCLES: CYCLES, OUTFITS: OUTFITS, HELD: HELD, EXPRESSIONS: EXPRESSIONS, HAIR: HAIR,
    animatedPose: animatedPose, blendPoses: P.blendPoses, faceAt: P.faceAt,
    palette: paletteFor, layout: layout, tree: tree, svg: svg,
    headBox: headBox, head: head, hand: hand, feet: feet,
  };
  // rig.SLOT: the slots of the current canvas (HFKit.CANVAS), read when asked
  Object.defineProperty(A.rig, "SLOT", { enumerable: true, get: function () { return slots(canvasNow()); } });
  if (root.HFKit) root.HFKit.rig = A.rig;
})(typeof globalThis !== "undefined" ? globalThis : window);
