/* Scene 1 custom "moon-vanish": the imagined moment the Moon disappears. From the move's `at` the
 * Moon (the space place's `moon` anchor, earth-orbit: radius 120 world px) flashes softly, a ring
 * of light spreads, and a disc of empty space fades over it within about 0.9 s, so the Moon is
 * gone for the rest of the scene. params.radius (default 120) is the Moon's radius. params.gone:
 * true covers it from the start, with no flash (a later scene of the imagined, Moon-free world).
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t. */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog, E = D.ease;
  K.customs = K.customs || {};
  K.customs["moon-vanish"] = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, id = ctx.idPrefix, m = ctx.anchors.moon(0), R = p.radius || 120;
      var g = D.el(layer, "g", { "data-custom": "moon-vanish" });
      var defs = D.el(g, "defs");
      var sf = D.el(defs, "filter", { id: id + "-soft", x: "-30%", y: "-30%", width: "160%", height: "160%" });
      D.el(sf, "feGaussianBlur", { stdDeviation: 6 });
      var gr = D.el(defs, "radialGradient", { id: id + "-fl", cx: 0.5, cy: 0.5, r: 0.5 });
      [[0, "#FFFFFF", 0.95], [0.35, "#F6F2DC", 0.6], [1, "#F6F2DC", 0]].forEach(function (s) { D.el(gr, "stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] }); });
      var cover = D.el(g, "circle", { cx: m.x, cy: m.y, r: R + 10, fill: "#05060F", opacity: 0, filter: "url(#" + id + "-soft)" });
      // a few faint stars in the emptied patch, so the hole reads as open sky, not a dark disc
      var holeStars = D.el(g, "g", { opacity: 0 });
      [[-0.5, -0.3, 2.4], [0.35, -0.55, 1.8], [0.1, 0.4, 2.2], [-0.25, 0.7, 1.6], [0.62, 0.2, 2]].forEach(function (q) { D.el(holeStars, "circle", { cx: m.x + q[0] * R, cy: m.y + q[1] * R, r: q[2] * 1.5, fill: "#FFF8E1" }); });
      var ring = D.el(g, "circle", { cx: m.x, cy: m.y, r: R, fill: "none", stroke: "#F6F2DC", "stroke-width": 10, opacity: 0 });
      var flash = D.el(g, "circle", { cx: m.x, cy: m.y, r: R * 2.4, fill: "url(#" + id + "-fl)", opacity: 0 });
      function update(t) {
        var a = p.gone ? 99 : t - at;
        cover.setAttribute("opacity", r2(E.inOut(prog(a, 0.15, 0.9))));
        holeStars.setAttribute("opacity", r2(0.7 * prog(a, 0.6, 1.2)));
        var f = a < 0 ? 0 : Math.sin(Math.PI * Math.min(1, a / 0.7));
        flash.setAttribute("opacity", r2(0.9 * f));
        flash.setAttribute("r", r2(R * (1.4 + 1.4 * prog(a, 0, 0.7))));
        var u = prog(a, 0.1, 1.3);
        ring.setAttribute("r", r2(R * (1 + 2.5 * E.outCubic(u))));
        ring.setAttribute("opacity", r2(a < 0.1 ? 0 : 0.8 * (1 - u)));
        ring.setAttribute("stroke-width", r2(10 * (1 - 0.7 * u)));
      }
      function box(t) { var a = p.gone ? 99 : t - at; return a < 0 || a > 1.4 ? { x: m.x, y: m.y, width: 0, height: 0 } : { x: m.x - R * 3.5, y: m.y - R * 3.5, width: R * 7, height: R * 7 }; }
      update(at - 1);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
