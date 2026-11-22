/* Place "sky-fantasy": floating islands above a sea of clouds. A big grassy island on the left with
 * a round tree, a little cottage and flowers, its rocky underside trailing roots and crystals, and a
 * waterfall pouring off its edge into the clouds; a rope bridge with lanterns across to a smaller
 * island with a stone tower; a hot-air balloon drifting above; far islands, a rainbow and birds in
 * the distance. Cloud puffs frame the foreground.
 *
 * Variants: day (default), twilight (violet and orange sky, stars, a crescent moon, glowing
 * crystals and lanterns). Anchors (ground-layer world px, 3840 x 2160 world):
 *   island     on the big island's grass (where an actor stands)
 *   waterfall  where the waterfall leaves the island's edge
 *   tower      the tower door on the small island
 *   balloon    the balloon's basket
 *   sky        open sky (a tag, a bird, a title)
 *   cloud-sea  the top of the cloud sea below the islands
 * Path: flight (an arc across the sky, left to right).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("sky-fantasy/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "sky-fantasy",
    description: "Floating islands over a sea of clouds: a grassy island with a tree, cottage and waterfall, a rope bridge to a tower island, a hot-air balloon.",
    variants: ["day", "twilight"],
    anchors: ["island", "waterfall", "tower", "balloon", "sky", "cloud-sea"],
    paths: ["flight"],
    actorScale: 0.8,
    actorLight: {
      day: { tint: "#FFF3DE", amount: 0.1, rim: "#FFF6DA", rimSide: 1 },
      twilight: { tint: "#A97AC8", amount: 0.42, rim: "#FFC48A", rimSide: 1 },
    },
  };

  var G = { top: 1300, isle: [260, 1960], small: { x0: 2620, x1: 3420, top: 1120 }, fall: 1930, balloon: { x: 2300, y: 720 }, sea: 1900 };

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    var flight = [];
    for (var k = 0; k <= 10; k++) { var u = k / 10; flight.push({ x: r2(300 + u * 3300), y: r2(900 - Math.sin(u * Math.PI) * 460) }); }
    return {
      anchors: {
        island: fixed(1000, G.top), waterfall: fixed(G.fall, G.top + 20), tower: fixed(3020, G.small.top),
        balloon: function (t) { return { x: G.balloon.x, y: r2(G.balloon.y + Math.sin((t || 0) * 0.6) * 24) }; },
        sky: fixed(1420, 480), "cloud-sea": fixed(2400, G.sea),
      },
      paths: { flight: flight },
    };
  }

  var LOOK = {
    day: { sky: [[0, "#4A9BE0"], [0.5, "#9FD3F2"], [0.85, "#E6F4F8"], [1, "#FFF0D8"]], tone: function (c) { return c; }, cloud: { cloud: "#EEF4FB", cloudShade: "#A3BEDC", cloudLight: "#FFFFFF", lightOp: 0.95 }, sea: ["#E9F2FB", "#A9C4E0"] },
    twilight: { sky: [[0, "#2A2466"], [0.45, "#7A4E9E"], [0.75, "#E07A86"], [1, "#FFC07A"]], tone: A.toner(0.18, "#6A3E8A", 0.3), cloud: { cloud: "#F2C2D6", cloudShade: "#A86EA6", cloudLight: "#FFE2D0" }, sea: ["#F6CCDC", "#B07AB6"] },
  };

  function puff(x, y, w, pal) { // a long cloud bank, shaded underneath and lit on top
    var s = "", light = "", shadow = "", n = 7;
    for (var i = 0; i < n; i++) {
      var cx = x - w / 2 + w * i / (n - 1), cy = y - (i % 2 ? 30 : 0) - Math.sin(i / (n - 1) * Math.PI) * w * 0.08, r = w * 0.14 + (i % 3) * 14;
      shadow += tag("circle", { cx: r2(cx + r * 0.12), cy: r2(cy + r * 0.32), r: r2(r), fill: pal.cloudShade });
      s += tag("circle", { cx: r2(cx), cy: r2(cy), r: r2(r * 0.94), fill: pal.cloud });
      light += tag("ellipse", { cx: r2(cx - r * 0.2), cy: r2(cy - r * 0.5), rx: r2(r * 0.5), ry: r2(r * 0.26), fill: pal.cloudLight, opacity: pal.lightOp || 0.45 });
    }
    return tag("ellipse", { cx: x, cy: y + w * 0.06, rx: w * 0.6, ry: w * 0.12, fill: pal.cloudShade }) + shadow + s + light +
      tag("path", { d: "M" + r2(x - w * 0.52) + " " + r2(y + w * 0.02) + " Q" + x + " " + r2(y + w * 0.1) + " " + r2(x + w * 0.52) + " " + r2(y + w * 0.02), stroke: pal.cloudShade, "stroke-width": r2(w * 0.02), fill: "none", opacity: 0.8 });
  }
  function island(x0, x1, top, depth, tone, R, crystals) {
    var w = x1 - x0, cx = (x0 + x1) / 2, s = "";
    var under = [[x0, top + 10], [x0 + w * 0.1, top + depth * 0.35], [x0 + w * 0.3, top + depth * 0.7], [cx, top + depth], [x1 - w * 0.25, top + depth * 0.6], [x1 - w * 0.06, top + depth * 0.3], [x1, top + 10]];
    s += tag("path", { d: smooth(under, false) + " Z", fill: tone("#8C6A4A"), stroke: tone("#5A4128"), "stroke-width": 6 });
    s += tag("path", { d: smooth([[x0 + w * 0.08, top + 40], [x0 + w * 0.3, top + depth * 0.4], [cx, top + depth * 0.55], [x1 - w * 0.2, top + depth * 0.35], [x1 - w * 0.06, top + 40]], false), stroke: tone("#A07A52"), "stroke-width": 26, fill: "none", opacity: 0.6 });
    for (var st = 0; st < 5; st++) s += tag("path", { d: smooth([[x0 + w * 0.06, top + 60 + st * depth * 0.12], [cx, top + 80 + st * depth * 0.16], [x1 - w * 0.06, top + 60 + st * depth * 0.12]], false), stroke: tone("#6E5236"), "stroke-width": 4, fill: "none", opacity: 0.5 });
    for (var rt = 0; rt < 8; rt++) { var rx = x0 + w * (0.15 + rt * 0.1), ry = top + depth * (0.3 + Math.sin(rt / 7 * Math.PI) * 0.55); s += tag("path", { d: "M" + r2(rx) + " " + r2(ry) + " q" + r2((R() - 0.5) * 40) + " " + r2(60 + R() * 60) + " " + r2((R() - 0.5) * 20) + " " + r2(130 + R() * 100), stroke: tone("#5A4128"), "stroke-width": 7, fill: "none", "stroke-linecap": "round" }); }
    if (crystals) crystals.forEach(function (c) { s += tag("path", { d: "M" + c[0] + " " + c[1] + " l-22 -10 l10 -70 l24 -20 l18 26 l-6 64 Z", fill: tone("#7FE3FF"), stroke: tone("#3E8EC0"), "stroke-width": 4, "data-crystal": 1, transform: "rotate(180 " + c[0] + " " + c[1] + ")" }); });
    s += tag("path", { d: "M" + (x0 - 10) + " " + (top + 20) + " Q" + cx + " " + (top - 40) + " " + (x1 + 10) + " " + (top + 20) + " Q" + cx + " " + (top + 50) + " " + (x0 - 10) + " " + (top + 20) + " Z", fill: tone("#6DB552"), stroke: tone("#3E7F32"), "stroke-width": 5 });
    for (var g = 0; g < 26; g++) { var gx = x0 + 20 + R() * (w - 40); s += tag("path", { d: "M" + r2(gx) + " " + (top + 30) + " l-6 22 l12 0 Z", fill: tone("#4E9440") }); }
    return s;
  }

  function drawSky(P, v, L, R) {
    var defs = S.lin(P + "-sky", L.sky) + S.rad(P + "-sun", [[0, "#FFF6D0", 1], [0.2, "#FFE08A", 0.8], [1, "#FFE08A", 0]]);
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: L.sky[L.sky.length - 1][1] }) + tag("rect", { x: -2600, y: -1600, width: 9040, height: 1900, fill: L.sky[0][1] });
    s += tag("rect", { x: -2600, y: 300, width: 9040, height: 1300, fill: "url(#" + P + "-sky)" });
    if (v === "twilight") s += A.stars(R, 120, 400, 300, 3000, 500) + tag("path", { d: "M2700 520 a90 90 0 1 0 60 150 a70 70 0 1 1 -60 -150 Z", fill: "#FFF3D6" }) + tag("circle", { cx: 2000, cy: 1300, r: 520, fill: "url(#" + P + "-sun)", opacity: 0.7 });
    else s += tag("circle", { cx: 2780, cy: 600, r: 480, fill: "url(#" + P + "-sun)" }) + tag("circle", { cx: 2780, cy: 600, r: 100, fill: "#FFF6D0" });
    s += tag("g", { "data-part": "clouds" }, A.cloud(600, 520, 0.6, L.cloud, 0) + A.cloud(1900, 640, 0.5, L.cloud, 1) + A.cloud(3300, 470, 0.65, L.cloud, 2));
    return { defs: defs, body: s };
  }
  function drawFar(P, v, L, R) {
    var tone = L.tone, s = "";
    if (v === "day") { // a rainbow
      ["#FF6B6B", "#FFA94D", "#FFE066", "#69DB7C", "#4DABF7", "#9775FA"].forEach(function (c, i) { s += tag("path", { d: "M" + (300 + i * 26) + " 1300 A" + (900 - i * 26) + " " + (760 - i * 26) + " 0 0 1 " + (2100 - i * 26) + " 1300", stroke: c, "stroke-width": 26, fill: "none", opacity: 0.4 }); });
    }
    [[700, 950, 260], [2300, 1000, 200], [3200, 900, 300], [1500, 1100, 160]].forEach(function (q, i) { s += tag("g", { opacity: 0.6 }, island(q[0] - q[2], q[0] + q[2], q[1], q[2] * 0.9, function (c) { return D.mix(tone(c), "#9FB8D8", 0.5); }, R, null) + A.tree(q[0], q[1] - q[2] * 0.25, q[2] * 0.18, function (c) { return D.mix(tone(c), "#9FB8D8", 0.5); }, 40 + i, false)); });
    var far = { cloud: D.mix(L.cloud.cloud, "#A9C8E8", 0.3), cloudShade: L.cloud.cloudShade, cloudLight: D.mix(L.cloud.cloudLight, "#A9C8E8", 0.2), lightOp: 0.5 };
    s += puff(1000, 1360, 1800, far) + puff(3000, 1400, 1800, far);
    return { defs: "", body: s };
  }
  function drawMid(P, v, L, R) {
    var tone = L.tone, s = "";
    s += island(-200, 500, 1180, 420, tone, R, null) + A.tree(150, 1080, 70, tone, 61, true);
    s += island(3500, 4200, 1240, 380, tone, R, null);
    // a thin waterfall from the left mid island
    s += tag("path", { d: "M480 1200 Q500 1500 470 1800", stroke: tone("#BFEFFF"), "stroke-width": 26, fill: "none", opacity: 0.8 });
    s += tag("g", { "data-part": "birds" }, "");
    return { defs: "", body: s };
  }
  function drawGround(P, v, L, R) {
    var tone = L.tone, tw = v === "twilight";
    var defs = S.lin(P + "-fall", [[0, "#E6FBFF"], [0.5, "#9FE0F6"], [1, "#E6FBFF", 0.2]], [0, 0, 1, 0]) + S.lin(P + "-sea", [[0, L.sea[0]], [1, L.sea[1]]]) + S.rad(P + "-glow", [[0, "#FFE08A", 0.8], [1, "#FFE08A", 0]]);
    var s = "", I = G.isle;
    // the cloud sea (behind the islands' undersides would hide them: it sits at the bottom)
    s += tag("rect", { x: -400, y: G.sea + 60, width: 4640, height: 800, fill: "url(#" + P + "-sea)" });
    // the big island with crystals underneath
    s += island(I[0], I[1], G.top, 640, tone, R, [[700, 1640], [1100, 1820], [1500, 1700]]);
    // the waterfall off the right edge into the clouds
    s += tag("path", { d: "M" + (G.fall - 40) + " " + (G.top + 10) + " Q" + (G.fall + 10) + " " + (G.top + 40) + " " + (G.fall + 40) + " " + (G.top + 200) + " L" + (G.fall + 80) + " " + (G.sea + 80) + " L" + (G.fall - 60) + " " + (G.sea + 80) + " L" + (G.fall - 30) + " " + (G.top + 200) + " Z", fill: "url(#" + P + "-fall)", opacity: 0.95 });
    s += tag("g", { "data-part": "fall-lines" }, "");
    s += tag("path", { d: "M" + (G.fall - 120) + " " + (G.top + 6) + " Q" + (G.fall - 60) + " " + (G.top - 10) + " " + (G.fall - 30) + " " + (G.top + 14), stroke: tone("#7FD3F5"), "stroke-width": 30, fill: "none", "stroke-linecap": "round" });
    // the big tree, the cottage, flowers and mushrooms on top
    s += A.tree(560, 960, 220, tone, 7, true);
    var hx = 1420, hy = G.top + 6;
    s += tag("rect", { x: hx - 150, y: hy - 230, width: 300, height: 230, fill: tone("#F4E3C3"), stroke: tone("#8C6A4A"), "stroke-width": 6 }) + tag("path", { d: "M" + (hx - 190) + " " + (hy - 220) + " L" + hx + " " + (hy - 400) + " L" + (hx + 190) + " " + (hy - 220) + " Z", fill: tone("#C2412F"), stroke: tone("#7A2A1F"), "stroke-width": 6 });
    s += tag("rect", { x: hx - 40, y: hy - 140, width: 80, height: 140, rx: 36, fill: tone("#7A4E2E"), stroke: tone("#4A2E18"), "stroke-width": 5 }) + tag("rect", { x: hx + 60, y: hy - 180, width: 64, height: 64, rx: 8, fill: tw ? "#FFD27A" : tone("#BFDCEB"), stroke: tone("#8C6A4A"), "stroke-width": 6 });
    s += tag("rect", { x: hx + 70, y: hy - 360, width: 44, height: 90, fill: tone("#8E8A80"), stroke: tone("#5C584F"), "stroke-width": 4 }) + tag("g", { "data-part": "chimney" }, "");
    if (tw) s += tag("circle", { cx: hx + 92, cy: hy - 148, r: 120, fill: "url(#" + P + "-glow)" });
    for (var f = 0; f < 22; f++) { var fx = I[0] + 60 + R() * (I[1] - I[0] - 160); if (Math.abs(fx - 1000) < 140) continue; s += tag("path", { d: "M" + r2(fx) + " " + (G.top + 20) + " v-34", stroke: tone("#2F6E2A"), "stroke-width": 4 }) + tag("circle", { cx: r2(fx), cy: G.top - 18, r: 11, fill: tone(["#FFFFFF", "#FFD43B", "#F783AC", "#B197FC"][f % 4]) }); }
    // the rope bridge with lanterns to the tower island
    var Sm = G.small, b0 = { x: I[1] - 30, y: G.top + 10 }, b1 = { x: Sm.x0 + 30, y: Sm.top + 10 };
    var bridge = function (dy, w) { return tag("path", { d: "M" + b0.x + " " + (b0.y + dy) + " Q" + ((b0.x + b1.x) / 2) + " " + (Math.max(b0.y, b1.y) + 160 + dy) + " " + b1.x + " " + (b1.y + dy), stroke: tone("#8C6A4A"), "stroke-width": w, fill: "none" }); };
    s += bridge(-70, 6) + bridge(0, 10);
    for (var pk = 0; pk <= 14; pk++) { var u = pk / 14, bx = b0.x + (b1.x - b0.x) * u, by = (1 - u) * (1 - u) * b0.y + 2 * u * (1 - u) * (Math.max(b0.y, b1.y) + 160) + u * u * b1.y; s += tag("rect", { x: r2(bx - 14), y: r2(by - 6), width: 28, height: 14, rx: 3, fill: tone("#A0703F") }) + tag("path", { d: "M" + r2(bx) + " " + r2(by) + " v-70", stroke: tone("#8C6A4A"), "stroke-width": 3 }); if (pk % 4 === 2) s += tag("circle", { cx: r2(bx), cy: r2(by - 90), r: 16, fill: tw ? "#FFD27A" : tone("#FFB84D"), stroke: tone("#8A5A20"), "stroke-width": 4, "data-lantern": pk }); }
    // the tower island
    s += island(Sm.x0, Sm.x1, Sm.top, 520, tone, R, [[2900, 1460], [3200, 1400]]);
    var tx = 3020, tb = Sm.top + 8, stone = tone("#C9C1B2"), stoneD = tone("#8E8574");
    s += tag("rect", { x: tx - 120, y: tb - 620, width: 240, height: 620, fill: stone, stroke: stoneD, "stroke-width": 6 });
    for (var br = 0; br < 12; br++) s += tag("path", { d: "M" + (tx - 120) + " " + (tb - 50 - br * 50) + " h240", stroke: stoneD, "stroke-width": 3, opacity: 0.5 });
    s += tag("path", { d: "M" + (tx - 150) + " " + (tb - 620) + " h300 v-50 h-40 v30 h-40 v-30 h-40 v30 h-40 v-30 h-40 v30 h-40 v-30 h-60 Z", fill: stone, stroke: stoneD, "stroke-width": 5 });
    s += tag("path", { d: "M" + (tx - 140) + " " + (tb - 670) + " L" + tx + " " + (tb - 900) + " L" + (tx + 140) + " " + (tb - 670) + " Z", fill: tone("#5C6BC0"), stroke: tone("#3949AB"), "stroke-width": 6 }) + tag("path", { d: "M" + tx + " " + (tb - 900) + " v-80 l70 20 l-70 20", fill: tone("#FF6B6B"), stroke: tone("#5A4128"), "stroke-width": 4 });
    s += tag("path", { d: "M" + (tx - 50) + " " + tb + " v-110 a50 50 0 0 1 100 0 v110 Z", fill: tone("#6B4A2F"), stroke: tone("#3A2A1E"), "stroke-width": 5 }) + tag("rect", { x: tx - 30, y: tb - 420, width: 60, height: 90, rx: 30, fill: tw ? "#FFD27A" : tone("#3A4651") });
    if (tw) s += tag("circle", { cx: tx, cy: tb - 375, r: 140, fill: "url(#" + P + "-glow)" });
    // the top of the cloud sea, billowing in front of the islands' roots
    [[300, 1420], [1500, 1300], [2650, 1400], [3750, 1300]].forEach(function (q) { s += puff(q[0], G.sea + 90, q[1], L.cloud); });
    [[900, 1200], [2100, 1300], [3300, 1100]].forEach(function (q) { s += puff(q[0], G.sea + 250, q[1], L.cloud); });
    // the balloon (moved in update)
    s += tag("g", { "data-part": "balloon" }, balloonMarkup(tone));
    return { defs: defs, body: s };
  }
  function balloonMarkup(tone) { // origin at the basket's top centre
    var s = "", cols = ["#FF6B6B", "#FFD43B", "#4DABF7", "#69DB7C"];
    s += tag("path", { d: "M-40 -100 L-30 0 M40 -100 L30 0", stroke: tone("#5A4128"), "stroke-width": 4 });
    for (var i = 0; i < 6; i++) { var a0 = -1 + i / 3, a1 = a0 + 1 / 3; s += tag("path", { d: "M" + r2(a0 * 40) + " -100 Q" + r2(a0 * 240) + " -300 " + r2(a0 * 50 * 4) + " -440 L" + r2(a1 * 200) + " -440 Q" + r2(a1 * 240) + " -300 " + r2(a1 * 40) + " -100 Z", fill: tone(cols[i % 4]), stroke: tone("#5A4128"), "stroke-width": 4 }); }
    s += tag("path", { d: "M-200 -440 Q-200 -640 0 -650 Q200 -640 200 -440 Z", fill: tone("#FF8787"), stroke: tone("#5A4128"), "stroke-width": 4 }) + tag("path", { d: "M-120 -560 q30 -60 80 -70", stroke: "#FFFFFF", "stroke-width": 14, fill: "none", opacity: 0.5, "stroke-linecap": "round" });
    s += tag("rect", { x: -50, y: 0, width: 100, height: 80, rx: 10, fill: tone("#A0703F"), stroke: tone("#5A4128"), "stroke-width": 5 }) + tag("path", { d: "M-50 30 h100", stroke: tone("#5A4128"), "stroke-width": 4 });
    return s;
  }
  function drawFront(P, v, L, R) {
    var s = puff(200, 2100, 1100, L.cloud) + puff(3700, 2080, 1000, L.cloud) + puff(1900, 2200, 900, L.cloud);
    return { defs: "", body: s + tag("g", { "data-part": "motes" }, "") };
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place sky-fantasy: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-sky-fantasy";
    var seed = opts.seed === undefined ? 18 : opts.seed | 0;
    var L = LOOK[v], tw = v === "twilight";
    var parts = { sky: drawSky(P, v, L, D.rng(seed + 1)), far: drawFar(P, v, L, D.rng(seed + 2)), mid: drawMid(P, v, L, D.rng(seed + 3)), ground: drawGround(P, v, L, D.rng(seed + 4)), front: drawFront(P, v, L, D.rng(seed + 5)) };
    var g = {};
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(layers[name], "sky-fantasy-" + name, parts[name].defs, parts[name].body); });
    var balloon = g.ground.querySelector('[data-part="balloon"]');
    var clouds = [].slice.call(g.sky.querySelectorAll("[data-cloud]")).map(function (e) { return { e: e, base: e.getAttribute("transform"), x0: +/translate\(([-\d.]+)/.exec(e.getAttribute("transform"))[1] }; });
    var crystals = [].slice.call(g.ground.querySelectorAll("[data-crystal]"));
    var lanterns = [].slice.call(g.ground.querySelectorAll("[data-lantern]"));
    var fallG = g.ground.querySelector('[data-part="fall-lines"]'), falls = [];
    for (var i = 0; i < 8; i++) falls.push({ k: i, e: D.el(fallG, "path", { stroke: "#FFFFFF", "stroke-width": 6, "stroke-linecap": "round", opacity: 0.7 }) });
    var smokeG = g.ground.querySelector('[data-part="chimney"]'), smoke = D.presets.smoke(seed + 7, 6), smokeEls = smoke.list.map(function () { return D.el(smokeG, "circle", { fill: tw ? "#D8C0E0" : "#F1F3F5", opacity: 0 }); });
    var birdG = g.mid.querySelector('[data-part="birds"]'), birds = [];
    for (var b = 0; b < 5; b++) birds.push({ k: b, e: D.el(birdG, "path", { fill: "none", stroke: tw ? "#3A2A4A" : "#2E3B55", "stroke-width": 6, "stroke-linecap": "round" }) });
    var moteG = g.front.querySelector('[data-part="motes"]'), MR = D.rng(seed + 21), motes = [];
    for (var m = 0; m < 16; m++) motes.push({ x: 200 + MR() * 3500, y: 600 + MR() * 1200, s: (MR() * 100) | 0, e: D.el(moteG, "circle", { r: 5, fill: tw ? "#FFE3A0" : "#FFFFFF", opacity: 0 }) });

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      var by = G.balloon.y + Math.sin(t * 0.6) * 24;
      balloon.setAttribute("transform", "translate(" + G.balloon.x + " " + r2(by) + ") rotate(" + r2(Math.sin(t * 0.45) * 2) + ")");
      clouds.forEach(function (c, k) { var x = A.wrap(c.x0 + t * (5 + k * 2), -800, 4600); c.e.setAttribute("transform", "translate(" + r2(x - c.x0) + " 0) " + c.base); });
      crystals.forEach(function (e, k) { e.setAttribute("opacity", r2(tw ? 0.7 + 0.3 * Math.sin(t * 1.6 + k) : 0.95)); });
      lanterns.forEach(function (e, k) { e.setAttribute("opacity", r2(0.75 + 0.25 * Math.sin(t * 3 + k))); });
      falls.forEach(function (f) { var u = A.wrap(t * 0.9 + f.k / 8, 0, 1), y = G.top + 200 + u * (G.sea - G.top - 140), x = G.fall + (f.k % 3 - 1) * 30 + u * 20; f.e.setAttribute("d", "M" + r2(x) + " " + r2(y) + " v80"); f.e.setAttribute("opacity", r2(0.7 * Math.sin(u * Math.PI))); });
      smoke.at(t).forEach(function (p, j) { var e = smokeEls[j]; e.setAttribute("cx", r2(1512 + p.x * 0.6)); e.setAttribute("cy", r2(G.top - 360 + p.y * 1.2)); e.setAttribute("r", r2(p.r * (0.4 + 0.6 * p.u))); e.setAttribute("opacity", r2(p.alive ? 0.5 * Math.sin(Math.PI * p.u) : 0)); });
      birds.forEach(function (bd) {
        var x = A.wrap(600 + bd.k * 90 + t * 70, -400, 4300), y = 820 + (bd.k % 2) * 50 + D.wobble(t, bd.k, 0.6) * 20, f = Math.sin(t * 7 + bd.k) * 12;
        bd.e.setAttribute("d", "M" + r2(x - 26) + " " + r2(y + f) + " Q" + r2(x - 12) + " " + r2(y - 12) + " " + r2(x) + " " + r2(y) + " Q" + r2(x + 12) + " " + r2(y - 12) + " " + r2(x + 26) + " " + r2(y + f));
      });
      motes.forEach(function (mt) { var x = A.wrap(mt.x + t * 10, 100, 3800); mt.e.setAttribute("cx", r2(x)); mt.e.setAttribute("cy", r2(mt.y + D.wobble(t, mt.s, 0.4) * 40)); mt.e.setAttribute("opacity", r2(A.wrapFade(x, 100, 3800, 160) * (0.3 + 0.25 * D.wobble(t, mt.s + 3, 0.5)))); });
    }
    var a = anchorsFor(opts);
    update(0, PL.REF);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places["sky-fantasy"] = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
