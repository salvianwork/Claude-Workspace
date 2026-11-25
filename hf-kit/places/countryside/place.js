/* Place "countryside": a sunny railway through farmland, cut away so the ground and a lake show
 * in section. Sky with drifting clouds, layered hills, a windmill, a red barn and silo, a meadow
 * with a fence, a railway (ballast, sleepers, two rails) crossing a lake on a timber trestle
 * bridge, and the soil underneath (strata, stones, roots). Ported from the HyperFrames spike's
 * railway world, redrawn for the places contract with clear sky above every anchor so tags never
 * land on scenery.
 *
 * Variants: day (default), sunset, night. Anchors (ground-layer world px, 3840 x 2160 world):
 *   rail-near  on the near rail, left: where an actor stands or strikes the rail
 *   rail-far   on the far rail, right: where a listener kneels
 *   bridge     the middle of the bridge deck
 *   lake       under the water, in the middle of the lake
 *   barn       the barn door
 *   sky        open sky (for tags, a sound wave, a bird)
 * Path: rail (the near rail, left to right, through the bridge).
 * Extended (vertical videos, mount with extended: true; meta.extend): 720 px drawn above and below,
 * anchors and paths 720 lower (see drawTopBand / drawBottomBand and src/world/place.js).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("countryside/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "countryside",
    description: "Railway through farmland, cut away: sky, hills, windmill, barn, meadow, a lake under a trestle bridge, soil in section.",
    variants: ["day", "sunset", "night"],
    anchors: ["rail-near", "rail-far", "bridge", "lake", "barn", "sky"],
    paths: ["rail"],
    actorScale: 1, // mountActor scale for an actor standing on the ground layer (about 390 world px tall)
    // how an actor here is lit (mountActor light / rig state.light): sun or moon from the right
    actorLight: {
      day: { tint: "#FFF3DE", amount: 0.12, rim: "#FFF6DA", rimSide: 1 },
      sunset: { tint: "#FFB07A", amount: 0.4, rim: "#FFC27E", rimSide: 1 },
      night: { tint: "#5566A6", amount: 0.7, rim: "#C4D6FF", rimSide: 1 },
    },
    // the extension for vertical videos (place.js: mount with extended: true, world 3840 x 3600)
    extend: {
      top: { draws: "the sky continued upward: high cirrus, contrails with a plane, cumulus, a hot-air balloon and flocks of birds (day, sunset); stars to the top, the Milky Way, a shooting star and a plane's lights (night)", seamAllow: [] },
      bottom: { draws: "the soil continued down: darker deep soil, clay, a sand and gravel bed holding groundwater, slate bedrock with boulders; the oak's deep roots, earthworms, a geode and a little dinosaur fossil", seamAllow: [] },
    },
  };

  // ---- geometry (ground-layer world px) ------------------------------------------------------
  var G = {
    meadowBack: 1290, // back edge of the meadow (behind it: mid hills)
    railFar: 1446, railNear: 1496, // rail tops
    ballastTop: 1430, ballastBot: 1540,
    lip: 1600, // front edge of the meadow; the cut-away soil starts here
    lakeL: 1640, lakeR: 2840, lakeC: 2240, water: 1616, bed: 2050,
    deckTop: 1528, deckBot: 1566,
    barn: { x: 3460, y: 1318 }, silo: { x: 3700, y: 1322 },
    windmill: { x: 1480, y: 1268 }, // mid layer
  };
  function bedY(x) {
    var u = (x - G.lakeC) / ((G.lakeR - G.lakeL) / 2);
    if (Math.abs(u) >= 1) return G.water;
    return G.water + (G.bed - G.water) * Math.pow(1 - u * u, 0.62);
  }

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    return PL.offsetAnchors(baseAnchors(), PL.extendOffset(meta, opts));
  }
  function baseAnchors() {
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    var rail = [];
    for (var x = 0; x <= 3840; x += 320) rail.push({ x: x, y: G.railNear + 6 });
    return {
      anchors: {
        "rail-near": fixed(760, G.railNear + 10),
        "rail-far": fixed(3000, G.railFar + 4),
        bridge: fixed(G.lakeC, G.deckTop),
        lake: fixed(G.lakeC, 1830),
        barn: fixed(G.barn.x, G.barn.y - 40),
        sky: fixed(1920, 560),
      },
      paths: { rail: rail },
    };
  }

  // ---- palettes ------------------------------------------------------------------------------
  var SKY = {
    day: { stops: [[0, "#3F93D6"], [0.42, "#8FCBF0"], [0.78, "#CFE9F2"], [1, "#FFE4B0"]], sun: [2660, 640], sunCore: "#FFF6D0", sunGlow: "#FFE08A",
      cloud: "#FFFFFF", cloudShade: "#D3E5F3", cloudLight: "#FFFDF4", haze: "#FFE7BC" },
    sunset: { stops: [[0, "#2B3A78"], [0.35, "#8C5A98"], [0.62, "#F08A5D"], [0.86, "#FFC27A"], [1, "#FFE2A8"]], sun: [2700, 1010], sunCore: "#FFF1C2", sunGlow: "#FF9A4D",
      cloud: "#FFC9B0", cloudShade: "#C9708A", cloudLight: "#FFE6C8", haze: "#FFB070" },
    night: { stops: [[0, "#070D26"], [0.5, "#16224E"], [0.85, "#2E3D70"], [1, "#46507E"]], sun: [2660, 620], sunCore: "#F6F2DC", sunGlow: "#8FA6E0",
      cloud: "#3B4775", cloudShade: "#252F57", cloudLight: "#5A6799", haze: "#3A4A80" },
  };
  function toner(variant) {
    if (variant === "sunset") return function (c) { return D.shade(D.mix(c, "#FF8A45", 0.2), 0.06); };
    if (variant === "night") return function (c) { return D.mix(D.shade(c, 0.36), "#24366E", 0.46); };
    return function (c) { return c; };
  }

  // clouds [x, y, scale]: they drift right and wrap around the span below (off view at both ends)
  var CLOUDS = [[520, 600, 0.75], [1180, 470, 0.6], [1700, 760, 0.5], [2150, 560, 0.85], [3150, 470, 0.7], [3500, 800, 0.55], [-60, 720, 0.7], [4000, 560, 0.8]];
  var CLOUD_SPAN = [-700, 4500], BIRD_SPAN = [-400, 4300], MOTE_SPAN = [100, 3800];

  // ---- drawing -------------------------------------------------------------------------------
  function cloud(cx, cy, s, pal, id) {
    var out = "";
    out += tag("ellipse", { cx: 0, cy: 34, rx: 210, ry: 34, fill: pal.cloudShade, opacity: 0.9 });
    out += tag("ellipse", { cx: -95, cy: 0, rx: 110, ry: 70, fill: pal.cloud });
    out += tag("ellipse", { cx: 20, cy: -38, rx: 120, ry: 98, fill: pal.cloud });
    out += tag("ellipse", { cx: 130, cy: 4, rx: 100, ry: 64, fill: pal.cloud });
    out += tag("ellipse", { cx: 0, cy: 30, rx: 200, ry: 36, fill: pal.cloud });
    out += tag("ellipse", { cx: 40, cy: -70, rx: 60, ry: 40, fill: pal.cloudLight, opacity: 0.9 });
    out += tag("ellipse", { cx: 0, cy: 50, rx: 170, ry: 16, fill: pal.cloudShade, opacity: 0.55 });
    return tag("g", { "data-cloud": id, transform: "translate(" + r2(cx) + " " + r2(cy) + ") scale(" + r2(s) + ")" }, out);
  }

  function tree(x, y, r, tone, seed, outline) {
    var R = D.rng(seed), lean = (R() - 0.5) * 0.3;
    var dark = tone("#2F6E35"), mid = tone("#43913F"), light = tone("#79BC57"), trunk = tone("#6B4A2F");
    var s = tag("ellipse", { cx: x + r * 0.25, cy: y + r * 1.55, rx: r * 0.95, ry: r * 0.16, fill: "#1D3A1A", opacity: 0.22 });
    s += tag("path", { d: "M" + r2(x - r * 0.1) + " " + r2(y + r * 1.55) + " L" + r2(x - r * 0.06 + lean * r) + " " + r2(y + r * 0.4) + " L" + r2(x + r * 0.08 + lean * r) + " " + r2(y + r * 0.4) + " L" + r2(x + r * 0.12) + " " + r2(y + r * 1.55) + " Z",
      fill: trunk, stroke: outline ? D.shade(trunk, 0.35) : "none", "stroke-width": 3 });
    var blobs = [[0, 0, 1], [-0.55, 0.3, 0.68], [0.55, 0.28, 0.7], [0.05, -0.45, 0.66]];
    s += blobs.map(function (b) { return tag("circle", { cx: x + b[0] * r, cy: y + b[1] * r, r: b[2] * r, fill: mid, stroke: outline ? dark : "none", "stroke-width": outline ? 4 : 0 }); }).join("");
    s += blobs.map(function (b) { return tag("circle", { cx: x + b[0] * r, cy: y + b[1] * r, r: b[2] * r * 0.97, fill: mid }); }).join("");
    s += tag("circle", { cx: x - r * 0.35, cy: y + r * 0.42, r: r * 0.55, fill: dark, opacity: 0.45 });
    s += tag("circle", { cx: x + r * 0.28, cy: y - r * 0.38, r: r * 0.42, fill: light, opacity: 0.85 });
    s += tag("circle", { cx: x + r * 0.62, cy: y + r * 0.05, r: r * 0.24, fill: light, opacity: 0.6 });
    return s;
  }

  function drawSky(P, v, pal, tone, R) {
    var defs = S.lin(P + "-sky", pal.stops) + S.rad(P + "-sun", [[0, pal.sunCore, 1], [0.18, pal.sunGlow, 0.85], [0.5, pal.sunGlow, 0.25], [1, pal.sunGlow, 0]]) +
      S.lin(P + "-haze", [[0, pal.haze, 0], [1, pal.haze, 0.75]]);
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: "url(#" + P + "-sky)" });
    // the sky gradient is drawn over the frame area; extend its colours above and below
    s += tag("rect", { x: -2600, y: -1600, width: 9040, height: 1600, fill: pal.stops[0][1] });
    s += tag("rect", { x: -2600, y: 1300, width: 9040, height: 2500, fill: pal.stops[pal.stops.length - 1][1] });
    s += tag("rect", { x: -2600, y: 880, width: 9040, height: 440, fill: "url(#" + P + "-haze)" });
    if (v === "night") {
      var st = "";
      for (var i = 0; i < 150; i++) {
        var x = 300 + R() * 3300, y = 360 + R() * 760, rr = 1.6 + R() * 3.4;
        st += tag("circle", { cx: x, cy: y, r: rr, fill: "#FFF8E1", opacity: 0.35 + R() * 0.6, "data-star": i });
      }
      s += tag("g", { "data-part": "stars" }, st);
    }
    var sx = pal.sun[0], sy = pal.sun[1];
    s += tag("circle", { cx: sx, cy: sy, r: v === "sunset" ? 720 : 560, fill: "url(#" + P + "-sun)" });
    if (v === "night") {
      s += tag("circle", { cx: sx, cy: sy, r: 96, fill: pal.sunCore });
      s += tag("circle", { cx: sx - 26, cy: sy - 18, r: 20, fill: "#DCD6BC" }) + tag("circle", { cx: sx + 30, cy: sy + 26, r: 14, fill: "#DCD6BC" }) + tag("circle", { cx: sx + 18, cy: sy - 40, r: 9, fill: "#DCD6BC" });
    } else {
      s += tag("circle", { cx: sx, cy: sy, r: v === "sunset" ? 150 : 118, fill: pal.sunCore });
    }
    // clouds (moved in update). The sky layer (parallax 0.2) only ever shows about x 700..3200,
    // y 400..1700 of itself, so the sky is composed inside that window (see place.js).
    var cl = "";
    CLOUDS.forEach(function (c, i) { cl += cloud(c[0], c[1], c[2], pal, i); });
    s += tag("g", { "data-part": "clouds", opacity: v === "night" ? 0.7 : 1 }, cl);
    if (v === "day") { // a few birds
      var b = "";
      [[1380, 640, 0.8], [1450, 680, 0.65], [1510, 620, 0.72]].forEach(function (q, i) {
        b += tag("path", { "data-bird": i, d: "M-22 0 Q-10 -14 0 0 Q10 -14 22 0", fill: "none", stroke: "#2E3B55", "stroke-width": 5, "stroke-linecap": "round", transform: "translate(" + q[0] + " " + q[1] + ") scale(" + q[2] + ")" });
      });
      s += tag("g", { "data-part": "birds" }, b);
    }
    return { defs: defs, body: s };
  }

  function drawFar(P, v, pal, tone, R) {
    var defs = S.lin(P + "-far1", [[0, tone("#A9CFD0")], [1, tone("#8DB9B4")]]) + S.lin(P + "-far2", [[0, tone("#9CC9A8")], [1, tone("#7FB08A")]]);
    var ridge1 = [[-1600, 1180], [-900, 1010], [-200, 1080], [500, 960], [1200, 1060], [1900, 990], [2600, 1070], [3300, 950], [4000, 1060], [4700, 1000], [5440, 1090]];
    var ridge2 = [[-1600, 1180], [-800, 1120], [0, 1150], [800, 1090], [1600, 1150], [2400, 1100], [3200, 1160], [4000, 1105], [4800, 1150], [5440, 1130]];
    var close = function (pts) { return smooth(pts, false) + " L5440 2700 L-1600 2700 Z"; };
    var s = tag("path", { d: close(ridge1), fill: "url(#" + P + "-far1)" });
    // a soft highlight along the sunlit side of the far ridge
    s += tag("path", { d: smooth(ridge1, false), fill: "none", stroke: D.tint(tone("#BFE0DA"), 0.25), "stroke-width": 8, opacity: 0.7 });
    var small = "";
    for (var i = 0; i < 46; i++) {
      var x = -1200 + i * 140 + R() * 80, y = 1125 + R() * 40, r = 10 + R() * 9;
      small += tag("ellipse", { cx: x, cy: y, rx: r, ry: r * 1.2, fill: tone("#6E9F7C"), opacity: 0.85 });
    }
    s += tag("path", { d: close(ridge2), fill: "url(#" + P + "-far2)" }) + small;
    // a tiny far village: church spire and two houses on the left
    var house = function (x, y, c) { return tag("rect", { x: x, y: y - 26, width: 40, height: 26, fill: tone(c) }) + tag("path", { d: "M" + (x - 4) + " " + (y - 26) + " L" + (x + 20) + " " + (y - 44) + " L" + (x + 44) + " " + (y - 26) + " Z", fill: tone("#9A5B4A") }); };
    s += house(430, 1100, "#E8DCC8") + house(490, 1104, "#F0E4CE") + tag("rect", { x: 560, y: 1046, width: 22, height: 58, fill: tone("#E2D6C2") }) + tag("path", { d: "M556 1046 L571 1000 L586 1046 Z", fill: tone("#8E5546") });
    if (v === "night") s += tag("rect", { x: 445, y: 1084, width: 9, height: 9, fill: "#FFD27A" }) + tag("rect", { x: 505, y: 1088, width: 9, height: 9, fill: "#FFD27A" });
    return { defs: defs, body: s };
  }

  function windmill(tone, v) {
    var w = G.windmill, x = w.x, y = w.y, line = tone("#7A6A55");
    var s = tag("ellipse", { cx: x + 30, cy: y + 4, rx: 120, ry: 14, fill: "#1D3A1A", opacity: 0.18 });
    s += tag("path", { d: "M" + (x - 62) + " " + y + " L" + (x - 34) + " " + (y - 300) + " L" + (x + 34) + " " + (y - 300) + " L" + (x + 62) + " " + y + " Z", fill: tone("#F1E7D6"), stroke: line, "stroke-width": 5, "stroke-linejoin": "round" });
    s += tag("path", { d: "M" + (x + 8) + " " + y + " L" + (x + 18) + " " + (y - 300) + " L" + (x + 34) + " " + (y - 300) + " L" + (x + 62) + " " + y + " Z", fill: tone("#D8CBB4"), opacity: 0.8 });
    s += tag("path", { d: "M" + (x - 20) + " " + y + " L" + (x - 20) + " " + (y - 54) + " Q" + x + " " + (y - 74) + " " + (x + 20) + " " + (y - 54) + " L" + (x + 20) + " " + y + " Z", fill: tone("#8B5E34"), stroke: line, "stroke-width": 4 });
    s += tag("rect", { x: x - 12, y: y - 190, width: 24, height: 30, rx: 4, fill: v === "night" ? "#FFD27A" : tone("#5E7C8C"), stroke: line, "stroke-width": 3 });
    s += tag("path", { d: "M" + (x - 50) + " " + (y - 296) + " Q" + x + " " + (y - 372) + " " + (x + 50) + " " + (y - 296) + " Z", fill: tone("#A2453A"), stroke: tone("#6B2A22"), "stroke-width": 5 });
    var blade = "";
    for (var b = 0; b < 4; b++) {
      blade += tag("g", { transform: "rotate(" + b * 90 + ")" },
        tag("rect", { x: -6, y: -250, width: 12, height: 250, fill: tone("#7A5A3A") }) +
        tag("path", { d: "M8 -240 L62 -240 L56 -60 L8 -60 Z", fill: tone("#FBF6EC"), stroke: line, "stroke-width": 4 }) +
        tag("path", { d: "M8 -195 L60 -195 M8 -150 L58 -150 M8 -105 L57 -105 M34 -240 L32 -60", stroke: line, "stroke-width": 2.5, opacity: 0.7 }));
    }
    return { base: s, blades: tag("g", { "data-part": "blades", transform: "translate(" + x + " " + (y - 318) + ")" }, blade + tag("circle", { r: 16, fill: tone("#6B5640") })) };
  }

  function drawMid(P, v, pal, tone, R) {
    var defs = S.lin(P + "-mid", [[0, tone("#8CC46A")], [1, tone("#69A653")]]);
    var ridge = [[-1400, 1300], [-700, 1210], [100, 1250], [800, 1190], [1500, 1240], [2200, 1205], [2900, 1250], [3600, 1190], [4300, 1235], [5240, 1220]];
    var s = tag("path", { d: smooth(ridge, false) + " L5240 2700 L-1400 2700 Z", fill: "url(#" + P + "-mid)" });
    s += tag("path", { d: smooth(ridge, false), fill: "none", stroke: tone("#A8D77C"), "stroke-width": 10, opacity: 0.8 });
    // field stripes on the hills
    for (var f = 0; f < 6; f++) {
      var fx = -400 + f * 900 + R() * 200;
      s += tag("path", { d: "M" + r2(fx) + " 1300 Q" + r2(fx + 160) + " 1240 " + r2(fx + 420) + " 1236 L" + r2(fx + 470) + " 1300 Z", fill: tone(f % 2 ? "#B7CF6A" : "#7DB85A"), opacity: 0.55 });
    }
    var wm = windmill(tone, v);
    s += wm.base;
    // tree clumps along the ridge, kept away from the sky above the anchors
    var clumps = [[-300, 1180, 70], [-150, 1200, 52], [230, 1205, 48], [1080, 1180, 56], [1180, 1200, 42], [1900, 1190, 60], [2010, 1205, 44], [2620, 1205, 52], [2740, 1190, 66], [4000, 1190, 62], [4140, 1210, 46], [4500, 1200, 58]];
    clumps.forEach(function (c, i) { s += tree(c[0], c[1], c[2], tone, 40 + i, false); });
    return { defs: defs, body: s, blades: wm.blades };
  }

  function barn(tone, v) {
    var b = G.barn, x = b.x, y = b.y, red = tone("#C2412F"), dark = tone("#7A2A1F"), trim = tone("#F6EAD2"), roof = tone("#5E4A44");
    var s = tag("ellipse", { cx: x + 40, cy: y + 8, rx: 230, ry: 20, fill: "#1D3A1A", opacity: 0.22 });
    // silo
    var sx = G.silo.x, sy = G.silo.y;
    s += tag("rect", { x: sx - 54, y: sy - 300, width: 108, height: 300, fill: tone("#C9CFD3"), stroke: tone("#6F7A82"), "stroke-width": 5 });
    s += tag("rect", { x: sx + 14, y: sy - 300, width: 40, height: 300, fill: tone("#AEB6BC") });
    for (var r = 1; r < 6; r++) s += tag("path", { d: "M" + (sx - 54) + " " + (sy - r * 50) + " h108", stroke: tone("#8C979F"), "stroke-width": 3 });
    s += tag("path", { d: "M" + (sx - 58) + " " + (sy - 298) + " Q" + sx + " " + (sy - 380) + " " + (sx + 58) + " " + (sy - 298) + " Z", fill: tone("#8E9AA3"), stroke: tone("#5E6870"), "stroke-width": 5 });
    // barn body + roof
    s += tag("path", { d: "M" + (x - 170) + " " + y + " L" + (x - 170) + " " + (y - 160) + " L" + x + " " + (y - 270) + " L" + (x + 170) + " " + (y - 160) + " L" + (x + 170) + " " + y + " Z", fill: red, stroke: dark, "stroke-width": 6, "stroke-linejoin": "round" });
    for (var p = -150; p < 170; p += 26) s += tag("path", { d: "M" + (x + p) + " " + (y - 4) + " V" + r2(y - 160 - Math.max(0, 110 - Math.abs(p) * 0.65)), stroke: dark, "stroke-width": 2, opacity: 0.35 });
    s += tag("path", { d: "M" + (x + 60) + " " + y + " L" + (x + 60) + " " + (y - 230) + " L" + (x + 170) + " " + (y - 160) + " L" + (x + 170) + " " + y + " Z", fill: dark, opacity: 0.25 });
    s += tag("path", { d: "M" + (x - 196) + " " + (y - 150) + " L" + x + " " + (y - 290) + " L" + (x + 196) + " " + (y - 150), fill: "none", stroke: roof, "stroke-width": 24, "stroke-linecap": "round", "stroke-linejoin": "round" });
    // doors (the anchor) and hayloft
    s += tag("rect", { x: x - 70, y: y - 130, width: 140, height: 130, fill: v === "night" ? "#5A3A1E" : dark, stroke: trim, "stroke-width": 9 });
    s += tag("path", { d: "M" + (x - 66) + " " + (y - 126) + " L" + (x + 66) + " " + (y - 4) + " M" + (x + 66) + " " + (y - 126) + " L" + (x - 66) + " " + (y - 4) + " M" + x + " " + (y - 130) + " V" + y, stroke: trim, "stroke-width": 7 });
    s += tag("rect", { x: x - 34, y: y - 222, width: 68, height: 58, fill: v === "night" ? "#FFCF6E" : dark, stroke: trim, "stroke-width": 7 });
    if (v === "night") s += tag("circle", { cx: x, cy: y - 192, r: 80, fill: "#FFCF6E", opacity: 0.18 });
    // hay bales
    [[x + 190, y + 40, 42], [x + 262, y + 50, 38], [x + 226, y + 6, 34]].forEach(function (h) {
      s += tag("ellipse", { cx: h[0], cy: h[1], rx: h[2] * 1.25, ry: h[2], fill: tone("#E2B85A"), stroke: tone("#A97C2E"), "stroke-width": 4 });
      s += tag("ellipse", { cx: h[0] + h[2] * 0.6, cy: h[1], rx: h[2] * 0.42, ry: h[2] * 0.82, fill: tone("#F0CF7C"), stroke: tone("#A97C2E"), "stroke-width": 3 });
    });
    return s;
  }

  function drawGround(P, v, pal, tone, R) {
    var defs = S.lin(P + "-meadow", [[0, tone("#9AD16A")], [0.5, tone("#7CBF55")], [1, tone("#5E9F45")]]) +
      S.lin(P + "-soil", [[0, tone("#A87D52")], [0.3, tone("#8E6544")], [0.7, tone("#6E4D35")], [1, tone("#4C3526")]]) +
      S.lin(P + "-water", [[0, tone("#6ACDEB")], [0.35, tone("#3A9ACB")], [1, tone("#1D5C8E")]]) +
      S.lin(P + "-rail", [[0, tone("#F2F6F9")], [0.35, tone("#B1BCC6")], [1, tone("#5A6570")]]) +
      S.lin(P + "-ballast", [[0, tone("#C4B8A2")], [1, tone("#9C8F79")]]) +
      S.lin(P + "-murk", [[0, tone("#1D5C8E"), 0], [1, tone("#163F66"), 0.55]]) +
      "<clipPath id=\"" + P + "-lake\"><path d=\"" + lakePath() + "\"/></clipPath>";
    var s = "";
    // meadow
    var back = [[-300, G.meadowBack + 10], [500, G.meadowBack - 14], [1300, G.meadowBack + 8], [2100, G.meadowBack - 10], [2900, G.meadowBack + 6], [3600, G.meadowBack - 8], [4140, G.meadowBack + 4]];
    s += tag("path", { d: smooth(back, false) + " L4140 " + (G.lip + 30) + " L-300 " + (G.lip + 30) + " Z", fill: "url(#" + P + "-meadow)" });
    s += tag("path", { d: smooth(back, false), fill: "none", stroke: tone("#B4E07E"), "stroke-width": 8, opacity: 0.8 });
    // mown stripes
    for (var m = 0; m < 9; m++) s += tag("path", { d: "M" + (-300 + m * 520) + " " + (G.meadowBack + 20) + " l260 0 l120 " + (G.ballastTop - G.meadowBack - 30) + " l-260 0 Z", fill: tone("#A6D873"), opacity: 0.18 });
    // a dirt lane from the barn down to the track
    s += tag("path", { d: "M" + (G.barn.x - 60) + " " + (G.barn.y + 4) + " C" + (G.barn.x - 80) + " 1360 " + (G.barn.x - 300) + " 1380 " + (G.barn.x - 360) + " " + G.ballastTop + " L" + (G.barn.x - 230) + " " + G.ballastTop + " C" + (G.barn.x - 180) + " 1380 " + (G.barn.x + 40) + " 1360 " + (G.barn.x + 60) + " " + (G.barn.y + 4) + " Z", fill: tone("#D9BE8C"), opacity: 0.85 });
    // fence along the back of the meadow
    var fence = "";
    [[-200, 620], [2900, 3290], [3700, 4100]].forEach(function (run) {
      for (var fx = run[0]; fx <= run[1]; fx += 70) fence += tag("rect", { x: fx - 5, y: G.meadowBack + 2, width: 10, height: 56, rx: 2, fill: tone("#8B6A48"), stroke: tone("#5A4128"), "stroke-width": 2 });
      fence += tag("path", { d: "M" + run[0] + " " + (G.meadowBack + 18) + " H" + run[1] + " M" + run[0] + " " + (G.meadowBack + 38) + " H" + run[1], stroke: tone("#9C7A55"), "stroke-width": 6 });
    });
    s += fence;
    s += barn(tone, v);
    // a big oak framing the left edge
    s += tree(60, 1060, 230, tone, 9, true);
    // soil cut-away
    s += tag("rect", { x: -300, y: G.lip, width: 4440, height: 900, fill: "url(#" + P + "-soil)" });
    var band = function (y0, amp, fill, op) {
      var pts = [];
      for (var x = -300; x <= 4140; x += 370) pts.push([x, y0 + Math.sin(x / 410) * amp + (R() - 0.5) * amp]);
      return tag("path", { d: smooth(pts, false) + " L4140 2700 L-300 2700 Z", fill: fill, opacity: op });
    };
    s += band(1760, 22, tone("#7E5A3E"), 0.7) + band(1930, 30, tone("#634631"), 0.8) + band(2080, 24, tone("#4A3426"), 0.85);
    // roots from the meadow
    var roots = "";
    for (var rt = 0; rt < 34; rt++) {
      var rx = -200 + rt * 128 + R() * 60;
      if (rx > G.lakeL - 40 && rx < G.lakeR + 40) continue;
      var len = 40 + R() * 70;
      roots += tag("path", { d: "M" + r2(rx) + " " + (G.lip + 4) + " q" + r2(-14 + R() * 8) + " " + r2(len * 0.5) + " " + r2(4) + " " + r2(len) + " q" + r2(10) + " " + r2(len * 0.4) + " " + r2(-6) + " " + r2(len * 0.7) + " M" + r2(rx) + " " + (G.lip + 24) + " q" + r2(20) + " 12 " + r2(30 + R() * 10) + " " + r2(36),
        stroke: tone("#5C3F27"), "stroke-width": 4, fill: "none", "stroke-linecap": "round", opacity: 0.7 });
    }
    s += roots;
    // stones and pebbles
    var stones = "";
    for (var st = 0; st < 120; st++) {
      var sx = -250 + R() * 4380, sy = G.lip + 60 + R() * 520, sr = 8 + R() * (sy > 1950 ? 34 : 20);
      if (sx > G.lakeL - 60 && sx < G.lakeR + 60 && sy < bedY(sx) + 50) continue;
      var c = tone(st % 3 ? "#A6927A" : "#8E7D69");
      stones += tag("path", { d: "M" + r2(sx - sr) + " " + r2(sy) + " Q" + r2(sx - sr) + " " + r2(sy - sr * 0.85) + " " + r2(sx) + " " + r2(sy - sr * 0.8) + " Q" + r2(sx + sr * 1.2) + " " + r2(sy - sr * 0.7) + " " + r2(sx + sr) + " " + r2(sy) + " Q" + r2(sx) + " " + r2(sy + sr * 0.55) + " " + r2(sx - sr) + " " + r2(sy) + " Z",
        fill: c, stroke: tone("#5C4A38"), "stroke-width": 3 });
      stones += tag("path", { d: "M" + r2(sx - sr * 0.4) + " " + r2(sy - sr * 0.5) + " q" + r2(sr * 0.4) + " " + r2(-sr * 0.18) + " " + r2(sr * 0.8) + " 0", stroke: D.tint(c, 0.35), "stroke-width": 3, fill: "none", "stroke-linecap": "round" });
    }
    s += stones;
    // a fossil shell in the deep layer
    s += tag("g", { transform: "translate(620 2010)", opacity: 0.75 }, tag("path", { d: "M0 0 m-40 0 a40 40 0 1 1 80 0 a30 30 0 1 1 -60 0 a20 20 0 1 1 40 0 a10 10 0 1 1 -20 0", fill: "none", stroke: tone("#C9B79A"), "stroke-width": 6 }));
    // grass lip along the cut (broken by the lake)
    var lipSeg = function (x0, x1) {
      var d = "M" + x0 + " " + (G.lip - 10) + " H" + x1 + " V" + (G.lip + 14);
      for (var gx = x1; gx > x0; gx -= 24) d += " L" + (gx - 12) + " " + r2(G.lip + 26 + R() * 10) + " L" + Math.max(x0, gx - 24) + " " + (G.lip + 14);
      return tag("path", { d: d + " Z", fill: tone("#4F8E3A") }) + tag("path", { d: "M" + x0 + " " + (G.lip - 10) + " H" + x1, stroke: tone("#7EBE52"), "stroke-width": 6 });
    };
    s += lipSeg(-300, G.lakeL) + lipSeg(G.lakeR, 4140);
    // the lake in section
    s += tag("path", { d: lakePath(), fill: tone("#5E4330") });
    s += tag("path", { d: lakePath(-14), fill: "url(#" + P + "-water)" });
    s += tag("path", { d: "M" + G.lakeL + " " + G.water + " L" + G.lakeR + " " + G.water, stroke: tone("#BDEFFB"), "stroke-width": 9, opacity: 0.9 });
    var lake = "";
    for (var w = 0; w < 18; w++) { // waterweed
      var wx = G.lakeL + 80 + w * 62 + R() * 30, wb = bedY(wx) - 8, wh = 80 + R() * 130;
      lake += tag("path", { d: "M" + r2(wx) + " " + r2(wb) + " q" + r2(18) + " " + r2(-wh * 0.5) + " " + r2(-4) + " " + r2(-wh) + " q-12 -30 6 -" + r2(wh * 0.3), stroke: tone(w % 2 ? "#2F7D4F" : "#3E9A5C"), "stroke-width": 9, fill: "none", "stroke-linecap": "round", opacity: 0.85 });
    }
    for (var pb = 0; pb < 26; pb++) {
      var px = G.lakeL + 40 + R() * (G.lakeR - G.lakeL - 80);
      lake += tag("ellipse", { cx: px, cy: bedY(px) - 6, rx: 10 + R() * 14, ry: 6 + R() * 6, fill: tone(pb % 2 ? "#8C8F8A" : "#A39A86"), stroke: tone("#4F4A40"), "stroke-width": 2 });
    }
    // light caustics
    for (var cs = 0; cs < 10; cs++) {
      var cx = G.lakeL + 120 + cs * 110 + R() * 30;
      lake += tag("path", { d: "M" + r2(cx) + " " + (G.water + 30 + R() * 40) + " l" + r2(-60 - R() * 40) + " " + r2(220 + R() * 160), stroke: v === "night" ? "#9FB8F0" : "#E9FCFF", "stroke-width": 26 + R() * 30, opacity: 0.08, "stroke-linecap": "round" });
    }
    s += tag("g", { "clip-path": "url(#" + P + "-lake)" }, lake + tag("g", { "data-part": "fish" }, "") + tag("g", { "data-part": "bubbles" }, ""));
    // trestle bridge: bents in the water, deck over the gap
    // the bridge is lifted a little at night so the deck and legs still read against the water
    var btone = v === "night" ? function (c) { return D.tint(tone(c), 0.24); } : tone;
    var tr = "", wood = btone("#7B5230"), woodD = btone("#4E3219");
    for (var bx = G.lakeL + 120; bx < G.lakeR; bx += 240) {
      var by = bedY(bx) - 6, top = G.deckBot;
      tr += tag("path", { d: "M" + (bx - 14) + " " + top + " L" + (bx - 48) + " " + r2(by) + " M" + (bx + 14) + " " + top + " L" + (bx + 48) + " " + r2(by), stroke: wood, "stroke-width": 18, "stroke-linecap": "round" });
      tr += tag("path", { d: "M" + (bx - 26) + " " + (top + 90) + " L" + (bx + 26) + " " + (top + 90) + " M" + (bx - 38) + " " + r2((top + by) / 2 + 60) + " L" + (bx + 38) + " " + r2((top + by) / 2 + 60), stroke: woodD, "stroke-width": 10, "stroke-linecap": "round" });
      tr += tag("path", { d: "M" + (bx - 22) + " " + (top + 6) + " L" + (bx + 36) + " " + r2((top + by) / 2 + 40) + " M" + (bx + 22) + " " + (top + 6) + " L" + (bx - 36) + " " + r2((top + by) / 2 + 40), stroke: woodD, "stroke-width": 7, opacity: 0.85 });
    }
    s += tr;
    // the water hides the legs a little below the surface
    s += tag("path", { d: lakePath(-14), fill: "url(#" + P + "-murk)" });
    // lily pads and a frog
    [[1760, 0.9], [1850, 0.7], [2660, 1]].forEach(function (lp) {
      s += tag("path", { d: "M" + lp[0] + " " + G.water + " m-50 0 a50 12 0 1 0 100 0 l-50 0 Z", fill: tone("#4FA34A"), stroke: tone("#2E6B33"), "stroke-width": 3 });
    });
    s += tag("g", { transform: "translate(1770 " + (G.water - 18) + ")" }, tag("ellipse", { rx: 30, ry: 20, fill: tone("#5DBB4E"), stroke: tone("#1E5E22"), "stroke-width": 4 }) +
      tag("circle", { cx: -14, cy: -18, r: 10, fill: "#fff", stroke: tone("#1E5E22"), "stroke-width": 3 }) + tag("circle", { cx: 12, cy: -18, r: 10, fill: "#fff", stroke: tone("#1E5E22"), "stroke-width": 3 }) +
      tag("circle", { cx: -12, cy: -18, r: 4.5, fill: "#111" }) + tag("circle", { cx: 14, cy: -18, r: 4.5, fill: "#111" }) + tag("path", { d: "M-10 -2 q10 7 20 0", stroke: tone("#1E5E22"), "stroke-width": 3, fill: "none" }));
    if (v === "night") [[2420, 16, 110], [2470, 30, 70], [2440, 44, 40]].forEach(function (q) { s += tag("path", { d: "M" + (q[0] - q[2] / 2) + " " + (G.water + q[1]) + " h" + q[2], stroke: "#F6F2DC", "stroke-width": 6, "stroke-linecap": "round", opacity: 0.55 }); });
    // the railway
    var gap = function (y0, y1, fill) {
      return tag("path", { d: "M-300 " + y1 + " L-300 " + y0 + " L" + (G.lakeL - 10) + " " + y0 + " L" + (G.lakeL + 20) + " " + y1 + " Z M" + (G.lakeR + 10) + " " + y0 + " L4140 " + y0 + " L4140 " + y1 + " L" + (G.lakeR - 20) + " " + y1 + " Z", fill: fill });
    };
    s += gap(G.ballastTop, G.ballastBot, "url(#" + P + "-ballast)");
    s += gap(G.ballastBot - 10, G.ballastBot + 8, tone("#8A7D68"));
    var gravel = "";
    for (var gv = 0; gv < 260; gv++) {
      var gx2 = -300 + R() * 4440;
      if (gx2 > G.lakeL - 10 && gx2 < G.lakeR + 10) continue;
      gravel += tag("circle", { cx: gx2, cy: G.ballastTop + 8 + R() * (G.ballastBot - G.ballastTop - 10), r: 3 + R() * 4, fill: tone(gv % 2 ? "#ADA08A" : "#8F836F") });
    }
    s += gravel;
    // bridge deck
    s += tag("rect", { x: G.lakeL - 40, y: G.deckTop, width: G.lakeR - G.lakeL + 80, height: G.deckBot - G.deckTop, fill: btone("#8D6038"), stroke: woodD, "stroke-width": 5 });
    for (var dk = G.lakeL - 20; dk < G.lakeR + 40; dk += 60) s += tag("path", { d: "M" + dk + " " + (G.deckTop + 4) + " V" + (G.deckBot - 4), stroke: woodD, "stroke-width": 2, opacity: 0.5 });
    s += tag("path", { d: "M" + (G.lakeL - 40) + " " + (G.deckTop + 6) + " H" + (G.lakeR + 40), stroke: D.tint(btone("#8D6038"), 0.3), "stroke-width": 4 });
    // sleepers
    var sl = "";
    for (var x = -300; x < 4140; x += 46) sl += tag("path", { d: "M" + (x + 10) + " " + (G.railFar - 6) + " L" + (x - 2) + " " + (G.railNear + 22) + " L" + (x + 22) + " " + (G.railNear + 22) + " L" + (x + 32) + " " + (G.railFar - 6) + " Z", fill: tone("#6E4B32"), stroke: tone("#47301F"), "stroke-width": 2 });
    s += sl;
    s += tag("rect", { x: -300, y: G.railFar - 2, width: 4440, height: 14, fill: "url(#" + P + "-rail)", stroke: tone("#3D464F"), "stroke-width": 2 });
    s += tag("rect", { x: -300, y: G.railNear - 2, width: 4440, height: 20, fill: "url(#" + P + "-rail)", stroke: tone("#3D464F"), "stroke-width": 2.5 });
    // signal post to the left of the near anchor
    s += tag("g", { transform: "translate(330 " + (G.ballastTop + 6) + ")" }, tag("rect", { x: -8, y: -300, width: 16, height: 300, fill: tone("#4B5563") }) +
      tag("rect", { x: -38, y: -360, width: 76, height: 96, rx: 14, fill: tone("#1F2937") }) + tag("circle", { cx: 0, cy: -336, r: 16, fill: v === "night" ? "#FF5A5A" : "#7F1D1D" }) +
      tag("circle", { cx: 0, cy: -290, r: 16, fill: "#34D399" }) + tag("circle", { cx: 0, cy: -290, r: 24, fill: "#34D399", opacity: 0.3 }));
    // grass tufts and flowers along the front edge of the meadow
    var tufts = "";
    for (var g = 0; g < 90; g++) {
      var tx = -280 + g * 50 + R() * 30;
      if (tx > G.lakeL - 30 && tx < G.lakeR + 30) continue;
      var ty = G.ballastBot + 14 + R() * 40;
      tufts += tag("path", { d: "M" + r2(tx) + " " + r2(ty) + " l-9 -30 M" + r2(tx) + " " + r2(ty) + " l2 -38 M" + r2(tx) + " " + r2(ty) + " l12 -28", stroke: tone(g % 2 ? "#3E7F32" : "#4E9440"), "stroke-width": 5, "stroke-linecap": "round" });
      if (g % 3 === 0) tufts += tag("circle", { cx: tx + 3, cy: ty - 36, r: 7, fill: tone(["#FFFFFF", "#FFD43B", "#F783AC"][g % 9 === 0 ? 2 : g % 2]) });
    }
    for (var bg = 0; bg < 60; bg++) { // tufts in the back meadow
      var bx2 = -250 + R() * 4300, by2 = G.meadowBack + 60 + R() * 70;
      if (bx2 > 3100 && bx2 < 3800 && by2 < 1370) continue;
      tufts += tag("path", { d: "M" + r2(bx2) + " " + r2(by2) + " l-6 -18 M" + r2(bx2) + " " + r2(by2) + " l1 -22 M" + r2(bx2) + " " + r2(by2) + " l7 -16", stroke: tone("#5C9F42"), "stroke-width": 4, "stroke-linecap": "round" });
    }
    s += tufts;
    return { defs: defs, body: s };
  }

  function lakePath(inset) {
    var i = inset || 0, L = G.lakeL - i, Rr = G.lakeR + i, top = G.water + (i ? 0 : -12);
    var pts = [];
    for (var k = 0; k <= 24; k++) { var x = L + (Rr - L) * k / 24; pts.push([x, k === 0 || k === 24 ? top : bedY(x) + i]); }
    return "M" + r2(L) + " " + r2(top) + " " + pts.map(function (p) { return "L" + r2(p[0]) + " " + r2(p[1]); }).join(" ") + " Z";
  }

  function drawFront(P, v, pal, tone, R) {
    var s = "";
    // a clump of tall grass and wildflowers standing on the meadow lip
    var clump = function (cx, cy, n, flip) {
      var out = "";
      for (var i = 0; i < n; i++) {
        var x = cx + (R() - 0.5) * 220, h = 110 + R() * 170, bend = (R() - 0.3) * 80 * flip;
        out += tag("path", { d: "M" + r2(x - 9) + " " + cy + " Q" + r2(x + bend * 0.4) + " " + r2(cy - h * 0.6) + " " + r2(x + bend) + " " + r2(cy - h) + " Q" + r2(x + bend * 0.3 + 6) + " " + r2(cy - h * 0.55) + " " + r2(x + 9) + " " + cy + " Z",
          fill: tone(i % 3 ? "#3F8A35" : "#5FA845"), stroke: tone("#24561F"), "stroke-width": 3 });
      }
      for (var f = 0; f < Math.ceil(n / 4); f++) {
        var fx = cx + (R() - 0.5) * 200, fy = cy - 110 - R() * 130, col = tone(["#FFFFFF", "#FFD43B", "#F783AC", "#B197FC"][f % 4]);
        out += tag("path", { d: "M" + r2(fx) + " " + cy + " Q" + r2(fx + 10) + " " + r2((cy + fy) / 2) + " " + r2(fx) + " " + r2(fy), stroke: tone("#2F6E2A"), "stroke-width": 4, fill: "none" });
        for (var p = 0; p < 5; p++) {
          var a = p / 5 * Math.PI * 2;
          out += tag("ellipse", { cx: fx + Math.cos(a) * 13, cy: fy + Math.sin(a) * 13, rx: 11, ry: 8, fill: col, transform: "rotate(" + r2(a * 57.3) + " " + r2(fx + Math.cos(a) * 13) + " " + r2(fy + Math.sin(a) * 13) + ")" });
        }
        out += tag("circle", { cx: fx, cy: fy, r: 8, fill: tone("#F59F00") });
      }
      return out;
    };
    // foreground clumps on the meadow lip, away from the anchors' columns (parallax 1.15)
    s += clump(110, G.lip + 30, 16, 1) + clump(1330, G.lip + 30, 9, 1) + clump(3720, G.lip + 30, 14, -1);
    // drifting motes (warm light) or fireflies at night
    s += tag("g", { "data-part": "motes" }, "");
    return { defs: "", body: s };
  }

  // ---- the extension (vertical videos): 720 px of sky above, 720 px of ground below ----------
  // Band art is in the TALL world's px (3840 x 3600): the original sits at y 720 .. 2880.
  // The sky gradient over the original's sky rect at offset t (0 .. 1 of its 5400 px height).
  function skyAt(stops, t) {
    for (var i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      var a = stops[i - 1], b = stops[i];
      return D.mix(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
    }
    return stops[stops.length - 1][1];
  }
  // the original sky rect runs from y -1600 to 3800 (its own px); its y 0 is the seam (tall y 720)
  var SKY_T0 = 1600 / 5400;
  // band clouds [layer, x, y, scale] drift right like the sky's; birds [layer, x, y, scale]
  var XCLOUDS = [["mid", 640, 500, 0.95], ["mid", 2060, 300, 0.7], ["mid", 3380, 560, 1.05], ["ground", 1250, 170, 1.3], ["ground", 3420, 150, 0.9]];
  var XCLOUD_SPAN = [-800, 4640];
  var XBIRDS = [["ground", 300, 330, 1.7], ["ground", 400, 280, 1.4], ["ground", 470, 360, 1.55],
    ["mid", 1480, 600, 0.9], ["mid", 1540, 570, 0.8], ["mid", 1600, 545, 0.85], ["mid", 1660, 575, 0.8], ["mid", 1720, 605, 0.75], ["mid", 1420, 630, 0.75], ["mid", 1360, 660, 0.7]];

  function plane(x, y, s, col, rot) {
    return tag("g", { transform: "translate(" + r2(x) + " " + r2(y) + ") rotate(" + r2(rot || 0) + ") scale(" + r2(s) + ")" },
      tag("path", { d: "M-34 0 Q-30 -6 -10 -6 L30 -5 Q40 -3 42 0 Q40 3 30 4 L-10 5 Q-30 5 -34 0 Z", fill: col }) +
      tag("path", { d: "M2 -4 L-12 -30 L-4 -30 L16 -4 Z M2 4 L-10 26 L-3 26 L14 4 Z M-28 -3 L-36 -16 L-31 -16 L-22 -4 Z", fill: col }));
  }

  function balloon(x, y, s, tone, v) {
    var c1 = tone("#E8553E"), c2 = tone("#FFD15C"), c3 = tone("#2FA39A"), line = tone("#7A3A2A");
    var out = "", env = "M0 -130 C80 -130 120 -70 112 -10 C104 46 58 84 26 118 L-26 118 C-58 84 -104 46 -112 -10 C-120 -70 -80 -130 0 -130 Z";
    out += tag("path", { d: env, fill: c1, stroke: line, "stroke-width": 5 });
    out += tag("path", { d: "M0 -130 C40 -130 58 -70 54 -10 C50 46 34 84 14 118 L-14 118 C-34 84 -50 46 -54 -10 C-58 -70 -40 -130 0 -130 Z", fill: c2 });
    out += tag("path", { d: "M0 -130 C14 -130 20 -70 18 -10 C16 46 10 84 5 118 L-5 118 C-10 84 -16 46 -18 -10 C-20 -70 -14 -130 0 -130 Z", fill: c3 });
    out += tag("path", { d: "M-108 -20 Q0 4 108 -20", fill: "none", stroke: line, "stroke-width": 4, opacity: 0.5 });
    out += tag("path", { d: "M-60 -96 Q-80 -50 -74 0", fill: "none", stroke: "#FFFFFF", "stroke-width": 10, "stroke-linecap": "round", opacity: 0.35 });
    out += tag("path", { d: "M-24 118 L-20 160 M24 118 L20 160 M-6 118 L-6 160 M6 118 L6 160", stroke: line, "stroke-width": 3 });
    out += tag("rect", { x: -26, y: 158, width: 52, height: 36, rx: 6, fill: tone("#9A6A3C"), stroke: tone("#5E3E20"), "stroke-width": 4 });
    out += tag("path", { d: "M-26 170 H26", stroke: tone("#5E3E20"), "stroke-width": 3, opacity: 0.6 });
    if (v === "sunset") out += tag("path", { d: env, fill: "#FFB070", opacity: 0.18 });
    return tag("g", { "data-balloon": 0, transform: "translate(" + r2(x) + " " + r2(y) + ") scale(" + r2(s) + ")" }, out);
  }

  /* The top band: the sky gradient continued (sky layer), cirrus, contrails or the Milky Way (far),
   * cumulus, a balloon and a flock (mid), nearer birds and clouds (ground). Night: stars all the
   * way up, a shooting star and a plane's lights, no birds. Nothing crosses the seam row y 720. */
  function drawTopBand(P, v, pal, tone, R) {
    var night = v === "night", out = { sky: { defs: "", body: "" }, far: { defs: "", body: "" }, mid: { defs: "", body: "" }, ground: { defs: "", body: "" } };
    // sky layer: the original gradient continued upward exactly (its y 0 is the seam), so the
    // band meets the original with no step; it only shows at the very top of the tall world
    var st = pal.stops, list = [[0, st[0][1]]];
    st.forEach(function (q) { if (q[0] > 0 && q[0] < SKY_T0) list.push([r2(q[0] / SKY_T0 * 10000) / 10000, q[1]]); });
    list.push([1, skyAt(st, SKY_T0)]);
    out.sky.defs = '<linearGradient id="' + P + '-xsky" gradientUnits="userSpaceOnUse" x1="0" y1="-880" x2="0" y2="720">' + list.map(function (q) { return tag("stop", { offset: q[0], "stop-color": q[1] }); }).join("") + "</linearGradient>";
    out.sky.body = tag("rect", { x: -2600, y: -900, width: 9040, height: 1620, fill: "url(#" + P + "-xsky)" });
    if (night) {
      var s = "";
      for (var i = 0; i < 170; i++) {
        var big = R() < 0.07, sx = 200 + R() * 3440, sy = 20 + R() * 1040;
        if (Math.abs(sy - 720) < 8) sy += 16;
        s += tag("circle", { cx: sx, cy: sy, r: big ? 3.4 + R() * 2 : 1.4 + R() * 2.4, fill: ["#FFF8E1", "#FFFFFF", "#DCE8FF", "#FFE2C4"][(R() * 4) | 0], opacity: 0.4 + R() * 0.55, "data-xstar": i });
      }
      out.sky.body += tag("g", { "data-part": "xstars" }, s);
    }
    // far layer (parallax 0.45): high cirrus and contrails (day, sunset); the Milky Way (night)
    var f = "";
    var wisps = [[420, 520, 1.1], [1150, 600, 0.8], [2350, 470, 1.25], [3250, 640, 0.9], [760, 880, 0.9], [1900, 960, 1.1], [3050, 900, 0.8], [3600, 1010, 0.7]];
    wisps.forEach(function (w) {
      var g = "";
      for (var k = 0; k < 4; k++) g += tag("ellipse", { cx: (k - 1.5) * 110 * w[2] + R() * 40, cy: (k % 2) * 16 - 8, rx: (170 + R() * 150) * w[2], ry: 7 + R() * 7, fill: night ? pal.cloudLight : pal.cloudLight, opacity: (night ? 0.18 : 0.42) + R() * 0.18 });
      f += tag("g", { transform: "translate(" + w[0] + " " + w[1] + ") rotate(-5)", "data-wisp": 1 }, g);
    });
    if (!night) {
      // two contrails: a fresh one with its plane, an old one spread and fading
      var trail = v === "sunset" ? "#FFE2CC" : "#FFFFFF";
      out.far.defs += S.lin(P + "-trail", [[0, trail, 0], [0.75, trail, 0.75], [1, trail, 0.95]], [0, 0, 1, 0]);
      out.far.defs += S.lin(P + "-trail2", [[0, trail, 0], [0.5, trail, 0.35], [1, trail, 0]], [0, 0, 1, 0]);
      f += tag("g", { transform: "rotate(-6 1400 560)" }, tag("rect", { x: 300, y: 548, width: 2100, height: 26, rx: 13, fill: "url(#" + P + "-trail)", opacity: 0.5 }) +
        tag("rect", { x: 500, y: 552, width: 1900, height: 7, rx: 3.5, fill: "url(#" + P + "-trail)" }) + tag("rect", { x: 500, y: 564, width: 1900, height: 7, rx: 3.5, fill: "url(#" + P + "-trail)" }) +
        plane(2436, 562, 0.9, v === "sunset" ? "#6B4A6E" : "#8A9AB0", 0));
      f += tag("g", { transform: "rotate(4 3100 860)" }, tag("rect", { x: 2300, y: 832, width: 1700, height: 54, rx: 27, fill: "url(#" + P + "-trail2)", opacity: 0.55 }));
    } else {
      out.far.defs += S.rad(P + "-milky", [[0, "#C8D2FF", 0.2], [0.6, "#A9B6EE", 0.08], [1, "#A9B6EE", 0]]);
      f += tag("ellipse", { cx: 1900, cy: 760, rx: 2100, ry: 230, fill: "url(#" + P + "-milky)", transform: "rotate(-12 1900 760)" });
      var dust = "";
      for (var m = 0; m < 160; m++) {
        var u = R() * 2 - 1, mx = 1900 + u * 1900, my = 760 - u * 1900 * Math.tan(12 * Math.PI / 180) + (R() + R() - 1) * 150;
        if (Math.abs(my - 720) < 6) my += 12;
        dust += tag("circle", { cx: r2(mx), cy: r2(my), r: r2(1 + R() * 2.2), fill: "#EEF1FF", opacity: r2(0.3 + R() * 0.5), "data-xstar": 1000 + m });
      }
      f += tag("g", { "data-part": "milky" }, dust);
      f += tag("g", { "data-part": "shooting", opacity: 0 }, tag("path", { d: "M0 0 L-260 -70", stroke: "#FFFFFF", "stroke-width": 5, "stroke-linecap": "round", opacity: 0.9 }) +
        tag("path", { d: "M0 0 L-420 -113", stroke: "#BFD0FF", "stroke-width": 10, "stroke-linecap": "round", opacity: 0.25 }) + tag("circle", { r: 6, fill: "#FFFFFF" }));
      f += tag("g", { "data-part": "nightplane", transform: "translate(2950 560)" }, plane(0, 0, 0.8, "#1A2244", 0) +
        tag("circle", { cx: -8, cy: -26, r: 5, fill: "#FF5A5A", "data-blink": 0 }) + tag("circle", { cx: 40, cy: 0, r: 4, fill: "#FFFFFF", "data-blink": 1 }));
    }
    out.far.body = f;
    // mid layer (0.75): cumulus, a hot-air balloon and a flock (day, sunset)
    var mm = "";
    XCLOUDS.forEach(function (c, i) { if (c[0] === "mid") mm += cloud(c[1], c[2], c[3], pal, "x" + i); });
    if (!night) mm += balloon(2760, 380, 1, tone, v);
    out.mid.body = tag("g", { "data-part": "xclouds-mid", opacity: night ? 0.7 : 1 }, mm);
    // ground layer (1): the nearest high clouds and birds
    var gg = "";
    XCLOUDS.forEach(function (c, i) { if (c[0] === "ground") gg += cloud(c[1], c[2], c[3], pal, "x" + i); });
    out.ground.body = tag("g", { "data-part": "xclouds-ground", opacity: night ? 0.55 : 0.95 }, gg);
    if (!night) {
      var birdCol = v === "sunset" ? "#3B2440" : "#2E3B55";
      ["mid", "ground"].forEach(function (layer) {
        var b = "";
        XBIRDS.forEach(function (q, i) {
          if (q[0] !== layer) return;
          b += tag("path", { "data-xbird": i, d: "M-22 0 Q-10 -14 0 0 Q10 -14 22 0", fill: "none", stroke: birdCol, "stroke-width": 5, "stroke-linecap": "round", transform: "translate(" + q[1] + " " + q[2] + ") scale(" + q[3] + ")" });
        });
        out[layer].body += tag("g", { "data-part": "xbirds" }, b);
      });
    }
    return out;
  }

  /* A wavy stratum top through x -300 .. 4140 around y0, closed below the world. */
  function stratum(R, y0, amp, fill, extra) {
    var pts = [];
    for (var x = -300; x <= 4140; x += 340) pts.push([x, y0 + Math.sin(x / 520 + y0) * amp + (R() - 0.5) * amp]);
    return { top: pts, d: smooth(pts, false) + " L4140 3800 L-300 3800 Z", body: tag("path", Object.assign({ d: smooth(pts, false) + " L4140 3800 L-300 3800 Z", fill: fill }, extra || {})) };
  }
  function yOn(pts, x) { // the stratum top's y at x (linear between its points)
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) { var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return pts[pts.length - 1][1];
  }

  function fossil(x, y, s, tone) {
    var bone = tone("#EFE6D2"), line = tone("#8C7C62"), out = "";
    // a little long-necked dinosaur, lying on its side
    out += tag("path", { d: "M-180 30 Q-120 -10 -40 0 Q40 6 90 -20 Q140 -60 170 -110 Q186 -136 214 -140", fill: "none", stroke: line, "stroke-width": 22, "stroke-linecap": "round" });
    out += tag("path", { d: "M-180 30 Q-120 -10 -40 0 Q40 6 90 -20 Q140 -60 170 -110 Q186 -136 214 -140", fill: "none", stroke: bone, "stroke-width": 14, "stroke-linecap": "round", "stroke-dasharray": "16 6" });
    out += tag("path", { d: "M-180 30 Q-250 60 -330 50 Q-380 44 -410 20", fill: "none", stroke: line, "stroke-width": 16, "stroke-linecap": "round" }) +
      tag("path", { d: "M-180 30 Q-250 60 -330 50 Q-380 44 -410 20", fill: "none", stroke: bone, "stroke-width": 9, "stroke-linecap": "round", "stroke-dasharray": "12 5" });
    for (var k = 0; k < 7; k++) {
      var rx = -110 + k * 26;
      out += tag("path", { d: "M" + rx + " " + (k < 1 ? -4 : 0) + " q" + (-6 + k) + " 46 " + (-20 + k * 2) + " 66", fill: "none", stroke: line, "stroke-width": 10, "stroke-linecap": "round" }) +
        tag("path", { d: "M" + rx + " " + (k < 1 ? -4 : 0) + " q" + (-6 + k) + " 46 " + (-20 + k * 2) + " 66", fill: "none", stroke: bone, "stroke-width": 5, "stroke-linecap": "round" });
    }
    [[-120, 10, -150, 110, -120, 120], [10, 10, 30, 112, 60, 118]].forEach(function (L) {
      out += tag("path", { d: "M" + L[0] + " " + L[1] + " L" + L[2] + " " + L[3] + " L" + L[4] + " " + L[5], fill: "none", stroke: line, "stroke-width": 16, "stroke-linecap": "round", "stroke-linejoin": "round" }) +
        tag("path", { d: "M" + L[0] + " " + L[1] + " L" + L[2] + " " + L[3] + " L" + L[4] + " " + L[5], fill: "none", stroke: bone, "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round" });
    });
    out += tag("ellipse", { cx: 232, cy: -146, rx: 34, ry: 20, fill: bone, stroke: line, "stroke-width": 5, transform: "rotate(-14 232 -146)" }) +
      tag("circle", { cx: 238, cy: -152, r: 6, fill: line }) + tag("path", { d: "M214 -132 Q236 -124 262 -136", fill: "none", stroke: line, "stroke-width": 3 });
    return tag("g", { "data-part": "fossil", transform: "translate(" + x + " " + y + ") scale(" + s + ")" }, out);
  }

  function geode(x, y, s, tone) {
    var out = tag("path", { d: "M-80 0 Q-84 -60 -20 -70 Q50 -76 80 -20 Q96 40 30 62 Q-50 76 -80 0 Z", fill: tone("#5D5A66"), stroke: tone("#3A3842"), "stroke-width": 6 });
    out += tag("path", { d: "M-56 0 Q-58 -42 -14 -48 Q40 -52 60 -14 Q70 30 22 44 Q-36 54 -56 0 Z", fill: tone("#4B2F6E") });
    var cr = "";
    for (var k = 0; k < 12; k++) {
      var a = k / 12 * Math.PI * 2, cx = Math.cos(a) * 40, cy = Math.sin(a) * 28;
      cr += tag("path", { d: "M" + r2(cx * 1.2) + " " + r2(cy * 1.2) + " L" + r2(cx * 0.45 - 6) + " " + r2(cy * 0.45) + " L" + r2(cx * 0.5 + 6) + " " + r2(cy * 0.5 - 6) + " Z", fill: tone(k % 2 ? "#B58CF0" : "#D6BCFF"), stroke: tone("#7A52B8"), "stroke-width": 2 });
    }
    out += cr + tag("circle", { cx: -6, cy: -6, r: 10, fill: "#FFFFFF", opacity: 0.5 });
    return tag("g", { "data-part": "geode", transform: "translate(" + x + " " + y + ") scale(" + s + ")" }, out);
  }

  /* The bottom band: the soil continued down, then clay, a sand and gravel bed holding groundwater,
   * and bedrock; the oak's deep roots, worms, pebbles, a geode and a little dinosaur fossil. Its
   * strata start below y 3000, so the original's soil runs on unbroken across the seam (y 2880). */
  function drawBottomBand(P, v, pal, tone, R) {
    var under = tag("rect", { x: -300, y: 2860, width: 4440, height: 940, fill: tone("#4C3526") });
    var defs = S.lin(P + "-xclay", [[0, tone("#8E5E3E")], [1, tone("#6F4630")]]) +
      S.lin(P + "-xsand", [[0, tone("#C9A066")], [0.55, tone("#B08A58")], [1, tone("#7F8F94")]]) +
      S.lin(P + "-xrock", [[0, tone("#868A98")], [1, tone("#4E5160")]]) +
      S.lin(P + "-xwater", [[0, tone("#5FA8D3"), 0], [1, tone("#3F86C0"), 0.6]]) +
      S.lin(P + "-xroot", [[0, tone("#4A321F"), 0], [0.2, tone("#4A321F"), 1], [1, tone("#3E2A1A"), 1]]) +
      S.lin(P + "-xrootc", [[0, tone("#8A6142"), 0], [0.2, tone("#8A6142"), 1], [1, tone("#9C7350"), 1]]) +
      S.lin(P + "-xdeep", [[0, "#000000", 0], [1, "#000000", 0.28]]);
    var s = "";
    // darker deep soil streaks just below the original (no edge: soft bands)
    for (var q = 0; q < 14; q++) {
      var qx = -200 + R() * 4200, qy = 2960 + R() * 90;
      s += tag("ellipse", { cx: r2(qx), cy: r2(qy), rx: r2(160 + R() * 260), ry: r2(8 + R() * 10), fill: tone(q % 2 ? "#3F2B1F" : "#5A3F2C"), opacity: 0.45 });
    }
    // the original's pebbles carry on down through the deep soil
    for (var pb = 0; pb < 70; pb++) {
      var px = -250 + R() * 4380, py = 2905 + R() * 150, pr = 8 + R() * 22;
      var pc = tone(pb % 3 ? "#A6927A" : "#8E7D69");
      s += tag("path", { d: "M" + r2(px - pr) + " " + r2(py) + " Q" + r2(px - pr) + " " + r2(py - pr * 0.85) + " " + r2(px) + " " + r2(py - pr * 0.8) + " Q" + r2(px + pr * 1.2) + " " + r2(py - pr * 0.7) + " " + r2(px + pr) + " " + r2(py) + " Q" + r2(px) + " " + r2(py + pr * 0.55) + " " + r2(px - pr) + " " + r2(py) + " Z",
        fill: pc, stroke: tone("#5C4A38"), "stroke-width": 3 }) +
        tag("path", { d: "M" + r2(px - pr * 0.4) + " " + r2(py - pr * 0.5) + " q" + r2(pr * 0.4) + " " + r2(-pr * 0.18) + " " + r2(pr * 0.8) + " 0", stroke: D.tint(pc, 0.35), "stroke-width": 3, fill: "none", "stroke-linecap": "round" });
    }
    // clay
    var clay = stratum(R, 3075, 26, "url(#" + P + "-xclay)");
    s += clay.body + tag("path", { d: smooth(clay.top, false), fill: "none", stroke: tone("#A8744C"), "stroke-width": 7, opacity: 0.8 });
    for (var c = 0; c < 26; c++) { // pale clay lenses
      var cx = -200 + R() * 4300, cy = yOn(clay.top, cx) + 40 + R() * 90;
      s += tag("ellipse", { cx: r2(cx), cy: r2(cy), rx: r2(40 + R() * 90), ry: r2(6 + R() * 8), fill: tone("#B88660"), opacity: 0.55 });
    }
    // sand and gravel, with groundwater in its lower part
    var sand = stratum(R, 3235, 18, "url(#" + P + "-xsand)");
    s += sand.body + tag("path", { d: smooth(sand.top, false), fill: "none", stroke: tone("#DDBB82"), "stroke-width": 6, opacity: 0.8 });
    s += tag("rect", { x: -300, y: 3290, width: 4440, height: 140, fill: "url(#" + P + "-xwater)" });
    var grit = "";
    for (var g = 0; g < 260; g++) {
      var gx = -280 + R() * 4400, gy = yOn(sand.top, gx) + 14 + R() * 150, gr = 3 + R() * 9;
      grit += tag("ellipse", { cx: r2(gx), cy: r2(gy), rx: r2(gr * 1.25), ry: r2(gr), fill: tone(["#9C8F79", "#C7B79A", "#7E7466", "#B5A58A"][g % 4]), stroke: g % 3 ? "none" : tone("#5C4A38"), "stroke-width": 2 });
    }
    s += grit;
    for (var dp = 0; dp < 22; dp++) { // water droplets in the wet sand
      var dx = -200 + R() * 4200, dy = 3320 + R() * 80;
      s += tag("path", { d: "M" + r2(dx) + " " + r2(dy - 12) + " q8 12 0 18 q-8 -6 0 -18 Z", fill: v === "night" ? "#8FB6F0" : "#BFE8FF", opacity: 0.75 });
    }
    // bedrock: slate blocks with cracks
    var rock = stratum(R, 3400, 24, "url(#" + P + "-xrock)");
    s += rock.body + tag("path", { d: smooth(rock.top, false), fill: "none", stroke: tone("#A7ABB8"), "stroke-width": 8, opacity: 0.85 });
    var cracks = "";
    for (var k = 0; k < 22; k++) {
      var kx = -200 + k * 200 + R() * 80, ky = yOn(rock.top, kx) + 8;
      cracks += "M" + r2(kx) + " " + r2(ky) + " l" + r2(-20 + R() * 40) + " " + r2(60 + R() * 50) + " l" + r2(-30 + R() * 60) + " " + r2(50 + R() * 60) + " ";
      if (k % 2) cracks += "M" + r2(kx - 120) + " " + r2(ky + 90 + R() * 60) + " h" + r2(140 + R() * 80) + " ";
    }
    s += tag("path", { d: cracks, fill: "none", stroke: tone("#3F4250"), "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.75 });
    var boulders = "";
    for (var b = 0; b < 16; b++) {
      var bx = -200 + R() * 4300, by = 3480 + R() * 120, br = 26 + R() * 40;
      if (bx > 2650 && bx < 3300 && by < 3600) continue; // keep the fossil clear
      if (bx > 1000 && bx < 1360) continue; // and the geode
      boulders += tag("path", { d: "M" + r2(bx - br) + " " + r2(by) + " Q" + r2(bx - br) + " " + r2(by - br * 0.9) + " " + r2(bx) + " " + r2(by - br * 0.85) + " Q" + r2(bx + br * 1.2) + " " + r2(by - br * 0.7) + " " + r2(bx + br) + " " + r2(by) + " Q" + r2(bx) + " " + r2(by + br * 0.6) + " " + r2(bx - br) + " " + r2(by) + " Z",
        fill: tone(b % 2 ? "#9599A6" : "#6F7381"), stroke: tone("#3F4250"), "stroke-width": 4 }) +
        tag("path", { d: "M" + r2(bx - br * 0.45) + " " + r2(by - br * 0.5) + " q" + r2(br * 0.45) + " " + r2(-br * 0.2) + " " + r2(br * 0.9) + " 0", stroke: "#FFFFFF", "stroke-width": 4, fill: "none", opacity: 0.3, "stroke-linecap": "round" });
    }
    s += boulders;
    s += fossil(2960, 3512, 0.7, tone) + geode(1180, 3500, 1.1, tone);
    // the oak's deep roots (left) and a few long meadow roots, fading in from the dark soil
    var roots = "";
    var rootPath = function (x0, len, sway, w, seed) {
      var RR = D.rng(seed), pts = [[x0, 2850]], x = x0, y = 2850;
      while (y < 2850 + len) { y += 60 + RR() * 40; x += (RR() - 0.5) * sway; pts.push([x, y]); }
      var d = smooth(pts, false), side = "";
      for (var j = 2; j < pts.length - 1; j += 1 + (j % 2)) { // side rootlets
        var p = pts[j], dir = j % 2 ? 1 : -1;
        side += "M" + r2(p[0]) + " " + r2(p[1]) + " q" + r2(dir * 40) + " " + r2(20 + RR() * 20) + " " + r2(dir * (70 + RR() * 50)) + " " + r2(60 + RR() * 40) + " ";
      }
      // a dark rim and a lighter core (like the fossil's bones), fading in from the dark soil
      return tag("path", { d: side, fill: "none", stroke: tone("#3E2A1A"), "stroke-width": Math.max(5, w * 0.5), "stroke-linecap": "round" }) +
        tag("path", { d: side, fill: "none", stroke: tone("#8A6142"), "stroke-width": Math.max(2, w * 0.5 - 4), "stroke-linecap": "round" }) +
        tag("path", { d: d, fill: "none", stroke: "url(#" + P + "-xroot)", "stroke-width": w, "stroke-linecap": "round" }) +
        tag("path", { d: d, fill: "none", stroke: "url(#" + P + "-xrootc)", "stroke-width": Math.max(2, w - 7), "stroke-linecap": "round" });
    };
    roots += rootPath(80, 540, 120, 22, 71) + rootPath(200, 430, 140, 16, 72) + rootPath(-30, 380, 90, 14, 73) + rootPath(320, 300, 160, 11, 74);
    [[980, 240], [1380, 200], [3060, 260], [3600, 230], [3880, 210]].forEach(function (r, i) { roots += rootPath(r[0], r[1], 100, 9, 80 + i); });
    s += tag("g", { "data-part": "xroots", opacity: 0.95 }, roots);
    // earthworms in the soil and clay
    [[1640, 3010, 0], [2580, 3140, 1], [3420, 2990, 2]].forEach(function (w) {
      var d = "M0 0 q20 -18 40 0 q20 18 40 0 q20 -18 40 0";
      s += tag("g", { "data-part": "worm", transform: "translate(" + w[0] + " " + w[1] + ") rotate(" + (w[2] * 25 - 20) + ")" },
        tag("path", { d: d, fill: "none", stroke: tone("#C76B7B"), "stroke-width": 14, "stroke-linecap": "round" }) +
        tag("path", { d: d, fill: "none", stroke: tone("#E99AA6"), "stroke-width": 5, "stroke-linecap": "round", opacity: 0.8, transform: "translate(0 -3)" }) +
        tag("circle", { cx: 120, cy: -2, r: 3, fill: tone("#5B2A33") }));
    });
    // depth: a soft darkening toward the bottom of the world
    s += tag("rect", { x: -300, y: 3250, width: 4440, height: 550, fill: "url(#" + P + "-xdeep)" });
    return { defs: defs, under: under, body: s };
  }

  // ---- mount ---------------------------------------------------------------------------------
  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place countryside: mount needs the layers from HFKit.placeLayers");
    var P = (opts.idPrefix || "place-countryside");
    var seed = opts.seed === undefined ? 7 : opts.seed | 0;
    var pal = SKY[v], tone = toner(v);
    var parts = {
      sky: drawSky(P, v, pal, tone, D.rng(seed + 1)), far: drawFar(P, v, pal, tone, D.rng(seed + 2)), mid: drawMid(P, v, pal, tone, D.rng(seed + 3)),
      ground: drawGround(P, v, pal, tone, D.rng(seed + 4)), front: drawFront(P, v, pal, tone, D.rng(seed + 5)),
    };
    var X = PL.extendLayers(layers, opts, meta), L = X.layers;
    var g = {};
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(L[name], "countryside-" + name, parts[name].defs, parts[name].body); });
    if (X.on) { // the bands above and below (tall-world px)
      var top = drawTopBand(P, v, pal, tone, D.rng(seed + 31)), bot = drawBottomBand(P, v, pal, tone, D.rng(seed + 32));
      ["sky", "far", "mid", "ground"].forEach(function (name) { PL.band(X.over[name], "top", top[name].defs, top[name].body); });
      PL.band(X.under.ground, "bottom", "", bot.under);
      PL.band(X.over.ground, "bottom", bot.defs, bot.body);
    }
    var bladesG = D.el(L.mid, "g", { "data-part": "windmill-blades" });
    bladesG.innerHTML = parts.mid.blades;
    var blades = bladesG.firstChild;
    var clouds = [].slice.call(g.sky.querySelectorAll("[data-cloud]")).map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    var birds = [].slice.call(g.sky.querySelectorAll("[data-bird]")).map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    var stars = [].slice.call(g.sky.querySelectorAll("[data-star]"));
    var starOp = stars.map(function (e) { return +e.getAttribute("opacity"); });
    // fish, bubbles, motes: built once, moved in update
    var fishG = g.ground.querySelector('[data-part="fish"]'), bubG = g.ground.querySelector('[data-part="bubbles"]'), moteG = g.front.querySelector('[data-part="motes"]');
    var FISH = [[2080, 1740, "#FB7185", 0], [2400, 1860, "#F59F00", 1], [2160, 1900, "#FF8787", 2], [2500, 1700, "#9775FA", 3]];
    var fish = FISH.map(function (q) {
      var body = tone(q[2]), line = D.shade(body, 0.5), e = D.el(fishG, "g", {});
      e.innerHTML = tag("ellipse", { rx: 40, ry: 20, fill: body, stroke: line, "stroke-width": 4 }) + tag("path", { d: "M36 0 L66 -20 L66 20 Z", fill: body, stroke: line, "stroke-width": 4, "stroke-linejoin": "round" }) +
        tag("path", { d: "M-4 -18 Q8 -30 18 -16", fill: D.shade(body, 0.15), stroke: line, "stroke-width": 3 }) + tag("circle", { cx: -20, cy: -4, r: 6, fill: "#fff" }) + tag("circle", { cx: -21, cy: -4, r: 3, fill: "#111" });
      return { e: e, q: q };
    });
    var bubbles = D.presets.bubbles(seed + 11, 12), bubEls = bubbles.list.map(function () { return D.el(bubG, "circle", { r: 6, fill: "none", stroke: "#E6FBFF", "stroke-width": 3, opacity: 0 }); });
    var night = v === "night";
    var MR = D.rng(seed + 21), motes = [];
    for (var i = 0; i < (night ? 26 : 18); i++) motes.push({ x: 200 + MR() * 3500, y: (night ? 1250 : 700) + MR() * (night ? 300 : 700), s: MR() * 100 | 0, r: night ? 6 : 5 + MR() * 4,
      e: D.el(moteG, "circle", { r: 6, fill: night ? "#D8FF7A" : "#FFF3C4", opacity: 0 }) });

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      clouds.forEach(function (c, i) { // drift right, wrapping round the span (both ends are off view)
        var x0 = CLOUDS[i][0], x = PL.art.wrap(x0 + t * (8 + i * 1.5), CLOUD_SPAN[0], CLOUD_SPAN[1]);
        c.e.setAttribute("transform", "translate(" + r2(x - x0) + " 0) " + c.base);
      });
      birds.forEach(function (b, i) {
        var bx = 1450, dx = PL.art.wrap(bx + t * 38, BIRD_SPAN[0], BIRD_SPAN[1]) - bx;
        b.e.setAttribute("transform", "translate(" + r2(dx) + " " + r2(D.wobble(t, i + 3, 0.8) * 14) + ") " + b.base + " scale(1 " + r2(0.75 + 0.35 * Math.sin(t * 7 + i)) + ")");
      });
      stars.forEach(function (e, i) { if (i % 5 === 0) e.setAttribute("opacity", r2(starOp[i] * (0.65 + 0.35 * Math.sin(t * 2.2 + i)))); });
      blades.setAttribute("transform", "translate(" + G.windmill.x + " " + (G.windmill.y - 318) + ") rotate(" + r2(t * 28 + 12) + ")");
      fish.forEach(function (f) {
        var q = f.q, k = q[3], dx = Math.sin(t * 0.35 + k * 1.7) * 110, vx = Math.cos(t * 0.35 + k * 1.7);
        f.e.setAttribute("transform", "translate(" + r2(q[0] + dx) + " " + r2(q[1] + Math.sin(t * 1.1 + k) * 10) + ") scale(" + (vx >= 0 ? -1 : 1) + " 1)");
      });
      bubbles.at(t).forEach(function (p, i) {
        var e = bubEls[i], bx = 1900 + (i % 6) * 110;
        e.setAttribute("cx", r2(bx + p.x + Math.sin(p.age * 3 + i) * 6));
        e.setAttribute("cy", r2(bedY(bx) - 40 + p.y * 2.4));
        e.setAttribute("r", r2(p.r * 0.8));
        e.setAttribute("opacity", r2(p.alive ? 0.75 * (1 - p.u) : 0));
      });
      if (X.on) updateBands(t);
      motes.forEach(function (m) {
        var w = D.wobble(t, m.s, 0.5), w2 = D.wobble(t, m.s + 50, 0.4);
        var mx = PL.art.wrap(m.x + t * 6, MOTE_SPAN[0], MOTE_SPAN[1]), edge = PL.art.wrapFade(mx, MOTE_SPAN[0], MOTE_SPAN[1], 160);
        m.e.setAttribute("cx", r2(mx + w * 60));
        m.e.setAttribute("cy", r2(m.y + w2 * 40));
        m.e.setAttribute("r", r2(m.r));
        m.e.setAttribute("opacity", r2(edge * (night ? Math.max(0, 0.25 + 0.75 * Math.sin(t * 2 + m.s)) : 0.35 + 0.25 * w)));
      });
    }
    // the bands' moving parts (none when not extended)
    var q = function (sel) { var out = []; if (X.on) PL.LAYERS.forEach(function (n) { out = out.concat([].slice.call(X.over[n].querySelectorAll(sel))); }); return out; };
    var xclouds = q("[data-cloud^='x']").map(function (e) { var i = +e.getAttribute("data-cloud").slice(1); return { e: e, i: i, base: e.getAttribute("transform") }; });
    var xbirds = q("[data-xbird]").map(function (e) { return { e: e, i: +e.getAttribute("data-xbird"), base: e.getAttribute("transform") }; });
    var xstars = q("[data-xstar]").filter(function (e, i) { return i % 4 === 0; }).map(function (e) { return { e: e, op: +e.getAttribute("opacity"), k: +e.getAttribute("data-xstar") }; });
    var xballoon = q("[data-balloon]").map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    var shooting = q('[data-part="shooting"]')[0], blinks = q("[data-blink]");
    function updateBands(t) {
      xclouds.forEach(function (c) {
        var x0 = XCLOUDS[c.i][1], x = PL.art.wrap(x0 + t * (5 + c.i * 1.3), XCLOUD_SPAN[0], XCLOUD_SPAN[1]);
        c.e.setAttribute("transform", "translate(" + r2(x - x0) + " 0) " + c.base);
      });
      xbirds.forEach(function (b) {
        var bx = XBIRDS[b.i][1], dx = PL.art.wrap(bx + t * (b.i < 3 ? 60 : 34), BIRD_SPAN[0], BIRD_SPAN[1]) - bx;
        b.e.setAttribute("transform", "translate(" + r2(dx) + " " + r2(D.wobble(t, b.i + 11, 0.7) * 12) + ") " + b.base + " scale(1 " + r2(0.75 + 0.35 * Math.sin(t * 7.5 + b.i * 1.3)) + ")");
      });
      xstars.forEach(function (s) { s.e.setAttribute("opacity", r2(s.op * (0.6 + 0.4 * Math.sin(t * 2 + s.k)))); });
      xballoon.forEach(function (b) { b.e.setAttribute("transform", "translate(0 " + r2(D.wobble(t, 5, 0.3) * 16) + ") " + b.base); });
      if (shooting) { // a shooting star every 6 s, crossing in 0.7 s
        var u = (t % 6) / 0.7, on = u < 1;
        shooting.setAttribute("opacity", r2(on ? Math.sin(u * Math.PI) : 0));
        shooting.setAttribute("transform", "translate(" + r2(1200 + u * 520) + " " + r2(470 + u * 140) + ")");
      }
      blinks.forEach(function (e, i) { e.setAttribute("opacity", ((t * 1.25 + i * 0.5) % 1) < 0.35 ? 1 : 0.15); });
    }

    var a = anchorsFor(opts);
    update(0, X.ref);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places.countryside = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
