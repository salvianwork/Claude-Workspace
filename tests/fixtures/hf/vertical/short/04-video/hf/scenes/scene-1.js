/* Scene 1 custom "white-light": a beam of white sunlight slants down from the upper right (from the
 * Sun, off frame) through the clear air, into a small glass prism that hangs in the sky; at
 * params.split seconds after the move's `at` the light leaving the prism fans out into the seven
 * colours of the rainbow (red, orange, yellow, green, blue, indigo, violet; red bent least).
 * Positions are world px relative to the place's `sky` anchor: params.from (default {x: 620, y: -720},
 * where the beam starts), params.prism (default {x: 0, y: 0}), params.prismSize (default 120: the
 * prism's corner radius, world px); params.showPrism false draws the white beam alone. The beam draws on over 0.6 s.
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t. */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog, E = D.ease;
  K.customs = K.customs || {};
  K.customs["white-light"] = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, id = ctx.idPrefix, s = ctx.anchors.sky(0);
      var fo = p.from || { x: 620, y: -720 }, po = p.prism || { x: 0, y: 0 }, split = at + (p.split === undefined ? 2 : p.split);
      var A = { x: s.x + fo.x, y: s.y + fo.y }, P = { x: s.x + po.x, y: s.y + po.y };
      var g = D.el(layer, "g", { "data-custom": "white-light" });
      var defs = D.el(g, "defs");
      var bl = D.el(defs, "filter", { id: id + "-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" });
      D.el(bl, "feGaussianBlur", { stdDeviation: 14 });
      var glow = D.el(g, "path", { stroke: "#FFFFFF", "stroke-width": 90, "stroke-linecap": "round", opacity: 0, filter: "url(#" + id + "-glow)", fill: "none" });
      var beam = D.el(g, "path", { stroke: "#FFFFFF", "stroke-width": 44, "stroke-linecap": "round", opacity: 0, fill: "none" });
      // the rainbow fan: red bends least, violet most (a prism spreads the colours)
      var cols = ["#E53935", "#FB8C00", "#FDD835", "#43A047", "#1E88E5", "#3949AB", "#8E24AA"];
      var ux = P.x - A.x, uy = P.y - A.y, L0 = Math.hypot(ux, uy); ux /= L0; uy /= L0;
      var base = Math.atan2(uy, ux), fanLen = p.length || 760;
      var rays = cols.map(function (c, i) {
        var a = base + (6 + i * 4.2) * Math.PI / 180; // bent down-left, more for the bluer colours
        return { a: a, el: D.el(g, "path", { stroke: c, "stroke-width": 30, "stroke-linecap": "butt", opacity: 0, fill: "none" }) };
      });
      // the prism: an equilateral glass triangle, its side facing the beam
      var pr = p.prismSize || 120, prism = D.el(g, "g", { opacity: 0 });
      var pts = [0, 1, 2].map(function (k) { var q = base + Math.PI + k * 2 * Math.PI / 3; return (P.x + pr * Math.cos(q)).toFixed(1) + " " + (P.y + pr * Math.sin(q)).toFixed(1); });
      D.el(prism, "path", { d: "M" + pts.join(" L") + " Z", fill: "#DFF4FF", "fill-opacity": 0.55, stroke: "#FFFFFF", "stroke-width": 8, "stroke-linejoin": "round" });
      D.el(prism, "path", { d: "M" + pts[0] + " L" + pts[1], stroke: "#B9E3F8", "stroke-width": 4, opacity: 0.8 });
      function update(t) {
        var u = E.outCubic(prog(t, at, at + 0.6)), e = { x: A.x + (P.x - A.x) * u, y: A.y + (P.y - A.y) * u };
        var d = "M" + r2(A.x) + " " + r2(A.y) + " L" + r2(e.x) + " " + r2(e.y);
        beam.setAttribute("d", d); glow.setAttribute("d", d);
        var on = t < at ? 0 : 1;
        beam.setAttribute("opacity", r2(0.95 * on)); glow.setAttribute("opacity", r2(0.5 * on));
        prism.setAttribute("opacity", p.showPrism === false ? 0 : r2(prog(t, at - 0.2, at + 0.4)));
        var v = E.outCubic(prog(t, split, split + 0.9));
        rays.forEach(function (r) {
          var L = fanLen * v, x1 = P.x + Math.cos(r.a) * 40, y1 = P.y + Math.sin(r.a) * 40;
          r.el.setAttribute("d", "M" + r2(x1) + " " + r2(y1) + " L" + r2(x1 + Math.cos(r.a) * L) + " " + r2(y1 + Math.sin(r.a) * L));
          r.el.setAttribute("opacity", r2(0.92 * prog(t, split, split + 0.2)));
        });
      }
      function box(t) {
        if (t < at) return { x: P.x, y: P.y, width: 0, height: 0 };
        var xs = [A.x, P.x, P.x - fanLen], ys = [A.y, P.y, P.y + fanLen];
        return { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys), width: Math.max.apply(null, xs) - Math.min.apply(null, xs), height: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
      }
      update(at - 1);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
