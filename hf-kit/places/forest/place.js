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
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(layers[name], "forest-" + name, parts[name].defs, parts[name].body); });
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
    update(0, PL.REF);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places.forest = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
