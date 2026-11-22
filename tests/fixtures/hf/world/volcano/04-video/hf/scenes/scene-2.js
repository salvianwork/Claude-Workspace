/* Scene 2 custom "eruption" (adapted from the prop library's volcano: burst, flow and grow
 * phases). The vent is full of magma from the start. At the move's `at` the magma bursts out of
 * the crater: a lava fountain of glowing bombs on ballistic arcs and an ash plume; lava then runs
 * down both slopes (from at + params.flow, default 0.5 s, for 2.6 s), cools from yellow to dark
 * rock (from at + params.cool, over 2 s) and hardens into a new dark layer along the whole cone
 * (from at + params.grow, over 1.4 s). Seconds are relative to `at` (the burst word) and come from
 * the narration's word times ("cools", "grows"). params.vent false leaves the vent to a
 * "magma-rise" piece in the same scene (the recap). Contract as the kit's effects: world px on the
 * effects layer, update a pure function of t, box(t) what is visible. */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, EP = K.effectPath, E = D.ease, clamp = D.clamp, prog = D.prog;
  K.customs = K.customs || {};

  function eruption(layer, ctx) {
    var p = ctx.params || {}, at = ctx.at, id = ctx.idPrefix;
    var tFlow = at + (p.flow === undefined ? 0.5 : p.flow), tCool = at + (p.cool === undefined ? 3 : p.cool), tGrow = at + (p.grow === undefined ? 4.8 : p.grow);
    var V = K.places.volcano, crater = ctx.anchors.crater(0);
    var vent = EP.sampled(ctx.paths.vent);
    var R = D.rng(11);
    var g = D.el(layer, "g", { "data-custom": "eruption" });
    var defs = D.el(g, "defs");
    function rad(name, stops) {
      var gr = D.el(defs, "radialGradient", { id: id + "-" + name, cx: 0.5, cy: 0.5, r: 0.5 });
      stops.forEach(function (s) { D.el(gr, "stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] === undefined ? 1 : s[2] }); });
      return "url(#" + id + "-" + name + ")";
    }
    var glowG = rad("gl", [[0, "#FF9A3C", 0.85], [1, "#FF9A3C", 0]]);
    var puffG = rad("pf", [[0, "#A59AA2"], [0.65, "#6B5F68"], [1, "#4E444C", 0]]);
    var bl = D.el(defs, "filter", { id: id + "-blur", x: "-50%", y: "-50%", width: "200%", height: "200%" });
    D.el(bl, "feGaussianBlur", { stdDeviation: 12 });
    var path = function (pts) { return "M" + pts.map(function (q) { return r2(q[0]) + " " + r2(q[1]); }).join(" L"); };

    // the full vent of magma
    var vd = "M" + vent.map(function (q) { return r2(q.x) + " " + r2(q.y); }).join(" L");
    var ventG = D.el(g, "g", { visibility: p.vent === false ? "hidden" : "visible" });
    D.el(ventG, "path", { d: vd, fill: "none", stroke: "#FF8C1A", "stroke-width": 100, "stroke-linecap": "round", filter: "url(#" + id + "-blur)", opacity: 0.7 });
    D.el(ventG, "path", { d: vd, fill: "none", stroke: "#F2601A", "stroke-width": 46, "stroke-linecap": "round" });
    var ventCore = D.el(ventG, "path", { d: vd, fill: "none", stroke: "#FFE7A0", "stroke-width": 12, "stroke-linecap": "round" });

    // the new layer (a dark crust along the whole outline) and the two flows
    var outL = [], outR = [];
    for (var i = 0; i <= 24; i++) { outL.push(V.flank(-1, i / 24, 0)); outR.push(V.flank(1, i / 24, 0)); }
    var outline = { d: path(outL) + " " + path(outR) };
    var layerEl = D.el(g, "path", { d: outline.d, fill: "none", stroke: "#3A2622", "stroke-linejoin": "round", "stroke-linecap": "round", opacity: 0 });
    var layerEdge = D.el(g, "path", { d: outline.d, fill: "none", stroke: "#1E1210", "stroke-width": 6, "stroke-linejoin": "round", opacity: 0 });
    var flows = [-1, 1].map(function (side) {
      var pts = [];
      for (var k = 0; k <= 30; k++) pts.push(V.flank(side, 0.03 + k * 0.93 / 30, 26));
      var S = EP.sampled(pts.map(function (q) { return { x: q[0], y: q[1] }; }));
      return {
        S: S, L: S[S.length - 1].s,
        glow: D.el(g, "path", { fill: "none", stroke: "#FF8C1A", "stroke-width": 70, "stroke-linecap": "round", filter: "url(#" + id + "-blur)" }),
        hot: D.el(g, "path", { fill: "none", stroke: "#FF9F1C", "stroke-width": 40, "stroke-linecap": "round" }),
        core: D.el(g, "path", { fill: "none", stroke: "#FFE08A", "stroke-width": 13, "stroke-linecap": "round" }),
        cool: D.el(g, "path", { fill: "none", stroke: "#4A2A22", "stroke-width": 40, "stroke-linecap": "round", opacity: 0 }),
      };
    });

    var craterGlow = D.el(g, "ellipse", { cx: crater.x, cy: crater.y, rx: 420, ry: 190, fill: glowG, opacity: 0 });
    var plumeG = D.el(g, "g", {});
    var puffs = [];
    for (var q = 0; q < 40; q++) puffs.push({ t0: q * 0.13 + R() * 0.08, vx: (R() - 0.4) * 220, vy: 520 + R() * 320, r0: 140 + R() * 90, el: D.el(plumeG, "circle", { fill: puffG, r: 0 }) });
    var bombG = D.el(g, "g", {});
    var bombs = [];
    for (var m = 0; m < 150; m++) {
      var big = m < 45;
      bombs.push({ t0: big ? R() * 0.35 : 0.35 + R() * 3.4, vx: (R() - 0.5) * (big ? 1800 : 1150), vy: (big ? 2400 : 1700) + R() * 1000, r: 16 + R() * 28, el: D.el(bombG, "circle", { r: 0 }) });
    }

    function drawOn(e, S, L, u) {
      var h = L * u, pts = [S[0]];
      S.forEach(function (c) { if (c.s > 0 && c.s < h) pts.push(c); });
      pts.push(EP.pointAt(S, Math.max(0.01, h)));
      e.setAttribute("d", "M" + pts.map(function (c) { return r2(c.x) + " " + r2(c.y); }).join(" L"));
    }
    function update(t) {
      ventCore.setAttribute("opacity", r2(0.6 + 0.3 * Math.sin(t * 7)));
      var erupt = prog(t, at - 0.1, at + 0.25);
      craterGlow.setAttribute("opacity", r2(erupt * (0.85 + 0.15 * Math.sin(t * 14)) * (1 - 0.5 * prog(t, tGrow, tGrow + 1.5))));
      puffs.forEach(function (pf) {
        var a = t - at + 0.1 - pf.t0;
        if (!(a >= 0)) { pf.el.setAttribute("r", 0); pf.el.setAttribute("opacity", 0); return; }
        var up = pf.vy * a * (1 - 0.06 * a);
        pf.el.setAttribute("cx", r2(crater.x + pf.vx * a));
        pf.el.setAttribute("cy", r2(crater.y - 20 - up));
        pf.el.setAttribute("r", r2(pf.r0 * (0.4 + Math.min(1, a * 2.2)) + 120 * a));
        pf.el.setAttribute("opacity", r2(clamp(a * 4) * (1 - prog(a, 3.2, 4.8)) * 0.92));
      });
      var G = 3600, life = 1.5;
      bombs.forEach(function (bm) {
        var a = t - at - bm.t0;
        if (!(a >= 0 && a <= life)) { bm.el.setAttribute("r", 0); bm.el.setAttribute("opacity", 0); return; }
        bm.el.setAttribute("cx", r2(crater.x + bm.vx * a));
        bm.el.setAttribute("cy", r2(crater.y - bm.vy * a + 0.5 * G * a * a));
        bm.el.setAttribute("r", r2(bm.r * (1 - 0.35 * (a / life))));
        var h = a / life;
        bm.el.setAttribute("fill", h < 0.3 ? "#FFE08A" : h < 0.65 ? "#FF8C1A" : "#C2381C");
        bm.el.setAttribute("opacity", r2(1 - prog(a, life - 0.25, life)));
      });
      var fl = E.inOut(prog(t, tFlow, tFlow + 2.6)), cool = prog(t, tCool, tCool + 2);
      flows.forEach(function (f) {
        [f.glow, f.hot, f.core, f.cool].forEach(function (e) { drawOn(e, f.S, f.L, fl); e.setAttribute("visibility", fl > 0 ? "visible" : "hidden"); });
        f.hot.setAttribute("opacity", r2(1 - 0.7 * cool));
        f.core.setAttribute("opacity", r2((0.85 + 0.15 * Math.sin(t * 7)) * (1 - cool)));
        f.glow.setAttribute("opacity", r2(0.7 * (1 - 0.8 * cool)));
        f.cool.setAttribute("opacity", r2(0.85 * cool));
      });
      var grow = E.inOut(prog(t, tGrow, tGrow + 1.4));
      layerEl.setAttribute("stroke-width", r2(8 + 52 * grow)); layerEl.setAttribute("opacity", r2(grow));
      layerEdge.setAttribute("opacity", r2(0.8 * grow));
    }
    function box(t) {
      var x0 = 1200, x1 = 3400, y0 = t >= at ? 0 : 520;
      return { x: x0, y: y0, width: x1 - x0, height: 1900 - y0 };
    }
    update(at - 1);
    return { update: update, box: box };
  }

  K.customs.eruption = { mount: eruption };
})(typeof globalThis !== "undefined" ? globalThis : window);
