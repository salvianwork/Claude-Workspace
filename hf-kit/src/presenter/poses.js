/* hf-kit presenter, part 3/5: rig, poses, expressions and their living motion (port of
 * templates/src/presenter/poses.ts and animatedPose from Presenter.tsx).
 *
 * Body space: x = 0 is the body's centre line, y grows downwards; the waist crop is at y = 760.
 * Arms are described for the screen-LEFT arm; the right arm is drawn mirrored. Angles in
 * degrees: 0 = hanging down, 90 = out to the side, 180 = straight up; negative values swing
 * the arm across the body. `elbow` is the forearm's absolute angle. */
(function (root) {
  "use strict";
  var P = (root.HFKitPresenter = root.HFKitPresenter || {});

  var RIG = {
    shoulderX: 150, shoulderY: 412, upperArm: 148, forearm: 134,
    shoulderWidth: 70, elbowWidth: 56, wristWidth: 46, // sleeve taper
    waist: 760, headPivotY: 300,
    headScaleY: 312, // the chin: the head is scaled about this point (LOOK.headScale)
  };

  /* Transform that draws the head LOOK.headScale times bigger about the chin. */
  function headScaleTransform(look) {
    var k = (look && look.headScale) || 1;
    return "translate(0 " + RIG.headScaleY + ") scale(" + k + ") translate(0 " + -RIG.headScaleY + ")";
  }

  function arm(shoulder, elbow, hand, wrist, upper, fore) {
    return { shoulder: shoulder, elbow: elbow, hand: hand, wrist: wrist || 0,
      upper: upper === undefined ? 1 : upper, fore: fore === undefined ? 1 : fore };
  }
  function withArm(a, patch) { return Object.assign({}, a, patch); }

  /* Calm idle: elbows by the sides, hands loosely together at the waist. */
  var IDLE_ARM = arm(2, -50, "relaxed", -22, 0.9, 0.8);
  /* The resting arm while the other hand gestures. */
  var REST_ARM = arm(2, -58, "relaxed", -20, 0.9, 0.78);

  var POSES = {
    idle: { left: withArm(IDLE_ARM, { elbow: -53 }), right: IDLE_ARM, tilt: 0, gazeX: 0, gazeY: 0 },
    talk: { left: arm(6, 170, "open", -18, 0.95, 0.88), right: REST_ARM, tilt: -1.5, gazeX: 0, gazeY: 0 },
    "point-left": { left: arm(62, 106, "point", -4), right: REST_ARM, tilt: -3, gazeX: -1, gazeY: -0.2 },
    "point-right": { left: REST_ARM, right: arm(62, 106, "point", -4), tilt: 3, gazeX: 1, gazeY: -0.2 },
    think: { left: arm(6, -84, "relaxed", -14, 0.97, 0.9), right: arm(-30, -150, "fist", 4, 0.62), tilt: 5, gazeX: -0.75, gazeY: -1 },
    surprised: { left: arm(30, 160, "open", -8), right: arm(30, 160, "open", -8), tilt: 0, gazeX: 0, gazeY: -0.1 },
    celebrate: { left: arm(112, 172, "fist", 4), right: arm(112, 172, "fist", 4), tilt: 0, gazeX: 0, gazeY: -0.3 },
    wave: { left: REST_ARM, right: arm(128, 170, "open", 4), tilt: 2, gazeX: 0, gazeY: 0 },
  };

  /* The talk pose with the hands swapped. */
  var TALK_MIRROR = Object.assign({}, POSES.talk, { left: POSES.talk.right, right: POSES.talk.left, tilt: 1.5 });

  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) {
    var c = Math.min(1, Math.max(0, t));
    return c * c * (3 - 2 * c);
  }
  /* Shortest way round between two angles. */
  function lerpAngle(a, b, t) { return a + ((((b - a + 540) % 360) + 360) % 360 - 180) * t; }

  function blendArm(a, b, t) {
    return {
      shoulder: lerp(a.shoulder, b.shoulder, t),
      elbow: lerpAngle(a.elbow, b.elbow, t),
      wrist: lerp(a.wrist, b.wrist, t),
      upper: lerp(a.upper, b.upper, t),
      fore: lerp(a.fore, b.fore, t),
      hand: t < 0.5 ? a.hand : b.hand,
    };
  }

  /* Blend two poses (t: 0 = a, 1 = b, eased). */
  function blendPoses(a, b, t) {
    var s = smooth(t);
    return {
      left: blendArm(a.left, b.left, s),
      right: blendArm(a.right, b.right, s),
      tilt: lerp(a.tilt, b.tilt, s),
      gazeX: lerp(a.gazeX, b.gazeX, s),
      gazeY: lerp(a.gazeY, b.gazeY, s),
    };
  }

  function poseAt(from, to, t) { return blendPoses(POSES[from], POSES[to], t); }

  /* Shoulder, elbow and wrist of an arm in body space (screen-left arm). */
  function armPoints(a) {
    var rad = function (d) { return (d * Math.PI) / 180; };
    var s = { x: -RIG.shoulderX, y: RIG.shoulderY };
    var e = { x: s.x - RIG.upperArm * a.upper * Math.sin(rad(a.shoulder)), y: s.y + RIG.upperArm * a.upper * Math.cos(rad(a.shoulder)) };
    var w = { x: e.x - RIG.forearm * a.fore * Math.sin(rad(a.elbow)), y: e.y + RIG.forearm * a.fore * Math.cos(rad(a.elbow)) };
    return { s: s, e: e, w: w };
  }

  // ---------- face ----------

  /* Mouth shape for a loudness value 0-1: <0.15 closed, <0.4 slight, <0.7 open, else wide. */
  function mouthShape(v) { return v < 0.15 ? "closed" : v < 0.4 ? "slight" : v < 0.7 ? "open" : "wide"; }

  function brow(raise, inner, arch) { return { raise: raise, inner: inner, arch: arch }; }

  var EXPRESSIONS = {
    neutral: { browL: brow(0, 0, 4), browR: brow(0, 0, 4), eyeOpen: 1, squint: 0.18, smile: 6.5, mouthWidth: 0.95, oh: 0, blush: 0.06 },
    happy: { browL: brow(-5, -1, 8), browR: brow(-5, -1, 8), eyeOpen: 0.95, squint: 0.45, smile: 11, mouthWidth: 1.15, oh: 0, blush: 0.16 },
    curious: { browL: brow(-12, -4, 9), browR: brow(1, 3, 4), eyeOpen: 1.05, squint: 0.05, smile: 3, mouthWidth: 0.8, oh: 0, blush: 0.06 },
    surprised: { browL: brow(-15, -6, 11), browR: brow(-15, -6, 11), eyeOpen: 1.28, squint: 0, smile: 0, mouthWidth: 0.7, oh: 1, blush: 0.06 },
    thinking: { browL: brow(-7, 6, 6), browR: brow(2, 7, 3), eyeOpen: 0.86, squint: 0.15, smile: -1, mouthWidth: 0.75, oh: 0, blush: 0.04 },
  };

  function blendBrow(a, b, t) {
    return { raise: lerp(a.raise, b.raise, t), inner: lerp(a.inner, b.inner, t), arch: lerp(a.arch, b.arch, t) };
  }

  function faceAt(from, to, t) {
    var a = EXPRESSIONS[from];
    var b = EXPRESSIONS[to];
    if (!a || !b) throw new Error("presenter: unknown expression " + (a ? to : from));
    var s = smooth(t);
    return {
      browL: blendBrow(a.browL, b.browL, s),
      browR: blendBrow(a.browR, b.browR, s),
      eyeOpen: lerp(a.eyeOpen, b.eyeOpen, s),
      squint: lerp(a.squint, b.squint, s),
      smile: lerp(a.smile, b.smile, s),
      mouthWidth: lerp(a.mouthWidth, b.mouthWidth, s),
      oh: lerp(a.oh, b.oh, s),
      blush: lerp(a.blush, b.blush, s),
    };
  }

  // ---------- motion of a pose over time ----------

  function wave(frame, periodFrames, phase) { return Math.sin((2 * Math.PI * frame) / periodFrames + (phase || 0)); }

  /* Average loudness over the last few frames. */
  function activity(mouth, frame, span) {
    span = span || 8;
    if (!mouth.length) return 0;
    var sum = 0;
    for (var f = frame - span + 1; f <= frame; f++) sum += mouth[f] || 0;
    return sum / span;
  }

  /* The pose `name` at `frame` with its living motion: talk alternates the gesturing hand as
   * the voice speaks, wave rocks the wrist, celebrate pumps the fists. */
  function animatedPose(name, frame, mouth) {
    mouth = mouth || [];
    var base = POSES[name];
    if (!base) throw new Error("presenter: unknown pose " + name);
    var mv = function (a, ds, de, dw) {
      return Object.assign({}, a, { shoulder: a.shoulder + ds, elbow: a.elbow + de, wrist: a.wrist + (dw || 0) });
    };
    var w;
    switch (name) {
      case "talk": {
        var spoken = 0;
        for (var f = 0; f <= frame && f < mouth.length; f++) spoken += mouth[f];
        var phase = mouth.length ? spoken / 20 : frame / 75;
        var g = 0.5 - 0.5 * Math.cos(Math.PI * phase);
        var p = blendPoses(base, TALK_MIRROR, g);
        var act = mouth.length ? activity(mouth, frame) : 0.4;
        var beat = (mouth[frame] || 0) * 6;
        return Object.assign({}, p, {
          left: mv(p.left, act * 4 * (1 - g), -act * 8 * (1 - g) - beat * (1 - g), beat * (1 - g)),
          right: mv(p.right, act * 4 * g, -act * 8 * g - beat * g, beat * g),
        });
      }
      case "wave":
        w = wave(frame, 24);
        return Object.assign({}, base, { right: mv(base.right, 2 * w, 5 * w, 16 * w) });
      case "celebrate":
        w = wave(frame, 26);
        return Object.assign({}, base, { left: mv(base.left, 5 * w, 4 * w), right: mv(base.right, -5 * w, -4 * w) });
      case "point-left":
      case "point-right": {
        w = wave(frame, 70);
        var k = name === "point-left" ? "left" : "right";
        var out = Object.assign({}, base);
        out[k] = mv(base[k], 1.5 * w, 3 * w);
        return out;
      }
      case "surprised":
        w = wave(frame, 90);
        return Object.assign({}, base, { left: mv(base.left, w, 2 * w), right: mv(base.right, w, 2 * w) });
      case "think":
        w = wave(frame, 110);
        return Object.assign({}, base, { right: mv(base.right, 0, 1.5 * w, 3 * w), gazeX: base.gazeX + 0.1 * w });
      default:
        w = wave(frame, 130);
        return Object.assign({}, base, { left: mv(base.left, w, 1.5 * w), right: mv(base.right, -w, -1.5 * w) });
    }
  }

  P.RIG = RIG;
  P.headScaleTransform = headScaleTransform;
  P.POSES = POSES;
  P.TALK_MIRROR = TALK_MIRROR;
  P.EXPRESSIONS = EXPRESSIONS;
  P.lerp = lerp;
  P.smooth = smooth;
  P.blendPoses = blendPoses;
  P.poseAt = poseAt;
  P.armPoints = armPoints;
  P.mouthShape = mouthShape;
  P.faceAt = faceAt;
  P.animatedPose = animatedPose;
  if (root.HFKit) root.HFKit.presenter = P;
})(typeof globalThis !== "undefined" ? globalThis : window);
