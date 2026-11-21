/* Kit scene "kinetic": one big phrase builds word by word in time with the narration (registry
 * block kinetic-center-build: every intermediate phrase stays centred). Each word lands on the
 * matching spoken word (or its "word" cue); emphasised words turn accent and get a hand-drawn
 * underline. Long phrases use two lines. props {text (<= 60, <= 10 words), emphasis? [words of
 * text], icon?}; cue "word" {index}. Anchors: text, word-i. */
(function (root) {
  "use strict";
  var K = root.HFKit, S = K.sceneKit, D = K.draw, B = K.blocks.kineticCenterBuild;

  function tokens(text) { return String(text).trim().split(/\s+/); }
  function norm(w) { return String(w).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""); }

  function splitLines(tok, size, width) {
    var full = S.textWidth(tok.join(" "), size, "heading");
    if (full <= width) return [tok.length];
    var best = 1, bestW = Infinity;
    for (var k = 1; k < tok.length; k++) {
      var w = Math.max(S.textWidth(tok.slice(0, k).join(" "), size, "heading"), S.textWidth(tok.slice(k).join(" "), size, "heading"));
      if (w < bestW) { bestW = w; best = k; }
    }
    return [best, tok.length - best];
  }

  function geometry(p, box, style) {
    var tok = tokens(p.text), width = box.width * 0.92;
    var size = 104, lines;
    for (; size >= 44; size -= 4) {
      lines = splitLines(tok, size, width);
      var from = 0, ok = true;
      for (var l = 0; l < lines.length; l++) { if (S.textWidth(tok.slice(from, from + lines[l]).join(" "), size, "heading") > width) ok = false; from += lines[l]; }
      if (ok && lines.length <= 2) break;
    }
    var lh = Math.round(size * 1.3);
    var total = lh * lines.length;
    var y0 = box.y + (box.height - total) / 2;
    var boxes = [], fonts = [{ name: "text", size: size }], anchors = {};
    var rows = [], at = 0;
    lines.forEach(function (n, l) {
      var words = tok.slice(at, at + n);
      var w = Math.min(width, S.textWidth(words.join(" "), size, "heading"));
      var r = { x: box.x + (box.width - width) / 2, y: y0 + l * lh, width: width, height: lh, from: at, count: n };
      rows.push(r);
      boxes.push({ name: "line-" + l, x: box.x + (box.width - w) / 2, y: r.y, width: w, height: lh });
      at += n;
    });
    anchors.text = { x: box.x + box.width / 2, y: y0 + total / 2 };
    var cursor = 0;
    tok.forEach(function (w, i) {
      var row = rows.filter(function (r) { return i >= r.from && i < r.from + r.count; })[0];
      anchors["word-" + i] = { x: box.x + box.width / 2, y: row.y + lh / 2 };
      cursor++;
    });
    return { geom: { tokens: tok, rows: rows, size: size, lh: lh }, boxes: boxes, fonts: fonts, anchors: anchors };
  }

  /* Word i lands on its "word" cue, else on the next spoken word with the same text, else
   * between its neighbours (reading pace when nothing matches). */
  function reveal(o, duration) {
    var tok = tokens(o.props.text), words = o.words || [];
    var cued = [];
    (o.cues || []).forEach(function (c) { if (c.show === "word") cued[c.index || 0] = K.wordTime(words, c.at, o.sceneId); });
    var j = 0;
    tok.forEach(function (w, i) {
      if (typeof cued[i] === "number") {
        for (var q = j; q < words.length; q++) if (words[q].start >= cued[i]) { j = q; break; }
        return;
      }
      var target = norm(w);
      for (var k = j; k < words.length; k++) if (norm(words[k].text) === target) { cued[i] = words[k].start; j = k + 1; break; }
    });
    var anyKnown = cued.some(function (x) { return typeof x === "number"; });
    if (!anyKnown) return { word: tok.map(function (w, i) { return 0.4 + i * 0.32; }) };
    var t = S.revealTimes(tok.length, cued, duration);
    for (var i = 1; i < t.length; i++) if (t[i] < t[i - 1]) t[i] = t[i - 1]; // keep order
    return { word: t };
  }

  function render(ctx) {
    var g = ctx.plan.geom, st = ctx.style, stage = ctx.stage, rev = ctx.plan.reveal.word, p = ctx.props, doc = stage.ownerDocument;
    var emph = (p.emphasis || []).map(norm);
    var ups = [];
    if (p.icon) {
      var bg = S.div(stage, "hf-kinetic-icon", { x: ctx.plan.anchors.text.x - 260, y: ctx.plan.anchors.text.y - 260, width: 520, height: 520 }, { opacity: "0.07" });
      bg.innerHTML = K.icons.svg(p.icon, 520, st.colors.primary, 1.2);
      ups.push(function (t) { bg.style.transform = "rotate(" + D.r2(4 * D.wobble(t * 0.3, 4)) + "deg) scale(" + D.r2(1 + 0.04 * D.prog(t, 0, ctx.duration)) + ")"; });
    }
    var rows = g.rows.map(function (r, l) {
      var line = S.div(stage, "hf-text hf-kinetic-line", r, {
        fontFamily: st.fonts.heading, fontWeight: "800", fontSize: g.size + "px", lineHeight: g.lh + "px", color: st.colors.text,
        display: "flex", justifyContent: "center", alignItems: "center", whiteSpace: "nowrap", letterSpacing: "-0.02em" });
      line.dataset.key = "line-" + l;
      var spans = [], under = [];
      for (var i = r.from; i < r.from + r.count; i++) {
        var s = doc.createElement("span");
        s.textContent = g.tokens[i];
        s.className = "hf-kinetic-word";
        s.dataset.key = "word-" + i;
        s.style.display = "inline-block";
        s.style.position = "relative";
        s.style.margin = "0 " + D.r2(g.size * B.GAP_RATIO * 1.6 / 2) + "px";
        var isE = emph.indexOf(norm(g.tokens[i])) >= 0;
        if (isE) {
          s.style.color = st.colors.accent;
          s.style.textShadow = "0 0 28px " + D.alpha(st.colors.accent, 0.45);
          var u = doc.createElementNS(D.NS, "svg");
          u.setAttribute("viewBox", "0 0 100 20"); u.setAttribute("preserveAspectRatio", "none");
          u.style.cssText = "position:absolute;left:-4%;width:108%;height:" + Math.round(g.size * 0.26) + "px;top:" + Math.round(g.size * 1.02) + "px;overflow:visible";
          var path = D.el(u, "path", { d: "M2 12 C 25 4, 55 3, 98 9", fill: "none", stroke: st.colors.accent, "stroke-width": 6, "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" });
          s.appendChild(u);
          under.push({ i: i, path: path });
        }
        line.appendChild(s);
        spans.push(s);
      }
      return { line: line, spans: spans, under: under, r: r };
    });
    ups.push(function (t) {
      rows.forEach(function (row) {
        var widths = row.spans.map(function (s) { return s.offsetWidth; });
        var gap = g.size * B.GAP_RATIO * 1.6;
        var pos = B.positions(widths, gap);
        var starts = row.spans.map(function (s, j) { return rev[row.r.from + j]; });
        row.spans.forEach(function (s, j) {
          var w = B.wordState(j, t, starts, pos, 88);
          var x = w.x - pos[pos.length - 1][j];
          s.style.opacity = D.r2(w.opacity);
          s.style.transform = "translate(" + D.r2(x) + "px," + D.r2(w.y) + "px) scale(" + Math.round(w.scale * 10000) / 10000 + ")";
          s.style.filter = w.blur > 0.05 ? "blur(" + D.r2(w.blur) + "px)" : "none";
        });
        row.under.forEach(function (u) {
          var k = D.ease.inOut(D.prog(t, rev[u.i] + 0.35, rev[u.i] + 0.85));
          u.path.setAttribute("stroke-dasharray", "100 101");
          u.path.setAttribute("pathLength", "100");
          u.path.setAttribute("stroke-dashoffset", D.r2(100 * (1 - k)));
          u.path.setAttribute("opacity", k > 0 ? 1 : 0);
        });
      });
    });
    return function (t) { ups.forEach(function (u) { u(t); }); };
  }

  S.register({
    name: "kinetic",
    meta: { description: "One big phrase builds word by word with the narration (centre-build), emphasised words in the accent colour with an underline.", cues: ["word"],
      props: { text: "text <= 60, <= 10 words (required)", emphasis: "words of text", icon: "icon name (faint backdrop)" }, anchors: ["text", "word-<i>", "center"] },
    check: function (p, v) {
      if (!v.str(p.text, "text", S.LIMITS.title, true)) return;
      var tok = tokens(p.text);
      if (tok.length > 10) v.err("text has at most 10 words (got " + tok.length + ")");
      v.icon(p.icon, "icon");
      if (p.emphasis !== undefined) {
        if (!Array.isArray(p.emphasis)) v.err("emphasis must be a list of words from text");
        else {
          var have = tok.map(norm);
          p.emphasis.forEach(function (w) { if (have.indexOf(norm(w)) < 0) v.err("emphasis word " + w + " is not in text"); });
        }
      }
    },
    counts: function (p) { return { word: p && typeof p.text === "string" ? tokens(p.text).length : 0 }; },
    geometry: geometry,
    reveal: reveal,
    render: render,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
