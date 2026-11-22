/* Place "ocean": the sea in two views.
 *   surface     the sea from beside a sailing boat, cut away below the waterline: sky, gulls, a
 *               lighthouse on a rocky islet, rolling waves on top; underneath, the water column
 *               darkening with depth, sun rays, fish, a turtle, kelp and a coral reef on the sand.
 *   underwater  down among the reef: the bright, rippling underside of the surface with the boat's
 *               hull above, light shafts, kelp swaying, a big coral reef with an anemone and its
 *               clownfish, a sunken anchor, a jellyfish, a school of fish and a turtle.
 * Anchors (ground-layer world px, 3840 x 2160 world; the same names in both views):
 *   surface  a point on the water surface (the waterline)
 *   boat     the boat at the surface (its deck, or its hull seen from below)
 *   deep     open water in mid depth (a diver, a fish, a sound travelling through water)
 *   reef     on top of the coral reef
 *   seabed   the sand on the sea floor
 * Path: current (a swim line through the open water, left to right).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("ocean/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "ocean",
    description: "The sea: a sailing boat on rolling waves cut away to the reef below (surface), or down among the coral, kelp and fish (underwater).",
    variants: ["surface", "underwater"],
    anchors: ["surface", "boat", "deep", "reef", "seabed"],
    paths: ["current"],
    actorScale: 1,
    actorLight: {
      surface: { tint: "#FFF3DE", amount: 0.1, rim: "#FFF6DA", rimSide: 1 },
      underwater: { tint: "#3FA4D0", amount: 0.42, rim: "#C8F6FF", rimSide: 1 }, // blue water, light from above
    },
  };

  var GEO = {
    surface: { water: 1110, bed: 1990, boat: 1650, reef: [2560, 3560], deep: 1560, current: 1500 },
    underwater: { water: 300, bed: 1830, boat: 1650, reef: [2380, 3600], deep: 980, current: 1000 },
  };
  function wave(x, t, G) { return Math.sin(x / 210 - t * 1.3) * 12 + Math.sin(x / 97 + t * 0.9) * 5; }
  function bedY(x, G) { return G.bed + Math.sin(x / 520) * 34 + Math.sin(x / 190 + 1) * 12; }

  function anchorsFor(opts) {
    var v = PL.variantOf(meta, opts), G = GEO[v];
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    var cur = [];
    for (var x = 160; x <= 3680; x += 352) cur.push({ x: x, y: r2(G.current + Math.sin(x / 600) * 60) });
    var rx = (G.reef[0] + G.reef[1]) / 2;
    return {
      anchors: {
        surface: fixed(2300, G.water),
        boat: v === "surface" ? fixed(G.boat, G.water - 30) : fixed(G.boat, G.water - 6),
        deep: fixed(1480, G.deep),
        reef: fixed(rx, v === "surface" ? G.bed - 250 : G.bed - 380),
        seabed: fixed(1900, r2(bedY(1900, G))),
      },
      paths: { current: cur },
    };
  }

  // ---- shared sea life -----------------------------------------------------------------------
  function fishMarkup(c, sz) {
    var line = D.shade(c, 0.45);
    return tag("ellipse", { rx: 40 * sz, ry: 20 * sz, fill: c, stroke: line, "stroke-width": 4 }) + tag("path", { d: "M" + r2(34 * sz) + " 0 L" + r2(64 * sz) + " " + r2(-20 * sz) + " L" + r2(64 * sz) + " " + r2(20 * sz) + " Z", fill: c, stroke: line, "stroke-width": 4, "stroke-linejoin": "round" }) +
      tag("path", { d: "M" + r2(-6 * sz) + " " + r2(-18 * sz) + " Q" + r2(8 * sz) + " " + r2(-32 * sz) + " " + r2(18 * sz) + " " + r2(-16 * sz), fill: D.shade(c, 0.15), stroke: line, "stroke-width": 3 }) +
      tag("path", { d: "M" + r2(-10 * sz) + " " + r2(-16 * sz) + " v" + r2(32 * sz), stroke: D.tint(c, 0.4), "stroke-width": 5 * sz, opacity: 0.7 }) +
      tag("circle", { cx: r2(-22 * sz), cy: r2(-4 * sz), r: r2(6 * sz), fill: "#fff" }) + tag("circle", { cx: r2(-23 * sz), cy: r2(-4 * sz), r: r2(3 * sz), fill: "#111" });
  }
  function turtleMarkup(tone) {
    var sh = tone("#6B8E3A"), sd = tone("#3E5A22"), sk = tone("#9CC36A");
    return tag("ellipse", { cx: -40, cy: 30, rx: 50, ry: 18, fill: sk, stroke: sd, "stroke-width": 4, transform: "rotate(30 -40 30)" }) + tag("ellipse", { cx: 60, cy: 34, rx: 46, ry: 16, fill: sk, stroke: sd, "stroke-width": 4, transform: "rotate(-30 60 34)" }) +
      tag("ellipse", { cx: 0, cy: 0, rx: 110, ry: 62, fill: sh, stroke: sd, "stroke-width": 5 }) + tag("path", { d: "M-60 -20 L-20 -40 L20 -40 L60 -20 L40 20 L0 30 L-40 20 Z", fill: "none", stroke: sd, "stroke-width": 4 }) +
      tag("ellipse", { cx: -130, cy: -6, rx: 34, ry: 26, fill: sk, stroke: sd, "stroke-width": 4 }) + tag("circle", { cx: -142, cy: -12, r: 5, fill: "#111" }) +
      tag("ellipse", { cx: -50, cy: -50, rx: 60, ry: 18, fill: sk, stroke: sd, "stroke-width": 4, transform: "rotate(-25 -50 -50)", "data-flip": 1 });
  }
  function coral(x, y, s, c, tone, R) { // a branching coral
    var out = "", cc = tone(c), cd = D.shade(cc, 0.3);
    var br = function (x0, y0, a, len, w, d) {
      var x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      out += tag("path", { d: "M" + r2(x0) + " " + r2(y0) + " L" + r2(x1) + " " + r2(y1), stroke: cc, "stroke-width": r2(w), "stroke-linecap": "round" });
      if (d > 0) { br(x1, y1, a - 0.45 - R() * 0.2, len * 0.72, w * 0.72, d - 1); br(x1, y1, a + 0.4 + R() * 0.2, len * 0.7, w * 0.72, d - 1); }
      else out += tag("circle", { cx: r2(x1), cy: r2(y1), r: r2(w * 0.7), fill: D.tint(cc, 0.3) });
    };
    br(x, y, -Math.PI / 2, 90 * s, 34 * s, 3);
    return tag("g", {}, tag("path", { d: "M" + r2(x - 30 * s) + " " + r2(y) + " h" + r2(60 * s), stroke: cd, "stroke-width": r2(24 * s), "stroke-linecap": "round" }) + out);
  }
  function brain(x, y, r, tone) {
    var c = tone("#F2A65A"), cd = D.shade(c, 0.3);
    return tag("path", { d: "M" + (x - r) + " " + y + " a" + r + " " + (r * 0.75) + " 0 0 1 " + (2 * r) + " 0 Z", fill: c, stroke: cd, "stroke-width": 5 }) +
      tag("path", { d: "M" + (x - r * 0.7) + " " + (y - r * 0.2) + " q" + r2(r * 0.2) + " " + r2(-r * 0.3) + " " + r2(r * 0.4) + " 0 t" + r2(r * 0.4) + " 0 t" + r2(r * 0.4) + " 0 M" + (x - r * 0.5) + " " + (y - r * 0.45) + " q" + r2(r * 0.25) + " " + r2(-r * 0.25) + " " + r2(r * 0.5) + " 0 t" + r2(r * 0.5) + " 0", stroke: cd, "stroke-width": 5, fill: "none" });
  }
  function fan(x, y, s, tone) {
    var c = tone("#B565C9"), out = "";
    for (var k = 0; k < 9; k++) { var a = (-150 + k * 15) * Math.PI / 180; out += tag("path", { d: "M" + x + " " + y + " q" + r2(Math.cos(a) * 60 * s) + " " + r2(Math.sin(a) * 90 * s) + " " + r2(Math.cos(a) * 160 * s) + " " + r2(Math.sin(a) * 200 * s), stroke: c, "stroke-width": 7, fill: "none", "stroke-linecap": "round" }); }
    return out + tag("path", { d: "M" + r2(x - 120 * s) + " " + r2(y - 120 * s) + " Q" + x + " " + r2(y - 260 * s) + " " + r2(x + 120 * s) + " " + r2(y - 120 * s), stroke: c, "stroke-width": 5, fill: "none", opacity: 0.7 });
  }
  function kelp(x, y, h, tone, k) { return tag("path", { "data-kelp": k, d: "M" + x + " " + y + " C" + (x - 40) + " " + (y - h * 0.3) + " " + (x + 40) + " " + (y - h * 0.6) + " " + x + " " + (y - h), stroke: tone(k % 2 ? "#3E8E41" : "#5A9E3A"), "stroke-width": 22, fill: "none", "stroke-linecap": "round" }); }
  function starfish(x, y, r, c) {
    var p = "";
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; p += (i ? " L" : "M") + r2(x + Math.cos(a) * rr) + " " + r2(y + Math.sin(a) * rr * 0.6); }
    return tag("path", { d: p + " Z", fill: c, stroke: D.shade(c, 0.35), "stroke-width": 4, "stroke-linejoin": "round" });
  }
  function rockPile(x, y, w, tone) { return tag("path", { d: "M" + (x - w) + " " + y + " Q" + (x - w * 0.9) + " " + (y - w * 0.6) + " " + (x - w * 0.3) + " " + (y - w * 0.7) + " Q" + (x + w * 0.2) + " " + (y - w * 0.95) + " " + (x + w * 0.7) + " " + (y - w * 0.5) + " Q" + (x + w) + " " + (y - w * 0.3) + " " + (x + w) + " " + y + " Z", fill: tone("#5E6E7E"), stroke: tone("#3A4654"), "stroke-width": 5 }); }

  /* The reef (both views): rocks, brain coral, branching and fan corals, an anemone with clownfish. */
  function reef(G, tone, R, big) {
    var x0 = G.reef[0], x1 = G.reef[1], s = "", sc = big ? 1.5 : 1;
    for (var k = 0; k < 7; k++) { var x = x0 + (x1 - x0) * (k + 0.5) / 7; s += rockPile(x, bedY(x, G) + 10, (110 + R() * 70) * sc, tone); }
    var top = function (x) { return bedY(x, G) - 80 * sc; };
    s += brain(x0 + 160 * sc, top(x0 + 160) + 30, 90 * sc, tone) + brain(x1 - 200 * sc, top(x1 - 200) + 40, 110 * sc, tone);
    [["#FF6B6B", 0.18], ["#FFA94D", 0.32], ["#F783AC", 0.5], ["#FF8787", 0.68], ["#FFD43B", 0.84]].forEach(function (q, i) { s += coral(x0 + (x1 - x0) * q[1], top(x0 + (x1 - x0) * q[1]), (0.9 + R() * 0.5) * sc, q[0], tone, R); });
    s += fan(x0 + (x1 - x0) * 0.42, top(x0 + (x1 - x0) * 0.42), 1.2 * sc, tone) + fan(x0 + (x1 - x0) * 0.92, top(x0 + (x1 - x0) * 0.92), 1 * sc, tone);
    // anemone
    var ax = x0 + (x1 - x0) * 0.6, ay = top(ax) + 20;
    for (var t = 0; t < 14; t++) { var a = (-170 + t * 12) * Math.PI / 180; s += tag("path", { d: "M" + r2(ax) + " " + r2(ay) + " q" + r2(Math.cos(a) * 40 * sc) + " " + r2(Math.sin(a) * 70 * sc) + " " + r2(Math.cos(a) * 80 * sc) + " " + r2(Math.sin(a) * 110 * sc), stroke: tone(t % 2 ? "#E599F7" : "#CC5DE8"), "stroke-width": 14 * sc, fill: "none", "stroke-linecap": "round" }); }
    s += starfish(x0 + 80, bedY(x0 + 80, G) - 10, 40 * sc, tone("#FF922B")) + starfish(x1 + 120, bedY(x1 + 120, G) - 6, 34 * sc, tone("#F06595"));
    return { body: s, anemone: { x: ax, y: ay - 90 * sc } };
  }

  // ---- surface view -------------------------------------------------------------------------
  var SKY = [[0, "#3F93D6"], [0.5, "#8FCBF0"], [0.85, "#D4EEF6"], [1, "#FFF0D0"]];
  function surfaceLayers(P, R, tone) {
    var G = GEO.surface, out = {};
    var pal = { cloud: "#FFFFFF", cloudShade: "#D3E5F3", cloudLight: "#FFFDF4" };
    out.sky = { defs: S.lin(P + "-sky", SKY) + S.rad(P + "-sun", [[0, "#FFF6D0", 1], [0.2, "#FFE08A", 0.8], [1, "#FFE08A", 0]]),
      body: tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: "#FFF0D0" }) + tag("rect", { x: -2600, y: -1600, width: 9040, height: 1900, fill: SKY[0][1] }) +
        tag("rect", { x: -2600, y: 300, width: 9040, height: 800, fill: "url(#" + P + "-sky)" }) + tag("circle", { cx: 2900, cy: 640, r: 480, fill: "url(#" + P + "-sun)" }) + tag("circle", { cx: 2900, cy: 640, r: 104, fill: "#FFF6D0" }) +
        tag("g", { "data-part": "clouds" }, A.cloud(700, 560, 0.7, pal, 0) + A.cloud(1600, 450, 0.55, pal, 1) + A.cloud(2300, 700, 0.6, pal, 2) + A.cloud(3500, 520, 0.7, pal, 3)) };
    // the far sea to the horizon, a distant island and a ship
    out.far = { defs: S.lin(P + "-farsea", [[0, "#5FB0DA"], [1, "#2E86C1"]]),
      body: tag("rect", { x: -1600, y: 1000, width: 7040, height: 1600, fill: "url(#" + P + "-farsea)" }) + tag("path", { d: "M-1600 1000 H5440", stroke: "#CFEFFF", "stroke-width": 6, opacity: 0.8 }) +
        tag("path", { d: smooth([[300, 1002], [480, 940], [640, 960], [820, 1002]], false) + " Z", fill: "#6E9E8A" }) + tag("path", { d: "M1300 990 h120 l-10 12 h-100 Z M1340 990 v-40 l40 40 Z", fill: "#8A99A3" }) +
        [0, 1, 2, 3, 4, 5].map(function (k) { return tag("path", { d: "M" + (k * 700 - 600) + " " + (1030 + k % 3 * 20) + " q40 -8 80 0", stroke: "#CFEFFF", "stroke-width": 4, fill: "none", opacity: 0.6 }); }).join("") };
    // a lighthouse on a rocky islet
    var lx = 3240, ly = 1060;
    out.mid = { defs: "", body: tag("path", { d: "M" + (lx - 360) + " " + (ly + 40) + " Q" + (lx - 300) + " " + (ly - 90) + " " + (lx - 120) + " " + (ly - 110) + " Q" + (lx + 80) + " " + (ly - 140) + " " + (lx + 260) + " " + (ly - 60) + " Q" + (lx + 380) + " " + (ly - 10) + " " + (lx + 420) + " " + (ly + 40) + " Z", fill: tone("#7A7468"), stroke: tone("#4F4A40"), "stroke-width": 5 }) +
      tag("path", { d: "M" + (lx - 200) + " " + (ly - 80) + " q60 -30 140 -20", stroke: tone("#6DAA45"), "stroke-width": 26, "stroke-linecap": "round" }) +
      tag("path", { d: "M" + (lx - 50) + " " + (ly - 110) + " L" + (lx - 34) + " " + (ly - 520) + " L" + (lx + 34) + " " + (ly - 520) + " L" + (lx + 50) + " " + (ly - 110) + " Z", fill: "#FFFFFF", stroke: tone("#5A6470"), "stroke-width": 5 }) +
      [0, 1, 2].map(function (k) { var y0 = ly - 180 - k * 120; return tag("path", { d: "M" + r2(lx - 47 + k * 4) + " " + y0 + " L" + r2(lx + 47 - k * 4) + " " + y0 + " L" + r2(lx + 45 - k * 4) + " " + (y0 - 50) + " L" + r2(lx - 45 + k * 4) + " " + (y0 - 50) + " Z", fill: tone("#E03131") }); }).join("") +
      tag("rect", { x: lx - 46, y: ly - 560, width: 92, height: 40, fill: tone("#3A4651") }) + tag("rect", { x: lx - 36, y: ly - 620, width: 72, height: 60, fill: "#FFF3C4", stroke: tone("#3A4651"), "stroke-width": 5 }) +
      tag("path", { d: "M" + (lx - 50) + " " + (ly - 620) + " L" + lx + " " + (ly - 680) + " L" + (lx + 50) + " " + (ly - 620) + " Z", fill: tone("#E03131"), stroke: tone("#8A1C1C"), "stroke-width": 4 }) +
      tag("g", { "data-part": "gulls" }, "") };
    var defs = S.lin(P + "-water", [[0, "#5FC0E6"], [0.2, "#2C95CC"], [0.6, "#16609E"], [1, "#0B3A6B"]]) + S.lin(P + "-ray", [[0, "#E6FBFF", 0.32], [1, "#E6FBFF", 0]]) +
      S.lin(P + "-sand", [[0, tone("#E9CF98")], [1, tone("#CFAE72")]]) + S.lin(P + "-hull", [[0, "#F4F1EA"], [1, "#C9C3B6"]]);
    var s = tag("rect", { x: -400, y: G.water - 20, width: 4640, height: 2600, fill: "url(#" + P + "-water)" });
    [[300, 260], [900, 200], [1600, 300], [2300, 240], [3100, 280]].forEach(function (q, i) { s += tag("path", { d: "M" + q[0] + " " + G.water + " h" + q[1] + " L" + (q[0] + q[1] - 260) + " " + (G.water + 900) + " L" + (q[0] - 420) + " " + (G.water + 900) + " Z", fill: "url(#" + P + "-ray)", "data-ray": i }); });
    var bed = [];
    for (var x = -400; x <= 4240; x += 80) bed.push([x, bedY(x, G)]);
    s += tag("path", { d: smooth(bed, false) + " L4240 2600 L-400 2600 Z", fill: "url(#" + P + "-sand)" });
    for (var r = 0; r < 60; r++) { var rx = -300 + R() * 4400; s += tag("ellipse", { cx: r2(rx), cy: r2(bedY(rx, G) + 20 + R() * 120), rx: 6 + R() * 10, ry: 3 + R() * 5, fill: tone("#B9955E"), opacity: 0.7 }); }
    for (var k = 0; k < 11; k++) s += kelp(-100 + k * 120 + R() * 60, bedY(-100 + k * 120, G) + 10, 300 + R() * 300, tone, k);
    var rf = reef(G, tone, R, false);
    s += rf.body + tag("g", { "data-part": "clownfish", "data-x": rf.anemone.x, "data-y": rf.anemone.y }, "");
    s += tag("g", { "data-part": "life" }, "") + tag("g", { "data-part": "bubbles" }, "");
    // the surface: a dark band of wave tops, animated line, foam
    s += tag("path", { "data-part": "surface", fill: "#7FD3F5" }) + tag("path", { "data-part": "foam", fill: "none", stroke: "#FFFFFF", "stroke-width": 7, "stroke-linecap": "round", opacity: 0.85 });
    s += tag("g", { "data-part": "boat" }, boatMarkup(P, tone));
    out.ground = { defs: defs, body: s };
    out.front = { defs: "", body: kelpFront(tone, R) + tag("g", { "data-part": "motes" }, "") };
    return out;
  }
  function boatMarkup(P, tone) {
    // a small sailing boat, origin at the waterline under the mast
    var s = tag("path", { d: "M-420 -40 L420 -40 Q380 60 260 90 L-300 90 Q-400 50 -420 -40 Z", fill: "url(#" + P + "-hull)", stroke: tone("#3A4651"), "stroke-width": 6 });
    s += tag("path", { d: "M-400 0 L405 0", stroke: tone("#1C7ED6"), "stroke-width": 18 }) + tag("rect", { x: -300, y: -100, width: 280, height: 60, rx: 10, fill: tone("#E9DCC5"), stroke: tone("#8C6A4A"), "stroke-width": 5 }) + tag("circle", { cx: -220, cy: -70, r: 12, fill: tone("#7FC8F0") }) + tag("circle", { cx: -150, cy: -70, r: 12, fill: tone("#7FC8F0") });
    s += tag("path", { d: "M0 -40 V-820", stroke: tone("#8C6A4A"), "stroke-width": 14 }) + tag("path", { d: "M8 -800 Q260 -520 330 -70 L8 -70 Z", fill: "#FFFFFF", stroke: tone("#5A6470"), "stroke-width": 5 }) +
      tag("path", { d: "M-8 -760 Q-200 -480 -300 -110 L-8 -110 Z", fill: tone("#FFE8CC"), stroke: tone("#5A6470"), "stroke-width": 5 }) + tag("path", { d: "M0 -820 l70 20 l-70 20 Z", fill: tone("#E03131") });
    s += tag("path", { d: "M60 -300 Q150 -280 190 -230 M70 -500 Q140 -480 180 -440", stroke: tone("#D8D4CA"), "stroke-width": 4, fill: "none" });
    return s;
  }
  function kelpFront(tone, R) {
    var s = "";
    for (var k = 0; k < 6; k++) { var x = k < 3 ? -60 + k * 110 : 3600 + (k - 3) * 120; s += tag("path", { d: "M" + x + " 2300 C" + (x - 60) + " 2050 " + (x + 70) + " 1850 " + (x + 10) + " " + (1600 + R() * 120), stroke: tone(k % 2 ? "#2E7A3A" : "#3E8E41"), "stroke-width": 34, fill: "none", "stroke-linecap": "round" }); }
    s += tag("path", { d: "M3420 2300 Q3500 2100 3640 2140 Q3760 2160 3840 2300 Z", fill: tone("#5E6E7E"), stroke: tone("#3A4654"), "stroke-width": 6 });
    return s;
  }

  // ---- underwater view ----------------------------------------------------------------------
  function underwaterLayers(P, R, tone) {
    var G = GEO.underwater, out = {};
    out.sky = { defs: S.lin(P + "-deep", [[0, "#7FD8F2"], [0.25, "#2FA0D2"], [0.65, "#126BA6"], [1, "#0A3C6E"]]) + S.rad(P + "-sunu", [[0, "#F2FEFF", 0.9], [1, "#F2FEFF", 0]]),
      body: tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: "#0A3C6E" }) + tag("rect", { x: -2600, y: -1600, width: 9040, height: 1900, fill: "#7FD8F2" }) +
        tag("rect", { x: -2600, y: 300, width: 9040, height: 1400, fill: "url(#" + P + "-deep)" }) + tag("ellipse", { cx: 2100, cy: 360, rx: 900, ry: 300, fill: "url(#" + P + "-sunu)" }) };
    var far = "";
    for (var i = 0; i < 18; i++) { var x = -1200 + i * 380 + R() * 100, h = 200 + R() * 260; far += tag("path", { d: "M" + r2(x - 220) + " 1500 Q" + r2(x - 140) + " " + r2(1500 - h) + " " + r2(x) + " " + r2(1500 - h * 1.1) + " Q" + r2(x + 160) + " " + r2(1500 - h) + " " + r2(x + 240) + " 1500 Z", fill: i % 2 ? "#1A6A9A" : "#1F75A6", opacity: 0.85 }); }
    out.far = { defs: "", body: tag("rect", { x: -1600, y: 1460, width: 7040, height: 1400, fill: "#1A6696" }) + far + tag("g", { "data-part": "school" }, "") };
    var mid = "";
    for (var k = 0; k < 14; k++) mid += tag("path", { d: "M" + (-400 + k * 380) + " 2300 C" + (-460 + k * 380) + " 1800 " + (-320 + k * 380) + " 1400 " + (-380 + k * 380) + " " + (900 + R() * 300), stroke: "#2E8A6A", "stroke-width": 26, fill: "none", "stroke-linecap": "round", opacity: 0.55 });
    out.mid = { defs: "", body: tag("rect", { x: -1400, y: 1640, width: 6640, height: 1000, fill: "#2C7DA8", opacity: 0.6 }) + mid };
    var defs = S.lin(P + "-ray", [[0, "#F2FEFF", 0.38], [1, "#F2FEFF", 0]]) + S.lin(P + "-sand", [[0, tone("#E2CB98")], [1, tone("#C4A672")]]) +
      S.lin(P + "-under", [[0, "#BFF0FF", 0.95], [1, "#7FD8F2", 0.2]]) + S.lin(P + "-fog", [[0, "#0A3C6E", 0], [1, "#0A3C6E", 0.35]]);
    var s = "";
    // the surface seen from below: a bright rippling ceiling, the boat's hull on it
    s += tag("rect", { x: -400, y: -400, width: 4640, height: G.water + 400, fill: "#CFF6FF" });
    for (var cl = 0; cl < 9; cl++) { // sunlight dancing on the underside of the waves
      var cy = -300 + cl * 64, cd = "M-400 " + cy;
      for (var cx = -400; cx < 4240; cx += 160) cd += " q40 " + (cl % 2 ? 26 : -26) + " 80 0 t80 0";
      s += tag("path", { d: cd, stroke: "#FFFFFF", "stroke-width": 6, fill: "none", opacity: 0.35 });
    }
    s += tag("path", { "data-part": "surface", fill: "url(#" + P + "-under)" });
    s += tag("g", { "data-part": "boat" }, tag("path", { d: "M-420 -8 L420 -8 Q380 80 260 110 L-300 110 Q-400 70 -420 -8 Z", fill: "#2C4A60", stroke: "#1A3040", "stroke-width": 6 }) + tag("path", { d: "M-40 110 L-20 200 L20 200 L40 110 Z", fill: "#1A3040" }) + tag("ellipse", { cx: 0, cy: -10, rx: 470, ry: 30, fill: "#FFFFFF", opacity: 0.35 }));
    for (var r = 0; r < 7; r++) s += tag("path", { d: "M" + (200 + r * 560) + " " + (G.water + 20) + " l260 0 l-200 1700 l-360 0 Z", fill: "url(#" + P + "-ray)", "data-ray": r });
    var bed = [];
    for (var bx = -400; bx <= 4240; bx += 80) bed.push([bx, bedY(bx, G)]);
    s += tag("path", { d: smooth(bed, false) + " L4240 2600 L-400 2600 Z", fill: "url(#" + P + "-sand)" });
    for (var sr = 0; sr < 90; sr++) { var sx = -300 + R() * 4400; s += tag("ellipse", { cx: r2(sx), cy: r2(bedY(sx, G) + 20 + R() * 300), rx: 6 + R() * 12, ry: 3 + R() * 5, fill: tone("#B9955E"), opacity: 0.7 }); }
    // sand ripples, kelp forest at the left, rocks, a sunken anchor
    for (var cs = 0; cs < 26; cs++) { var csx = -200 + R() * 4200, csy = bedY(csx, G) + 40 + R() * 220; s += tag("path", { d: "M" + r2(csx) + " " + r2(csy) + " q40 -18 80 0 q30 14 60 -6 q-20 30 -70 22 q-40 -6 -70 -16", stroke: "#F2FEFF", "stroke-width": 4, fill: "none", opacity: 0.4 }); }
    for (var rp = 0; rp < 12; rp++) { var rx = -200 + rp * 360; s += tag("path", { d: "M" + rx + " " + r2(bedY(rx, G) + 110) + " q90 -24 180 0 t180 0", stroke: tone("#C9A86E"), "stroke-width": 6, fill: "none", opacity: 0.7 }); }
    for (var kk = 0; kk < 14; kk++) s += kelp(-60 + kk * 90 + R() * 40, bedY(kk * 90, G) + 20, 700 + R() * 600, tone, kk);
    var ax = 1500, ay = bedY(1500, G) + 30;
    s += tag("g", { transform: "rotate(-18 " + ax + " " + ay + ")" }, tag("path", { d: "M" + ax + " " + (ay - 260) + " V" + ay + " M" + (ax - 120) + " " + (ay - 60) + " Q" + ax + " " + (ay + 60) + " " + (ax + 120) + " " + (ay - 60) + " M" + (ax - 70) + " " + (ay - 200) + " h140", stroke: tone("#5E6870"), "stroke-width": 26, fill: "none", "stroke-linecap": "round" }) +
      tag("circle", { cx: ax, cy: ay - 290, r: 34, fill: "none", stroke: tone("#5E6870"), "stroke-width": 18 }) + tag("path", { d: "M" + (ax - 40) + " " + (ay - 140) + " q30 -20 60 -10", stroke: tone("#6DAA45"), "stroke-width": 14, fill: "none" }));
    s += tag("path", { d: "M" + (ax + 30) + " " + (ay - 320) + " C" + (ax + 300) + " " + (ay - 500) + " " + (ax + 500) + " " + (ay - 200) + " " + (ax + 700) + " " + (ay - 40), stroke: tone("#8C7A5A"), "stroke-width": 10, fill: "none", "stroke-dasharray": "22 10" });
    var rf = reef(G, tone, R, true);
    s += rf.body + tag("g", { "data-part": "clownfish", "data-x": rf.anemone.x, "data-y": rf.anemone.y }, "");
    s += tag("rect", { x: -400, y: 1200, width: 4640, height: 1200, fill: "url(#" + P + "-fog)" });
    s += tag("g", { "data-part": "life" }, "") + tag("g", { "data-part": "bubbles" }, "");
    out.ground = { defs: defs, body: s };
    out.front = { defs: "", body: kelpFront(tone, R) + tag("g", { "data-part": "motes" }, "") };
    return out;
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place ocean: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-ocean";
    var seed = opts.seed === undefined ? 12 : opts.seed | 0;
    var G = GEO[v], under = v === "underwater";
    var tone = under ? function (c) { return D.mix(c, "#2F86B8", 0.22); } : function (c) { return c; };
    var parts = under ? underwaterLayers(P, D.rng(seed + 4), tone) : surfaceLayers(P, D.rng(seed + 4), tone);
    var g = {};
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(layers[name], "ocean-" + name, parts[name].defs, parts[name].body); });
    var surf = g.ground.querySelector('[data-part="surface"]'), foam = g.ground.querySelector('[data-part="foam"]'), boat = g.ground.querySelector('[data-part="boat"]');
    var rays = [].slice.call(g.ground.querySelectorAll("[data-ray]"));
    var kelps = [].slice.call(g.ground.querySelectorAll("[data-kelp]")).concat([].slice.call(g.front.querySelectorAll("[data-kelp]"))).map(function (e) { return { e: e, d: e.getAttribute("d") }; });
    var clouds = [].slice.call(g.sky.querySelectorAll("[data-cloud]")).map(function (e) { return { e: e, base: e.getAttribute("transform"), x0: +/translate\(([-\d.]+)/.exec(e.getAttribute("transform"))[1] }; });
    var lifeG = g.ground.querySelector('[data-part="life"]'), R = D.rng(seed + 9);
    var FISH = under ? [[600, 760, "#FFD43B", 1.2], [900, 1180, "#FF8787", 1], [2000, 820, "#74C0FC", 1.3], [2600, 1180, "#FFA94D", 1.1], [3300, 900, "#B197FC", 1], [1300, 1450, "#63E6BE", 0.9]]
      : [[700, 1420, "#FFD43B", 0.9], [1100, 1700, "#FF8787", 0.8], [2100, 1360, "#74C0FC", 1], [2500, 1650, "#FFA94D", 0.9], [3400, 1480, "#B197FC", 0.8]];
    var fish = FISH.map(function (q, i) { var e = D.el(lifeG, "g", {}); e.innerHTML = fishMarkup(tone(q[2]), q[3]); return { e: e, q: q, k: i }; });
    var turtle = D.el(lifeG, "g", {}); turtle.innerHTML = turtleMarkup(tone);
    var flipper = turtle.querySelector("[data-flip]");
    var jelly = null;
    if (under) {
      jelly = D.el(lifeG, "g", {});
      jelly.innerHTML = tag("path", { d: "M-70 0 Q-70 -90 0 -90 Q70 -90 70 0 Q35 -14 0 0 Q-35 -14 -70 0 Z", fill: "#F3D9FA", opacity: 0.85, stroke: "#CC5DE8", "stroke-width": 4 }) +
        [-44, -20, 6, 30, 52].map(function (x, k) { return tag("path", { "data-tent": k, d: "M" + x + " -4 q12 60 -4 120 q-12 60 6 110", stroke: "#E599F7", "stroke-width": 6, fill: "none", "stroke-linecap": "round", opacity: 0.8 }); }).join("");
    }
    var cfG = g.ground.querySelector('[data-part="clownfish"]'), cfx = +cfG.getAttribute("data-x"), cfy = +cfG.getAttribute("data-y");
    var clowns = [0, 1].map(function (k) {
      var e = D.el(cfG, "g", {});
      e.innerHTML = tag("ellipse", { rx: 34, ry: 18, fill: "#FF8C1A", stroke: "#3A2A1E", "stroke-width": 4 }) + tag("path", { d: "M-8 -16 v32 M14 -14 v28", stroke: "#FFFFFF", "stroke-width": 8 }) + tag("path", { d: "M30 0 L52 -16 L52 16 Z", fill: "#FF8C1A", stroke: "#3A2A1E", "stroke-width": 4 }) + tag("circle", { cx: -20, cy: -4, r: 4, fill: "#111" });
      return e;
    });
    var school = [], schG = g.far.querySelector('[data-part="school"]');
    if (schG) for (var sc = 0; sc < 26; sc++) school.push({ dx: (sc % 7) * 54 + (sc % 2) * 20, dy: Math.floor(sc / 7) * 34 + (sc % 3) * 8, e: D.el(schG, "path", { d: "M0 0 q16 -10 30 0 q-14 10 -30 0 Z M28 0 l12 -8 v16 Z", fill: "#9FD8F0", opacity: 0.8 }) });
    var bubG = g.ground.querySelector('[data-part="bubbles"]'), bubbles = D.presets.bubbles(seed + 11, 14);
    var bubEls = bubbles.list.map(function () { return D.el(bubG, "circle", { r: 6, fill: "none", stroke: "#E6FBFF", "stroke-width": 3, opacity: 0 }); });
    var gullG = g.mid.querySelector('[data-part="gulls"]'), gulls = [];
    if (gullG) for (var gl = 0; gl < 3; gl++) gulls.push({ x: 1800 + gl * 260, y: 520 + gl * 60, k: gl, e: D.el(gullG, "path", { fill: "none", stroke: "#3A4651", "stroke-width": 7, "stroke-linecap": "round" }) });
    var moteG = g.front.querySelector('[data-part="motes"]'), MR = D.rng(seed + 21), motes = [];
    for (var m = 0; m < 22; m++) motes.push({ x: MR() * 3840, y: (under ? 500 : G.water + 100) + MR() * 1300, s: (MR() * 100) | 0, e: D.el(moteG, "circle", { r: 3 + MR() * 3, fill: "#E6FBFF", opacity: 0 }) });
    var SPAN = [-300, 4140];

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      // the waterline
      var pts = [];
      for (var x = -400; x <= 4240; x += 40) pts.push([x, G.water + wave(x, t, G)]);
      if (under) surf.setAttribute("d", "M-400 -400 L" + pts.map(function (q) { return r2(q[0]) + " " + r2(q[1]); }).join(" L") + " L4240 -400 Z");
      else {
        surf.setAttribute("d", "M" + pts.map(function (q) { return r2(q[0]) + " " + r2(q[1] - 18); }).join(" L") + " L4240 " + (G.water + 40) + " L-400 " + (G.water + 40) + " Z");
        foam.setAttribute("d", "M" + pts.map(function (q) { return r2(q[0]) + " " + r2(q[1] - 18); }).join(" L"));
      }
      var bx = G.boat, by = G.water + wave(bx, t, G) - (under ? 0 : 10), tilt = Math.atan2(wave(bx + 200, t, G) - wave(bx - 200, t, G), 400) * 57.3;
      boat.setAttribute("transform", "translate(" + bx + " " + r2(by) + ") rotate(" + r2(tilt * 0.8) + ")");
      rays.forEach(function (e, k) { e.setAttribute("opacity", r2(0.55 + 0.45 * Math.sin(t * 0.7 + k * 1.3))); });
      kelps.forEach(function (k, i) { var sway = Math.sin(t * 0.8 + i * 0.7) * 40; k.e.setAttribute("d", k.d.replace(/C(-?[\d.]+)/, function (m0, a) { return "C" + r2(+a + sway); })); });
      clouds.forEach(function (c, k) { var nx = A.wrap(c.x0 + t * (6 + k * 2), -700, 4500); c.e.setAttribute("transform", "translate(" + r2(nx - c.x0) + " 0) " + c.base); });
      fish.forEach(function (f) {
        var q = f.q, sp = 60 + f.k * 9, dir = f.k % 2 ? -1 : 1, x = A.wrap(q[0] + dir * sp * t, SPAN[0], SPAN[1]);
        f.e.setAttribute("transform", "translate(" + r2(x) + " " + r2(q[1] + Math.sin(t * 1.1 + f.k) * 18) + ") scale(" + (dir > 0 ? -1 : 1) + " 1)");
      });
      var tx = A.wrap(3000 - 50 * t, -400, 4300), ty = (under ? 1250 : 1500) + Math.sin(t * 0.5) * 40;
      turtle.setAttribute("transform", "translate(" + r2(tx) + " " + r2(ty) + ") rotate(" + r2(Math.sin(t * 0.5) * 4) + ")");
      if (flipper) flipper.setAttribute("transform", "rotate(" + r2(-25 + Math.sin(t * 2.2) * 25) + " -50 -50)");
      if (jelly) {
        var pulse = 1 + 0.08 * Math.sin(t * 2.4), jy = 700 - Math.sin(t * 0.6) * 80;
        jelly.setAttribute("transform", "translate(" + r2(3300 + Math.sin(t * 0.3) * 60) + " " + r2(jy) + ") scale(" + r2(1 / pulse) + " " + r2(pulse) + ")");
      }
      clowns.forEach(function (e, k) { var a = t * 1.2 + k * Math.PI; e.setAttribute("transform", "translate(" + r2(cfx + Math.cos(a) * 70) + " " + r2(cfy + Math.sin(a * 2) * 20) + ") scale(" + (Math.sin(a) > 0 ? -1 : 1) + " 1)"); });
      var shx = A.wrap(-400 + t * 70, -600, 4600);
      school.forEach(function (f, k) { f.e.setAttribute("transform", "translate(" + r2(shx + f.dx + Math.sin(t * 2 + k) * 6) + " " + r2(1200 + f.dy + Math.sin(t * 1.4 + k * 0.5) * 10) + ") scale(-1 1)"); });
      bubbles.at(t).forEach(function (p, i) {
        var e = bubEls[i], bx2 = (i % 2 ? cfx : 400 + i * 50);
        e.setAttribute("cx", r2(bx2 + p.x + Math.sin(p.age * 3 + i) * 8));
        e.setAttribute("cy", r2(bedY(bx2, G) - 200 + p.y * 4));
        e.setAttribute("r", r2(p.r * 0.9));
        e.setAttribute("opacity", r2(p.alive ? 0.75 * (1 - p.u) : 0));
      });
      gulls.forEach(function (gl) {
        var flap = Math.sin(t * 6 + gl.k), x = A.wrap(gl.x + t * 50, -400, 4300);
        gl.e.setAttribute("d", "M" + r2(x - 40) + " " + r2(gl.y + flap * 14) + " Q" + r2(x - 18) + " " + r2(gl.y - 16) + " " + r2(x) + " " + gl.y + " Q" + r2(x + 18) + " " + r2(gl.y - 16) + " " + r2(x + 40) + " " + r2(gl.y + flap * 14));
      });
      motes.forEach(function (mt) {
        var lo = mt.y - 500, hi = mt.y + 300, my = A.wrap(mt.y - t * 8, lo, hi);
        mt.e.setAttribute("cx", r2(mt.x + D.wobble(t, mt.s, 0.4) * 40));
        mt.e.setAttribute("cy", r2(my));
        mt.e.setAttribute("opacity", r2(0.35 * A.wrapFade(my, lo, hi, 80)));
      });
    }
    var a = anchorsFor(opts);
    update(0, PL.REF);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places.ocean = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
