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
 *            character?, frame?, track?, blend?, gazeBias?}
 *     pose        name in POSES, or an arm-pose object {left, right, tilt, gazeX, gazeY}
 *     cycle/phase "walk" | "run" | "jump" and its phase 0..1 (legs; arms too while pose is idle)
 *     outfit      name in OUTFITS (character.defaultOutfit when missing)
 *     held        name in HELD, carried in the screen-right hand
 *     expression  name in EXPRESSIONS, or a face object (presenter faceAt)
 *     mouth       loudness 0..1;  blink 0..1 (1 = shut);  breath -1..1 (breathing wave)
 *     facing      -1 (screen left), 0 (front), 1 (screen right): stride and gaze direction
 *     character   {face: {hair, glasses, skin, hairColor?}, colors?} (default: the host's face)
 *     frame       frame number: adds the pose's living motion, hair sway and head tilt
 *     track       the scene's mouth array (talk gestures follow the voice)
 *     blend       {pose, expression, k}: blend from that pose/expression to this one (k 0..1) */
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
      palette: "blazer", torso: "presenter", coat: 948, shoe: "dress",
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
  var HOST_FACE = { hair: "curly", glasses: true, skin: P.LOOK.skinTone };

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
      glasses: !!face.glasses,
      glassesColor: P.LOOK.glassesColor,
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

  function legPose(swing, knee, foot) { return { swing: swing, knee: knee, foot: foot || 0 }; }

  /* One stride (two steps) per phase 0..1. */
  function walk(phase) {
    var th = 2 * Math.PI * phase;
    var s = Math.sin(th), c = Math.cos(th);
    var kneeL = 5 + 34 * Math.pow(Math.max(0, c), 1.4);
    var kneeR = 5 + 34 * Math.pow(Math.max(0, -c), 1.4);
    var sh = 2 + 13 * s;
    return {
      legs: { left: legPose(19 * s, kneeL, -kneeL * 0.35), right: legPose(-19 * s, kneeR, -kneeR * 0.35), spread: 1.2 },
      arms: { left: arm(sh, sh - 16, "relaxed", -10, 0.95, 0.92), right: arm(-sh + 4, -sh + 4 + 16, "relaxed", -10, 0.95, 0.92) },
      lean: 2, lift: 0, sway: -8 - 5 * Math.abs(s),
    };
  }

  function run(phase) {
    var th = 2 * Math.PI * phase;
    var s = Math.sin(th), c = Math.cos(th);
    var kneeL = 22 + 78 * Math.pow(Math.max(0, c), 1.2);
    var kneeR = 22 + 78 * Math.pow(Math.max(0, -c), 1.2);
    var sh = 26 * s;
    return {
      legs: { left: legPose(34 * s, kneeL, -kneeL * 0.3), right: legPose(-34 * s, kneeR, -kneeR * 0.3), spread: 0.8 },
      arms: { left: arm(6 + sh, sh - 92, "fist", 0, 0.92, 0.82), right: arm(6 - sh, -sh + 92, "fist", 0, 0.92, 0.82) },
      lean: 9, lift: 18 * Math.max(0, -Math.cos(2 * th)), sway: -20,
    };
  }

  function smooth01(t) { var c = clamp(t, 0, 1); return c * c * (3 - 2 * c); }

  /* Crouch (0-0.25), take-off, flight (0.25-0.85, peak 260 units), landing crouch, stand. */
  function jump(phase) {
    var p = clamp(phase, 0, 1);
    var crouch = p < 0.18 ? smooth01(p / 0.18) : p < 0.28 ? 1 - smooth01((p - 0.18) / 0.1)
      : p < 0.82 ? 0 : p < 0.9 ? smooth01((p - 0.82) / 0.08) : 1 - smooth01((p - 0.9) / 0.1);
    var u = p > 0.25 && p < 0.85 ? (p - 0.25) / 0.6 : -1;
    var air = u >= 0 ? 4 * u * (1 - u) : 0;
    var tuck = u >= 0 ? Math.sin(Math.PI * u) : 0;
    var up = u >= 0 ? Math.sin(Math.PI * Math.min(1, u * 1.4)) : 0;
    var sw = 28 * crouch + 30 * tuck;
    var kn = 62 * crouch + 62 * tuck;
    var back = arm(lerp(4, -22, crouch), lerp(-50, -40, crouch), "relaxed", -14, 0.95, 0.9);
    var high = arm(150, 168, "open", 4);
    function mixArm(a, b, t) {
      return arm(lerp(a.shoulder, b.shoulder, t), lerp(a.elbow, b.elbow, t), t < 0.5 ? a.hand : b.hand,
        lerp(a.wrist, b.wrist, t), lerp(a.upper, b.upper, t), lerp(a.fore, b.fore, t));
    }
    var armL = mixArm(back, high, up);
    var armR = mixArm(back, high, up);
    return {
      legs: { left: legPose(sw + 4, kn, -tuck * 20), right: legPose(sw - 4, kn + 6 * tuck, -tuck * 26), spread: 2.5 },
      arms: { left: armL, right: armR },
      lean: 7 * crouch, lift: 260 * air, sway: -22 * tuck,
    };
  }

  var CYCLES = { walk: walk, run: run, jump: jump };

  /* Standing still: feet a little apart, toes out. */
  var STAND = { legs: { left: legPose(0, 0), right: legPose(0, 0), spread: 3 }, arms: null, lean: 0, lift: 0, sway: 0 };

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

  function poseOf(st) {
    var p = st.pose === undefined ? "idle" : st.pose;
    if (typeof p === "string") {
      if (!POSES[p]) throw new Error("rig: unknown pose " + p);
      p = st.frame === undefined ? POSES[p] : animatedPose(p, st.frame, st.track);
    }
    if (st.blend && st.blend.pose !== undefined && st.blend.k < 1) {
      var from = poseOf({ pose: st.blend.pose, frame: st.frame, track: st.track });
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

  /* Everything that places the parts, in body units. */
  function layout(st) {
    var facing = st.facing || 0;
    var dir = facing < 0 ? -1 : 1;
    var cyc = STAND;
    if (st.cycle) {
      if (!CYCLES[st.cycle]) throw new Error("rig: unknown cycle " + st.cycle);
      cyc = CYCLES[st.cycle](st.phase || 0);
    }
    var pose = poseOf(st);
    var poseName = typeof st.pose === "string" ? st.pose : null;
    if (cyc.arms && (poseName === "idle" || st.pose === undefined)) {
      // the cycle swings the arms; facing left mirrors the figure (the arms swap sides)
      pose = Object.assign({}, pose, dir > 0 ? { left: cyc.arms.left, right: cyc.arms.right } : { left: cyc.arms.right, right: cyc.arms.left });
    }
    if (st.held) {
      if (!HELD[st.held]) throw new Error("rig: unknown held item " + st.held);
      pose = Object.assign({}, pose, { right: Object.assign({}, pose.right, { hand: HELD[st.held].hand }) });
    }
    var legs = dir > 0 ? { left: cyc.legs.left, right: cyc.legs.right } : { left: cyc.legs.right, right: cyc.legs.left };
    var spread = cyc.legs.spread;
    var hipX = st.cycle ? STRIDE_HIP_X : HIP_X;
    var L = legPoints(legs.left, -1, dir, spread, hipX);
    var R = legPoints(legs.right, 1, dir, spread, hipX);
    var ground = FEET - Math.max(L.sole, R.sole);
    var b = 0.015 * (st.breath || 0);
    return {
      dir: dir, facing: facing, pose: pose, legs: { left: L, right: R }, cycle: cyc,
      dy: ground - (cyc.lift || 0), lean: (cyc.lean || 0) * dir, sway: (cyc.sway || 0) * dir,
      b: b, lift: -b * (P.RIG.waist - 344),
      front: !st.cycle && facing === 0,
    };
  }

  /* Hip, knee and ankle of one leg; `side` -1 = screen-left leg. Knees bend backwards. */
  function legPoints(leg, side, dir, spread, hipX) {
    var hip = { x: side * hipX, y: HIP_Y };
    var a = side * spread + dir * leg.swing;
    var knee = { x: hip.x + THIGH * Math.sin(rad(a)), y: hip.y + THIGH * Math.cos(rad(a)) };
    var b = a - dir * leg.knee;
    var ankle = { x: knee.x + SHIN * Math.sin(rad(b)), y: knee.y + SHIN * Math.cos(rad(b)) };
    return { hip: hip, knee: knee, ankle: ankle, a: a, b: b, foot: leg.foot || 0, side: side, sole: ankle.y + SOLE };
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

  function legNode(pal, o, lp, lay, part) {
    var hip = lp.hip, k = lp.knee, an = lp.ankle;
    var thigh = capsule(hip.x, hip.y, 42, k.x, k.y, 33);
    var shin = capsule(k.x, k.y, 33, an.x, an.y, 27);
    // shade on the side turned from the light (screen-right of each leg)
    var shade = capsule(hip.x + 20, hip.y + 12, 18, k.x + 15, k.y, 13);
    var shade2 = capsule(k.x + 15, k.y, 13, an.x + 11, an.y - 6, 10);
    var nx = Math.cos(rad(lp.b)), ny = -Math.sin(rad(lp.b)); // across the shin
    var foot = lay.front ? 0 : lp.foot * lay.dir;
    return h("g", { "data-part": part }, [
      h("g", { fill: pal.trousersLine, stroke: pal.trousersLine, "stroke-width": 7, "stroke-linejoin": "round" }, [h("path", { d: thigh }), h("path", { d: shin })]),
      h("g", { fill: pal.trousers }, [h("path", { d: thigh }), h("path", { d: shin })]),
      h("path", { d: shade, fill: pal.trousersShade, opacity: 0.8 }),
      h("path", { d: shade2, fill: pal.trousersShade, opacity: 0.8 }),
      // knee fold and the trouser hem
      h("path", { d: "M " + f2(k.x - 14) + " " + f2(k.y - 6) + " q 12 10 26 2", fill: "none", stroke: pal.trousersLine, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.5 }),
      h("path", { d: "M " + f2(an.x - nx * 29) + " " + f2(an.y - ny * 29 - 6) + " L " + f2(an.x + nx * 29) + " " + f2(an.y + ny * 29 - 6), stroke: pal.trousersLine, "stroke-width": 4, "stroke-linecap": "round" }),
      h("g", { transform: "translate(" + f2(an.x) + " " + f2(an.y) + ") rotate(" + f2(foot) + ")" }, [shoeNode(pal, o.shoe, lay.front, lp.side, lay.dir)]),
    ]);
  }

  /* Seat of the trousers: covers the hip joints; outlined on the sides only. */
  /* Seat of the trousers: covers the hip joints; outlined on the sides only. It tapers to the
   * legs, so it narrows while striding (hips closer together). */
  function pelvisNode(pal, hipX) {
    var o = hipX + 44, m = hipX + 84, c = Math.min(22, hipX - 2);
    var d = "M -170 770 L 170 770 C 170 826 " + m + " 878 " + o + " 906 L " + c + " 906 Q 0 918 " + -c + " 906 L " + -o + " 906 C " + -m + " 878 -170 826 -170 770 Z";
    var sides = "M -170 770 C -170 826 " + -m + " 878 " + -o + " 906 M 170 770 C 170 826 " + m + " 878 " + o + " 906";
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
    var sw = lay.sway; // hem trails the stride
    var gap = lab ? 14 : 32;
    var line = { stroke: pal.jacketLine, "stroke-width": LINE, "stroke-linejoin": "round" };
    var left = "M -171 800 L " + f2(-182 + sw) + " " + (hem - 6) + " C " + f2(-130 + sw) + " " + (hem + 8) + " " + f2(-64 + sw * 0.6) + " " + (hem + 10) + " " + f2(-gap + sw * 0.4) + " " + hem + " L -1 800 Z";
    var right = "M 171 800 L " + f2(182 + sw) + " " + (hem - 6) + " C " + f2(130 + sw) + " " + (hem + 8) + " " + f2(64 + sw * 0.6) + " " + (hem + 10) + " " + f2(gap + 4 + sw * 0.4) + " " + hem + " L 5 800 Z";
    // outlines leave the top edge open: the panels continue the torso without a seam
    var open = function (d) { return d.replace(/ Z$/, ""); };
    var kids = [
      h("path", { d: left, fill: pal.jacket }),
      h("path", { d: right, fill: pal.jacket }),
      h("path", Object.assign({ d: open(left), fill: "none" }, line)),
      // shade on the right side, as on the torso above
      h("path", { d: "M 108 802 L 169 802 L " + f2(178 + sw) + " " + (hem - 8) + " C " + f2(160 + sw) + " " + (hem + 2) + " " + f2(130 + sw) + " " + (hem + 5) + " " + f2(118 + sw * 0.8) + " " + (hem + 6) + " Z", fill: pal.jacketShade }),
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
        kids.push(h("path", { d: "M " + s * 148 + " 858 L " + s * 74 + " 852 L " + s * 76 + " 872 L " + s * 150 + " 878 Z", fill: s > 0 ? pal.jacketShade : pal.jacket, stroke: pal.jacketLine, "stroke-width": 2.5, "stroke-linejoin": "round" }));
      });
    }
    return h("g", { "data-part": "coat" }, kids);
  }

  function sweaterHemNode(pal) {
    var d = "M -171 800 L -168 872 C -100 882 100 882 168 872 L 171 800 Z";
    return h("g", { "data-part": "coat" }, [
      h("path", { d: d, fill: pal.jacket }),
      h("path", { d: "M 108 800 L 171 800 L 168 872 C 150 876 130 878 112 879 Z", fill: pal.jacketShade }),
      h("path", { d: "M -169 842 C -100 852 100 852 169 842 L 168 872 C 100 882 -100 882 -168 872 Z", fill: pal.jacketShade, opacity: 0.75 }),
      h("path", { d: [-120, -80, -40, 0, 40, 80, 120].map(function (x) { return "M " + x + " 850 L " + x + " 876"; }).join(" "), stroke: pal.jacketLine, "stroke-width": 2, opacity: 0.35 }),
      h("path", { d: "M -171 800 L -168 872 C -100 882 100 882 168 872 L 171 800", fill: "none", stroke: pal.jacketLine, "stroke-width": LINE, "stroke-linejoin": "round" }),
    ]);
  }

  function beltNode(pal) {
    return h("g", { "data-part": "coat" }, [
      h("path", { d: "M -172 806 L 172 806 L 171 842 L -171 842 Z", fill: pal.belt, stroke: pal.shoeLine, "stroke-width": 3, "stroke-linejoin": "round" }),
      h("path", { d: "M -120 806 L -120 842 M 120 806 L 120 842", stroke: pal.shoeLine, "stroke-width": 3, opacity: 0.6 }),
      h("rect", { x: -22, y: 800, width: 44, height: 48, rx: 6, fill: pal.buckle, stroke: "#5A4318", "stroke-width": 3 }),
      h("rect", { x: -11, y: 812, width: 22, height: 24, rx: 3, fill: pal.belt }),
    ]);
  }

  // ---------- torsos for the new outfits (the presenter draws blazer and lab coat) ----------

  function sweaterNode(pal) {
    var clip = "{uid}-torso";
    return h("g", { "data-part": "torso" }, [
      h("defs", {}, [h("clipPath", { id: clip }, [h("path", { d: P.TORSO_PATH })])]),
      h("path", { d: P.TORSO_PATH, fill: pal.jacket }),
      h("g", { "clip-path": "url(#" + clip + ")" }, [
        h("path", { d: P.TORSO_PATH, fill: "none", stroke: pal.rim, "stroke-width": 14, opacity: 0.3 }),
        // a band across the chest
        h("rect", { x: -220, y: 486, width: 440, height: 34, fill: pal.accent }),
        h("rect", { x: -220, y: 532, width: 440, height: 10, fill: pal.accent }),
        h("path", { d: "M 104 360 C 156 370 178 398 176 432 C 172 500 162 570 152 640 L 156 840 L 110 840 C 120 700 124 560 120 450 C 118 410 112 380 104 360 Z", fill: pal.jacketShade, opacity: 0.85 }),
        h("path", { d: "M -176 420 C -156 396 -130 384 -104 382 C -132 402 -152 440 -162 490 Z", fill: pal.jacketLight, opacity: 0.7 }),
        h("path", { d: "M -150 560 C -140 600 -138 640 -142 690 M 150 560 C 140 600 138 640 142 690", fill: "none", stroke: pal.jacketShade, "stroke-width": 6, "stroke-linecap": "round" }),
      ]),
      h("path", { d: P.TORSO_OUTLINE, fill: "none", stroke: pal.jacketLine, "stroke-width": LINE, "stroke-linejoin": "round" }),
      // ribbed crew neck
      h("path", { d: "M -50 340 C -26 384 26 384 50 340", fill: "none", stroke: pal.jacketShade, "stroke-width": 16, "stroke-linecap": "round" }),
      h("path", { d: "M -58 342 C -30 394 30 394 58 342", fill: "none", stroke: pal.jacketLine, "stroke-width": 3, "stroke-linecap": "round" }),
      h("path", { d: "M -43 338 C -22 374 22 374 43 338", fill: "none", stroke: pal.jacketLine, "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0.7 }),
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
    var headT = "translate(0 " + f2(lay.lift) + ") rotate(" + f2(tilt) + " 0 " + P.RIG.headPivotY + ")";
    // the back hair goes behind the neck and shoulders (long hair falls behind them)
    var back = h("g", { transform: headT }, [hairBack(pal, pal.hairStyle, sway)]);
    var head = h("g", { transform: headT }, [
      P.parts.head(pal),
      P.parts.face(pal, face, clamp(st.mouth || 0, 0, 1), clamp(st.blink || 0, 0, 1), gazeX, gazeY, pal.look.glasses),
      hairFront(pal, pal.hairStyle, sway),
    ]);
    var arms = [P.parts.arm(pose.left, false, pal, "arm-left")];
    if (st.held) arms.push(heldNode(st.held, pose));
    arms.push(P.parts.arm(pose.right, true, pal, "arm-right"));

    var air = clamp(1 - (lay.cycle.lift || 0) / 400, 0.4, 1);
    var waist = P.RIG.waist;
    var body = h("g", { "data-part": "body", transform: "translate(0 " + f2(lay.dy) + ")" }, [
      legNode(pal, o, lay.legs.left, lay, "leg-left"),
      legNode(pal, o, lay.legs.right, lay, "leg-right"),
      pelvisNode(pal, lay.legs.right.hip.x),
      h("g", { "data-part": "upper", transform: "rotate(" + f2(lay.lean) + " 0 " + HIP_Y + ")" }, [
        back,
        h("g", { transform: "translate(0 " + f2(lay.lift) + ")" }, [P.parts.collarBack(pal), P.parts.neck(pal)]),
        h("g", { transform: "translate(0 " + waist + ") scale(" + f2(1 + lay.b * 0.4) + " " + f2(1 + lay.b) + ") translate(0 " + -waist + ")" }, [torso, below]),
        head,
        h("g", { transform: "translate(0 " + f2(lay.lift) + ")" }, arms),
      ]),
    ]);
    return h("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      "data-actor": outfitName,
      viewBox: VIEW.x + " " + VIEW.y + " " + VIEW.w + " " + VIEW.h,
      width: st.width, height: st.height,
      preserveAspectRatio: "xMidYMid meet",
      style: "overflow: visible",
    }, [
      h("ellipse", { "data-part": "shadow", cx: 0, cy: FEET + 4, rx: f2(210 * air), ry: f2(28 * air), fill: "#000", opacity: f2(0.18 * air) }),
      body,
    ]);
  }

  /* The figure as an SVG string; every id (and url(#...) reference) starts with idPrefix + "-". */
  function svg(st, idPrefix) {
    if (!idPrefix) throw new Error("rig.svg: an id prefix is required (scene-actor-n)");
    return P.serialize(tree(st), idPrefix);
  }

  // ---------- anchor points (body units, feet at FEET when standing) ----------

  /* The head and hair box (the face area tags must not cover). */
  function headBox(st) {
    var lay = layout(st || {});
    var c = upper(lay, { x: 0, y: 180 + lay.lift });
    return { x: c.x - 114, y: c.y - 140, width: 228, height: 278 };
  }

  function head(st) {
    var lay = layout(st || {});
    return upper(lay, { x: 0, y: 200 + lay.lift });
  }

  /* The screen-right hand (the one that holds props). */
  function hand(st) {
    var lay = layout(st || {});
    var g = gripLocal(lay.pose.right);
    return upper(lay, { x: -g.x, y: g.y + lay.lift });
  }

  function feet(st) {
    var lay = layout(st || {});
    var L = lay.legs.left, R = lay.legs.right;
    return { x: (L.ankle.x + R.ankle.x) / 2, y: Math.max(L.sole, R.sole) + lay.dy };
  }

  /* Side slot: about 1.35x the old presenter (its calm framing showed 690 body units in 456 px). */
  var oldBox = P.presenterSize ? P.presenterSize("small") : { width: 422, height: 456 };
  var SLOT = { k: Math.round((1.35 * oldBox.height / (724 - 34)) * 1000) / 1000, left: 300, right: 1620, feetY: 1470 };

  A.rig = {
    FEET: FEET, VIEW: VIEW, SLOT: SLOT,
    POSES: POSES, CYCLES: CYCLES, OUTFITS: OUTFITS, HELD: HELD, EXPRESSIONS: EXPRESSIONS, HAIR: HAIR,
    animatedPose: animatedPose, blendPoses: P.blendPoses, faceAt: P.faceAt,
    palette: paletteFor, layout: layout, tree: tree, svg: svg,
    headBox: headBox, head: head, hand: hand, feet: feet,
  };
  if (root.HFKit) root.HFKit.rig = A.rig;
})(typeof globalThis !== "undefined" ? globalThis : window);
