/* hf-kit illustration helpers: maths (eases, seeded random, smooth wobble, cubic paths), colour
 * (mix, shade, tint, alpha), SVG building (element maker, gradients, soft shadow / glow filters,
 * stroke draw-on) and deterministic particles (bubbles, sparks, smoke). Every helper is a pure
 * function of its inputs (no Math.random, no clock), so drawings driven by them can seek.
 * Classic script: load after kit.js; sets HFKit.draw. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K) throw new Error("draw.js: load kit/src/kit.js first");
  var NS = "http://www.w3.org/2000/svg";

  // ---- maths ----------------------------------------------------------------------------
  function clamp(x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, x)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  /* 0..1 progress of t through [a, b] (clamped). */
  function prog(t, a, b) { return b > a ? clamp((t - a) / (b - a)) : (t >= b ? 1 : 0); }

  var ease = {
    linear: function (k) { return k; },
    inQuad: function (k) { return k * k; },
    outQuad: function (k) { return 1 - (1 - k) * (1 - k); },
    outCubic: function (k) { return 1 - Math.pow(1 - k, 3); },
    inOut: function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; },
    outExpo: function (k) { return k >= 1 ? 1 : 1 - Math.pow(2, -10 * k) * (1 - k); },
    /* Soft overshoot (about 6 %) then settle: lively but calm. */
    outBack: function (k) { var c = 1.2, d = k - 1; return 1 + (c + 1) * d * d * d + c * d * d; },
    inOutSine: function (k) { return -(Math.cos(Math.PI * k) - 1) / 2; },
  };

  /* mulberry32: repeatable random numbers in [0, 1) from an integer seed. */
  function rng(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Smooth, seeded wobble in [-1, 1] (sum of three sines): idle float, flicker, drift. */
  function wobble(t, seed, speed) {
    var r = rng((seed | 0) + 101), sp = speed || 1;
    var a = r() * 6.283, b = r() * 6.283, c = r() * 6.283;
    return (Math.sin(t * 1.13 * sp + a) * 0.5 + Math.sin(t * 0.71 * sp + b) * 0.3 + Math.sin(t * 2.09 * sp + c) * 0.2);
  }

  function r2(x) { return Math.round(x * 100) / 100; }

  /* Cubic Bezier p0..p3 ([x, y] each): {at(u), atLength(len), length, d}. Arc length from 64 samples. */
  function cubic(p0, p1, p2, p3) {
    function at(u) {
      var v = 1 - u;
      var a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, e = u * u * u;
      return { x: r2(a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0]), y: r2(a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]) };
    }
    var N = 64, lens = [0], prev = at(0);
    for (var i = 1; i <= N; i++) {
      var q = at(i / N);
      lens.push(lens[i - 1] + Math.hypot(q.x - prev.x, q.y - prev.y));
      prev = q;
    }
    var length = lens[N];
    function atLength(len) {
      len = clamp(len, 0, length);
      var j = 1;
      while (j < N && lens[j] < len) j++;
      var seg = lens[j] - lens[j - 1], f = seg > 0 ? (len - lens[j - 1]) / seg : 0;
      return at((j - 1 + f) / N);
    }
    return {
      at: at, atLength: atLength, length: length,
      d: "M" + p0[0] + " " + p0[1] + " C" + p1.join(" ") + " " + p2.join(" ") + " " + p3.join(" "),
    };
  }

  /* A chain of cubic segments that share ends: segs = [[p0,p1,p2,p3], [p3,q1,q2,q3], ...]. */
  function path(segs) {
    var cs = segs.map(function (s) { return cubic(s[0], s[1], s[2], s[3]); });
    var total = cs.reduce(function (a, c) { return a + c.length; }, 0);
    return {
      length: total,
      d: cs.map(function (c, i) { return i ? c.d.replace(/^M[^C]*/, "") : c.d; }).join(" "),
      atLength: function (len) {
        len = clamp(len, 0, total);
        for (var i = 0; i < cs.length; i++) {
          if (len <= cs[i].length || i === cs.length - 1) return cs[i].atLength(len);
          len -= cs[i].length;
        }
      },
      at: function (u) { return this.atLength(clamp(u) * total); },
    };
  }

  // ---- colour ---------------------------------------------------------------------------
  function rgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function hex(c) {
    return "#" + c.map(function (v) { var s = Math.round(clamp(v, 0, 255)).toString(16); return s.length < 2 ? "0" + s : s; }).join("");
  }
  function mix(a, b, k) {
    var x = rgb(a), y = rgb(b);
    var out = hex([lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]);
    return /[A-F]/.test(a + b) ? out.toUpperCase() : out;
  }
  /* Darken (k > 0) toward black: shade("#FF8000", 0.2). */
  function shade(c, k) { return hex(rgb(c).map(function (v) { return v * (1 - k); })); }
  /* Lighten toward white. */
  function tint(c, k) { return hex(rgb(c).map(function (v) { return v + (255 - v) * k; })); }
  function alpha(c, a) { var x = rgb(c); return "rgba(" + x[0] + "," + x[1] + "," + x[2] + "," + a + ")"; }

  // ---- SVG building ---------------------------------------------------------------------
  var uidCount = 0;
  /* Unique, deterministic id prefix for one mount (gradient/filter ids never clash between scenes). */
  function uid(prefix) { uidCount += 1; return (prefix || "hf") + uidCount; }

  /* Create an SVG element (or HTML when tag starts with "html:") with attributes under parent. */
  function el(parent, tag, attrs, text) {
    var doc = parent.ownerDocument || parent;
    var e = tag.indexOf("html:") === 0 ? doc.createElement(tag.slice(5)) : doc.createElementNS(NS, tag);
    for (var k in attrs || {}) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    if (parent.appendChild) parent.appendChild(e);
    return e;
  }

  /* <svg> filling a box, with <defs>; returns {svg, defs}. */
  function svgRoot(parent, width, height, attrs) {
    var svg = el(parent, "svg", Object.assign({ width: width, height: height, viewBox: "0 0 " + width + " " + height, overflow: "visible" }, attrs || {}));
    return { svg: svg, defs: el(svg, "defs") };
  }

  /* stops = [[offset, colour, opacity?], ...]; dir = [x1, y1, x2, y2] (default top to bottom). */
  function linearGradient(defs, id, stops, dir) {
    var d = dir || [0, 0, 0, 1];
    var g = el(defs, "linearGradient", { id: id, x1: d[0], y1: d[1], x2: d[2], y2: d[3] });
    stops.forEach(function (s) { el(g, "stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] === undefined ? 1 : s[2] }); });
    return "url(#" + id + ")";
  }
  function radialGradient(defs, id, stops, c) {
    c = c || {};
    var g = el(defs, "radialGradient", { id: id, cx: c.cx === undefined ? 0.5 : c.cx, cy: c.cy === undefined ? 0.5 : c.cy, r: c.r === undefined ? 0.5 : c.r,
      fx: c.fx, fy: c.fy });
    stops.forEach(function (s) { el(g, "stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] === undefined ? 1 : s[2] }); });
    return "url(#" + id + ")";
  }
  /* Gaussian blur filter (soft glows, smoke). */
  function blurFilter(defs, id, std) {
    var f = el(defs, "filter", { id: id, x: "-50%", y: "-50%", width: "200%", height: "200%" });
    el(f, "feGaussianBlur", { stdDeviation: std });
    return "url(#" + id + ")";
  }
  /* Soft drop shadow under a shape (cards, props). */
  function shadowFilter(defs, id, dy, std, opacity) {
    var f = el(defs, "filter", { id: id, x: "-30%", y: "-30%", width: "160%", height: "180%" });
    el(f, "feDropShadow", { dx: 0, dy: dy === undefined ? 10 : dy, stdDeviation: std === undefined ? 14 : std, "flood-color": "#020617", "flood-opacity": opacity === undefined ? 0.45 : opacity });
    return "url(#" + id + ")";
  }

  /* Stroke draw-on: show the first u (0..1) of a path of known length. */
  function drawOn(e, length, u) {
    e.setAttribute("stroke-dasharray", r2(length) + " " + r2(length + 1));
    e.setAttribute("stroke-dashoffset", r2(length * (1 - clamp(u))));
    e.setAttribute("visibility", u > 0.001 ? "visible" : "hidden");
  }

  /* Build-in state for an element revealed at `start`: opacity, lift, scale and blur over `dur`
   * seconds (soft overshoot). Returns {k, opacity, y, scale, blur}. */
  function buildIn(t, start, dur, lift) {
    var k = prog(t, start, start + (dur || 0.5));
    var e = ease.outBack(k);
    return { k: k, opacity: ease.outCubic(prog(t, start, start + (dur || 0.5) * 0.6)), y: (1 - e) * (lift === undefined ? 28 : lift),
      scale: 0.94 + 0.06 * e, blur: 8 * (1 - ease.outCubic(k)) };
  }

  /* Write an element's build-in state as CSS (HTML or SVG). extra = extra transform text. */
  function applyIn(e, s, extra) {
    e.style.opacity = r2(s.opacity);
    e.style.transform = "translateY(" + r2(s.y) + "px) scale(" + Math.round(s.scale * 1000) / 1000 + ")" + (extra ? " " + extra : "");
    e.style.filter = s.blur > 0.05 ? "blur(" + r2(s.blur) + "px)" : "none";
  }

  // ---- particles ------------------------------------------------------------------------
  /* Deterministic particle system: `count` particles, each born at a seeded time in `spawn`
   * ([t0, t1]) living `life` seconds, with seeded velocity. at(t) -> [{alive, age, u (0..1),
   * x, y, r, seed}] relative to the emitter origin. Optional loop: particles respawn every life.
   * opts: {count, seed, life, spawn:[t0,t1], loop, vx:[a,b], vy:[a,b], gravity, r:[a,b], drag}. */
  function particles(opts) {
    var o = Object.assign({ count: 20, seed: 1, life: 2, spawn: [0, 1], loop: false, vx: [-40, 40], vy: [-120, -60], gravity: 0, r: [4, 10], drag: 0 }, opts);
    var R = rng(o.seed), list = [];
    for (var i = 0; i < o.count; i++) {
      list.push({ born: lerp(o.spawn[0], o.spawn[1], o.loop ? i / o.count : R()), vx: lerp(o.vx[0], o.vx[1], R()), vy: lerp(o.vy[0], o.vy[1], R()),
        r: lerp(o.r[0], o.r[1], R()), seed: R(), phase: R() });
    }
    return {
      list: list,
      at: function (t) {
        return list.map(function (p) {
          var age = t - p.born;
          if (o.loop && age >= 0) age = age % o.life;
          if (o.loop && t < p.born) age = ((t - p.born) % o.life + o.life) % o.life;
          var alive = age >= 0 && age <= o.life;
          var a = Math.max(0, age), damp = o.drag ? (1 - Math.exp(-o.drag * a)) / o.drag : a;
          return { alive: alive, age: a, u: clamp(a / o.life), x: p.vx * damp, y: p.vy * damp + 0.5 * o.gravity * a * a, r: p.r, seed: p.seed, phase: p.phase };
        });
      },
    };
  }

  /* Ready-made presets (emitter-relative positions). */
  var presets = {
    /* rising bubbles in a liquid, looping */
    bubbles: function (seed, n) { return particles({ count: n || 14, seed: seed, life: 2.4, spawn: [0, 2.4], loop: true, vx: [-8, 8], vy: [-90, -50], r: [4, 11] }); },
    /* hot sparks thrown up and falling back */
    sparks: function (seed, n, t0, t1) { return particles({ count: n || 40, seed: seed, life: 1.4, spawn: [t0 || 0, t1 || 1], vx: [-380, 380], vy: [-900, -500], gravity: 1500, r: [4, 10] }); },
    /* slow smoke or steam puffs, looping */
    smoke: function (seed, n) { return particles({ count: n || 8, seed: seed, life: 3.6, spawn: [0, 3.6], loop: true, vx: [-14, 22], vy: [-70, -45], r: [24, 46] }); },
  };

  K.draw = {
    clamp: clamp, lerp: lerp, prog: prog, ease: ease, rng: rng, wobble: wobble, r2: r2,
    cubic: cubic, path: path,
    rgb: rgb, mix: mix, shade: shade, tint: tint, alpha: alpha,
    uid: uid, el: el, svgRoot: svgRoot, linearGradient: linearGradient, radialGradient: radialGradient,
    blurFilter: blurFilter, shadowFilter: shadowFilter, drawOn: drawOn, buildIn: buildIn, applyIn: applyIn,
    particles: particles, presets: presets, NS: NS,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
