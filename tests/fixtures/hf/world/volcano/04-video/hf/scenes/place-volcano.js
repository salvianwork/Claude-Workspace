/* Place "volcano": a stratovolcano rising from green farmland, cut away down the middle so the
 * viewer sees inside: layered rock in the cone, the narrow vent from the crater down through the
 * ground, and the magma chamber (molten rock, slowly churning) deep below in the soil section.
 * Far blue mountains, rolling hills with trees, a little farm at the left where people stand.
 * Adapted from the prop library's `volcano` cut-away (hf-kit/props/volcano/prop.js) into the
 * place contract; the eruption itself is a scene's custom piece, not part of the place.
 *
 * Variants: day (default), dusk (violet and orange sky, stars, warmer glow from the chamber).
 * Anchors (ground-layer world px, 3840 x 2160 world):
 *   foot     the meadow left of the volcano, where an actor stands
 *   chamber  the centre of the magma chamber, deep under the cone
 *   vent     half-way up the vent, inside the cut-away cone
 *   crater   the crater at the summit
 *   slope    the middle of the right-hand slope (where lava runs)
 *   sky      open sky left of the summit
 * Paths: vent (from the chamber up the vent to the crater), lava-flow (from the crater down the
 * right-hand slope to its foot).
 * Actor scale 1 (an actor about 380 world px tall: the cone is about five times his height; the
 * volcano is not to scale with him — a real one is thousands of times taller).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("place-volcano.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "volcano",
    description: "A stratovolcano over farmland, cut away to show the layered cone, the vent and the magma chamber deep below.",
    variants: ["day", "dusk"],
    anchors: ["foot", "chamber", "vent", "crater", "slope", "sky"],
    paths: ["vent", "lava-flow"],
    actorScale: 1,
    notToScale: true,
    actorLight: {
      day: { tint: "#FFF3DE", amount: 0.08 },
      dusk: { tint: "#B9748A", amount: 0.38, rim: "#FFB070", rimSide: 1 },
    },
  };

  // ---- geometry (ground-layer world px) ------------------------------------------------------
  var GROUND = 1300;
  var CX = 2300;                       // the volcano's axis
  var CRATER = { x: CX, y: 560 };
  var CHAMBER = { x: CX, y: 1730, rx: 430, ry: 150 };
  var VENT_PTS = [[CX, 1590], [CX - 26, 1480], [CX + 30, 1370], [CX - 12, 1220], [CX + 18, 1020], [CX - 10, 800], [CX, 580]];
  /* A point on the cone's right (side 1) or left (side -1) flank outline, u 0 (rim) .. 1 (base),
   * pushed `inset` px into the rock: where lava runs. */
  function flank(side, u, inset) {
    var x0 = CX + side * 180, x1 = CX + side * 400, x2 = CX + side * 740, x3 = CX + side * 1040;
    var y0 = 560, y1 = 1000, y2 = 1240, y3 = 1300, v = 1 - u;
    var x = v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3;
    var y = v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3;
    return [x - side * inset * 0.5, y + inset];
  }
  var FLOW_PTS = [];
  for (var fi = 0; fi <= 8; fi++) FLOW_PTS.push(flank(1, 0.04 + fi * 0.115, 22));
  var CONE = "M1260 1300 C 1560 1240, 1900 1000, 2120 560 L 2190 586 Q 2300 612 2410 586 L 2480 560 C 2700 1000, 3040 1240, 3340 1300 Z";
  var CUT = "M2180 600 L2420 600 L2700 1300 L1900 1300 Z";

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    return {
      anchors: {
        foot: fixed(1110, GROUND + 10),
        chamber: fixed(CHAMBER.x, CHAMBER.y),
        vent: fixed(CX - 10, 1060),
        crater: fixed(CRATER.x, CRATER.y),
        slope: fixed(2860, 1060),
        sky: fixed(1300, 420),
      },
      paths: {
        vent: VENT_PTS.map(function (p) { return { x: p[0], y: p[1] }; }),
        "lava-flow": FLOW_PTS.map(function (p) { return { x: p[0], y: p[1] }; }),
      },
    };
  }

  function palette(v) {
    var dusk = v === "dusk";
    return {
      dusk: dusk,
      sky: dusk ? [[0, "#1E1B48"], [0.45, "#4C2D6B"], [0.78, "#B4527A"], [1, "#F59E5B"]] : [[0, "#5BB3F0"], [0.6, "#A6D8F7"], [1, "#F8E9B8"]],
      sun: dusk ? "#FFC98A" : "#FFF4C2",
      far: dusk ? "#5A3F78" : "#8FA8CC", far2: dusk ? "#6E4A80" : "#A9BBD6",
      hill: dusk ? "#4E6A4A" : "#79B55A", hill2: dusk ? "#3F5A40" : "#62A04B",
      grass: dusk ? "#55804A" : "#7CC05A", grassTop: dusk ? "#6E9A5A" : "#9AD46C",
      soil: ["#8E6142", "#7A5136", "#5F3C29", "#4A2E20"],
      coneL: dusk ? "#7E5444" : "#9C6B4E", coneR: dusk ? "#5A3A30" : "#73503E", cut: "#5A3A2C",
      cloud: { cloud: dusk ? "#F3C9C0" : "#FFFFFF", cloudShade: dusk ? "#C98C9C" : "#DCEAF6", cloudLight: dusk ? "#FFE4D2" : "#FFFFFF" },
      tone: dusk ? A.toner(0.25, "#5B3F7A", 0.25) : function (c) { return c; },
    };
  }

  function drawSky(P, v, pal, R) {
    var defs = S.lin(P + "-sky", pal.sky) + S.rad(P + "-sunglow", [[0, pal.sun, 0.55], [1, pal.sun, 0]]);
    var s = tag("rect", { x: -2000, y: -1600, width: 7840, height: 4200, fill: "url(#" + P + "-sky)" });
    if (pal.dusk) s += A.stars(R, 90, 500, 300, 2800, 700, { scale: 1.2 });
    s += tag("circle", { cx: 3000, cy: pal.dusk ? 980 : 560, r: 360, fill: "url(#" + P + "-sunglow)" });
    s += tag("circle", { cx: 3000, cy: pal.dusk ? 980 : 560, r: 120, fill: pal.sun, opacity: 0.95 });
    var cl = "";
    [[900, 520, 0.9], [1900, 380, 0.7], [2750, 640, 0.8], [3300, 420, 0.6]].forEach(function (c, i) { cl += A.cloud(c[0], c[1], c[2], pal.cloud, i); });
    s += tag("g", { "data-part": "clouds", opacity: pal.dusk ? 0.75 : 0.95 }, cl);
    return { defs: defs, body: s };
  }

  function drawFar(P, v, pal, R) {
    var s = tag("path", { d: smooth([[-600, 1500], [100, 1060], [600, 1180], [1100, 980], [1500, 1140], [2000, 1020], [2600, 1160], [3100, 960], [3600, 1100], [4400, 1000], [4600, 1500]]) + " Z", fill: pal.far2, opacity: 0.85 });
    s += tag("path", { d: smooth([[-600, 1500], [0, 1180], [500, 1240], [1000, 1130], [1700, 1250], [2500, 1200], [3200, 1110], [3900, 1220], [4600, 1500]]) + " Z", fill: pal.far });
    return { defs: "", body: s };
  }

  function drawMid(P, v, pal, R) {
    var s = tag("path", { d: smooth([[-400, 1600], [200, 1250], [800, 1300], [1400, 1230], [2100, 1290], [2900, 1240], [3600, 1300], [4300, 1250], [4400, 1600]]) + " Z", fill: pal.hill2 });
    s += tag("path", { d: smooth([[-400, 1600], [400, 1300], [1100, 1330], [1700, 1290], [2600, 1330], [3300, 1290], [4300, 1330], [4400, 1600]]) + " Z", fill: pal.hill });
    [[350, 1200, 60], [520, 1225, 44], [1250, 1190, 52], [3350, 1200, 58], [3560, 1225, 42]].forEach(function (t, i) { s += A.tree(t[0], t[1], t[2], pal.tone, 40 + i, true); });
    return { defs: "", body: s };
  }

  function drawGround(P, v, pal, R) {
    var defs = S.lin(P + "-coneL", [[0, D.tint(pal.coneL, 0.12)], [1, pal.coneL]]) + S.lin(P + "-coneR", [[0, pal.coneR], [1, D.shade(pal.coneR, 0.2)]]) +
      S.lin(P + "-cut", [[0, "#6A4636"], [1, "#3E271E"]]) +
      S.rad(P + "-ch", [[0, "#FFF1B8"], [0.3, "#FFB23F"], [0.7, "#F2601A"], [1, "#A3261B"]], { cx: 0.45, cy: 0.4, r: 0.62 }) +
      S.rad(P + "-chglow", [[0, "#FF9A3C", 0.8], [1, "#FF9A3C", 0]]) +
      '<clipPath id="' + P + '-cutclip"><path d="' + CUT + '"/></clipPath>' +
      '<clipPath id="' + P + '-chclip"><ellipse cx="' + CHAMBER.x + '" cy="' + CHAMBER.y + '" rx="' + CHAMBER.rx + '" ry="' + CHAMBER.ry + '"/></clipPath>';
    // soil section
    var s = tag("rect", { x: -400, y: GROUND, width: 4640, height: 1200, fill: pal.soil[0] });
    s += tag("path", { d: smooth([[-400, 1440], [800, 1420], [1700, 1460], [2800, 1430], [4240, 1450]]) + " L4240 2400 L-400 2400 Z", fill: pal.soil[1] });
    s += tag("path", { d: smooth([[-400, 1640], [900, 1620], [1800, 1660], [3000, 1630], [4240, 1650]]) + " L4240 2400 L-400 2400 Z", fill: pal.soil[2] });
    s += tag("path", { d: smooth([[-400, 1960], [1000, 1940], [2100, 1980], [3200, 1950], [4240, 1970]]) + " L4240 2400 L-400 2400 Z", fill: pal.soil[3] });
    var peb = "";
    for (var i = 0; i < 46; i++) { var px = R() * 3840, py = GROUND + 60 + R() * 840; if (Math.abs(px - CX) < 520 && py > 1500) continue; peb += tag("ellipse", { cx: px, cy: py, rx: 12 + R() * 26, ry: 6 + R() * 10 }); }
    s += tag("g", { fill: "#3E261A", opacity: 0.4 }, peb);
    // chamber glow, cracks, chamber
    s += tag("ellipse", { "data-part": "chglow", cx: CHAMBER.x, cy: CHAMBER.y, rx: CHAMBER.rx * 1.6, ry: CHAMBER.ry * 1.9, fill: "url(#" + P + "-chglow)", opacity: 0.6 });
    s += tag("g", { "data-part": "cracks", stroke: "#FFB347", "stroke-width": 7, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.45 },
      tag("path", { d: "M1890 1740 L1830 1710 L1790 1730 L1730 1695 L1680 1710" }) + tag("path", { d: "M2715 1740 L2780 1710 L2815 1730 L2880 1695 L2930 1710" }) +
      tag("path", { d: "M2020 1620 L2000 1580 L2015 1540" }) + tag("path", { d: "M2580 1620 L2605 1580 L2590 1540" }));
    s += tag("ellipse", { cx: CHAMBER.x, cy: CHAMBER.y + 8, rx: CHAMBER.rx + 14, ry: CHAMBER.ry + 12, fill: "#2E1A12" });
    s += tag("ellipse", { "data-part": "chamber", cx: CHAMBER.x, cy: CHAMBER.y, rx: CHAMBER.rx, ry: CHAMBER.ry, fill: "url(#" + P + "-ch)" });
    s += tag("g", { "data-part": "bubbles", "clip-path": "url(#" + P + "-chclip)", fill: "#FFE7A3" });
    s += tag("path", { d: "M" + (CX - 300) + " " + (CHAMBER.y - 90) + " C " + (CX - 200) + " " + (CHAMBER.y - 130) + ", " + (CX + 40) + " " + (CHAMBER.y - 140) + ", " + (CX + 180) + " " + (CHAMBER.y - 120), fill: "none", stroke: "#FFF6D0", "stroke-width": 10, "stroke-linecap": "round", opacity: 0.5 });
    // the cone: lit left flank, shaded right flank, cut-away face with rock beds
    s += tag("path", { d: CONE, fill: "url(#" + P + "-coneL)" });
    s += tag("path", { d: "M2300 610 C 2380 900, 2560 1160, 2760 1300 L 3340 1300 C 3040 1240, 2700 1000, 2480 560 L 2410 586 Z", fill: "url(#" + P + "-coneR)", opacity: 0.9 });
    s += tag("path", { d: CUT, fill: "url(#" + P + "-cut)" });
    var beds = "";
    for (var k = 0; k < 12; k++) { var y = 640 + k * 62; beds += tag("path", { d: "M1840 " + (y + 300) + " L2300 " + y + " L2760 " + (y + 300), stroke: k % 2 ? "#6B4636" : "#4D3127", "stroke-width": 22, fill: "none", opacity: 0.9 }); }
    s += tag("g", { "clip-path": "url(#" + P + "-cutclip)" }, beds);
    s += tag("path", { d: CUT, fill: "none", stroke: "#2A1812", "stroke-width": 6, opacity: 0.6 });
    s += tag("path", { d: CONE, fill: "none", stroke: "#3E2620", "stroke-width": 8, "stroke-linejoin": "round" });
    s += tag("path", { d: "M1280 1296 C 1580 1236, 1910 996, 2124 572", fill: "none", stroke: D.tint(pal.coneL, 0.35), "stroke-width": 8, opacity: 0.5, "stroke-linecap": "round" });
    // the vent, an empty dark conduit from the chamber to the crater (a scene's custom fills it)
    var vd = smooth(VENT_PTS);
    s += tag("path", { d: vd, fill: "none", stroke: "#1E110C", "stroke-width": 84, "stroke-linecap": "round" });
    s += tag("path", { d: vd, fill: "none", stroke: "#3A1A10", "stroke-width": 50, "stroke-linecap": "round" });
    // grass over the land (not over the cut-away cone)
    s += tag("path", { d: "M-400 " + (GROUND - 10) + " L1300 " + (GROUND - 10) + " L1300 " + (GROUND + 22) + " L-400 " + (GROUND + 22) + " Z", fill: pal.grass });
    s += tag("path", { d: "M3300 " + (GROUND - 10) + " L4240 " + (GROUND - 10) + " L4240 " + (GROUND + 22) + " L3300 " + (GROUND + 22) + " Z", fill: pal.grass });
    s += tag("path", { d: "M-400 " + (GROUND - 10) + " L1300 " + (GROUND - 10) + " M3300 " + (GROUND - 10) + " L4240 " + (GROUND - 10), stroke: pal.grassTop, "stroke-width": 10 });
    // a little farm at the left: fence and a hut
    var farm = "";
    for (var f = 0; f < 8; f++) farm += tag("rect", { x: 100 + f * 76, y: GROUND - 70, width: 12, height: 70, fill: pal.tone("#8A5A3A") });
    farm += tag("rect", { x: 110, y: GROUND - 56, width: 560, height: 10, fill: pal.tone("#A06A44") }) + tag("rect", { x: 110, y: GROUND - 30, width: 560, height: 10, fill: pal.tone("#A06A44") });
    farm += tag("path", { d: "M760 1300 L760 1170 L830 1110 L900 1170 L900 1300 Z", fill: pal.tone("#E8D2B0"), stroke: "#5A3A2A", "stroke-width": 5 });
    farm += tag("path", { d: "M745 1176 L830 1096 L915 1176", fill: "none", stroke: pal.tone("#B5442E"), "stroke-width": 22, "stroke-linecap": "round" });
    farm += tag("rect", { x: 812, y: 1222, width: 36, height: 78, fill: pal.tone("#6B4A2F") });
    s += tag("g", { "data-part": "farm" }, farm);
    return { defs: defs, body: s };
  }

  function drawFront(P, v, pal, R) {
    var s = "";
    [[60, 1330], [180, 1345], [3720, 1335], [3810, 1350]].forEach(function (q) {
      for (var b = 0; b < 6; b++) { var a = -1.2 + b * 0.48; s += tag("path", { d: "M" + q[0] + " " + q[1] + " q " + r2(Math.cos(a) * 40) + " -60 " + r2(Math.cos(a) * 90) + " " + r2(-140 + Math.abs(a) * 40), stroke: pal.tone("#3E7A34"), "stroke-width": 14, fill: "none", "stroke-linecap": "round" }); }
    });
    return { defs: "", body: s };
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place volcano: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-volcano";
    var seed = opts.seed === undefined ? 3 : opts.seed | 0;
    var pal = palette(v);
    var parts = {
      sky: drawSky(P, v, pal, D.rng(seed + 1)), far: drawFar(P, v, pal, D.rng(seed + 2)), mid: drawMid(P, v, pal, D.rng(seed + 3)),
      ground: drawGround(P, v, pal, D.rng(seed + 4)), front: drawFront(P, v, pal, D.rng(seed + 5)),
    };
    var g = {};
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(layers[name], "volcano-" + name, parts[name].defs, parts[name].body); });
    var clouds = [].slice.call(g.sky.querySelectorAll("[data-cloud]")).map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    var stars = [].slice.call(g.sky.querySelectorAll("[data-star]"));
    var glow = g.ground.querySelector('[data-part="chglow"]');
    var bubG = g.ground.querySelector('[data-part="bubbles"]');
    var BR = D.rng(seed + 9), bubbles = [];
    for (var b = 0; b < 22; b++) bubbles.push({ x: CX - 380 + BR() * 760, r: 7 + BR() * 14, period: 1.8 + BR() * 1.8, phase: BR(), el: D.el(bubG, "circle", { r: 0, opacity: 0.8 }) });

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      clouds.forEach(function (c, i) { c.e.setAttribute("transform", "translate(" + r2(A.wrap(t * (5 + i * 2), -300, 300)) + " 0) " + c.base); });
      stars.forEach(function (e, i) { e.setAttribute("opacity", r2(0.45 + 0.35 * Math.sin(t * 1.6 + i * 1.3))); });
      glow.setAttribute("opacity", r2((pal.dusk ? 0.75 : 0.6) + 0.12 * Math.sin(t * 2.3)));
      bubbles.forEach(function (bb) {
        var u = ((t / bb.period) + bb.phase) % 1;
        bb.el.setAttribute("cx", r2(bb.x + 14 * Math.sin(u * 6.28 + bb.phase * 6)));
        bb.el.setAttribute("cy", r2(CHAMBER.y + CHAMBER.ry - u * CHAMBER.ry * 1.9));
        bb.el.setAttribute("r", r2(bb.r * Math.sin(u * Math.PI)));
      });
    }
    var a = anchorsFor(opts);
    update(0, PL.REF);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places.volcano = { meta: meta, anchorsFor: anchorsFor, mount: mount, flank: flank, CONE: CONE };
})(typeof globalThis !== "undefined" ? globalThis : window);
