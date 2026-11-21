/* Kit scene "steps": a process as a path of glowing stations. Each step pops in on its cue word,
 * the track draws on into it and a pulse travels along the finished track; the latest step glows.
 * props {title? (<= 60), steps: 2..5 of "text" | {text, icon?} (text <= 24)}; cue "step" {index}.
 * Anchors: title, step-0 .. step-n. */
(function (root) {
  "use strict";
  var K = root.HFKit, S = K.sceneKit, D = K.draw;
  var MAX_TEXT = 24;

  function geometry(p, box, style) {
    var boxes = [], fonts = [], anchors = {};
    var tg = S.titleGeom(p.title, box);
    if (tg) { boxes.push(Object.assign({ name: "title" }, tg)); fonts.push({ name: "title", size: tg.size }); anchors.title = { x: tg.x + tg.width / 2, y: tg.y + tg.height / 2 }; }
    var top = tg ? tg.bar.y + 40 : box.y;
    var n = p.steps.length, cw = box.width / n;
    var disc = Math.round(Math.min(190, cw * 0.6, (box.y + box.height - top) * 0.42));
    var lw = cw - 24;
    var size = 46;
    p.steps.forEach(function (it) { size = Math.min(size, S.fitText(S.itemText(it), lw, S.range(46, 32, 2), 2, "body").size); });
    var lines = Math.max.apply(null, p.steps.map(function (it) { return S.lineCount(S.itemText(it), size, lw, "body"); }));
    var lh = Math.ceil(size * 1.2 * lines);
    var group = disc + 34 + lh;
    var gy = top + Math.max(0, (box.y + box.height - top - group) / 2);
    var nodes = p.steps.map(function (it, i) {
      var cx = box.x + cw * (i + 0.5), cy = gy + disc / 2;
      boxes.push({ name: "disc-" + i, x: cx - disc / 2, y: gy, width: disc, height: disc });
      var label = { x: cx - lw / 2, y: gy + disc + 34, width: lw, height: lh };
      boxes.push(Object.assign({ name: "label-" + i }, label));
      fonts.push({ name: "label-" + i, size: size });
      anchors["step-" + i] = { x: cx, y: cy };
      return { cx: cx, cy: cy, label: label, text: S.itemText(it), icon: S.itemIcon(it) };
    });
    return { geom: { title: tg, nodes: nodes, disc: disc, size: size }, boxes: boxes, fonts: fonts, anchors: anchors };
  }

  function render(ctx) {
    var g = ctx.plan.geom, st = ctx.style, stage = ctx.stage, rev = ctx.plan.reveal.step;
    var n = g.nodes.length, r = g.disc / 2;
    var title = S.titleBlock(stage, g.title, st, 0.15);
    var svg = D.svgRoot(stage, K.CANVAS.width, K.CANVAS.height, { style: "position:absolute;left:0;top:0" });
    var gid = D.uid("steps");
    var glow = D.blurFilter(svg.defs, gid + "b", 6);
    var y = g.nodes[0].cy;
    var x0 = g.nodes[0].cx, x1 = g.nodes[n - 1].cx;
    var track = D.el(svg.svg, "line", { x1: x0, y1: y, x2: x1, y2: y, stroke: D.alpha(st.colors.text, 0.12), "stroke-width": 10, "stroke-linecap": "round" });
    var fillGlow = D.el(svg.svg, "line", { x1: x0, y1: y, x2: x0, y2: y, stroke: st.colors.accent, "stroke-width": 16, "stroke-linecap": "round", filter: glow, opacity: 0.6 });
    var fill = D.el(svg.svg, "line", { x1: x0, y1: y, x2: x0, y2: y, stroke: st.colors.accent, "stroke-width": 10, "stroke-linecap": "round" });
    var pulse = D.el(svg.svg, "circle", { r: 9, fill: "#FFF8EF", cy: y, filter: glow });
    var pulseCore = D.el(svg.svg, "circle", { r: 6, fill: "#FFF8EF", cy: y });
    var items = g.nodes.map(function (nd, i) {
      var wrap = S.div(stage, "hf-step", { x: 0, y: 0, width: K.CANVAS.width, height: K.CANVAS.height });
      wrap.dataset.key = "step-" + i;
      wrap.style.transformOrigin = nd.cx + "px " + nd.cy + "px";
      var disc = S.iconDisc(wrap, nd.cx, nd.cy, g.disc, { style: st, icon: nd.icon, number: nd.icon ? undefined : i + 1, color: i % 2 ? st.colors.accent : st.colors.primary });
      var badge = null;
      if (nd.icon) {
        badge = S.div(wrap, "hf-badge", { x: nd.cx + r * 0.62 - 22, y: nd.cy - r * 0.62 - 22, width: 44, height: 44 }, {
          borderRadius: "50%", background: st.colors.background, border: "3px solid " + st.colors.accent, color: st.colors.text, boxSizing: "border-box",
          fontFamily: st.fonts.heading, fontWeight: "800", fontSize: "22px", display: "flex", alignItems: "center", justifyContent: "center" });
        badge.textContent = String(i + 1);
      }
      var label = S.text(wrap, nd.text, nd.label, { style: st, size: g.size, align: "center", weight: 600, lineHeight: 1.2 });
      return { wrap: wrap, disc: disc, label: label, badge: badge };
    });
    var reached = function (t) { // track length drawn: it reaches disc i as step i appears
      var x = x0;
      for (var i = 1; i < n; i++) {
        var k = D.ease.inOut(D.prog(t, rev[i] - 0.45, rev[i] + 0.05));
        x = D.lerp(x, g.nodes[i].cx, k);
        if (k < 1) break;
      }
      return x;
    };
    return function (t) {
      title(t);
      var xr = reached(t);
      fill.setAttribute("x2", D.r2(xr)); fillGlow.setAttribute("x2", D.r2(xr));
      // the faint track only runs as far as the next step that is coming
      var next = n - 1;
      for (var q = 1; q < n; q++) if (t < rev[q] - 0.45) { next = q; break; }
      var ahead = g.nodes[Math.min(n - 1, Math.max(1, next))].cx;
      track.setAttribute("x2", D.r2(Math.max(xr, D.lerp(x0, ahead, D.ease.inOut(D.prog(t, rev[0] + 0.2, rev[0] + 0.9))))));
      track.setAttribute("opacity", D.r2(D.prog(t, rev[0], rev[0] + 0.5)));
      var span = xr - x0;
      var u = span > 4 ? ((t * 220) % (span + 200)) / (span + 200) : 0;
      var px = x0 + u * (span + 200) - 100;
      var pa = span > 40 && px > x0 && px < xr ? 1 : 0;
      pulse.setAttribute("cx", D.r2(px)); pulseCore.setAttribute("cx", D.r2(px));
      pulse.setAttribute("opacity", pa); pulseCore.setAttribute("opacity", pa);
      var latest = -1;
      for (var i = 0; i < n; i++) if (t >= rev[i]) latest = i;
      items.forEach(function (it, i) {
        var s = D.buildIn(t, rev[i], 0.55, 30);
        it.wrap.style.opacity = D.r2(s.opacity);
        it.wrap.style.filter = s.blur > 0.05 ? "blur(" + D.r2(s.blur) + "px)" : "none";
        var bob = 4 * D.wobble(t * 0.9, i + 2) * s.k;
        it.wrap.style.transform = "translateY(" + D.r2(s.y + bob) + "px) scale(" + Math.round(s.scale * 1000) / 1000 + ")";
        var act = i === latest ? D.prog(t, rev[i], rev[i] + 0.4) : i < latest ? 1 - D.prog(t, rev[i + 1], rev[i + 1] + 0.4) : 0;
        it.disc.setActive(act * (0.8 + 0.2 * Math.sin(t * 3)));
        it.disc.setRing(D.ease.inOut(D.prog(t, rev[i] + 0.1, rev[i] + 0.9)));
        it.disc.el.style.transform = "scale(" + Math.round((1 + 0.06 * act) * 1000) / 1000 + ")";
        it.label.style.color = i <= latest && act > 0.01 ? st.colors.text : D.alpha(st.colors.text, 0.82);
        if (it.badge) it.badge.style.transform = "scale(" + D.r2(D.ease.outBack(D.prog(t, rev[i] + 0.25, rev[i] + 0.6))) + ")";
      });
    };
  }

  S.register({
    name: "steps",
    meta: { description: "A process as a path of 2-5 glowing stations; each pops in on its word and the track draws into it.", cues: ["step"],
      props: { title: "text <= 60", steps: "2..5 of text <= 24 or {text, icon}" }, anchors: ["title", "step-<i>", "center"] },
    check: function (p, v) {
      v.str(p.title, "title", S.LIMITS.title);
      if (!v.list(p.steps, "steps", 2, S.LIMITS.items)) return;
      p.steps.forEach(function (it, i) {
        if (it && typeof it === "object") { v.str(it.text, "steps[" + i + "].text", MAX_TEXT, true); v.icon(it.icon, "steps[" + i + "].icon"); }
        else v.str(it, "steps[" + i + "]", MAX_TEXT, true);
      });
    },
    counts: function (p) { return { step: Array.isArray(p && p.steps) ? p.steps.length : 0 }; },
    geometry: geometry,
    render: render,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
