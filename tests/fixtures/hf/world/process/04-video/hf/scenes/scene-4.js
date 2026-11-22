/* Scene 4 custom "rain": rain falling from the base of the grey cloud (scene-3.js "cumulus", centred
 * on the `sky` anchor, base at sky.y + 90) straight back into the sea beside the boat (the water
 * line is the `surface` anchor's height). From the move's `at` the drops leave the cloud base, so a
 * rain front descends and reaches the sea about 0.4 s later; where they land, small rings spread on
 * the water. params: width (default 560, the rain shaft's width), count (default 70), speed
 * (default 1400 world px/s), wind (default 0.12: the slant, px sideways per px down).
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t (any frame, any order). */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog;
  K.customs = K.customs || {};
  K.customs.rain = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at;
      var sky = ctx.anchors.sky(0), sea = ctx.anchors.surface(0).y;
      var cx = sky.x, base = sky.y + 90 - 30, W = p.width || 560, N = p.count || 70, V = p.speed || 1400, wind = p.wind === undefined ? 0.12 : p.wind;
      var H = sea - base, LEN = 64;
      var g = D.el(layer, "g", { "data-custom": "rain" });
      var ripG = D.el(g, "g", {}), dropG = D.el(g, "g", {});
      var R = D.rng(91), drops = [], rips = [];
      for (var i = 0; i < N; i++) {
        drops.push({ x: cx - W / 2 + R() * W, ph: R(), v: V * (0.9 + R() * 0.2),
          e: D.el(dropG, "path", { stroke: i % 3 ? "#8FC3EE" : "#C6E3FA", "stroke-width": 7, "stroke-linecap": "round", fill: "none" }) });
      }
      for (var j = 0; j < 16; j++) rips.push({ x: cx - W / 2 + 40 + R() * (W - 80), ph: R(), e: D.el(ripG, "ellipse", { fill: "none", stroke: "#E6F6FF", "stroke-width": 5 }) });
      function update(t) {
        var dt = t - at, on = prog(t, at - 0.05, at + 0.1);
        drops.forEach(function (d) {
          var fallen = dt * d.v - d.ph * H * 0.5; // each drop leaves the cloud base at its own moment
          if (fallen <= 0) { d.e.setAttribute("opacity", 0); return; }
          var y = base + (fallen % H);
          var x = d.x - (y - base) * wind;
          d.e.setAttribute("d", "M" + r2(x + LEN * wind) + " " + r2(y - LEN) + " L" + r2(x) + " " + r2(y));
          d.e.setAttribute("opacity", r2(0.9 * on * Math.min(1, (y - base) / 60)));
        });
        // rings on the sea where the rain lands (from when the front reaches the water)
        var landed = at + H / V;
        rips.forEach(function (rp) {
          var u = ((t - landed) / 0.9 + rp.ph) % 1;
          if (t < landed) { rp.e.setAttribute("opacity", 0); return; }
          rp.e.setAttribute("cx", r2(rp.x - H * wind)); rp.e.setAttribute("cy", r2(sea + 8));
          rp.e.setAttribute("rx", r2(10 + 46 * u)); rp.e.setAttribute("ry", r2(4 + 12 * u));
          rp.e.setAttribute("opacity", r2(0.85 * (1 - u) * prog(t, landed, landed + 0.2)));
        });
      }
      function box() { return { x: cx - W / 2 - H * wind - 60, y: base, width: W + 120 + H * wind, height: H + 30 }; }
      update(0);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
