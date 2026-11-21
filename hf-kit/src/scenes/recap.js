/* Kit scene "recap": the key points as a checklist. Each row slides in on its cue word, its tick
 * draws itself and the newest row glows; earlier rows settle back. props {title? (<= 60),
 * points: 2..5 of text <= 40}; cue "point" {index}. Anchors: title, point-i. */
(function (root) {
  "use strict";
  var K = root.HFKit, S = K.sceneKit, D = K.draw;

  function geometry(p, box, style) {
    var boxes = [], fonts = [], anchors = {};
    var tg = S.titleGeom(p.title, box);
    if (tg) { boxes.push(Object.assign({ name: "title" }, tg)); fonts.push({ name: "title", size: tg.size }); anchors.title = { x: tg.x + tg.width / 2, y: tg.y + tg.height / 2 }; }
    var top = tg ? tg.bar.y + 36 : box.y, bottom = box.y + box.height;
    var n = p.points.length, gap = 22;
    var rowW = Math.min(box.width, 1300), x = box.x + (box.width - rowW) / 2;
    var disc = 64, textX = x + 32 + disc + 30, textW = x + rowW - 32 - textX;
    var size = 40;
    size = 44;
    p.points.forEach(function (q) { size = Math.min(size, S.fitText(q, textW, S.range(44, 32, 2), 2, "body").size); });
    var lines = Math.max.apply(null, p.points.map(function (q) { return S.lineCount(q, size, textW, "body"); }));
    var rowH = Math.min(Math.max(Math.ceil(size * 1.22 * lines) + 56, disc + 44, 118), (bottom - top - gap * (n - 1)) / n);
    var total = n * rowH + (n - 1) * gap;
    var y = top + Math.max(0, (bottom - top - total) / 2);
    var rows = p.points.map(function (q, i) {
      var r = { x: x, y: y + i * (rowH + gap), width: rowW, height: rowH };
      var tr = { x: textX, y: r.y + 10, width: textW, height: rowH - 20 };
      boxes.push(Object.assign({ name: "point-" + i }, tr)); fonts.push({ name: "point-" + i, size: size });
      anchors["point-" + i] = { x: r.x + rowW / 2, y: r.y + rowH / 2 };
      return { r: r, text: tr, disc: { cx: x + 32 + disc / 2, cy: r.y + rowH / 2, size: disc }, q: q };
    });
    return { geom: { title: tg, rows: rows, size: size }, boxes: boxes, fonts: fonts, anchors: anchors };
  }

  function render(ctx) {
    var g = ctx.plan.geom, st = ctx.style, stage = ctx.stage, rev = ctx.plan.reveal.point;
    var title = S.titleBlock(stage, g.title, st, 0.15);
    var items = g.rows.map(function (row, i) {
      var card = S.div(stage, "hf-recap-row", row.r, {
        borderRadius: "24px", boxSizing: "border-box", background: "linear-gradient(90deg, " + D.alpha(D.tint(st.colors.surface, 0.08), 0.95) + ", " + D.alpha(st.colors.surface, 0.55) + ")",
        border: "2px solid " + D.alpha(st.colors.text, 0.08), boxShadow: "0 14px 36px rgba(2,6,23,0.35)", overflow: "hidden" });
      card.dataset.key = "point-" + i;
      var edge = S.div(card, "", { x: 0, y: 0, width: 8, height: row.r.height }, { background: st.colors.accent, transformOrigin: "50% 50%" });
      var inner = S.div(card, "", { x: -row.r.x, y: -row.r.y, width: 0, height: 0 });
      var d = row.disc;
      var disc = S.div(inner, "hf-tick", { x: d.cx - d.size / 2, y: d.cy - d.size / 2, width: d.size, height: d.size }, {
        borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, " + D.tint(st.colors.accent, 0.3) + ", " + st.colors.accent + " 60%, " + D.shade(st.colors.accent, 0.25) + ")",
        boxShadow: "0 0 24px " + D.alpha(st.colors.accent, 0.45) });
      var svg = D.svgRoot(disc, d.size, d.size).svg;
      var tick = D.el(svg, "path", { d: "M" + d.size * 0.28 + " " + d.size * 0.52 + " L" + d.size * 0.44 + " " + d.size * 0.68 + " L" + d.size * 0.74 + " " + d.size * 0.34,
        fill: "none", stroke: "#0B1220", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round" });
      var txt = S.text(inner, row.q, row.text, { style: st, size: g.size, weight: 600, valign: "center", lineHeight: 1.22 });
      return { card: card, edge: edge, disc: disc, tick: tick, txt: txt, len: d.size * 0.23 + d.size * 0.42 + 2 };
    });
    var n = items.length;
    return function (t) {
      title(t);
      var latest = -1;
      for (var i = 0; i < n; i++) if (t >= rev[i]) latest = i;
      items.forEach(function (it, i) {
        var s = D.buildIn(t, rev[i], 0.55, 0);
        var dx = -60 * (1 - D.ease.outCubic(s.k));
        it.card.style.opacity = D.r2(s.opacity);
        it.card.style.transform = "translateX(" + D.r2(dx) + "px)";
        it.card.style.filter = s.blur > 0.05 ? "blur(" + D.r2(s.blur) + "px)" : "none";
        var act = i === latest ? 1 : 0;
        var settle = i < latest ? D.prog(t, rev[i + 1], rev[i + 1] + 0.5) : 0;
        it.card.style.borderColor = D.alpha(i === latest ? st.colors.accent : st.colors.text, i === latest ? 0.45 : 0.08);
        it.edge.style.transform = "scaleY(" + D.r2(D.ease.outCubic(D.prog(t, rev[i] + 0.1, rev[i] + 0.5)) * (1 - 0.6 * settle)) + ")";
        var pop = D.prog(t, rev[i] + 0.1, rev[i] + 0.45);
        it.disc.style.transform = "scale(" + D.r2(0.4 + 0.6 * D.ease.outBack(pop)) + ")";
        it.disc.style.opacity = D.r2(pop);
        D.drawOn(it.tick, it.len, D.ease.outCubic(D.prog(t, rev[i] + 0.3, rev[i] + 0.7)));
        it.txt.style.color = act ? st.colors.text : D.alpha(st.colors.text, 0.86);
      });
    };
  }

  S.register({
    name: "recap",
    meta: { description: "Key points as a checklist: rows slide in on their words and their ticks draw themselves.", cues: ["point"],
      props: { title: "text <= 60", points: "2..5 of text <= 40" }, anchors: ["title", "point-<i>", "center"] },
    check: function (p, v) {
      v.str(p.title, "title", S.LIMITS.title);
      if (v.list(p.points, "points", 2, S.LIMITS.items)) p.points.forEach(function (q, i) { v.str(q, "points[" + i + "]", 40, true); });
    },
    counts: function (p) { return { point: Array.isArray(p && p.points) ? p.points.length : 0 }; },
    geometry: geometry,
    render: render,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
