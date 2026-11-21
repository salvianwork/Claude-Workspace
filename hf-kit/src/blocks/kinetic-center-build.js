/* Registry block port: "kinetic-center-build" (HyperFrames registry 0.9.72, MIT, (c) 2026
 * Remocn; upstream copy and licence in upstream/ and LICENSES.md). Words enter from the right
 * while the phrase so far shifts left, so every intermediate phrase stays centred.
 *
 * Changes from upstream: no GSAP timeline, CDN script or Google font; each word starts at a
 * given time (its spoken word, from words.json) instead of a fixed stagger; the state of every
 * word is a pure function of t. Classic script: load after kit.js; sets HFKit.blocks. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K) throw new Error("kinetic-center-build.js: load kit/src/kit.js first");
  K.blocks = K.blocks || {};

  var FIRST = 10 / 30, PUSH = 13 / 30; // upstream durations (s)
  var GAP_RATIO = 10 / 72;             // upstream word gap per px of font size

  /* Upstream CustomEase "M0,0 C0.2,0.8 0.2,1 1,1": cubic-bezier(0.2, 0.8, 0.2, 1). */
  function bezierEase(x1, y1, x2, y2) {
    function bx(u) { var v = 1 - u; return 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u; }
    function by(u) { var v = 1 - u; return 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u; }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var lo = 0, hi = 1;
      for (var i = 0; i < 40; i++) { var m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
      return by((lo + hi) / 2);
    };
  }
  var entryEase = bezierEase(0.2, 0.8, 0.2, 1);

  /* positions(widths, gap)[count - 1][i]: centre x of word i (relative to the phrase centre)
   * when the first `count` words are shown. */
  function positions(widths, gap) {
    var out = [];
    for (var count = 1; count <= widths.length; count++) {
      var total = gap * (count - 1);
      for (var w = 0; w < count; w++) total += widths[w];
      var cursor = -total / 2, row = [];
      for (var i = 0; i < count; i++) { row.push(cursor + widths[i] / 2); cursor += widths[i] + gap; }
      out.push(row);
    }
    return out;
  }

  function moveDur(j) { return j === 0 ? FIRST : PUSH; }

  /* x of word i at t, given every word's start time (pure; follows each push in turn, each push
   * starting from where the previous one had got to). */
  function xAt(i, t, starts, pos, offset) {
    var n = starts.length;
    var target = pos[i][i], from = i === 0 ? target : target + offset;
    var tEnd = i + 1 < n && starts[i + 1] <= t ? starts[i + 1] : t;
    var x = from + (target - from) * entryEase((tEnd - starts[i]) / moveDur(i));
    for (var j = i + 1; j < n && starts[j] <= t; j++) {
      tEnd = j + 1 < n && starts[j + 1] <= t ? starts[j + 1] : t;
      x = x + (pos[j][i] - x) * entryEase((tEnd - starts[j]) / PUSH);
    }
    return x;
  }

  /* {x, y, opacity, scale, blur} of word i at t. starts must be non-decreasing. */
  function wordState(i, t, starts, pos, offset) {
    offset = offset === undefined ? 88 : offset;
    if (t < starts[i]) return { x: pos[i][i] + (i === 0 ? 0 : offset), y: i === 0 ? 6 : 0, opacity: 0, scale: 0.992, blur: 3.5 };
    var k = entryEase((t - starts[i]) / moveDur(i));
    var blur = 3.5 * (1 - k);
    // a small blur pulse while the word is being pushed by a newer word
    for (var j = i + 1; j < starts.length; j++) {
      var u = (t - starts[j]) / PUSH;
      if (u > 0 && u < 1) blur = Math.max(blur, 0.8 * (1 - Math.abs(2 * u - 1)));
    }
    return { x: xAt(i, t, starts, pos, offset), y: i === 0 ? 6 * (1 - k) : 0, opacity: Math.min(1, (t - starts[i]) / (moveDur(i) * 0.6)), scale: 0.992 + 0.008 * k, blur: blur };
  }

  K.blocks.kineticCenterBuild = { positions: positions, wordState: wordState, entryEase: entryEase, GAP_RATIO: GAP_RATIO, FIRST: FIRST, PUSH: PUSH };
})(typeof globalThis !== "undefined" ? globalThis : window);
