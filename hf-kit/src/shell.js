/* hf-kit scene shell: style tokens, layout boxes (same rule as the Remotion templates:
 * templates/src/theme.ts presenterBox/contentBox), the camera view maths, calm drift, the
 * layered scene element (background, stage, presenter slot, caption bar) and word-highlighted
 * captions. Classic script: load after kit.js, timing.js and draw.js. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw) throw new Error("shell.js: load kit.js, timing.js and draw.js first");
  var D = K.draw;
  var W = K.CANVAS.width, H = K.CANVAS.height;

  var PRESENTER_WIDTH = { large: 0.34, small: 0.22 };
  var PRESENTER_EDGE = 24; // presenter box distance from the frame edge (he is a drawing, not text)
  var PRESENTER_GAP = 40;  // free space between presenter and content

  /* Full style tokens: `style` (partial, e.g. style.json) over the default dark navy + orange look. */
  function resolveStyle(style) {
    var s = style || {}, d = K.tokens;
    return {
      colors: Object.assign({}, d.colors, s.colors || {}),
      fonts: Object.assign({}, d.fonts, s.fonts || {}),
      sizes: Object.assign({}, d.sizes, s.sizes || {}),
      safe: s.safe === undefined ? d.safe : s.safe,
    };
  }

  /* {canvas, content, presenterBox, captionTop, safe}. presenter = {position: left|right|none,
   * size: small|large} (shots.json presenter; other fields ignored). The presenter takes 22 % /
   * 34 % of the width on his side and stands on the caption line; content never meets him. */
  function layout(style, presenter) {
    var s = resolveStyle(style);
    var pr = presenter || { position: "none", size: "small" };
    var pos = pr.position || "none", size = pr.size || "small";
    if (["left", "right", "none"].indexOf(pos) < 0) throw new Error("layout: unknown presenter position " + pos);
    if (!PRESENTER_WIDTH[size]) throw new Error("layout: unknown presenter size " + size);
    var top = K.captionTop(s), safe = s.safe;
    var pbox = null;
    if (pos !== "none") {
      var width = Math.round(W * PRESENTER_WIDTH[size]);
      var height = Math.min(top - PRESENTER_EDGE, Math.round(width * 1.08));
      pbox = { x: pos === "left" ? PRESENTER_EDGE : W - PRESENTER_EDGE - width, y: top - height, width: width, height: height };
    }
    var content;
    if (!pbox) content = { x: safe, y: safe, width: W - 2 * safe, height: top - safe };
    else if (pos === "left") {
      var x = Math.max(safe, pbox.x + pbox.width + PRESENTER_GAP);
      content = { x: x, y: safe, width: W - safe - x, height: top - safe };
    } else {
      var right = Math.min(W - safe, pbox.x - PRESENTER_GAP);
      content = { x: safe, y: safe, width: right - safe, height: top - safe };
    }
    return { canvas: { width: W, height: H }, content: content, presenterBox: pbox, captionTop: top, safe: safe, presenter: { position: pos, size: size } };
  }

  // ---- camera view ----------------------------------------------------------------------
  /* A frame says how normalised camera poses ({x, y} 0..1 over `origin`, zoom) map to screen:
   * the posed point lands on `center` at `scale` x zoom. */
  function kitFrame() {
    return { origin: { x: 0, y: 0, width: W, height: H }, center: { x: W / 2, y: H / 2 }, scale: 1 };
  }
  /* Hero props: the prop's focus region fits the content box at zoom 1 (wide). */
  function heroFrame(region, box) {
    var s = Math.min(box.width / region.width, box.height / region.height);
    return { origin: region, center: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, scale: s };
  }
  /* pose {x, y, zoom} (from HFKit.cameraAt) + optional drift {x, y, zoom} -> {scale, tx, ty,
   * css, toScreen(wx, wy)} for a layer drawn in world coordinates (transform-origin 0 0). The
   * drift zooms about `driftCenter` (screen px; default the frame centre), e.g. the content box
   * centre so content grows evenly toward its margins. */
  function view(pose, frame, drift, driftCenter) {
    var d = drift || { x: 0, y: 0, zoom: 1 };
    var o = frame.origin, dc = driftCenter || frame.center;
    var px = o.x + pose.x * o.width, py = o.y + pose.y * o.height;
    var s0 = frame.scale * pose.zoom;
    var tx0 = frame.center.x - px * s0, ty0 = frame.center.y - py * s0;
    var s = s0 * d.zoom;
    var tx = dc.x + (tx0 - dc.x) * d.zoom + d.x, ty = dc.y + (ty0 - dc.y) * d.zoom + d.y;
    return {
      scale: s, tx: tx, ty: ty,
      css: "translate(" + D.r2(tx) + "px," + D.r2(ty) + "px) scale(" + Math.round(s * 10000) / 10000 + ")",
      toScreen: function (wx, wy) { return { x: tx + wx * s, y: ty + wy * s }; },
    };
  }
  /* Anchors in world px -> normalised over a frame's origin (functions of t stay functions). */
  function normaliseAnchors(anchors, origin) {
    var out = {};
    Object.keys(anchors || {}).forEach(function (k) {
      var a = anchors[k];
      out[k] = typeof a === "function"
        ? function (t) { var p = a(t); return { x: (p.x - origin.x) / origin.width, y: (p.y - origin.y) / origin.height }; }
        : { x: (a.x - origin.x) / origin.width, y: (a.y - origin.y) / origin.height };
    });
    return out;
  }

  /* Room kit scenes leave inside the content box so drift never pushes text out of it. */
  var DRIFT_INSET = { x: 26, y: 16 };
  function driftSafe(box) { return { x: box.x + DRIFT_INSET.x, y: box.y + DRIFT_INSET.y, width: box.width - 2 * DRIFT_INSET.x, height: box.height - 2 * DRIFT_INSET.y }; }

  /* Calm drift for kit scenes: a slow push of up to 2.5 % over the scene plus a few px of float. */
  function drift(t, duration, seed) {
    var u = D.clamp(t / Math.max(0.1, duration || 1));
    return { x: 6 * D.wobble(t * 0.35, seed || 1), y: 4 * D.wobble(t * 0.3, (seed || 1) + 7), zoom: 1 + 0.025 * D.ease.inOutSine(u) };
  }

  // ---- shell element --------------------------------------------------------------------
  function css(e, rules) { for (var k in rules) e.style[k] = rules[k]; return e; }
  function abs(e, b) { return css(e, { position: "absolute", left: b.x + "px", top: b.y + "px", width: b.width + "px", height: b.height + "px" }); }

  /* Build the scene layers inside `el` (a 1920 x 1080 box): background (soft lit gradient,
   * slowly drifting colour glows, faint dot grid), stage (world layer the camera moves),
   * presenter slot and caption slot. Returns {content, presenterBox, captionTop, layout, style,
   * layers: {bg, stage, overlay, presenter, captions}, update(t)}. */
  function shell(el, opts) {
    opts = opts || {};
    var style = resolveStyle(opts.style);
    var L = layout(style, opts.presenter);
    var c = style.colors, doc = el.ownerDocument;
    el.innerHTML = "";
    css(el, { position: el.style.position || "absolute", overflow: "hidden", width: W + "px", height: H + "px" });
    if (!el.style.left && !el.style.inset) css(el, { left: "0px", top: "0px" });
    function div(cls, parent) { var d = doc.createElement("div"); d.className = cls; (parent || el).appendChild(d); return d; }

    var bg = abs(div("hf-bg"), { x: 0, y: 0, width: W, height: H });
    bg.style.background = "radial-gradient(ellipse 80% 70% at 50% 40%, " + D.tint(c.background, 0.07) + " 0%, " + c.background + " 60%, " + D.shade(c.background, 0.35) + " 100%)";
    var glowA = abs(div("hf-glow", bg), { x: -260, y: -300, width: 1100, height: 900 });
    glowA.style.background = "radial-gradient(closest-side, " + D.alpha(c.primary, 0.16) + ", " + D.alpha(c.primary, 0) + ")";
    var glowB = abs(div("hf-glow", bg), { x: 1080, y: 380, width: 1200, height: 900 });
    glowB.style.background = "radial-gradient(closest-side, " + D.alpha(c.accent, 0.11) + ", " + D.alpha(c.accent, 0) + ")";
    var grid = abs(div("hf-grid", bg), { x: -40, y: -40, width: W + 80, height: H + 80 });
    grid.style.backgroundImage = "radial-gradient(" + D.alpha(c.text, 0.07) + " 1.6px, transparent 1.8px)";
    grid.style.backgroundSize = "48px 48px";
    var vignette = abs(div("hf-vignette", bg), { x: 0, y: 0, width: W, height: H });
    vignette.style.background = "radial-gradient(ellipse 75% 70% at 50% 45%, rgba(2,6,23,0) 60%, rgba(2,6,23,0.55) 100%)";

    var stage = abs(div("hf-stage"), { x: 0, y: 0, width: W, height: H });
    stage.style.transformOrigin = "0 0";
    var overlay = abs(div("hf-overlay"), { x: 0, y: 0, width: W, height: H });
    var presenter = L.presenterBox ? abs(div("hf-presenter"), L.presenterBox) : null;
    var captions = abs(div("hf-captions"), { x: style.safe, y: L.captionTop, width: W - 2 * style.safe, height: H - L.captionTop });
    var seed = opts.seed || 1;

    function update(t) {
      glowA.style.transform = "translate(" + D.r2(40 * D.wobble(t * 0.12, seed)) + "px," + D.r2(30 * D.wobble(t * 0.1, seed + 3)) + "px)";
      glowB.style.transform = "translate(" + D.r2(50 * D.wobble(t * 0.1, seed + 5)) + "px," + D.r2(30 * D.wobble(t * 0.13, seed + 9)) + "px)";
      grid.style.transform = "translate(" + D.r2(-(t * 3) % 48) + "px,0px)";
    }
    update(0);
    return { content: L.content, presenterBox: L.presenterBox, captionTop: L.captionTop, layout: L, style: style,
      layers: { bg: bg, stage: stage, overlay: overlay, presenter: presenter, captions: captions }, update: update };
  }

  // ---- captions -------------------------------------------------------------------------
  /* Word-highlighted captions in the caption slot (from shell().layers.captions). Fixed pages of
   * `maxWords` words (HFKit.captionPage); the spoken word is in the accent colour, words not yet
   * spoken are dimmed. Returns {update(t)}. */
  function mountCaptions(el, opts) {
    var style = resolveStyle(opts.style);
    var words = opts.words || [];
    var maxWords = opts.maxWords || 7;
    var doc = el.ownerDocument;
    el.innerHTML = "";
    var bar = doc.createElement("div");
    bar.className = "hf-caption-bar";
    css(bar, { position: "absolute", left: "50%", top: "28px", transform: "translateX(-50%)", maxWidth: (el.clientWidth || W - 2 * style.safe) + "px",
      padding: "10px 30px 12px", borderRadius: "22px", background: "rgba(2,6,23,0.62)", boxShadow: "0 8px 30px rgba(2,6,23,0.35)",
      fontFamily: style.fonts.body, fontWeight: "600", fontSize: style.sizes.caption + "px", lineHeight: "1.32", textAlign: "center",
      color: style.colors.text, whiteSpace: "normal", boxSizing: "border-box", width: "max-content" });
    el.appendChild(bar);
    var shown = null, spans = [];
    function update(t) {
      if (!words.length) { bar.style.opacity = "0"; return; }
      var pg = K.captionPage(words, t, maxWords);
      var key = pg.words.length ? pg.words[0].i : -1;
      if (key !== shown) {
        bar.innerHTML = "";
        spans = pg.words.map(function (w, j) {
          var s = doc.createElement("span");
          s.className = "hf-caption-word";
          s.textContent = w.text + (j < pg.words.length - 1 ? " " : "");
          bar.appendChild(s);
          return s;
        });
        shown = key;
      }
      spans.forEach(function (s, j) {
        s.style.color = j === pg.current ? style.colors.accent : j < pg.current ? style.colors.text : D.alpha(style.colors.text, 0.55);
      });
      var first = words[0].start, last = words[words.length - 1].end;
      bar.style.opacity = D.r2(Math.min(D.prog(t, first - 0.25, first), 1 - D.prog(t, last + 0.6, last + 0.9)));
    }
    update(0);
    return { update: update, el: bar };
  }

  Object.assign(K, {
    PRESENTER_WIDTH: PRESENTER_WIDTH, resolveStyle: resolveStyle, layout: layout,
    kitFrame: kitFrame, heroFrame: heroFrame, driftSafe: driftSafe, DRIFT_INSET: DRIFT_INSET, view: view, normaliseAnchors: normaliseAnchors, drift: drift,
    shell: shell, mountCaptions: mountCaptions,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
