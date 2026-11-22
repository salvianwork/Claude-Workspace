/* Scene 3 customs, a cloud forming over the sea (place ocean, variant surface; both centre on the
 * `sky` anchor, right of the boat's mast).
 *
 * "droplets": where the rising air has cooled, tiny water droplets appear (condensation): light
 *   blue-white dots with a glint, fading in one by one from the move's `at` over about 1.4 s in a
 *   band at the cloud's base level, drifting gently; from `until` they fade as the cloud takes over.
 *
 * "cumulus": a real fair-weather cumulus building up: a FLAT BASE (the level where the air cools
 *   enough to condense) and a puffy, cauliflower top of rounded turrets, white and sunlit on top,
 *   grey-blue toward the base, with a soft outline on its silhouette. From its `at` the puffs
 *   appear from the base upward (each swells in and rises a little), so the cloud billows up over
 *   params.grow seconds (default 1.8). params.grown: true draws it fully formed from the start
 *   (a later scene). params.dark (0..1): from `at` the cloud turns grey and heavy over 1.6 s and
 *   swells a little (its droplets bump together and grow; a rain cloud). params.scale (default 0.78).
 *   Geometry shared with scene 4's "rain": centre x = sky.x, base y = sky.y + 90.
 *
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t (any frame, any order). */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog, E = D.ease;
  K.customs = K.customs || {};
  function cloudAt(anchors) { var s = anchors.sky(0); return { x: s.x, base: s.y + 90 }; } // scene-4.js "rain" uses the same

  K.customs.droplets = {
    mount: function (layer, ctx) {
      var at = ctx.at, until = ctx.until, C = cloudAt(ctx.anchors);
      var g = D.el(layer, "g", { "data-custom": "droplets" }), R = D.rng(57), drops = [];
      for (var i = 0; i < 110; i++) {
        var dx = (R() - 0.5) * 760, dy = -40 - R() * 260 * (1 - Math.abs(dx) / 900);
        var e = D.el(g, "g", { opacity: 0 });
        var r = 5 + R() * 5;
        D.el(e, "circle", { r: r2(r), fill: "#E6F4FF", stroke: "#6FAEDF", "stroke-width": 2 });
        D.el(e, "circle", { cx: r2(-r * 0.35), cy: r2(-r * 0.35), r: r2(r * 0.35), fill: "#FFFFFF" });
        drops.push({ x: C.x + dx, y: C.base + dy, t0: at + R() * 1.4, s: (R() * 100) | 0, e: e });
      }
      function update(t) {
        var out = 1 - prog(t, until, until + 0.8);
        drops.forEach(function (d) {
          var k = E.outCubic(prog(t, d.t0, d.t0 + 0.35));
          d.e.setAttribute("opacity", r2(k * out * (0.75 + 0.25 * Math.sin(t * 3 + d.s))));
          d.e.setAttribute("transform", "translate(" + r2(d.x + D.wobble(t, d.s, 0.5) * 10) + " " + r2(d.y - 14 * prog(t, d.t0, d.t0 + 3)) + ") scale(" + r2(0.4 + 0.6 * k) + ")");
        });
      }
      function box() { return { x: C.x - 420, y: C.base - 330, width: 840, height: 330 }; }
      update(0);
      return { update: update, box: box };
    },
  };

  // the puffs: [dx, dy of the centre above the base, radius, level]; level 0 sits on the base and is
  // cut flat by it, higher levels are the turrets
  var PUFFS = [
    [-330, -48, 105, 0], [-190, -63, 140, 0], [-30, -72, 160, 0], [135, -68, 150, 0], [285, -54, 120, 0], [395, -38, 85, 0],
    [-235, -205, 120, 1], [-80, -255, 155, 1], [95, -240, 145, 1], [245, -175, 112, 1],
    [-140, -380, 112, 2], [25, -425, 135, 2], [175, -345, 100, 2],
    [-45, -545, 96, 3], [95, -515, 82, 3],
  ];
  var LIGHT = { top: "#FFFFFF", mid: "#F2F6FA", base: "#B9C8DA", line: "#9AB0C8", hi: "#FFFFFF" };
  var STORM = { top: "#A3AEBB", mid: "#8592A2", base: "#4E5A69", line: "#3F4A58", hi: "#BCC5CF" };

  K.customs.cumulus = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, P = ctx.idPrefix, C = cloudAt(ctx.anchors);
      var S = p.scale || 0.78, grow = p.grow || 1.8, darkTo = p.dark || 0;
      var top = C.base - 650 * S;
      var g = D.el(layer, "g", { "data-custom": "cumulus" });
      var defs = D.el(g, "defs", {});
      var grad = D.el(defs, "linearGradient", { id: P + "-cu", gradientUnits: "userSpaceOnUse", x1: 0, y1: r2(top), x2: 0, y2: r2(C.base) });
      var st = [D.el(grad, "stop", { offset: 0 }), D.el(grad, "stop", { offset: 0.55 }), D.el(grad, "stop", { offset: 1 })];
      var hg = D.el(defs, "radialGradient", { id: P + "-hi" });
      D.el(hg, "stop", { offset: 0, "stop-color": "#FFFFFF", "stop-opacity": 0.85 }); D.el(hg, "stop", { offset: 1, "stop-color": "#FFFFFF", "stop-opacity": 0 });
      var clip = D.el(defs, "clipPath", { id: P + "-flat" });
      D.el(clip, "rect", { x: C.x - 1200, y: r2(C.base - 1400), width: 2400, height: 1400 }); // the flat base
      var body = D.el(g, "g", { "clip-path": "url(#" + P + "-flat)" });
      var outline = D.el(body, "g", {}), fill = D.el(body, "g", {}), hi = D.el(body, "g", {});
      var puffs = PUFFS.map(function (q, i) {
        return {
          dx: q[0] * S, dy: q[1] * S, r: q[2] * S, level: q[3], i: i,
          t0: at + grow * (q[3] * 0.24 + ((i * 37) % 10) / 10 * 0.12),
          o: D.el(outline, "circle", { "stroke-width": 14 }), f: D.el(fill, "circle", { fill: "url(#" + P + "-cu)" }),
          h: q[3] >= 2 ? D.el(hi, "circle", { opacity: 0 }) : null, // a soft sunlit glow on the top turrets only
        };
      });
      function look(t) {
        var k = darkTo * E.inOutSine(prog(t, at, at + 1.6));
        var c = {}; for (var n in LIGHT) c[n] = D.mix(LIGHT[n], STORM[n], k);
        return { c: c, k: k };
      }
      function update(t) {
        var L = look(t), c = L.c, swell = 1 + 0.07 * L.k;
        st[0].setAttribute("stop-color", c.top); st[1].setAttribute("stop-color", c.mid); st[2].setAttribute("stop-color", c.base);
        puffs.forEach(function (q) {
          var k = p.grown ? 1 : prog(t, q.t0, q.t0 + 0.9), kk = E.outBack(k);
          if (k <= 0) { [q.o, q.f, q.h].forEach(function (e) { if (e) e.setAttribute("opacity", 0); }); return; }
          var billow = 1 + 0.018 * Math.sin(t * 0.9 + q.i * 1.7);
          var r = q.r * (0.3 + 0.7 * kk) * billow * swell;
          var cy = C.base + q.dy * (0.55 + 0.45 * kk) * swell, cx = C.x + q.dx * swell;
          var op = r2(E.outCubic(prog(k, 0, 0.5)));
          q.o.setAttribute("cx", r2(cx)); q.o.setAttribute("cy", r2(cy)); q.o.setAttribute("r", r2(r)); q.o.setAttribute("fill", c.line); q.o.setAttribute("stroke", c.line); q.o.setAttribute("opacity", op);
          q.f.setAttribute("cx", r2(cx)); q.f.setAttribute("cy", r2(cy)); q.f.setAttribute("r", r2(r)); q.f.setAttribute("opacity", op);
          if (q.h) { q.h.setAttribute("cx", r2(cx + r * 0.18)); q.h.setAttribute("cy", r2(cy - r * 0.22)); q.h.setAttribute("r", r2(r * 0.62)); q.h.setAttribute("fill", "url(#" + P + "-hi)"); q.h.setAttribute("opacity", r2(op * (1 - L.k))); }
        });
      }
      function box(t) { return { x: C.x - 520 * S, y: top, width: 1040 * S, height: C.base - top }; }
      update(0);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
