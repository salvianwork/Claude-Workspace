/* hf-kit kit scenes, shared part: registration, props/cue validation helpers, cue -> reveal
 * time planning, text fitting (estimated metrics, checked in a real browser by
 * tests/hf/test_kit_scenes.py), DOM helpers (text blocks, icon discs, titles) and the mount
 * wrapper (shell + camera + calm drift).
 *
 * Scene contract (classic scripts, so no ES exports; every scene is HFKit.scenes[name]):
 *   validate(props) -> string[]            readability limits included (<= 5 items, titles <= 60)
 *   validateCues(props, cues) -> string[]  cue kinds this scene understands, indexes in range
 *   plan({props, style, words, cues, duration, presenter}) -> {reveal, boxes, fonts, anchors, box}
 *   mount(root, {props, style, words, cues, camera, duration, presenter, sceneId, drift?})
 *     -> {update(t), anchors, shell}    update is a pure function of t (seekable)
 * Anchors are canvas px; camera frames name them ({focus: "step-2", zoom: 1.3}).
 * Load after shell.js, icons.js and the blocks; then the scene files. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.shell || !K.icons) throw new Error("scenes/common.js: load shell.js and icons.js first");
  var D = K.draw;
  K.scenes = K.scenes || {};
  K.SCENE_NAMES = K.SCENE_NAMES || [];

  var LIMITS = { title: 60, items: 5 };
  var KIT_CAMERA = { maxZoom: 1.4 };
  var EM = { heading: 0.62, body: 0.56 }; // average glyph width per px of font size (Poppins 700 / Inter 600), a little generous
  var MIN_TEXT = 32;

  // ---- validation helpers ---------------------------------------------------------------
  function V(name, errs) {
    function e(msg) { errs.push(name + ": " + msg); }
    return {
      err: e,
      str: function (v, field, max, required) {
        if (v === undefined || v === null || v === "") { if (required) e(field + " is required"); return false; }
        if (typeof v !== "string") { e(field + " must be text"); return false; }
        if (max && v.length > max) e(field + " has at most " + max + " characters (got " + v.length + ")");
        return true;
      },
      icon: function (v, field) {
        if (v === undefined || v === null) return;
        if (typeof v !== "string" || !K.icons.has(v)) e(field + ": unknown icon " + v);
      },
      list: function (v, field, min, max) {
        if (!Array.isArray(v)) { e(field + " must be a list"); return false; }
        if (v.length < min) e(field + " needs at least " + min + " items (got " + v.length + ")");
        if (v.length > max) e(field + " has at most " + max + " items (got " + v.length + ")");
        return true;
      },
      num: function (v, field) { if (typeof v !== "number" || !isFinite(v)) { e(field + " must be a number"); return false; } return true; },
      oneOf: function (v, field, opts) { if (v !== undefined && opts.indexOf(v) < 0) e(field + " must be one of " + opts.join(", ") + " (got " + v + ")"); },
    };
  }

  /* Text of an item that is "text" or {text, icon}. */
  function itemText(it) { return typeof it === "string" ? it : it && it.text; }
  function itemIcon(it) { return typeof it === "string" ? undefined : it && it.icon; }

  // ---- reveal planning ------------------------------------------------------------------
  /* Reveal time per index for `n` items of one cue kind: cued ones at their word start, the rest
   * spread in order through the scene's first part (from 0.4 s to 65 % of the duration) or
   * between their cued neighbours. */
  function revealTimes(n, cuedTimes, duration) {
    var start = 0.4, end = Math.max(start + 0.6, duration * 0.65);
    var t = cuedTimes.slice(0, n);
    var known = [];
    for (var i = 0; i < n; i++) if (typeof t[i] === "number") known.push(i);
    if (!known.length) {
      for (var j = 0; j < n; j++) t[j] = n === 1 ? start : start + j * (end - start) / (n - 1);
      return t;
    }
    var first = known[0], last = known[known.length - 1];
    var lo = Math.min(start, t[first] * 0.5);
    for (var a = 0; a < first; a++) t[a] = lo + a * (t[first] - lo) / first;
    for (var k = 0; k + 1 < known.length; k++) {
      var p = known[k], q = known[k + 1];
      for (var m = p + 1; m < q; m++) t[m] = t[p] + (m - p) * (t[q] - t[p]) / (q - p);
    }
    var hi = Math.max(end, t[last] + 0.7 * (n - 1 - last));
    hi = Math.min(hi, Math.max(t[last] + 0.3 * (n - last), duration - 0.3));
    for (var b = last + 1; b < n; b++) t[b] = t[last] + (b - last) * (hi - t[last]) / (n - last);
    return t;
  }

  /* cue lists -> {kind: [seconds]} for this scene's counts {kind: n}. Cue index defaults to 0. */
  function planReveals(counts, cues, words, duration, sceneId) {
    var cued = {};
    Object.keys(counts).forEach(function (k) { cued[k] = []; });
    (cues || []).forEach(function (c) {
      var kind = c.show === "point" && c.side ? "point-" + c.side : c.show;
      if (!cued[kind]) return;
      cued[kind][c.index || 0] = K.wordTime(words, c.at, sceneId);
    });
    var out = {};
    Object.keys(counts).forEach(function (k) { out[k] = revealTimes(counts[k], cued[k], duration); });
    return out;
  }

  /* Generic cue check against counts {kind: n}; extra(c) may return a message. */
  function checkCues(name, counts, cues, extra) {
    var errs = [];
    (cues || []).forEach(function (c, i) {
      var where = name + ": cue " + i + " ";
      if (!c || typeof c !== "object") { errs.push(where + "is malformed"); return; }
      var kind = c.show === "point" && c.side !== undefined ? "point-" + c.side : c.show;
      if (c.show === "point" && counts["point-left"] !== undefined && ["left", "right"].indexOf(c.side) < 0) { errs.push(where + "needs side left or right"); return; }
      if (counts[kind] === undefined) { errs.push(where + "unknown cue kind " + c.show + " (have: " + Object.keys(counts).join(", ") + ")"); return; }
      var idx = c.index === undefined ? 0 : c.index;
      if (!(Number.isInteger(idx) && idx >= 0 && idx < counts[kind])) errs.push(where + "index " + idx + " out of range (" + kind + " has " + counts[kind] + ")");
      var more = extra && extra(c);
      if (more) errs.push(where + more);
    });
    return errs;
  }

  // ---- text fitting ---------------------------------------------------------------------
  function textWidth(text, size, kind) { return String(text).length * size * (EM[kind || "body"]); }
  /* Greedy word wrap with estimated widths: number of lines `text` needs in `width`. */
  function lineCount(text, size, width, kind) {
    var words = String(text).split(/\s+/), lines = 1, cur = 0, sp = size * EM[kind || "body"];
    words.forEach(function (w) {
      var ww = textWidth(w, size, kind);
      if (cur > 0 && cur + sp + ww > width) { lines++; cur = ww; } else cur += (cur > 0 ? sp : 0) + ww;
    });
    return lines;
  }
  /* Largest size from `sizes` (descending) at which text fits `maxLines` lines in `width`. */
  function fitText(text, width, sizes, maxLines, kind) {
    for (var i = 0; i < sizes.length; i++) if (lineCount(text, sizes[i], width, kind) <= maxLines) return { size: sizes[i], lines: lineCount(text, sizes[i], width, kind) };
    var s = sizes[sizes.length - 1];
    return { size: s, lines: lineCount(text, s, width, kind) };
  }
  function range(from, to, step) { var out = []; for (var s = from; s >= to; s -= step) out.push(s); return out; }

  /* Title block at the top of the box: {box, size, lines}. Optional; height 0 when absent. */
  function titleGeom(title, box, maxSize) {
    if (!title) return null;
    var f = fitText(title, box.width, range(maxSize || 72, 44, 4), 2, "heading");
    var h = Math.ceil(f.size * 1.16 * f.lines);
    return { text: title, x: box.x, y: box.y, width: box.width, height: h, size: f.size, lines: f.lines, bar: { x: box.x, y: box.y + h + 14, width: 120, height: 8 } };
  }

  // ---- DOM helpers ----------------------------------------------------------------------
  function div(parent, cls, rect, styles) {
    var d = parent.ownerDocument.createElement("div");
    if (cls) d.className = cls;
    d.style.position = "absolute";
    if (rect) { d.style.left = D.r2(rect.x) + "px"; d.style.top = D.r2(rect.y) + "px"; if (rect.width !== undefined) d.style.width = D.r2(rect.width) + "px"; if (rect.height !== undefined) d.style.height = D.r2(rect.height) + "px"; }
    for (var k in styles || {}) d.style[k] = styles[k];
    parent.appendChild(d);
    return d;
  }
  /* A text box (class hf-text): font from style tokens; align left|center|right. */
  function text(parent, str, rect, o) {
    o = o || {};
    var st = o.style;
    var d = div(parent, "hf-text" + (o.cls ? " " + o.cls : ""), rect, {
      fontFamily: o.heading ? st.fonts.heading : st.fonts.body, fontWeight: String(o.weight || (o.heading ? 700 : 600)),
      fontSize: o.size + "px", lineHeight: String(o.lineHeight || 1.16), color: o.color || st.colors.text, textAlign: o.align || "left",
      whiteSpace: o.nowrap ? "nowrap" : "normal", overflow: "visible", letterSpacing: o.heading ? "-0.01em" : "0", boxSizing: "border-box",
      display: "flex", alignItems: o.valign || "flex-start", justifyContent: o.align === "center" ? "center" : o.align === "right" ? "flex-end" : "flex-start",
    });
    var span = parent.ownerDocument.createElement("span");
    span.textContent = str;
    span.style.display = "block";
    span.style.maxWidth = "100%";
    d.appendChild(span);
    if (o.key) d.dataset.key = o.key;
    if (o.nowrap) { d.classList.add("hf-fit"); d.dataset.size = o.size; }
    return d;
  }

  /* One-line texts (class hf-fit) shrink to their box if the real font is wider than the
   * estimate (never below MIN_TEXT). Transforms do not change scroll/client widths. */
  function fitLines(els) {
    els.forEach(function (e) {
      var base = +e.dataset.size;
      e.style.fontSize = base + "px";
      if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) {
        e.style.fontSize = Math.max(MIN_TEXT, Math.floor(base * e.clientWidth / e.scrollWidth)) + "px";
      }
    });
  }

  /* Icon disc: gradient-filled circle with a soft glow, an icon (or a number) and a progress ring.
   * Returns {el, ring, setRing(u), setActive(a)}; el is centred on (cx, cy). */
  function iconDisc(parent, cx, cy, size, o) {
    var st = o.style, col = o.color || st.colors.primary, doc = parent.ownerDocument;
    var wrap = div(parent, "hf-disc", { x: cx - size / 2, y: cy - size / 2, width: size, height: size });
    var glow = div(wrap, "hf-disc-glow", { x: -size * 0.35, y: -size * 0.35, width: size * 1.7, height: size * 1.7 },
      { borderRadius: "50%", background: "radial-gradient(closest-side, " + D.alpha(col, 0.38) + ", " + D.alpha(col, 0) + ")" });
    var face = div(wrap, "hf-disc-face", { x: 0, y: 0, width: size, height: size }, {
      borderRadius: "50%", boxSizing: "border-box",
      background: "radial-gradient(circle at 35% 30%, " + D.tint(col, 0.28) + " 0%, " + col + " 55%, " + D.shade(col, 0.3) + " 100%)",
      boxShadow: "0 14px 30px rgba(2,6,23,0.45), inset 0 -6px 14px " + D.alpha(D.shade(col, 0.5), 0.45) + ", inset 0 4px 10px rgba(255,255,255,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center", color: o.ink || "#0B1220",
    });
    if (o.icon) face.innerHTML = K.icons.svg(o.icon, Math.round(size * 0.52), o.ink || "#0B1220", 2.1);
    else if (o.number !== undefined) {
      face.style.fontFamily = st.fonts.heading; face.style.fontWeight = "800"; face.style.fontSize = Math.round(size * 0.46) + "px";
      face.textContent = String(o.number);
    }
    var R = size / 2 + 9, C = 2 * Math.PI * R;
    var ringSvg = doc.createElementNS(D.NS, "svg");
    ringSvg.setAttribute("width", 2 * R + 12); ringSvg.setAttribute("height", 2 * R + 12);
    ringSvg.style.cssText = "position:absolute;left:" + (size / 2 - R - 6) + "px;top:" + (size / 2 - R - 6) + "px;overflow:visible";
    wrap.appendChild(ringSvg);
    var ring = D.el(ringSvg, "circle", { cx: R + 6, cy: R + 6, r: R, fill: "none", stroke: o.ringColor || st.colors.accent, "stroke-width": 5, "stroke-linecap": "round",
      transform: "rotate(-90 " + (R + 6) + " " + (R + 6) + ")" });
    return {
      el: wrap, face: face, glow: glow,
      setRing: function (u) { ring.setAttribute("stroke-dasharray", D.r2(C) + " " + D.r2(C)); ring.setAttribute("stroke-dashoffset", D.r2(C * (1 - D.clamp(u)))); ring.setAttribute("opacity", u > 0.001 ? 1 : 0); },
      setActive: function (a) { glow.style.opacity = D.r2(0.35 + 0.65 * a); glow.style.transform = "scale(" + Math.round((0.9 + 0.2 * a) * 1000) / 1000 + ")"; },
    };
  }

  /* Heading with an accent bar that draws on: returns update(t). */
  function titleBlock(stage, g, st, t0) {
    if (!g) return function () {};
    var el = text(stage, g.text, g, { style: st, heading: true, size: g.size, key: "title", weight: 800 });
    var bar = div(stage, "hf-title-bar", g.bar, { borderRadius: "4px", background: "linear-gradient(90deg, " + st.colors.accent + ", " + D.alpha(st.colors.accent, 0.2) + ")", transformOrigin: "0 50%" });
    return function (t) {
      D.applyIn(el, D.buildIn(t, t0, 0.6, 22));
      var k = D.ease.inOut(D.prog(t, t0 + 0.25, t0 + 0.95));
      bar.style.transform = "scaleX(" + D.r2(k) + ")";
      bar.style.opacity = k > 0 ? "1" : "0";
    };
  }

  // ---- mount wrapper --------------------------------------------------------------------
  /* Shared mount: shell, plan, camera. def.render(ctx) returns update(t). */
  function mountScene(def, rootEl, opts) {
    opts = opts || {};
    var errs = def.validate(opts.props);
    if (errs.length) throw new Error("scene " + opts.sceneId + ": " + errs.join("; "));
    var cerrs = def.validateCues(opts.props, opts.cues || []);
    if (cerrs.length) throw new Error("scene " + opts.sceneId + ": " + cerrs.join("; "));
    var duration = opts.duration || 8;
    var sh = K.shell(rootEl, { presenter: opts.presenter, style: opts.style, seed: opts.sceneId || 1 });
    var plan = def.plan(Object.assign({}, opts, { duration: duration }));
    var frame = K.kitFrame();
    var norm = K.normaliseAnchors(plan.anchors, frame.origin);
    var keys = K.resolveCamera(opts.camera || [], opts.words || [], opts.sceneId, norm);
    var still = { x: 0.5, y: 0.5, zoom: 1 };
    var useDrift = opts.drift !== false;
    var body = div(sh.layers.stage, "hf-body", { x: 0, y: plan.dy, width: K.CANVAS.width, height: K.CANVAS.height });
    var draw = def.render({ stage: body, overlay: sh.layers.overlay, plan: plan, props: opts.props, style: sh.style, duration: duration, shell: sh });
    var fits = Array.prototype.slice.call(rootEl.querySelectorAll(".hf-fit"));
    function update(t) {
      sh.update(t);
      var pose = keys.length ? K.cameraAt(keys, t, norm, KIT_CAMERA) : still;
      var v = K.view(pose, frame, useDrift ? K.drift(t, duration, opts.sceneId || 1) : null, plan.anchors.center);
      sh.layers.stage.style.transform = v.css;
      draw(t);
      fitLines(fits);
    }
    update(0);
    return { update: update, anchors: plan.anchors, shell: sh, plan: plan };
  }

  /* Register a scene: def = {name, meta, check(props, v), counts(props), cueExtra?(c, props),
   * geometry(props, box, style, presenter), reveal?(plan, props, opts), render(ctx)}. */
  function register(def) {
    var name = def.name;
    var scene = {
      name: name,
      meta: def.meta,
      validate: function (props) {
        var errs = [];
        if (!props || typeof props !== "object" || Array.isArray(props)) return [name + ": props must be an object"];
        def.check(props, V(name, errs));
        return errs;
      },
      validateCues: function (props, cues) {
        return checkCues(name, def.counts(props), cues, def.cueExtra ? function (c) { return def.cueExtra(c, props); } : null);
      },
      plan: function (opts) {
        var style = K.resolveStyle(opts.style);
        var L = K.layout(style, opts.presenter);
        var duration = opts.duration || 8;
        var g = def.geometry(opts.props, K.driftSafe(L.content), style, L);
        var reveal = def.reveal ? def.reveal(opts, duration) : planReveals(def.counts(opts.props), opts.cues, opts.words, duration, opts.sceneId);
        g.anchors = g.anchors || {};
        // centre the whole block (title + body) vertically in the drift-safe box: the scene draws
        // in its own coordinates inside a layer moved by dy; boxes and anchors are reported moved
        var safe = K.driftSafe(L.content);
        var top = Math.min.apply(null, g.boxes.map(function (b) { return b.y; }));
        var bottom = Math.max.apply(null, g.boxes.map(function (b) { return b.y + b.height; }));
        var dy = Math.round(safe.y + safe.height / 2 - (top + bottom) / 2);
        dy = Math.max(safe.y - top, Math.min(safe.y + safe.height - bottom, dy));
        g.boxes = g.boxes.map(function (b) { return Object.assign({}, b, { y: b.y + dy }); });
        Object.keys(g.anchors).forEach(function (k) { g.anchors[k] = { x: g.anchors[k].x, y: g.anchors[k].y + dy }; });
        g.anchors.center = { x: L.content.x + L.content.width / 2, y: L.content.y + L.content.height / 2 };
        return Object.assign(g, { reveal: reveal, box: L.content, layout: L, style: style, dy: dy });
      },
    };
    scene.mount = function (rootEl, opts) { return mountScene({ validate: scene.validate, validateCues: scene.validateCues, plan: scene.plan, render: def.render }, rootEl, opts); };
    K.scenes[name] = scene;
    if (K.SCENE_NAMES.indexOf(name) < 0) K.SCENE_NAMES.push(name);
    return scene;
  }

  K.sceneKit = {
    LIMITS: LIMITS, MIN_TEXT: MIN_TEXT, EM: EM, KIT_CAMERA: KIT_CAMERA,
    register: register, revealTimes: revealTimes, planReveals: planReveals, checkCues: checkCues,
    itemText: itemText, itemIcon: itemIcon, textWidth: textWidth, lineCount: lineCount, fitText: fitText, range: range,
    titleGeom: titleGeom, titleBlock: titleBlock, div: div, text: text, iconDisc: iconDisc, fitLines: fitLines,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
