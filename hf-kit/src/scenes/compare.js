/* Kit scene "compare": two cards side by side with a VS badge. Each card slides in on its cue,
 * its points tick in one by one, and an optional verdict pops at the end.
 * props {title? (<= 60), left: {label (<= 24), icon?, points? (<= 3 of text <= 32)}, right: same,
 * verdict? (<= 50)}; cues "left", "right", "point" {side, index}, "verdict".
 * Anchors: title, left, right, verdict. */
(function (root) {
  "use strict";
  var K = root.HFKit, S = K.sceneKit, D = K.draw;

  function geometry(p, box, style) {
    var boxes = [], fonts = [], anchors = {};
    var tg = S.titleGeom(p.title, box);
    if (tg) { boxes.push(Object.assign({ name: "title" }, tg)); fonts.push({ name: "title", size: tg.size }); anchors.title = { x: tg.x + tg.width / 2, y: tg.y + tg.height / 2 }; }
    var top = tg ? tg.bar.y + 40 : box.y;
    var bottom = box.y + box.height;
    var verdict = null;
    if (p.verdict) {
      var vf = S.fitText(p.verdict, box.width * 0.8 - 80, S.range(40, 32, 2), 1, "heading");
      var vw = Math.min(box.width * 0.8, S.textWidth(p.verdict, vf.size, "heading") + 120);
      verdict = { x: box.x + (box.width - vw) / 2, y: bottom - 84, width: vw, height: 84, size: vf.size };
      boxes.push(Object.assign({ name: "verdict" }, verdict)); fonts.push({ name: "verdict", size: vf.size });
      anchors.verdict = { x: verdict.x + vw / 2, y: verdict.y + 42 };
      bottom -= 84 + 30;
    }
    var gap = 120, cw = (box.width - gap) / 2, ch = Math.min(bottom - top, 470);
    var cy = top + (bottom - top - ch) / 2;
    var icon = Math.min(104, cw * 0.22);
    var maxPts = Math.max(1, (p.left.points || []).length, (p.right.points || []).length);
    var labelW = cw - icon - 3 * 32;
    var labelSize = 56;
    [p.left, p.right].forEach(function (c) { labelSize = Math.min(labelSize, S.fitText(c.label, labelW, S.range(56, 36, 2), 1, "heading").size); });
    var ptW = cw - 64 - 56;
    var ptSize = 40;
    [p.left, p.right].forEach(function (c) { (c.points || []).forEach(function (q) { ptSize = Math.min(ptSize, S.fitText(q, ptW, S.range(40, 32, 2), 1, "body").size); }); });
    var rowH = Math.round(ptSize * 1.25 + 26);
    var cards = ["left", "right"].map(function (side, k) {
      var x = box.x + k * (cw + gap);
      var c = p[side];
      var head = { x: x + 32 + icon + 32, y: cy + 36, width: labelW, height: icon };
      var g = { side: side, x: x, y: cy, width: cw, height: ch, icon: { cx: x + 32 + icon / 2, cy: cy + 36 + icon / 2, size: icon }, head: head, labelSize: labelSize,
        label: c.label, iconName: c.icon, points: [] };
      boxes.push(Object.assign({ name: side + "-label" }, head)); fonts.push({ name: side + "-label", size: labelSize });
      var py = cy + 36 + icon + 34;
      var spare = cy + ch - 28 - py - rowH * maxPts;
      py += Math.max(0, spare / 2);
      (c.points || []).forEach(function (q, j) {
        var r = { x: x + 64 + 40, y: py + j * rowH + 13, width: ptW - 8, height: rowH - 26, text: q };
        g.points.push(r);
        boxes.push({ name: side + "-point-" + j, x: r.x, y: r.y, width: r.width, height: r.height });
        fonts.push({ name: side + "-point-" + j, size: ptSize });
      });
      g.ptSize = ptSize;
      anchors[side] = { x: x + cw / 2, y: cy + ch / 2 };
      return g;
    });
    var vs = { cx: box.x + box.width / 2, cy: cy + ch / 2, size: 96 };
    return { geom: { title: tg, cards: cards, verdict: verdict, vs: vs, verdictText: p.verdict }, boxes: boxes, fonts: fonts, anchors: anchors };
  }

  function reveal(o, duration) {
    var p = o.props, cues = o.cues || [], words = o.words || [];
    var r = S.planReveals(this.counts(p), cues, words, duration, o.sceneId);
    function cued(kind, side) { return cues.some(function (c) { return c.show === kind && (side === undefined || c.side === side); }); }
    if (!cued("left")) r.left = [0.4];
    if (!cued("right")) r.right = [Math.max(r.left[0] + 1.2, Math.min(duration * 0.35, r.left[0] + 3))];
    ["left", "right"].forEach(function (side) {
      var pts = r["point-" + side];
      var known = cues.filter(function (c) { return c.show === "point" && c.side === side; }).map(function (c) { return c.index || 0; });
      for (var j = 0; j < pts.length; j++) if (known.indexOf(j) < 0) pts[j] = r[side][0] + 0.6 + 0.45 * j;
    });
    if (p.verdict && !cued("verdict")) {
      var lastPt = Math.max.apply(null, [r.right[0]].concat(r["point-right"], r["point-left"]));
      r.verdict = [Math.max(lastPt + 0.8, duration * 0.6)];
    }
    return r;
  }

  function render(ctx) {
    var g = ctx.plan.geom, st = ctx.style, stage = ctx.stage, rev = ctx.plan.reveal;
    var title = S.titleBlock(stage, g.title, st, 0.15);
    var cols = { left: st.colors.primary, right: st.colors.accent };
    var cards = g.cards.map(function (c) {
      var col = cols[c.side];
      var wrap = S.div(stage, "hf-card", { x: c.x, y: c.y, width: c.width, height: c.height }, {
        borderRadius: "30px", boxSizing: "border-box", border: "2px solid " + D.alpha(col, 0.45),
        background: "linear-gradient(160deg, " + D.alpha(D.tint(st.colors.surface, 0.06), 0.96) + " 0%, " + D.alpha(st.colors.surface, 0.9) + " 60%, " + D.alpha(D.mix(st.colors.surface, col, 0.18), 0.92) + " 100%)",
        boxShadow: "0 24px 60px rgba(2,6,23,0.45)" });
      wrap.dataset.key = c.side;
      var inner = S.div(wrap, "", { x: -c.x, y: -c.y, width: 0, height: 0 });
      var disc = S.iconDisc(inner, c.icon.cx, c.icon.cy, c.icon.size, { style: st, icon: c.iconName || (c.side === "left" ? "check" : "star"), color: col });
      S.text(inner, c.label, c.head, { style: st, heading: true, size: c.labelSize, weight: 800, valign: "center", nowrap: true });
      var pts = c.points.map(function (r, j) {
        var row = S.div(inner, "hf-point", { x: r.x - 64, y: r.y - 13, width: r.width + 64, height: r.height + 26 });
        row.dataset.key = c.side + "-point-" + j;
        var dot = S.div(row, "", { x: 8, y: (r.height + 26) / 2 - 20, width: 40, height: 40 }, { borderRadius: "50%", background: D.alpha(col, 0.2),
          border: "2px solid " + col, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" });
        dot.innerHTML = K.icons.svg("check", 26, col, 3);
        S.text(row, r.text, { x: 64, y: 13, width: r.width, height: r.height }, { style: st, size: c.ptSize, weight: 500, valign: "center", nowrap: true });
        return row;
      });
      return { c: c, wrap: wrap, disc: disc, pts: pts };
    });
    var vs = S.div(stage, "hf-vs", { x: g.vs.cx - g.vs.size / 2, y: g.vs.cy - g.vs.size / 2, width: g.vs.size, height: g.vs.size }, {
      borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, " + D.tint(st.colors.background, 0.2) + ", " + st.colors.background + ")",
      border: "3px solid " + D.alpha(st.colors.text, 0.35), boxSizing: "border-box", color: st.colors.text, fontFamily: st.fonts.heading, fontWeight: "800",
      fontSize: "34px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(2,6,23,0.5)" });
    vs.className = "hf-vs hf-text";
    vs.textContent = "VS";
    var verdict = null;
    if (g.verdict) {
      verdict = S.text(stage, g.verdictText, g.verdict, { style: st, heading: true, size: g.verdict.size, weight: 700, align: "center", valign: "center", nowrap: true, color: "#0B1220", key: "verdict" });
      verdict.style.borderRadius = "999px";
      verdict.style.background = "linear-gradient(90deg, " + D.tint(st.colors.accent, 0.15) + ", " + st.colors.accent + ")";
      verdict.style.boxShadow = "0 14px 40px " + D.alpha(st.colors.accent, 0.35);
    }
    return function (t) {
      title(t);
      var latest = t >= rev.right[0] ? "right" : "left";
      cards.forEach(function (k) {
        var t0 = rev[k.c.side][0];
        var s = D.buildIn(t, t0, 0.65, 0);
        var dx = (k.c.side === "left" ? -1 : 1) * 90 * (1 - D.ease.outCubic(s.k));
        k.wrap.style.opacity = D.r2(s.opacity);
        k.wrap.style.transform = "translateX(" + D.r2(dx) + "px) translateY(" + D.r2(3 * D.wobble(t * 0.7, k.c.side === "left" ? 2 : 9) * s.k) + "px)";
        k.wrap.style.filter = s.blur > 0.05 ? "blur(" + D.r2(s.blur) + "px)" : "none";
        var act = k.c.side === latest ? 1 : 0.4;
        k.wrap.style.borderColor = D.alpha(cols[k.c.side], 0.25 + 0.5 * act * D.prog(t, t0, t0 + 0.5));
        k.disc.setActive(act * (0.8 + 0.2 * Math.sin(t * 2.5)));
        k.disc.setRing(D.ease.inOut(D.prog(t, t0 + 0.2, t0 + 1)));
        k.pts.forEach(function (row, j) { D.applyIn(row, D.buildIn(t, rev["point-" + k.c.side][j], 0.45, 18)); });
      });
      var vk = D.prog(t, rev.right[0] + 0.15, rev.right[0] + 0.6);
      vs.style.opacity = D.r2(vk);
      vs.style.transform = "scale(" + D.r2(0.5 + 0.5 * D.ease.outBack(vk)) + ") rotate(" + D.r2(-12 * (1 - vk)) + "deg)";
      if (verdict) {
        var s = D.buildIn(t, rev.verdict[0], 0.55, 24);
        D.applyIn(verdict, s);
      }
    };
  }

  S.register({
    name: "compare",
    meta: { description: "Two cards side by side with a VS badge; each slides in on its word, points tick in, optional verdict.", cues: ["left", "right", "point", "verdict"],
      props: { title: "text <= 60", left: "{label <= 24, icon?, points?: <= 3 of text <= 32}", right: "same as left", verdict: "text <= 50" }, anchors: ["title", "left", "right", "verdict", "center"] },
    check: function (p, v) {
      v.str(p.title, "title", S.LIMITS.title);
      ["left", "right"].forEach(function (side) {
        var c = p[side];
        if (!c || typeof c !== "object") { v.err(side + " is required ({label, icon?, points?})"); return; }
        v.str(c.label, side + ".label", 24, true);
        v.icon(c.icon, side + ".icon");
        if (c.points !== undefined && v.list(c.points, side + ".points", 0, 3)) c.points.forEach(function (q, i) { v.str(q, side + ".points[" + i + "]", 32, true); });
      });
      v.str(p.verdict, "verdict", 50);
    },
    counts: function (p) {
      var pts = function (s) { return p && p[s] && Array.isArray(p[s].points) ? p[s].points.length : 0; };
      var c = { left: 1, right: 1, "point-left": pts("left"), "point-right": pts("right") };
      if (p && p.verdict) c.verdict = 1;
      return c;
    },
    geometry: geometry,
    reveal: reveal,
    render: render,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
