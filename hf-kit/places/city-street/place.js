/* Place "city-street": a friendly downtown street seen from the near sidewalk. Across the road a
 * row of shopfronts (a brick café, a little bakery, a glass office, a flower shop under yellow
 * flats, a blue corner pharmacy), with the city rising behind them (mid-rise blocks, then a hazy
 * skyline with a tower). Cars drive both ways on the road, a zebra crossing and a traffic light on
 * the right, a bus shelter, street lamps, steam from a manhole and pigeons on the near sidewalk.
 *
 * Variants: day (default), night (lit windows, lamp pools, glowing signs, headlights). Anchors
 * (ground-layer world px, 3840 x 2160 world):
 *   sidewalk   on the near sidewalk, left: where an actor stands and talks
 *   crosswalk  the middle of the zebra crossing
 *   shop-door  the bakery door across the road (far side: an actor there reads at about 0.7x
 *              actorScale, see anchor.scale)
 *   bus-stop   in front of the bus shelter, near sidewalk
 *   road       the middle of the road (cars, a sound, a speed tag)
 *   sky        open sky above the low bakery
 * Paths: sidewalk (along the near sidewalk), road (along the far lane, left to right).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("city-street/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "city-street",
    description: "Downtown street from the near sidewalk: shopfronts across the road, the city behind, cars, a zebra crossing, a bus shelter.",
    variants: ["day", "night"],
    anchors: ["sidewalk", "crosswalk", "shop-door", "bus-stop", "road", "sky"],
    paths: ["sidewalk", "road"],
    actorScale: 1, // an actor on the near sidewalk (about 390 world px tall)
    actorLight: {
      day: { tint: "#FFF3DE", amount: 0.1, rim: "#FFF6DA", rimSide: 1 },
      night: { tint: "#4C5C9E", amount: 0.64, rim: "#FFCF85", rimSide: -1 }, // street lamp at the left
    },
  };

  // ---- geometry (ground-layer world px) ------------------------------------------------------
  var G = {
    base: 1180,       // foot of the buildings across the road (far sidewalk back edge)
    farCurb: 1250, road0: 1262, road1: 1500, nearCurb: 1528, // road band, near curb top
    shopTop: 572,     // top of the ground-floor shopfronts (4 m at 0.7 scale)
    storey: 486,
    laneFar: 1350, laneNear: 1476, // wheel lines
    zebra: [2960, 3460],
    lamps: [520, 3560], shelter: { x0: 1960, x1: 2520, base: 1556 },
    light: { x: 2890, base: 1544 },
  };
  var CARS = [
    { lane: "far", dir: -1, speed: 300, x0: 2600, body: "#E8590C", scale: 0.6 },
    { lane: "far", dir: -1, speed: 300, x0: 300, body: "#4C6EF5", scale: 0.58 },
    { lane: "near", dir: 1, speed: 360, x0: 900, body: "#2B8A3E", scale: 0.72 },
    { lane: "near", dir: 1, speed: 360, x0: 3600, body: "#F2F2EC", scale: 0.74 },
  ];
  var CAR_SPAN = [-1400, 5240];
  var CLOUDS = [[600, 520, 0.7], [1500, 420, 0.55], [2400, 560, 0.8], [3300, 440, 0.6], [-300, 600, 0.7]];
  var CLOUD_SPAN = [-900, 4600];

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    var fixed = function (x, y, sc) { return function () { var p = { x: x, y: y }; if (sc) p.scale = sc; return p; }; };
    var walk = [], road = [];
    for (var x = 200; x <= 3640; x += 344) walk.push({ x: x, y: 1720 });
    for (var r = 0; r <= 3840; r += 384) road.push({ x: r, y: G.laneFar - 40 });
    return {
      anchors: {
        sidewalk: fixed(760, 1730),
        crosswalk: fixed(3210, 1392),
        "shop-door": fixed(1440, G.base + 6, 0.7),
        "bus-stop": fixed(2240, 1690),
        road: fixed(1900, 1390),
        sky: fixed(1190, 380),
      },
      paths: { sidewalk: walk, road: road },
    };
  }

  // ---- palettes ------------------------------------------------------------------------------
  var LOOK = {
    day: { sky: [[0, "#3E8FD8"], [0.5, "#8CC8EE"], [0.85, "#D4ECF4"], [1, "#FFE6BC"]], cloud: { cloud: "#FFFFFF", cloudShade: "#D3E3F1", cloudLight: "#FFFDF4" },
      tone: function (c) { return c; }, far: "#A9C2D6", farD: "#97B2C8", mid: ["#D9C7B0", "#C9B49D", "#BFCAD2", "#E2D3B8"], win: "#9EC3DC", lit: 0 },
    night: { sky: [[0, "#060B22"], [0.5, "#14204A"], [0.85, "#2B3A6E"], [1, "#4A4880"]], cloud: { cloud: "#2E3968", cloudShade: "#1F2850", cloudLight: "#46528A" },
      tone: A.toner(0.42, "#1E2C64", 0.44), far: "#1E2850", farD: "#18213F", mid: ["#2A3257", "#252C4E", "#2C3660", "#30385C"], win: "#2C3A66", lit: 0.55 },
  };

  // ---- drawing helpers -----------------------------------------------------------------------
  /* A grid of windows; lit ones glow at night. */
  function windows(x, y, cols, rows, w, h, gx, gy, L, R, frame, glass) {
    var s = "";
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
      var wx = x + i * (w + gx), wy = y + j * (h + gy), on = R() < L.lit;
      s += tag("rect", { x: wx - 6, y: wy - 6, width: w + 12, height: h + 12, rx: 4, fill: frame });
      s += tag("rect", { x: wx, y: wy, width: w, height: h, rx: 2, fill: on ? (R() < 0.5 ? "#FFD27A" : "#FFE6A8") : glass });
      if (!on) s += A.glint(wx, wy, w, h, L.lit ? 0.06 : 0.28);
      if (on && R() < 0.4) s += tag("rect", { x: wx, y: wy, width: w * 0.35, height: h, fill: "#E8A04A", opacity: 0.6 }); // a curtain
      s += tag("path", { d: "M" + r2(wx + w / 2) + " " + wy + " V" + (wy + h), stroke: frame, "stroke-width": 5 });
      s += tag("rect", { x: wx - 10, y: wy + h + 4, width: w + 20, height: 10, rx: 3, fill: D.shade(frame, 0.15) });
    }
    return s;
  }
  function awning(x0, x1, y, depth, c1, c2, tone) {
    var s = "", n = Math.round((x1 - x0) / 56), w = (x1 - x0) / n;
    for (var i = 0; i < n; i++) s += tag("path", { d: "M" + r2(x0 + i * w) + " " + y + " L" + r2(x0 + (i + 1) * w) + " " + y + " L" + r2(x0 + (i + 1) * w + 18) + " " + (y + depth) + " L" + r2(x0 + i * w + 18) + " " + (y + depth) + " Z", fill: tone(i % 2 ? c2 : c1) });
    s += tag("path", { d: "M" + (x0 + 18) + " " + (y + depth) + " " + Array.apply(null, Array(n)).map(function (_, i) { return "q" + r2(w / 2) + " 26 " + r2(w) + " 0"; }).join(" "), fill: tone(c1), stroke: D.shade(tone(c1), 0.3), "stroke-width": 3 });
    s += tag("rect", { x: x0 - 6, y: y - 10, width: x1 - x0 + 30, height: 14, rx: 6, fill: D.shade(tone(c1), 0.35) });
    return s;
  }
  function blade(x, y, icon, tone, night) { // a hanging shop sign with a picture (no words)
    var s = tag("path", { d: "M" + x + " " + y + " h70", stroke: tone("#3A3A3A"), "stroke-width": 8 });
    s += tag("circle", { cx: x + 70, cy: y + 66, r: 56, fill: tone("#FFF8EA"), stroke: tone("#3A2F28"), "stroke-width": 6 });
    if (night) s += tag("circle", { cx: x + 70, cy: y + 66, r: 92, fill: "#FFD27A", opacity: 0.18 });
    s += tag("g", { transform: "translate(" + (x + 70) + " " + (y + 66) + ")" }, icon);
    return s;
  }
  var ICON = {
    cup: function (t) { return tag("path", { d: "M-26 -14 h44 v22 a22 22 0 0 1 -44 0 Z", fill: t("#8C5A3C") }) + tag("path", { d: "M18 -8 q18 0 14 14 q-4 10 -16 8", fill: "none", stroke: t("#8C5A3C"), "stroke-width": 6 }) + tag("path", { d: "M-14 -24 q6 -8 0 -16 M0 -24 q6 -8 0 -16", stroke: t("#B08A6A"), "stroke-width": 4, fill: "none", "stroke-linecap": "round" }); },
    bread: function (t) { return tag("path", { d: "M-34 8 q0 -30 34 -30 q34 0 34 30 Z", fill: t("#E0A458"), stroke: t("#9A5B23"), "stroke-width": 4 }) + tag("path", { d: "M-16 -14 l8 14 M0 -20 l8 16 M16 -14 l8 14", stroke: t("#9A5B23"), "stroke-width": 4, "stroke-linecap": "round" }); },
    flower: function (t) { var s = ""; for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; s += tag("circle", { cx: r2(Math.cos(a) * 16), cy: r2(Math.sin(a) * 16 - 6), r: 13, fill: t("#F06595") }); } return s + tag("circle", { cx: 0, cy: -6, r: 10, fill: t("#FFD43B") }) + tag("path", { d: "M0 6 v26", stroke: t("#2F9E44"), "stroke-width": 6 }); },
    cross: function (t) { return tag("path", { d: "M-10 -32 h20 v22 h22 v20 h-22 v22 h-20 v-22 h-22 v-20 h22 Z", fill: t("#2F9E44") }); },
  };
  function door(x, y, w, h, c, tone, night) {
    var s = tag("rect", { x: x - 10, y: y - h - 10, width: w + 20, height: h + 10, fill: D.shade(tone(c), 0.35) });
    s += tag("rect", { x: x, y: y - h, width: w, height: h, fill: tone(c), stroke: D.shade(tone(c), 0.4), "stroke-width": 4 });
    s += tag("rect", { x: x + 14, y: y - h + 18, width: w - 28, height: h * 0.55, rx: 4, fill: night ? "#FFD996" : tone("#BFDCEB") });
    if (!night) s += A.glint(x + 14, y - h + 18, w - 28, h * 0.55, 0.3);
    s += tag("circle", { cx: x + w - 18, cy: y - h * 0.38, r: 6, fill: tone("#E7C46A") });
    return s;
  }
  function shopWindow(x0, x1, top, bot, tone, night, goods) {
    var s = tag("rect", { x: x0, y: top, width: x1 - x0, height: bot - top, fill: night ? "#FFE2A0" : tone("#CFE6F2"), stroke: tone("#3A4651"), "stroke-width": 8 });
    if (night) s += tag("rect", { x: x0, y: top, width: x1 - x0, height: bot - top, fill: "#FFB347", opacity: 0.25 });
    s += goods;
    if (!night) s += A.glint(x0, top, x1 - x0, bot - top, 0.22);
    s += tag("rect", { x: x0 - 10, y: bot, width: x1 - x0 + 20, height: 26, fill: tone("#5A6470") });
    return s;
  }

  // ---- layers --------------------------------------------------------------------------------
  function drawSky(P, v, L, R) {
    var defs = S.lin(P + "-sky", L.sky) + S.rad(P + "-sun", [[0, "#FFF6D0", 1], [0.2, "#FFE08A", 0.8], [1, "#FFE08A", 0]]);
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: L.sky[L.sky.length - 1][1] });
    s += tag("rect", { x: -2600, y: -1600, width: 9040, height: 1700, fill: L.sky[0][1] });
    s += tag("rect", { x: -2600, y: 100, width: 9040, height: 1500, fill: "url(#" + P + "-sky)" });
    if (v === "night") {
      s += tag("g", { "data-part": "stars" }, A.stars(R, 110, 400, 300, 3000, 800));
      s += tag("circle", { cx: 2780, cy: 560, r: 260, fill: "#8FA6E0", opacity: 0.16 }) + tag("circle", { cx: 2780, cy: 560, r: 78, fill: "#F6F2DC" }) +
        tag("circle", { cx: 2760, cy: 548, r: 16, fill: "#DCD6BC" }) + tag("circle", { cx: 2800, cy: 584, r: 11, fill: "#DCD6BC" });
    } else s += tag("circle", { cx: 2700, cy: 600, r: 460, fill: "url(#" + P + "-sun)" }) + tag("circle", { cx: 2700, cy: 600, r: 104, fill: "#FFF6D0" });
    var cl = "";
    CLOUDS.forEach(function (c, i) { cl += A.cloud(c[0], c[1], c[2], L.cloud, i); });
    s += tag("g", { "data-part": "clouds", opacity: v === "night" ? 0.6 : 1 }, cl);
    return { defs: defs, body: s };
  }

  function drawFar(P, v, L, R) {
    var s = "", night = v === "night";
    // hazy skyline: towers of varied height, a TV tower with a pod
    for (var b = 0; b < 26; b++) {
      var x = -900 + b * 230 + R() * 60, w = 140 + R() * 120, h = 380 + R() * 520, top = 1250 - h;
      s += tag("rect", { x: x, y: top, width: w, height: h + 900, fill: b % 2 ? L.far : L.farD });
      if (R() < 0.35) s += tag("rect", { x: x + w * 0.3, y: top - 50, width: w * 0.4, height: 50, fill: L.farD });
      if (night) for (var wy = top + 30; wy < 1200; wy += 52) for (var wx = x + 16; wx < x + w - 20; wx += 34) if (R() < 0.3) s += tag("rect", { x: wx, y: wy, width: 14, height: 20, fill: "#FFD27A", opacity: 0.75 });
    }
    s += tag("path", { d: "M2140 1250 L2160 520 L2200 520 L2220 1250 Z", fill: L.farD }) + tag("ellipse", { cx: 2180, cy: 560, rx: 70, ry: 34, fill: L.far }) +
      tag("path", { d: "M2180 526 V330", stroke: L.farD, "stroke-width": 10 }) + (night ? tag("circle", { cx: 2180, cy: 330, r: 9, fill: "#FF6B6B" }) : "");
    s += tag("rect", { x: -900, y: 1100, width: 5600, height: 300, fill: night ? "#2A3466" : "#DCE7EE", opacity: 0.35 }); // haze
    return { defs: "", body: s };
  }

  function drawMid(P, v, L, R) {
    var s = "", night = v === "night", tone = L.tone;
    var blocks = [[-500, 360, 760], [300, 620, 520], [760, 900, 360], [1120, 980, 300], [1480, 700, 380], [2200, 560, 700], [2800, 300, 560], [3400, 480, 660], [4000, 600, 600]];
    blocks.forEach(function (b, i) {
      var x = b[0], top = b[1], w = b[2], col = L.mid[i % L.mid.length];
      s += tag("rect", { x: x, y: top, width: w, height: 1500, fill: col });
      s += tag("rect", { x: x + w * 0.7, y: top, width: w * 0.3, height: 1500, fill: D.shade(col, 0.1), opacity: 0.6 });
      s += tag("rect", { x: x - 10, y: top - 18, width: w + 20, height: 22, fill: D.shade(col, 0.2) });
      for (var wy = top + 50; wy < 1300; wy += 110) for (var wx = x + 36; wx < x + w - 60; wx += 96) {
        var on = R() < (night ? 0.45 : 0);
        s += tag("rect", { x: wx, y: wy, width: 52, height: 66, rx: 3, fill: on ? "#FFD27A" : (night ? "#1A2142" : tone("#AFC6D6")), opacity: 0.9 });
      }
      if (i % 3 === 1) { // a rooftop water tank
        var tx = x + w * 0.3;
        s += tag("path", { d: "M" + (tx - 40) + " " + top + " l10 -60 M" + (tx + 40) + " " + top + " l-10 -60", stroke: D.shade(col, 0.35), "stroke-width": 8 }) +
          tag("rect", { x: tx - 56, y: top - 170, width: 112, height: 110, rx: 10, fill: tone("#9C6B45") }) + tag("path", { d: "M" + (tx - 62) + " " + (top - 170) + " L" + tx + " " + (top - 220) + " L" + (tx + 62) + " " + (top - 170) + " Z", fill: tone("#6E4B32") });
      }
    });
    return { defs: "", body: s };
  }

  function drawGround(P, v, L, R) {
    var night = v === "night", tone = L.tone;
    var defs = S.lin(P + "-road", [[0, tone("#56606B")], [1, tone("#3E4650")]]) + S.lin(P + "-walk", [[0, tone("#D8D2C6")], [1, tone("#BDB5A6")]]) +
      S.lin(P + "-office", [[0, night ? "#1D2B55" : "#7FB2D8"], [0.6, night ? "#25336A" : "#B9DAF0"], [1, night ? "#2C3A70" : "#E5F2F8"]]) +
      S.rad(P + "-pool", [[0, "#FFD898", 0.7], [1, "#FFD898", 0]]) + S.lin(P + "-beam", [[0, "#FFF3C4", 0.42], [1, "#FFF3C4", 0]], [0, 0, 1, 0]);
    var s = "", B = G.base;
    // ---- buildings across the road
    // A: brick café (x -300..820)
    s += tag("rect", { x: -300, y: -500, width: 1120, height: B + 500, fill: tone("#B5523B") });
    for (var by = -480; by < B; by += 34) s += tag("path", { d: "M-300 " + by + " H820", stroke: tone("#9A4130"), "stroke-width": 3, opacity: 0.45 });
    s += windows(-200, -80, 3, 2, 190, 260, 110, 226, L, R, tone("#F3E6D0"), L.win);
    s += tag("rect", { x: -300, y: G.shopTop - 40, width: 1120, height: 40, fill: tone("#7E3527") });
    s += shopWindow(-160, 420, 690, 1060, tone, night, tag("rect", { x: -120, y: 960, width: 500, height: 14, fill: tone("#8C5A3C") }) +
      [[-60, 900], [80, 910], [240, 900]].map(function (q) { return tag("ellipse", { cx: q[0], cy: q[1] + 40, rx: 50, ry: 16, fill: tone("#FFF") }) + tag("path", { d: "M" + (q[0] - 30) + " " + q[1] + " h60 v30 a30 18 0 0 1 -60 0 Z", fill: tone("#F4E7D3"), stroke: tone("#8C5A3C"), "stroke-width": 4 }); }).join(""));
    s += awning(-200, 440, 610, 96, "#E03131", "#FFF5F5", tone);
    s += door(500, B, 150, 360, "#7A3E2A", tone, night);
    s += blade(700, 640, ICON.cup(tone), tone, night);
    // B: bakery (x 820..1560), one storey with a parapet: open sky above
    s += tag("rect", { x: 820, y: 512, width: 740, height: B - 512, fill: tone("#F3E3C3") });
    s += tag("rect", { x: 806, y: 500, width: 768, height: 40, rx: 6, fill: tone("#E0C99E") }) + tag("rect", { x: 820, y: 540, width: 740, height: 14, fill: tone("#C9AE80") });
    s += shopWindow(880, 1330, 720, 1070, tone, night, [[950, 1010], [1060, 1000], [1180, 1012], [1270, 1004]].map(function (q, i) {
      return tag("path", { d: "M" + (q[0] - 46) + " " + q[1] + " q0 -42 46 -42 q46 0 46 42 Z", fill: tone(i % 2 ? "#D9954A" : "#E7B36A"), stroke: tone("#9A5B23"), "stroke-width": 4 });
    }).join("") + tag("rect", { x: 900, y: 1012, width: 410, height: 12, fill: tone("#8C5A3C") }) + tag("path", { d: "M940 860 q40 -40 80 0 q40 -40 80 0", fill: "none", stroke: tone("#F06595"), "stroke-width": 8, opacity: 0.8 }));
    s += awning(860, 1360, 640, 80, "#0CA678", "#E6FCF5", tone);
    s += door(1380, B, 140, 350, "#2F7F74", tone, night);
    s += blade(1500, 590, ICON.bread(tone), tone, night);
    // C: glass office (x 1560..2380)
    s += tag("rect", { x: 1560, y: -500, width: 820, height: B + 500, fill: "url(#" + P + "-office)" });
    for (var cx = 1560; cx <= 2380; cx += 102.5) s += tag("path", { d: "M" + r2(cx) + " -500 V" + (B - 300), stroke: tone("#4C6A85"), "stroke-width": 8 });
    for (var cy = -420; cy < B - 300; cy += 150) s += tag("path", { d: "M1560 " + cy + " H2380", stroke: tone("#4C6A85"), "stroke-width": 6 });
    if (night) for (var q = 0; q < 40; q++) { var i = (R() * 8) | 0, j = (R() * 9) | 0; s += tag("rect", { x: 1566 + i * 102.5, y: -414 + j * 150, width: 90, height: 140, fill: "#FFE6A8", opacity: 0.7 }); }
    else s += tag("path", { d: "M1600 100 L1800 -300 L1900 -300 L1700 100 Z M1950 600 L2150 200 L2210 200 L2010 600 Z", fill: "#FFFFFF", opacity: 0.25 });
    s += tag("rect", { x: 1540, y: B - 320, width: 860, height: 30, fill: tone("#2F3E4C") });
    s += tag("rect", { x: 1600, y: B - 290, width: 740, height: 290, fill: night ? "#F7D58E" : tone("#D2E8F3"), stroke: tone("#2F3E4C"), "stroke-width": 8 });
    for (var lx = 1690; lx < 2340; lx += 90) s += tag("path", { d: "M" + lx + " " + (B - 290) + " V" + B, stroke: tone("#2F3E4C"), "stroke-width": 5 });
    s += tag("rect", { x: 1900, y: B - 250, width: 160, height: 250, rx: 80, fill: tone("#9FB7C6"), stroke: tone("#2F3E4C"), "stroke-width": 6, opacity: 0.85 });
    s += tag("path", { d: "M1980 " + (B - 250) + " V" + B, stroke: tone("#2F3E4C"), "stroke-width": 5 });
    // small plaza with a tree (x 2380..2560)
    s += tag("rect", { x: 2380, y: 900, width: 180, height: B - 900, fill: tone("#E6DED0") });
    s += A.tree(2470, 830, 140, tone, 5, true);
    s += tag("rect", { x: 2400, y: B - 60, width: 140, height: 60, rx: 8, fill: tone("#8C7B66"), stroke: tone("#5C4A38"), "stroke-width": 4 });
    // D: flower shop under yellow flats (x 2560..3330)
    s += tag("rect", { x: 2560, y: 40, width: 770, height: B - 40, fill: tone("#F2C14E") });
    s += tag("rect", { x: 2546, y: 24, width: 798, height: 34, rx: 6, fill: tone("#D9A93A") });
    s += windows(2640, 140, 3, 1, 160, 240, 90, 0, L, R, tone("#FFFDF7"), L.win);
    // a fire escape on the yellow flats
    s += tag("path", { d: "M2620 430 H3260 M2620 470 H3260 M2640 430 V470 M3240 430 V470 M2700 470 L2840 560 M2860 470 V560", stroke: tone("#3A3A3A"), "stroke-width": 6, fill: "none" });
    s += tag("rect", { x: 2560, y: G.shopTop - 30, width: 770, height: 30, fill: tone("#B8871F") });
    s += shopWindow(2620, 2980, 720, 1060, tone, night, [2660, 2740, 2820, 2900].map(function (fx, i) {
      return tag("g", { transform: "translate(" + fx + " 960) scale(0.8)" }, ICON.flower(tone)) + tag("rect", { x: fx - 26, y: 990, width: 52, height: 70, rx: 6, fill: tone(["#5C7CFA", "#F76707", "#AE3EC9", "#1098AD"][i]) });
    }).join(""));
    s += awning(2600, 3000, 640, 84, "#2F9E44", "#EBFBEE", tone);
    s += door(3060, B, 150, 360, "#5C3D99", tone, night);
    s += blade(3230, 600, ICON.flower(tone), tone, night);
    // flower buckets on the far sidewalk
    [2640, 2720, 2800, 2880, 2960].forEach(function (fx, i) {
      s += tag("path", { d: "M" + (fx - 26) + " " + (B + 30) + " l8 50 h36 l8 -50 Z", fill: tone("#8C9AA5"), stroke: tone("#4B5563"), "stroke-width": 3 });
      for (var f = 0; f < 3; f++) s += tag("circle", { cx: fx - 14 + f * 14, cy: B + 16 - (f % 2) * 10, r: 11, fill: tone(["#F06595", "#FFD43B", "#FF8787", "#B197FC"][(i + f) % 4]) });
    });
    // E: blue corner pharmacy (x 3330..4140)
    s += tag("rect", { x: 3330, y: -500, width: 810, height: B + 500, fill: tone("#4C7FB5") });
    s += tag("rect", { x: 3330, y: -500, width: 120, height: B + 500, fill: tone("#3D6A9A") });
    s += windows(3500, -60, 3, 2, 150, 240, 70, 230, L, R, tone("#EAF2F8"), L.win);
    s += tag("rect", { x: 3330, y: G.shopTop - 34, width: 810, height: 34, fill: tone("#2E5585") });
    s += shopWindow(3480, 3800, 700, 1060, tone, night, tag("rect", { x: 3510, y: 920, width: 260, height: 12, fill: tone("#FFFFFF") }) + [3540, 3600, 3660, 3720].map(function (bx, i) { return tag("rect", { x: bx, y: 870, width: 36, height: 50, rx: 6, fill: tone(["#FF8787", "#74C0FC", "#FFFFFF", "#69DB7C"][i]) }); }).join(""));
    s += door(3850, B, 150, 360, "#E9F2F8", tone, night);
    s += blade(3370, 610, ICON.cross(tone), tone, night);
    if (night) [[300, 900], [1100, 880], [2780, 880], [3640, 880]].forEach(function (q) { s += tag("ellipse", { cx: q[0], cy: q[1] + 260, rx: 360, ry: 120, fill: "url(#" + P + "-pool)", opacity: 0.6 }); });
    // ---- far sidewalk and curb
    s += tag("rect", { x: -300, y: B, width: 4440, height: G.farCurb - B, fill: "url(#" + P + "-walk)" });
    for (var fx2 = -260; fx2 < 4140; fx2 += 120) s += tag("path", { d: "M" + fx2 + " " + B + " l-14 " + (G.farCurb - B), stroke: tone("#A69D8E"), "stroke-width": 3, opacity: 0.6 });
    s += tag("rect", { x: -300, y: G.farCurb, width: 4440, height: 14, fill: tone("#9A9184") });
    s += tag("g", { transform: "translate(1180 " + (B + 8) + ")" }, tag("rect", { x: -16, y: 0, width: 32, height: 46, rx: 8, fill: tone("#E03131") }) + tag("rect", { x: -24, y: 12, width: 48, height: 10, rx: 4, fill: tone("#C92A2A") })); // hydrant
    // ---- the road
    s += tag("rect", { x: -300, y: G.road0, width: 4440, height: G.nearCurb - G.road0, fill: "url(#" + P + "-road)" });
    s += tag("path", { d: "M-300 1388 H4140", stroke: tone("#F2C94C"), "stroke-width": 8, "stroke-dasharray": "90 70", opacity: 0.9 });
    s += tag("path", { d: "M-300 1282 H4140 M-300 1508 H4140", stroke: tone("#E9ECEF"), "stroke-width": 5, opacity: 0.6 });
    // zebra crossing: white bands parallel to the kerbs, stacked across the road from the far
    // kerb to the near one, each a little deeper and wider as it comes toward us
    var zb = 7, zy0 = G.road0 + 10, zy1 = G.nearCurb - 8;
    for (var zi = 0; zi < zb; zi++) {
      var ya = zy0 + (zy1 - zy0) * Math.pow(zi / zb, 1.12), yb = zy0 + (zy1 - zy0) * Math.pow((zi + 0.55) / zb, 1.12), grow = 1 + 0.12 * zi / zb;
      var cx0 = (G.zebra[0] + G.zebra[1]) / 2, hw = (G.zebra[1] - G.zebra[0]) / 2;
      s += tag("path", { d: "M" + r2(cx0 - hw * grow) + " " + r2(ya) + " H" + r2(cx0 + hw * grow) + " L" + r2(cx0 + hw * (grow + 0.02)) + " " + r2(yb) + " H" + r2(cx0 - hw * (grow + 0.02)) + " Z", fill: tone("#F8F9FA"), opacity: 0.92 });
    }
    s += tag("ellipse", { cx: 1500, cy: 1440, rx: 90, ry: 22, fill: tone("#2E343B"), stroke: tone("#6C757D"), "stroke-width": 4 }); // manhole
    s += tag("path", { d: "M1430 1440 H1570 M1450 1432 H1550 M1450 1448 H1550", stroke: tone("#6C757D"), "stroke-width": 3 });
    s += tag("g", { "data-part": "steam" }, "");
    s += tag("g", { "data-part": "cars-far" }, "") + tag("g", { "data-part": "cars-near" }, "");
    // ---- near curb and sidewalk
    s += tag("rect", { x: -300, y: G.nearCurb - 8, width: 4440, height: 30, fill: tone("#B9B1A3") }) + tag("rect", { x: -300, y: G.nearCurb + 20, width: 4440, height: 10, fill: tone("#8F887B") });
    s += tag("rect", { x: -300, y: G.nearCurb + 30, width: 4440, height: 2160 - G.nearCurb + 300, fill: "url(#" + P + "-walk)" });
    var VP = { x: 1920, y: 700 }, pav = "";
    for (var px = -2400; px <= 6240; px += 240) pav += "M" + r2(VP.x + (px - VP.x) * (G.nearCurb + 30 - VP.y) / (2400 - VP.y)) + " " + (G.nearCurb + 30) + " L" + px + " 2400 ";
    [1610, 1700, 1810, 1950, 2120].forEach(function (yy) { pav += "M-300 " + yy + " H4140 "; });
    s += tag("path", { d: pav, stroke: tone("#A89F90"), "stroke-width": 3, opacity: 0.55 });
    // bus shelter (behind the bus-stop anchor)
    var Sh = G.shelter;
    s += tag("rect", { x: Sh.x0, y: Sh.base - 520, width: Sh.x1 - Sh.x0, height: 520, fill: night ? "#9FB8E8" : tone("#CDE7F2"), opacity: 0.35, stroke: tone("#5C6B77"), "stroke-width": 6 });
    s += tag("rect", { x: Sh.x0 - 30, y: Sh.base - 560, width: Sh.x1 - Sh.x0 + 60, height: 44, rx: 10, fill: tone("#2F3E4C") });
    s += tag("rect", { x: Sh.x1 - 200, y: Sh.base - 470, width: 170, height: 300, rx: 8, fill: night ? "#FFF1C9" : tone("#FFFFFF"), stroke: tone("#2F3E4C"), "stroke-width": 6 });
    s += tag("path", { d: "M" + (Sh.x1 - 190) + " " + (Sh.base - 240) + " q40 -60 80 -10 q30 -40 70 0 V" + (Sh.base - 180) + " H" + (Sh.x1 - 190) + " Z", fill: tone("#51CF66") }) + tag("circle", { cx: Sh.x1 - 80, cy: Sh.base - 380, r: 30, fill: tone("#FFA94D") });
    s += tag("rect", { x: Sh.x0 + 40, y: Sh.base - 170, width: 300, height: 22, rx: 8, fill: tone("#8C5A3C") }) + tag("path", { d: "M" + (Sh.x0 + 70) + " " + (Sh.base - 148) + " v148 M" + (Sh.x0 + 310) + " " + (Sh.base - 148) + " v148", stroke: tone("#4B5563"), "stroke-width": 8 });
    s += tag("path", { d: "M" + (Sh.x0 + 6) + " " + (Sh.base - 516) + " V" + Sh.base + " M" + (Sh.x1 - 6) + " " + (Sh.base - 516) + " V" + Sh.base, stroke: tone("#2F3E4C"), "stroke-width": 10 });
    s += tag("path", { d: "M" + (Sh.x0 - 90) + " " + Sh.base + " V" + (Sh.base - 640), stroke: tone("#4B5563"), "stroke-width": 10 }) + tag("circle", { cx: Sh.x0 - 90, cy: Sh.base - 680, r: 52, fill: tone("#1C7ED6"), stroke: tone("#FFFFFF"), "stroke-width": 8 }) +
      tag("rect", { x: Sh.x0 - 116, y: Sh.base - 704, width: 52, height: 40, rx: 8, fill: tone("#FFFFFF") });
    // traffic light on the near curb by the crossing
    var TL = G.light;
    s += tag("path", { d: "M" + TL.x + " " + TL.base + " V" + (TL.base - 820), stroke: tone("#3A4048"), "stroke-width": 16 });
    s += tag("rect", { x: TL.x - 46, y: TL.base - 1060, width: 92, height: 250, rx: 18, fill: tone("#232A31"), stroke: tone("#111"), "stroke-width": 4 });
    s += tag("g", { "data-part": "signal" }, [0, 1, 2].map(function (k) { return tag("circle", { cx: TL.x, cy: TL.base - 1020 + k * 80, r: 30, fill: "#333", "data-lamp": k }); }).join(""));
    // street lamps
    G.lamps.forEach(function (lx) {
      var base = 1600, top = base - 1060;
      s += tag("path", { d: "M" + lx + " " + base + " V" + top + " q0 -60 60 -60 h80", stroke: tone("#2F3A44"), "stroke-width": 18, fill: "none", "stroke-linecap": "round" });
      s += tag("rect", { x: lx - 30, y: base - 30, width: 60, height: 40, rx: 8, fill: tone("#2F3A44") });
      s += tag("path", { d: "M" + (lx + 110) + " " + (top - 60) + " h70 l-14 40 h-42 Z", fill: tone("#2F3A44") }) + tag("ellipse", { cx: lx + 145, cy: top - 18, rx: 26, ry: 8, fill: night ? "#FFF3C4" : tone("#E9ECEF") });
      if (night) s += tag("path", { d: "M" + (lx + 120) + " " + (top - 18) + " L" + (lx - 140) + " " + base + " L" + (lx + 430) + " " + base + " L" + (lx + 170) + " " + (top - 18) + " Z", fill: "#FFE3A0", opacity: 0.12 }) +
        tag("ellipse", { cx: lx + 145, cy: base + 40, rx: 360, ry: 90, fill: "url(#" + P + "-pool)" }) + tag("circle", { cx: lx + 145, cy: top - 18, r: 70, fill: "url(#" + P + "-pool)" });
    });
    // lighter and darker slabs here and there
    for (var sl = 0; sl < 26; sl++) { var sx = -200 + R() * 4200, sy = [1610, 1700, 1810, 1950][(R() * 4) | 0]; s += tag("rect", { x: r2(sx), y: sy + 3, width: 180 + R() * 60, height: 80, fill: tone(sl % 2 ? "#E4DED2" : "#B3AB9C"), opacity: 0.2 }); }
    // tactile paving at the crossing
    s += tag("rect", { x: G.zebra[0] - 20, y: G.nearCurb + 34, width: G.zebra[1] - G.zebra[0] + 40, height: 54, fill: tone("#E8B23A"), opacity: 0.85 });
    for (var tx = G.zebra[0]; tx < G.zebra[1] + 20; tx += 26) s += tag("circle", { cx: tx, cy: G.nearCurb + 60, r: 6, fill: tone("#C48A1C") });
    // along the back of the near sidewalk (behind the actors): a tree in a grate, a bin, a mailbox, a bench, a bike at a rack
    var tr = tag("ellipse", { cx: 1080, cy: 1606, rx: 120, ry: 22, fill: tone("#5A4A3A") }) + tag("path", { d: "M990 1606 h180 M1010 1596 h140 M1010 1616 h140", stroke: tone("#3A3028"), "stroke-width": 4 });
    tr += tag("path", { d: "M1066 1606 C1070 1400 1060 1250 1040 1120 M1080 1606 C1084 1420 1100 1300 1130 1180", stroke: tone("#6B4A2F"), "stroke-width": 26, fill: "none", "stroke-linecap": "round" });
    [[1030, 1040, 150], [1150, 1080, 130], [1090, 960, 140], [960, 1120, 100], [1210, 1150, 90]].forEach(function (c, i) {
      tr += tag("circle", { cx: c[0], cy: c[1], r: c[2], fill: tone(i % 2 ? "#3E8E41" : "#4FA54A"), stroke: tone("#2B6A2E"), "stroke-width": 4 });
    });
    tr += tag("circle", { cx: 1120, cy: 950, r: 70, fill: tone("#7CC25A"), opacity: 0.8 }) + tag("circle", { cx: 990, cy: 1090, r: 60, fill: tone("#2B6A2E"), opacity: 0.45 });
    s += tag("g", { transform: "translate(-920 0)" }, tr); // at the left edge, clear of the anchors' columns
    s += tag("path", { d: "M1300 1640 l10 -150 h90 l10 150 Z", fill: tone("#2B8A3E"), stroke: tone("#1B5E2A"), "stroke-width": 5 }) + tag("rect", { x: 1300, y: 1478, width: 120, height: 18, rx: 6, fill: tone("#1B5E2A") });
    s += tag("rect", { x: 1560, y: 1440, width: 110, height: 170, rx: 50, fill: tone("#C92A2A"), stroke: tone("#7A1A1A"), "stroke-width": 5 }) + tag("rect", { x: 1585, y: 1490, width: 60, height: 10, rx: 4, fill: tone("#4A1010") }) + tag("rect", { x: 1590, y: 1610, width: 50, height: 30, fill: tone("#7A1A1A") });
    var bx = 2640;
    s += tag("path", { d: "M" + (bx - 150) + " 1640 v-70 M" + (bx + 150) + " 1640 v-70", stroke: tone("#3A4048"), "stroke-width": 12 }) + tag("rect", { x: bx - 180, y: 1550, width: 360, height: 26, rx: 8, fill: tone("#A0522D") }) +
      tag("rect", { x: bx - 180, y: 1500, width: 360, height: 22, rx: 8, fill: tone("#A0522D") }) + tag("rect", { x: bx - 180, y: 1460, width: 360, height: 22, rx: 8, fill: tone("#A0522D") }) + tag("path", { d: "M" + (bx - 160) + " 1450 v110 M" + (bx + 160) + " 1450 v110", stroke: tone("#3A4048"), "stroke-width": 10 });
    var bk = 3480, wh = function (x) { return tag("circle", { cx: x, cy: 1560, r: 62, fill: "none", stroke: tone("#2B2B2B"), "stroke-width": 10 }) + tag("circle", { cx: x, cy: 1560, r: 8, fill: tone("#2B2B2B") }); };
    s += tag("path", { d: "M" + (bk - 160) + " 1630 v-130 a50 50 0 0 1 100 0 v130", stroke: tone("#868E96"), "stroke-width": 12, fill: "none" });
    s += wh(bk - 90) + wh(bk + 90) + tag("path", { d: "M" + (bk - 90) + " 1560 L" + (bk - 20) + " 1470 L" + (bk + 60) + " 1470 L" + (bk + 90) + " 1560 M" + (bk - 20) + " 1470 L" + bk + " 1560 L" + (bk + 60) + " 1470 M" + (bk - 30) + " 1450 h40 M" + (bk + 50) + " 1470 l10 -40 h30", stroke: tone("#1C7ED6"), "stroke-width": 10, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round" });
    s += tag("g", { "data-part": "pigeons" }, "");
    return { defs: defs, body: s };
  }

  function drawFront(P, v, L, R) {
    var tone = L.tone, s = "";
    // a planter of flowers, bottom left; a newspaper box and a bike rack, bottom right
    s += tag("rect", { x: -120, y: 1980, width: 520, height: 220, rx: 14, fill: tone("#8C6A4A"), stroke: tone("#5A4128"), "stroke-width": 6 });
    for (var i = 0; i < 22; i++) {
      var x = -90 + R() * 470, h = 80 + R() * 120;
      s += tag("path", { d: "M" + r2(x) + " 1990 q" + r2((R() - 0.5) * 40) + " " + r2(-h * 0.6) + " " + r2((R() - 0.5) * 50) + " " + r2(-h), stroke: tone("#2F9E44"), "stroke-width": 8, fill: "none", "stroke-linecap": "round" });
      if (i % 2 === 0) s += tag("circle", { cx: r2(x + (R() - 0.5) * 30), cy: r2(1990 - h), r: 18, fill: tone(["#F06595", "#FFD43B", "#FF8787", "#B197FC", "#FFFFFF"][i % 5]) });
    }
    s += tag("rect", { x: 3640, y: 1840, width: 220, height: 300, rx: 12, fill: tone("#1971C2"), stroke: tone("#0B3C6B"), "stroke-width": 6 }) + tag("rect", { x: 3670, y: 1880, width: 160, height: 90, rx: 6, fill: tone("#D0EBFF") });
    s += tag("path", { d: "M3920 2160 V1980 a60 60 0 0 1 120 0 V2160 M4040 2160 V1980", stroke: tone("#868E96"), "stroke-width": 14, fill: "none" });
    s += tag("g", { "data-part": "motes" }, "");
    return { defs: "", body: s };
  }

  // ---- animated parts -----------------------------------------------------------------------
  function carMarkup(c, night, tone, P) {
    var body = tone(c.body), dark = D.shade(body, 0.35), glass = night ? "#2A3558" : tone("#BFDCEB");
    var s = tag("ellipse", { cx: 0, cy: 6, rx: 470, ry: 26, fill: "#000", opacity: 0.25 });
    s += tag("path", { d: "M-440 -40 Q-450 -150 -360 -160 L-250 -170 Q-180 -300 -40 -300 L140 -300 Q240 -300 300 -180 L400 -160 Q460 -150 450 -40 Z", fill: body, stroke: dark, "stroke-width": 6, "stroke-linejoin": "round" });
    s += tag("path", { d: "M-210 -175 Q-150 -270 -40 -272 L60 -272 L60 -175 Z M90 -175 L90 -272 L140 -272 Q220 -270 270 -175 Z", fill: glass, stroke: dark, "stroke-width": 5 });
    if (!night) s += tag("path", { d: "M-150 -190 L-90 -260 M100 -190 L140 -260", stroke: "#FFFFFF", "stroke-width": 10, opacity: 0.4 });
    s += tag("path", { d: "M-440 -90 H450", stroke: D.tint(body, 0.25), "stroke-width": 6, opacity: 0.7 }) + tag("rect", { x: 20, y: -140, width: 46, height: 10, rx: 4, fill: dark });
    s += tag("rect", { x: 420, y: -120, width: 34, height: 26, rx: 8, fill: night ? "#FFF3C4" : "#FFF3C4" }) + tag("rect", { x: -452, y: -120, width: 24, height: 26, rx: 6, fill: "#FF4D4D" });
    if (night) s += tag("path", { d: "M450 -110 L1000 -170 Q1060 -100 1000 -30 Z", fill: "url(#" + P + "-beam)" }) + tag("circle", { cx: -440, cy: -107, r: 50, fill: "#FF4D4D", opacity: 0.25 });
    [-260, 270].forEach(function (wx) {
      s += tag("circle", { cx: wx, cy: -30, r: 70, fill: "#1E1E24" }) + tag("circle", { cx: wx, cy: -30, r: 36, fill: tone("#ADB5BD") }) +
        tag("g", { "data-wheel": 1, transform: "translate(" + wx + " -30)" }, tag("path", { d: "M-30 0 H30 M0 -30 V30", stroke: tone("#495057"), "stroke-width": 8 }));
    });
    return s;
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place city-street: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-city-street";
    var seed = opts.seed === undefined ? 9 : opts.seed | 0;
    var L = LOOK[v], night = v === "night";
    var parts = {
      sky: drawSky(P, v, L, D.rng(seed + 1)), far: drawFar(P, v, L, D.rng(seed + 2)), mid: drawMid(P, v, L, D.rng(seed + 3)),
      ground: drawGround(P, v, L, D.rng(seed + 4)), front: drawFront(P, v, L, D.rng(seed + 5)),
    };
    var g = {};
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(layers[name], "city-street-" + name, parts[name].defs, parts[name].body); });
    var clouds = [].slice.call(g.sky.querySelectorAll("[data-cloud]")).map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    var stars = [].slice.call(g.sky.querySelectorAll("[data-star]")), starOp = stars.map(function (e) { return +e.getAttribute("opacity"); });
    var cars = CARS.map(function (c) {
      var holder = g.ground.querySelector('[data-part="cars-' + c.lane + '"]'), e = D.el(holder, "g", {});
      e.innerHTML = carMarkup(c, night, L.tone, P);
      return { c: c, e: e, wheels: [].slice.call(e.querySelectorAll("[data-wheel]")).map(function (w) { return { w: w, base: w.getAttribute("transform") }; }) };
    });
    var lamps = [].slice.call(g.ground.querySelectorAll("[data-lamp]"));
    var steamG = g.ground.querySelector('[data-part="steam"]'), steam = D.presets.smoke(seed + 7, 7);
    var steamEls = steam.list.map(function () { return D.el(steamG, "circle", { fill: night ? "#9AA6C8" : "#F1F3F5", opacity: 0 }); });
    var pigG = g.ground.querySelector('[data-part="pigeons"]'), pigeons = [[1620, 1800, 1], [1760, 1830, -1], [1700, 1760, 1]].map(function (q, i) {
      var e = D.el(pigG, "g", {});
      var body = L.tone("#8E95A3"), dark = D.shade(body, 0.35);
      e.innerHTML = tag("ellipse", { cx: 0, cy: 6, rx: 34, ry: 8, fill: "#000", opacity: 0.2 }) + tag("ellipse", { cx: 0, cy: -24, rx: 36, ry: 24, fill: body, stroke: dark, "stroke-width": 3 }) +
        tag("path", { d: "M-30 -30 L-58 -40 L-50 -20 Z", fill: dark }) + tag("g", { "data-head": 1 }, tag("circle", { cx: 30, cy: -46, r: 14, fill: L.tone("#6C7484"), stroke: dark, "stroke-width": 3 }) + tag("circle", { cx: 34, cy: -48, r: 3, fill: "#111" }) + tag("path", { d: "M42 -44 l12 4 l-12 3 Z", fill: L.tone("#E8A33C") })) +
        tag("path", { d: "M-6 0 v8 M8 0 v8", stroke: L.tone("#E8A33C"), "stroke-width": 4 });
      return { e: e, q: q, head: e.querySelector("[data-head]"), k: i };
    });
    var moteG = g.front.querySelector('[data-part="motes"]'), MR = D.rng(seed + 21), motes = [];
    for (var i = 0; i < 14; i++) motes.push({ x: 200 + MR() * 3500, y: 700 + MR() * 1000, s: (MR() * 100) | 0, e: D.el(moteG, "circle", { r: night ? 5 : 4, fill: night ? "#FFE3A0" : "#FFF6D8", opacity: 0 }) });
    var MOTE_SPAN = [100, 3800];

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      clouds.forEach(function (c, i) { var x0 = CLOUDS[i][0], x = A.wrap(x0 + t * (7 + i * 1.6), CLOUD_SPAN[0], CLOUD_SPAN[1]); c.e.setAttribute("transform", "translate(" + r2(x - x0) + " 0) " + c.base); });
      stars.forEach(function (e, i) { if (i % 4 === 0) e.setAttribute("opacity", r2(starOp[i] * (0.65 + 0.35 * Math.sin(t * 2.1 + i)))); });
      cars.forEach(function (k) {
        var c = k.c, x = A.wrap(c.x0 + c.dir * c.speed * t, CAR_SPAN[0], CAR_SPAN[1]), y = c.lane === "far" ? G.laneFar : G.laneNear;
        k.e.setAttribute("transform", "translate(" + r2(x) + " " + y + ") scale(" + (c.dir * c.scale) + " " + c.scale + ")");
        var rot = r2((c.speed * t / (70 * c.scale)) * 57.3 % 360);
        k.wheels.forEach(function (w) { w.w.setAttribute("transform", w.base + " rotate(" + rot + ")"); });
      });
      // traffic light: green 6 s, amber 1.5 s, red 4.5 s
      var ph = A.wrap(t + 2, 0, 12), on = ph < 6 ? 2 : ph < 7.5 ? 1 : 0, cols = ["#FF4D4D", "#FFB020", "#3DDC84"];
      lamps.forEach(function (e, k) { e.setAttribute("fill", k === on ? cols[k] : "#3A3F45"); });
      steam.at(t).forEach(function (p, j) {
        var e = steamEls[j];
        e.setAttribute("cx", r2(1500 + p.x * 0.8 + D.wobble(t, j, 0.5) * 12));
        e.setAttribute("cy", r2(1430 + p.y * 1.6));
        e.setAttribute("r", r2(p.r * (0.6 + p.u)));
        e.setAttribute("opacity", r2(p.alive ? 0.5 * Math.sin(Math.PI * p.u) : 0));
      });
      pigeons.forEach(function (pg) {
        var peck = Math.max(0, Math.sin(t * 3.1 + pg.k * 2)), hop = Math.max(0, Math.sin(t * 0.9 + pg.k)) > 0.97 ? 8 : 0;
        pg.e.setAttribute("transform", "translate(" + r2(pg.q[0] + Math.sin(t * 0.4 + pg.k) * 30) + " " + r2(pg.q[1] - hop) + ") scale(" + pg.q[2] + " 1)");
        pg.head.setAttribute("transform", "translate(" + r2(peck * 8) + " " + r2(peck * 20) + ")");
      });
      motes.forEach(function (m) {
        var w = D.wobble(t, m.s, 0.4), mx = A.wrap(m.x + t * 5, MOTE_SPAN[0], MOTE_SPAN[1]);
        m.e.setAttribute("cx", r2(mx + w * 40));
        m.e.setAttribute("cy", r2(m.y + D.wobble(t, m.s + 9, 0.3) * 40));
        m.e.setAttribute("opacity", r2(A.wrapFade(mx, MOTE_SPAN[0], MOTE_SPAN[1], 160) * (0.25 + 0.25 * w)));
      });
    }
    var a = anchorsFor(opts);
    update(0, PL.REF);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places["city-street"] = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
