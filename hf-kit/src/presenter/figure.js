/* hf-kit presenter, part 5/5: the figure, its framing, its state over time and mountPresenter
 * (port of templates/src/presenter/Presenter.tsx).
 *
 *   var p = HFKit.mountPresenter(el, {pose, expression, outfit, size, side, mouth, fps: 30, seed});
 *   p.setPose("point-left", 2.0);          // pose change at t = 2 s (blends over 8 frames)
 *   tl.eventCallback("onUpdate", function () { p.update(tl.time()); });
 *
 * The SVG is built once; update(t) only changes attributes. Everything is a pure function of
 * t (seeking backwards works). Unit tests use figureTree / stateAt without a DOM. */
(function (root) {
  "use strict";
  var P = (root.HFKitPresenter = root.HFKitPresenter || {});
  var RIG = P.RIG;
  var h = P.h;

  var VIEW_TOP = 34; // drawing area top (body units)
  var CALM_BOTTOM = 724; // crop line for calm poses: closer, larger framing
  var FULL_BOTTOM = RIG.waist; // crop line when the arms need more room
  var FADE = 72; // soft fade at the crop line
  var POSE_BLEND = 8; // frames a pose change takes (at 30 fps: 0.267 s)

  /* Horizontal extent (relative to the centre line) and top of the arms and hands of `poses`. */
  function extent(poses) {
    var xs = [-200, 200];
    var top = Infinity;
    poses.forEach(function (pose) {
      [[pose.left, -1], [pose.right, 1]].forEach(function (pm) {
        var p = pm[0], m = pm[1];
        var pts = P.armPoints(p);
        var e = pts.e, w = pts.w;
        var tip = (p.hand === "point" ? 92 : 74) * 1.3 + 8;
        var a = ((p.elbow + p.wrist) * Math.PI) / 180;
        var hx = w.x - Math.sin(a) * tip;
        var hy = w.y + Math.cos(a) * tip;
        [e.x - 34, e.x + 34, w.x - 30, w.x + 30, hx - 26, hx + 26].forEach(function (x) { xs.push(m === -1 ? x : -x); });
        top = Math.min(top, e.y - 34, w.y - 30, hy - 26);
      });
    });
    return { min: Math.min.apply(null, xs), max: Math.max.apply(null, xs), top: top };
  }

  /* Visible window for `poses` in a box of `aspect` (w/h): calm poses get a close framing,
   * poses whose hands need room zoom out just enough; the body shifts towards the content. */
  function fitFrame(poses, side, aspect) {
    var ex = extent(poses);
    var y = Math.min(VIEW_TOP, ex.top - 6);
    var span = ex.max - ex.min + 12;
    var hgt = CALM_BOTTOM - y;
    var w = hgt * aspect;
    if (w < span) {
      w = span;
      hgt = Math.min(FULL_BOTTOM - y, w / aspect);
      w = Math.max(w, hgt * aspect);
    }
    var lo = -ex.min + 6;
    var hi = w - 6 - ex.max;
    var preferred = w / 2 + (side === "left" ? -1 : side === "right" ? 1 : 0) * w * 0.03;
    var cx = lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, preferred));
    return { x: -cx, y: y, w: w, h: hgt };
  }

  /* Every arm position a named pose passes through while it moves. */
  function motionSamples(name) {
    var loud = [];
    for (var f = 0; f < 240; f++) loud.push(0.5 + 0.5 * Math.sin(f / 3));
    var out = [P.POSES[name]];
    var i;
    for (i = 0; i < 48; i++) out.push(P.animatedPose(name, i * 5, loud));
    for (i = 0; i < 48; i++) out.push(P.animatedPose(name, i * 5, []));
    return out;
  }

  var frameCache = {};
  /* Framing for a named pose, steady over its whole motion. */
  function poseFrame(name, side, aspect) {
    var key = name + "|" + side + "|" + aspect.toFixed(4);
    if (!frameCache[key]) frameCache[key] = fitFrame(motionSamples(name), side, aspect);
    return frameCache[key];
  }

  function lerpFrame(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
  }

  /* The presenter as a virtual SVG tree for one explicit state:
   * {pose, face, mouth (0-1), blink (0-1), t (frame), side, outfit, look, crop, width, height, still, frame}. */
  function figureTree(props) {
    var look = props.look || P.LOOK;
    var pal = P.palette(look, props.outfit || "blazer");
    var pose = props.pose;
    var still = !!props.still;
    var t = props.t || 0;
    var b = still ? 0 : P.breath(t);
    var lift = -b * (RIG.waist - 344);
    var dy = still ? 0 : P.bob(t);
    var tilt = pose.tilt + (still ? 0 : P.headTilt(t));
    var sway = function (phase) { return still ? 0 : P.sway(t, phase); };
    var f = props.frame || fitFrame([pose], props.side || "center", props.width / props.height);
    var bottom = f.y + f.h;
    var headCrop = props.crop === "head";

    var head = h("g", { transform: "translate(0 " + lift + ") rotate(" + tilt + " 0 " + RIG.headPivotY + ")" }, [
      P.parts.hairBack(pal, sway),
      P.parts.head(pal),
      P.parts.face(pal, props.face, props.mouth || 0, props.blink || 0, pose.gazeX, pose.gazeY, look.glasses),
      P.parts.hairFront(pal, sway),
    ]);

    var fade = "{uid}-fade";
    var mask = "{uid}-mask";
    var defs = h("defs", {}, [
      h("linearGradient", { id: fade, gradientUnits: "userSpaceOnUse", x1: 0, y1: bottom - FADE, x2: 0, y2: bottom }, [
        // eased fade: no visible edge where it starts
        h("stop", { offset: "0", "stop-color": "#fff", "stop-opacity": 1 }),
        h("stop", { offset: "0.3", "stop-color": "#fff", "stop-opacity": 0.9 }),
        h("stop", { offset: "0.65", "stop-color": "#fff", "stop-opacity": 0.45 }),
        h("stop", { offset: "1", "stop-color": "#fff", "stop-opacity": 0 }),
      ]),
      h("mask", { id: mask, maskUnits: "userSpaceOnUse", x: -2000, y: -2000, width: 4000, height: 4000 }, [
        // solid above the fade, overlapping it slightly so no seam shows
        h("rect", { x: -2000, y: -2000, width: 4000, height: 2000 + bottom - FADE + 4, fill: "#fff" }),
        h("rect", { x: -2000, y: bottom - FADE, width: 4000, height: FADE, fill: "url(#" + fade + ")" }),
      ]),
    ]);

    var body = headCrop ? head : h("g", { mask: "url(#" + mask + ")" }, [
      h("g", { transform: "translate(0 " + dy + ")" }, [
        h("g", { transform: "translate(0 " + lift + ")" }, [P.parts.collarBack(pal), P.parts.neck(pal)]),
        h("g", { transform: "translate(0 " + RIG.waist + ") scale(" + (1 + b * 0.4) + " " + (1 + b) + ") translate(0 " + -RIG.waist + ")" }, [P.parts.torso(pal)]),
        head,
        h("g", { transform: "translate(0 " + lift + ")" }, [
          P.parts.arm(pose.left, false, pal, "arm-left"),
          P.parts.arm(pose.right, true, pal, "arm-right"),
        ]),
      ]),
    ]);

    return h("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      "data-presenter": "",
      width: props.width,
      height: props.height,
      viewBox: headCrop ? "-138 30 276 300" : f.x + " " + f.y + " " + f.w + " " + f.h,
      preserveAspectRatio: "xMidYMax meet",
      style: "overflow: visible",
    }, [defs, body]);
  }

  // ---------- serialisation ----------

  function num(v) { return String(Math.round(v * 1000) / 1000); }

  /* Attribute value as written to the DOM ("{uid}" replaced). */
  function attr(v, uid) {
    if (typeof v === "number") return num(v);
    return String(v).split("{uid}").join(uid);
  }

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

  function serialize(node, uid) {
    var out = "<" + node.tag;
    Object.keys(node.a).forEach(function (k) {
      var v = node.a[k];
      if (v !== undefined && v !== null) out += " " + k + '="' + esc(attr(v, uid)) + '"';
    });
    if (!node.c.length) return out + "/>";
    return out + ">" + node.c.map(function (c) { return serialize(c, uid); }).join("") + "</" + node.tag + ">";
  }

  /* Nodes in document (pre-)order: the same order as svg.querySelectorAll("*") after the root. */
  function flatten(node, out) {
    out = out || [];
    out.push(node);
    node.c.forEach(function (c) { flatten(c, out); });
    return out;
  }

  var uidCount = 0;
  function nextUid() { uidCount += 1; return "hfp" + uidCount; }

  /* One still figure as an SVG string (character sheets, previews). */
  function figureSVG(props, uid) { return serialize(figureTree(props), uid || nextUid()); }

  // ---------- state over time ----------

  /* Presenter box size for "small" / "large" (same rule as the Remotion theme.ts). */
  function presenterSize(size) {
    var share = size === "large" ? 0.34 : 0.22;
    var width = Math.round(1920 * share);
    var captionTop = root.HFKit && root.HFKit.captionTop ? root.HFKit.captionTop() : 812;
    return { width: width, height: Math.min(captionTop - 24, Math.round(width * 1.08)) };
  }

  function presenterConfig(opts) {
    opts = opts || {};
    var box = presenterSize(opts.size || "small");
    var cfg = {
      pose: opts.pose || "idle",
      expression: opts.expression || "neutral",
      outfit: opts.outfit || "blazer",
      size: opts.size || "small",
      side: opts.side || "right",
      mouth: opts.mouth || [],
      fps: opts.fps || 30,
      seed: opts.seed === undefined ? 1 : opts.seed,
      offset: opts.offset || 0, // frame of the scene start in the video (breathing continues)
      width: opts.width || box.width,
      height: opts.height || box.height,
      look: opts.look || P.LOOK,
      from: opts.from || null, // previous scene's {pose, expression}: blend in over 8 frames
    };
    if (!P.POSES[cfg.pose]) throw new Error("presenter: unknown pose " + cfg.pose);
    if (!P.EXPRESSIONS[cfg.expression]) throw new Error("presenter: unknown expression " + cfg.expression);
    if (!cfg.look.outfits[cfg.outfit]) throw new Error("presenter: unknown outfit " + cfg.outfit);
    return cfg;
  }

  function frameOf(cfg, t) { return Math.max(0, Math.floor(t * cfg.fps + 1e-6)); }

  /* Figure props at time t (seconds) for a config and its pose changes [{t, pose, expression}]. */
  function stateAt(cfg, changes, t) {
    var list = (changes && changes.length ? changes : [{ t: 0, pose: cfg.pose, expression: cfg.expression }]).slice()
      .sort(function (a, b) { return a.t - b.t; });
    if (cfg.from) list.unshift({ t: -1, pose: cfg.from.pose, expression: cfg.from.expression || cfg.expression, before: true });
    var frame = frameOf(cfg, t);
    var idx = 0;
    for (var i = 0; i < list.length; i++) if (list[i].before || frameOf(cfg, list[i].t) <= frame) idx = i;
    var cur = list[idx];
    var prev = idx > 0 ? list[idx - 1] : null;
    var f0 = cur.before ? 0 : frameOf(cfg, cur.t);
    var aspect = cfg.width / cfg.height;
    var target = P.animatedPose(cur.pose, frame, cfg.mouth);
    var k = prev ? Math.min(1, (frame - f0) / POSE_BLEND) : 1;
    var start = prev && k < 1 ? P.animatedPose(prev.pose, f0, cfg.mouth) : target;
    var p = P.blendPoses(start, target, k);
    var face = P.faceAt(prev ? prev.expression : cur.expression, cur.expression, k);
    var s = k * k * (3 - 2 * k);
    var to = poseFrame(cur.pose, cfg.side, aspect);
    var view = prev && k < 1 ? lerpFrame(poseFrame(prev.pose, cfg.side, aspect), to, s) : to;
    var gazeBias = cfg.side === "left" ? 0.25 : cfg.side === "right" ? -0.25 : 0;
    return {
      pose: Object.assign({}, p, { gazeX: Math.max(-1, Math.min(1, p.gazeX + gazeBias)) }),
      face: face,
      mouth: cfg.mouth[frame] || 0,
      blink: P.blinkAmount(frame, cfg.seed),
      t: frame + cfg.offset,
      side: cfg.side,
      outfit: cfg.outfit,
      look: cfg.look,
      width: cfg.width,
      height: cfg.height,
      frame: view,
    };
  }

  function treeOf(state) { return figureTree(state); }
  function svgOf(state, uid) { return serialize(figureTree(state), uid || "hfp"); }

  // ---------- DOM layer ----------

  /* Mount the presenter in `el` (its SVG fills el's box size). Returns {update(t), setPose(pose, t, expression)}. */
  function mountPresenter(el, opts) {
    var cfg = presenterConfig(opts);
    var uid = nextUid();
    var changes = [{ t: 0, pose: cfg.pose, expression: cfg.expression }];
    var tree = figureTree(stateAt(cfg, changes, 0));
    var nodes = flatten(tree);
    el.innerHTML = serialize(tree, uid);
    var dom = (opts && opts._dom) || {
      root: function () { return el.querySelector("svg"); },
      all: function () { return Array.prototype.slice.call(el.querySelector("svg").querySelectorAll("*")); },
    };
    var els = [dom.root()].concat(dom.all());
    if (els.length !== nodes.length) throw new Error("presenter: DOM does not match the drawing (" + els.length + " vs " + nodes.length + ")");
    var last = nodes.map(function (n) {
      var a = {};
      Object.keys(n.a).forEach(function (k) { if (n.a[k] !== undefined && n.a[k] !== null) a[k] = attr(n.a[k], uid); });
      return a;
    });

    function update(t) {
      var next = flatten(figureTree(stateAt(cfg, changes, t)));
      for (var i = 0; i < next.length; i++) {
        var want = next[i].a;
        var had = last[i];
        var now = {};
        for (var k in want) {
          if (want[k] === undefined || want[k] === null) continue;
          var v = attr(want[k], uid);
          now[k] = v;
          if (had[k] !== v) els[i].setAttribute(k, v);
        }
        for (var o in had) if (!(o in now)) els[i].removeAttribute(o);
        last[i] = now;
      }
    }

    /* Change pose (and optionally expression) at time t seconds; blends over 8 frames. */
    function setPose(pose, t, expression) {
      if (!P.POSES[pose]) throw new Error("presenter: unknown pose " + pose);
      t = t || 0;
      var active = changes.filter(function (c) { return c.t <= t; }).pop() || changes[0];
      var expr = expression || active.expression;
      if (!P.EXPRESSIONS[expr]) throw new Error("presenter: unknown expression " + expr);
      changes = changes.filter(function (c) { return c.t !== t; });
      changes.push({ t: t, pose: pose, expression: expr });
      changes.sort(function (a, b) { return a.t - b.t; });
      api.changes = changes;
    }

    var api = { update: update, setPose: setPose, config: cfg, changes: changes, uid: uid, svg: els[0] };
    return api;
  }

  P.POSE_BLEND = POSE_BLEND;
  P.extent = extent;
  P.fitFrame = fitFrame;
  P.poseFrame = poseFrame;
  P.figureTree = figureTree;
  P.figureSVG = figureSVG;
  P.flatten = flatten;
  P.serialize = serialize;
  P.attr = attr;
  P.presenterSize = presenterSize;
  P.presenterConfig = presenterConfig;
  P.stateAt = stateAt;
  P.treeOf = treeOf;
  P.svgOf = svgOf;
  P.mountPresenter = mountPresenter;
  if (root.HFKit) {
    root.HFKit.presenter = P;
    root.HFKit.mountPresenter = mountPresenter;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
