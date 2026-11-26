/* Scene 5 custom "sky-rays": blue light reaching an onlooker from every part of the sky. Around the
 * eye point (the place anchor params.anchor, default `rail-near`, raised by params.eye world px,
 * default 380: the head of an actor standing there) 15 thin blue rays come in from points spread
 * over the sky above (an arc of params.radius world px, default 1100, from 200 to 340 degrees), each
 * carrying bright dashes of light toward the eye; they appear one after another over 1.2 s from the
 * move's `at`, and a soft blue glow gathers at the eye.
 * Contract: HFKit.customs[name] = {mount(layer, ctx) -> {update(t), box(t)}}; world px on the
 * effects layer; update is a pure function of t. */
(function (root) {
  "use strict";
  var K = root.HFKit, D = K.draw, r2 = D.r2, prog = D.prog;
  K.customs = K.customs || {};
  K.customs["sky-rays"] = {
    mount: function (layer, ctx) {
      var p = ctx.params || {}, at = ctx.at, id = ctx.idPrefix, an = ctx.anchors[p.anchor || "rail-near"](0);
      var E0 = { x: an.x, y: an.y - (p.eye === undefined ? 380 : p.eye) }, RR = p.radius || 1100, N = 15;
      var g = D.el(layer, "g", { "data-custom": "sky-rays" });
      var defs = D.el(g, "defs");
      var gr = D.el(defs, "radialGradient", { id: id + "-eye", cx: 0.5, cy: 0.5, r: 0.5 });
      [[0, "#9FD3FF", 0.7], [1, "#9FD3FF", 0]].forEach(function (s) { D.el(gr, "stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] }); });
      var glow = D.el(g, "circle", { cx: E0.x, cy: E0.y, r: 170, fill: "url(#" + id + "-eye)", opacity: 0 });
      var rays = [];
      for (var i = 0; i < N; i++) {
        var a = (200 + 140 * i / (N - 1)) * Math.PI / 180, S = { x: E0.x + Math.cos(a) * RR, y: E0.y + Math.sin(a) * RR };
        var len = Math.hypot(S.x - E0.x, S.y - E0.y) - 90, ux = (E0.x - S.x) / (len + 90), uy = (E0.y - S.y) / (len + 90);
        var line = D.el(g, "path", { d: "M" + r2(S.x) + " " + r2(S.y) + " L" + r2(S.x + ux * len) + " " + r2(S.y + uy * len), stroke: "#4FA3FF", "stroke-width": 7, opacity: 0, "stroke-dasharray": "2 18", "stroke-linecap": "round" });
        var dash = D.el(g, "path", { stroke: "#E3F2FF", "stroke-width": 14, "stroke-linecap": "round", opacity: 0 });
        rays.push({ S: S, ux: ux, uy: uy, len: len, line: line, dash: dash, t0: at + 1.2 * ((i * 7) % N) / N, ph: (i * 0.37) % 1 });
      }
      function update(t) {
        rays.forEach(function (r) {
          var o = prog(t, r.t0, r.t0 + 0.3);
          r.line.setAttribute("opacity", r2(0.85 * o));
          var u = ((t - r.t0) * 0.9 + r.ph) % 1, s = r.len * u;
          var x1 = r.S.x + r.ux * s, y1 = r.S.y + r.uy * s, x0 = x1 - r.ux * 90, y0 = y1 - r.uy * 90;
          r.dash.setAttribute("d", "M" + r2(x0) + " " + r2(y0) + " L" + r2(x1) + " " + r2(y1));
          r.dash.setAttribute("opacity", r2(t < r.t0 ? 0 : o * Math.min(1, u * 5)));
        });
        glow.setAttribute("opacity", r2(prog(t, at + 0.6, at + 1.6)));
      }
      function box(t) { return t < at ? { x: E0.x, y: E0.y, width: 0, height: 0 } : { x: E0.x - RR, y: E0.y - RR, width: 2 * RR, height: RR }; }
      update(at - 1);
      return { update: update, box: box };
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
