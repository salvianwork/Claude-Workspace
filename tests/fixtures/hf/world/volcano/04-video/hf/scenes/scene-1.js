/* Scene 1 custom "magma-rise" (adapted from the prop library's volcano: its rise phase): from the
 * move's `at`, molten magma climbs out of the chamber up the place's `vent` path, accelerating,
 * with a bright glowing tip, and stays in the vent to the end of the scene (it waits under the
 * crater: the eruption is scene 2). params.duration: seconds to reach the crater (default 2.2).
 * Contract: HFKit.customs[name] = {mount(layer, {params, at, until, idPrefix, paths, ...}) ->
 * {update(t), box(t)}}, world px on the effects layer; update is a pure function of t. */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, EP = K.effectPath;
  K.customs = K.customs || {};

  function magmaRise(layer, ctx) {
    var p = ctx.params || {}, at = ctx.at, dur = p.duration || 2.2, id = ctx.idPrefix;
    var S = EP.sampled(ctx.paths.vent), L = S[S.length - 1].s;
    var g = D.el(layer, "g", { "data-custom": "magma-rise" });
    var defs = D.el(g, "defs");
    var lg = D.el(defs, "linearGradient", { id: id + "-mg", x1: 0, y1: 1, x2: 0, y2: 0, gradientUnits: "objectBoundingBox" });
    [[0, "#D1361B"], [0.6, "#FF8C1A"], [1, "#FFE08A"]].forEach(function (s) { D.el(lg, "stop", { offset: s[0], "stop-color": s[1] }); });
    var bl = D.el(defs, "filter", { id: id + "-blur", x: "-50%", y: "-50%", width: "200%", height: "200%" });
    D.el(bl, "feGaussianBlur", { stdDeviation: 16 });
    var glow = D.el(g, "path", { fill: "none", stroke: "#FF8C1A", "stroke-width": 110, "stroke-linecap": "round", filter: "url(#" + id + "-blur)", opacity: 0 });
    var body = D.el(g, "path", { fill: "none", stroke: "url(#" + id + "-mg)", "stroke-width": 46, "stroke-linecap": "round" });
    var core = D.el(g, "path", { fill: "none", stroke: "#FFE7A0", "stroke-width": 12, "stroke-linecap": "round", opacity: 0.8 });
    var tipGlow = D.el(g, "circle", { r: 70, fill: "#FFB347", filter: "url(#" + id + "-blur)", opacity: 0 });
    var tip = D.el(g, "circle", { r: 30, fill: "#FFF1B8", opacity: 0 });

    function u(t) { var x = D.clamp((t - at) / dur); return x * x; } // accelerating
    function dOf(h) {
      var pts = [S[0]];
      S.forEach(function (q) { if (q.s > 0 && q.s < h) pts.push(q); });
      pts.push(EP.pointAt(S, h));
      return "M" + pts.map(function (q) { return r2(q.x) + " " + r2(q.y); }).join(" L");
    }
    function update(t) {
      var k = u(t), on = t >= at && k > 0.002;
      g.setAttribute("visibility", on ? "visible" : "hidden");
      if (!on) return;
      var h = Math.max(1, L * k), d = dOf(h), head = EP.pointAt(S, h);
      [glow, body, core].forEach(function (e) { e.setAttribute("d", d); });
      glow.setAttribute("opacity", r2(0.75 + 0.1 * Math.sin(t * 5)));
      core.setAttribute("opacity", r2(0.6 + 0.3 * Math.sin(t * 7)));
      var moving = k < 1 ? 1 : 0.55;
      tip.setAttribute("cx", r2(head.x)); tip.setAttribute("cy", r2(head.y)); tip.setAttribute("r", r2(26 + 5 * Math.sin(t * 9)));
      tip.setAttribute("opacity", r2(0.95 * moving));
      tipGlow.setAttribute("cx", r2(head.x)); tipGlow.setAttribute("cy", r2(head.y)); tipGlow.setAttribute("opacity", r2(0.85 * moving));
    }
    function box(t) {
      var k = u(t);
      if (t < at || k <= 0.002) return { x: S[0].x, y: S[0].y, width: 0, height: 0 };
      var head = EP.pointAt(S, L * k);
      return { x: r2(S[0].x - 80), y: r2(head.y - 80), width: 160, height: r2(S[0].y - head.y + 160) };
    }
    update(at - 1);
    return { update: update, box: box };
  }

  K.customs["magma-rise"] = { mount: magmaRise };
})(typeof globalThis !== "undefined" ? globalThis : window);
