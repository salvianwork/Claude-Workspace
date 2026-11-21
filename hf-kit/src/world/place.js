/* hf-kit places contract: the layered stage every place draws into, and the parallax camera.
 *
 * A place lives in hf-kit/places/<name>/place.js (classic script, loaded after the kit scripts,
 * like props) and registers
 *
 *   HFKit.places[name] = {
 *     meta: {name, description, variants: [...], anchors: [...], paths: [...]},
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
 * <svg>s stacked in `el` (el is the 1920 x 1080 frame; the caller clips it). Actors go between
 * `ground` and `front` (insert them before layers.front).
 *
 * Camera and parallax: update(t, cam) takes cam = {x, y, zoom}, the world-space point at the
 * centre of the frame and the zoom (1 = one world px per screen px). The parallax factor f of a
 * layer applies relative to that camera, around the reference camera REF = the world centre at
 * zoom 1, where every layer lines up exactly as drawn:
 *
 *   layer camera   cx = REF.x + (cam.x - REF.x) * f,  cy = REF.y + (cam.y - REF.y) * f
 *   layer zoom     z  = cam.zoom ^ f
 *   screen point   (p.x - cx) * z + 960,  (p.y - cy) * z + 540
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
  var FRAME = { width: 1920, height: 1080 };
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
    return { x: r3((p.x - c.x) * c.zoom + FRAME.width / 2), y: r3((p.y - c.y) * c.zoom + FRAME.height / 2) };
  }

  /* CSS transform of a layer (origin top-left) for the camera. */
  function layerTransform(cam, f) {
    var c = layerCam(cam, f);
    return "translate(" + r3(FRAME.width / 2) + "px," + r3(FRAME.height / 2) + "px) scale(" + r3(c.zoom * 10000) / 10000 + ") translate(" + r3(-c.x) + "px," + r3(-c.y) + "px)";
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

  K.place = {
    WORLD: WORLD, FRAME: FRAME, LAYERS: LAYERS, PARALLAX: PARALLAX, REF: REF,
    layerCam: layerCam, toScreen: toScreen, layerTransform: layerTransform, applyCamera: applyCamera,
    defs: defs, variantOf: variantOf, paint: paint,
    svg: { attrs: attrs, tag: tag, lin: lin, rad: rad, blur: blur, pts: pts, smooth: smooth },
  };
  K.placeLayers = placeLayers;
  K.places = K.places || {};
})(typeof globalThis !== "undefined" ? globalThis : window);
