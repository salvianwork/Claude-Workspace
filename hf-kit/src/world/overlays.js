/* hf-kit data overlays: small tags that follow a point in the world ("343 m/s" riding on a sound
 * wave) and labels that name things, drawn in screen px in the scene's overlay layer.
 *
 *   var tag = HFKit.overlays.tag(overlayEl, {text, target, at?, until?, bounds?, accent?}, idPrefix);
 *   tag.update(t, screenPoint);   // screenPoint = the target's screen px at t (world.js computes it)
 *                                 // -> {opacity, clamped, point, side, x, y, width, height}
 *   tag.box(t, screenPoint?)      // the pill's {x, y, width, height} screen px (empty when hidden);
 *                                 // without screenPoint it uses the last update's point
 *   HFKit.overlays.label(...)     // same API: a dark name label centred on (or beside) its point,
 *                                 // spec.side = "center" (default) | "above" | "below" | "left" | "right"
 *   HFKit.overlays.countWords(text) -> words, a number and its unit counting as one ("343 m/s")
 *
 * Rules (Review Focus 3): text is at most 4 words (more throws). The pill always lies inside the
 * safe frame (bounds, default 96 px from every edge): when its point nears an edge or leaves the
 * frame, the pill is clamped to the edge, with a chevron pointing at the point once it is outside;
 * when the point is 200 px or more outside the frame the pill fades out (gone by 280 px). So a tag
 * is never drawn half off the frame. It pops in at `at` (0.3 s, soft overshoot) and fades after
 * `until`. Widths come from a fixed per-character estimate (no layout reads), so update and box are
 * pure functions of (t, screenPoint) in a browser and under node --test alike.
 * Classic script: load after draw.js; sets HFKit.overlays. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw) throw new Error("world/overlays.js: load kit.js and draw.js first");
  var D = K.draw, r2 = D.r2;
  var FRAME = { width: 1920, height: 1080 };
  var SAFE = 96, MAX_WORDS = 4, OUT_CLAMP = 200, OUT_GONE = 280, LEAD = 66;

  var NUM = /^[-+~≈]?\d[\d.,]*(%|°[CF]?|x|×)?$/;
  var UNIT = /^(%|°[CF]?|[A-Za-zµ°]{1,3}(\/[A-Za-z]{1,3})?[²³23]?|x|×)$/;
  function countWords(text) {
    var toks = String(text || "").trim().split(/\s+/).filter(Boolean), n = 0;
    for (var i = 0; i < toks.length; i++) {
      n += 1;
      if (NUM.test(toks[i]) && i + 1 < toks.length && UNIT.test(toks[i + 1])) i += 1; // "343 m/s"
    }
    return n;
  }
  function checkText(kind, text) {
    if (typeof text !== "string" || !text.trim()) throw new Error(kind + ": needs text");
    var n = countWords(text);
    if (n > MAX_WORDS) throw new Error(kind + " \"" + text + "\": " + n + " words (at most " + MAX_WORDS + ")");
  }

  /* Pill width estimate for Poppins / Inter semibold-bold: em widths per character class. */
  function textWidth(text, fs) {
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      w += c === " " ? 0.3 : /[iljtfr1.,:;'!|/]/.test(c) ? 0.36 : /[mwMW]/.test(c) ? 0.92 : /[A-Z]/.test(c) ? 0.7 : /[0-9]/.test(c) ? 0.62 : 0.6;
    }
    return w * fs;
  }

  function css(e, rules) { for (var k in rules) e.style[k] = rules[k]; return e; }
  function px(v) { return r2(v) + "px"; }

  function make(kind, el, spec, idPrefix) {
    spec = spec || {};
    checkText(kind, spec.text);
    if (!el || !el.ownerDocument) throw new Error(kind + ": needs an overlay element");
    var isTag = kind === "tag";
    var fs = spec.size || (isTag ? 38 : 34);
    var B = spec.bounds || { x: SAFE, y: SAFE, width: FRAME.width - 2 * SAFE, height: FRAME.height - 2 * SAFE };
    var padX = Math.round(fs * 0.62), padY = Math.round(fs * 0.24);
    var W = Math.ceil(textWidth(spec.text, fs) + 2 * padX + (isTag ? fs * 0.5 : 0)), H = Math.round(fs * 1.28 + 2 * padY);
    var accent = spec.accent || "#F59E0B", at = spec.at || 0, until = spec.until;
    var side = spec.side || (isTag ? "auto" : "center");
    var wrap = D.el(el, "html:div", { "data-overlay": kind, "data-id": idPrefix || "" });
    css(wrap, { position: "absolute", left: "0px", top: "0px", width: "0px", height: "0px", pointerEvents: "none", opacity: "0" });
    var svg = D.el(wrap, "svg", { width: FRAME.width, height: FRAME.height, viewBox: "0 0 " + FRAME.width + " " + FRAME.height, overflow: "visible" });
    css(svg, { position: "absolute", left: "0px", top: "0px", overflow: "visible" });
    var lead = isTag ? D.el(svg, "path", { fill: "none", stroke: "#FFFDF7", "stroke-width": 5, "stroke-linecap": "round" }) : null;
    var leadShade = isTag ? D.el(svg, "path", { fill: "none", stroke: "#0B1020", "stroke-width": 9, "stroke-linecap": "round", opacity: 0.25 }) : null;
    if (leadShade) svg.insertBefore(leadShade, lead);
    var dotRing = isTag ? D.el(svg, "circle", { r: 15, fill: "none", stroke: accent, "stroke-width": 4 }) : null;
    var dot = isTag ? D.el(svg, "circle", { r: 9, fill: accent, stroke: "#FFFDF7", "stroke-width": 4 }) : null;
    var chevron = D.el(svg, "path", { fill: isTag ? accent : "#FFFDF7", stroke: isTag ? "#FFFDF7" : "#0B1020", "stroke-width": 3, "stroke-linejoin": "round", visibility: "hidden" });
    var pill = D.el(wrap, "html:div", { class: "hf-" + kind }, spec.text);
    css(pill, { position: "absolute", left: "0px", top: "0px", width: px(W), height: px(H), boxSizing: "border-box", padding: padY + "px " + padX + "px",
      paddingLeft: px(padX + (isTag ? fs * 0.5 : 0)), borderRadius: "999px", whiteSpace: "nowrap", textAlign: "center", lineHeight: px(fs * 1.28),
      fontFamily: '"Poppins", "Inter", sans-serif', fontWeight: isTag ? "700" : "600", fontSize: px(fs), letterSpacing: "0.01em",
      color: isTag ? "#1E2433" : "#FFFDF7", background: isTag ? "#FFFDF7" : "rgba(14,18,34,0.78)",
      boxShadow: isTag ? "0 8px 24px rgba(10,14,30,0.32), inset 0 0 0 4px " + accent : "0 6px 20px rgba(10,14,30,0.3), inset 0 0 0 2px rgba(255,253,247,0.22)",
      transformOrigin: "50% 100%" });
    if (isTag) { // a small accent bead inside the pill, on the left
      var bead = D.el(pill, "html:span", {});
      css(bead, { position: "absolute", left: px(padX * 0.7), top: "50%", width: px(fs * 0.32), height: px(fs * 0.32), marginTop: px(-fs * 0.16), borderRadius: "50%", background: accent });
    }
    var lastPoint = { x: FRAME.width / 2, y: FRAME.height / 2 };

    function envelope(t) {
      var k = D.prog(t, at, at + 0.3), op = D.ease.outCubic(D.prog(t, at, at + 0.2));
      if (until !== undefined && t > until) op *= 1 - D.ease.inOut(D.prog(t, until, until + 0.3));
      return { op: t < at ? 0 : op, scale: 0.86 + 0.14 * D.ease.outBack(k) };
    }
    function outside(q) { return Math.max(0, -q.x, q.x - FRAME.width, -q.y, q.y - FRAME.height); }

    function layoutAt(t, q) {
      var env = envelope(t), out = outside(q);
      var distOp = out < OUT_CLAMP ? 1 : out >= OUT_GONE ? 0 : 1 - D.ease.inOutSine((out - OUT_CLAMP) / (OUT_GONE - OUT_CLAMP));
      var opacity = r2(env.op * distOp);
      // where the pill wants to be
      var cx = q.x, cy, s = side;
      if (s === "auto") s = q.y - LEAD - H < B.y ? "below" : "above";
      if (s === "above") cy = q.y - (isTag ? LEAD : 20) - H / 2;
      else if (s === "below") cy = q.y + (isTag ? LEAD : 20) + H / 2;
      else if (s === "left") { cx = q.x - 20 - W / 2; cy = q.y; }
      else if (s === "right") { cx = q.x + 20 + W / 2; cy = q.y; }
      else cy = q.y;
      var x0 = cx - W / 2, y0 = cy - H / 2;
      var x = Math.min(Math.max(x0, B.x), B.x + B.width - W), y = Math.min(Math.max(y0, B.y), B.y + B.height - H);
      return { opacity: opacity, clamped: x !== x0 || y !== y0 || out > 0, outside: out > 0, point: { x: q.x, y: q.y }, side: s, x: r2(x), y: r2(y), width: W, height: H, scale: env.scale };
    }

    function update(t, screenPoint) {
      var q = screenPoint && isFinite(screenPoint.x) && isFinite(screenPoint.y) ? { x: screenPoint.x, y: screenPoint.y } : lastPoint;
      lastPoint = q;
      var L = layoutAt(t, q);
      wrap.style.opacity = String(L.opacity);
      wrap.style.visibility = L.opacity > 0 ? "visible" : "hidden";
      pill.style.left = px(L.x);
      pill.style.top = px(L.y);
      pill.style.transform = "scale(" + (Math.round(L.scale * 1000) / 1000) + ")";
      var pc = { x: L.x + W / 2, y: L.y + H / 2 };
      if (isTag) {
        // leader: from the point (or the frame edge toward it) to the pill's nearest edge
        var tx = Math.min(Math.max(q.x, L.x + H / 2), L.x + W - H / 2), ty = q.y < L.y ? L.y : q.y > L.y + H ? L.y + H : pc.y;
        var fx = Math.min(Math.max(q.x, 0), FRAME.width), fy = Math.min(Math.max(q.y, 0), FRAME.height);
        var d = "M" + r2(fx) + " " + r2(fy) + " L" + r2(tx) + " " + r2(ty);
        var showLead = !L.outside && Math.hypot(tx - fx, ty - fy) > 6;
        [lead, leadShade].forEach(function (e) { e.setAttribute("d", d); e.setAttribute("visibility", showLead ? "visible" : "hidden"); });
        [dot, dotRing].forEach(function (e) { e.setAttribute("cx", r2(q.x)); e.setAttribute("cy", r2(q.y)); e.setAttribute("visibility", L.outside ? "hidden" : "visible"); });
        dotRing.setAttribute("r", r2(15 + 5 * Math.sin(t * 4)));
      }
      if (L.outside) { // a chevron on the pill edge, pointing at the point off the frame
        var ang = Math.atan2(q.y - pc.y, q.x - pc.x), ex = pc.x + Math.cos(ang) * (W / 2 + 10), ey = pc.y + Math.sin(ang) * (H / 2 + 10);
        ex = Math.min(Math.max(ex, L.x - 18), L.x + W + 18); ey = Math.min(Math.max(ey, L.y - 18), L.y + H + 18);
        var c = Math.cos(ang), s2 = Math.sin(ang), sz = 16;
        chevron.setAttribute("d", "M" + r2(ex + c * sz) + " " + r2(ey + s2 * sz) + " L" + r2(ex - s2 * sz * 0.8) + " " + r2(ey + c * sz * 0.8) + " L" + r2(ex + s2 * sz * 0.8) + " " + r2(ey - c * sz * 0.8) + " Z");
        chevron.setAttribute("visibility", "visible");
      } else chevron.setAttribute("visibility", "hidden");
      return L;
    }
    function box(t, screenPoint) {
      var L = layoutAt(t, screenPoint || lastPoint);
      return L.opacity > 0 ? { x: L.x, y: L.y, width: L.width, height: L.height } : { x: L.x, y: L.y, width: 0, height: 0 };
    }
    return { update: update, box: box, text: spec.text, target: spec.target, kind: kind, el: wrap };
  }

  K.overlays = {
    tag: function (el, spec, idPrefix) { return make("tag", el, spec, idPrefix); },
    label: function (el, spec, idPrefix) { return make("label", el, spec, idPrefix); },
    countWords: countWords,
    MAX_WORDS: MAX_WORDS, SAFE: SAFE, OUT_CLAMP: OUT_CLAMP, OUT_GONE: OUT_GONE,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
