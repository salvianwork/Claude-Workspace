/* Scene 3 custom "wave-hit" (used again in scene 4): light as a wave meeting the molecules of the
 * air, drawn large in the sky around the place's `sky` anchor. Seven air molecules (pairs of
 * touching balls, like nitrogen and oxygen; seeded, the same in every scene) float there, the
 * middle one at the anchor. From the move's `at` a short packet of light waves (params.color,
 * params.wavelength world px, about 420 px long) travels in from the left and reaches the middle
 * molecule at params.hit (scene seconds).
 *   params.scatter true (blue light): the packet is absorbed and the molecule flashes; eight small
 *   wavy arrows of the same colour fly off in every direction and two rings spread.
 *   params.scatter false (red light): the packet passes straight through and carries on to the right;
 *   the molecule barely stirs, and one faint wavelet leaves it (most of the red goes straight on).
 * params.scale (default 1) enlarges the molecules, waves and arrows so they read on a phone;
 * params.spread (default 1) spreads the other molecules further out; params.packet (default 420 x scale)
 * is the wave packet's length and params.from (default 700 x spread) how far left of the middle
 * molecule it starts. Sizes are not to scale (a molecule is thousands of times smaller than a light wave).
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t (seeded random only). */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog, E = D.ease;
  K.customs = K.customs || {};
  function molecule(parent, x, y, s) {
    var g = D.el(parent, "g", { transform: "translate(" + r2(x) + " " + r2(y) + ")" });
    var m = D.el(g, "g", {});
    D.el(m, "circle", { cx: -26 * s, cy: 0, r: 30 * s, fill: "#9FB8D9", stroke: "#3E5878", "stroke-width": 5 * s });
    D.el(m, "circle", { cx: 26 * s, cy: 0, r: 30 * s, fill: "#B7CCE6", stroke: "#3E5878", "stroke-width": 5 * s });
    D.el(m, "circle", { cx: -34 * s, cy: -10 * s, r: 8 * s, fill: "#FFFFFF", opacity: 0.8 });
    return { g: g, m: m, x: x, y: y };
  }
  K.customs["wave-hit"] = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, id = ctx.idPrefix, c = ctx.anchors.sky(0);
      var k = p.scale || 1, col = p.color || "#2F7BFF", wl = (p.wavelength || 70) * k, amp = (p.amp || 42) * k, hit = p.hit === undefined ? at + 2 : p.hit;
      var scatter = p.scatter !== false, sp = p.spread || 1, PK = p.packet || 420 * k, x0 = c.x - (p.from || 700 * sp);
      var speed = (c.x - x0) / Math.max(0.5, hit - at);
      var g = D.el(layer, "g", { "data-custom": "wave-hit" });
      var defs = D.el(g, "defs");
      var bl = D.el(defs, "filter", { id: id + "-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" });
      D.el(bl, "feGaussianBlur", { stdDeviation: 10 });
      var R = D.rng(77), mols = [];
      // the air molecules sit around and above the hit one, so none lands on the caption band below it
      [[-380, -330], [330, -380], [-470, -110], [420, -140], [-120, -480], [160, -600]].forEach(function (o, i) {
        mols.push(molecule(g, c.x + (o[0] + (R() - 0.5) * 60) * sp, c.y + (o[1] + (R() - 0.5) * 60) * sp, (0.8 + R() * 0.25) * k));
      });
      var flash = D.el(g, "circle", { cx: c.x, cy: c.y, r: 90 * k, fill: col, opacity: 0, filter: "url(#" + id + "-glow)" });
      var mid = molecule(g, c.x, c.y, 1.1 * k);
      var glowW = D.el(g, "path", { fill: "none", stroke: col, "stroke-width": 26 * k, opacity: 0, filter: "url(#" + id + "-glow)" });
      var wave = D.el(g, "path", { fill: "none", stroke: col, "stroke-width": 12 * k, "stroke-linecap": "round", opacity: 0 });
      var rings = [0, 1].map(function () { return D.el(g, "circle", { cx: c.x, cy: c.y, r: 60 * k, fill: "none", stroke: col, "stroke-width": 8 * k, opacity: 0 }); });
      var N = scatter ? 8 : 1, arrows = [];
      for (var i = 0; i < N; i++) {
        var a = scatter ? (i / N) * 2 * Math.PI + 0.2 : -0.5;
        arrows.push({ a: a, w: D.el(g, "path", { fill: "none", stroke: col, "stroke-width": 9 * k, "stroke-linecap": "round", opacity: 0 }), h: D.el(g, "path", { fill: col, opacity: 0 }) });
      }
      function wavePath(xa, xb, y, phase) {
        var d = "", n = Math.max(2, Math.ceil((xb - xa) / 6));
        for (var q = 0; q <= n; q++) { var x = xa + (xb - xa) * q / n; d += (q ? " L" : "M") + r2(x) + " " + r2(y - amp * Math.sin(2 * Math.PI * (x - phase) / wl)); }
        return d;
      }
      function update(t) {
        var head = x0 + speed * (t - at), on = t >= at;
        var xb = head, xa = head - PK, show = on;
        if (scatter) { if (xb > c.x) xb = c.x; show = on && xa < c.x - 10; }
        var fade = scatter ? 1 : 1 - prog(t, hit + 2.2, hit + 3);
        if (show && xb > xa) {
          var d = wavePath(Math.max(xa, x0 - 10), xb, c.y, head);
          wave.setAttribute("d", d); glowW.setAttribute("d", d);
          var o = prog(t, at, at + 0.3) * fade;
          wave.setAttribute("opacity", r2(o)); glowW.setAttribute("opacity", r2(0.45 * o));
        } else { wave.setAttribute("opacity", 0); glowW.setAttribute("opacity", 0); }
        var a = t - hit;
        if (scatter) {
          flash.setAttribute("opacity", r2(a < 0 ? 0 : 0.8 * Math.sin(Math.PI * Math.min(1, a / 0.6))));
          mid.m.setAttribute("transform", a < 0 || a > 1 ? "" : "rotate(" + r2(10 * Math.sin(a * 18) * (1 - a)) + ")");
        } else mid.m.setAttribute("transform", a < 0 || a > 1 ? "" : "rotate(" + r2(3 * Math.sin(a * 14) * (1 - a)) + ")");
        rings.forEach(function (rg, k) {
          var u = prog(a - k * 0.35, 0, 1.4);
          rg.setAttribute("r", r2((60 + 420 * E.outCubic(u)) * k));
          rg.setAttribute("opacity", r2(scatter && a - k * 0.35 > 0 ? 0.6 * (1 - u) : 0));
        });
        arrows.forEach(function (ar) {
          var u = prog(a, 0.05, 1.6), dist = (80 + 360 * E.outCubic(u)) * k, len = 130 * k;
          var o = a < 0.05 ? 0 : (scatter ? 1 : 0.35) * (1 - prog(a, 2.4, 3.2));
          var ux = Math.cos(ar.a), uy = Math.sin(ar.a), nx = -uy, ny = ux, d = "";
          for (var j = 0; j <= 16; j++) {
            var s = dist - len + len * j / 16, w = 12 * k * Math.sin(2 * Math.PI * s / (wl * 0.9) - a * 8);
            d += (j ? " L" : "M") + r2(c.x + ux * s + nx * w) + " " + r2(c.y + uy * s + ny * w);
          }
          ar.w.setAttribute("d", d); ar.w.setAttribute("opacity", r2(o));
          var tx = c.x + ux * (dist + 26 * k), ty = c.y + uy * (dist + 26 * k), bx = c.x + ux * dist, by = c.y + uy * dist;
          ar.h.setAttribute("d", "M" + r2(tx) + " " + r2(ty) + " L" + r2(bx + nx * 18 * k) + " " + r2(by + ny * 18 * k) + " L" + r2(bx - nx * 18 * k) + " " + r2(by - ny * 18 * k) + " Z");
          ar.h.setAttribute("opacity", r2(o));
        });
      }
      function box() { var w = Math.max(720 * sp, 440 * k); return { x: c.x - w, y: c.y - w, width: 2 * w, height: 2 * w }; }
      update(at - 1);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
