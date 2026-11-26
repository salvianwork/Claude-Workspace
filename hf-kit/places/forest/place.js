/* Place "forest": a deep, friendly woodland. Layers of tree silhouettes fade into a misty distance;
 * nearer trunks and a deer stand in soft light shafts; on the forest floor a dirt trail winds past a
 * mossy fallen log, crosses a stream on a little plank bridge and runs on toward a huge old oak with
 * big roots. Ferns, mushrooms, mossy rocks and wildflowers everywhere; butterflies by day, fireflies
 * and an owl at night. A big trunk, ferns and hanging leaves frame the foreground.
 *
 * Variants: day (default), night (moonlight, fireflies, the owl's eyes), moonless (a night with no
 * Moon: a darker wood under a sky full of stars and a faint Milky Way, lit only by starlight, with
 * the fireflies and the owl). Anchors (ground-layer
 * world px, 3840 x 2160 world):
 *   trail     on the trail, left: where an actor walks in and stops
 *   clearing  the sunlit open ground in the middle
 *   log       the top of the fallen log (sit, or put a prop)
 *   stream    in the stream below the bridge
 *   tree      the foot of the big oak
 *   canopy    up in the oak's branches (a bird, a nest, a tag)
 * Path: trail (along the trail, left to right, over the bridge).
 *
 * Extended (vertical videos, mount with extended: true; meta.extend): 720 px drawn above and below,
 * anchors and paths 720 lower (see drawTopBand / drawBottomBand and src/world/place.js).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("forest/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "forest",
    description: "Woodland: misty layers of trees, light shafts, a deer, a winding trail, a mossy log, a stream with a plank bridge, a huge oak.",
    variants: ["day", "night", "moonless"],
    anchors: ["trail", "clearing", "log", "stream", "tree", "canopy"],
    paths: ["trail"],
    actorScale: 1,
    actorLight: {
      day: { tint: "#EAF6D2", amount: 0.14, rim: "#FFF3C4", rimSide: 1 }, // dappled green, sun from the right
      night: { tint: "#3E5A8E", amount: 0.68, rim: "#C4D8FF", rimSide: 1 },
      moonless: { tint: "#2C4174", amount: 0.74, rim: "#A9BDF0", rimSide: 1 }, // starlight only: darker, a faint cool rim
    },
    // the extension for vertical videos (place.js: mount with extended: true, world 3840 x 3600)
    extend: {
      top: { draws: "the tree canopy above: the woods' crowns closing overhead with light shafts through the gaps, the big oak's trunk rising into its crown (a squirrel, a beehive, a woodpecker), a leafy bough across the front with vines, birds by day; bats and stars at night (many more stars when moonless)", seamAllow: [] },
      bottom: { draws: "the forest floor cut away: a lip of grass and leaf litter, the stream's channel in section, dark soil with the oak's roots, mycelium threads, a rabbit burrow with sleeping rabbits, a mole in its tunnel, an ant nest, worms, a squirrel's acorn cache, then stones and bedrock with groundwater", seamAllow: [] },
    },
  };

  var G = { back: 1330, oak: { x: 3000, base: 1520 }, log: { x0: 1060, x1: 1560, y: 1600 }, bridge: { x0: 2030, x1: 2420, y: 1620 } };
  /* The trail's centre line (ground px), left to right; walkers stay on it. */
  var TRAIL = [[-200, 1980], [300, 1830], [800, 1730], [1300, 1680], [1750, 1650], [2050, 1625], [2420, 1610], [2800, 1580], [3300, 1560], [4000, 1540]];
  function trailY(x) {
    for (var i = 1; i < TRAIL.length; i++) if (x <= TRAIL[i][0]) { var a = TRAIL[i - 1], b = TRAIL[i], u = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * u; }
    return TRAIL[TRAIL.length - 1][1];
  }
  /* The stream's centre x at height y (it runs from the back down to the bottom edge). */
  function streamX(y) { return 2180 + Math.sin((y - 1300) / 260) * 90 + (y - 1300) * 0.2; }

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    return PL.offsetAnchors(baseAnchors(opts), PL.extendOffset(meta, opts));
  }
  function baseAnchors(opts) {
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    var path = [];
    for (var x = 120; x <= 3720; x += 400) path.push({ x: x, y: r2(trailY(x)) });
    return {
      anchors: {
        trail: fixed(700, r2(trailY(700))), clearing: fixed(1820, 1560), log: fixed(1300, G.log.y - 86), stream: fixed(r2(streamX(1880)), 1880),
        tree: fixed(G.oak.x - 60, G.oak.base), canopy: fixed(3260, 560),
      },
      paths: { trail: path },
    };
  }

  var LOOK = {
    day: { sky: [[0, "#6FB6E6"], [0.55, "#BFE3EF"], [1, "#F4F1D2"]], tone: function (c) { return c; }, far: ["#9CC6B8", "#7DB09A", "#5F9A7E"], mist: "#E8F4EC" },
    night: { sky: [[0, "#050B1E"], [0.55, "#0F1E40"], [1, "#22355E"]], tone: A.toner(0.45, "#13284E", 0.45), far: ["#1E3350", "#1A2C46", "#16253C"], mist: "#3A5480" },
    moonless: { sky: [[0, "#02040C"], [0.55, "#070F24"], [1, "#121D3A"]], tone: A.toner(0.52, "#0E1C3C", 0.5), far: ["#16263E", "#132136", "#101B2E"], mist: "#283A5E" },
  };

  function pine(x, y, h, c) { var w = h * 0.34; return tag("path", { d: "M" + r2(x) + " " + r2(y - h) + " L" + r2(x + w * 0.55) + " " + r2(y - h * 0.62) + " L" + r2(x + w * 0.35) + " " + r2(y - h * 0.62) + " L" + r2(x + w * 0.8) + " " + r2(y - h * 0.3) + " L" + r2(x + w * 0.5) + " " + r2(y - h * 0.3) + " L" + r2(x + w) + " " + r2(y) + " L" + r2(x - w) + " " + r2(y) + " L" + r2(x - w * 0.5) + " " + r2(y - h * 0.3) + " L" + r2(x - w * 0.8) + " " + r2(y - h * 0.3) + " L" + r2(x - w * 0.35) + " " + r2(y - h * 0.62) + " L" + r2(x - w * 0.55) + " " + r2(y - h * 0.62) + " Z", fill: c }); }
  function fern(x, y, s, tone, flip) {
    var out = "", c1 = tone("#3F8A35"), c2 = tone("#5FA845");
    for (var f = 0; f < 5; f++) {
      var a = (-150 + f * 30) * Math.PI / 180, len = (120 + (f % 2) * 50) * s, ex = x + Math.cos(a) * len * (flip || 1), ey = y + Math.sin(a) * len;
      out += tag("path", { d: "M" + r2(x) + " " + r2(y) + " Q" + r2((x + ex) / 2) + " " + r2(Math.min(y, ey) - 40 * s) + " " + r2(ex) + " " + r2(ey), stroke: f % 2 ? c1 : c2, "stroke-width": 16 * s, fill: "none", "stroke-linecap": "round", "stroke-dasharray": r2(10 * s) + " " + r2(4 * s) });
    }
    return out;
  }
  function mushroom(x, y, s, tone) {
    return tag("path", { d: "M" + r2(x - 10 * s) + " " + y + " q-2 " + r2(-30 * s) + " 4 " + r2(-40 * s) + " h" + r2(12 * s) + " q6 " + r2(10 * s) + " 4 " + r2(40 * s) + " Z", fill: tone("#F4EAD8"), stroke: tone("#A8957A"), "stroke-width": 3 }) +
      tag("path", { d: "M" + r2(x - 36 * s) + " " + r2(y - 36 * s) + " Q" + r2(x) + " " + r2(y - 90 * s) + " " + r2(x + 36 * s) + " " + r2(y - 36 * s) + " Z", fill: tone("#E03131"), stroke: tone("#8A1C1C"), "stroke-width": 3 }) +
      tag("circle", { cx: r2(x - 14 * s), cy: r2(y - 52 * s), r: r2(6 * s), fill: "#FFF" }) + tag("circle", { cx: r2(x + 12 * s), cy: r2(y - 58 * s), r: r2(5 * s), fill: "#FFF" }) + tag("circle", { cx: r2(x + 2 * s), cy: r2(y - 44 * s), r: r2(4 * s), fill: "#FFF" });
  }
  function rock(x, y, w, h, tone, moss) {
    var s = tag("path", { d: "M" + (x - w) + " " + y + " Q" + (x - w) + " " + (y - h) + " " + x + " " + (y - h) + " Q" + (x + w * 1.1) + " " + (y - h * 0.9) + " " + (x + w) + " " + y + " Z", fill: tone("#8E8A80"), stroke: tone("#5C584F"), "stroke-width": 4 });
    s += tag("path", { d: "M" + (x - w * 0.5) + " " + (y - h * 0.7) + " q" + r2(w * 0.4) + " " + r2(-h * 0.25) + " " + r2(w * 0.8) + " 0", stroke: tone("#B4B0A6"), "stroke-width": 5, fill: "none", "stroke-linecap": "round" });
    if (moss) s += tag("path", { d: "M" + (x - w * 0.9) + " " + (y - h * 0.5) + " Q" + (x - w * 0.6) + " " + (y - h * 1.05) + " " + x + " " + (y - h * 1.02) + " Q" + (x + w * 0.5) + " " + (y - h) + " " + (x + w * 0.4) + " " + (y - h * 0.7) + " Q" + x + " " + (y - h * 0.8) + " " + (x - w * 0.9) + " " + (y - h * 0.5) + " Z", fill: tone("#6DAA45") });
    return s;
  }

  function drawSky(P, v, L, R) {
    var defs = S.lin(P + "-sky", L.sky) + S.rad(P + "-sun", [[0, "#FFF8DA", 1], [0.25, "#FFEBA8", 0.6], [1, "#FFEBA8", 0]]);
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: L.sky[L.sky.length - 1][1] }) + tag("rect", { x: -2600, y: -1600, width: 9040, height: 1900, fill: L.sky[0][1] });
    s += tag("rect", { x: -2600, y: 300, width: 9040, height: 1100, fill: "url(#" + P + "-sky)" });
    if (v === "moonless") { // no Moon: many more stars, a few bright ones, and the Milky Way
      defs += S.lin(P + "-mw", [[0, "#B8C4F0", 0], [0.45, "#C8D0F4", 0.16], [0.5, "#E6E2F6", 0.24], [0.55, "#C8D0F4", 0.16], [1, "#B8C4F0", 0]]);
      s += tag("g", { transform: "rotate(-24 1920 760)" }, tag("rect", { x: -400, y: 520, width: 4700, height: 480, fill: "url(#" + P + "-mw)" }) + A.stars(R, 160, -200, 600, 4300, 320, { scale: 0.7 }));
      s += A.stars(R, 320, 300, 200, 3240, 1000, { bright: 0.12 }) + A.stars(R, 70, 500, 220, 2800, 800, { bright: 0.6, scale: 1.5 });
    } else if (v === "night") s += A.stars(R, 120, 400, 300, 3000, 700) + tag("circle", { cx: 2500, cy: 560, r: 280, fill: "#8FA6E0", opacity: 0.18 }) + tag("circle", { cx: 2500, cy: 560, r: 80, fill: "#F6F2DC" }) + tag("circle", { cx: 2478, cy: 546, r: 16, fill: "#DCD6BC" });
    else s += tag("circle", { cx: 2500, cy: 640, r: 600, fill: "url(#" + P + "-sun)" }) + tag("circle", { cx: 2500, cy: 640, r: 96, fill: "#FFF8DA" });
    return { defs: defs, body: s };
  }
  function drawFar(P, v, L, R) {
    var defs = S.lin(P + "-mist", [[0, L.mist, 0], [0.6, L.mist, 0.55], [1, L.mist, 0.2]]);
    var s = "";
    L.far.forEach(function (c, k) {
      var base = 1060 + k * 70;
      s += tag("rect", { x: -1600, y: base - 10, width: 7040, height: 2000, fill: c });
      for (var i = 0; i < 46; i++) {
        var x = -1500 + i * 150 + R() * 70, h = (200 + R() * 220 + k * 40) * (v === "moonless" ? 0.6 : 1); // moonless: lower woods, more starry sky
        s += R() < 0.6 ? pine(x, base, h, c) : tag("ellipse", { cx: x, cy: base - h * 0.45, rx: h * 0.32, ry: h * 0.5, fill: c });
      }
      s += tag("rect", { x: -1600, y: base - 160, width: 7040, height: 220, fill: "url(#" + P + "-mist)" });
    });
    return { defs: defs, body: s };
  }
  function drawMid(P, v, L, R) {
    var night = v !== "day", tone = L.tone, rayOp = v === "moonless" ? 0.07 : night ? 0.22 : 0.42; // no Moon: only a trace of starlight
    var defs = S.lin(P + "-ray", [[0, night ? "#C4D8FF" : "#FFF6C8", rayOp], [1, night ? "#C4D8FF" : "#FFF6C8", 0]]);
    var s = tag("path", { d: smooth([[-1400, 1300], [-400, 1250], [600, 1290], [1600, 1240], [2600, 1280], [3600, 1250], [5200, 1280]], false) + " L5200 2600 L-1400 2600 Z", fill: tone("#5E9A4A") });
    // mid trunks with leafy crowns
    for (var i = 0; i < 16; i++) {
      var x = -800 + i * 360 + R() * 120, w = 44 + R() * 30, c = tone(i % 2 ? "#6E5640" : "#7E6448");
      if (x > 1650 && x < 2050) continue; // keep the clearing open
      s += tag("path", { d: "M" + r2(x - w / 2) + " 1300 L" + r2(x - w * 0.35) + " -200 L" + r2(x + w * 0.35) + " -200 L" + r2(x + w / 2) + " 1300 Z", fill: c });
      s += tag("path", { d: "M" + r2(x + w * 0.1) + " 1300 L" + r2(x + w * 0.1) + " -200 L" + r2(x + w * 0.35) + " -200 L" + r2(x + w / 2) + " 1300 Z", fill: D.shade(c, 0.2), opacity: 0.6 });
      s += tag("circle", { cx: r2(x), cy: 120 + R() * 160, r: 220 + R() * 100, fill: tone(i % 2 ? "#4C8A40" : "#5A9A48") });
      if (R() < 0.6) s += tag("path", { d: "M" + r2(x) + " " + r2(700 + R() * 300) + " q" + r2(80 + R() * 60) + " -60 " + r2(160 + R() * 60) + " -40", stroke: c, "stroke-width": 16, fill: "none", "stroke-linecap": "round" });
    }
    for (var b = 0; b < 22; b++) s += tag("ellipse", { cx: -600 + b * 260 + R() * 80, cy: 1290 + R() * 20, rx: 120 + R() * 60, ry: 70 + R() * 30, fill: tone(b % 2 ? "#3F7E36" : "#4E9040") });
    // a deer browsing among the trunks
    var dx = 1080, dy = 1290, dc = tone("#B07A4A"), dd = D.shade(dc, 0.35);
    s += tag("g", { "data-part": "deer", transform: "translate(" + dx + " " + dy + ")" },
      tag("path", { d: "M-70 -60 Q-80 -120 0 -124 L70 -120 Q110 -118 100 -70 L96 -60 Z", fill: dc, stroke: dd, "stroke-width": 4 }) +
      tag("path", { d: "M-60 -66 L-66 0 M-40 -66 L-36 0 M60 -66 L56 0 M84 -66 L90 0", stroke: dd, "stroke-width": 10, "stroke-linecap": "round" }) +
      tag("g", { "data-head": 1 }, tag("path", { d: "M80 -110 L120 -170 L150 -160 L120 -100 Z", fill: dc, stroke: dd, "stroke-width": 4 }) + tag("ellipse", { cx: 150, cy: -170, rx: 26, ry: 16, fill: dc, stroke: dd, "stroke-width": 4 }) +
        tag("path", { d: "M130 -184 l-6 -40 l-14 -12 M124 -214 l16 -14 M146 -186 l10 -40 l14 -10", stroke: tone("#5A3E26"), "stroke-width": 6, fill: "none", "stroke-linecap": "round" }) + tag("circle", { cx: 156, cy: -174, r: 4, fill: "#111" })) +
      tag("path", { d: "M-60 -110 q-10 20 -20 6", stroke: "#FFFFFF", "stroke-width": 6, fill: "none" }) + tag("circle", { cx: -10, cy: -104, r: 6, fill: "#F4E2C8" }) + tag("circle", { cx: 30, cy: -96, r: 5, fill: "#F4E2C8" }));
    // light shafts slanting down through the canopy
    [[1500, 260], [1900, 380], [2500, 300], [3100, 200]].forEach(function (q, i) { s += tag("path", { d: "M" + q[0] + " -300 L" + (q[0] + q[1]) + " -300 L" + (q[0] + q[1] - 600) + " 1400 L" + (q[0] - 760) + " 1400 Z", fill: "url(#" + P + "-ray)", "data-ray": i }); });
    return { defs: defs, body: s };
  }

  function drawGround(P, v, L, R) {
    var night = v !== "day", tone = L.tone, spotOp = v === "moonless" ? 0.1 : night ? 0.25 : 0.5;
    var defs = S.lin(P + "-floor", [[0, tone("#6FA84E")], [0.4, tone("#5E9A42")], [1, tone("#4A8236")]]) + S.lin(P + "-path", [[0, tone("#D8B98A")], [1, tone("#BE9A68")]]) +
      S.lin(P + "-water", [[0, tone("#7FD3F0")], [1, tone("#3E9AC6")]]) + S.lin(P + "-bark", [[0, tone("#7A5A3C")], [0.5, tone("#8C6A48")], [1, tone("#5E4430")]], [0, 0, 1, 0]) +
      S.rad(P + "-sunspot", [[0, night ? "#C4D8FF" : "#FFF3B0", spotOp], [1, night ? "#C4D8FF" : "#FFF3B0", 0]]);
    var s = "", O = G.oak;
    s += tag("path", { d: smooth([[-400, G.back + 20], [400, G.back - 10], [1200, G.back + 14], [2000, G.back - 6], [2800, G.back + 10], [3600, G.back - 12], [4240, G.back]], false) + " L4240 2500 L-400 2500 Z", fill: "url(#" + P + "-floor)" });
    s += tag("ellipse", { cx: 1820, cy: 1560, rx: 520, ry: 120, fill: "url(#" + P + "-sunspot)" });
    // grass texture
    for (var gt = 0; gt < 160; gt++) { var gx = -300 + R() * 4400, gy = G.back + 40 + R() * 820; s += tag("path", { d: "M" + r2(gx) + " " + r2(gy) + " l-5 -16 M" + r2(gx) + " " + r2(gy) + " l2 -20 M" + r2(gx) + " " + r2(gy) + " l7 -14", stroke: tone(gt % 2 ? "#3E7F32" : "#7CBF55"), "stroke-width": 4, "stroke-linecap": "round" }); }
    // the stream, from the back down to the bottom edge
    var left = [], right = [];
    for (var y = G.back; y <= 2300; y += 60) { var w = 60 + (y - G.back) * 0.22; left.push([streamX(y) - w, y]); right.unshift([streamX(y) + w, y]); }
    s += tag("path", { d: smooth(left, false) + " L" + right.map(function (q) { return r2(q[0]) + " " + r2(q[1]); }).join(" L") + " Z", fill: tone("#6E5A44") });
    left = left.map(function (q) { return [q[0] + 14, q[1]]; }); right = right.map(function (q) { return [q[0] - 14, q[1]]; });
    s += tag("path", { d: smooth(left, false) + " L" + right.map(function (q) { return r2(q[0]) + " " + r2(q[1]); }).join(" L") + " Z", fill: "url(#" + P + "-water)" });
    s += tag("g", { "data-part": "ripples" }, "");
    [[streamX(1760) - 120, 1770, 40], [streamX(1950) + 130, 1960, 50], [streamX(2100) - 160, 2110, 56]].forEach(function (q) { s += rock(q[0], q[1], q[2], q[2] * 0.6, tone, true); });
    // the trail
    var top = TRAIL.map(function (q) { return [q[0], q[1] - 34 - (q[1] - 1540) * 0.12]; }), bot = TRAIL.map(function (q) { return [q[0], q[1] + 40 + (q[1] - 1540) * 0.2]; }).reverse();
    s += tag("path", { d: smooth(top, false) + " L" + bot.map(function (q) { return r2(q[0]) + " " + r2(q[1]); }).join(" L") + " Z", fill: "url(#" + P + "-path)" });
    for (var pb = 0; pb < 40; pb++) { var px = -100 + R() * 4000; s += tag("ellipse", { cx: r2(px), cy: r2(trailY(px) + (R() - 0.5) * 40), rx: 6 + R() * 8, ry: 4 + R() * 4, fill: tone("#A88A60"), opacity: 0.8 }); }
    // the plank bridge over the stream
    var Bg = G.bridge, bt = trailY((Bg.x0 + Bg.x1) / 2);
    s += tag("path", { d: "M" + Bg.x0 + " " + (bt + 40) + " L" + Bg.x1 + " " + (bt + 30) + " L" + Bg.x1 + " " + (bt + 60) + " L" + Bg.x0 + " " + (bt + 70) + " Z", fill: tone("#5E4430") });
    for (var pk = Bg.x0; pk < Bg.x1; pk += 36) s += tag("rect", { x: pk, y: bt - 30, width: 32, height: 74, rx: 4, fill: tone(pk % 72 ? "#A0703F" : "#8C5E3C"), stroke: tone("#5E4430"), "stroke-width": 3 });
    s += tag("path", { d: "M" + (Bg.x0 + 10) + " " + (bt - 26) + " V" + (bt - 150) + " M" + (Bg.x1 - 10) + " " + (bt - 34) + " V" + (bt - 158) + " M" + (Bg.x0 + 10) + " " + (bt - 140) + " L" + (Bg.x1 - 10) + " " + (bt - 148), stroke: tone("#7A5230"), "stroke-width": 14, "stroke-linecap": "round" });
    // the fallen mossy log
    var Lg = G.log;
    s += tag("ellipse", { cx: (Lg.x0 + Lg.x1) / 2, cy: Lg.y + 6, rx: 300, ry: 22, fill: "#1D3A1A", opacity: 0.25 });
    s += tag("rect", { x: Lg.x0, y: Lg.y - 90, width: Lg.x1 - Lg.x0, height: 90, rx: 45, fill: tone("#8C6A48"), stroke: tone("#5E4430"), "stroke-width": 5 });
    s += tag("ellipse", { cx: Lg.x1 - 4, cy: Lg.y - 45, rx: 30, ry: 45, fill: tone("#D9B98A"), stroke: tone("#5E4430"), "stroke-width": 5 }) + tag("ellipse", { cx: Lg.x1 - 4, cy: Lg.y - 45, rx: 16, ry: 26, fill: "none", stroke: tone("#A88A60"), "stroke-width": 4 });
    s += tag("path", { d: "M" + (Lg.x0 + 20) + " " + (Lg.y - 80) + " Q" + (Lg.x0 + 160) + " " + (Lg.y - 120) + " " + (Lg.x0 + 300) + " " + (Lg.y - 84) + " Q" + (Lg.x0 + 200) + " " + (Lg.y - 70) + " " + (Lg.x0 + 20) + " " + (Lg.y - 60) + " Z", fill: tone("#6DAA45") });
    for (var lr = 0; lr < 6; lr++) s += tag("path", { d: "M" + (Lg.x0 + 60 + lr * 70) + " " + (Lg.y - 30) + " h40", stroke: tone("#6E5236"), "stroke-width": 4, "stroke-linecap": "round" });
    s += mushroom(Lg.x0 + 60, Lg.y + 4, 0.8, tone) + mushroom(Lg.x0 + 110, Lg.y + 8, 0.6, tone);
    // the big oak: roots, trunk, branches, a hole, crown (canopy anchor in the branches)
    s += tag("ellipse", { cx: O.x + 40, cy: O.base + 10, rx: 420, ry: 40, fill: "#1D3A1A", opacity: 0.3 });
    s += tag("path", { d: "M" + (O.x - 360) + " " + (O.base + 20) + " Q" + (O.x - 220) + " " + (O.base - 30) + " " + (O.x - 150) + " " + (O.base - 160) + " L" + (O.x - 130) + " -300 L" + (O.x + 150) + " -300 L" + (O.x + 170) + " " + (O.base - 170) + " Q" + (O.x + 240) + " " + (O.base - 30) + " " + (O.x + 400) + " " + (O.base + 24) + " Z", fill: "url(#" + P + "-bark)", stroke: tone("#4A3424"), "stroke-width": 6 });
    for (var bl = 0; bl < 9; bl++) s += tag("path", { d: "M" + (O.x - 100 + bl * 26) + " " + (O.base - 120) + " q" + ((bl % 2) * 20 - 10) + " -400 " + (bl % 3 * 10 - 10) + " -800", stroke: tone("#4A3424"), "stroke-width": 5, fill: "none", opacity: 0.45 });
    s += tag("ellipse", { cx: O.x + 30, cy: O.base - 520, rx: 44, ry: 66, fill: tone("#2E2018"), stroke: tone("#4A3424"), "stroke-width": 6 });
    s += tag("path", { d: "M" + (O.x + 120) + " 760 Q" + (O.x + 300) + " 640 " + (O.x + 520) + " 600 M" + (O.x - 100) + " 700 Q" + (O.x - 300) + " 560 " + (O.x - 520) + " 540 M" + (O.x + 140) + " 460 Q" + (O.x + 240) + " 420 " + (O.x + 400) + " 300", stroke: tone("#6E5236"), "stroke-width": 40, fill: "none", "stroke-linecap": "round" });
    [[O.x - 520, 380, 260], [O.x - 240, 200, 300], [O.x + 60, 120, 320], [O.x + 420, 220, 280], [O.x + 640, 420, 220], [O.x - 640, 560, 160]].forEach(function (c, i) {
      s += tag("circle", { cx: c[0], cy: c[1], r: c[2], fill: tone(i % 2 ? "#3E8E41" : "#4FA54A"), stroke: tone("#2B6A2E"), "stroke-width": 5 });
      s += tag("circle", { cx: c[0] + c[2] * 0.3, cy: c[1] - c[2] * 0.3, r: c[2] * 0.45, fill: tone("#79BC57"), opacity: 0.6 });
    });
    s += tag("g", { "data-part": "owl" }, "");
    // a bird's nest on the branch at the canopy anchor
    s += tag("path", { d: "M3210 590 q50 40 100 0 Z", fill: tone("#8C6A48"), stroke: tone("#5E4430"), "stroke-width": 4 }) + tag("path", { d: "M3205 588 q55 -14 110 0", stroke: tone("#A88A60"), "stroke-width": 6, fill: "none" });
    // ferns, mushrooms, rocks and flowers about the floor, clear of the anchors
    [[200, 1560, 1], [520, 1500, 0.8], [1700, 1440, 0.7], [2620, 1470, 0.9], [3500, 1480, 1], [3800, 1500, 0.8], [900, 1960, 1.2], [3300, 1920, 1.3], [1650, 2060, 1.1]].forEach(function (q, i) { s += fern(q[0], q[1], q[2], tone, i % 2 ? -1 : 1); });
    [[2660, 1520, 0.9], [2720, 1530, 0.7], [3500, 1600, 1], [420, 1640, 0.8]].forEach(function (q) { s += mushroom(q[0], q[1], q[2], tone); });
    [[600, 1520, 70, 44], [3700, 1640, 90, 58], [1300, 2080, 120, 70], [2900, 2050, 100, 60]].forEach(function (q) { s += rock(q[0], q[1], q[2], q[3], tone, true); });
    for (var fl = 0; fl < 36; fl++) {
      var fx = -200 + R() * 4200, fy = G.back + 60 + R() * 760;
      if (Math.abs(fx - streamX(fy)) < 160 + (fy - G.back) * 0.25 || Math.abs(fy - trailY(fx)) < 90) continue;
      s += tag("path", { d: "M" + r2(fx) + " " + r2(fy) + " v-30", stroke: tone("#2F6E2A"), "stroke-width": 4 }) + tag("circle", { cx: r2(fx), cy: r2(fy - 34), r: 9, fill: tone(["#FFFFFF", "#FFD43B", "#F783AC", "#B197FC"][fl % 4]) });
    }
    return { defs: defs, body: s };
  }

  function drawFront(P, v, L, R) {
    var tone = L.tone, s = "";
    // a big trunk at the left edge, ferns in the bottom corners, leaves hanging from the top
    s += tag("path", { d: "M-300 -400 L120 -400 Q150 900 140 1900 Q170 2100 320 2260 L-300 2260 Z", fill: tone("#5E4430"), stroke: tone("#3A2A1E"), "stroke-width": 8 });
    s += tag("path", { d: "M40 -300 Q70 700 60 1900", stroke: tone("#7A5A3C"), "stroke-width": 20, fill: "none", opacity: 0.7 });
    for (var k = 0; k < 6; k++) s += tag("path", { d: "M" + (-40 + k * 26) + " " + (200 + k * 260) + " q30 120 0 260", stroke: tone("#3A2A1E"), "stroke-width": 6, fill: "none", opacity: 0.5 });
    s += tag("path", { d: "M80 900 q40 -30 70 -10 q-20 40 -70 10 Z M60 1400 q50 -20 80 10 q-30 30 -80 -10 Z", fill: tone("#6DAA45") });
    s += fern(260, 2200, 2.4, tone, 1) + fern(3700, 2220, 2.6, tone, -1) + fern(3950, 2160, 2, tone, -1);
    var vine = "";
    for (var h = 0; h < 7; h++) {
      var hx = 500 + h * 520 + R() * 120, len = 160 + R() * 220;
      if (hx > 1500 && hx < 2400) continue;
      vine += tag("path", { d: "M" + r2(hx) + " -200 Q" + r2(hx + 30) + " " + r2(len * 0.5) + " " + r2(hx) + " " + r2(len), stroke: tone("#2F6E2A"), "stroke-width": 6, fill: "none" });
      for (var lv = 0; lv < 6; lv++) vine += tag("ellipse", { cx: r2(hx + (lv % 2 ? 22 : -22)), cy: r2(len * lv / 6 + 20), rx: 26, ry: 14, fill: tone(lv % 2 ? "#4FA54A" : "#3E8E41"), transform: "rotate(" + (lv % 2 ? 30 : -30) + " " + r2(hx + (lv % 2 ? 22 : -22)) + " " + r2(len * lv / 6 + 20) + ")" });
    }
    s += vine;
    s += tag("g", { "data-part": "flyers" }, "");
    return { defs: "", body: s };
  }

  // ---- the extension for vertical videos (tall-world px: the original is 720 lower) -----------
  /* The top band: the canopy closing overhead. Mid layer: a roof of crowns over the woods (it hides
   * the tops of the mid trunks) with gaps the light shafts come through. Ground layer: the oak's
   * trunk rising into its crown, with a squirrel, a beehive and a woodpecker. Front layer: the big
   * trunk at the left runs on up and a leafy bough crosses the top, the vines hanging from it. Far
   * layer: birds (day) or bats (night). Sky layer: stars (night; many more when moonless). */
  function drawTopBand(P, v, L, R) {
    var tone = L.tone, night = v !== "day", out = { sky: "", far: "", mid: "", ground: "", front: "", defs: "" };
    // mid: the canopy roof
    var m = tag("rect", { x: -1600, y: -400, width: 7200, height: 700, fill: tone("#3B7434") });
    var cols = ["#3F7E36", "#4C8A40", "#5A9A48", "#36702F"];
    for (var i = 0; i < 70; i++) { var cx = -1500 + i * 100 + R() * 60, cy = 220 + R() * 160, r = 120 + R() * 110; m += tag("circle", { cx: r2(cx), cy: r2(cy), r: r2(r), fill: tone(cols[i % 4]) }); }
    for (var j = 0; j < 46; j++) { var lx = -1500 + j * 150 + R() * 80, ly = 470 + R() * 60, lr = 90 + R() * 60; m += tag("circle", { cx: r2(lx), cy: r2(ly), r: r2(lr), fill: tone(cols[(j + 1) % 4]) }) + tag("circle", { cx: r2(lx + lr * 0.3), cy: r2(ly - lr * 0.35), r: r2(lr * 0.4), fill: tone("#79BC57"), opacity: night ? 0.3 : 0.55 }); }
    // gaps of sky in the canopy (the shafts start under them)
    [[1500, 120, 90], [1900, 70, 120], [2500, 150, 80], [3100, 60, 100], [700, 160, 70]].forEach(function (g) { m += tag("ellipse", { cx: g[0], cy: g[1], rx: g[2], ry: g[2] * 0.6, fill: L.sky[0][1] }); });
    var rayOp = v === "moonless" ? 0.07 : night ? 0.22 : 0.42;
    out.defs += S.lin(P + "-xray", [[0, night ? "#C4D8FF" : "#FFF6C8", 0], [0.5, night ? "#C4D8FF" : "#FFF6C8", rayOp], [1, night ? "#C4D8FF" : "#FFF6C8", rayOp]]);
    [[1500, 260], [1900, 380], [2500, 300], [3100, 200]].forEach(function (q) { m += tag("path", { d: "M" + (q[0] + 120) + " 100 L" + (q[0] + q[1] - 60) + " 100 L" + (q[0] + q[1] - 160) + " 430 L" + (q[0] - 90) + " 430 Z", fill: "url(#" + P + "-xray)" }); });
    out.mid = m;
    // ground: the oak rising into its crown
    var O = G.oak, ox = O.x, g = "";
    out.defs += '<linearGradient id="' + P + '-xbark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + tone("#7A5A3C") + '"/><stop offset="0.5" stop-color="' + tone("#8C6A48") + '"/><stop offset="1" stop-color="' + tone("#5E4430") + '"/></linearGradient>';
    g += tag("path", { d: "M" + (ox - 130) + " 440 L" + (ox - 118) + " 160 L" + (ox + 130) + " 160 L" + (ox + 150) + " 440 Z", fill: "url(#" + P + "-xbark)", stroke: tone("#4A3424"), "stroke-width": 6 });
    for (var bl = 0; bl < 7; bl++) g += tag("path", { d: "M" + (ox - 90 + bl * 30) + " 430 q" + ((bl % 2) * 16 - 8) + " -130 " + (bl % 3 * 8 - 8) + " -260", stroke: tone("#4A3424"), "stroke-width": 5, fill: "none", opacity: 0.45 });
    g += tag("path", { d: "M" + (ox - 60) + " 300 Q" + (ox - 300) + " 200 " + (ox - 560) + " 210 M" + (ox + 80) + " 260 Q" + (ox + 320) + " 160 " + (ox + 600) + " 190", stroke: tone("#6E5236"), "stroke-width": 44, fill: "none", "stroke-linecap": "round" });
    [[ox - 620, 150, 220], [ox - 300, 80, 260], [ox + 40, 40, 300], [ox + 380, 90, 260], [ox + 680, 170, 200], [ox - 820, 280, 150], [ox + 860, 300, 140]].forEach(function (c, k) {
      g += tag("circle", { cx: c[0], cy: c[1], r: c[2], fill: tone(k % 2 ? "#3E8E41" : "#4FA54A"), stroke: tone("#2B6A2E"), "stroke-width": 5 }) + tag("circle", { cx: c[0] + c[2] * 0.3, cy: c[1] - c[2] * 0.3, r: c[2] * 0.45, fill: tone("#79BC57"), opacity: 0.6 });
    });
    // a woodpecker on the trunk, a beehive under the left branch, a squirrel on the right one
    var wy = 360;
    g += tag("path", { d: "M" + (ox - 118) + " " + wy + " q-30 -6 -36 24 q10 30 30 34 Z", fill: tone("#2E2A24") }) + tag("path", { d: "M" + (ox - 150) + " " + (wy + 10) + " q-6 -22 12 -30 l10 10 Z", fill: tone("#E03131") }) + tag("path", { d: "M" + (ox - 156) + " " + (wy + 4) + " l-24 4 l24 4 Z", fill: tone("#5C4A38") }) + tag("circle", { cx: ox - 146, cy: wy + 2, r: 3, fill: "#FFF" });
    var hx = ox - 420, hy = 240;
    g += tag("path", { d: "M" + hx + " " + hy + " v20", stroke: tone("#5E4430"), "stroke-width": 6 }) + tag("path", { d: "M" + (hx - 46) + " " + (hy + 40) + " q46 -40 92 0 q20 50 -10 96 q-36 30 -72 0 q-30 -46 -10 -96 Z", fill: tone("#E8B23A"), stroke: tone("#9A6A10"), "stroke-width": 5 }) +
      tag("path", { d: "M" + (hx - 44) + " " + (hy + 64) + " h88 M" + (hx - 46) + " " + (hy + 92) + " h92 M" + (hx - 38) + " " + (hy + 118) + " h76", stroke: tone("#B9841A"), "stroke-width": 5 }) + tag("ellipse", { cx: hx, cy: hy + 110, rx: 12, ry: 8, fill: tone("#3A2A1E") });
    if (!night) for (var b = 0; b < 3; b++) g += tag("g", { "data-bee": b, transform: "translate(" + (hx + 60 + b * 40) + " " + (hy + 90 + b * 20) + ")" }, tag("ellipse", { rx: 9, ry: 6, fill: "#FFD43B", stroke: "#2E2A24", "stroke-width": 2 }) + tag("ellipse", { cx: 0, cy: -8, rx: 6, ry: 4, fill: "#FFFFFF", opacity: 0.8 }));
    var sx = ox + 430, sy = 176;
    g += tag("g", { transform: "translate(" + sx + " " + sy + ")" }, tag("path", { d: "M-30 0 q-50 -20 -40 -80 q30 10 30 50 Z", fill: tone("#C8692E"), stroke: tone("#7A3A14"), "stroke-width": 3 }) + tag("ellipse", { cx: 0, cy: -16, rx: 30, ry: 20, fill: tone("#D9772E"), stroke: tone("#7A3A14"), "stroke-width": 3 }) +
      tag("circle", { cx: 26, cy: -30, r: 14, fill: tone("#D9772E"), stroke: tone("#7A3A14"), "stroke-width": 3 }) + tag("circle", { cx: 32, cy: -33, r: 3, fill: "#111" }) + tag("path", { d: "M20 -42 l4 -10 l6 8", fill: tone("#D9772E"), stroke: tone("#7A3A14"), "stroke-width": 2 }) + tag("circle", { cx: 38, cy: -18, r: 7, fill: tone("#8C5E3C") }));
    out.ground = g;
    // front: the big trunk at the left runs on up, a bough crosses the top, vines hang from it
    var f = tag("path", { d: "M-300 -260 L110 -260 L120 340 L-300 340 Z", fill: tone("#5E4430") }) + tag("path", { d: "M110 -260 L120 340", stroke: tone("#3A2A1E"), "stroke-width": 8 }) + tag("path", { d: "M40 -260 V340", stroke: tone("#7A5A3C"), "stroke-width": 20, opacity: 0.7 });
    f += tag("path", { d: "M60 560 C700 420 1500 470 2200 440 S3500 380 4300 470", stroke: tone("#5E4430"), "stroke-width": 64, fill: "none", "stroke-linecap": "round" }) + tag("path", { d: "M60 546 C700 406 1500 456 2200 426 S3500 366 4300 456", stroke: tone("#7A5A3C"), "stroke-width": 14, fill: "none", opacity: 0.6 });
    f += tag("path", { d: "M-300 600 Q-80 520 110 560", stroke: tone("#5E4430"), "stroke-width": 70, fill: "none" });
    var leaves = [[300, 470], [800, 430], [1300, 450], [2600, 420], [3000, 390], [3500, 400], [3900, 440]];
    leaves.forEach(function (q, k) {
      for (var n = 0; n < 7; n++) { var a = n / 7 * Math.PI * 2, lx2 = q[0] + Math.cos(a) * 70, ly2 = q[1] + Math.sin(a) * 40 - 30; f += tag("ellipse", { cx: r2(lx2), cy: r2(ly2), rx: 50, ry: 24, fill: tone(n % 2 ? "#4FA54A" : "#3E8E41"), stroke: tone("#2B6A2E"), "stroke-width": 3, transform: "rotate(" + r2(a * 57.3) + " " + r2(lx2) + " " + r2(ly2) + ")" }); }
    });
    for (var h = 0; h < 6; h++) {
      var vx = 650 + h * 560 + R() * 80, len = 120 + R() * 160, vy = 470;
      if (vx > 1550 && vx < 2350) continue;
      f += tag("path", { d: "M" + r2(vx) + " " + vy + " Q" + r2(vx + 24) + " " + r2(vy + len * 0.5) + " " + r2(vx) + " " + r2(vy + len), stroke: tone("#2F6E2A"), "stroke-width": 6, fill: "none" });
      for (var lv = 0; lv < 4; lv++) f += tag("ellipse", { cx: r2(vx + (lv % 2 ? 20 : -20)), cy: r2(vy + len * (lv + 1) / 5), rx: 24, ry: 13, fill: tone(lv % 2 ? "#4FA54A" : "#3E8E41") });
    }
    out.front = f;
    // far: birds (day) or bats (night)
    var fl = "";
    for (var k2 = 0; k2 < 9; k2++) {
      var bx = 900 + k2 * 260 + R() * 120, by = 560 + R() * 240, s = 0.6 + R() * 0.5;
      fl += night ? tag("path", { d: "M" + r2(bx) + " " + r2(by) + " q-20 -18 -44 -6 q10 6 6 16 q14 -10 38 -10 q24 0 38 10 q-4 -10 6 -16 q-24 -12 -44 6 Z", fill: "#0A1024", transform: "scale(1)", "data-xflap": k2, opacity: 0.85 })
        : tag("path", { d: "M" + r2(bx) + " " + r2(by) + " q" + r2(14 * s) + " " + r2(-14 * s) + " " + r2(28 * s) + " 0 q" + r2(14 * s) + " " + r2(-14 * s) + " " + r2(28 * s) + " 0", stroke: tone("#2F3A44"), "stroke-width": 5, fill: "none", "stroke-linecap": "round", "data-xflap": k2 });
    }
    out.far = tag("g", { "data-part": "xflock" }, fl);
    // sky: stars at night
    if (night) {
      var st = "", n2 = v === "moonless" ? 300 : 130;
      for (var q2 = 0; q2 < n2; q2++) { var sy2 = 20 + R() * 1000; if (Math.abs(sy2 - 720) < 8) sy2 += 16; st += tag("circle", { cx: r2(200 + R() * 3440), cy: r2(sy2), r: r2(1.2 + R() * (v === "moonless" ? 3 : 2.4)), fill: ["#FFF8E1", "#FFFFFF", "#DCE8FF"][q2 % 3], opacity: r2(0.35 + R() * 0.6), "data-xstar": q2 }); }
      out.sky = tag("g", { "data-part": "xstars" }, st);
    }
    return out;
  }

  /* The bottom band (ground layer): the forest floor cut away below a lip of grass and leaf litter:
   * the stream's channel in section, dark soil with the oak's roots and mycelium threads, a rabbit
   * burrow with two rabbits asleep, a mole in its tunnel, an ant nest, worms, an acorn cache, then
   * stones, groundwater and bedrock. Front layer: the big trunk's roots. */
  function drawBottomBand(P, v, L, R) {
    // the ground in section is toned more gently than the scene at night, so it stays readable
    var tone = v === "day" ? L.tone : v === "night" ? A.toner(0.22, "#13284E", 0.3) : A.toner(0.28, "#0E1C3C", 0.34), s = "", lipY = function (x) { return 2985 + Math.sin(x / 210) * 10 + Math.sin(x / 77) * 4; };
    var defs = S.lin(P + "-xsoil", [[0, tone("#5A3F2C")], [0.6, tone("#4A3424")], [1, tone("#3E2C20")]]) + S.lin(P + "-xrock", [[0, tone("#7E7A70")], [1, tone("#55524A")]]) +
      S.lin(P + "-xgw", [[0, tone("#5FA8D3"), 0], [1, tone("#3F86C0"), 0.55]]);
    var lip = [];
    for (var x = -300; x <= 4140; x += 60) lip.push([x, lipY(x)]);
    var under = tag("rect", { x: -300, y: 3200, width: 4440, height: 600, fill: tone("#3E2C20") });
    s += tag("path", { d: smooth(lip, false) + " L4140 3600 L-300 3600 Z", fill: "url(#" + P + "-xsoil)" });
    // the stream's channel in section (it reaches the cut at x ~ 2050..2600)
    s += tag("path", { d: "M2040 " + r2(lipY(2040) - 2) + " Q2080 3120 2320 3130 Q2560 3120 2600 " + r2(lipY(2600) - 2) + " Z", fill: tone("#6E5A44") });
    s += tag("path", { d: "M2058 " + r2(lipY(2058) + 4) + " Q2100 3100 2320 3108 Q2540 3100 2582 " + r2(lipY(2582) + 4) + " Z", fill: tone("#3E9AC6") }) + tag("path", { d: "M2070 " + r2(lipY(2070) + 10) + " H2570", stroke: tone("#BFEAFF"), "stroke-width": 4, opacity: 0.6, "stroke-dasharray": "40 30" });
    for (var pb = 0; pb < 14; pb++) { var px = 2120 + R() * 400; s += tag("ellipse", { cx: r2(px), cy: r2(3100 - Math.abs(px - 2320) * 0.25 + R() * 10), rx: 12 + R() * 10, ry: 7 + R() * 5, fill: tone(["#A6927A", "#8E8A80", "#C7B79A"][pb % 3]) }); }
    s += tag("g", { transform: "translate(2380 3070)" }, tag("ellipse", { rx: 30, ry: 12, fill: tone("#FF8787"), stroke: tone("#A83232"), "stroke-width": 3 }) + tag("path", { d: "M26 0 l18 -12 v24 Z", fill: tone("#FF8787") }) + tag("circle", { cx: -14, cy: -3, r: 3, fill: "#111" })); // a little fish
    // the grass lip and the leaf litter on it
    s += tag("path", { d: smooth(lip.map(function (q) { return [q[0], q[1] - 6]; }), false), stroke: tone("#4A8236"), "stroke-width": 16, fill: "none" });
    for (var lf = 0; lf < 110; lf++) {
      var lx = -280 + R() * 4400; if (lx > 2030 && lx < 2610) continue;
      var ly = lipY(lx) - 12 - R() * 50, a = R() * 180;
      s += tag("ellipse", { cx: r2(lx), cy: r2(ly), rx: 18 + R() * 10, ry: 8 + R() * 4, fill: tone(["#D9822B", "#C8692E", "#E8B23A", "#A0522D", "#8C6A48"][lf % 5]), transform: "rotate(" + r2(a) + " " + r2(lx) + " " + r2(ly) + ")" });
    }
    for (var gr = 0; gr < 60; gr++) { var gx = -280 + R() * 4400; if (gx > 2030 && gx < 2610) continue; var gy = lipY(gx) - 4; s += tag("path", { d: "M" + r2(gx) + " " + r2(gy) + " l-6 -24 M" + r2(gx) + " " + r2(gy) + " l3 -28 M" + r2(gx) + " " + r2(gy) + " l9 -20", stroke: tone(gr % 2 ? "#3E7F32" : "#6FA84E"), "stroke-width": 5, "stroke-linecap": "round" }); }
    // a lighter topsoil streak, mycelium threads under the mushrooms
    s += tag("path", { d: smooth([[-300, 3060], [700, 3050], [1500, 3070], [2900, 3050], [4140, 3066]], false), stroke: tone("#6E5236"), "stroke-width": 24, fill: "none", opacity: 0.5 });
    var my = "";
    for (var mi = 0; mi < 12; mi++) { var mx = [400, 1100, 3300, 3550][mi % 4] + R() * 160 - 80; my += "M" + r2(mx) + " 3010 q" + r2((R() - 0.5) * 120) + " " + r2(40 + R() * 40) + " " + r2((R() - 0.5) * 200) + " " + r2(90 + R() * 70) + " "; }
    s += tag("path", { d: my, stroke: tone("#EDE3D0"), "stroke-width": 2.5, fill: "none", opacity: 0.6 });
    // the oak's roots spreading down (oak at x 3000)
    var roots = [[3000, 3000, 2700, 3260, 2520, 3420, 26], [3000, 3000, 3150, 3300, 3420, 3470, 24], [3000, 3000, 2960, 3350, 3020, 3560, 30], [3000, 3000, 3500, 3120, 3800, 3200, 16], [3000, 3000, 2500, 3080, 2300, 3200, 14]];
    roots.forEach(function (r) { s += tag("path", { d: "M" + r[0] + " " + r[1] + " Q" + r[2] + " " + r[3] + " " + r[4] + " " + r[5], stroke: tone("#7A5A3C"), "stroke-width": r[6], fill: "none", "stroke-linecap": "round" }) + tag("path", { d: "M" + r[0] + " " + r[1] + " Q" + r[2] + " " + r[3] + " " + r[4] + " " + r[5], stroke: tone("#9C7350"), "stroke-width": r[6] * 0.3, fill: "none", opacity: 0.6 }); });
    s += tag("path", { d: "M2620 3340 q-60 30 -80 90 M3300 3380 q40 50 30 110 M2990 3480 q-40 40 -30 90", stroke: tone("#7A5A3C"), "stroke-width": 8, fill: "none", "stroke-linecap": "round" });
    // the rabbit burrow: an opening at the lip, a sloping tunnel, a round chamber with two rabbits
    var bx0 = 900, chx = 1250, chy = 3260;
    s += tag("path", { d: "M" + (bx0 - 40) + " " + r2(lipY(bx0 - 40)) + " Q" + (bx0 + 60) + " 3120 " + (chx - 120) + " " + chy + " L" + (chx - 80) + " " + (chy + 60) + " Q" + (bx0 + 40) + " 3200 " + (bx0 + 50) + " " + r2(lipY(bx0 + 50)) + " Z", fill: tone("#2E2018") });
    s += tag("ellipse", { cx: chx, cy: chy + 20, rx: 190, ry: 100, fill: tone("#2E2018") }) + tag("ellipse", { cx: chx, cy: chy + 90, rx: 170, ry: 26, fill: tone("#C9A066"), opacity: 0.8 }); // straw bedding
    [[chx - 60, 1], [chx + 70, -1]].forEach(function (rb) {
      s += tag("g", { transform: "translate(" + rb[0] + " " + (chy + 80) + ") scale(" + rb[1] + " 1)", "data-xrabbit": 1 }, tag("ellipse", { cx: 0, cy: -34, rx: 62, ry: 40, fill: tone("#B9A48C"), stroke: tone("#6E5A44"), "stroke-width": 4 }) +
        tag("circle", { cx: 50, cy: -46, r: 28, fill: tone("#B9A48C"), stroke: tone("#6E5A44"), "stroke-width": 4 }) + tag("ellipse", { cx: 40, cy: -82, rx: 12, ry: 30, fill: tone("#B9A48C"), stroke: tone("#6E5A44"), "stroke-width": 3, transform: "rotate(-60 40 -70)" }) +
        tag("path", { d: "M54 -48 q6 4 12 0", stroke: "#2E2A24", "stroke-width": 3, fill: "none" }) + tag("circle", { cx: -60, cy: -30, r: 14, fill: tone("#F4EEE6") }));
    });
    // a mole tunnel with the mole, an ant nest, worms, an acorn cache
    s += tag("path", { d: "M-300 3330 C200 3300 500 3380 700 3350", stroke: tone("#2E2018"), "stroke-width": 60, fill: "none", "stroke-linecap": "round" });
    s += tag("g", { transform: "translate(560 3356)" }, tag("ellipse", { rx: 58, ry: 28, fill: tone("#3A3A44"), stroke: tone("#1E1E24"), "stroke-width": 3 }) + tag("ellipse", { cx: 60, cy: 4, rx: 16, ry: 9, fill: tone("#F4A7B9") }) + tag("path", { d: "M40 22 l14 8 M30 24 l8 10", stroke: tone("#F4A7B9"), "stroke-width": 6, "stroke-linecap": "round" }));
    var ant = "";
    [[1820, 3150, 50], [1700, 3260, 44], [1900, 3330, 56], [1760, 3420, 40]].forEach(function (c) { ant += tag("ellipse", { cx: c[0], cy: c[1], rx: c[2], ry: c[2] * 0.5, fill: tone("#2E2018") }) + tag("ellipse", { cx: c[0] - 10, cy: c[1] + 6, rx: 8, ry: 5, fill: tone("#F4EEE6") }) + tag("ellipse", { cx: c[0] + 12, cy: c[1] + 4, rx: 8, ry: 5, fill: tone("#F4EEE6") }); });
    ant += tag("path", { d: "M1840 3000 Q1800 3080 1820 3150 Q1760 3200 1700 3260 Q1800 3300 1900 3330 Q1800 3380 1760 3420", stroke: tone("#2E2018"), "stroke-width": 14, fill: "none" });
    for (var an = 0; an < 6; an++) ant += tag("circle", { cx: 1780 + an * 22, cy: 3150 + an * 40 + (an % 2) * 10, r: 5, fill: tone("#1E1E24") });
    s += ant;
    [[1450, 3130, 0], [2750, 3400, 1], [3600, 3180, 2]].forEach(function (w) { s += tag("path", { d: "M" + w[0] + " " + w[1] + " q20 -16 40 0 q20 16 40 0 q20 -16 40 0", stroke: tone("#E58A9A"), "stroke-width": 12, fill: "none", "stroke-linecap": "round" }); });
    s += tag("ellipse", { cx: 3420, cy: 3080, rx: 80, ry: 46, fill: tone("#2E2018") });
    [[3390, 3090], [3430, 3076], [3460, 3096], [3410, 3104]].forEach(function (q) { s += tag("ellipse", { cx: q[0], cy: q[1], rx: 14, ry: 17, fill: tone("#A0703F"), stroke: tone("#5E4430"), "stroke-width": 2 }) + tag("path", { d: "M" + (q[0] - 13) + " " + (q[1] - 8) + " q13 -12 26 0 Z", fill: tone("#6E5236") }); });
    // stones, groundwater and bedrock
    for (var st = 0; st < 40; st++) { var sx = -250 + R() * 4380, sy = 3160 + R() * 280, sr = 8 + R() * 18; if ((Math.abs(sx - 1250) < 240 && sy > 3130 && sy < 3400) || (sx > 1620 && sx < 1980) || (sx < 760 && Math.abs(sy - 3340) < 60)) continue; s += tag("ellipse", { cx: r2(sx), cy: r2(sy), rx: r2(sr * 1.3), ry: r2(sr), fill: tone(st % 3 ? "#8E8A80" : "#A6927A"), stroke: tone("#5C584F"), "stroke-width": 3 }); }
    s += tag("rect", { x: -300, y: 3420, width: 4440, height: 80, fill: "url(#" + P + "-xgw)" });
    var rock = [];
    for (var rx = -300; rx <= 4140; rx += 120) rock.push([rx, 3490 + Math.sin(rx / 300) * 16 + R() * 10]);
    s += tag("path", { d: smooth(rock, false) + " L4140 3600 L-300 3600 Z", fill: "url(#" + P + "-xrock)", stroke: tone("#4A473F"), "stroke-width": 5 });
    s += tag("path", { d: "M300 3510 l40 50 l-10 40 M1500 3500 l-30 60 M2600 3520 l20 40 l40 20 M3500 3505 l-20 70", stroke: tone("#4A473F"), "stroke-width": 4, fill: "none" });
    // front: the big trunk's roots into the ground
    var f = tag("path", { d: "M-300 2960 Q0 3000 100 3200 Q140 3320 60 3420 M120 2950 Q260 3050 360 3240 M-200 2980 Q-160 3200 -260 3400", stroke: tone("#5E4430"), "stroke-width": 46, fill: "none", "stroke-linecap": "round" }) +
      tag("path", { d: "M-300 2900 H320 L330 2990 Q200 3010 -300 3000 Z", fill: tone("#5E4430") });
    return { defs: defs, under: under, body: s, front: f };
  }
  function mountBands(X, P, v, L, seed) {
    var top = drawTopBand(P, v, L, D.rng(seed + 31)), bot = drawBottomBand(P, v, L, D.rng(seed + 32));
    PL.band(X.over.sky, "top", "", top.sky);
    PL.band(X.over.far, "top", "", top.far);
    PL.band(X.over.mid, "top", top.defs, top.mid);
    var tg = PL.band(X.over.ground, "top", "", top.ground);
    PL.band(X.over.front, "top", "", top.front);
    PL.band(X.under.ground, "bottom", "", bot.under);
    PL.band(X.over.ground, "bottom", bot.defs, bot.body);
    PL.band(X.over.front, "bottom", "", bot.front);
    var flock = X.over.far.querySelector('[data-part="xflock"]'), bees = [].slice.call(tg.querySelectorAll("[data-bee]")).map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    var xstars = [].slice.call(X.over.sky.querySelectorAll("[data-xstar]")).filter(function (e, i) { return i % 4 === 0; }).map(function (e) { return { e: e, op: +e.getAttribute("opacity"), k: +e.getAttribute("data-xstar") }; });
    return function (t) {
      if (flock) flock.setAttribute("transform", "translate(" + r2(A.wrap(t * 50, -800, 1400)) + " " + r2(D.wobble(t, 4, 0.4) * 20) + ")");
      bees.forEach(function (b, i) { b.e.setAttribute("transform", b.base + " translate(" + r2(D.wobble(t, i + 2, 1.6) * 30) + " " + r2(D.wobble(t, i + 9, 1.4) * 20) + ")"); });
      xstars.forEach(function (x) { x.e.setAttribute("opacity", r2(x.op * (0.6 + 0.4 * Math.sin(t * 2 + x.k)))); });
    };
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place forest: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-forest";
    var seed = opts.seed === undefined ? 8 : opts.seed | 0;
    var L = LOOK[v], night = v !== "day";
    var parts = {
      sky: drawSky(P, v, L, D.rng(seed + 1)), far: drawFar(P, v, L, D.rng(seed + 2)), mid: drawMid(P, v, L, D.rng(seed + 3)),
      ground: drawGround(P, v, L, D.rng(seed + 4)), front: drawFront(P, v, L, D.rng(seed + 5)),
    };
    var g = {};
    var X = PL.extendLayers(layers, opts, meta);
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(X.layers[name], "forest-" + name, parts[name].defs, parts[name].body); });
    var bandsUpdate = X.on ? mountBands(X, P, v, L, seed) : null; // the bands above and below (tall-world px)
    var stars = [].slice.call(g.sky.querySelectorAll("[data-star]")), starOp = stars.map(function (e) { return +e.getAttribute("opacity"); });
    var rays = [].slice.call(g.mid.querySelectorAll("[data-ray]"));
    var deerHead = g.mid.querySelector('[data-part="deer"] [data-head]');
    var ripG = g.ground.querySelector('[data-part="ripples"]'), rips = [];
    for (var i = 0; i < 9; i++) rips.push({ y: G.back + 80 + i * 90, k: i, e: D.el(ripG, "path", { stroke: L.tone("#E6FBFF"), "stroke-width": 5, fill: "none", "stroke-linecap": "round", opacity: 0.7 }) });
    var owlG = g.ground.querySelector('[data-part="owl"]'), owlEyes = null;
    if (night) {
      var oc = "#7A6A58", od = "#3E342A", O = G.oak, ox = O.x + 30, oy = O.base - 540;
      owlG.innerHTML = tag("ellipse", { cx: ox, cy: oy + 10, rx: 30, ry: 40, fill: oc, stroke: od, "stroke-width": 4 }) + tag("path", { d: "M" + (ox - 26) + " " + (oy - 22) + " l-6 -20 l18 10 M" + (ox + 26) + " " + (oy - 22) + " l6 -20 l-18 10", fill: oc, stroke: od, "stroke-width": 3 }) +
        tag("g", { "data-eyes": 1 }, tag("circle", { cx: ox - 12, cy: oy - 4, r: 11, fill: "#FFE066" }) + tag("circle", { cx: ox + 12, cy: oy - 4, r: 11, fill: "#FFE066" }) + tag("circle", { cx: ox - 12, cy: oy - 4, r: 5, fill: "#111" }) + tag("circle", { cx: ox + 12, cy: oy - 4, r: 5, fill: "#111" }));
      owlEyes = owlG.querySelector("[data-eyes]");
    }
    var flyG = g.front.querySelector('[data-part="flyers"]'), FR = D.rng(seed + 31), flyers = [];
    var FLY_SPAN = [300, 3700];
    for (var f = 0; f < (night ? 30 : 5); f++) {
      var e = D.el(flyG, "g", {});
      if (night) e.innerHTML = tag("circle", { r: 18, fill: "#D8FF7A", opacity: 0.25 }) + tag("circle", { r: 6, fill: "#F4FFB8" });
      else e.innerHTML = tag("g", { "data-wings": 1 }, tag("path", { d: "M0 0 C-30 -40 -50 -10 -30 8 C-40 24 -10 30 0 6 Z", fill: ["#FFA94D", "#74C0FC", "#F783AC", "#FFD43B", "#B197FC"][f % 5], stroke: "#5A3E26", "stroke-width": 2 }) +
        tag("path", { d: "M0 0 C30 -40 50 -10 30 8 C40 24 10 30 0 6 Z", fill: ["#FFA94D", "#74C0FC", "#F783AC", "#FFD43B", "#B197FC"][f % 5], stroke: "#5A3E26", "stroke-width": 2 })) + tag("path", { d: "M0 -12 V14", stroke: "#3A2A1E", "stroke-width": 4 });
      flyers.push({ x: 400 + FR() * 3200, y: night ? 1100 + FR() * 700 : 900 + FR() * 500, s: (FR() * 100) | 0, e: e, wings: e.querySelector("[data-wings]") });
    }

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      if (bandsUpdate) bandsUpdate(t);
      stars.forEach(function (e, k) { if (k % 4 === 0) e.setAttribute("opacity", r2(starOp[k] * (0.6 + 0.4 * Math.sin(t * 2 + k)))); });
      rays.forEach(function (e, k) { e.setAttribute("opacity", r2(0.7 + 0.3 * Math.sin(t * 0.5 + k * 1.7))); });
      if (deerHead) { var graze = Math.max(0, Math.sin(t * 0.6)); deerHead.setAttribute("transform", "rotate(" + r2(graze * 38) + " 100 -110)"); }
      rips.forEach(function (rp) {
        var y = rp.y + ((t * 40 + rp.k * 30) % 90), cx = streamX(y), w = 30 + (y - G.back) * 0.12;
        rp.e.setAttribute("d", "M" + r2(cx - w) + " " + r2(y) + " q" + r2(w) + " -10 " + r2(w * 2) + " 0");
        rp.e.setAttribute("opacity", r2(0.6 * Math.sin(((t * 40 + rp.k * 30) % 90) / 90 * Math.PI)));
      });
      if (owlEyes) { var blink = (t % 4.2) < 0.15 ? 0.1 : 1, ey = G.oak.base - 544; owlEyes.setAttribute("transform", "translate(0 " + ey + ") scale(1 " + blink + ") translate(0 " + -ey + ")"); }
      flyers.forEach(function (fl) {
        var x = A.wrap(fl.x + t * (night ? 12 : 40), FLY_SPAN[0], FLY_SPAN[1]), edge = A.wrapFade(x, FLY_SPAN[0], FLY_SPAN[1], 200);
        var y = fl.y + D.wobble(t, fl.s, night ? 0.5 : 1.2) * (night ? 60 : 90);
        fl.e.setAttribute("transform", "translate(" + r2(x + D.wobble(t, fl.s + 5, 0.7) * 50) + " " + r2(y) + ")");
        fl.e.setAttribute("opacity", r2(edge * (night ? Math.max(0, 0.2 + 0.8 * Math.sin(t * 2.4 + fl.s)) : 1)));
        if (fl.wings) fl.wings.setAttribute("transform", "scale(" + r2(0.35 + 0.65 * Math.abs(Math.sin(t * 9 + fl.s))) + " 1)");
      });
    }
    var a = anchorsFor(opts);
    update(0, X.ref);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places.forest = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
