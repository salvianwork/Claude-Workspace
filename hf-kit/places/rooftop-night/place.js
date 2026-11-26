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
 * Extended (vertical videos, mount with extended: true; meta.extend): 720 px drawn above and below,
 * anchors and paths 720 lower (see drawTopBand / drawBottomBand and src/world/place.js).
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
    // the extension for vertical videos (place.js: mount with extended: true, world 3840 x 3600)
    extend: {
      top: { draws: "the night sky above: stars, the Milky Way and a shooting star (clear) or heavy rain clouds and rain all the way up (rain), a plane's blinking lights, a tall skyscraper rising behind the blocks with its spire and warning light, a drone hovering", seamAllow: [] },
      bottom: { draws: "the roof's near edge with its coping and gutter, then the building's lower floors below: brick, lit windows with curtains, plants, a cat on a sill, a television's glow, a fire escape, a pictogram sign and a laundry line (rain: wet and streaming)", seamAllow: [] },
    },
  };

  var G = { parapet: 1330, roof: 1420, hut: { x0: 160, x1: 760, top: 900 }, tank: { x: 3400, top: 560, base: 1560 }, scope: { x: 2620, y: 1640 } };

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    return PL.offsetAnchors(baseAnchors(opts), PL.extendOffset(meta, opts));
  }
  function baseAnchors(opts) {
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

  // ---- the extension for vertical videos (tall-world px: the original is 720 lower) -----------
  /* The top band. Sky: stars and the Milky Way (clear) or heavy rain clouds (rain). Far: a plane's
   * blinking lights, a shooting star (clear). Mid (under the blocks): a tall skyscraper with its
   * spire and warning light. Ground: a drone hovering with its lights. */
  function drawTopBand(P, v, L, R) {
    var rain = L.rain, out = { sky: "", far: "", midUnder: "", ground: "", defs: "" };
    if (!rain) {
      var st = "";
      for (var k = 0; k < 200; k++) { var sy = 10 + R() * 1060; if (Math.abs(sy - 720) < 8) sy += 16; st += tag("circle", { cx: r2(-100 + R() * 4040), cy: r2(sy), r: r2(1.2 + R() * (R() < 0.06 ? 4 : 2.2)), fill: ["#FFF8E1", "#FFFFFF", "#DCE8FF", "#FFE2C4"][k % 4], opacity: r2(0.35 + R() * 0.6), "data-xstar": k }); }
      out.defs += S.lin(P + "-xmw", [[0, "#B8C4F0", 0], [0.45, "#C8D0F4", 0.14], [0.5, "#E6E2F6", 0.2], [0.55, "#C8D0F4", 0.14], [1, "#B8C4F0", 0]]);
      out.sky = tag("g", { transform: "rotate(-16 1920 500)" }, tag("rect", { x: -600, y: 300, width: 5000, height: 420, fill: "url(#" + P + "-xmw)" })) + tag("g", { "data-part": "xstars" }, st);
      out.far = tag("g", { "data-part": "xshoot", opacity: 0 }, tag("path", { d: "M0 0 L-300 -80", stroke: "#FFFFFF", "stroke-width": 5, "stroke-linecap": "round", opacity: 0.9 }) + tag("circle", { r: 6, fill: "#FFFFFF" }));
    } else {
      var pal = { cloud: "#363C56", cloudShade: "#272C42", cloudLight: "#4A5070" }, c = "";
      [[300, 300, 1.4], [1300, 200, 1.6], [2400, 320, 1.5], [3500, 220, 1.6], [800, 560, 1.2], [2000, 600, 1.3], [3100, 580, 1.2]].forEach(function (q, i) { c += A.cloud(q[0], q[1], q[2], pal, "x" + i); });
      out.sky = tag("rect", { x: -2600, y: -900, width: 9040, height: 600, fill: "#10131E", opacity: 0.6 }) + c;
    }
    out.far += tag("g", { "data-part": "xplane", transform: "translate(1200 620)" }, tag("path", { d: "M-50 0 H50 M-8 0 L-34 -24 M-8 0 L-34 24", stroke: "#0E1226", "stroke-width": 7, "stroke-linecap": "round" }) +
      tag("circle", { cx: -50, cy: 0, r: 6, fill: "#FF5A5A", "data-blink": 0 }) + tag("circle", { cx: 50, cy: 0, r: 5, fill: "#FFFFFF", "data-blink": 1 }));
    // a tall skyscraper behind the blocks: tiers, a spire, lit windows
    var x0 = 2150, w = 300, top = 420, c2 = rain ? "#2E3450" : "#232B52", sk = "";
    sk += tag("rect", { x: x0, y: top + 160, width: w, height: 1400, fill: c2 }) + tag("rect", { x: x0 + 40, y: top + 40, width: w - 80, height: 140, fill: c2 }) + tag("rect", { x: x0 + 90, y: top - 60, width: w - 180, height: 120, fill: c2 });
    sk += tag("path", { d: "M" + (x0 + w / 2) + " " + (top - 60) + " V" + (top - 300), stroke: c2, "stroke-width": 12 }) + tag("circle", { cx: x0 + w / 2, cy: top - 300, r: 12, fill: "#FF4D4D", "data-blink": 2 });
    for (var wy = top + 200; wy < 1500; wy += 46) for (var wx = x0 + 18; wx < x0 + w - 20; wx += 32) if (R() < 0.45) sk += tag("rect", { x: wx, y: wy, width: 14, height: 22, fill: R() < 0.7 ? "#FFD27A" : "#9FD8FF", opacity: rain ? 0.6 : 0.85 });
    sk += tag("rect", { x: x0 + 40, y: top + 70, width: w - 80, height: 18, fill: "#5FE3FF", opacity: 0.6 });
    out.midUnder = sk;
    // a drone hovering, its lights blinking
    out.ground = tag("g", { "data-part": "xdrone", transform: "translate(1450 520)" }, tag("rect", { x: -40, y: -14, width: 80, height: 28, rx: 10, fill: "#3A4651", stroke: "#1E2430", "stroke-width": 4 }) +
      tag("path", { d: "M-40 -6 L-90 -20 M40 -6 L90 -20", stroke: "#3A4651", "stroke-width": 8 }) + tag("ellipse", { cx: -90, cy: -26, rx: 40, ry: 6, fill: "#8A929D", opacity: 0.7 }) + tag("ellipse", { cx: 90, cy: -26, rx: 40, ry: 6, fill: "#8A929D", opacity: 0.7 }) +
      tag("circle", { cx: -30, cy: 14, r: 6, fill: "#51CF66", "data-blink": 3 }) + tag("circle", { cx: 30, cy: 14, r: 6, fill: "#FF5A5A", "data-blink": 4 }) + tag("circle", { cx: 0, cy: 18, r: 8, fill: "#3A4651" }));
    return out;
  }
  /* The bottom band (ground layer): the roof deck runs on to its near edge (coping and a gutter),
   * then the building's lower floors below: brick, lit windows (curtains, plants, a cat, a
   * television's glow), a fire escape, a pictogram sign and a laundry line. */
  function drawBottomBand(P, v, L, R) {
    var rain = L.rain, s = "", edge = 2960;
    var defs = S.lin(P + "-xbrick", [[0, "#5E4A44"], [1, "#3E302E"]]) + S.rad(P + "-xwarm", [[0, "#FFD27A", 0.6], [1, "#FFD27A", 0]]) + S.lin(P + "-xtv", [[0, "#7FB8FF", 0.5], [1, "#7FB8FF", 0]]);
    // gravel runs on, a roof drain
    for (var gv = 0; gv < 60; gv++) s += tag("circle", { cx: r2(-300 + R() * 4400), cy: r2(2890 + R() * 60), r: r2(2 + R() * 3), fill: R() < 0.5 ? "#4A4F62" : "#23262F" });
    s += tag("ellipse", { cx: 1900, cy: 2930, rx: 60, ry: 16, fill: "#1E2028", stroke: "#5A6470", "stroke-width": 4 });
    // the near edge: coping and a gutter, then the wall
    s += tag("rect", { x: -400, y: edge, width: 4640, height: 30, rx: 6, fill: "#7A6E62" }) + tag("rect", { x: -400, y: edge + 30, width: 4640, height: 22, fill: "#4A4038" });
    s += tag("rect", { x: -400, y: edge + 52, width: 4640, height: 18, rx: 8, fill: "#6E7682" });
    s += tag("rect", { x: -400, y: edge + 70, width: 4640, height: 600, fill: "url(#" + P + "-xbrick)" });
    var br = "";
    for (var by = edge + 100; by < 3620; by += 34) br += "M-400 " + by + " H4240 ";
    for (var row = 0; row < 20; row++) for (var bx = -400 + (row % 2) * 40; bx < 4240; bx += 80) br += "M" + bx + " " + (edge + 100 + row * 34) + " v34 ";
    s += tag("path", { d: br, stroke: "#3A2C28", "stroke-width": 3, opacity: 0.5 });
    if (rain) s += tag("path", { d: "M300 3120 v300 M1250 3110 v380 M2700 3130 v320 M3600 3120 v260", stroke: "#9FB8E8", "stroke-width": 4, opacity: 0.35 }); // streaks
    // windows: [x, kind]
    var win = function (x, y, kind) {
      var o = "", lit = kind !== "dark";
      o += tag("rect", { x: x - 10, y: y - 10, width: 300, height: 300, rx: 6, fill: "#2A201E" });
      o += tag("rect", { x: x, y: y, width: 280, height: 280, fill: lit ? (kind === "tv" ? "#2A3A66" : "#FFD27A") : "#1A2142" });
      if (kind === "tv") o += tag("rect", { x: x, y: y, width: 280, height: 280, fill: "url(#" + P + "-xtv)" }) + tag("rect", { x: x + 90, y: y + 150, width: 110, height: 70, fill: "#9FD8FF", opacity: 0.8 });
      if (lit && kind !== "tv") o += tag("rect", { x: x, y: y, width: 90, height: 280, fill: "#E8904A", opacity: 0.75 }) + tag("rect", { x: x + 190, y: y, width: 90, height: 280, fill: "#E8904A", opacity: 0.75 });
      if (kind === "lamp") o += tag("path", { d: "M" + (x + 140) + " " + (y + 40) + " v40 M" + (x + 110) + " " + (y + 110) + " L" + (x + 125) + " " + (y + 80) + " H" + (x + 155) + " L" + (x + 170) + " " + (y + 110) + " Z", stroke: "#8A5A20", "stroke-width": 4, fill: "#FFF3C4" });
      o += tag("path", { d: "M" + (x + 140) + " " + y + " v280 M" + x + " " + (y + 140) + " h280", stroke: "#2A201E", "stroke-width": 12 });
      o += tag("rect", { x: x - 20, y: y + 280, width: 320, height: 20, rx: 4, fill: "#7A6E62" });
      if (kind === "plants") [x + 50, x + 140, x + 230].forEach(function (px, i) { o += tag("path", { d: "M" + (px - 26) + " " + (y + 280) + " l6 -40 h40 l6 40 Z", fill: "#B5523B" }) + tag("circle", { cx: px, cy: y + 222, r: 28, fill: ["#3E7F5A", "#2E6B4A", "#4E9A48"][i] }); });
      if (kind === "cat") o += tag("path", { d: "M" + (x + 60) + " " + (y + 280) + " q-6 -60 30 -70 l6 -26 l14 20 l14 -20 l6 26 q36 10 30 70 Z M" + (x + 160) + " " + (y + 276) + " q50 0 40 -50", fill: "#1A1420", stroke: "#1A1420", "stroke-width": 8 }) + tag("circle", { cx: x + 100, cy: y + 232, r: 4, fill: "#FFE066" }) + tag("circle", { cx: x + 118, cy: y + 232, r: 4, fill: "#FFE066" });
      if (lit) o += tag("ellipse", { cx: x + 140, cy: y + 140, rx: 260, ry: 220, fill: "url(#" + P + "-xwarm)", opacity: kind === "tv" ? 0.3 : 0.5 });
      return o;
    };
    var kinds = ["lamp", "plants", "dark", "cat", "tv", "lamp", "plants", "dark"], wy = edge + 130;
    for (var i = 0; i < 8; i++) s += win(-200 + i * 540, wy, kinds[i]);
    var kinds2 = ["dark", "tv", "lamp", "dark", "plants", "cat", "lamp", "tv"]; // the floor below, its windows' tops
    for (var i2 = 0; i2 < 8; i2++) s += win(-200 + i2 * 540, wy + 420, kinds2[i2]);
    // a fire escape on the facade, a pictogram sign, a laundry line between two windows
    var fe = 2760;
    s += tag("path", { d: "M" + (fe - 220) + " " + (wy + 300) + " H" + (fe + 320) + " M" + (fe - 220) + " " + (wy + 340) + " H" + (fe + 320) + " M" + (fe - 220) + " " + (wy + 300) + " V" + (wy + 340) + " M" + (fe + 320) + " " + (wy + 300) + " V" + (wy + 340), stroke: "#1E1A16", "stroke-width": 8 });
    for (var rl = fe - 200; rl < fe + 320; rl += 40) s += tag("path", { d: "M" + rl + " " + (wy + 300) + " v40", stroke: "#1E1A16", "stroke-width": 4 });
    s += tag("path", { d: "M" + (fe + 200) + " " + (wy + 340) + " L" + (fe + 300) + " 3620 M" + (fe + 240) + " " + (wy + 340) + " L" + (fe + 340) + " 3620", stroke: "#1E1A16", "stroke-width": 6 });
    for (var st = 0; st < 6; st++) s += tag("path", { d: "M" + (fe + 210 + st * 16) + " " + (wy + 380 + st * 40) + " h40", stroke: "#1E1A16", "stroke-width": 5 });
    s += tag("rect", { x: 1550, y: wy + 40, width: 120, height: 120, rx: 14, fill: "#120E24", stroke: "#3A3060", "stroke-width": 5 }) + tag("path", { d: "M1570 " + (wy + 130) + " q40 -70 80 0 M1580 " + (wy + 80) + " h60", stroke: "#5FE3FF", "stroke-width": 7, fill: "none", "data-xneon": 1 });
    s += tag("path", { d: "M380 " + (wy + 30) + " Q610 " + (wy + 90) + " 840 " + (wy + 30), stroke: "#C9D2E8", "stroke-width": 3, fill: "none" });
    [[470, "#FF8787", 40], [560, "#74C0FC", 34], [660, "#FFE066", 44], [750, "#B197FC", 30]].forEach(function (c) { var cy = wy + 30 + 4 * 60 * ((c[0] - 380) / 460) * (1 - (c[0] - 380) / 460); s += tag("rect", { x: c[0] - 26, y: r2(cy), width: 52, height: c[2] * 1.4, rx: 4, fill: c[1], opacity: rain ? 0.7 : 0.9 }); });
    return { defs: defs, body: s };
  }
  /* Rain all the way up and down (front layer, the rain variant): drops above and below the
   * original's (which fall over its y -200 .. 2400). */
  function rainBand(R, el) {
    var drops = [];
    for (var i = 0; i < 70; i++) drops.push({ x: -300 + R() * 4500, y: R(), lo: i % 2 ? -400 : 3000, hi: i % 2 ? 560 : 3800, sp: 1500 + R() * 700, len: 50 + R() * 50, e: D.el(el, "path", { stroke: "#BFD6FF", "stroke-width": 3, "stroke-linecap": "round", opacity: r2(0.35 + R() * 0.3) }) });
    return drops;
  }
  function mountBands(X, P, v, L, seed) {
    var top = drawTopBand(P, v, L, D.rng(seed + 31)), bot = drawBottomBand(P, v, L, D.rng(seed + 32));
    PL.band(X.over.sky, "top", top.defs, top.sky);
    PL.band(X.over.far, "top", "", top.far);
    PL.band(X.under.mid, "top", "", top.midUnder);
    PL.band(X.over.ground, "top", "", top.ground);
    PL.band(X.over.ground, "bottom", bot.defs, bot.body);
    var drops = L.rain ? rainBand(D.rng(seed + 35), PL.band(X.over.front, "top", "", "")) : [];
    if (!L.rain) PL.band(X.over.front, "top", "", "");
    var q = function (sel) { var o = []; PL.LAYERS.forEach(function (n) { o = o.concat([].slice.call(X.over[n].querySelectorAll(sel)), [].slice.call(X.under[n].querySelectorAll(sel))); }); return o; };
    var blinks = q("[data-blink]"), plane = q('[data-part="xplane"]')[0], drone = q('[data-part="xdrone"]')[0], shoot = q('[data-part="xshoot"]')[0], neon = q("[data-xneon]")[0];
    var xstars = q("[data-xstar]").filter(function (e, i) { return i % 4 === 0; }).map(function (e) { return { e: e, op: +e.getAttribute("opacity"), k: +e.getAttribute("data-xstar") }; });
    var xcl = q("[data-cloud^='x']").map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    return function (t) {
      blinks.forEach(function (e, i) { e.setAttribute("opacity", ((t * 1.2 + i * 0.37) % 1) < 0.4 ? 1 : 0.2); });
      if (plane) plane.setAttribute("transform", "translate(" + r2(A.wrap(1200 + t * 80, -400, 4300)) + " 620)");
      if (drone) drone.setAttribute("transform", "translate(" + r2(1450 + D.wobble(t, 2, 0.3) * 40) + " " + r2(520 + D.wobble(t, 5, 0.5) * 16) + ")");
      if (shoot) { var u = (t % 7) / 0.8; shoot.setAttribute("opacity", r2(u < 1 ? Math.sin(u * Math.PI) : 0)); shoot.setAttribute("transform", "translate(" + r2(2400 + u * 500) + " " + r2(300 + u * 130) + ")"); }
      if (neon) neon.setAttribute("opacity", (Math.floor(t * 8) % 41 === 0) ? 0.4 : 1);
      xstars.forEach(function (x) { x.e.setAttribute("opacity", r2(x.op * (0.6 + 0.4 * Math.sin(t * 2 + x.k)))); });
      xcl.forEach(function (c, k) { c.e.setAttribute("transform", "translate(" + r2(A.wrap(t * (10 + k * 2), -300, 300)) + " 0) " + c.base); });
      drops.forEach(function (d) { var span = d.hi - d.lo, y = A.wrap(d.lo + d.y * span + t * d.sp, d.lo, d.hi), x = d.x - (y - d.lo) * 0.12; d.e.setAttribute("d", "M" + r2(x) + " " + r2(y) + " l" + r2(-d.len * 0.12) + " " + r2(d.len)); });
    };
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
    var X = PL.extendLayers(layers, opts, meta);
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(X.layers[name], "rooftop-night-" + name, parts[name].defs, parts[name].body); });
    var bandsUpdate = X.on ? mountBands(X, P, v, L, seed) : null; // the bands above and below (tall-world px)
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
      if (bandsUpdate) bandsUpdate(t);
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
    update(0, X.ref);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places["rooftop-night"] = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
