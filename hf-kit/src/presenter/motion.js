/* hf-kit presenter, part 2/5: the "alive" motion (port of templates/src/alive/motion.ts).
 * Pure functions of the frame (30 fps) and a seed: every render is identical. */
(function (root) {
  "use strict";
  var P = (root.HFKitPresenter = root.HFKitPresenter || {});
  var FPS = 30;
  var BLINK = 7; // frames of one blink (close, hold, open)

  /* mulberry32: same seed -> same sequence, values in [0, 1). */
  function seededRandom(seed) {
    var a = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Start frames of the blinks in a scene: one every 2-5 s, seeded by the scene id. */
  function blinkStarts(seed, durationInFrames) {
    var rnd = seededRandom(seed * 7919 + 13);
    var starts = [];
    var f = Math.round(15 + rnd() * 45);
    while (f < durationInFrames) {
      starts.push(f);
      f += Math.round(2 * FPS + rnd() * 3 * FPS);
    }
    return starts;
  }

  /* Eyelid closure at `frame`: 0 = open, 1 = shut. */
  function blinkAmount(frame, seed) {
    var starts = blinkStarts(seed, frame + 1);
    for (var i = 0; i < starts.length; i++) {
      var d = frame - starts[i];
      if (d >= 0 && d < BLINK) return Math.max(0, 1 - Math.abs(d - 3) / 3.5);
    }
    return 0;
  }

  function wave(frame, periodS, phase) {
    return Math.sin((2 * Math.PI * frame) / (periodS * FPS) + (phase || 0));
  }

  /* Breathing: relative torso scale offset, +-1.5 % over a 4 s cycle. */
  function breath(frame) { return 0.015 * wave(frame, 4); }
  /* Gentle vertical bob of the whole figure, +-4 body units. */
  function bob(frame) { return 4 * wave(frame, 4, Math.PI / 2); }
  /* Curl sway in degrees, +-2 deg, each curl group with its own phase. */
  function sway(frame, phase) { return 2 * wave(frame, 2.6, phase || 0); }
  /* Slow head tilt in degrees (+-1.2 deg), so he never looks frozen. */
  function headTilt(frame) { return 1.2 * wave(frame, 5.3, 1.1); }

  P.FPS = FPS;
  P.seededRandom = seededRandom;
  P.blinkStarts = blinkStarts;
  P.blinkAmount = blinkAmount;
  P.breath = breath;
  P.bob = bob;
  P.sway = sway;
  P.headTilt = headTilt;
  if (root.HFKit) root.HFKit.presenter = P;
})(typeof globalThis !== "undefined" ? globalThis : window);
