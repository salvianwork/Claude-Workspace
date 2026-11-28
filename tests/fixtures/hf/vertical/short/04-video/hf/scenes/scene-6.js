/* Scene 6 custom "sunset-beam": the low evening Sun near the horizon (a big glowing disc at the
 * `sky` anchor + params.sun, default {x: 560, y: 520}) sends a long, low beam across the sky to the
 * left (to `sky` + params.to, default {x: -700, y: 420}). The beam draws on over 1.2 s from the
 * move's `at`. Along its length it changes colour: white-yellow by the Sun, then orange, then red at
 * the far end, while small blue sparks peel off it and drift away upward over the first two thirds
 * (the blue scattered out of the beam by the long path through the air).
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t (seeded random only). */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog, E = D.ease;
  K.customs = K.customs || {};
  K.customs["sunset-beam"] = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, id = ctx.idPrefix, s = ctx.anchors.sky(0);
      var so = p.sun || { x: 560, y: 520 }, to = p.to || { x: -700, y: 420 };
      var S = { x: s.x + so.x, y: s.y + so.y }, T = { x: s.x + to.x, y: s.y + to.y }, L = Math.hypot(T.x - S.x, T.y - S.y);
      var g = D.el(layer, "g", { "data-custom": "sunset-beam" });
      var defs = D.el(g, "defs");
      var bl = D.el(defs, "filter", { id: id + "-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" });
      D.el(bl, "feGaussianBlur", { stdDeviation: 16 });
      var lg = D.el(defs, "linearGradient", { id: id + "-beam", gradientUnits: "userSpaceOnUse", x1: S.x, y1: S.y, x2: T.x, y2: T.y });
      [[0, "#FFF6DA"], [0.3, "#FFD36B"], [0.62, "#FF8A3D"], [1, "#E8402F"]].forEach(function (q) { D.el(lg, "stop", { offset: q[0], "stop-color": q[1] }); });
      var sg = D.el(defs, "radialGradient", { id: id + "-sun", cx: 0.5, cy: 0.5, r: 0.5 });
      [[0, "#FFF3C4", 1], [0.45, "#FFC04D", 0.95], [0.7, "#FF8A3D", 0.5], [1, "#FF8A3D", 0]].forEach(function (q) { D.el(sg, "stop", { offset: q[0], "stop-color": q[1], "stop-opacity": q[2] }); });
      D.el(g, "circle", { cx: S.x, cy: S.y, r: 240, fill: "url(#" + id + "-sun)" });
      D.el(g, "circle", { cx: S.x, cy: S.y, r: 95, fill: "#FFE7A3" });
      var glow = D.el(g, "path", { stroke: "url(#" + id + "-beam)", "stroke-width": 110, "stroke-linecap": "round", opacity: 0, fill: "none", filter: "url(#" + id + "-glow)" });
      var beam = D.el(g, "path", { stroke: "url(#" + id + "-beam)", "stroke-width": 50, "stroke-linecap": "round", opacity: 0, fill: "none" });
      var R = D.rng(31), sparks = [];
      for (var i = 0; i < 36; i++) {
        var k = 0.08 + 0.6 * (i / 36) + R() * 0.03;
        sparks.push({ k: k, t0: at + 1.2 * k + R() * 1.6, v: 120 + R() * 90, dx: (R() - 0.5) * 120, el: D.el(g, "circle", { r: r2(8 + R() * 7), fill: "#5AA8FF", stroke: "#DDEEFF", "stroke-width": 3, opacity: 0 }) });
      }
      function update(t) {
        var u = E.outCubic(prog(t, at, at + 1.2)), e = { x: S.x + (T.x - S.x) * u, y: S.y + (T.y - S.y) * u };
        var d = "M" + r2(S.x) + " " + r2(S.y) + " L" + r2(e.x) + " " + r2(e.y), on = t >= at ? 1 : 0;
        beam.setAttribute("d", d); glow.setAttribute("d", d);
        beam.setAttribute("opacity", r2(0.95 * on)); glow.setAttribute("opacity", r2(0.55 * on));
        sparks.forEach(function (sp) {
          var a = t - sp.t0;
          if (a < 0) { sp.el.setAttribute("opacity", 0); return; }
          var bx = S.x + (T.x - S.x) * sp.k, by = S.y + (T.y - S.y) * sp.k;
          sp.el.setAttribute("cx", r2(bx + sp.dx * Math.min(1, a))); sp.el.setAttribute("cy", r2(by - sp.v * a));
          sp.el.setAttribute("opacity", r2(prog(a, 0, 0.2) * (1 - prog(a, 1.2, 2))));
        });
      }
      function box(t) { return { x: Math.min(S.x, T.x) - 60, y: Math.min(S.y, T.y) - 400, width: Math.abs(T.x - S.x) + 300, height: 700 }; }
      update(at - 1);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
