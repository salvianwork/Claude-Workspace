/* hf-kit world effects: sound and energy (rings, pulse_along, glow), impacts (burst, splash),
 * motion (speed_lines) and atmosphere (sparkle, smoke), drawn in world px on a place layer.
 *
 *   var fx = HFKit.effects[name](layerEl, params, idPrefix);   // layerEl: an <svg> layer (world px)
 *   fx.update(t);     // draw the effect at scene time t (a pure function of t: seekable)
 *   fx.box(t);        // {x, y, width, height} world px of what is visible at t (empty before `at`
 *                     //  and after the effect is over); pure, it never reads the DOM
 *   pulse_along also has fx.anchor(t) -> {x, y} (the pulse head) and fx.anchors = {pulse: anchor}.
 *
 * Common params: at (s, required), x / y (world px, required except pulse_along: path), seed,
 * color, size (a scale, 1 = the default size). Per effect (defaults in brackets):
 *   burst        impact burst: flash, shock ring, spikes, debris.  duration [0.9], radius [220]
 *   rings        sound / energy waves spreading from a source.     count [3], interval [0.4 s],
 *                speed [520 px/s], radius [900] (where a ring has faded), width [14],
 *                squash [1] (ry/rx: 0.35 lays the rings on the ground), arc {angle, spread} (deg:
 *                a directional wavefront instead of full rings; angle 0 = right, 90 = down)
 *   pulse_along  a glowing pulse travelling a path ([{x, y}, ...], smoothed through its points):
 *                duration [path length / speed] or speed [800 px/s], trail [360 px],
 *                ease ["linear": a wave travels at constant speed | "inOut"]
 *   speed_lines  streaks trailing a moving thing at x / y.         angle [0: moving right], edge (outline colour),
 *                duration [1.2], length [420], spread [260], count [11]
 *   splash       a splash at a water surface point x / y.          duration [1.4]
 *   sparkle      twinkling stars around x / y.                     radius [200], count [10], duration [1.6]
 *   smoke        soft puffs rising from x / y.                     duration [3] (emitting), life [2.4],
 *                wind [40 px/s], rise [120 px/s]
 *   glow         a soft breathing light at x / y.                  radius [260], duration [3], rays [0]
 *
 * Every SVG id starts with idPrefix + "-" (world.js passes "s<scene>-fx-<n>"). Easing is soft and
 * physical (outExpo / outCubic bursts, ballistic droplets, rings that thin and fade as they spread)
 * so effects read as energy travelling, never as a pop. Classic script: load after draw.js and
 * world/place.js; sets HFKit.effects. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw) throw new Error("world/effects.js: load kit.js and draw.js first");
  var D = K.draw, r2 = D.r2, E = D.ease, clamp = D.clamp;

  // ---- shared -------------------------------------------------------------------------------
  function num(v) { return typeof v === "number" && isFinite(v); }
  function empty(x, y) { return { x: r2(x), y: r2(y), width: 0, height: 0 }; }
  function frac(v) { return v - Math.floor(v); }

  /* Bounding box of [[x, y, r], ...] (points with a radius), or empty at (x0, y0). */
  function bounds(list, x0, y0) {
    if (!list.length) return empty(x0, y0);
    var a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    list.forEach(function (q) { var r = q[2] || 0; a = Math.min(a, q[0] - r); b = Math.min(b, q[1] - r); c = Math.max(c, q[0] + r); d = Math.max(d, q[1] + r); });
    return { x: r2(a), y: r2(b), width: r2(c - a), height: r2(d - b) };
  }

  /* Validate params, make the root group (hidden until it plays) with its own <defs>. */
  function start(name, layer, p, idPrefix, needXY) {
    if (!idPrefix || typeof idPrefix !== "string") throw new Error("effect " + name + ": needs an idPrefix");
    p = p || {};
    if (!num(p.at)) throw new Error("effect " + name + ": needs a numeric at");
    if (needXY && !(num(p.x) && num(p.y))) throw new Error("effect " + name + ": needs a numeric x and y");
    if (!layer || !(layer.ownerDocument || layer.createElementNS)) throw new Error("effect " + name + ": needs a layer element");
    var g = D.el(layer, "g", { "data-effect": name, opacity: 0 });
    var defs = D.el(g, "defs");
    return { g: g, defs: defs, id: function (k) { return idPrefix + "-" + k; } };
  }
  function show(e, on) { e.setAttribute("visibility", on ? "visible" : "hidden"); }
  /* Hide an element and reset what it shows, so the DOM at t never depends on earlier frames. */
  function off(e, reset) { show(e, false); if (reset) set(e, reset); }
  function set(e, a) { for (var k in a) e.setAttribute(k, typeof a[k] === "number" ? r2(a[k]) : a[k]); }
  function grad(defs, id, stops) {
    var gr = D.el(defs, "radialGradient", { id: id, cx: 0.5, cy: 0.5, r: 0.5 });
    stops.forEach(function (s) { D.el(gr, "stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] === undefined ? 1 : s[2] }); });
    return "url(#" + id + ")";
  }
  function arr(n, f) { var out = []; for (var i = 0; i < n; i++) out.push(f(i)); return out; }

  // ---- burst ------------------------------------------------------------------------------
  function burst(layer, p, idPrefix) {
    var s = start("burst", layer, p, idPrefix, true);
    var col = p.color || "#FFB43C", size = p.size || 1, R = (p.radius || 220) * size, dur = p.duration || 0.9;
    var Rn = D.rng(p.seed || 7), x = p.x, y = p.y, N = 12, M = 10;
    var flashFill = grad(s.defs, s.id("flash"), [[0, "#FFFFFF", 1], [0.35, D.tint(col, 0.55), 0.9], [1, col, 0]]);
    var flash = D.el(s.g, "circle", { cx: r2(x), cy: r2(y), r: 1, fill: flashFill });
    var ring = D.el(s.g, "circle", { cx: r2(x), cy: r2(y), r: 1, fill: "none", stroke: D.tint(col, 0.35) });
    var ring2 = D.el(s.g, "circle", { cx: r2(x), cy: r2(y), r: 1, fill: "none", stroke: col });
    var spikes = arr(N, function (i) {
      return { a: (i + (Rn() - 0.5) * 0.5) / N * Math.PI * 2, len: 0.45 + Rn() * 0.45, w: 0.06 + Rn() * 0.05,
        e: D.el(s.g, "path", { fill: i % 3 ? col : D.tint(col, 0.5), "stroke-linejoin": "round" }) };
    });
    var debris = arr(M, function (i) {
      return { a: Rn() * Math.PI * 2, v: 0.6 + Rn() * 0.7, r: 6 + Rn() * 8,
        e: D.el(s.g, "circle", { r: 4, fill: i % 2 ? D.shade(col, 0.25) : D.tint(col, 0.3) }) };
    });
    function geo(t) {
      var u = (t - p.at) / dur;
      if (u < 0 || u > 1) return null;
      var e = E.outExpo(u), c = E.outCubic(u);
      return {
        u: u, flashR: R * 0.42 * E.outExpo(clamp(u / 0.18)), flashOp: 0.95 * (1 - E.outCubic(clamp(u / 0.4))),
        ringR: R * (0.2 + 0.95 * c), ringW: 16 * size * (1 - u) + 2, ringOp: Math.pow(1 - u, 1.4),
        spikes: spikes.map(function (k) {
          var r0 = R * (0.18 + 0.62 * e), r1 = r0 + R * k.len * (1 - E.outCubic(clamp((u - 0.1) / 0.75)));
          return { r0: r0, r1: Math.max(r0, r1), half: k.w, op: 1 - clamp((u - 0.35) / 0.55) };
        }),
        debris: debris.map(function (k) {
          var d = R * (0.2 + k.v * c), fall = 260 * size * u * u;
          return { x: x + Math.cos(k.a) * d, y: y + Math.sin(k.a) * d + fall, r: k.r * size * (1 - 0.6 * u), op: 1 - E.inQuad(u) };
        }),
      };
    }
    function update(t) {
      var q = geo(t);
      s.g.setAttribute("opacity", q ? 1 : 0);
      if (!q) return;
      set(flash, { r: Math.max(0.1, q.flashR), opacity: q.flashOp });
      set(ring, { r: q.ringR, "stroke-width": q.ringW, opacity: q.ringOp });
      set(ring2, { r: q.ringR * 0.82, "stroke-width": q.ringW * 0.45, opacity: q.ringOp * 0.55 });
      spikes.forEach(function (k, i) {
        var g = q.spikes[i], a = k.a, ca = Math.cos(a), sa = Math.sin(a), w = g.half;
        var p0 = [x + Math.cos(a - w) * g.r0, y + Math.sin(a - w) * g.r0], p1 = [x + ca * g.r1, y + sa * g.r1], p2 = [x + Math.cos(a + w) * g.r0, y + Math.sin(a + w) * g.r0];
        set(k.e, { d: "M" + r2(p0[0]) + " " + r2(p0[1]) + " L" + r2(p1[0]) + " " + r2(p1[1]) + " L" + r2(p2[0]) + " " + r2(p2[1]) + " Z", opacity: Math.max(0, g.op) });
      });
      debris.forEach(function (k, i) { var g = q.debris[i]; set(k.e, { cx: g.x, cy: g.y, r: Math.max(0.1, g.r), opacity: Math.max(0, g.op) }); });
    }
    function box(t) {
      var q = geo(t);
      if (!q) return empty(x, y);
      var list = [[x, y, Math.max(q.flashR, q.ringR + q.ringW / 2)]];
      q.spikes.forEach(function (g) { if (g.op > 0) list.push([x, y, g.r1]); });
      q.debris.forEach(function (g) { if (g.op > 0) list.push([g.x, g.y, g.r]); });
      return bounds(list, x, y);
    }
    update(p.at - 1);
    return { update: update, box: box };
  }

  // ---- rings ------------------------------------------------------------------------------
  function rings(layer, p, idPrefix) {
    var s = start("rings", layer, p, idPrefix, true);
    var col = p.color || "#7FE3FF", size = p.size || 1, count = p.count || 3, gap = p.interval === undefined ? 0.4 : p.interval;
    var speed = (p.speed || 520) * size, maxR = (p.radius || 900) * size, W = (p.width || 14) * size, sq = p.squash || 1;
    var arc = p.arc || null, x = p.x, y = p.y;
    var life = maxR / speed, dur = (count - 1) * gap + life;
    var srcFill = grad(s.defs, s.id("src"), [[0, "#FFFFFF", 1], [0.4, col, 0.8], [1, col, 0]]);
    var src = D.el(s.g, "ellipse", { cx: r2(x), cy: r2(y), rx: 1, ry: 1, fill: srcFill });
    var list = arr(count, function () {
      var g = D.el(s.g, "g", {});
      return { g: g,
        glow: D.el(g, "path", { fill: "none", stroke: col, "stroke-linecap": "round" }),
        main: D.el(g, "path", { fill: "none", stroke: col, "stroke-linecap": "round" }),
        hi: D.el(g, "path", { fill: "none", stroke: "#FFFFFF", "stroke-linecap": "round" }),
        echo: D.el(g, "path", { fill: "none", stroke: col, "stroke-linecap": "round" }) };
    });
    /* outline of a ring (or arc) of radius r as a path, and its sample points */
    function shape(r) {
      var a0 = 0, a1 = Math.PI * 2, full = !arc;
      if (arc) { var c = (arc.angle || 0) * Math.PI / 180, h = (arc.spread === undefined ? 90 : arc.spread) * Math.PI / 360; a0 = c - h; a1 = c + h; }
      var n = full ? 48 : Math.max(8, Math.round((a1 - a0) / (Math.PI * 2) * 48)), pts = [];
      for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * sq]); }
      var d = "M" + pts.map(function (q) { return r2(q[0]) + " " + r2(q[1]); }).join(" L") + (full ? " Z" : "");
      return { d: d, pts: pts };
    }
    function geo(t) {
      var out = [];
      for (var k = 0; k < count; k++) {
        var age = t - (p.at + k * gap);
        if (age < 0 || age > life) continue;
        var r = speed * age, u = r / maxR;
        var fadeIn = E.outCubic(clamp(age / 0.12));
        out.push({ k: k, r: Math.max(2, r), u: u, op: fadeIn * Math.pow(1 - u, 1.5), w: W * (1 - 0.65 * u) });
      }
      return out;
    }
    function update(t) {
      var on = t >= p.at && t <= p.at + dur;
      s.g.setAttribute("opacity", on ? 1 : 0);
      if (!on) return;
      var live = geo(t), byK = {};
      live.forEach(function (q) { byK[q.k] = q; });
      list.forEach(function (L, k) {
        var q = byK[k];
        show(L.g, !!q);
        if (!q) { [L.glow, L.main, L.hi, L.echo].forEach(function (e) { set(e, { d: "M0 0", opacity: 0, "stroke-width": 1 }); }); return; }
        var outer = shape(q.r).d, inner = shape(Math.max(1, q.r - q.w * 0.6)).d, trail = shape(Math.max(1, q.r - q.w * 3.2)).d;
        set(L.glow, { d: outer, "stroke-width": q.w * 3.4, opacity: q.op * 0.22 });
        set(L.main, { d: outer, "stroke-width": q.w, opacity: q.op });
        set(L.hi, { d: inner, "stroke-width": Math.max(1.5, q.w * 0.28), opacity: q.op * 0.85 });
        set(L.echo, { d: trail, "stroke-width": q.w * 0.5, opacity: q.op * 0.35 });
      });
      // the source throbs while it emits, then fades
      var emitEnd = p.at + (count - 1) * gap + 0.3, srcOp = t <= emitEnd ? 0.9 : Math.max(0, 0.9 * (1 - (t - emitEnd) / 0.4));
      var throb = 1 + 0.25 * Math.max(0, Math.cos((t - p.at) / Math.max(0.05, gap) * Math.PI * 2));
      set(src, { rx: 38 * size * throb, ry: 38 * size * throb * Math.max(sq, 0.5), opacity: srcOp * E.outCubic(clamp((t - p.at) / 0.1)) });
    }
    function box(t) {
      if (t < p.at || t > p.at + dur) return empty(x, y);
      var pts = [[x, y, 38 * size * 1.25]];
      geo(t).forEach(function (q) { shape(q.r).pts.forEach(function (c) { pts.push([c[0], c[1], q.w * 1.7]); }); });
      return bounds(pts, x, y);
    }
    update(p.at - 1);
    return { update: update, box: box };
  }

  // ---- pulse_along --------------------------------------------------------------------------
  /* Catmull-Rom through the points, sampled: [{x, y, s (arc length)}]. Passes every point. */
  function sampled(path) {
    var P = path.map(function (q) { return [q.x, q.y]; }), n = P.length, out = [];
    var get = function (i) { return P[Math.max(0, Math.min(n - 1, i))]; };
    for (var i = 0; i < n - 1; i++) {
      var p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (var j = 0; j < 16; j++) {
        var u = j / 16, u2 = u * u, u3 = u2 * u;
        var f = function (a, b, c, d) { return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3); };
        out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
      }
    }
    out.push({ x: P[n - 1][0], y: P[n - 1][1] });
    out[0] = { x: P[0][0], y: P[0][1] };
    var acc = 0;
    out.forEach(function (q, k) { if (k) acc += Math.hypot(q.x - out[k - 1].x, q.y - out[k - 1].y); q.s = acc; });
    return out;
  }
  function pointAt(S, len) {
    var L = S[S.length - 1].s;
    len = clamp(len, 0, L);
    var lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (S[m].s < len) lo = m; else hi = m; }
    var a = S[lo], b = S[hi], seg = b.s - a.s, f = seg > 0 ? (len - a.s) / seg : 0;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  function pulse_along(layer, p, idPrefix) {
    if (p && p.path !== undefined && !(Array.isArray(p.path) && p.path.length >= 2)) throw new Error("effect pulse_along: needs a path of at least 2 points");
    var s = start("pulse_along", layer, p, idPrefix, false);
    if (!Array.isArray(p.path) || p.path.length < 2) throw new Error("effect pulse_along: needs a path of at least 2 points");
    p.path.forEach(function (q) { if (!(q && num(q.x) && num(q.y))) throw new Error("effect pulse_along: path points need numeric x and y"); });
    var col = p.color || "#7FE3FF", size = p.size || 1, S = sampled(p.path), L = S[S.length - 1].s;
    var dur = p.duration || L / (p.speed || 800), trailLen = (p.trail || 360) * size, ease = p.ease === "inOut" ? E.inOut : E.linear;
    var first = { x: p.path[0].x, y: p.path[0].y }, last = { x: p.path[p.path.length - 1].x, y: p.path[p.path.length - 1].y };
    var headFill = grad(s.defs, s.id("head"), [[0, "#FFFFFF", 1], [0.25, D.tint(col, 0.5), 0.95], [0.6, col, 0.35], [1, col, 0]]);
    var lit = D.el(s.g, "path", { fill: "none", stroke: col, "stroke-linecap": "round", "stroke-linejoin": "round" });
    var TS = 7, trail = arr(TS, function (i) { return D.el(s.g, "path", { fill: "none", stroke: i > TS - 3 ? D.tint(col, 0.5) : col, "stroke-linecap": "round", "stroke-linejoin": "round" }); });
    var RIP = 3, rip = arr(RIP, function () { return D.el(s.g, "circle", { fill: "none", stroke: col, r: 1 }); });
    var halo = D.el(s.g, "circle", { r: 1, fill: headFill });
    var core = D.el(s.g, "circle", { r: 1, fill: "#FFFFFF" });
    var FADE = 0.35;
    function headLen(t) { return L * ease(clamp((t - p.at) / dur)); }
    function anchor(t) {
      if (t <= p.at) return { x: first.x, y: first.y };
      if (t >= p.at + dur) return { x: last.x, y: last.y };
      var q = pointAt(S, headLen(t));
      return { x: q.x, y: q.y };
    }
    function polyline(a, b) {
      var pts = [pointAt(S, a)];
      S.forEach(function (q) { if (q.s > a && q.s < b) pts.push(q); });
      pts.push(pointAt(S, b));
      return pts;
    }
    function dstr(pts) { return "M" + pts.map(function (q) { return r2(q.x) + " " + r2(q.y); }).join(" L"); }
    function state(t) {
      if (t < p.at || t > p.at + dur + FADE) return null;
      var h = headLen(t), end = t > p.at + dur ? 1 - (t - p.at - dur) / FADE : 1;
      return { h: h, op: E.outCubic(clamp((t - p.at) / 0.12)) * clamp(end), head: anchor(t), tail: Math.max(0, h - trailLen * clamp(end + 0.2)), lit: Math.max(0, h - trailLen * 3) };
    }
    function update(t) {
      var q = state(t);
      s.g.setAttribute("opacity", q ? 1 : 0);
      if (!q) return;
      var hr = 44 * size;
      set(lit, { d: dstr(polyline(q.lit, q.h)), "stroke-width": 10 * size, opacity: 0.16 * q.op });
      trail.forEach(function (e, i) { // a tapering, brightening tail
        var a = q.tail + (q.h - q.tail) * i / TS, b = q.tail + (q.h - q.tail) * (i + 1) / TS;
        set(e, { d: dstr(polyline(a, Math.max(a + 0.01, b))), "stroke-width": (5 + 26 * (i + 1) / TS) * size, opacity: q.op * (0.12 + 0.75 * Math.pow((i + 1) / TS, 1.6)) });
      });
      rip.forEach(function (e, i) { // energy rings shed by the head
        var ph = frac((t - p.at) / 0.42 + i / RIP), c = pointAt(S, Math.max(0, q.h - ph * 90 * size));
        set(e, { cx: c.x, cy: c.y, r: hr * (0.4 + 1.5 * E.outCubic(ph)), "stroke-width": 5 * size * (1 - ph) + 1, opacity: q.op * 0.6 * (1 - ph) });
      });
      var pulse = 1 + 0.12 * Math.sin((t - p.at) * 14);
      set(halo, { cx: q.head.x, cy: q.head.y, r: hr * 1.9 * pulse, opacity: q.op });
      set(core, { cx: q.head.x, cy: q.head.y, r: hr * 0.36, opacity: q.op });
    }
    function box(t) {
      var q = state(t);
      if (!q) return empty(first.x, first.y);
      var pts = polyline(q.lit, q.h).map(function (c) { return [c.x, c.y, 18 * size]; });
      pts.push([q.head.x, q.head.y, 44 * size * 2.2]);
      return bounds(pts, first.x, first.y);
    }
    update(p.at - 1);
    return { update: update, box: box, anchor: anchor, anchors: { pulse: anchor }, duration: dur, length: L };
  }

  // ---- speed lines ------------------------------------------------------------------------
  function speed_lines(layer, p, idPrefix) {
    var s = start("speed_lines", layer, p, idPrefix, true);
    var col = p.color || "#FFFFFF", size = p.size || 1, dur = p.duration || 1.2, N = p.count || 11;
    var len = (p.length || 420) * size, spread = (p.spread || 260) * size, ang = (p.angle || 0) * Math.PI / 180;
    var Rn = D.rng(p.seed || 3), ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    var lines = arr(N, function (i) {
      return { off: ((i + 0.5) / N - 0.5) * spread + (Rn() - 0.5) * spread / N, ph: Rn(), rate: 1.6 + Rn() * 1.2, l: 0.55 + Rn() * 0.6, w: (10 + Rn() * 10) * size,
        e: D.el(s.g, "path", { fill: i % 3 === 0 ? D.tint(col, 0.2) : col, stroke: p.edge || "#2E3B55", "stroke-width": 2.5 * size, "stroke-opacity": 0.45, "stroke-linejoin": "round" }) };
    });
    var behind0 = 70 * size, reach = behind0 + len * 1.9;
    function env(t) { var a = t - p.at; return a < 0 || a > dur ? 0 : E.outCubic(clamp(a / 0.16)) * (1 - E.inQuad(clamp((a - dur + 0.3) / 0.3))); }
    function lineGeo(k, t) {
      var ph = frac((t - p.at) * k.rate + k.ph), l = len * k.l * (0.6 + 0.4 * Math.sin(Math.PI * ph));
      var front = behind0 + ph * len * 0.9, back = front + l;
      return { front: front, back: back, op: Math.sin(Math.PI * ph) };
    }
    function update(t) {
      var e = env(t);
      s.g.setAttribute("opacity", e > 0 ? 1 : 0);
      if (e <= 0) return;
      lines.forEach(function (k) {
        var g = lineGeo(k, t), cx = p.x + nx * k.off, cy = p.y + ny * k.off;
        var fx = cx - ux * g.front, fy = cy - uy * g.front, bx = cx - ux * g.back, by = cy - uy * g.back, w = k.w / 2;
        // a wedge: round and thick at the front, a fine point at the back
        set(k.e, { d: "M" + r2(fx + nx * w) + " " + r2(fy + ny * w) + " A" + r2(w) + " " + r2(w) + " 0 0 1 " + r2(fx - nx * w) + " " + r2(fy - ny * w) + " L" + r2(bx) + " " + r2(by) + " Z",
          opacity: e * Math.min(1, 0.25 + g.op) });
      });
    }
    function box(t) {
      if (env(t) <= 0) return empty(p.x, p.y);
      var pts = [];
      [-spread / 2 - 8, spread / 2 + 8].forEach(function (o) { [behind0, reach].forEach(function (d) { pts.push([p.x + nx * o - ux * d, p.y + ny * o - uy * d, 0]); }); });
      return bounds(pts, p.x, p.y);
    }
    update(p.at - 1);
    return { update: update, box: box };
  }

  // ---- splash -----------------------------------------------------------------------------
  function splash(layer, p, idPrefix) {
    var s = start("splash", layer, p, idPrefix, true);
    var col = p.color || "#7FD3F5", size = p.size || 1, dur = p.duration || 1.4, x = p.x, y = p.y;
    var Rn = D.rng(p.seed || 5), G = 2600 * size, N = 18;
    var crownFill = D.el(s.defs, "linearGradient", { id: s.id("crown"), x1: 0, y1: 0, x2: 0, y2: 1 });
    D.el(crownFill, "stop", { offset: 0, "stop-color": "#FFFFFF", "stop-opacity": 0.95 });
    D.el(crownFill, "stop", { offset: 1, "stop-color": col, "stop-opacity": 0.85 });
    var ripples = arr(3, function () { return D.el(s.g, "ellipse", { cx: r2(x), cy: r2(y), rx: 1, ry: 1, fill: "none", stroke: D.tint(col, 0.5) }); });
    var crown = D.el(s.g, "path", { fill: "url(#" + s.id("crown") + ")", stroke: D.shade(col, 0.2), "stroke-width": 3 * size, "stroke-linejoin": "round" });
    var drops = arr(N, function (i) {
      var side = i % 2 ? 1 : -1;
      return { vx: side * (120 + Rn() * 460) * size, vy: -(620 + Rn() * 640) * size, r: (9 + Rn() * 11) * size, delay: Rn() * 0.08,
        e: D.el(s.g, "ellipse", { rx: 1, ry: 1, fill: i % 4 === 0 ? "#FFFFFF" : D.tint(col, 0.25), stroke: D.shade(col, 0.15), "stroke-width": 2 * size }) };
    });
    var foam = arr(7, function (i) { return { dx: (i - 3) * 34 * size + (Rn() - 0.5) * 20, r: (12 + Rn() * 10) * size, e: D.el(s.g, "circle", { r: 1, fill: "#FFFFFF" }) }; });
    function drop(k, t) {
      var a = t - p.at - k.delay;
      if (a < 0) return null;
      var dx = k.vx * a, dy = k.vy * a + 0.5 * G * a * a;
      if (dy > 0) return null; // back in the water
      var vy = k.vy + G * a;
      return { x: x + dx, y: y + dy, r: k.r, ang: Math.atan2(vy, k.vx) * 180 / Math.PI, stretch: 1 + Math.min(1.4, Math.hypot(k.vx, vy) / (900 * size)) };
    }
    function crownGeo(u) {
      var up = E.outCubic(clamp(u / 0.32)), down = E.inQuad(clamp((u - 0.32) / 0.4));
      var h = 230 * size * up * (1 - down), w = (80 + 130 * E.outCubic(clamp(u / 0.6))) * size;
      return { h: h, w: w };
    }
    function update(t) {
      var u = (t - p.at) / dur, on = u >= 0 && u <= 1;
      s.g.setAttribute("opacity", on ? 1 : 0);
      if (!on) return;
      ripples.forEach(function (e, i) {
        var v = clamp((u - i * 0.14) / 0.75), rx = (50 + 420 * E.outCubic(v)) * size;
        set(e, { rx: rx, ry: rx * 0.17, "stroke-width": (10 * (1 - v) + 2) * size, opacity: v > 0 && v < 1 ? 0.8 * (1 - v) : 0 });
      });
      var c = crownGeo(u), n = 7, d = "M" + r2(x - c.w) + " " + r2(y);
      for (var i = 0; i <= n; i++) {
        var fx = x - c.w + (2 * c.w) * i / n, spike = (i % 2 ? 1 : 0.55) * c.h * (1 - Math.pow(Math.abs(i / n - 0.5) * 2, 3) * 0.5);
        d += " Q" + r2(fx - c.w / n * 0.6) + " " + r2(y - spike * 0.4) + " " + r2(fx) + " " + r2(y - spike);
      }
      d += " L" + r2(x + c.w) + " " + r2(y) + " Q" + r2(x) + " " + r2(y + 24 * size) + " " + r2(x - c.w) + " " + r2(y) + " Z";
      set(crown, { d: d, opacity: c.h > 2 ? 0.95 : 0 });
      drops.forEach(function (k) {
        var q = drop(k, t);
        if (!q) off(k.e, { cx: 0, cy: 0, rx: 1, ry: 1, transform: "", opacity: 0 }); else show(k.e, true);
        if (q) set(k.e, { cx: q.x, cy: q.y, rx: q.r * q.stretch, ry: q.r, transform: "rotate(" + r2(q.ang) + " " + r2(q.x) + " " + r2(q.y) + ")", opacity: 1 - E.inQuad(clamp(u)) * 0.5 });
      });
      foam.forEach(function (f) { set(f.e, { cx: x + f.dx * (1 + u), cy: y - 4 * size, r: f.r * (1 - u), opacity: 0.9 * (1 - u) }); });
    }
    function box(t) {
      var u = (t - p.at) / dur;
      if (u < 0 || u > 1) return empty(x, y);
      var pts = [], c = crownGeo(u);
      pts.push([x - c.w, y - c.h, 0], [x + c.w, y + 24 * size, 0]);
      ripples.forEach(function (e, i) { var v = clamp((u - i * 0.14) / 0.75); if (v > 0 && v < 1) { var rx = (50 + 420 * E.outCubic(v)) * size; pts.push([x - rx, y - rx * 0.17, 0], [x + rx, y + rx * 0.17, 0]); } });
      drops.forEach(function (k) { var q = drop(k, t); if (q) pts.push([q.x, q.y, q.r * q.stretch]); });
      return bounds(pts, x, y);
    }
    update(p.at - 1);
    return { update: update, box: box };
  }

  // ---- sparkle ----------------------------------------------------------------------------
  function sparkle(layer, p, idPrefix) {
    var s = start("sparkle", layer, p, idPrefix, true);
    var col = p.color || "#FFE066", size = p.size || 1, dur = p.duration || 1.6, R = (p.radius || 200) * size, N = p.count || 10;
    var Rn = D.rng(p.seed || 11), LIFE = Math.min(0.8, dur * 0.6);
    var glowFill = grad(s.defs, s.id("glint"), [[0, "#FFFFFF", 0.9], [0.4, col, 0.5], [1, col, 0]]);
    var stars = arr(N, function (i) {
      var a = Rn() * Math.PI * 2, d = R * Math.sqrt(0.08 + Rn() * 0.92);
      var g = D.el(s.g, "g", {});
      return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.85, born: (dur - LIFE) * (i / N + (Rn() - 0.5) / N), sz: (26 + Rn() * 30) * size, spin: (Rn() - 0.5) * 120,
        g: g, halo: D.el(g, "circle", { r: 1, fill: glowFill }), star: D.el(g, "path", { fill: i % 3 === 0 ? "#FFFFFF" : col, stroke: D.tint(col, 0.6), "stroke-width": 2 * size, "stroke-linejoin": "round" }) };
    });
    function st(k, t) {
      var a = t - p.at - Math.max(0, k.born);
      if (a < 0 || a > LIFE) return null;
      var u = a / LIFE, pop = u < 0.35 ? E.outBack(u / 0.35) : 1 - E.inQuad((u - 0.35) / 0.65);
      return { sc: Math.max(0, pop) * k.sz, rot: k.spin * u + 45 * E.outCubic(u), op: u < 0.35 ? 1 : 1 - E.inQuad((u - 0.35) / 0.65) };
    }
    function update(t) {
      var on = t >= p.at && t <= p.at + dur;
      s.g.setAttribute("opacity", on ? 1 : 0);
      if (!on) return;
      stars.forEach(function (k) {
        var q = st(k, t);
        if (!q) { off(k.g, { transform: "", opacity: 0 }); set(k.star, { d: "M0 0" }); set(k.halo, { r: 1, opacity: 0 }); return; }
        show(k.g, true);
        var r = q.sc, w = r * 0.2;
        set(k.star, { d: "M0 " + r2(-r) + " Q" + r2(w) + " " + r2(-w) + " " + r2(r) + " 0 Q" + r2(w) + " " + r2(w) + " 0 " + r2(r) + " Q" + r2(-w) + " " + r2(w) + " " + r2(-r) + " 0 Q" + r2(-w) + " " + r2(-w) + " 0 " + r2(-r) + " Z" });
        set(k.halo, { r: r * 1.3, opacity: 0.8 });
        set(k.g, { transform: "translate(" + r2(k.x) + " " + r2(k.y) + ") rotate(" + r2(q.rot) + ")", opacity: Math.max(0, q.op) });
      });
    }
    function box(t) {
      if (t < p.at || t > p.at + dur) return empty(p.x, p.y);
      var pts = [];
      stars.forEach(function (k) { var q = st(k, t); if (q && q.sc > 0.5) pts.push([k.x, k.y, q.sc * 1.3]); });
      return bounds(pts, p.x, p.y);
    }
    update(p.at - 1);
    return { update: update, box: box };
  }

  // ---- smoke ------------------------------------------------------------------------------
  function smoke(layer, p, idPrefix) {
    var s = start("smoke", layer, p, idPrefix, true);
    var col = p.color || "#B8B0A6", size = p.size || 1, dur = p.duration || 3, life = p.life || 2.4;
    var wind = (p.wind === undefined ? 40 : p.wind) * size, rise = (p.rise || 120) * size, Rn = D.rng(p.seed || 13);
    var N = Math.max(4, Math.round(dur / 0.22));
    var fill = grad(s.defs, s.id("puff"), [[0, D.tint(col, 0.35), 0.95], [0.55, col, 0.8], [0.85, col, 0.35], [1, col, 0]]);
    var shade = grad(s.defs, s.id("puffd"), [[0, D.shade(col, 0.3), 0.6], [0.7, D.shade(col, 0.3), 0.3], [1, D.shade(col, 0.3), 0]]);
    var puffs = arr(N, function (i) {
      var g = D.el(s.g, "g", {});
      return { born: p.at + dur * i / N + (Rn() - 0.5) * 0.1, dx: (Rn() - 0.5) * 90 * size, w: Rn() * 100 | 0, r0: (26 + Rn() * 16) * size, r1: (110 + Rn() * 70) * size,
        g: g, d: D.el(g, "circle", { r: 1, fill: shade }), l: D.el(g, "circle", { r: 1, fill: fill }) };
    });
    function puff(k, t) {
      var a = t - k.born;
      if (a < 0 || a > life || t < p.at) return null;
      var u = a / life, h = rise * life * E.outQuad(u);
      return { x: p.x + k.dx + wind * a + D.wobble(t, k.w, 0.6) * 22 * size * u, y: p.y - h, r: k.r0 + (k.r1 - k.r0) * E.outCubic(u), op: Math.min(1, Math.sin(Math.PI * Math.pow(u, 0.7)) * 1.1) };
    }
    function update(t) {
      var on = t >= p.at && t <= p.at + dur + life;
      s.g.setAttribute("opacity", on ? 1 : 0);
      if (!on) return;
      puffs.forEach(function (k) {
        var q = puff(k, t);
        if (!q) { off(k.g, { opacity: 0 }); set(k.d, { cx: 0, cy: 0, r: 1 }); set(k.l, { cx: 0, cy: 0, r: 1 }); return; }
        show(k.g, true);
        set(k.d, { cx: q.x + q.r * 0.12, cy: q.y + q.r * 0.16, r: q.r * 0.95 });
        set(k.l, { cx: q.x, cy: q.y, r: q.r });
        k.g.setAttribute("opacity", r2(q.op));
      });
    }
    function box(t) {
      var pts = [];
      puffs.forEach(function (k) { var q = puff(k, t); if (q && q.op > 0.02) pts.push([q.x, q.y, q.r]); });
      return bounds(pts, p.x, p.y);
    }
    update(p.at - 1);
    return { update: update, box: box };
  }

  // ---- glow -------------------------------------------------------------------------------
  function glow(layer, p, idPrefix) {
    var s = start("glow", layer, p, idPrefix, true);
    var col = p.color || "#FFD27A", size = p.size || 1, dur = p.duration || 3, R = (p.radius || 260) * size, NR = p.rays || 0;
    var fill = grad(s.defs, s.id("glow"), [[0, "#FFFFFF", 0.95], [0.18, D.tint(col, 0.5), 0.8], [0.55, col, 0.28], [1, col, 0]]);
    var rayFill = D.el(s.defs, "linearGradient", { id: s.id("ray"), x1: 0, y1: 0, x2: 1, y2: 0 });
    D.el(rayFill, "stop", { offset: 0, "stop-color": col, "stop-opacity": 0.5 });
    D.el(rayFill, "stop", { offset: 1, "stop-color": col, "stop-opacity": 0 });
    var rays = D.el(s.g, "g", {});
    arr(NR, function (i) { return D.el(rays, "path", { d: "M0 -" + r2(R * 0.06) + " L" + r2(R * 1.5) + " -" + r2(R * 0.2) + " L" + r2(R * 1.5) + " " + r2(R * 0.2) + " L0 " + r2(R * 0.06) + " Z", fill: "url(#" + s.id("ray") + ")", transform: "rotate(" + r2(i * 360 / NR) + ")" }); });
    var halo = D.el(s.g, "circle", { cx: r2(p.x), cy: r2(p.y), r: 1, fill: fill });
    function env(t) { var a = t - p.at; return a < 0 || a > dur ? 0 : E.outCubic(clamp(a / 0.35)) * (1 - E.inOut(clamp((a - dur + 0.5) / 0.5))); }
    function scale(t) { return 1 + 0.07 * Math.sin((t - p.at) * 2 * Math.PI * 0.8); }
    function update(t) {
      var e = env(t);
      s.g.setAttribute("opacity", e > 0 ? r2(e) : 0);
      if (e <= 0) return;
      var sc = scale(t) * (0.7 + 0.3 * E.outBack(clamp((t - p.at) / 0.5)));
      set(halo, { r: R * sc });
      set(rays, { transform: "translate(" + r2(p.x) + " " + r2(p.y) + ") rotate(" + r2((t - p.at) * 9) + ")", opacity: 0.7 });
    }
    function box(t) {
      if (env(t) <= 0) return empty(p.x, p.y);
      var r = R * 1.08 * (NR ? 1.5 : 1);
      return bounds([[p.x, p.y, r]], p.x, p.y);
    }
    update(p.at - 1);
    return { update: update, box: box };
  }

  /* The pulse path maths, for the moves compiler (pure): sampled(path) -> [{x, y, s}], pointAt(S, len).
   * Kept off K.effects so Object.keys(HFKit.effects) stays the list of effects. */
  K.effectPath = { sampled: sampled, pointAt: pointAt, length: function (path) { var S = sampled(path); return S[S.length - 1].s; } };
  K.effects = { burst: burst, rings: rings, pulse_along: pulse_along, speed_lines: speed_lines, splash: splash, sparkle: sparkle, smoke: smoke, glow: glow };
})(typeof globalThis !== "undefined" ? globalThis : window);
