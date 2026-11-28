/* Scene 6 custom "axis-wobble": Earth's spin axis, drawn as a dashed line out of the planet's
 * limb in the space place (earth-orbit: the planet's centre is far below the frame, 4086 world px
 * under its `planet` anchor (x 1920), radius 4250; so it follows the anchor in the extended
 * vertical world too), tilted (params.base degrees, default 8.2: Earth's 23.4 compressed to fit the
 * view; negative leans left). Before the move's `at` it sways only a little (today, held
 * steady by the Moon); from `at` the sway grows over 2 s to params.swing degrees each way (default
 * 18: an illustration of "far less steady", not a prediction of the exact angle). A faint arc
 * shows the range it sweeps. Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t),
 * box(t)}}; world px on the effects layer; update is a pure function of t. */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog, E = D.ease;
  K.customs = K.customs || {};
  K.customs["axis-wobble"] = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, C = { x: 1920, y: ctx.anchors.planet(0).y + 4086 }, Rp = 4250, swing = p.swing || 18, base = p.base === undefined ? 8.2 : p.base;
      var g = D.el(layer, "g", { "data-custom": "axis-wobble" });
      var arc = D.el(g, "path", { fill: "none", stroke: "#8FD8FF", "stroke-width": 8, "stroke-dasharray": "4 22", "stroke-linecap": "round", opacity: 0 });
      var axisIn = D.el(g, "path", { fill: "none", stroke: "#FFFFFF", "stroke-width": 10, "stroke-dasharray": "36 24", opacity: 0.5 });
      var axis = D.el(g, "path", { fill: "none", stroke: "#FFFFFF", "stroke-width": 14, "stroke-linecap": "round" });
      var head = D.el(g, "path", { fill: "#FFFFFF" });
      var pole = D.el(g, "circle", { r: 18, fill: "#FFD27A", stroke: "#2B3440", "stroke-width": 4 });
      function pt(a, r) { var q = a * Math.PI / 180; return { x: C.x + Math.sin(q) * r, y: C.y - Math.cos(q) * r }; }
      function angle(t) {
        var amp = 2 + (swing - 2) * E.inOut(prog(t, at, at + 2));
        return base + amp * Math.sin(t * 2.6); // the drawn tilt (23.4 degrees compressed to fit the limb view)
      }
      function update(t) {
        var a = angle(t), s0 = pt(a, Rp - 260), s1 = pt(a, Rp), e = pt(a, Rp + 720);
        axisIn.setAttribute("d", "M" + r2(s0.x) + " " + r2(s0.y) + " L" + r2(s1.x) + " " + r2(s1.y));
        axis.setAttribute("d", "M" + r2(s1.x) + " " + r2(s1.y) + " L" + r2(e.x) + " " + r2(e.y));
        var q = (a) * Math.PI / 180, ux = Math.sin(q), uy = -Math.cos(q), nx = -uy, ny = ux, tip = pt(a, Rp + 800);
        head.setAttribute("d", "M" + r2(tip.x) + " " + r2(tip.y) + " L" + r2(e.x + nx * 34 - ux * 10) + " " + r2(e.y + ny * 34 - uy * 10) + " L" + r2(e.x - nx * 34 - ux * 10) + " " + r2(e.y - ny * 34 - uy * 10) + " Z");
        pole.setAttribute("cx", r2(s1.x)); pole.setAttribute("cy", r2(s1.y));
        var amp = 2 + (swing - 2) * E.inOut(prog(t, at, at + 2)), b = base, lo = pt(b - amp, Rp + 600), hi = pt(b + amp, Rp + 600);
        arc.setAttribute("d", "M" + r2(lo.x) + " " + r2(lo.y) + " A" + (Rp + 600) + " " + (Rp + 600) + " 0 0 1 " + r2(hi.x) + " " + r2(hi.y));
        arc.setAttribute("opacity", r2(0.8 * prog(t, at, at + 0.6)));
      }
      function box() { var c = pt(base, Rp + 400); return { x: c.x - 700, y: c.y - 600, width: 1400, height: 900 }; }
      update(0);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
