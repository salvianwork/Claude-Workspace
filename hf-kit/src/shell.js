/* hf-kit scene shell: style tokens, layout boxes (same rule as the Remotion templates:
 * templates/src/theme.ts presenterBox/contentBox), the camera view maths, calm drift, the
 * layered scene element (background, stage, presenter slot, caption bar) and word-highlighted
 * captions. Classic script: load after kit.js, timing.js and draw.js. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw) throw new Error("shell.js: load kit.js, timing.js and draw.js first");
  var D = K.draw;
  /* The canvas is read per call (HFKit.setCanvas may change it before a composition mounts). */
  function canvas() { return K.CANVAS; }

  var PRESENTER_WIDTH = { large: 0.34, small: 0.22 };
  var PRESENTER_EDGE = 24; // presenter box distance from the frame edge (he is a drawing, not text)
  var PRESENTER_GAP = 40;  // free space between presenter and content

  var CAPTION_POSITIONS = ["bottom", "top"];

  /* Full style tokens: `style` (partial, e.g. style.json) over the default dark navy + orange look.
   * style.captions = {size?, position?: "bottom" | "top"} (style.json) sets the caption size (over
   * sizes.caption) and where the caption band sits. */
  function resolveStyle(style) {
    var s = style || {}, d = K.tokens, cap = s.captions || {};
    var sizes = Object.assign({}, d.sizes, s.sizes || {});
    if (cap.size !== undefined) {
      if (!(typeof cap.size === "number" && cap.size >= 24 && cap.size <= 120)) throw new Error("style: captions.size must be a number of px from 24 to 120");
      sizes.caption = cap.size;
    }
    var position = cap.position === undefined ? "bottom" : cap.position;
    if (CAPTION_POSITIONS.indexOf(position) < 0) throw new Error('style: captions.position must be "bottom" or "top", got ' + position);
    return {
      colors: Object.assign({}, d.colors, s.colors || {}),
      fonts: Object.assign({}, d.fonts, s.fonts || {}),
      sizes: sizes,
      safe: s.safe === undefined ? d.safe : s.safe,
      captions: { size: sizes.caption, position: position },
    };
  }

  /* {canvas, content, presenterBox, captionTop, captionBand, captions, safe}. presenter =
   * {position: left|right|none, size: small|large} (shots.json presenter; other fields ignored).
   * The presenter takes 22 % / 34 % of the width on his side and stands on the caption line;
   * content never meets him. Captions at the bottom (default): the band runs from captionTop to the
   * frame's foot. Captions at the top: the band is the top safe margin plus the caption reserve,
   * content starts below it, and captionTop is the bottom safe line (nothing but captions above
   * the band, nothing at all below captionTop). */
  function layout(style, presenter) {
    var s = resolveStyle(style);
    var pr = presenter || { position: "none", size: "small" };
    var pos = pr.position || "none", size = pr.size || "small";
    if (["left", "right", "none"].indexOf(pos) < 0) throw new Error("layout: unknown presenter position " + pos);
    if (!PRESENTER_WIDTH[size]) throw new Error("layout: unknown presenter size " + size);
    var W = canvas().width, H = canvas().height;
    var safe = s.safe, onTop = s.captions.position === "top";
    var top = onTop ? H - safe : K.captionTop(s);
    var band = onTop ? { x: safe, y: 0, width: W - 2 * safe, height: safe + K.captionReserve(s) } : { x: safe, y: top, width: W - 2 * safe, height: H - top };
    var y0 = onTop ? band.height : safe;
    var pbox = null;
    if (pos !== "none") {
      var width = Math.round(W * PRESENTER_WIDTH[size]);
      var height = Math.min(top - (onTop ? y0 : PRESENTER_EDGE), Math.round(width * 1.08));
      pbox = { x: pos === "left" ? PRESENTER_EDGE : W - PRESENTER_EDGE - width, y: top - height, width: width, height: height };
    }
    var content;
    if (!pbox) content = { x: safe, y: y0, width: W - 2 * safe, height: top - y0 };
    else if (pos === "left") {
      var x = Math.max(safe, pbox.x + pbox.width + PRESENTER_GAP);
      content = { x: x, y: y0, width: W - safe - x, height: top - y0 };
    } else {
      var right = Math.min(W - safe, pbox.x - PRESENTER_GAP);
      content = { x: safe, y: y0, width: right - safe, height: top - y0 };
    }
    return { canvas: { width: W, height: H }, content: content, presenterBox: pbox, captionTop: top, captionBand: band, captions: s.captions,
      safe: safe, presenter: { position: pos, size: size } };
  }

  // ---- camera view ----------------------------------------------------------------------
  /* A frame says how normalised camera poses ({x, y} 0..1 over `origin`, zoom) map to screen:
   * the posed point lands on `center` at `scale` x zoom. */
  function kitFrame() {
    var W = canvas().width, H = canvas().height;
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

  /* Build the scene layers inside `el` (a canvas-sized box, HFKit.CANVAS): background (soft lit gradient,
   * slowly drifting colour glows, faint dot grid), stage (world layer the camera moves),
   * presenter slot and caption slot. Returns {content, presenterBox, captionTop, layout, style,
   * layers: {bg, stage, overlay, presenter, captions}, update(t)}. */
  function shell(el, opts) {
    opts = opts || {};
    var style = resolveStyle(opts.style);
    var L = layout(style, opts.presenter);
    var c = style.colors, doc = el.ownerDocument, W = canvas().width, H = canvas().height;
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
    var captions = abs(div("hf-captions"), L.captionBand);
    captions.setAttribute("data-position", L.captions.position);
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
  /* The word as the caption shows it: words.json `display` (script token with punctuation) if
   * present, else `text`. */
  function captionWord(w) { return w.display || w.text; }

  /* Word-highlighted captions in the caption slot (from shell().layers.captions): a dark pill
   * (style captions.size, 60 px by default) centred in the band, 28 px below its top edge
   * (bottom band) or 28 px above its bottom edge (top band). Fixed pages of `maxWords` words
   * (HFKit.captionPage); the spoken word is in the accent colour on a soft accent highlight,
   * words not yet spoken are dimmed. Returns {update(t), el}. */
  function mountCaptions(el, opts) {
    var style = resolveStyle(opts.style);
    var words = opts.words || [];
    var maxWords = opts.maxWords || 7;
    var doc = el.ownerDocument;
    var vert = isVertical(), VC = VERTICAL_CAPTION, BAND = K.VERTICAL.captionBand;
    var fs = vert ? VC.size : style.sizes.caption, onTop = !vert && style.captions.position === "top";
    var pages = vert ? captionPages(words, { size: fs }) : null;
    el.innerHTML = "";
    var bar = doc.createElement("div");
    bar.className = "hf-caption-bar";
    css(bar, { position: "absolute", left: "50%", transform: "translateX(-50%)", maxWidth: (vert ? VC.maxWidth : el.clientWidth || canvas().width - 2 * style.safe) + "px",
      padding: Math.round(fs * 0.16) + "px " + captionPadX(fs) + "px " + Math.round(fs * 0.2) + "px", borderRadius: vert ? "44px" : "999px",
      background: "rgba(2,6,23,0.72)", boxShadow: "0 10px 34px rgba(2,6,23,0.38), inset 0 0 0 2px rgba(255,255,255,0.06)",
      fontFamily: style.fonts.body, fontWeight: "600", fontSize: fs + "px", lineHeight: vert ? String(VC.lineHeight) : "1.3", textAlign: "center",
      color: style.colors.text, whiteSpace: "normal", boxSizing: "border-box", width: "max-content" });
    if (vert) { bar.style.overflowWrap = "anywhere"; bar.style.top = VC.top + "px"; }
    else if (onTop) bar.style.bottom = "28px"; else bar.style.top = "28px";
    el.appendChild(bar);
    var shown = null, spans = [], opacity = 0, pageNow = null;
    function update(t) {
      if (!words.length) { bar.style.opacity = "0"; opacity = 0; return; }
      var pg = vert ? captionPageAt(pages, words, t) : K.captionPage(words, t, maxWords);
      pageNow = pg.page || null;
      var key = pg.words.length ? pg.words[0].i : -1;
      if (key !== shown) {
        bar.innerHTML = "";
        spans = pg.words.map(function (w, j) {
          var s = doc.createElement("span");
          s.className = "hf-caption-word";
          s.textContent = captionWord(w) + (j < pg.words.length - 1 ? " " : "");
          bar.appendChild(s);
          return s;
        });
        shown = key;
      }
      spans.forEach(function (s, j) {
        s.style.color = j === pg.current ? style.colors.accent : j < pg.current ? style.colors.text : D.alpha(style.colors.text, 0.55);
        s.style.textShadow = j === pg.current ? "0 0 " + Math.round(fs * 0.3) + "px " + D.alpha(style.colors.accent, 0.45) : "none";
      });
      var first = words[0].start, last = words[words.length - 1].end;
      opacity = D.r2(Math.min(D.prog(t, first - 0.25, first), 1 - D.prog(t, last + 0.6, last + 0.9)));
      bar.style.opacity = opacity;
    }
    /* The pill's box in canvas px at t (vertical only; empty when it is hidden): the real size when the
     * browser has laid it out, else the page's estimate. Read after update(t). */
    function box(t) {
      if (!vert) return { x: 0, y: 0, width: 0, height: 0 };
      update(t);
      if (!(opacity > 0) || !pageNow) return { x: 0, y: 0, width: 0, height: 0 };
      var w = bar.offsetWidth > 0 ? bar.offsetWidth : pageNow.width;
      var h = bar.offsetHeight > 0 ? bar.offsetHeight : Math.round(pageNow.lines * fs * VC.lineHeight + fs * 0.36);
      return { x: Math.round((VC.x + (VC.maxWidth - w) / 2) * 100) / 100, y: BAND.top + VC.top, width: w, height: h };
    }
    update(0);
    return { update: update, el: bar, box: box };
  }

  // ---- vertical captions ----------------------------------------------------------------
  /* Vertical captions (Global Constraints): 64 px, at most 2 lines, max width 860, word highlight, in
   * the band VERTICAL.captionBand. The 860 px column sits inside the text safe zone (x 72 to 932). */
  var VERTICAL_CAPTION = Object.freeze({ size: 64, maxWidth: 860, maxLines: 2, x: 72, lineHeight: 1.15, top: 5 });
  var CAPTION_FIT = 1.05; // the width estimate is padded: a real font may be a little wider than the table

  function isVertical() { var c = canvas(); return c.height > c.width; }

  /* Width of `text` at `fs` px, from a fixed per-character table (Poppins / Inter semibold; no layout reads,
   * so pages and boxes are the same in a browser and under node --test). */
  function captionTextWidth(text, fs) {
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      w += c === " " ? 0.3 : /[iljtfr1.,:;'!|/]/.test(c) ? 0.36 : /[mwMW]/.test(c) ? 0.92 : /[A-Z]/.test(c) ? 0.7 : /[0-9]/.test(c) ? 0.62 : 0.6;
    }
    return w * fs * CAPTION_FIT;
  }
  function captionPadX(fs) { return Math.round(fs * 0.6); }

  /* Greedy wrap of word texts into lines of `inner` px: {lines, widest (px of the widest line), over (a
   * word wider than a line)}. */
  function wrapWords(texts, fs, inner) {
    var space = captionTextWidth(" ", fs), lines = 1, cur = 0, widest = 0, over = false;
    texts.forEach(function (t, i) {
      var w = captionTextWidth(t, fs);
      if (w > inner) over = true;
      if (i === 0) { cur = w; return; }
      if (cur + space + w <= inner) cur += space + w;
      else { widest = Math.max(widest, cur); lines += 1; cur = w; }
    });
    return { lines: lines, widest: Math.max(widest, cur), over: over };
  }

  /* Pages of words that each wrap to at most `maxLines` lines inside `maxWidth` (padding included):
   * [{from, words: [...], lines, width, over}] over the whole list. A word wider than a line gets a page
   * of its own with over = true (the build warns about it). */
  function captionPages(words, opts) {
    opts = opts || {};
    var fs = opts.size || VERTICAL_CAPTION.size, maxWidth = opts.maxWidth || VERTICAL_CAPTION.maxWidth, maxLines = opts.maxLines || VERTICAL_CAPTION.maxLines;
    var inner = maxWidth - 2 * captionPadX(fs), pages = [], cur = null;
    (words || []).forEach(function (w, i) {
      var text = captionWord(w);
      if (cur) {
        var fit = wrapWords(cur.texts.concat([text]), fs, inner);
        if (fit.lines <= maxLines && !fit.over) { cur.texts.push(text); cur.words.push(w); cur.fit = fit; return; }
      }
      cur = { from: i, words: [w], texts: [text], fit: wrapWords([text], fs, inner) };
      pages.push(cur);
    });
    return pages.map(function (p) {
      return { from: p.from, words: p.words, lines: p.fit.lines, width: Math.min(maxWidth, Math.ceil(p.fit.widest + 2 * captionPadX(fs))), over: p.fit.over };
    });
  }
  /* The page showing at t, as HFKit.captionPage does: {words, current, page}. */
  function captionPageAt(pages, words, t) {
    if (!pages.length) return { words: [], current: -1, page: null };
    var cur = -1;
    for (var i = 0; i < words.length; i++) if (words[i].start <= t) cur = i; else break;
    var pg = pages[0];
    for (var k = 0; k < pages.length; k++) if (pages[k].from <= Math.max(cur, 0)) pg = pages[k];
    return { words: pg.words, current: cur < 0 ? -1 : cur - pg.from, page: pg };
  }

  /* Vertical (1080 x 1920) layout zones. Owner 2026-11-25: host bigger; captions sit above his face zone. */
  var VERTICAL = Object.freeze({
    captionBand: Object.freeze({ top: 840, bottom: 1020 }),
    faceZone: Object.freeze({ top: 1060, bottom: 1400 }),
    safe: Object.freeze({ x0: 64, x1: 940, y0: 200, y1: 1420 }),
  });

  Object.assign(K, {
    VERTICAL: VERTICAL, VERTICAL_CAPTION: VERTICAL_CAPTION, captionPages: captionPages, captionPageAt: captionPageAt,
    captionTextWidth: captionTextWidth, isVertical: isVertical,
    PRESENTER_WIDTH: PRESENTER_WIDTH, CAPTION_POSITIONS: CAPTION_POSITIONS, resolveStyle: resolveStyle, layout: layout,
    kitFrame: kitFrame, heroFrame: heroFrame, driftSafe: driftSafe, DRIFT_INSET: DRIFT_INSET, view: view, normaliseAnchors: normaliseAnchors, drift: drift,
    shell: shell, mountCaptions: mountCaptions, captionWord: captionWord,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
