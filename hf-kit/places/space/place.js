/* Place "space": outer space, drawn to look plausible (black sky, steady stars that do not twinkle,
 * one light source, bodies lit from the same side, thin atmospheres).
 *   earth-orbit  low Earth orbit: Earth's curved limb fills the bottom (oceans, continents, cloud
 *                swirls, the night side with city lights behind a soft terminator, a thin blue
 *                atmosphere glow), the Sun with its glare at the top right, the Moon lit from the
 *                right, and a space station with solar arrays.
 *   deep-space   far out among the giant planets: a ringed gas giant with banded clouds and the
 *                rings' shadow on it, a small icy moon, a probe with a dish antenna, a distant
 *                bright star, a coloured nebula and the Milky Way.
 * Sizes and distances are not to scale (a scene using it carries the "not to scale" tag).
 * Anchors (ground-layer world px, 3840 x 2160 world; the same names in both views):
 *   planet  a point on the planet (Earth / the gas giant)
 *   moon    the moon
 *   craft   the station / the probe (an astronaut floats here)
 *   star    the Sun / the distant star
 *   open    open space with nothing behind it (a tag, a title, a comparison)
 * Path: orbit (an arc around the planet, left to right).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("space/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag;
  var r2 = D.r2;

  var meta = {
    name: "space",
    description: "Outer space: Earth's limb from orbit with the Sun, the Moon and a space station; or a ringed gas giant, an icy moon and a probe in deep space.",
    variants: ["earth-orbit", "deep-space"],
    anchors: ["planet", "moon", "craft", "star", "open"],
    paths: ["orbit"],
    actorScale: 0.6, // an astronaut by the craft (not to scale)
    actorLight: {
      "earth-orbit": { tint: "#EEF3FF", amount: 0.16, rim: "#FFFFFF", rimSide: 1 }, // hard sunlight from the right
      "deep-space": { tint: "#7F8FC4", amount: 0.46, rim: "#FFE6BE", rimSide: 1 },
    },
  };

  var GEO = {
    "earth-orbit": { planet: { x: 1920, y: 5650, r: 4250 }, moon: { x: 660, y: 520, r: 120 }, craft: { x: 2420, y: 860 }, star: { x: 3340, y: 380 }, open: { x: 1500, y: 640 } },
    "deep-space": { planet: { x: 1380, y: 1420, r: 620 }, moon: { x: 3060, y: 1580, r: 120 }, craft: { x: 2480, y: 760 }, star: { x: 3300, y: 420 }, open: { x: 820, y: 520 } },
  };

  function anchorsFor(opts) {
    var v = PL.variantOf(meta, opts), G = GEO[v], p = G.planet;
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    var orbit = [], R = v === "earth-orbit" ? p.r + 520 : p.r * 1.75;
    for (var k = 0; k <= 10; k++) {
      if (v === "earth-orbit") { var x = 260 + k * 332, y = p.y - Math.sqrt(R * R - (x - p.x) * (x - p.x)); orbit.push({ x: x, y: r2(y) }); }
      else { var a = Math.PI * (1 - k / 10); orbit.push({ x: r2(p.x + Math.cos(a) * R), y: r2(p.y - Math.sin(a) * R * 0.42) }); }
    }
    return {
      anchors: {
        planet: v === "earth-orbit" ? fixed(2100, r2(p.y - Math.sqrt(p.r * p.r - 180 * 180) + 160)) : fixed(p.x + 120, p.y - 160),
        moon: fixed(G.moon.x, G.moon.y), craft: fixed(G.craft.x, G.craft.y), star: fixed(G.star.x, G.star.y), open: fixed(G.open.x, G.open.y),
      },
      paths: { orbit: orbit },
    };
  }

  function drawSky(P, v, R) {
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: "#03040C" });
    s += tag("g", { "data-part": "stars" }, A.stars(R, 260, -200, -100, 4200, 2300, { bright: 0.05 }) + A.stars(R, 40, 600, 300, 2600, 1200, { bright: 0.3, scale: 1.2 }));
    return { defs: "", body: s };
  }
  function drawFar(P, v, R) {
    var deep = v === "deep-space";
    var defs = S.lin(P + "-mw", [[0, "#9FA8D8", 0], [0.42, "#B8B4E0", 0.28], [0.5, "#E8DCF0", 0.38], [0.58, "#B8B4E0", 0.28], [1, "#9FA8D8", 0]]) +
      S.rad(P + "-neb1", [[0, "#FF7AB6", 0.5], [0.5, "#B05FD0", 0.22], [1, "#5A2E8A", 0]]) + S.rad(P + "-neb2", [[0, "#5FD3F0", 0.45], [0.6, "#3A6FD0", 0.16], [1, "#2A3A90", 0]]);
    var s = tag("g", { transform: "rotate(-18 1920 1080)" }, tag("rect", { x: -1600, y: 700, width: 7040, height: 700, fill: "url(#" + P + "-mw)" }) +
      [0, 1, 2, 3, 4, 5].map(function (k) { return tag("ellipse", { cx: -600 + k * 900, cy: 1050 + (k % 2) * 30, rx: 380, ry: 40, fill: "#1A1830", opacity: 0.5 }); }).join("") +
      A.stars(R, 220, -1000, 800, 5800, 500, { scale: 0.7 }));
    if (deep) s += tag("ellipse", { cx: 900, cy: 600, rx: 900, ry: 520, fill: "url(#" + P + "-neb1)" }) + tag("ellipse", { cx: 1400, cy: 900, rx: 800, ry: 420, fill: "url(#" + P + "-neb2)" }) + tag("ellipse", { cx: 600, cy: 1000, rx: 500, ry: 300, fill: "url(#" + P + "-neb1)", opacity: 0.6 });
    return { defs: defs, body: s };
  }
  function drawMid(P, v, R) {
    var s = "";
    if (v === "deep-space") {
      // a far spiral galaxy and a few distant tumbling rocks
      var gx = 2600, gy = 1500;
      s += tag("ellipse", { cx: gx, cy: gy, rx: 130, ry: 46, fill: "#E8DCF0", opacity: 0.35, transform: "rotate(-24 " + gx + " " + gy + ")" }) + tag("ellipse", { cx: gx, cy: gy, rx: 36, ry: 16, fill: "#FFF4E0", opacity: 0.8, transform: "rotate(-24 " + gx + " " + gy + ")" });
      for (var a = 0; a < 14; a++) { var x = 300 + R() * 3300, y = 300 + R() * 1500, r = 8 + R() * 18; s += tag("path", { d: "M" + r2(x - r) + " " + r2(y) + " q" + r2(r * 0.2) + " " + r2(-r) + " " + r2(r) + " " + r2(-r * 0.8) + " q" + r2(r) + " " + r2(r * 0.3) + " " + r2(r) + " " + r2(r * 1.2) + " q" + r2(-r) + " " + r2(r * 0.6) + " " + r2(-r * 2) + " " + r2(-r * 0.4) + " Z", fill: "#6E6A78", opacity: 0.8 }); }
    } else {
      // a satellite crossing far off
      s += tag("g", { "data-part": "far-sat" }, tag("rect", { x: -10, y: -6, width: 20, height: 12, fill: "#C9CED6" }) + tag("rect", { x: -44, y: -4, width: 30, height: 8, fill: "#3A5A9A" }) + tag("rect", { x: 14, y: -4, width: 30, height: 8, fill: "#3A5A9A" }));
    }
    return { defs: "", body: s };
  }

  function station() {
    // a modular station: truss, solar array wings, radiators, pressurised modules (origin = centre)
    var s = "", gold = "#C9A040", panel = "#2E4E8E", cell = "#4C72C0";
    var wing = function (x0, y0, w, h) {
      var out = tag("rect", { x: x0, y: y0, width: w, height: h, fill: panel, stroke: gold, "stroke-width": 4 });
      for (var i = 1; i < 6; i++) out += tag("path", { d: "M" + r2(x0 + w * i / 6) + " " + y0 + " v" + h, stroke: cell, "stroke-width": 3 });
      out += tag("path", { d: "M" + x0 + " " + r2(y0 + h / 2) + " h" + w, stroke: cell, "stroke-width": 3 });
      return out + tag("path", { d: "M" + x0 + " " + y0 + " l" + r2(w * 0.4) + " " + r2(h * 0.35), stroke: "#9FC0F0", "stroke-width": 6, opacity: 0.5 });
    };
    s += tag("rect", { x: -620, y: -14, width: 1240, height: 28, fill: "#B8BEC8", stroke: "#6F7782", "stroke-width": 4 });
    for (var tx = -600; tx < 600; tx += 40) s += tag("path", { d: "M" + tx + " -14 l20 28 l20 -28", stroke: "#8A929D", "stroke-width": 3, fill: "none" });
    [[-600, -1], [-420, -1], [420, 1], [600, 1]].forEach(function (q) { s += wing(q[0] - 70, -320, 140, 290) + wing(q[0] - 70, 30, 140, 290); });
    s += tag("rect", { x: -140, y: -120, width: 70, height: 240, fill: "#E9ECEF", stroke: "#8A929D", "stroke-width": 4 }) + tag("rect", { x: 80, y: 40, width: 110, height: 60, fill: "#E9ECEF", stroke: "#8A929D", "stroke-width": 4 });
    [[-60, 0, 260, 70], [200, 0, 220, 64], [-280, 0, 180, 60]].forEach(function (m) { s += tag("rect", { x: m[0] - m[2] / 2, y: m[1] - m[3] / 2, width: m[2], height: m[3], rx: m[3] / 2, fill: "#F1F3F5", stroke: "#7A838E", "stroke-width": 4 }) + tag("path", { d: "M" + (m[0] - m[2] / 2 + 30) + " " + (m[1] - m[3] / 2) + " v" + m[3] + " M" + (m[0] + m[2] / 2 - 30) + " " + (m[1] - m[3] / 2) + " v" + m[3], stroke: "#C2C8D0", "stroke-width": 4 }); });
    s += tag("rect", { x: -10, y: -90, width: 60, height: 50, rx: 10, fill: "#F1F3F5", stroke: "#7A838E", "stroke-width": 4 }) + tag("circle", { cx: 20, cy: -66, r: 12, fill: "#5FA8E6" });
    s += tag("path", { d: "M300 -32 L360 -140 L420 -150", stroke: "#D8DDE3", "stroke-width": 10, fill: "none", "stroke-linecap": "round" }); // robotic arm
    return s;
  }
  function probe() {
    // a deep-space probe: dish antenna, bus, boom with an RTG, magnetometer boom
    var s = tag("path", { d: "M-160 -40 Q0 -150 160 -40 Z", fill: "#F1F3F5", stroke: "#7A838E", "stroke-width": 5 }) + tag("path", { d: "M0 -40 V-110", stroke: "#7A838E", "stroke-width": 6 }) + tag("circle", { cx: 0, cy: -116, r: 10, fill: "#C9A040" });
    s += tag("rect", { x: -60, y: -40, width: 120, height: 90, fill: "#C9A040", stroke: "#8A6A20", "stroke-width": 5 }) + tag("path", { d: "M-60 -10 h120 M-60 20 h120", stroke: "#E8C870", "stroke-width": 3 });
    s += tag("path", { d: "M60 20 L320 80 M-60 20 L-420 120", stroke: "#B8BEC8", "stroke-width": 6 }) + tag("rect", { x: 300, y: 60, width: 70, height: 40, rx: 8, fill: "#5A5F6B", stroke: "#3A3F48", "stroke-width": 4 }) + tag("circle", { cx: -420, cy: 120, r: 12, fill: "#D8DDE3" });
    return s;
  }

  function drawGround(P, v, R) {
    var G = GEO[v], p = G.planet, st = G.star, s = "", defs = "";
    defs += S.rad(P + "-sun", [[0, "#FFFFFF", 1], [0.08, "#FFFDF2", 1], [0.2, "#FFF2C4", 0.55], [0.5, "#FFD98A", 0.16], [1, "#FFD98A", 0]]);
    if (v === "earth-orbit") {
      defs += S.rad(P + "-earth", [[0.82, "#2E7CC8"], [0.97, "#3C93D8"], [1, "#7CC2F0"]], { cx: 0.5, cy: 0.5, r: 0.5 }) +
        S.lin(P + "-term", [[0, "#020614", 0.95], [0.28, "#020614", 0.88], [0.4, "#020614", 0.45], [0.5, "#020614", 0]], [0, 0, 1, 0]) +
        S.rad(P + "-atmo", [[0.93, "#6FC4FF", 0], [0.985, "#8FD8FF", 0.85], [1, "#BFEAFF", 0]]) +
        "<clipPath id=\"" + P + "-disc\"><circle cx=\"" + p.x + "\" cy=\"" + p.y + "\" r=\"" + p.r + "\"/></clipPath>" +
        S.rad(P + "-moon", [[0, "#E9E6DC"], [1, "#B4B0A4"]], { cx: 0.62, cy: 0.42, r: 0.6 });
      // the Sun and its glare
      s += tag("circle", { cx: st.x, cy: st.y, r: 900, fill: "url(#" + P + "-sun)" }) + tag("circle", { cx: st.x, cy: st.y, r: 70, fill: "#FFFFFF" });
      s += [0, 45, 90, 135].map(function (a) { return tag("path", { d: "M" + (st.x - 260) + " " + st.y + " L" + (st.x + 260) + " " + st.y, stroke: "#FFFDF2", "stroke-width": 4, opacity: 0.35, transform: "rotate(" + a + " " + st.x + " " + st.y + ")" }); }).join("");
      // the Moon, lit from the right (the Sun's side)
      var m = G.moon;
      s += tag("circle", { cx: m.x, cy: m.y, r: m.r, fill: "url(#" + P + "-moon)" });
      [[-30, -40, 22], [30, 20, 16], [-50, 40, 12], [40, -50, 10], [0, 60, 9]].forEach(function (c) { s += tag("circle", { cx: m.x + c[0], cy: m.y + c[1], r: c[2], fill: "#A39F92", opacity: 0.6 }); });
      s += tag("path", { d: "M" + m.x + " " + (m.y - m.r) + " A" + m.r + " " + m.r + " 0 0 0 " + m.x + " " + (m.y + m.r) + " A" + (m.r * 0.45) + " " + m.r + " 0 0 1 " + m.x + " " + (m.y - m.r) + " Z", fill: "#05060E", opacity: 0.88 });
      // Earth: ocean, continents and clouds (clipped to the disc), the night side, the atmosphere
      s += tag("circle", { cx: p.x, cy: p.y, r: p.r + 70, fill: "url(#" + P + "-atmo)" });
      s += tag("circle", { cx: p.x, cy: p.y, r: p.r, fill: "url(#" + P + "-earth)" });
      var land = "";
      [[1100, 1650, 1], [2500, 1560, 1.2], [3300, 1900, 0.9], [300, 1900, 0.8], [1800, 2050, 1.1]].forEach(function (c, i) {
        var x = c[0], y = c[1], k = c[2];
        land += tag("path", { d: "M" + x + " " + y + " q" + r2(120 * k) + " " + r2(-80 * k) + " " + r2(260 * k) + " " + r2(-30 * k) + " q" + r2(140 * k) + " " + r2(20 * k) + " " + r2(160 * k) + " " + r2(120 * k) + " q" + r2(-40 * k) + " " + r2(130 * k) + " " + r2(-200 * k) + " " + r2(150 * k) + " q" + r2(-160 * k) + " " + r2(10 * k) + " " + r2(-220 * k) + " " + r2(-90 * k) + " q" + r2(-60 * k) + " " + r2(-90 * k) + " " + r2(0) + " " + r2(-150 * k) + " Z", fill: i % 2 ? "#5E9A48" : "#9C8A5A", opacity: 0.95 });
        land += tag("path", { d: "M" + r2(x + 60 * k) + " " + r2(y + 20 * k) + " q" + r2(80 * k) + " " + r2(-30 * k) + " " + r2(160 * k) + " " + r2(10 * k), stroke: "#3E7A36", "stroke-width": 20, fill: "none", opacity: 0.6 });
      });
      var clouds = "";
      for (var c = 0; c < 30; c++) { var cx = -200 + R() * 4300, cy = p.y - p.r + 60 + R() * 760, w = 80 + R() * 220; clouds += tag("path", { d: "M" + r2(cx - w) + " " + r2(cy) + " q" + r2(w * 0.5) + " " + r2(-w * 0.18) + " " + r2(w) + " " + r2(-w * 0.04) + " q" + r2(w * 0.6) + " " + r2(-w * 0.2) + " " + r2(w) + " " + r2(w * 0.12) + " q" + r2(-w) + " " + r2(w * 0.2) + " " + r2(-w * 2) + " " + r2(-w * 0.08) + " Z", fill: "#FFFFFF", opacity: 0.75 }); }
      clouds += tag("path", { d: "M2050 1720 a110 60 0 1 1 1 0 M2050 1720 a60 30 0 1 0 1 0", stroke: "#FFFFFF", "stroke-width": 24, fill: "none", opacity: 0.6 }); // a storm swirl
      s += tag("g", { "clip-path": "url(#" + P + "-disc)" }, land + tag("g", { "data-part": "clouds" }, clouds) +
        tag("rect", { x: -500, y: p.y - p.r - 100, width: 4800, height: 2700, fill: "url(#" + P + "-term)" }) +
        A.stars(R, 70, -300, 1500, 1300, 700, { colors: ["#FFD27A", "#FFE6A8", "#FFC864"], bright: 0, scale: 0.9 }));
      s += tag("circle", { cx: p.x, cy: p.y, r: p.r - 4, fill: "none", stroke: "#BFEAFF", "stroke-width": 10, opacity: 0.55 });
      s += tag("g", { "data-part": "craft", transform: "translate(" + G.craft.x + " " + G.craft.y + ") scale(0.9)" }, station());
    } else {
      defs += S.lin(P + "-giant", [[0, "#F4DDB0"], [0.2, "#E2B67A"], [0.35, "#F0D2A0"], [0.5, "#C98E5A"], [0.62, "#EBC890"], [0.8, "#D9A46C"], [1, "#B9824E"]]) +
        S.rad(P + "-shade", [[0.55, "#000", 0], [1, "#000", 0.75]], { cx: 0.7, cy: 0.3, r: 0.85 }) + S.rad(P + "-icy", [[0, "#F4FBFF"], [1, "#A9C4D6"]], { cx: 0.65, cy: 0.38, r: 0.6 }) +
        S.lin(P + "-ring", [[0, "#C9B48A", 0.25], [0.3, "#E8D8B0", 0.85], [0.45, "#B79E70", 0.5], [0.5, "#1A1410", 0.2], [0.55, "#D8C49A", 0.8], [1, "#A89070", 0.3]]) +
        "<clipPath id=\"" + P + "-disc\"><circle cx=\"" + p.x + "\" cy=\"" + p.y + "\" r=\"" + p.r + "\"/></clipPath>";
      s += tag("circle", { cx: st.x, cy: st.y, r: 520, fill: "url(#" + P + "-sun)" }) + tag("circle", { cx: st.x, cy: st.y, r: 34, fill: "#FFFFFF" });
      s += [0, 90].map(function (a) { return tag("path", { d: "M" + (st.x - 300) + " " + st.y + " L" + (st.x + 300) + " " + st.y, stroke: "#FFFDF2", "stroke-width": 5, opacity: 0.5, transform: "rotate(" + a + " " + st.x + " " + st.y + ")" }); }).join("");
      var ring = function (half) { // the back (half = 0) or front (half = 1) of the rings
        var rx = p.r * 2.05, ry = p.r * 0.42, rx2 = p.r * 1.3, ry2 = p.r * 0.27, sw = half ? 1 : 0;
        return tag("path", { d: "M" + (p.x - rx) + " " + p.y + " A" + rx + " " + ry + " 0 0 " + sw + " " + (p.x + rx) + " " + p.y + " L" + (p.x + rx2) + " " + p.y + " A" + rx2 + " " + ry2 + " 0 0 " + (1 - sw) + " " + (p.x - rx2) + " " + p.y + " Z", fill: "url(#" + P + "-ring)", transform: "rotate(-14 " + p.x + " " + p.y + ")" });
      };
      s += ring(0);
      s += tag("circle", { cx: p.x, cy: p.y, r: p.r, fill: "url(#" + P + "-giant)" });
      var bands = "";
      for (var b = 0; b < 9; b++) bands += tag("path", { d: "M" + (p.x - p.r) + " " + (p.y - p.r + 80 + b * 140) + " q" + (p.r * 0.5) + " " + (b % 2 ? 24 : -24) + " " + p.r + " 0 t" + p.r + " 0", stroke: b % 2 ? "#B87A48" : "#F6E2BC", "stroke-width": 22 + (b % 3) * 10, fill: "none", opacity: 0.5 });
      bands += tag("ellipse", { cx: p.x + 160, cy: p.y + 160, rx: 90, ry: 46, fill: "#C46A3E", opacity: 0.75 }) + tag("ellipse", { cx: p.x + 160, cy: p.y + 160, rx: 56, ry: 26, fill: "#E39A6A", opacity: 0.8 });
      // the rings' shadow across the planet, and the night side away from the star
      bands += tag("path", { d: "M" + (p.x - p.r) + " " + (p.y - 60) + " Q" + p.x + " " + (p.y + 40) + " " + (p.x + p.r) + " " + (p.y - 150), stroke: "#2A1E14", "stroke-width": 34, fill: "none", opacity: 0.45 });
      s += tag("g", { "clip-path": "url(#" + P + "-disc)", transform: "rotate(-14 " + p.x + " " + p.y + ")" }, bands) + tag("circle", { cx: p.x, cy: p.y, r: p.r, fill: "url(#" + P + "-shade)" });
      s += ring(1);
      var m2 = G.moon;
      s += tag("circle", { cx: m2.x, cy: m2.y, r: m2.r, fill: "url(#" + P + "-icy)" }) + tag("path", { d: "M" + (m2.x - 60) + " " + (m2.y - 30) + " q50 30 110 -10 M" + (m2.x - 70) + " " + (m2.y + 30) + " q60 20 120 0", stroke: "#8FAAC0", "stroke-width": 6, fill: "none", opacity: 0.7 }) +
        tag("path", { d: "M" + m2.x + " " + (m2.y - m2.r) + " A" + m2.r + " " + m2.r + " 0 0 0 " + m2.x + " " + (m2.y + m2.r) + " A" + (m2.r * 0.6) + " " + m2.r + " 0 0 1 " + m2.x + " " + (m2.y - m2.r) + " Z", fill: "#04050C", opacity: 0.75 });
      s += tag("g", { "data-part": "craft", transform: "translate(" + G.craft.x + " " + G.craft.y + ")" }, probe());
    }
    return { defs: defs, body: s };
  }
  function drawFront(P, v, R) {
    var s = "";
    if (v === "deep-space") [[160, 2000, 150], [3720, 220, 120], [3600, 2040, 90]].forEach(function (q, i) {
      s += tag("path", { d: "M" + (q[0] - q[2]) + " " + q[1] + " q" + r2(q[2] * 0.2) + " " + r2(-q[2]) + " " + q[2] + " " + r2(-q[2] * 0.8) + " q" + q[2] + " " + r2(q[2] * 0.3) + " " + q[2] + " " + r2(q[2] * 1.2) + " q" + -q[2] + " " + r2(q[2] * 0.6) + " " + -(2 * q[2]) + " " + r2(-q[2] * 0.4) + " Z", fill: "#4A4652", stroke: "#2A2830", "stroke-width": 6, "data-rock": i }) +
        tag("circle", { cx: q[0] + q[2] * 0.2, cy: q[1] - q[2] * 0.3, r: q[2] * 0.18, fill: "#3A3640" });
    });
    else s += tag("g", { transform: "translate(3700 1980) rotate(-20)" }, tag("rect", { x: -400, y: -60, width: 800, height: 120, fill: "#2E4E8E", stroke: "#C9A040", "stroke-width": 8 }) + [1, 2, 3, 4, 5, 6, 7].map(function (k) { return tag("path", { d: "M" + (-400 + k * 100) + " -60 v120", stroke: "#4C72C0", "stroke-width": 5 }); }).join(""));
    return { defs: "", body: s };
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place space: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-space";
    var seed = opts.seed === undefined ? 14 : opts.seed | 0;
    var parts = { sky: drawSky(P, v, D.rng(seed + 1)), far: drawFar(P, v, D.rng(seed + 2)), mid: drawMid(P, v, D.rng(seed + 3)), ground: drawGround(P, v, D.rng(seed + 4)), front: drawFront(P, v, D.rng(seed + 5)) };
    var g = {};
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(layers[name], "space-" + name, parts[name].defs, parts[name].body); });
    var G = GEO[v];
    var craft = g.ground.querySelector('[data-part="craft"]'), craftBase = craft.getAttribute("transform");
    var cloudG = g.ground.querySelector('[data-part="clouds"]');
    var farSat = g.mid.querySelector('[data-part="far-sat"]');
    var rocks = [].slice.call(g.front.querySelectorAll("[data-rock]"));

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      // the craft drifts and turns very slowly (no sudden moves in orbit)
      craft.setAttribute("transform", "translate(" + r2(D.wobble(t, 3, 0.15) * 18) + " " + r2(D.wobble(t, 7, 0.12) * 12) + ") " + craftBase + " rotate(" + r2(Math.sin(t * 0.12) * 2.5) + ")");
      if (cloudG) cloudG.setAttribute("transform", "translate(" + r2(A.wrap(t * 9, 0, 400) - 200) + " 0)"); // Earth turns under the clouds' view
      if (farSat) farSat.setAttribute("transform", "translate(" + r2(A.wrap(200 + t * 60, -200, 4000)) + " " + r2(300 + A.wrap(200 + t * 60, -200, 4000) * 0.12) + ")");
      rocks.forEach(function (e, k) { var c = [[160, 2000], [3720, 220], [3600, 2040]][k]; e.setAttribute("transform", "rotate(" + r2(t * (4 + k * 2)) + " " + c[0] + " " + c[1] + ")"); });
    }
    var a = anchorsFor(opts);
    update(0, PL.REF);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places.space = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
