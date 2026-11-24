/* hf-kit insides: the close-up views a `dive` cuts to (HFKit.insides). Drawn in screen px
 * (a 1920 x 1080 drawing, fitted to cover the canvas) in the world style: flat-shaded shapes with soft gradients, simple dark outlines,
 * warm light from the top left. Each is a pure function of t (seekable).
 *
 *   HFKit.insides[name] = {meta: {name, description, params: {key: [values]}},
 *                          check(params) -> error string | null,
 *                          mount(el, {params, idPrefix, seed}) -> {update(t), el}}
 *   el: a canvas-sized box; t: seconds since the cut (0 = the first frame inside).
 *
 *   lattice   particles of matter. params.state: solid (packed in a grid, bonded, vibrating),
 *             liquid (close but loose, sliding past each other, a free surface),
 *             gas (far apart, flying fast in straight lines, bouncing off the walls). params.color.
 *   cells     living cells. params.type: animal (tissue: membranes, nuclei, mitochondria),
 *             plant (cell walls, a big vacuole, chloroplasts streaming round the edge),
 *             blood (red cells tumbling through a vessel, laminar: fastest in the middle).
 *
 * Every SVG id starts with idPrefix + "-". Classic script: load after draw.js; sets HFKit.insides. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw) throw new Error("world/insides.js: load kit.js and draw.js first");
  var D = K.draw, r2 = D.r2;
  var W = 1920, H = 1080, LINE = "#1E1A2E"; // the drawing's own px; mountSvg fits it to the canvas

  function tag(name, a, inner) {
    var s = "<" + name;
    for (var k in a) if (a[k] !== undefined && a[k] !== null) s += " " + k + '="' + (typeof a[k] === "number" ? r2(a[k]) : a[k]) + '"';
    return s + (inner === undefined ? "/>" : ">" + inner + "</" + name + ">");
  }
  function stops(list) { return list.map(function (s) { return tag("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] }); }).join(""); }
  function radial(id, list, cx, cy, r) { return tag("radialGradient", { id: id, cx: cx === undefined ? 0.5 : cx, cy: cy === undefined ? 0.5 : cy, r: r || 0.5 }, stops(list)); }
  function linear(id, list, y2) { return tag("linearGradient", { id: id, x1: 0, y1: 0, x2: 0, y2: y2 === undefined ? 1 : y2 }, stops(list)); }
  /* A shaded sphere gradient: highlight top left, base, rim shade. */
  function sphere(id, col) { return radial(id, [[0, D.tint(col, 0.75)], [0.35, D.tint(col, 0.2)], [0.78, col], [1, D.shade(col, 0.35)]], 0.36, 0.32, 0.72); }
  /* Closed smooth path (Catmull-Rom) through points [[x, y], ...]. */
  function closed(pts) {
    var n = pts.length, d = "M" + r2(pts[0][0]) + " " + r2(pts[0][1]);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += " C" + r2(p1[0] + (p2[0] - p0[0]) / 6) + " " + r2(p1[1] + (p2[1] - p0[1]) / 6) + " " + r2(p2[0] - (p3[0] - p1[0]) / 6) + " " + r2(p2[1] - (p3[1] - p1[1]) / 6) + " " + r2(p2[0]) + " " + r2(p2[1]);
    }
    return d + "Z";
  }
  function blob(cx, cy, rx, ry, t, ph, amp, n) {
    var pts = [];
    n = n || 10;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2, k = 1 + amp * Math.sin(3 * a + ph + t * 0.9) + amp * 0.6 * Math.sin(5 * a - ph * 1.7 + t * 0.6);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return closed(pts);
  }
  /* Triangle-wave reflection of x into [a, b] (a ball bouncing between walls). */
  function bounce(x, a, b) { var L = b - a, m = ((x - a) % (2 * L) + 2 * L) % (2 * L); return a + (m <= L ? m : 2 * L - m); }
  function wrap(x, a, b) { var L = b - a; return a + ((x - a) % L + L) % L; }

  function mountSvg(el, idPrefix) {
    if (!idPrefix) throw new Error("insides: needs an idPrefix");
    // a canvas other than 1920 x 1080 (vertical) shows the drawing centred, covering the frame
    // (cropped at the sides); landscape keeps the exact attributes it always had
    var cv = K.CANVAS, fit = cv.width !== W || cv.height !== H;
    var svg = D.el(el, "svg", fit ? { width: cv.width, height: cv.height, viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid slice", "data-inside": idPrefix }
      : { width: W, height: H, viewBox: "0 0 " + W + " " + H, "data-inside": idPrefix });
    svg.style.position = "absolute"; svg.style.left = "0"; svg.style.top = "0";
    return svg;
  }
  function group(svg, html) { var g = D.el(svg, "g"); if (html) g.innerHTML = html; return g; }
  /* Soft vignette and a lens rim: we are looking very close up. */
  function lens(id) {
    return tag("defs", {}, radial(id + "-vig", [[0, "#000", 0], [0.62, "#000", 0], [1, "#0B0716", 0.62]], 0.5, 0.5, 0.75)) +
      tag("rect", { width: W, height: H, fill: "url(#" + id + "-vig)" });
  }

  // ---- lattice --------------------------------------------------------------------------------
  var STATES = ["solid", "liquid", "gas"];
  var lattice = {
    meta: { name: "lattice", description: "Particles of matter up close: solid, liquid or gas.", params: { state: STATES } },
    check: function (p) {
      var s = p && typeof p === "object" ? p.state : p;
      if (s === undefined) return null;
      return STATES.indexOf(s) >= 0 ? null : "lattice state must be solid, liquid or gas (got \"" + s + "\")";
    },
    mount: function (el, opts) {
      opts = opts || {};
      var p = opts.params || {}, state = p.state || "solid", id = opts.idPrefix, col = p.color || "#4DABF7";
      var e = lattice.check(p);
      if (e) throw new Error("inside " + e);
      var svg = mountSvg(el, id), Rn = D.rng((opts.seed || 1) * 31 + 7);
      var bg = { solid: ["#3B4A7A", "#1A2142"], liquid: ["#2F5E8C", "#132A47"], gas: ["#4A4070", "#1B1733"] }[state];
      group(svg, tag("defs", {}, radial(id + "-bg", [[0, bg[0]], [1, bg[1]]], 0.42, 0.36, 0.85) + sphere(id + "-p", col) +
        radial(id + "-hl", [[0, "#FFFFFF", 0.95], [1, "#FFFFFF", 0]])) +
        tag("rect", { width: W, height: H, fill: "url(#" + id + "-bg)" }) +
        // faint floating motes far behind, for depth
        Array.from({ length: 26 }, function () { return tag("circle", { cx: Rn() * W, cy: Rn() * H, r: 3 + Rn() * 7, fill: "#FFFFFF", opacity: 0.05 + Rn() * 0.06 }); }).join(""));
      var dyn = group(svg);
      group(svg, lens(id));
      var P = [], r;
      if (state === "solid") { // hexagonal packing, bonded
        r = 50;
        var dx = 120, dy = 104, cols = 13, rows = 8;
        for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) P.push({ x: W / 2 + (i - (cols - 1) / 2) * dx + (j % 2 ? dx / 2 : 0) - dx / 4, y: H / 2 + (j - (rows - 1) / 2) * dy, ph: Rn() * 6.28, f: 2.6 + Rn() * 1.2, i: i, j: j });
      } else if (state === "liquid") { // loose packing below a free surface, sliding
        r = 48;
        for (var jj = 0; jj < 7; jj++) for (var ii = 0; ii < 18; ii++) {
          if (Rn() < 0.12) continue;
          P.push({ x: -120 + ii * 122 + (jj % 2 ? 61 : 0) + (Rn() - 0.5) * 30, y: 380 + jj * 108 + (Rn() - 0.5) * 22, ph: Rn() * 6.28, f: 0.5 + Rn() * 0.4, v: 26 + jj * 7 });
        }
      } else { // gas: few, fast, bouncing
        r = 44;
        for (var g = 0; g < 15; g++) {
          var a = Rn() * 6.28, sp = 300 + Rn() * 260;
          P.push({ x: 100 + Rn() * (W - 200), y: 100 + Rn() * (H - 200), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
        }
      }
      function at(q, t) {
        if (state === "solid") return { x: q.x + 7 * Math.sin(q.f * 6.28 * t + q.ph), y: q.y + 6 * Math.cos(q.f * 5.1 * t + q.ph * 1.3) };
        if (state === "liquid") {
          var x = wrap(q.x + q.v * t + 26 * Math.sin(q.f * t + q.ph), -180, W + 180);
          return { x: x, y: q.y + 14 * Math.sin(q.f * 1.7 * t + q.ph * 2) };
        }
        return { x: bounce(q.x + q.vx * t, r + 6, W - r - 6), y: bounce(q.y + q.vy * t, r + 6, H - r - 6) };
      }
      function ball(c, rr, op) {
        return tag("circle", { cx: c.x, cy: c.y, r: rr, fill: "url(#" + id + "-p)", stroke: LINE, "stroke-width": 4, opacity: op }) +
          tag("ellipse", { cx: c.x - rr * 0.34, cy: c.y - rr * 0.38, rx: rr * 0.3, ry: rr * 0.18, fill: "url(#" + id + "-hl)", opacity: op, transform: "rotate(-30 " + r2(c.x - rr * 0.34) + " " + r2(c.y - rr * 0.38) + ")" });
      }
      function update(t) {
        var s = "", pos = P.map(function (q) { return at(q, t); });
        if (state === "solid") { // bonds to the right and to both neighbours below
          var idx = {};
          P.forEach(function (q, k) { idx[q.i + "," + q.j] = k; });
          P.forEach(function (q, k) {
            var nb = [[q.i + 1, q.j], [q.j % 2 ? q.i + 1 : q.i, q.j + 1], [q.j % 2 ? q.i : q.i - 1, q.j + 1]];
            nb.forEach(function (n) {
              var o = idx[n[0] + "," + n[1]];
              if (o === undefined) return;
              s += tag("line", { x1: pos[k].x, y1: pos[k].y, x2: pos[o].x, y2: pos[o].y, stroke: "#CFE8FF", "stroke-width": 7, "stroke-linecap": "round", opacity: 0.38 });
            });
          });
        }
        if (state === "liquid") { // the free surface: a soft wavy line above the top row
          var pts = [];
          for (var x = -40; x <= W + 40; x += 80) pts.push(r2(x) + "," + r2(318 + 14 * Math.sin(x / 190 + t * 1.3) + 8 * Math.sin(x / 77 - t * 2.1)));
          s += tag("polyline", { points: pts.join(" "), fill: "none", stroke: "#BDE3FF", "stroke-width": 6, "stroke-linecap": "round", opacity: 0.45 });
        }
        if (state === "gas") { // short motion trails: they are fast
          P.forEach(function (q, k) {
            [0.05, 0.1, 0.15].forEach(function (dt, m) {
              var b = at(q, t - dt);
              if (Math.hypot(b.x - pos[k].x, b.y - pos[k].y) > 120) return; // just bounced
              s += tag("circle", { cx: b.x, cy: b.y, r: r * (0.85 - m * 0.18), fill: col, opacity: 0.18 - m * 0.05 });
            });
          });
        }
        pos.forEach(function (c) { s += ball(c, r, 1); });
        dyn.innerHTML = s;
      }
      update(0);
      return { update: update, el: svg };
    },
  };

  // ---- cells ----------------------------------------------------------------------------------
  var TYPES = ["animal", "plant", "blood"];
  var cells = {
    meta: { name: "cells", description: "Living cells up close: animal tissue, plant cells or blood.", params: { type: TYPES } },
    check: function (p) {
      var s = p && typeof p === "object" ? p.type : p;
      if (s === undefined) return null;
      return TYPES.indexOf(s) >= 0 ? null : "cells type must be animal, plant or blood (got \"" + s + "\")";
    },
    mount: function (el, opts) {
      opts = opts || {};
      var p = opts.params || {}, type = p.type || "animal", id = opts.idPrefix;
      var e = cells.check(p);
      if (e) throw new Error("inside " + e);
      var svg = mountSvg(el, id), Rn = D.rng((opts.seed || 1) * 17 + 3);
      var dyn, update;
      if (type === "animal") {
        group(svg, tag("defs", {}, radial(id + "-bg", [[0, "#FFE8DA"], [1, "#F2B9A4"]], 0.4, 0.35, 0.9) +
          radial(id + "-cy", [[0, "#FFE3EA"], [0.6, "#FFC2D1"], [1, "#F48FB1"]], 0.4, 0.35, 0.7) +
          radial(id + "-nu", [[0, "#D0BFFF"], [0.7, "#9775FA"], [1, "#6741D9"]], 0.38, 0.34, 0.7) +
          linear(id + "-mi", [[0, "#FFC078"], [1, "#F76707"]])) + tag("rect", { width: W, height: H, fill: "url(#" + id + "-bg)" }));
        dyn = group(svg);
        group(svg, lens(id));
        var C = [];
        for (var j = 0; j < 4; j++) for (var i = 0; i < 6; i++) C.push({ x: 90 + i * 350 + (j % 2 ? 175 : 0) + (Rn() - 0.5) * 50, y: 60 + j * 320 + (Rn() - 0.5) * 40, rx: 170 + Rn() * 20, ry: 150 + Rn() * 20, ph: Rn() * 6.28, nx: (Rn() - 0.5) * 50, ny: (Rn() - 0.5) * 40, ma: Rn() * 6.28 });
        update = function (t) {
          var s = "";
          C.forEach(function (c) {
            var x = c.x + 6 * Math.sin(t * 0.5 + c.ph), y = c.y + 5 * Math.cos(t * 0.4 + c.ph);
            var d = blob(x, y, c.rx, c.ry, t, c.ph, 0.045, 12);
            s += tag("path", { d: d, fill: "url(#" + id + "-cy)", stroke: "#C2255C", "stroke-width": 6, "stroke-linejoin": "round" }) +
              tag("path", { d: blob(x, y, c.rx - 14, c.ry - 14, t, c.ph, 0.045, 12), fill: "none", stroke: "#FFF0F4", "stroke-width": 3, opacity: 0.6 });
            // mitochondria: two orange beans with folded inner membranes
            for (var mm = 0; mm < 2; mm++) {
              var a = c.ma + mm * 2.6 + t * 0.15, mx = x + Math.cos(a) * c.rx * 0.55, my = y + Math.sin(a) * c.ry * 0.55, rot = r2(a * 57.3 + 90);
              s += tag("g", { transform: "translate(" + r2(mx) + " " + r2(my) + ") rotate(" + rot + ")" },
                tag("rect", { x: -34, y: -15, width: 68, height: 30, rx: 15, fill: "url(#" + id + "-mi)", stroke: "#A33A00", "stroke-width": 3 }) +
                tag("path", { d: "M-24 0 q6 -10 12 0 t12 0 t12 0 t12 0", fill: "none", stroke: "#FFE8CC", "stroke-width": 3, "stroke-linecap": "round" }));
            }
            // vesicles
            for (var v = 0; v < 3; v++) {
              var b = c.ph + v * 2.1 - t * 0.2;
              s += tag("circle", { cx: x + Math.cos(b) * c.rx * 0.32, cy: y + Math.sin(b) * c.ry * 0.62, r: 9, fill: "#FFF4E6", stroke: "#E8590C", "stroke-width": 2.5, opacity: 0.9 });
            }
            var nx = x + c.nx, ny = y + c.ny;
            s += tag("path", { d: blob(nx, ny, 58, 50, t * 0.6, c.ph + 1, 0.05, 8), fill: "url(#" + id + "-nu)", stroke: "#4C2A9E", "stroke-width": 4 }) +
              tag("circle", { cx: nx + 10, cy: ny - 4, r: 15, fill: "#5F3DC4", opacity: 0.9 }) +
              tag("ellipse", { cx: nx - 18, cy: ny - 20, rx: 16, ry: 9, fill: "#FFFFFF", opacity: 0.35 });
          });
          dyn.innerHTML = s;
        };
      } else if (type === "plant") {
        group(svg, tag("defs", {}, linear(id + "-bg", [[0, "#D8F5A2"], [1, "#94D82D"]]) +
          radial(id + "-cy", [[0, "#F4FCE3"], [1, "#C0EB75"]], 0.4, 0.35, 0.8) +
          radial(id + "-va", [[0, "#F1FAFF"], [1, "#C5E6F7"]], 0.4, 0.35, 0.8) +
          radial(id + "-ch", [[0, "#8CE99A"], [0.7, "#2F9E44"], [1, "#1B5E20"]], 0.38, 0.34, 0.7) +
          radial(id + "-nu", [[0, "#E5DBFF"], [1, "#845EF7"]], 0.38, 0.34, 0.7)) + tag("rect", { width: W, height: H, fill: "url(#" + id + "-bg)" }));
        dyn = group(svg);
        group(svg, lens(id));
        var PC = [];
        for (var pj = 0; pj < 3; pj++) for (var pi = 0; pi < 5; pi++) PC.push({ x: -60 + pi * 420 + (pj % 2 ? 210 : 0), y: 30 + pj * 360, w: 400, h: 340, ph: Rn() * 6.28 });
        update = function (t) {
          var s = "";
          PC.forEach(function (c) {
            var x = c.x, y = c.y, w = c.w, h = c.h;
            s += tag("rect", { x: x, y: y, width: w, height: h, rx: 46, fill: "#5C940D", stroke: "#2B5A06", "stroke-width": 5 }) +
              tag("rect", { x: x + 18, y: y + 18, width: w - 36, height: h - 36, rx: 34, fill: "url(#" + id + "-cy)", stroke: "#74B816", "stroke-width": 3 }) +
              tag("rect", { x: x + 70, y: y + 66, width: w - 140, height: h - 132, rx: 60, fill: "url(#" + id + "-va)", stroke: "#74C0FC", "stroke-width": 3, opacity: 0.95 });
            // chloroplasts stream round the cell, between the wall and the vacuole
            var per = 2 * ((w - 88) + (h - 84)), n = 9;
            for (var k = 0; k < n; k++) {
              var u = ((k / n) * per + t * 60 + c.ph * 40) % per, q = perimeter(x + 44, y + 42, w - 88, h - 84, u);
              s += tag("ellipse", { cx: q.x, cy: q.y, rx: 24, ry: 14, fill: "url(#" + id + "-ch)", stroke: "#1B5E20", "stroke-width": 2.5, transform: "rotate(" + r2(q.a) + " " + r2(q.x) + " " + r2(q.y) + ")" });
            }
            s += tag("circle", { cx: x + w - 96, cy: y + 92, r: 34, fill: "url(#" + id + "-nu)", stroke: "#5F3DC4", "stroke-width": 3 });
          });
          dyn.innerHTML = s;
        };
      } else { // blood
        group(svg, tag("defs", {}, linear(id + "-bg", [[0, "#F5C08A"], [0.5, "#FBDDB4"], [1, "#F2B27A"]]) +
          linear(id + "-wall", [[0, "#C92A2A"], [1, "#F08C8C"]]) +
          radial(id + "-rbc", [[0, "#FF8787"], [0.55, "#E03131"], [1, "#A51111"]], 0.4, 0.36, 0.7) +
          radial(id + "-wbc", [[0, "#FFFFFF"], [1, "#DCD3F5"]], 0.4, 0.35, 0.7)) +
          tag("rect", { width: W, height: H, fill: "url(#" + id + "-bg)" }));
        dyn = group(svg);
        group(svg, tag("path", { d: "M0 0 H" + W + " V120 C1500 150 1100 100 700 140 C400 165 200 120 0 130 Z", fill: "url(#" + id + "-wall)", stroke: "#8B1A1A", "stroke-width": 5 }) +
          tag("path", { d: "M0 " + H + " H" + W + " V950 C1500 930 1100 985 700 945 C400 915 200 960 0 950 Z", fill: "url(#" + id + "-wall)", stroke: "#8B1A1A", "stroke-width": 5 }) + lens(id));
        var B = [];
        for (var b = 0; b < 30; b++) { var yy = 200 + Rn() * 680, lane = 1 - Math.pow((yy - 540) / 380, 2); B.push({ x: Rn() * 2400, y: yy, v: 140 + 320 * lane, ph: Rn() * 6.28, spin: 0.6 + Rn() * 0.9, r: 58 + Rn() * 8 }); }
        var Wc = [{ x: 300, y: 420, v: 90, ph: 1 }, { x: 1500, y: 700, v: 110, ph: 2 }];
        update = function (t) {
          var s = "";
          Wc.forEach(function (c) {
            var x = wrap(c.x + c.v * t, -200, W + 200), y = c.y + 10 * Math.sin(t + c.ph);
            s += tag("path", { d: blob(x, y, 92, 88, t, c.ph, 0.06, 10), fill: "url(#" + id + "-wbc)", stroke: "#7950F2", "stroke-width": 4 }) +
              tag("path", { d: "M" + r2(x - 40) + " " + r2(y) + " q20 -40 40 0 q20 40 40 0", fill: "none", stroke: "#7048E8", "stroke-width": 16, "stroke-linecap": "round", opacity: 0.8 });
          });
          B.forEach(function (c) {
            var x = wrap(c.x + c.v * t, -120, W + 120), y = c.y + 8 * Math.sin(t * 1.2 + c.ph);
            var tilt = Math.abs(Math.cos(c.spin * t + c.ph)), ry = c.r * (0.38 + 0.62 * tilt), rot = r2(18 * Math.sin(c.ph + t * 0.4));
            s += tag("g", { transform: "translate(" + r2(x) + " " + r2(y) + ") rotate(" + rot + ")" },
              tag("ellipse", { rx: c.r, ry: ry, fill: "url(#" + id + "-rbc)", stroke: "#7A0D0D", "stroke-width": 3.5 }) +
              tag("ellipse", { rx: c.r * 0.5, ry: ry * 0.5, fill: "#B71C1C", opacity: 0.45 * tilt }) +
              tag("ellipse", { cx: -c.r * 0.3, cy: -ry * 0.42, rx: c.r * 0.26, ry: ry * 0.14, fill: "#FFFFFF", opacity: 0.35 }));
          });
          dyn.innerHTML = s;
        };
      }
      update(0);
      return { update: update, el: svg };
    },
  };
  /* Point u along the rounded perimeter of a rect, and the tangent angle (degrees). */
  function perimeter(x, y, w, h, u) {
    if (u < w) return { x: x + u, y: y, a: 0 };
    u -= w;
    if (u < h) return { x: x + w, y: y + u, a: 90 };
    u -= h;
    if (u < w) return { x: x + w - u, y: y + h, a: 180 };
    u -= w;
    return { x: x, y: y + h - Math.min(u, h), a: 270 };
  }

  K.insides = { lattice: lattice, cells: cells };
})(typeof globalThis !== "undefined" ? globalThis : window);
