/* Scene 2 custom "tide-gauge": a striped tide pole standing in the sea at the ocean's `surface`
 * anchor, with a red float riding the water line. Time runs fast (a tide of about 12 hours takes
 * params.period seconds, default 2.4): before the move's `at` the float rises and falls over the
 * full range (params.range world px, default 150 each way) between two white marks ("today");
 * from `at` the range shrinks over 1.2 s to params.ratio of it (default 0.42: only the Sun's
 * tides remain, a third to a half of today's), and two orange bands show where the new, smaller
 * range lies: between params.band[0] and params.band[1] of today's (default [1/3, 1/2]) above and
 * below the mean water level.
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t. */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog, E = D.ease;
  K.customs = K.customs || {};
  K.customs["tide-gauge"] = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, s = ctx.anchors.surface(0);
      var period = p.period || 2.4, A = p.range || 150, ratio = p.ratio === undefined ? 0.42 : p.ratio, band = p.band || [1 / 3, 1 / 2];
      var x = s.x, y0 = s.y, top = y0 - 430, bot = y0 + 420;
      var g = D.el(layer, "g", { "data-custom": "tide-gauge" });
      D.el(g, "rect", { x: x - 22, y: top, width: 44, height: bot - top, rx: 10, fill: "#F7F3EA", stroke: "#2B3440", "stroke-width": 6 });
      for (var k = 0; k < 9; k++) D.el(g, "rect", { x: x - 19, y: top + 12 + k * 96, width: 38, height: 44, fill: "#D9483B" });
      for (var j = -6; j <= 6; j++) D.el(g, "path", { d: "M" + (x + 22) + " " + (y0 + j * 50) + " h" + (j % 2 ? 18 : 34), stroke: "#2B3440", "stroke-width": 5 });
      D.el(g, "circle", { cx: x, cy: top - 10, r: 22, fill: "#FFD27A", stroke: "#2B3440", "stroke-width": 5 });
      var mark = function (yy, col) { return D.el(g, "path", { d: "M" + (x - 70) + " " + yy + " h140", stroke: col, "stroke-width": 12, "stroke-linecap": "round" }); };
      mark(y0 - A, "#FFFFFF"); mark(y0 + A, "#FFFFFF");
      var zone = function (sgn) { return D.el(g, "rect", { x: x - 70, y: r2(sgn < 0 ? y0 - A * band[1] : y0 + A * band[0]), width: 140, height: r2(A * (band[1] - band[0])), rx: 8, fill: "#FFB347", stroke: "#E07A10", "stroke-width": 4 }); };
      var newHi = zone(-1), newLo = zone(1);
      var water = D.el(g, "path", { fill: "#2E8BD0", opacity: 0.55 });
      var line = D.el(g, "path", { fill: "none", stroke: "#BFEAFF", "stroke-width": 8, "stroke-linecap": "round" });
      var float = D.el(g, "g", {});
      D.el(float, "ellipse", { cx: 0, cy: 0, rx: 62, ry: 34, fill: "#E8503A", stroke: "#2B3440", "stroke-width": 6 });
      D.el(float, "path", { d: "M-62 0 h124", stroke: "#FFFFFF", "stroke-width": 10 });
      function level(t) {
        var amp = A * (1 - (1 - ratio) * E.inOut(prog(t, at, at + 1.2)));
        return y0 - amp * Math.sin(2 * Math.PI * t / period);
      }
      function update(t) {
        var yy = level(t), w = 260;
        var d = "M" + (x - w) + " " + r2(yy);
        for (var i = 1; i <= 12; i++) d += " L" + r2(x - w + i * w / 6) + " " + r2(yy + 8 * Math.sin(i * 1.3 + t * 3));
        water.setAttribute("d", d + " L" + (x + w) + " " + (y0 + A + 60) + " L" + (x - w) + " " + (y0 + A + 60) + " Z");
        line.setAttribute("d", d);
        float.setAttribute("transform", "translate(" + x + " " + r2(yy + 4 * Math.sin(t * 3)) + ")");
        var o = r2(prog(t, at + 0.6, at + 1.2));
        newHi.setAttribute("opacity", o); newLo.setAttribute("opacity", o);
      }
      function box() { return { x: x - 270, y: top - 40, width: 540, height: bot - top + 60 }; }
      update(0);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
