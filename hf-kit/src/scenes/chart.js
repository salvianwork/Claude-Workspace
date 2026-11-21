/* Kit scene "chart": a bar chart (or a line chart) that builds on the narration. The axis draws
 * on, each bar grows on its cue word while its value counts up, and the highlighted datum lights
 * up in the accent colour on the "highlight" cue while the others step back.
 * props {title (<= 60), kind? "bar"|"line", data: 2..5 (line: 2..6) of {label (<= 14), value},
 * unit? (<= 6), highlight? index}; cues "bar" {index}, "highlight". Anchors: title, chart, bar-i. */
(function (root) {
  "use strict";
  var K = root.HFKit, S = K.sceneKit, D = K.draw;

  function fmt(v, unit) {
    var neg = v < 0, s = Math.abs(v), whole = Math.round(s) === s;
    var txt = whole ? String(Math.round(s)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : s.toFixed(s < 10 ? 1 : 0);
    return (neg ? "-" : "") + txt + (unit ? (/^[%°]/.test(unit) && unit !== "°C" && unit !== "°F" ? "" : " ") + unit : "");
  }

  function geometry(p, box, style) {
    var boxes = [], fonts = [], anchors = {};
    var tg = S.titleGeom(p.title, box);
    boxes.push(Object.assign({ name: "title" }, tg)); fonts.push({ name: "title", size: tg.size });
    anchors.title = { x: tg.x + tg.width / 2, y: tg.y + tg.height / 2 };
    var top = tg.bar.y + 40, bottom = box.y + box.height;
    var n = p.data.length, slot = box.width / n;
    var labelSize = 36, valueSize = 44;
    p.data.forEach(function (d) {
      labelSize = Math.min(labelSize, S.fitText(d.label, slot - 16, S.range(36, 32, 2), 1, "body").size);
      valueSize = Math.min(valueSize, S.fitText(fmt(d.value, p.unit), slot - 16, S.range(44, 32, 2), 1, "heading").size);
    });
    var labelH = Math.ceil(labelSize * 1.3), valueH = Math.ceil(valueSize * 1.2);
    var base = bottom - labelH - 18;
    var plotTop = top + valueH + 14;
    var maxV = Math.max.apply(null, p.data.map(function (d) { return d.value; }).concat([p.max || 0])) || 1;
    var barW = Math.min(160, slot * 0.52);
    var bars = p.data.map(function (d, i) {
      var cx = box.x + slot * (i + 0.5);
      var h = Math.max(6, (base - plotTop) * Math.max(0, d.value) / maxV);
      var label = { x: cx - (slot - 16) / 2, y: base + 18, width: slot - 16, height: labelH };
      var vw = Math.min(slot - 16, S.textWidth(fmt(d.value, p.unit), valueSize, "heading") + 30);
      var value = { x: cx - vw / 2, y: base - h - 12 - valueH, width: vw, height: valueH };
      boxes.push(Object.assign({ name: "label-" + i }, label), Object.assign({ name: "value-" + i }, value));
      fonts.push({ name: "label-" + i, size: labelSize }, { name: "value-" + i, size: valueSize });
      anchors["bar-" + i] = { x: cx, y: base - h / 2 };
      return { cx: cx, h: h, top: base - h, label: label, value: value, d: d };
    });
    anchors.chart = { x: box.x + box.width / 2, y: (plotTop + base) / 2 };
    return { geom: { title: tg, bars: bars, base: base, plotTop: plotTop, barW: barW, left: box.x, right: box.x + box.width, labelSize: labelSize, valueSize: valueSize, kind: p.kind || "bar" },
      boxes: boxes, fonts: fonts, anchors: anchors };
  }

  function reveal(o, duration) {
    var r = S.planReveals(this.counts(o.props), o.cues, o.words, duration, o.sceneId);
    var cued = (o.cues || []).some(function (c) { return c.show === "highlight"; });
    if (!cued) r.highlight = [r.bar[r.bar.length - 1] + 0.9];
    if (!(o.cues || []).some(function (c) { return c.show === "bar"; })) r.bar = r.bar.map(function (t, i) { return 0.9 + i * Math.min(0.7, (duration * 0.5) / r.bar.length); });
    return r;
  }

  function render(ctx) {
    var g = ctx.plan.geom, st = ctx.style, stage = ctx.stage, rev = ctx.plan.reveal, p = ctx.props;
    var title = S.titleBlock(stage, g.title, st, 0.15);
    var hi = p.highlight;
    var svg = D.svgRoot(stage, K.CANVAS.width, K.CANVAS.height, { style: "position:absolute;left:0;top:0" });
    var id = D.uid("chart");
    var gradP = D.linearGradient(svg.defs, id + "p", [[0, D.tint(st.colors.primary, 0.25)], [1, D.shade(st.colors.primary, 0.35)]]);
    var gradA = D.linearGradient(svg.defs, id + "a", [[0, D.tint(st.colors.accent, 0.3)], [1, D.shade(st.colors.accent, 0.3)]]);
    var area = D.linearGradient(svg.defs, id + "f", [[0, st.colors.primary, 0.35], [1, st.colors.primary, 0]]);
    var glow = D.blurFilter(svg.defs, id + "g", 14);
    var grid = [0.25, 0.5, 0.75, 1].map(function (f) {
      var y = g.base - (g.base - g.plotTop) * f;
      return D.el(svg.svg, "line", { x1: g.left, x2: g.right, y1: y, y2: y, stroke: D.alpha(st.colors.text, 0.08), "stroke-width": 2, "stroke-dasharray": "6 10" });
    });
    var axis = D.el(svg.svg, "line", { x1: g.left, x2: g.right, y1: g.base, y2: g.base, stroke: D.alpha(st.colors.text, 0.45), "stroke-width": 4, "stroke-linecap": "round" });
    var axisLen = g.right - g.left;
    var items = g.bars.map(function (b, i) {
      var isHi = i === hi;
      var wrap = S.div(stage, "hf-bar", { x: 0, y: 0, width: 0, height: 0 });
      wrap.dataset.key = "bar-" + i;
      var halo = D.el(svg.svg, "rect", { x: b.cx - g.barW / 2 - 10, width: g.barW + 20, rx: 20, fill: isHi ? st.colors.accent : st.colors.primary, filter: glow, opacity: 0 });
      var bar = g.kind === "bar" ? D.el(svg.svg, "rect", { x: b.cx - g.barW / 2, width: g.barW, rx: 14, fill: isHi ? gradA : gradP }) : null;
      var shine = g.kind === "bar" ? D.el(svg.svg, "rect", { x: b.cx - g.barW / 2 + 10, width: 12, rx: 6, fill: "rgba(255,255,255,0.22)" }) : null;
      var value = S.text(wrap, fmt(b.d.value, p.unit), b.value, { style: st, heading: true, size: g.valueSize, weight: 800, align: "center", nowrap: true, color: isHi ? st.colors.accent : st.colors.text });
      var label = S.text(stage, b.d.label, b.label, { style: st, size: g.labelSize, weight: 600, align: "center", nowrap: true, color: D.alpha(st.colors.text, 0.85) });
      return { b: b, wrap: wrap, bar: bar, halo: halo, shine: shine, value: value, label: label, isHi: isHi };
    });
    var line = null, fill = null, dots = [];
    if (g.kind === "line") {
      var pts = g.bars.map(function (b) { return [b.cx, b.top]; });
      var dPath = pts.map(function (q, i) { return (i ? "L" : "M") + D.r2(q[0]) + " " + D.r2(q[1]); }).join(" ");
      var lens = [0];
      for (var i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      var clip = D.el(svg.defs, "clipPath", { id: id + "c" });
      var clipRect = D.el(clip, "rect", { x: g.left, y: g.plotTop - 80, height: g.base - g.plotTop + 80, width: 0 });
      fill = D.el(svg.svg, "path", { d: dPath + " L" + D.r2(pts[pts.length - 1][0]) + " " + g.base + " L" + D.r2(pts[0][0]) + " " + g.base + " Z", fill: area, "clip-path": "url(#" + id + "c)" });
      var lineGlow = D.el(svg.svg, "path", { d: dPath, fill: "none", stroke: st.colors.primary, "stroke-width": 14, "stroke-linejoin": "round", "stroke-linecap": "round", filter: glow, opacity: 0.6 });
      line = D.el(svg.svg, "path", { d: dPath, fill: "none", stroke: st.colors.primary, "stroke-width": 8, "stroke-linejoin": "round", "stroke-linecap": "round" });
      dots = pts.map(function (q, i) { return D.el(svg.svg, "circle", { cx: q[0], cy: q[1], r: 0, fill: i === hi ? st.colors.accent : "#FFF8EF", stroke: st.colors.background, "stroke-width": 4 }); });
      line._lens = lens; line._glow = lineGlow; line._clip = clipRect; line._pts = pts;
    }
    return function (t) {
      title(t);
      var ak = D.ease.inOut(D.prog(t, 0.2, 0.9));
      D.drawOn(axis, axisLen, ak);
      grid.forEach(function (gl, j) { gl.setAttribute("opacity", D.r2(D.prog(t, 0.4 + 0.1 * j, 0.9 + 0.1 * j))); });
      var hk = rev.highlight ? D.ease.inOut(D.prog(t, rev.highlight[0], rev.highlight[0] + 0.5)) : 0;
      items.forEach(function (it, i) {
        var t0 = rev.bar[i];
        var k = D.prog(t, t0, t0 + 0.8);
        var grow = D.ease.outBack(k);
        var h = it.b.h * grow;
        var focus = hi === undefined ? 1 : it.isHi ? 1 : 1 - 0.45 * hk;
        if (it.bar) {
          it.bar.setAttribute("y", D.r2(g.base - h)); it.bar.setAttribute("height", D.r2(Math.max(0, h)));
          it.bar.setAttribute("opacity", D.r2((k > 0 ? 1 : 0) * focus));
          it.shine.setAttribute("y", D.r2(g.base - h + 12)); it.shine.setAttribute("height", D.r2(Math.max(0, h * 0.6 - 12)));
          it.shine.setAttribute("opacity", D.r2(k > 0 ? focus : 0));
          it.halo.setAttribute("y", D.r2(g.base - h - 10)); it.halo.setAttribute("height", D.r2(Math.max(0, h + 10)));
          it.halo.setAttribute("opacity", D.r2(it.isHi ? hk * (0.45 + 0.2 * Math.sin(t * 3)) : 0));
        }
        var vs = D.buildIn(t, t0 + 0.15, 0.5, 16);
        var shown = Math.round(it.b.d.value * D.ease.outCubic(k) * 10) / 10;
        if (Number.isInteger(it.b.d.value)) shown = Math.round(shown);
        it.value.firstChild.textContent = fmt(k >= 1 ? it.b.d.value : shown, p.unit);
        var dy = g.kind === "bar" ? it.b.h - h : 0;
        it.wrap.style.opacity = D.r2(vs.opacity * focus);
        it.wrap.style.transform = "translateY(" + D.r2(vs.y + dy) + "px) scale(" + Math.round((1 + 0.08 * (it.isHi ? hk : 0)) * 1000) / 1000 + ")";
        it.wrap.style.transformOrigin = it.b.cx + "px " + (it.b.value.y + it.b.value.height) + "px";
        it.label.style.opacity = D.r2(D.prog(t, t0 - 0.1, t0 + 0.3) * (0.6 + 0.4 * focus));
        if (dots.length) {
          var dk = D.ease.outBack(D.prog(t, t0 + 0.25, t0 + 0.6));
          dots[i].setAttribute("r", D.r2(Math.max(0, 13 * dk * (it.isHi ? 1 + 0.35 * hk : 1))));
        }
      });
      if (line) {
        // the line reaches point i as bar i is revealed
        var L = 0, lens = line._lens, pts = line._pts;
        for (var i = 1; i < pts.length; i++) {
          var u = D.ease.inOut(D.prog(t, rev.bar[i] - 0.45, rev.bar[i] + 0.1));
          L = D.lerp(lens[i - 1], lens[i], u);
          if (u < 1) break;
        }
        if (t < rev.bar[0]) L = 0;
        D.drawOn(line, lens[lens.length - 1], L / lens[lens.length - 1]);
        D.drawOn(line._glow, lens[lens.length - 1], L / lens[lens.length - 1]);
        var xEnd = pts[0][0];
        for (var j = 1; j < pts.length; j++) { if (L >= lens[j]) xEnd = pts[j][0]; else { xEnd = D.lerp(pts[j - 1][0], pts[j][0], (L - lens[j - 1]) / (lens[j] - lens[j - 1])); break; } }
        line._clip.setAttribute("width", D.r2(t < rev.bar[0] ? 0 : xEnd - g.left));
      }
    };
  }

  S.register({
    name: "chart",
    meta: { description: "Bar or line chart that builds on the narration: bars grow and values count up on their words; the highlighted datum lights up.", cues: ["bar", "highlight"],
      props: { title: "text <= 60 (required)", kind: "bar | line", data: "2..5 (line: 2..6) of {label <= 14, value}", unit: "text <= 6", highlight: "index" }, anchors: ["title", "chart", "bar-<i>", "center"] },
    check: function (p, v) {
      v.str(p.title, "title", S.LIMITS.title, true);
      v.oneOf(p.kind, "kind", ["bar", "line"]);
      var max = p.kind === "line" ? 6 : S.LIMITS.items;
      if (v.list(p.data, "data", 2, max)) p.data.forEach(function (d, i) {
        if (!d || typeof d !== "object") { v.err("data[" + i + "] must be {label, value}"); return; }
        v.str(d.label, "data[" + i + "].label", 14, true);
        v.num(d.value, "data[" + i + "].value");
      });
      v.str(p.unit, "unit", 6);
      if (p.highlight !== undefined && !(Number.isInteger(p.highlight) && Array.isArray(p.data) && p.highlight >= 0 && p.highlight < p.data.length))
        v.err("highlight must be an index into data (got " + p.highlight + ")");
    },
    counts: function (p) { var c = { bar: Array.isArray(p && p.data) ? p.data.length : 0 }; if (p && p.highlight !== undefined) c.highlight = 1; return c; },
    geometry: geometry,
    reveal: reveal,
    render: render,
  });
  K.sceneKit.formatValue = fmt;
})(typeof globalThis !== "undefined" ? globalThis : window);
