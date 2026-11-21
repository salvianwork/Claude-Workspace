/* Kit scene "diagram": 2-5 icon nodes joined by arrows, as a flow (left to right), a cycle (round
 * a loop) or a hub (first node in the middle). Nodes pop in on their cue words, each arrow draws
 * itself into its node and glowing dots keep flowing along finished arrows.
 * props {title? (<= 60), layout: "flow"|"cycle"|"hub", nodes: 2..5 of {label (<= 18), icon?}};
 * cues "node" {index}, "link" {index}. Anchors: title, node-i. */
(function (root) {
  "use strict";
  var K = root.HFKit, S = K.sceneKit, D = K.draw;
  var LAYOUTS = ["flow", "cycle", "hub"];

  function links(layout, n) {
    var out = [];
    if (layout === "hub") for (var i = 1; i < n; i++) out.push([0, i]);
    else { for (var j = 0; j + 1 < n; j++) out.push([j, j + 1]); if (layout === "cycle" && n > 2) out.push([n - 1, 0]); }
    return out;
  }

  function geometry(p, box, style) {
    var boxes = [], fonts = [], anchors = {};
    var tg = S.titleGeom(p.title, box);
    if (tg) { boxes.push(Object.assign({ name: "title" }, tg)); fonts.push({ name: "title", size: tg.size }); anchors.title = { x: tg.x + tg.width / 2, y: tg.y + tg.height / 2 }; }
    var top = tg ? tg.bar.y + 36 : box.y, bottom = box.y + box.height, n = p.nodes.length;
    var areaW = box.width, areaH = bottom - top;
    var flow = p.layout === "flow";
    var labelW = flow ? Math.min(320, areaW / n - 24) : Math.min(320, areaW / 3.2);
    var size = 38;
    p.nodes.forEach(function (nd) { size = Math.min(size, S.fitText(nd.label, labelW, S.range(38, 32, 2), 2, "body").size); });
    var lines = Math.max.apply(null, p.nodes.map(function (nd) { return S.lineCount(nd.label, size, labelW, "body"); }));
    var labelH = Math.ceil(size * 1.2 * lines);
    var disc = Math.round(Math.min(flow ? 140 : 120, (areaW / n) * 0.5, areaH * 0.3));
    var pts = [];
    if (flow) {
      var cw = areaW / n, gy = top + (areaH - (disc + 18 + labelH)) / 2 + disc / 2;
      for (var i = 0; i < n; i++) pts.push({ x: box.x + cw * (i + 0.5), y: gy });
    } else {
      var hub = p.layout === "hub";
      var cx = box.x + areaW / 2, cy, a, k;
      if (hub) {
        // a fan: the hub low in the middle, the others on an arc above it, labels above them
        var m = n - 1;
        cy = bottom - labelH - 18 - disc * 0.575;
        var ryH = Math.max(60, cy - top - labelH - 18 - disc / 2);
        var rxH = Math.max(ryH, areaW / 2 - labelW / 2 - 6);
        pts.push({ x: cx, y: cy });
        for (k = 0; k < m; k++) {
          a = (m === 1 ? -90 : -160 + 140 * k / (m - 1)) * Math.PI / 180;
          pts.push({ x: D.r2(cx + rxH * Math.cos(a)), y: D.r2(cy + ryH * Math.sin(a)) });
        }
      } else {
        var ry = Math.max(60, (areaH - disc - 18 - labelH) / 2);
        var rx = Math.max(ry, areaW / 2 - labelW / 2 - 6);
        cy = top + disc / 2 + ry;
        for (k = 0; k < n; k++) {
          a = -Math.PI / 2 + (2 * Math.PI * k) / n;
          pts.push({ x: D.r2(cx + rx * Math.cos(a)), y: D.r2(cy + ry * Math.sin(a)) });
        }
      }
      anchors.hub = { x: cx, y: cy };
    }
    var nodes = p.nodes.map(function (nd, i) {
      var q = pts[i];
      // hub: outer labels sit on the outer side of their node, away from the links
      var above = p.layout === "hub" && i > 0 && q.y < anchors.hub.y - 1;
      var label = { x: q.x - labelW / 2, y: above ? q.y - disc / 2 - 18 - labelH : q.y + disc / 2 + 18, width: labelW, height: labelH };
      boxes.push({ name: "disc-" + i, x: q.x - disc / 2, y: q.y - disc / 2, width: disc, height: disc }, Object.assign({ name: "label-" + i }, label));
      fonts.push({ name: "label-" + i, size: size });
      anchors["node-" + i] = { x: q.x, y: q.y };
      return { cx: q.x, cy: q.y, label: label, text: nd.label, icon: nd.icon };
    });
    var L = links(p.layout, n).map(function (pair) {
      var a = nodes[pair[0]], b = nodes[pair[1]];
      var dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      var gap = disc / 2 + 16;
      var p0 = [a.cx + ux * gap, a.cy + uy * gap], p3 = [b.cx - ux * (gap + 6), b.cy - uy * (gap + 6)];
      var bend = p.layout === "cycle" ? 0.22 * d : 0;
      // bend outward (away from the loop's centre) for a cycle
      var mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2, ox = -uy, oy = ux;
      if (anchors.hub && (mx + ox - anchors.hub.x) * ox + (my + oy - anchors.hub.y) * oy < 0) { ox = -ox; oy = -oy; }
      var c1 = [D.lerp(p0[0], p3[0], 1 / 3) + ox * bend, D.lerp(p0[1], p3[1], 1 / 3) + oy * bend];
      var c2 = [D.lerp(p0[0], p3[0], 2 / 3) + ox * bend, D.lerp(p0[1], p3[1], 2 / 3) + oy * bend];
      return { from: pair[0], to: pair[1], curve: D.cubic(p0, c1, c2, p3) };
    });
    return { geom: { title: tg, nodes: nodes, links: L, disc: disc, size: size, layout: p.layout }, boxes: boxes, fonts: fonts, anchors: anchors };
  }

  function reveal(o, duration) {
    var p = o.props, n = p.nodes.length, ls = links(p.layout, n);
    var r = S.planReveals({ node: n }, o.cues, o.words, duration, o.sceneId);
    var cued = [];
    (o.cues || []).forEach(function (c) { if (c.show === "link") cued[c.index || 0] = K.wordTime(o.words, c.at, o.sceneId); });
    r.link = ls.map(function (pair, i) {
      if (typeof cued[i] === "number") return cued[i];
      var tFrom = r.node[pair[0]], tTo = r.node[pair[1]];
      return pair[1] === 0 ? tFrom + 0.7 : Math.max(tFrom + 0.3, tTo - 0.35); // closing link after the last node
    });
    return r;
  }

  function render(ctx) {
    var g = ctx.plan.geom, st = ctx.style, stage = ctx.stage, rev = ctx.plan.reveal;
    var title = S.titleBlock(stage, g.title, st, 0.15);
    var svg = D.svgRoot(stage, K.CANVAS.width, K.CANVAS.height, { style: "position:absolute;left:0;top:0" });
    var id = D.uid("diag");
    var glow = D.blurFilter(svg.defs, id + "g", 5);
    var links = g.links.map(function (l, i) {
      var base = D.el(svg.svg, "path", { d: l.curve.d, fill: "none", stroke: D.alpha(st.colors.text, 0.1), "stroke-width": 8, "stroke-linecap": "round" });
      var line = D.el(svg.svg, "path", { d: l.curve.d, fill: "none", stroke: D.alpha(st.colors.primary, 0.9), "stroke-width": 6, "stroke-linecap": "round" });
      var head = D.el(svg.svg, "path", { d: "M0 -13 L22 0 L0 13 Z", fill: st.colors.primary });
      var dots = [0, 1, 2].map(function () {
        return { halo: D.el(svg.svg, "circle", { r: 10, fill: st.colors.accent, filter: glow, opacity: 0 }), core: D.el(svg.svg, "circle", { r: 5.5, fill: "#FFF8EF", opacity: 0 }) };
      });
      return { l: l, base: base, line: line, head: head, dots: dots };
    });
    var nodes = g.nodes.map(function (nd, i) {
      var wrap = S.div(stage, "hf-node", { x: 0, y: 0, width: K.CANVAS.width, height: K.CANVAS.height });
      wrap.dataset.key = "node-" + i;
      wrap.style.transformOrigin = nd.cx + "px " + nd.cy + "px";
      var hubNode = g.layout === "hub" && i === 0;
      var disc = S.iconDisc(wrap, nd.cx, nd.cy, g.disc * (hubNode ? 1.15 : 1), { style: st, icon: nd.icon, number: nd.icon ? undefined : i + 1, color: hubNode || i % 2 ? st.colors.accent : st.colors.primary });
      var label = S.text(wrap, nd.text, nd.label, { style: st, size: g.size, align: "center", weight: 600, lineHeight: 1.2 });
      return { wrap: wrap, disc: disc, label: label };
    });
    return function (t) {
      title(t);
      links.forEach(function (k, i) {
        var t1 = rev.link[i];
        var u = D.ease.inOut(D.prog(t, t1 - 0.25, t1 + 0.45));
        var len = k.l.curve.length;
        D.drawOn(k.line, len, u);
        k.base.setAttribute("opacity", D.r2(D.prog(t, t1 - 0.25, t1 + 0.2)));
        var tip = k.l.curve.atLength(len * u), back = k.l.curve.atLength(Math.max(0, len * u - 4));
        var ang = Math.atan2(tip.y - back.y, tip.x - back.x) * 180 / Math.PI;
        k.head.setAttribute("transform", "translate(" + D.r2(tip.x) + " " + D.r2(tip.y) + ") rotate(" + D.r2(ang) + ") scale(" + D.r2(D.prog(u, 0, 0.3)) + ")");
        k.head.setAttribute("opacity", u > 0.01 ? 1 : 0);
        var flowing = D.prog(t, t1 + 0.45, t1 + 0.9);
        k.dots.forEach(function (d, j) {
          var f = ((t - t1) * 0.55 + j / 3) % 1;
          if (f < 0) f += 1;
          var q = k.l.curve.atLength(len * f);
          var o = flowing * Math.sin(Math.PI * f);
          d.halo.setAttribute("cx", q.x); d.halo.setAttribute("cy", q.y); d.halo.setAttribute("opacity", D.r2(0.8 * o));
          d.core.setAttribute("cx", q.x); d.core.setAttribute("cy", q.y); d.core.setAttribute("opacity", D.r2(o));
        });
      });
      var latest = -1;
      for (var i = 0; i < nodes.length; i++) if (t >= rev.node[i] && (latest < 0 || rev.node[i] >= rev.node[latest])) latest = i;
      nodes.forEach(function (it, i) {
        var s = D.buildIn(t, rev.node[i], 0.55, 24);
        it.wrap.style.opacity = D.r2(s.opacity);
        it.wrap.style.filter = s.blur > 0.05 ? "blur(" + D.r2(s.blur) + "px)" : "none";
        it.wrap.style.transform = "translateY(" + D.r2(s.y + 4 * D.wobble(t * 0.8, i + 4) * s.k) + "px) scale(" + Math.round((0.7 + 0.3 * D.ease.outBack(s.k)) * 1000) / 1000 + ")";
        var act = i === latest ? D.prog(t, rev.node[i], rev.node[i] + 0.4) : 0.25;
        it.disc.setActive(act * (0.85 + 0.15 * Math.sin(t * 2.6 + i)));
        it.disc.setRing(D.ease.inOut(D.prog(t, rev.node[i] + 0.1, rev.node[i] + 0.9)));
      });
    };
  }

  S.register({
    name: "diagram",
    meta: { description: "2-5 icon nodes joined by drawn arrows with flowing dots: flow (left to right), cycle (a loop) or hub (first node in the middle).", cues: ["node", "link"],
      props: { title: "text <= 60", layout: "flow | cycle | hub (required)", nodes: "2..5 of {label <= 18, icon?}" }, anchors: ["title", "node-<i>", "hub", "center"] },
    check: function (p, v) {
      v.str(p.title, "title", S.LIMITS.title);
      if (LAYOUTS.indexOf(p.layout) < 0) v.err("layout must be one of " + LAYOUTS.join(", ") + " (got " + p.layout + ")");
      if (v.list(p.nodes, "nodes", 2, S.LIMITS.items)) p.nodes.forEach(function (nd, i) {
        if (!nd || typeof nd !== "object") { v.err("nodes[" + i + "] must be {label, icon?}"); return; }
        v.str(nd.label, "nodes[" + i + "].label", 18, true);
        v.icon(nd.icon, "nodes[" + i + "].icon");
      });
    },
    counts: function (p) {
      var n = Array.isArray(p && p.nodes) ? p.nodes.length : 0;
      return { node: n, link: LAYOUTS.indexOf(p && p.layout) >= 0 ? links(p.layout, n).length : 0 };
    },
    geometry: geometry,
    reveal: reveal,
    render: render,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
