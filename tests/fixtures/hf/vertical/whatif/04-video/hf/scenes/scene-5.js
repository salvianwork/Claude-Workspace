/* Scene 5 custom "coral-spawn": coral spawning on the reef (ocean, underwater). From the move's `at`
 * the corals around the `reef` anchor release tiny pink and peach egg bundles (params.count,
 * default 70) over params.release seconds (default 1.6); each bundle rises slowly toward the
 * bright surface (110-210 world px/s), swaying a little, and fades out after about params.rise
 * world px (default 900). A soft pink haze glows over the reef while they go. The bundles are
 * drawn larger than life so they read on a phone (real bundles are a few millimetres).
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t (seeded random only). */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog;
  K.customs = K.customs || {};
  K.customs["coral-spawn"] = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, id = ctx.idPrefix, c = ctx.anchors.reef(0);
      var N = p.count || 70, rel = p.release || 1.6, rise = p.rise || 900, spread = p.spread || 520;
      var R = D.rng(4242), cols = ["#FF8FB1", "#FFB38A", "#FF6F9C", "#FFD1DC"];
      var g = D.el(layer, "g", { "data-custom": "coral-spawn" });
      var defs = D.el(g, "defs");
      var hz = D.el(defs, "radialGradient", { id: id + "-haze", cx: 0.5, cy: 0.5, r: 0.5 });
      [[0, "#FF9EC0", 0.45], [1, "#FF9EC0", 0]].forEach(function (s) { D.el(hz, "stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] }); });
      var haze = D.el(g, "ellipse", { cx: c.x, cy: c.y - 260, rx: spread + 200, ry: 420, fill: "url(#" + id + "-haze)", opacity: 0 });
      var B = [];
      for (var i = 0; i < N; i++) {
        var b = { x: c.x + (R() - 0.5) * 2 * spread, y: c.y - 40 - R() * 140, t0: at + R() * rel, v: 110 + R() * 100,
          r: 9 + R() * 9, ph: R() * 6.28, col: cols[Math.floor(R() * cols.length)] };
        b.g = D.el(g, "g", { opacity: 0 });
        D.el(b.g, "circle", { cx: 0, cy: 0, r: r2(b.r), fill: b.col, stroke: "#FFFFFF", "stroke-width": 2, "stroke-opacity": 0.6 });
        D.el(b.g, "circle", { cx: r2(-b.r * 0.3), cy: r2(-b.r * 0.3), r: r2(b.r * 0.32), fill: "#FFFFFF", opacity: 0.8 });
        B.push(b);
      }
      function update(t) {
        haze.setAttribute("opacity", r2(prog(t, at, at + 0.8) * (1 - 0.4 * prog(t, at + 3, at + 5))));
        B.forEach(function (b) {
          var a = t - b.t0;
          if (a < 0) { b.g.setAttribute("opacity", 0); return; }
          var dy = Math.min(rise, b.v * a), u = dy / rise;
          var x = b.x + Math.sin(b.ph + a * 1.8) * 18 * Math.min(1, a), y = b.y - dy;
          b.g.setAttribute("transform", "translate(" + r2(x) + " " + r2(y) + ")");
          b.g.setAttribute("opacity", r2(prog(a, 0, 0.3) * (1 - prog(u, 0.75, 1))));
        });
      }
      function box(t) {
        if (t < at) return { x: c.x, y: c.y, width: 0, height: 0 };
        return { x: c.x - spread - 40, y: c.y - 200 - rise, width: 2 * spread + 80, height: rise + 220 };
      }
      update(at - 1);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
