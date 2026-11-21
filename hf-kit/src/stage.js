/* hf-kit hero stage: mounts a prop from the library (HFKit.props[name]) inside the scene shell,
 * drives it with the camera (shots.json keys, anchors from the prop) and the word-timed cues,
 * and draws "label" / "highlight" cues pinned to the prop's anchors.
 *
 *   var hero = HFKit.mountHero(el, {prop: "volcano", params, style, words, cues, camera,
 *                                   duration, presenter, sceneId});
 *   hero.update(t)   // pure function of t: seek anywhere
 *   hero.shell.layers.presenter / .captions   // slots for the presenter and captions
 *
 * Cue kinds handled here: label {target, text, side?}, highlight {target}; "phase" cues become
 * params.phases (seconds) for the prop; every cue also reaches prop.update(t, cueState).
 * Classic script: load after shell.js. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.shell) throw new Error("stage.js: load shell.js first");
  var D = K.draw;
  K.props = K.props || {};

  var LABEL = { font: 40, padX: 28, padY: 14, dot: 18 };
  var SIDES = {
    "above-left": [-1, -1], "above-right": [1, -1], left: [-1, 0], right: [1, 0], "below-left": [-1, 1], "below-right": [1, 1],
    above: [0, -1], below: [0, 1],
  };
  var ORDER = ["above-left", "above-right", "left", "right", "below-left", "below-right", "above", "below"];

  /* {phaseName: seconds} from cues with show: "phase" (target = phase name). */
  function phaseTimes(cues, words, sceneId) {
    var out = {};
    (cues || []).forEach(function (c) { if (c && c.show === "phase") out[c.target] = K.wordTime(words, c.at, sceneId); });
    return out;
  }

  function labelSize(text) { // estimate (Poppins 700): ~0.6 em per character
    return { width: Math.round(text.length * LABEL.font * 0.6 + 2 * LABEL.padX + LABEL.dot + 14), height: Math.round(LABEL.font * 1.25 + 2 * LABEL.padY) };
  }
  function inside(r, b) { return r.x >= b.x && r.y >= b.y && r.x + r.width <= b.x + b.width && r.y + r.height <= b.y + b.height; }
  function overlap(a, b) { return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height; }
  function rectAt(p, side, size) {
    var s = SIDES[side], gapX = 70, gapY = 90;
    var cx = p.x + s[0] * (size.width / 2 + gapX), cy = p.y + s[1] * (size.height / 2 + gapY);
    return { x: cx - size.width / 2, y: cy - size.height / 2, width: size.width, height: size.height };
  }
  function clampInto(r, b) {
    return { x: D.clamp(r.x, b.x, b.x + b.width - r.width), y: D.clamp(r.y, b.y, b.y + b.height - r.height), width: r.width, height: r.height };
  }

  function mountHero(el, opts) {
    var prop = K.props[opts.prop];
    if (!prop) throw new Error("scene " + opts.sceneId + ": unknown prop " + opts.prop + " (load kit/props/" + opts.prop + "/prop.js)");
    var meta = prop.meta, words = opts.words || [], cues = opts.cues || [], duration = opts.duration || 10;
    var sh = K.shell(el, { presenter: opts.presenter, style: opts.style, seed: opts.sceneId || 1 });
    var box = sh.content, doc = el.ownerDocument;
    var params = Object.assign({}, opts.params || {});
    params.phases = Object.assign({}, params.phases || {}, phaseTimes(cues, words, opts.sceneId));

    var world = doc.createElement("div");
    world.className = "hf-world";
    world.style.cssText = "position:absolute;left:0;top:0;width:" + meta.world.width + "px;height:" + meta.world.height + "px;transform-origin:0 0;overflow:visible";
    sh.layers.stage.appendChild(world);
    var api = prop.mount(world, { params: params, style: sh.style });
    var anchors = api.anchors;
    var frame = K.heroFrame(meta.frame, box);
    var norm = K.normaliseAnchors(anchors, meta.frame);
    var keys = K.resolveCamera(opts.camera || [], words, opts.sceneId, norm);
    var still = { x: 0.5, y: 0.5, zoom: 1 };
    function poseAt(t) { return keys.length ? K.cameraAt(keys, t, norm) : still; }
    function driftAt(t) { var d = K.drift(t, duration, opts.sceneId || 1); return { x: d.x * 0.5, y: d.y * 0.5, zoom: 1 + (d.zoom - 1) * 1.4 }; }
    function viewAt(t) { return K.view(poseAt(t), frame, driftAt(t)); }
    function anchorAt(name, t) { var a = anchors[name]; if (!a) throw new Error("scene " + opts.sceneId + ": unknown anchor " + name); return typeof a === "function" ? a(t) : a; }

    // ---- label and highlight cues ---------------------------------------------------------
    var svg = D.svgRoot(sh.layers.overlay, K.CANVAS.width, K.CANVAS.height, { style: "position:absolute;left:0;top:0" }).svg;
    var placed = [], marks = [];
    cues.forEach(function (c, idx) {
      if (c.show !== "label" && c.show !== "highlight") return;
      anchorAt(c.target, 0); // unknown anchor -> clear error
      var start = K.wordTime(words, c.at, opts.sceneId);
      var end = c.until ? K.wordTime(words, c.until, opts.sceneId) : Infinity;
      var line = D.el(svg, "line", { stroke: "#FFF8EF", "stroke-width": 4, "stroke-linecap": "round" });
      var ring = D.el(svg, "circle", { fill: c.show === "highlight" ? "none" : "#FFF8EF", stroke: c.show === "highlight" ? sh.style.colors.accent : "none", "stroke-width": 6 });
      var m = { cue: c, start: start, end: end, line: line, ring: ring, key: (c.show === "label" ? "label-" : "highlight-") + c.target };
      if (c.show === "label") {
        var text = String(c.text || c.target);
        var size = labelSize(text);
        // choose a side once, from where the anchor will be shortly after the cue (pure)
        var v = viewAt(start + 0.4), p = anchorAt(c.target, start + 0.4), sp = v.toScreen(p.x, p.y);
        var sides = c.side && SIDES[c.side] ? [c.side] : ORDER;
        var pick = sides[0];
        // keep clear of the box edges, other labels and the prop's other parts (anchors)
        var others = Object.keys(anchors).filter(function (k) { return k !== c.target; }).map(function (k) {
          var q = anchorAt(k, start + 0.4); return v.toScreen(q.x, q.y);
        });
        var covers = function (r) { return others.some(function (o) { return o.x > r.x - 30 && o.x < r.x + r.width + 30 && o.y > r.y - 30 && o.y < r.y + r.height + 30; }); };
        var free = function (r) { return !placed.some(function (q) { return q.start < end && start < q.end && overlap(q.rect, r); }); };
        var found = false;
        for (var pass = 0; pass < 2 && !found; pass++) {
          for (var i = 0; i < sides.length; i++) {
            var r = rectAt(sp, sides[i], size);
            if (inside(r, box) && free(r) && (pass === 1 || !covers(r))) { pick = sides[i]; found = true; break; }
          }
        }
        m.side = pick; m.size = size; m.rect = clampInto(rectAt(sp, pick, size), box);
        var lab = doc.createElement("div");
        lab.className = "hf-label hf-text";
        lab.dataset.key = m.key;
        lab.style.cssText = "position:absolute;left:0;top:0;box-sizing:border-box;white-space:nowrap;display:flex;align-items:center;gap:14px;" +
          "height:" + size.height + "px;padding:0 " + LABEL.padX + "px;border-radius:999px;background:#FFF8EF;color:#1F2937;" +
          "font-family:" + sh.style.fonts.heading + ";font-weight:700;font-size:" + LABEL.font + "px;letter-spacing:-0.01em;" +
          "box-shadow:0 12px 32px rgba(2,6,23,0.4);transform-origin:50% 50%;opacity:0";
        var dot = doc.createElement("i");
        dot.style.cssText = "display:block;flex:none;width:" + LABEL.dot + "px;height:" + LABEL.dot + "px;border-radius:50%;background:" + (c.color || sh.style.colors.accent);
        lab.appendChild(dot);
        lab.appendChild(doc.createTextNode(text));
        sh.layers.overlay.appendChild(lab);
        m.el = lab;
        placed.push(m);
      }
      marks.push(m);
    });

    function update(t) {
      sh.update(t);
      var v = viewAt(t);
      world.style.transform = v.css;
      api.update(t, K.cueState(cues, words, t, opts.sceneId));
      marks.forEach(function (m) {
        var p = anchorAt(m.cue.target, t), a = v.toScreen(p.x, p.y);
        var vis = Math.min(D.prog(t, m.start, m.start + 0.25), 1 - D.prog(t, m.end, m.end + 0.25));
        // fade out when the anchor leaves the content box (camera moved away)
        var edge = Math.min(a.x - box.x, box.x + box.width - a.x, a.y - box.y, box.y + box.height - a.y);
        vis *= D.clamp((edge + 20) / 60);
        if (m.cue.show === "highlight") {
          var pulse = 0.5 + 0.5 * Math.sin((t - m.start) * 4);
          m.ring.setAttribute("cx", D.r2(a.x)); m.ring.setAttribute("cy", D.r2(a.y));
          m.ring.setAttribute("r", D.r2((40 + 10 * pulse) * D.ease.outBack(D.prog(t, m.start, m.start + 0.4))));
          m.ring.setAttribute("opacity", D.r2(vis * (0.65 + 0.35 * pulse)));
          m.line.setAttribute("opacity", 0);
          return;
        }
        var r = clampInto(rectAt(a, m.side, m.size), box);
        var k = D.prog(t, m.start, m.start + 0.35), pop = 0.88 + 0.12 * D.ease.outBack(k);
        m.el.style.left = D.r2(r.x) + "px"; m.el.style.top = D.r2(r.y) + "px";
        m.el.style.opacity = D.r2(vis);
        m.el.style.transform = "scale(" + Math.round(pop * 1000) / 1000 + ")";
        m.el.style.filter = k < 1 ? "blur(" + D.r2(6 * (1 - k)) + "px)" : "none";
        // leader: from the anchor to the nearest point on the label's edge, drawn on
        var ex = D.clamp(a.x, r.x + 24, r.x + r.width - 24), ey = D.clamp(a.y, r.y, r.y + r.height);
        if (a.y < r.y) ey = r.y; else if (a.y > r.y + r.height) ey = r.y + r.height;
        var d = D.ease.outExpo(D.prog(t, m.start, m.start + 0.45));
        m.line.setAttribute("x1", D.r2(a.x)); m.line.setAttribute("y1", D.r2(a.y));
        m.line.setAttribute("x2", D.r2(D.lerp(a.x, ex, d))); m.line.setAttribute("y2", D.r2(D.lerp(a.y, ey, d)));
        m.line.setAttribute("opacity", D.r2(vis));
        m.ring.setAttribute("cx", D.r2(a.x)); m.ring.setAttribute("cy", D.r2(a.y));
        m.ring.setAttribute("r", D.r2(9 * D.ease.outBack(D.prog(t, m.start - 0.05, m.start + 0.25))));
        m.ring.setAttribute("opacity", D.r2(vis));
      });
    }
    update(0);
    return { update: update, anchors: anchors, shell: sh, prop: api, keys: keys, viewAt: viewAt };
  }

  K.phaseTimes = phaseTimes;
  K.mountHero = mountHero;
})(typeof globalThis !== "undefined" ? globalThis : window);
