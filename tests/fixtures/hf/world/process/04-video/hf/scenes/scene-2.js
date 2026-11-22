/* Scene 2 custom "air-parcel": a bubble of warm, moist air lifting off the sea and climbing into the
 * sky over the sea (place ocean, variant surface). It starts small, warm orange and just above the
 * water by the `sky` anchor; over params.rise seconds from its `at` it climbs to just below where
 * the cloud will form (the `sky` anchor), and AS IT RISES it spreads out (its radius grows from
 * params.r0 to params.r1, little arrows point outward while it swells) and cools (orange to blue).
 * The physics it shows: rising air meets lower pressure, expands and so cools. A few moisture dots
 * ride inside and spread out with it; faint wavy lines trail below while it climbs.
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t (any frame, any order). */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog, E = D.ease;
  K.customs = K.customs || {};
  var WARM = "#FFB067", COOL = "#8CCBFF";
  K.customs["air-parcel"] = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, P = ctx.idPrefix;
      var rise = p.rise || 3.2, r0 = p.r0 || 80, r1 = p.r1 || 190;
      var sky = ctx.anchors.sky(0), sea = ctx.anchors.surface(0);
      var x0 = sky.x - 30, y0 = sea.y - r0 - 30, x1 = sky.x, y1 = sky.y + 150;
      var g = D.el(layer, "g", { "data-custom": "air-parcel", opacity: 0 });
      var defs = D.el(g, "defs", {});
      var grad = D.el(defs, "radialGradient", { id: P + "-air", cx: 0.42, cy: 0.38, r: 0.62 });
      var s0 = D.el(grad, "stop", { offset: 0, "stop-color": "#FFFFFF", "stop-opacity": 0.75 });
      var s1 = D.el(grad, "stop", { offset: 0.55, "stop-color": WARM, "stop-opacity": 0.5 });
      var s2 = D.el(grad, "stop", { offset: 1, "stop-color": WARM, "stop-opacity": 0.32 });
      var trails = [0, 1, 2].map(function () { return D.el(g, "path", { fill: "none", stroke: "#FFFFFF", "stroke-width": 7, "stroke-linecap": "round", opacity: 0 }); });
      var body = D.el(g, "circle", { fill: "url(#" + P + "-air)" });
      var rim = D.el(g, "circle", { fill: "none", stroke: "#FFFFFF", "stroke-width": 7, "stroke-dasharray": "26 16", opacity: 0.9 });
      var R = D.rng(31), dots = [];
      for (var i = 0; i < 14; i++) dots.push({ a: R() * 6.283, d: 0.2 + R() * 0.6, s: R() * 10, e: D.el(g, "circle", { r: 7 + R() * 4, fill: "#E8F6FF", stroke: "#5FA8E8", "stroke-width": 2 }) });
      var arrows = [0, 1, 2, 3, 4, 5].map(function (k) { return { a: k * Math.PI / 3 + 0.3, e: D.el(g, "path", { fill: "none", stroke: "#FFFFFF", "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0 }) }; });

      function state(t) {
        var u = E.inOutSine(prog(t, at, at + rise));         // how far up it has climbed
        var grow = E.inOutSine(prog(u, 0.15, 1));             // it spreads out as it rises
        return { u: u, x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, r: r0 + (r1 - r0) * grow, cool: prog(u, 0.2, 0.95), grow: grow };
      }
      function update(t) {
        var s = state(t), c = D.mix(WARM, COOL, s.cool);
        g.setAttribute("opacity", r2(prog(t, at - 0.35, at + 0.1)));
        s1.setAttribute("stop-color", c); s2.setAttribute("stop-color", c);
        body.setAttribute("cx", r2(s.x)); body.setAttribute("cy", r2(s.y)); body.setAttribute("r", r2(s.r));
        rim.setAttribute("cx", r2(s.x)); rim.setAttribute("cy", r2(s.y)); rim.setAttribute("r", r2(s.r));
        rim.setAttribute("stroke-dashoffset", r2(-t * 30));
        dots.forEach(function (d) {
          var a = d.a + D.wobble(t, d.s, 0.6) * 0.4, rr = s.r * d.d;
          d.e.setAttribute("cx", r2(s.x + Math.cos(a) * rr)); d.e.setAttribute("cy", r2(s.y + Math.sin(a) * rr));
        });
        // spreading out: chevrons just outside the rim point outward while it swells
        var swelling = Math.min(prog(s.grow, 0.05, 0.25), 1 - prog(t, at + rise + 0.4, at + rise + 1.2));
        arrows.forEach(function (ar, k) {
          var ca = Math.cos(ar.a), sa = Math.sin(ar.a), d0 = s.r + 26 + 10 * Math.sin(t * 5 + k), L = 34, W = 20;
          var tip = { x: s.x + ca * (d0 + L), y: s.y + sa * (d0 + L) }, b = { x: s.x + ca * d0, y: s.y + sa * d0 };
          ar.e.setAttribute("d", "M" + r2(b.x - sa * W) + " " + r2(b.y + ca * W) + " L" + r2(tip.x) + " " + r2(tip.y) + " L" + r2(b.x + sa * W) + " " + r2(b.y - ca * W));
          ar.e.setAttribute("opacity", r2(0.95 * swelling));
        });
        // rising: faint wavy lines below while it climbs
        var climbing = Math.min(prog(t, at, at + 0.4), 1 - prog(s.u, 0.85, 1));
        trails.forEach(function (tr, k) {
          var tx = s.x + (k - 1) * s.r * 0.45, top = s.y + s.r + 20, len = 140 + 40 * k, d = "M" + r2(tx) + " " + r2(top);
          for (var j = 1; j <= 6; j++) d += " L" + r2(tx + Math.sin(j * 1.2 + t * 4 + k) * 12) + " " + r2(top + len * j / 6);
          tr.setAttribute("d", d);
          tr.setAttribute("opacity", r2(0.5 * climbing));
        });
      }
      function box(t) { var s = state(t); return { x: s.x - s.r - 70, y: s.y - s.r - 70, width: 2 * s.r + 140, height: 2 * s.r + 260 }; }
      update(0);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
