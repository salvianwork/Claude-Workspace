/* Place "rooftop-night": a cosy city rooftop at night. Across the roof, past a low parapet, the
 * city glows: nearer blocks with lit windows and neon picture signs, a far skyline with a spire
 * whose red light blinks. On the roof: the stair door hut with a lamp, a water tank on stilts, a
 * telescope on a tripod, deck chairs and plants under strings of warm fairy lights, humming air
 * conditioners and a steaming vent pipe. A potted plant and a lantern frame the foreground.
 *
 * Variants: clear (default: a full moon and stars), rain (low clouds, falling rain, puddles that
 * mirror the lights). Anchors (ground-layer world px, 3840 x 2160 world):
 *   ledge      the roof by the parapet, looking out over the city
 *   telescope  beside the telescope
 *   door       in front of the stair door
 *   tank       the water tank on its stilts
 *   skyline    a point in the city beyond the parapet
 *   sky        open night sky above the city (the moon is at its right)
 * Path: roof (across the roof, left to right).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("rooftop-night/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "rooftop-night",
    description: "A cosy city rooftop at night: the glowing city past a parapet, a stair hut, water tank, telescope, fairy lights, deck chairs.",
    variants: ["clear", "rain"],
    anchors: ["ledge", "telescope", "door", "tank", "skyline", "sky"],
    paths: ["roof"],
    actorScale: 1.1,
    actorLight: {
      clear: { tint: "#4C5EA0", amount: 0.6, rim: "#FFD39A", rimSide: -1 }, // fairy lights and the door lamp at the left
      rain: { tint: "#3E5084", amount: 0.68, rim: "#A8D4FF", rimSide: 1 },
    },
  };

  var G = { parapet: 1330, roof: 1420, hut: { x0: 160, x1: 760, top: 900 }, tank: { x: 3400, top: 560, base: 1560 }, scope: { x: 2620, y: 1640 } };

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    var roof = [];
    for (var x = 300; x <= 3600; x += 330) roof.push({ x: x, y: 1720 });
    return {
      anchors: { ledge: fixed(1700, 1500), telescope: fixed(G.scope.x - 160, G.scope.y + 40), door: fixed(460, 1620), tank: fixed(G.tank.x, 900), skyline: fixed(1300, 980), sky: fixed(2150, 420) },
      paths: { roof: roof },
    };
  }

  var LOOK = {
    clear: { sky: [[0, "#060A22"], [0.55, "#14204A"], [0.9, "#2E3A72"], [1, "#5A4A80"]], rain: false },
    rain: { sky: [[0, "#141826"], [0.55, "#232A40"], [0.9, "#3A3F5A"], [1, "#4E4A66"]], rain: true },
  };

  function drawSky(P, v, L, R) {
    var defs = S.lin(P + "-sky", L.sky) + S.rad(P + "-moon", [[0, "#F6F2DC", 0.6], [1, "#8FA6E0", 0]]);
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: L.sky[L.sky.length - 1][1] }) + tag("rect", { x: -2600, y: -1600, width: 9040, height: 1900, fill: L.sky[0][1] });
    s += tag("rect", { x: -2600, y: 300, width: 9040, height: 1300, fill: "url(#" + P + "-sky)" });
    if (!L.rain) {
      s += tag("g", { "data-part": "stars" }, A.stars(R, 160, 300, 280, 3200, 800));
      s += tag("circle", { cx: 2700, cy: 560, r: 340, fill: "url(#" + P + "-moon)" }) + tag("circle", { cx: 2700, cy: 560, r: 104, fill: "#F6F2DC" }) +
        tag("circle", { cx: 2670, cy: 530, r: 22, fill: "#DCD6BC" }) + tag("circle", { cx: 2730, cy: 590, r: 16, fill: "#DCD6BC" }) + tag("circle", { cx: 2720, cy: 510, r: 10, fill: "#DCD6BC" });
      s += A.cloud(1200, 640, 0.5, { cloud: "#2E3968", cloudShade: "#1F2850", cloudLight: "#46528A" }, 0);
    } else {
      var pal = { cloud: "#363C56", cloudShade: "#272C42", cloudLight: "#4A5070" };
      s += tag("g", { "data-part": "clouds" }, [[500, 520, 1.1], [1400, 600, 1.2], [2300, 480, 1.1], [3200, 600, 1.3], [-300, 600, 1]].map(function (c, i) { return A.cloud(c[0], c[1], c[2], pal, i); }).join(""));
    }
    return { defs: defs, body: s };
  }
  function drawFar(P, v, L, R) {
    var s = "", rain = L.rain;
    for (var b = 0; b < 28; b++) {
      var x = -900 + b * 210 + R() * 60, w = 120 + R() * 120, h = 300 + R() * 520, top = 1250 - h, c = b % 2 ? "#1C2448" : "#232C55";
      s += tag("rect", { x: x, y: top, width: w, height: h + 900, fill: rain ? D.mix(c, "#3A3F5A", 0.35) : c });
      for (var wy = top + 26; wy < 1240; wy += 44) for (var wx = x + 14; wx < x + w - 18; wx += 30) if (R() < 0.42) s += tag("rect", { x: wx, y: wy, width: 13, height: 19, fill: R() < 0.7 ? "#FFD27A" : "#9FD8FF", opacity: rain ? 0.55 : 0.85 });
    }
    s += tag("path", { d: "M1890 1250 L1910 300 L1950 300 L1970 1250 Z", fill: "#1A2142" }) + tag("path", { d: "M1930 300 V150", stroke: "#1A2142", "stroke-width": 10 }) + tag("circle", { cx: 1930, cy: 150, r: 12, fill: "#FF4D4D", "data-part": "beacon" });
    if (rain) s += tag("rect", { x: -900, y: 400, width: 5600, height: 1400, fill: "#5A6080", opacity: 0.22 });
    return { defs: "", body: s };
  }
  function neon(x, y, kind, c) {
    var shapes = {
      heart: "M0 20 C-40 -10 -40 -50 -14 -50 C-4 -50 0 -40 0 -34 C0 -40 4 -50 14 -50 C40 -50 40 -10 0 20 Z",
      cup: "M-34 -30 h56 v34 a28 22 0 0 1 -56 0 Z M22 -22 q22 0 18 18 q-4 12 -18 10",
      star: "M0 -46 L12 -14 L46 -14 L18 6 L28 40 L0 20 L-28 40 L-18 6 L-46 -14 L-12 -14 Z",
      note: "M-10 30 a14 10 0 1 1 0 -2 V-40 L30 -50 V20 a14 10 0 1 1 0 -2 V-30 L-10 -22",
    };
    return tag("rect", { x: x - 80, y: y - 80, width: 160, height: 150, rx: 18, fill: "#120E24", stroke: "#3A3060", "stroke-width": 6 }) +
      tag("path", { d: shapes[kind], transform: "translate(" + x + " " + y + ")", fill: "none", stroke: c, "stroke-width": 18, opacity: 0.35, "stroke-linejoin": "round", "data-neon": 1 }) +
      tag("path", { d: shapes[kind], transform: "translate(" + x + " " + y + ")", fill: "none", stroke: D.tint(c, 0.5), "stroke-width": 6, "stroke-linejoin": "round", "data-neon": 1 });
  }
  function drawMid(P, v, L, R) {
    var s = "", rain = L.rain;
    var blocks = [[-500, 760, 620], [200, 900, 440], [700, 820, 520], [1300, 960, 380], [1760, 700, 560], [2400, 880, 480], [2960, 760, 520], [3560, 840, 600]];
    blocks.forEach(function (b, i) {
      var x = b[0], top = b[1], w = b[2], c = ["#2A3257", "#252C4E", "#2C3660", "#30385C"][i % 4];
      s += tag("rect", { x: x, y: top, width: w, height: 1400, fill: c }) + tag("rect", { x: x - 10, y: top - 16, width: w + 20, height: 20, fill: D.shade(c, 0.3) });
      for (var wy = top + 50; wy < 1350; wy += 100) for (var wx = x + 34; wx < x + w - 60; wx += 88) { var on = R() < 0.5; s += tag("rect", { x: wx, y: wy, width: 50, height: 62, rx: 3, fill: on ? (R() < 0.6 ? "#FFD27A" : "#FFB86B") : "#1A2142" }); if (on && R() < 0.3) s += tag("rect", { x: wx, y: wy, width: 20, height: 62, fill: "#E8904A", opacity: 0.7 }); }
    });
    s += neon(560, 1020, "heart", "#FF5A8A") + neon(1560, 1100, "cup", "#5FE3FF") + neon(2240, 960, "star", "#FFE066") + neon(3260, 980, "note", "#B98CFF");
    s += tag("path", { d: "M1000 820 l10 -60 M1100 820 l-10 -60", stroke: "#1A2142", "stroke-width": 8 }) + tag("rect", { x: 990, y: 640, width: 130, height: 120, rx: 10, fill: "#2E2A3C" });
    if (rain) s += tag("rect", { x: -1400, y: 500, width: 6640, height: 1400, fill: "#4A5070", opacity: 0.18 });
    return { defs: "", body: s };
  }
  function drawGround(P, v, L, R) {
    var rain = L.rain;
    var defs = S.lin(P + "-roof", [[0, "#3A3F52"], [1, "#2A2E3C"]]) + S.rad(P + "-warm", [[0, "#FFD27A", 0.7], [1, "#FFD27A", 0]]) + S.lin(P + "-wet", [[0, "#9FB8E8", 0.25], [1, "#9FB8E8", 0]]);
    var s = "", Pp = G.parapet;
    // roof deck, gravel texture, the parapet with coping and drain
    s += tag("rect", { x: -400, y: Pp, width: 4640, height: 1300, fill: "url(#" + P + "-roof)" });
    for (var gv = 0; gv < 260; gv++) s += tag("circle", { cx: r2(-300 + R() * 4400), cy: r2(G.roof + 20 + R() * 760), r: 2 + R() * 3, fill: R() < 0.5 ? "#4A4F62" : "#23262F" });
    s += tag("rect", { x: -400, y: Pp - 110, width: 4640, height: 120, fill: "#5A5048" }) + tag("rect", { x: -400, y: Pp - 128, width: 4640, height: 26, rx: 6, fill: "#7A6E62" });
    for (var bk = -400; bk < 4240; bk += 120) s += tag("path", { d: "M" + bk + " " + (Pp - 102) + " v100 M" + (bk + 60) + " " + (Pp - 52) + " v50", stroke: "#4A4038", "stroke-width": 3 });
    s += tag("path", { d: "M-400 " + (Pp - 52) + " H4240", stroke: "#4A4038", "stroke-width": 3 });
    // puddles mirroring the lights (rain)
    if (rain) [[1200, 1780, 300], [2300, 1900, 380], [3100, 1720, 220], [700, 2000, 260]].forEach(function (q) { s += tag("ellipse", { cx: q[0], cy: q[1], rx: q[2], ry: q[2] * 0.16, fill: "#5E6E9A", opacity: 0.55 }) + tag("ellipse", { cx: q[0] - q[2] * 0.3, cy: q[1] - 4, rx: q[2] * 0.2, ry: 6, fill: "#FFD27A", opacity: 0.5 }) + tag("ellipse", { cx: q[0] + q[2] * 0.3, cy: q[1] + 2, rx: q[2] * 0.12, ry: 5, fill: "#FF8AB0", opacity: 0.4 }); });
    // the stair door hut with a lamp
    var H = G.hut;
    s += tag("rect", { x: H.x0, y: H.top, width: H.x1 - H.x0, height: 1560 - H.top, fill: "#6E5E52", stroke: "#3E342C", "stroke-width": 6 }) + tag("rect", { x: H.x0 - 30, y: H.top - 40, width: H.x1 - H.x0 + 60, height: 50, rx: 6, fill: "#4A4038" });
    s += tag("rect", { x: 340, y: 1120, width: 240, height: 440, fill: "#3E5A7A", stroke: "#22344A", "stroke-width": 6 }) + tag("rect", { x: 370, y: 1150, width: 180, height: 140, fill: "#FFD27A", opacity: 0.9 }) + tag("circle", { cx: 540, cy: 1360, r: 12, fill: "#E7C46A" });
    s += tag("path", { d: "M460 1040 v40", stroke: "#2A2420", "stroke-width": 8 }) + tag("path", { d: "M420 1080 h80 l-14 30 h-52 Z", fill: "#2A2420" }) + tag("ellipse", { cx: 460, cy: 1112, rx: 24, ry: 8, fill: "#FFF3C4" });
    s += tag("ellipse", { cx: 460, cy: 1300, rx: 380, ry: 300, fill: "url(#" + P + "-warm)", opacity: 0.6 });
    // antenna and an AC unit on the hut
    s += tag("path", { d: "M650 860 V560 M600 640 h100 M610 700 h80", stroke: "#8A929D", "stroke-width": 8 });
    // the water tank on stilts
    var T = G.tank;
    s += tag("path", { d: "M" + (T.x - 170) + " " + T.base + " L" + (T.x - 130) + " " + (T.top + 420) + " M" + (T.x + 170) + " " + T.base + " L" + (T.x + 130) + " " + (T.top + 420) + " M" + (T.x - 150) + " " + (T.base - 60) + " L" + (T.x + 140) + " " + (T.top + 460) + " M" + (T.x + 150) + " " + (T.base - 60) + " L" + (T.x - 140) + " " + (T.top + 460), stroke: "#4A3E34", "stroke-width": 16 });
    s += tag("rect", { x: T.x - 190, y: T.top + 80, width: 380, height: 360, rx: 16, fill: "#8C5E3C", stroke: "#4A2E18", "stroke-width": 6 });
    for (var hb = 0; hb < 4; hb++) s += tag("path", { d: "M" + (T.x - 190) + " " + (T.top + 140 + hb * 90) + " h380", stroke: "#3A3A3A", "stroke-width": 8 });
    s += tag("path", { d: "M" + (T.x - 210) + " " + (T.top + 84) + " L" + T.x + " " + T.top + " L" + (T.x + 210) + " " + (T.top + 84) + " Z", fill: "#5E4430", stroke: "#3A2A1E", "stroke-width": 6 });
    s += tag("path", { d: "M" + (T.x + 190) + " " + (T.top + 200) + " h50 v700", stroke: "#6E7682", "stroke-width": 10, fill: "none" });
    // string lights from the hut to the tank (bulbs twinkle in update)
    var str = [[740, 960], [1500, 1160], [2300, 1000], [3220, 1180]], lights = "";
    for (var k = 0; k < str.length - 1; k++) {
      var a = str[k], b = str[k + 1], mx = (a[0] + b[0]) / 2, my = Math.max(a[1], b[1]) + 140;
      lights += tag("path", { d: "M" + a[0] + " " + a[1] + " Q" + mx + " " + my + " " + b[0] + " " + b[1], stroke: "#1E1A16", "stroke-width": 4, fill: "none" });
      for (var u = 0.06; u < 1; u += 0.09) { var bx = (1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * mx + u * u * b[0], by = (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * my + u * u * b[1]; lights += tag("circle", { cx: r2(bx), cy: r2(by + 14), r: 26, fill: "#FFD27A", opacity: 0.25, "data-bulb": 1 }) + tag("ellipse", { cx: r2(bx), cy: r2(by + 14), rx: 9, ry: 12, fill: "#FFE9A8" }); }
    }
    s += lights;
    // the telescope on its tripod, aimed at the sky
    var Sc = G.scope;
    s += tag("path", { d: "M" + Sc.x + " " + (Sc.y - 200) + " L" + (Sc.x - 110) + " " + Sc.y + " M" + Sc.x + " " + (Sc.y - 200) + " L" + (Sc.x + 110) + " " + Sc.y + " M" + Sc.x + " " + (Sc.y - 200) + " L" + (Sc.x + 10) + " " + (Sc.y + 20), stroke: "#2A2E3C", "stroke-width": 12, "stroke-linecap": "round" });
    s += tag("g", { transform: "rotate(-38 " + Sc.x + " " + (Sc.y - 210) + ")" }, tag("rect", { x: Sc.x - 170, y: Sc.y - 250, width: 340, height: 70, rx: 18, fill: "#E9ECEF", stroke: "#5A6470", "stroke-width": 6 }) + tag("rect", { x: Sc.x + 150, y: Sc.y - 262, width: 50, height: 94, rx: 12, fill: "#3A4651" }) + tag("rect", { x: Sc.x - 200, y: Sc.y - 236, width: 34, height: 42, rx: 6, fill: "#3A4651" }));
    // a wooden deck under the chairs, and a glass skylight in the roof
    s += tag("path", { d: "M860 1560 H1620 L1700 1780 H780 Z", fill: "#7A5A3C", stroke: "#4A3424", "stroke-width": 5 });
    for (var dk = 0; dk < 6; dk++) s += tag("path", { d: "M" + (860 - dk * 14) + " " + (1560 + dk * 37) + " H" + (1620 + dk * 14), stroke: "#5E4430", "stroke-width": 4 });
    s += tag("path", { d: "M2500 1880 H3140 L3220 2060 H2420 Z", fill: "#2E3A5C", stroke: "#8A929D", "stroke-width": 10 }) + tag("path", { d: "M2820 1880 V2060 M2460 1970 H3180", stroke: "#8A929D", "stroke-width": 8 }) +
      tag("path", { d: "M2560 2040 L2680 1900 M2600 2040 L2700 1920", stroke: "#9FB8E8", "stroke-width": 8, opacity: 0.4 }) + tag("rect", { x: 2560, y: 1900, width: 230, height: 60, fill: "#FFD27A", opacity: 0.25 });
    // deck chairs with a blanket, a little table, plants in pots
    var chair = function (x, c) { // a wooden sun lounger, side on: legs, slatted seat, raised back, striped cushion
      var w = "#D2A577", wd = "#7A5230", y = 1690, cd = D.shade(c, 0.3), out = "";
      out += tag("path", { d: "M" + (x - 150) + " " + y + " v60 M" + (x + 150) + " " + y + " v60 M" + (x - 110) + " " + y + " v54 M" + (x + 110) + " " + y + " v54", stroke: wd, "stroke-width": 12, "stroke-linecap": "round" });
      out += tag("rect", { x: x - 170, y: y - 14, width: 340, height: 22, rx: 6, fill: w, stroke: wd, "stroke-width": 4 });
      out += tag("path", { d: "M" + (x - 150) + " " + (y - 10) + " L" + (x - 230) + " " + (y - 190) + " L" + (x - 200) + " " + (y - 200) + " L" + (x - 110) + " " + (y - 10) + " Z", fill: w, stroke: wd, "stroke-width": 4, "stroke-linejoin": "round" });
      out += tag("path", { d: "M" + (x - 140) + " " + (y - 30) + " L" + (x - 214) + " " + (y - 186) + " L" + (x - 186) + " " + (y - 196) + " L" + (x - 100) + " " + (y - 30) + " Z", fill: c, stroke: cd, "stroke-width": 4 });
      out += tag("rect", { x: x - 120, y: y - 40, width: 280, height: 30, rx: 12, fill: c, stroke: cd, "stroke-width": 4 });
      for (var k = 0; k < 4; k++) out += tag("path", { d: "M" + (x - 80 + k * 66) + " " + (y - 38) + " v26", stroke: "#FFF3E0", "stroke-width": 10, opacity: 0.8 });
      out += tag("path", { d: "M" + (x - 160) + " " + (y - 70) + " H" + (x - 60) + " M" + (x - 70) + " " + (y - 70) + " V" + (y - 14), stroke: wd, "stroke-width": 10, "stroke-linecap": "round" });
      return out;
    };
    s += chair(1020, "#C2412F") + chair(1480, "#2F7F74");
    s += tag("rect", { x: 1210, y: 1630, width: 90, height: 12, rx: 4, fill: "#8C5E3C" }) + tag("path", { d: "M1255 1642 v100", stroke: "#8C5E3C", "stroke-width": 10 }) + tag("rect", { x: 1236, y: 1600, width: 28, height: 30, rx: 6, fill: "#F2F2EC" });
    [[900, 1560], [2000, 1540], [3000, 1580]].forEach(function (q, i) { s += tag("path", { d: "M" + (q[0] - 50) + " " + q[1] + " l10 70 h80 l10 -70 Z", fill: "#B5523B", stroke: "#6E2E20", "stroke-width": 4 }); for (var lf = 0; lf < 6; lf++) s += tag("ellipse", { cx: q[0] + (lf - 2.5) * 16, cy: q[1] - 40 - (lf % 2) * 20, rx: 14, ry: 40, fill: lf % 2 ? "#2E6B4A" : "#3E7F5A", transform: "rotate(" + ((lf - 2.5) * 16) + " " + (q[0] + (lf - 2.5) * 16) + " " + (q[1] - 20) + ")" }); });
    // air conditioners with spinning fans, a vent pipe that steams
    [[2150, 1460], [2400, 1470]].forEach(function (q, i) { s += tag("rect", { x: q[0] - 100, y: q[1] - 140, width: 200, height: 140, rx: 10, fill: "#9AA3AE", stroke: "#5A6470", "stroke-width": 5 }) + tag("circle", { cx: q[0], cy: q[1] - 70, r: 50, fill: "#3A4651" }) + tag("g", { "data-fan": i, transform: "translate(" + q[0] + " " + (q[1] - 70) + ")" }, tag("path", { d: "M0 0 L40 -10 L36 12 Z M0 0 L-40 10 L-36 -12 Z M0 0 L10 40 L-12 36 Z M0 0 L-10 -40 L12 -36 Z", fill: "#C9CED6" })); });
    s += tag("path", { d: "M2860 1520 V1260 h60", stroke: "#7A838E", "stroke-width": 30, fill: "none" }) + tag("g", { "data-part": "steam" }, "");
    if (rain) s += tag("rect", { x: -400, y: G.roof, width: 4640, height: 300, fill: "url(#" + P + "-wet)" });
    return { defs: defs, body: s };
  }
  function drawFront(P, v, L, R) {
    var s = "";
    s += tag("path", { d: "M-60 2200 l30 -260 h340 l30 260 Z", fill: "#B5523B", stroke: "#6E2E20", "stroke-width": 6 });
    for (var l = 0; l < 12; l++) { var a = (-160 + l * 12) * Math.PI / 180, len = 220 + R() * 200, x = 140 + Math.cos(a) * len, y = 1940 + Math.sin(a) * len; s += tag("path", { d: "M140 1940 Q" + r2(140 + Math.cos(a) * len * 0.5) + " " + r2(1940 + Math.sin(a) * len * 0.3) + " " + r2(x) + " " + r2(y), stroke: l % 2 ? "#2E6B4A" : "#3E7F5A", "stroke-width": 26, fill: "none", "stroke-linecap": "round" }); }
    s += tag("path", { d: "M3700 2200 V1900", stroke: "#2A2420", "stroke-width": 14 }) + tag("rect", { x: 3640, y: 1780, width: 120, height: 140, rx: 20, fill: "#2A2420" }) + tag("rect", { x: 3660, y: 1800, width: 80, height: 100, rx: 12, fill: "#FFD27A", "data-lantern": 1 });
    s += tag("g", { "data-part": "rain" }, "");
    return { defs: "", body: s };
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place rooftop-night: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-rooftop-night";
    var seed = opts.seed === undefined ? 20 : opts.seed | 0;
    var L = LOOK[v];
    var parts = { sky: drawSky(P, v, L, D.rng(seed + 1)), far: drawFar(P, v, L, D.rng(seed + 2)), mid: drawMid(P, v, L, D.rng(seed + 3)), ground: drawGround(P, v, L, D.rng(seed + 4)), front: drawFront(P, v, L, D.rng(seed + 5)) };
    var g = {};
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(layers[name], "rooftop-night-" + name, parts[name].defs, parts[name].body); });
    var stars = [].slice.call(g.sky.querySelectorAll("[data-star]")), starOp = stars.map(function (e) { return +e.getAttribute("opacity"); });
    var clouds = [].slice.call(g.sky.querySelectorAll("[data-cloud]")).map(function (e) { return { e: e, base: e.getAttribute("transform"), x0: +/translate\(([-\d.]+)/.exec(e.getAttribute("transform"))[1] }; });
    var beacon = g.far.querySelector('[data-part="beacon"]');
    var neons = [].slice.call(g.mid.querySelectorAll("[data-neon]"));
    var bulbs = [].slice.call(g.ground.querySelectorAll("[data-bulb]"));
    var fans = [].slice.call(g.ground.querySelectorAll("[data-fan]")).map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    var steamG = g.ground.querySelector('[data-part="steam"]'), steam = D.presets.smoke(seed + 7, 7), steamEls = steam.list.map(function () { return D.el(steamG, "circle", { fill: "#C9D2E8", opacity: 0 }); });
    var rainG = g.front.querySelector('[data-part="rain"]'), drops = [], RR = D.rng(seed + 31);
    if (L.rain) for (var i = 0; i < 160; i++) drops.push({ x: -300 + RR() * 4500, y: RR() * 2600, sp: 1500 + RR() * 700, len: 50 + RR() * 50, e: D.el(rainG, "path", { stroke: "#BFD6FF", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.35 + RR() * 0.3 }) });

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      stars.forEach(function (e, k) { if (k % 4 === 0) e.setAttribute("opacity", r2(starOp[k] * (0.6 + 0.4 * Math.sin(t * 2 + k)))); });
      clouds.forEach(function (c, k) { var x = A.wrap(c.x0 + t * (10 + k * 2), -900, 4600); c.e.setAttribute("transform", "translate(" + r2(x - c.x0) + " 0) " + c.base); });
      if (beacon) beacon.setAttribute("opacity", (t % 1.6) < 0.5 ? 1 : 0.2);
      neons.forEach(function (e, k) { var flick = (Math.floor(t * 8 + k * 13) % 37 === 0) ? 0.4 : 1; e.setAttribute("opacity", r2((k % 2 ? 1 : 0.35) * flick)); });
      bulbs.forEach(function (e, k) { e.setAttribute("opacity", r2(0.2 + 0.12 * Math.sin(t * 2.6 + k * 1.7))); });
      fans.forEach(function (f, k) { f.e.setAttribute("transform", f.base + " rotate(" + r2((t * (400 + k * 60)) % 360) + ")"); });
      steam.at(t).forEach(function (p, j) { var e = steamEls[j]; e.setAttribute("cx", r2(2930 + p.x * 0.8 + D.wobble(t, j, 0.5) * 12)); e.setAttribute("cy", r2(1250 + p.y * 1.4)); e.setAttribute("r", r2(p.r * (0.5 + 0.8 * p.u))); e.setAttribute("opacity", r2(p.alive ? 0.45 * Math.sin(Math.PI * p.u) : 0)); });
      drops.forEach(function (d) { var y = A.wrap(d.y + t * d.sp, -200, 2400), x = d.x - (y + 200) * 0.12; d.e.setAttribute("d", "M" + r2(x) + " " + r2(y) + " l" + r2(-d.len * 0.12) + " " + r2(d.len)); });
    }
    var a = anchorsFor(opts);
    update(0, PL.REF);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places["rooftop-night"] = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
