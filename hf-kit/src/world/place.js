/* hf-kit places contract: the layered stage every place draws into, and the parallax camera.
 *
 * A place lives in hf-kit/places/<name>/place.js (classic script, loaded after the kit scripts,
 * like props) and registers
 *
 *   HFKit.places[name] = {
 *     meta: {name, description, variants: [...], anchors: [...], paths: [...], actorScale?,
 *            actorLight?, notToScale? (true: sizes are not true to scale; shots validate then
 *            needs a "not to scale" tag or label in each scene there)},
 *     anchorsFor({variant, seed}) -> {anchors: {name: (t) => {x, y}}, paths: {name: [{x, y}, ...]}},
 *     mount(layers, {variant, seed, idPrefix}) -> {update(t, cam), anchors, paths},
 *   }
 *
 * World: every coordinate is world px in a 3840 x 2160 world (twice the frame), so a 0.6x
 * pull-out still fills the 1920 x 1080 frame. Anchors and paths are in GROUND-layer world px
 * (parallax factor 1): that is where actors stand, effects play and tags point.
 *
 * Layers (back to front): sky, far, mid, ground, front, with parallax factors
 * 0.2 / 0.45 / 0.75 / 1 / 1.15. HFKit.placeLayers(el, idPrefix) builds them as five world-sized
 * <svg>s stacked in `el` (el is the canvas-sized frame; the caller clips it). Actors go between
 * `ground` and `front` (insert them before layers.front).
 *
 * Camera and parallax: update(t, cam) takes cam = {x, y, zoom}, the world-space point at the
 * centre of the frame and the zoom (1 = one world px per screen px). The parallax factor f of a
 * layer applies relative to that camera, around the reference camera REF = the world centre at
 * zoom 1, where every layer lines up exactly as drawn:
 *
 *   layer camera   cx = REF.x + (cam.x - REF.x) * f,  cy = REF.y + (cam.y - REF.y) * f
 *   layer zoom     z  = cam.zoom ^ f
 *   screen point   (p.x - cx) * z + W / 2,  (p.y - cy) * z + H / 2   (W x H = HFKit.CANVAS)
 *
 * So the ground (f = 1) is the plain camera, the sky barely moves or grows, and the front layer
 * slides and grows a little more than the ground. Content on a layer with f != 1 only lines up
 * with ground anchors at REF, so anything an anchor names is drawn on the ground layer.
 * HFKit.place.toScreen(p, cam, f) is that formula; HFKit.place.applyCamera(layers, cam) writes it
 * as CSS transforms. A place's update must be a pure function of (t, cam): seekable.
 *
 * Ids: every SVG id a place makes starts with idPrefix + "-" (world.js passes
 * "s<scene>-place-<n>"), so two places, or one place in two scenes, never share a gradient. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw) throw new Error("world/place.js: load kit.js and draw.js first");
  var D = K.draw;

  var WORLD = { width: 3840, height: 2160 };
  var LAYERS = ["sky", "far", "mid", "ground", "front"];
  var PARALLAX = { sky: 0.2, far: 0.45, mid: 0.75, ground: 1, front: 1.15 };
  var REF = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1 };

  function r3(v) { return Math.round(v * 1000) / 1000; }

  /* The camera one layer sees: {x, y, zoom}. */
  function layerCam(cam, f) {
    cam = cam || REF;
    var z = cam.zoom === undefined ? 1 : cam.zoom;
    return { x: REF.x + (cam.x - REF.x) * f, y: REF.y + (cam.y - REF.y) * f, zoom: Math.pow(z, f) };
  }

  /* Screen px of world point p on a layer with parallax factor f (default 1 = ground). */
  function toScreen(p, cam, f) {
    var c = layerCam(cam, f === undefined ? 1 : f);
    return { x: r3((p.x - c.x) * c.zoom + K.CANVAS.width / 2), y: r3((p.y - c.y) * c.zoom + K.CANVAS.height / 2) };
  }

  /* CSS transform of a layer (origin top-left) for the camera. */
  function layerTransform(cam, f) {
    var c = layerCam(cam, f);
    return "translate(" + r3(K.CANVAS.width / 2) + "px," + r3(K.CANVAS.height / 2) + "px) scale(" + r3(c.zoom * 10000) / 10000 + ") translate(" + r3(-c.x) + "px," + r3(-c.y) + "px)";
  }

  function applyCamera(layers, cam) {
    LAYERS.forEach(function (name) {
      var e = layers[name];
      if (e && e.style) e.style.transform = layerTransform(cam, PARALLAX[name]);
    });
  }

  /* Five world-sized <svg> layers stacked in el: {sky, far, mid, ground, front}. Each has a
   * <defs> first child and data-layer / data-place attributes (no ids: the place makes those). */
  function placeLayers(el, idPrefix) {
    if (!el || !el.ownerDocument) throw new Error("placeLayers: needs a DOM element");
    var out = {};
    LAYERS.forEach(function (name) {
      var s = D.el(el, "svg", { width: WORLD.width, height: WORLD.height, viewBox: "0 0 " + WORLD.width + " " + WORLD.height,
        overflow: "visible", "data-layer": name, "data-place": idPrefix || "" });
      s.style.position = "absolute";
      s.style.left = "0";
      s.style.top = "0";
      s.style.overflow = "visible";
      s.style.transformOrigin = "0 0";
      s.style.pointerEvents = "none";
      D.el(s, "defs");
      out[name] = s;
    });
    applyCamera(out, REF);
    return out;
  }

  /* The <defs> of a layer. */
  function defs(layer) { return layer.querySelector("defs") || D.el(layer, "defs"); }

  /* Shared variant check: returns the variant name (default: the first). */
  function variantOf(meta, opts) {
    var v = opts && opts.variant !== undefined ? opts.variant : meta.variants[0];
    if (meta.variants.indexOf(v) < 0) throw new Error("place " + meta.name + ": unknown variant \"" + v + "\"");
    return v;
  }

  /* SVG markup helpers for places (strings are fast to build and easy to read). */
  function attrs(a) {
    var s = "";
    for (var k in a) if (a[k] !== undefined && a[k] !== null) s += " " + k + '="' + (typeof a[k] === "number" ? D.r2(a[k]) : a[k]) + '"';
    return s;
  }
  function tag(name, a, inner) { return "<" + name + attrs(a || {}) + (inner === undefined ? "/>" : ">" + inner + "</" + name + ">"); }
  function stops(list) {
    return list.map(function (s) { return tag("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] === undefined ? undefined : s[2] }); }).join("");
  }
  function lin(id, list, dir) {
    var d = dir || [0, 0, 0, 1];
    return tag("linearGradient", { id: id, x1: d[0], y1: d[1], x2: d[2], y2: d[3] }, stops(list));
  }
  function rad(id, list, c) {
    c = c || {};
    return tag("radialGradient", { id: id, cx: c.cx === undefined ? 0.5 : c.cx, cy: c.cy === undefined ? 0.5 : c.cy, r: c.r === undefined ? 0.5 : c.r, fx: c.fx, fy: c.fy }, stops(list));
  }
  function blur(id, std) {
    return '<filter id="' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + std + '"/></filter>';
  }
  /* Points [[x, y], ...] -> "x,y x,y" (rounded). */
  function pts(list) { return list.map(function (p) { return D.r2(p[0]) + "," + D.r2(p[1]); }).join(" "); }
  /* A smooth closed or open path through points (Catmull-Rom to cubic). */
  function smooth(list, closed) {
    var n = list.length, d = "M" + D.r2(list[0][0]) + " " + D.r2(list[0][1]);
    var get = function (i) { return closed ? list[(i + n) % n] : list[Math.max(0, Math.min(n - 1, i))]; };
    var end = closed ? n : n - 1;
    for (var i = 0; i < end; i++) {
      var p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      d += " C" + D.r2(p1[0] + (p2[0] - p0[0]) / 6) + " " + D.r2(p1[1] + (p2[1] - p0[1]) / 6) + " " +
        D.r2(p2[0] - (p3[0] - p1[0]) / 6) + " " + D.r2(p2[1] - (p3[1] - p1[1]) / 6) + " " + D.r2(p2[0]) + " " + D.r2(p2[1]);
    }
    return d + (closed ? " Z" : "");
  }
  /* Write markup into a layer: defs go into its <defs>, the body into a fresh <g data-part>. */
  function paint(layer, part, defsMarkup, body) {
    if (defsMarkup) defs(layer).insertAdjacentHTML("beforeend", defsMarkup);
    var g = D.el(layer, "g", { "data-part": part });
    g.innerHTML = body;
    return g;
  }

  // ---- shared art (so every place has the same hand) ------------------------------------
  /* v wrapped into [lo, hi): drifting clouds, motes and traffic never run out in a long scene. */
  function wrap(v, lo, hi) { var span = hi - lo; return lo + (((v - lo) % span) + span) % span; }
  /* Soft fade near the ends of a wrap span (0 at lo / hi, 1 inside by `edge`): hides the jump. */
  function wrapFade(v, lo, hi, edge) { return Math.min(1, Math.max(0, (v - lo) / edge), Math.max(0, (hi - v) / edge)); }
  /* A tone function for a variant: mix every colour toward `toward` by k after darkening by dk. */
  function toner(dk, toward, k) { return function (c) { return D.mix(D.shade(c, dk), toward, k); }; }
  /* A fluffy flat-shaded cloud at (cx, cy), scale s; pal = {cloud, cloudShade, cloudLight}. */
  function cloud(cx, cy, s, pal, id) {
    var out = tag("ellipse", { cx: 0, cy: 34, rx: 210, ry: 34, fill: pal.cloudShade, opacity: 0.9 }) +
      tag("ellipse", { cx: -95, cy: 0, rx: 110, ry: 70, fill: pal.cloud }) + tag("ellipse", { cx: 20, cy: -38, rx: 120, ry: 98, fill: pal.cloud }) +
      tag("ellipse", { cx: 130, cy: 4, rx: 100, ry: 64, fill: pal.cloud }) + tag("ellipse", { cx: 0, cy: 30, rx: 200, ry: 36, fill: pal.cloud }) +
      tag("ellipse", { cx: 40, cy: -70, rx: 60, ry: 40, fill: pal.cloudLight, opacity: 0.9 }) + tag("ellipse", { cx: 0, cy: 50, rx: 170, ry: 16, fill: pal.cloudShade, opacity: 0.55 });
    return tag("g", { "data-cloud": id, transform: "translate(" + D.r2(cx) + " " + D.r2(cy) + ") scale(" + D.r2(s) + ")" }, out);
  }
  /* A round, flat-shaded tree: trunk, four leaf blobs, shade and light. tone = colour function. */
  function tree(x, y, r, tone, seed, outline) {
    var R = D.rng(seed), lean = (R() - 0.5) * 0.3;
    var dark = tone("#2F6E35"), mid = tone("#43913F"), light = tone("#79BC57"), trunk = tone("#6B4A2F");
    var s = tag("ellipse", { cx: x + r * 0.25, cy: y + r * 1.55, rx: r * 0.95, ry: r * 0.16, fill: "#1D3A1A", opacity: 0.22 });
    s += tag("path", { d: "M" + D.r2(x - r * 0.1) + " " + D.r2(y + r * 1.55) + " L" + D.r2(x - r * 0.06 + lean * r) + " " + D.r2(y + r * 0.4) + " L" + D.r2(x + r * 0.08 + lean * r) + " " + D.r2(y + r * 0.4) + " L" + D.r2(x + r * 0.12) + " " + D.r2(y + r * 1.55) + " Z",
      fill: trunk, stroke: outline ? D.shade(trunk, 0.35) : "none", "stroke-width": 3 });
    var blobs = [[0, 0, 1], [-0.55, 0.3, 0.68], [0.55, 0.28, 0.7], [0.05, -0.45, 0.66]];
    s += blobs.map(function (b) { return tag("circle", { cx: x + b[0] * r, cy: y + b[1] * r, r: b[2] * r, fill: mid, stroke: outline ? dark : "none", "stroke-width": outline ? 4 : 0 }); }).join("");
    s += blobs.map(function (b) { return tag("circle", { cx: x + b[0] * r, cy: y + b[1] * r, r: b[2] * r * 0.97, fill: mid }); }).join("");
    s += tag("circle", { cx: x - r * 0.35, cy: y + r * 0.42, r: r * 0.55, fill: dark, opacity: 0.45 });
    s += tag("circle", { cx: x + r * 0.28, cy: y - r * 0.38, r: r * 0.42, fill: light, opacity: 0.85 });
    s += tag("circle", { cx: x + r * 0.62, cy: y + r * 0.05, r: r * 0.24, fill: light, opacity: 0.6 });
    return s;
  }
  /* n stars in the box (x, y, w, h): varied size and warmth, data-star for twinkling. */
  function stars(R, n, x, y, w, h, opts) {
    opts = opts || {};
    var out = "", cols = opts.colors || ["#FFF8E1", "#FFFFFF", "#DCE8FF", "#FFE2C4"];
    for (var i = 0; i < n; i++) {
      var big = R() < (opts.bright || 0.06), rr = big ? 3.4 + R() * 2.6 : 1.2 + R() * 2.4;
      out += tag("circle", { cx: x + R() * w, cy: y + R() * h, r: rr * (opts.scale || 1), fill: cols[(R() * cols.length) | 0], opacity: 0.35 + R() * 0.6, "data-star": i });
    }
    return out;
  }
  /* A window glazing: a soft diagonal glint over a pane. */
  function glint(x, y, w, h, op) {
    return tag("path", { d: "M" + D.r2(x + w * 0.12) + " " + D.r2(y + h * 0.55) + " L" + D.r2(x + w * 0.42) + " " + D.r2(y + h * 0.08) + " M" + D.r2(x + w * 0.24) + " " + D.r2(y + h * 0.62) + " L" + D.r2(x + w * 0.5) + " " + D.r2(y + h * 0.22),
      stroke: "#FFFFFF", "stroke-width": Math.max(4, w * 0.05), "stroke-linecap": "round", opacity: op === undefined ? 0.3 : op });
  }

  K.place = {
    WORLD: WORLD, LAYERS: LAYERS, PARALLAX: PARALLAX, REF: REF,
    layerCam: layerCam, toScreen: toScreen, layerTransform: layerTransform, applyCamera: applyCamera,
    defs: defs, variantOf: variantOf, paint: paint,
    svg: { attrs: attrs, tag: tag, lin: lin, rad: rad, blur: blur, pts: pts, smooth: smooth },
    art: { wrap: wrap, wrapFade: wrapFade, toner: toner, cloud: cloud, tree: tree, stars: stars, glint: glint },
  };
  /* The frame is the composition canvas (HFKit.CANVAS, read when asked). */
  Object.defineProperty(K.place, "FRAME", { enumerable: true, get: function () { return K.CANVAS; } });
  K.placeLayers = placeLayers;
  K.places = K.places || {};
})(typeof globalThis !== "undefined" ? globalThis : window);
