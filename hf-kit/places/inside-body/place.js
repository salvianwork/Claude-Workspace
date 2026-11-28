/* Place "inside-body": a front view into the human torso (the body faces us, so the body's LEFT
 * is the viewer's RIGHT), drawn for explainers about breathing, the heart, blood and digestion.
 * The windpipe runs down the midline and splits into the two bronchi; the two lungs fill the chest
 * (the left lung, on the viewer's right, smaller with the notch for the heart); the heart sits
 * between them just left of the midline, apex down and to the body's left; the aorta rises from it,
 * arches over to the body's left and runs down beside the spine; the vena cava on the body's right;
 * the diaphragm dome under the lungs; below it the liver (body's right) and the stomach (body's
 * left); the intestines fill the belly. Ribs and the spine show faintly.
 *   organs  warm, illustrated organs on soft tissue, floating blood cells behind
 *   scan    a glowing medical-scan look: cyan outlines on dark blue, a grid, the heart in magenta
 * Anchors (ground-layer world px, 3840 x 2160 world; meta.midline = the body's midline x):
 *   heart    the heart        lungs   the right lung (viewer's left)
 *   vessel   the descending aorta in the abdomen
 *   stomach  the stomach      liver   the liver       trachea  the windpipe
 * Path: bloodstream (from the heart up the aorta, over its arch and down to where it divides).
 *
 * Extended (vertical videos, mount with extended: true; meta.extend): 720 px drawn above and below,
 * anchors and paths 720 lower (see drawTopBand / drawBottomBand and src/world/place.js).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("inside-body/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;
  var MID = 1920;

  var meta = {
    name: "inside-body",
    description: "Front view into the torso: windpipe, lungs, heart, aorta, diaphragm, liver, stomach and intestines (illustrated, or as a glowing scan).",
    variants: ["organs", "scan"],
    anchors: ["heart", "lungs", "vessel", "stomach", "liver", "trachea"],
    paths: ["bloodstream"],
    midline: MID, // the body's midline (x); the body's left is the viewer's right
    notToScale: true, // sizes and distances are not true to scale: a scene here carries a "not to scale" tag
    actorScale: 0.5, // a tiny explorer inside the body (not to scale)
    actorLight: {
      organs: { tint: "#FF9A8A", amount: 0.26, rim: "#FFD6C8", rimSide: 1 },
      scan: { tint: "#4FC8EE", amount: 0.48, rim: "#C8F6FF", rimSide: 1 },
    },
    // the extension for vertical videos (place.js: mount with extended: true, world 3840 x 3600)
    extend: {
      top: { draws: "the neck continued up to the jaw: the trachea with the larynx and the thyroid gland, the carotid arteries and jugular veins on both sides, the neck vertebrae and the hyoid bone under the jaw; more cells and capillaries floating behind", seamAllow: [] },
      bottom: { draws: "the pelvis continued: the large intestine with the appendix and the rectum, the bladder, the pelvic bones and sacrum, the hip joints and the thighs with their femurs, femoral arteries and veins; more cells and capillaries floating behind", seamAllow: [[1640, 1790]] }, // the original's small-intestine loop runs nearly flat along the row there
    },
  };

  var HEART = { x: 2030, y: 910 };
  var AORTA = [[2000, 860], [1980, 720], [1995, 610], [2050, 565], [2095, 610], [2085, 760], [2060, 1050], [2025, 1350], [2002, 1650], [1990, 1900]];
  var ARCH = AORTA.slice(0, 5), DESC = AORTA.slice(4); // the arch is in front of the heart; the descending aorta runs behind it

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    return PL.offsetAnchors(baseAnchors(opts), PL.extendOffset(meta, opts));
  }
  function baseAnchors(opts) {
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    return {
      anchors: {
        heart: fixed(HEART.x, HEART.y), lungs: fixed(1480, 820), vessel: fixed(2014, 1480),
        stomach: fixed(2310, 1400), liver: fixed(1580, 1290), trachea: fixed(MID, 380),
      },
      paths: { bloodstream: AORTA.map(function (q) { return { x: q[0], y: q[1] }; }) },
    };
  }

  // colour sets: fill, shade, outline per organ
  var PAL = {
    organs: { bg: ["#3A1420", "#1E0A12"], body: "#F3C9B0", bodyD: "#D99C82", tissue: "#E8A08C", line: "#7A2E2E",
      lung: "#F08C9A", lungD: "#C95A6E", heart: "#D63A46", heartD: "#8E1C26", artery: "#E03A3A", vein: "#4A6FD0", liver: "#9A3A32", liverD: "#6A221E",
      stomach: "#F2A0A0", stomachD: "#C46A6E", gut: "#F4B8A8", gutD: "#C98070", colon: "#E8A07E", bone: "#FFF4E2", trachea: "#F6D8CC", diaphragm: "#C96A6A", glow: 0 },
    scan: { bg: ["#0A1E38", "#040B18"], body: "#0E2E50", bodyD: "#1A4C78", tissue: "#123C64", line: "#7FE3FF",
      lung: "#1E5A86", lungD: "#3E8EC0", heart: "#C2307A", heartD: "#FF6FB8", artery: "#FF5A8A", vein: "#5FB0FF", liver: "#1C4E7A", liverD: "#4FA8D8",
      stomach: "#1E527E", stomachD: "#5FC0E8", gut: "#174870", gutD: "#4FA8D8", colon: "#1A4C76", bone: "#BFF4FF", trachea: "#2A6A96", diaphragm: "#3E8EC0", glow: 1 },
  };

  function drawSky(P, v, C, R) {
    var defs = S.rad(P + "-bg", [[0, C.bg[0]], [1, C.bg[1]]], { cx: 0.5, cy: 0.45, r: 0.7 });
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: C.bg[1] }) + tag("rect", { x: -600, y: -400, width: 5040, height: 2960, fill: "url(#" + P + "-bg)" });
    if (v === "scan") { var gr = ""; for (var x = -600; x < 4440; x += 120) gr += "M" + x + " -400 V2600 "; for (var y = -400; y < 2600; y += 120) gr += "M-600 " + y + " H4440 "; s += tag("path", { d: gr, stroke: "#1E4A70", "stroke-width": 2, opacity: 0.6 }); }
    return { defs: defs, body: s };
  }
  function cell(x, y, r, c, op) { return tag("ellipse", { cx: r2(x), cy: r2(y), rx: r2(r), ry: r2(r * 0.86), fill: c, opacity: op }) + tag("ellipse", { cx: r2(x), cy: r2(y), rx: r2(r * 0.45), ry: r2(r * 0.36), fill: D.shade(c, 0.25), opacity: op }); }
  function drawFar(P, v, C, R) {
    var s = "", c = v === "scan" ? "#2A5E8A" : "#8E2A36";
    for (var i = 0; i < 40; i++) s += cell(-300 + R() * 4400, -100 + R() * 2400, 30 + R() * 50, c, 0.35);
    return { defs: "", body: s };
  }
  function drawMid(P, v, C, R) {
    var s = "", c = v === "scan" ? "#2E6E9E" : "#B0404E";
    for (var k = 0; k < 18; k++) { var x = -200 + R() * 4200, y = -100 + R() * 2300, d = "M" + r2(x) + " " + r2(y); for (var j = 0; j < 4; j++) { x += (R() - 0.5) * 400; y += (R() - 0.3) * 300; d += " Q" + r2(x + 60) + " " + r2(y - 80) + " " + r2(x) + " " + r2(y); } s += tag("path", { d: d, stroke: c, "stroke-width": 6 + R() * 6, fill: "none", opacity: 0.35, "stroke-linecap": "round" }); }
    return { defs: "", body: s };
  }

  function drawGround(P, v, C, R) {
    var scan = v === "scan", sw = scan ? 6 : 5, op = scan ? 0.85 : 1;
    var defs = S.lin(P + "-body", [[0, C.body], [1, C.bodyD]], [0, 0, 1, 0]) + S.rad(P + "-lung", [[0, D.tint(C.lung, 0.15)], [1, C.lungD]], { cx: 0.45, cy: 0.4, r: 0.7 }) +
      S.rad(P + "-heart", [[0, D.tint(C.heart, 0.2)], [1, C.heartD]], { cx: 0.4, cy: 0.35, r: 0.7 }) + S.rad(P + "-glow", [[0, scan ? "#FF6FB8" : "#FF8A8A", 0.55], [1, scan ? "#FF6FB8" : "#FF8A8A", 0]]);
    var s = "", L = C.line;
    // torso silhouette: neck, shoulders, waist, hips (arms cut away at the shoulders)
    var torso = [[1720, -300], [1720, 120], [1500, 220], [1120, 300], [960, 420], [920, 700], [980, 1100], [1100, 1500], [1120, 1800], [1040, 2100], [1000, 2500], [2840, 2500], [2800, 2100], [2720, 1800], [2740, 1500], [2860, 1100], [2920, 700], [2880, 420], [2720, 300], [2340, 220], [2120, 120], [2120, -300]];
    s += tag("path", { d: smooth(torso, true), fill: "url(#" + P + "-body)", stroke: scan ? C.line : C.bodyD, "stroke-width": scan ? 6 : 8, opacity: scan ? 0.9 : 1 });
    s += tag("path", { d: smooth([[1060, 420], [1000, 800], [1080, 1300], [1200, 1700], [1180, 2300], [2660, 2300], [2640, 1700], [2760, 1300], [2840, 800], [2780, 420], [2300, 300], [1540, 300]], true), fill: C.tissue, opacity: scan ? 0.5 : 0.55 });
    // spine (behind everything) and the ribs (faint, in front of the lungs)
    var spine = "";
    for (var vt = 0; vt < 22; vt++) spine += tag("rect", { x: MID - 46, y: 120 + vt * 92, width: 92, height: 70, rx: 18, fill: C.bone, opacity: scan ? 0.5 : 0.35 });
    s += spine;
    // vena cava (body's right), aorta drawn after the heart
    s += tag("path", { d: "M1860 300 L1850 720 L1880 900 M1880 1000 L1870 1900", stroke: C.vein, "stroke-width": 46, fill: "none", "stroke-linecap": "round", opacity: op });
    // trachea and bronchi
    s += tag("path", { d: "M" + MID + " -300 V620 M" + MID + " 620 Q1800 660 1660 760 M" + MID + " 620 Q2040 660 2160 740", stroke: C.trachea, "stroke-width": 70, fill: "none", "stroke-linecap": "round", opacity: op });
    for (var rg = 0; rg < 9; rg++) s += tag("path", { d: "M" + (MID - 32) + " " + (-20 + rg * 68) + " h64", stroke: scan ? C.line : "#E0B4A6", "stroke-width": 10, "stroke-linecap": "round" });
    // the lungs: right lung (viewer's left, three lobes), left lung (viewer's right, notch for the heart)
    var rl = [[1820, 430], [1780, 640], [1810, 900], [1840, 1120], [1600, 1180], [1250, 1150], [1120, 960], [1160, 640], [1320, 440], [1600, 360]];
    var ll = [[2020, 440], [2080, 640], [2140, 760], [2260, 860], [2200, 1020], [2380, 1150], [2620, 1140], [2720, 960], [2680, 640], [2520, 440], [2260, 360]];
    s += tag("g", { "data-part": "lungs" }, tag("path", { d: smooth(rl, true), fill: "url(#" + P + "-lung)", stroke: L, "stroke-width": sw, opacity: op }) + tag("path", { d: smooth(ll, true), fill: "url(#" + P + "-lung)", stroke: L, "stroke-width": sw, opacity: op }) +
      tag("path", { d: "M1180 820 Q1450 760 1780 700 M1240 1060 Q1500 900 1800 980 M2170 860 Q2400 780 2690 760", stroke: C.lungD, "stroke-width": 6, fill: "none", opacity: 0.8 }) +
      tag("path", { d: "M1660 760 Q1500 820 1380 900 M1660 760 Q1560 900 1500 1040 M2160 740 Q2320 800 2440 880 M2160 740 Q2300 900 2420 1000", stroke: scan ? C.line : "#F6D8CC", "stroke-width": 16, fill: "none", "stroke-linecap": "round", opacity: 0.75 }));
    var ribs = "";
    for (var rb = 0; rb < 7; rb++) { var y = 380 + rb * 120; ribs += tag("path", { d: "M" + (MID - 60) + " " + y + " Q" + (1300 - rb * 20) + " " + (y - 80) + " " + (1060 + rb * 10) + " " + (y + 160) + " M" + (MID + 60) + " " + y + " Q" + (2540 + rb * 20) + " " + (y - 80) + " " + (2780 - rb * 10) + " " + (y + 160), stroke: C.bone, "stroke-width": 22, fill: "none", "stroke-linecap": "round", opacity: scan ? 0.3 : 0.16 }); }
    s += ribs;
    // the descending aorta, behind the heart beside the spine (body's left), dividing at the pelvis
    s += tag("path", { d: smooth(DESC, false), stroke: C.artery, "stroke-width": 50, fill: "none", "stroke-linecap": "round", opacity: op });
    s += tag("path", { d: "M1990 1890 Q1940 2000 1840 2200 M1990 1890 Q2050 2000 2140 2200", stroke: C.artery, "stroke-width": 30, fill: "none", "stroke-linecap": "round", opacity: op });
    // the heart: apex down and to the body's left (viewer's right)
    var H = HEART;
    s += tag("ellipse", { cx: H.x, cy: H.y, rx: 300, ry: 260, fill: "url(#" + P + "-glow)", "data-part": "heart-glow" });
    s += tag("g", { "data-part": "heart" }, tag("path", { d: "M" + (H.x - 170) + " " + (H.y - 60) + " Q" + (H.x - 190) + " " + (H.y - 200) + " " + (H.x - 40) + " " + (H.y - 190) + " Q" + (H.x + 60) + " " + (H.y - 230) + " " + (H.x + 150) + " " + (H.y - 150) + " Q" + (H.x + 230) + " " + (H.y - 40) + " " + (H.x + 170) + " " + (H.y + 80) + " Q" + (H.x + 110) + " " + (H.y + 190) + " " + (H.x + 40) + " " + (H.y + 230) + " Q" + (H.x - 60) + " " + (H.y + 140) + " " + (H.x - 140) + " " + (H.y + 60) + " Q" + (H.x - 200) + " " + (H.y) + " " + (H.x - 170) + " " + (H.y - 60) + " Z", fill: "url(#" + P + "-heart)", stroke: C.heartD, "stroke-width": sw + 1 }) +
      tag("path", { d: "M" + (H.x - 20) + " " + (H.y - 170) + " Q" + (H.x + 40) + " " + (H.y) + " " + (H.x + 40) + " " + (H.y + 220), stroke: C.heartD, "stroke-width": 8, fill: "none", opacity: 0.6 }) +
      tag("path", { d: "M" + (H.x - 120) + " " + (H.y - 120) + " q30 -30 70 -20", stroke: "#FFFFFF", "stroke-width": 12, fill: "none", opacity: 0.4, "stroke-linecap": "round" }));
    // the aorta: up from the heart, over the arch, down beside the spine (body's left), dividing at the pelvis
    // the ascending aorta and its arch, in front, with the three branches to the head and arms
    s += tag("path", { d: "M2030 580 V380 M2075 585 Q2160 480 2300 420 M1998 600 Q1900 540 1780 470", stroke: C.artery, "stroke-width": 30, fill: "none", "stroke-linecap": "round", opacity: op });
    s += tag("path", { d: smooth(ARCH, false), stroke: C.artery, "stroke-width": 52, fill: "none", "stroke-linecap": "round", opacity: op });
    s += tag("path", { d: smooth(ARCH, false), stroke: "#FFFFFF", "stroke-width": 8, fill: "none", opacity: 0.25, transform: "translate(-12 0)" });
    // the diaphragm dome
    s += tag("path", { d: "M1060 1260 Q1400 1060 1900 1170 Q2400 1060 2780 1260", stroke: C.diaphragm, "stroke-width": 26, fill: "none", "stroke-linecap": "round", opacity: 0.8 });
    // the liver (body's right) and the stomach (body's left)
    s += tag("path", { d: smooth([[1150, 1240], [1500, 1180], [1900, 1190], [2160, 1240], [2060, 1320], [1800, 1420], [1500, 1460], [1220, 1400]], true), fill: C.liver, stroke: C.liverD, "stroke-width": sw + 1, opacity: op });
    s += tag("path", { d: "M1500 1250 q120 40 260 -10", stroke: C.liverD, "stroke-width": 8, fill: "none", opacity: 0.7 }) + tag("ellipse", { cx: 1700, cy: 1440, rx: 46, ry: 30, fill: scan ? "#2E7A5A" : "#6AA84F", stroke: C.line, "stroke-width": 4 });
    s += tag("g", { "data-part": "stomach" }, tag("path", { d: "M2140 1230 Q2160 1180 2240 1190 Q2460 1210 2520 1360 Q2560 1500 2440 1560 Q2300 1600 2180 1520 Q2120 1480 2080 1500 L2060 1460 Q2140 1440 2190 1460 Q2280 1480 2300 1400 Q2300 1300 2180 1280 Z", fill: C.stomach, stroke: C.stomachD, "stroke-width": sw + 1, opacity: op }) +
      tag("path", { d: "M2250 1260 q120 40 180 140 M2230 1340 q80 20 120 90", stroke: C.stomachD, "stroke-width": 6, fill: "none", opacity: 0.7 }));
    // kidneys (behind, either side of the spine), the large intestine frame and small intestine loops
    s += tag("ellipse", { cx: 1660, cy: 1560, rx: 70, ry: 110, fill: scan ? C.lung : "#B0464A", opacity: 0.55 }) + tag("ellipse", { cx: 2190, cy: 1620, rx: 70, ry: 110, fill: scan ? C.lung : "#B0464A", opacity: 0.55 });
    s += tag("path", { d: "M1300 2160 V1680 Q1300 1580 1420 1580 H2420 Q2540 1580 2540 1680 V2160", stroke: C.colon, "stroke-width": 90, fill: "none", "stroke-linecap": "round", opacity: op });
    s += tag("path", { d: "M1300 2160 V1680 Q1300 1580 1420 1580 H2420 Q2540 1580 2540 1680 V2160", stroke: C.gutD, "stroke-width": 90, fill: "none", "stroke-dasharray": "6 60", opacity: 0.6 });
    var gut = "M1460 1720";
    for (var row = 0; row < 4; row++) { var yy = 1720 + row * 110; gut += row % 2 ? " Q2300 " + (yy + 55) + " 1460 " + (yy + 110) : " Q1580 " + (yy + 55) + " 2380 " + (yy + 110); }
    s += tag("path", { d: gut, stroke: C.gut, "stroke-width": 70, fill: "none", "stroke-linecap": "round", opacity: op }) + tag("path", { d: gut, stroke: C.gutD, "stroke-width": 6, fill: "none", opacity: 0.6, transform: "translate(0 18)" });
    if (scan) s += tag("g", { "data-part": "scanline" }, tag("rect", { x: 800, y: -10, width: 2240, height: 20, fill: "#BFF4FF", opacity: 0.35 }) + tag("rect", { x: 800, y: -70, width: 2240, height: 140, fill: "#7FE3FF", opacity: 0.08 }));
    return { defs: defs, body: s };
  }
  function drawFront(P, v, C, R) {
    var s = "", c = v === "scan" ? "#3E8EC0" : "#D63A46";
    [[180, 260, 90], [3660, 300, 110], [260, 1960, 120], [3600, 1920, 100], [3820, 1300, 80], [60, 1100, 70]].forEach(function (q, i) { s += tag("g", { "data-cell": i, transform: "translate(" + q[0] + " " + q[1] + ")" }, cell(0, 0, q[2], c, 0.85)); });
    return { defs: "", body: s };
  }

  // ---- the extension for vertical videos (tall-world px: the original is 720 lower) -----------
  /* The background over the whole tall world: the original's radial glow (the same gradient, in
   * user space, so it matches exactly where they overlap) and, for the scan, its grid. */
  function bandBackground(P, v, C) {
    var defs = '<radialGradient id="' + P + '-xbg" gradientUnits="userSpaceOnUse" cx="1920" cy="1652" r="3528" gradientTransform="translate(1920 1652) scale(1 0.5873) translate(-1920 -1652)"><stop offset="0" stop-color="' + C.bg[0] + '"/><stop offset="1" stop-color="' + C.bg[1] + '"/></radialGradient>';
    var s = tag("rect", { x: -2600, y: -900, width: 9040, height: 5400, fill: "url(#" + P + "-xbg)" });
    if (v === "scan") { var gr = ""; for (var x = -600; x < 4440; x += 120) gr += "M" + x + " -880 V4480 "; for (var y = -880; y < 4480; y += 120) gr += "M-600 " + y + " H4440 "; s += tag("path", { d: gr, stroke: "#1E4A70", "stroke-width": 2, opacity: 0.6 }); }
    return { defs: defs, body: s };
  }
  /* Floating cells (far) and capillaries (mid) above and below the original's. */
  function bandDrift(v, R, y0, y1) {
    var far = "", mid = "", cf = v === "scan" ? "#2A5E8A" : "#8E2A36", cm = v === "scan" ? "#2E6E9E" : "#B0404E";
    for (var i = 0; i < 16; i++) far += cell(-300 + R() * 4400, y0 + R() * (y1 - y0), 30 + R() * 50, cf, 0.35);
    for (var k = 0; k < 7; k++) { var x = -200 + R() * 4200, y = y0 + R() * (y1 - y0), d = "M" + r2(x) + " " + r2(y); for (var j = 0; j < 4; j++) { x += (R() - 0.5) * 400; y += (R() - 0.5) * 200; d += " Q" + r2(x + 60) + " " + r2(y - 80) + " " + r2(x) + " " + r2(y); } mid += tag("path", { d: d, stroke: cm, "stroke-width": 6 + R() * 6, fill: "none", opacity: 0.35, "stroke-linecap": "round" }); }
    return { far: far, mid: mid };
  }
  /* The top band (ground layer): the neck runs on up to the jaw (the original's neck top is at
   * y 420): the trachea with the larynx and the thyroid, the oesophagus behind, the carotid arteries
   * and jugular veins either side, the neck vertebrae and the hyoid bone, the lower jaw. */
  function drawTopBand(P, v, C, R) {
    var scan = v === "scan", sw = scan ? 6 : 5, op = scan ? 0.85 : 1, L = C.line, s = "";
    var defs = '<linearGradient id="' + P + '-xbody" gradientUnits="userSpaceOnUse" x1="915" y1="0" x2="2925" y2="0"><stop offset="0" stop-color="' + C.body + '"/><stop offset="1" stop-color="' + C.bodyD + '"/></linearGradient>';
    // the neck and the jaw: the original's neck ends in a little dome at y ~370 (its sides bulge to
    // x ~1690 / 2150), so the new neck is filled from y 850 along its outline (no line across it) and widens into
    // the jaw; only its sides are outlined, from where the original's outline stops
    var neck = "M1722 850 Q1700 600 1690 420 L1690 300 Q1690 200 1600 150 Q1520 110 1520 40 Q1540 -20 1920 -40 Q2300 -20 2320 40 Q2320 110 2240 150 Q2150 200 2150 300 L2150 420 Q2140 600 2118 850 Z";
    s += tag("path", { d: neck, fill: "url(#" + P + "-xbody)", opacity: scan ? 0.9 : 1 });
    s += tag("path", { d: "M1722 850 Q1700 600 1690 420 L1690 300 Q1690 200 1600 150 Q1520 110 1520 40 Q1540 -20 1920 -40 Q2300 -20 2320 40 Q2320 110 2240 150 Q2150 200 2150 300 L2150 420 Q2140 600 2118 850", stroke: scan ? C.line : C.bodyD, "stroke-width": scan ? 6 : 8, fill: "none", opacity: scan ? 0.9 : 1 });
    s += tag("path", { d: "M1600 150 Q1920 260 2240 150", stroke: scan ? C.line : C.bodyD, "stroke-width": 5, fill: "none", opacity: 0.6 }); // under the chin
    // the lower jaw (mandible) and the hyoid
    s += tag("path", { d: "M1560 60 Q1600 170 1920 190 Q2240 170 2280 60", stroke: C.bone, "stroke-width": 26, fill: "none", "stroke-linecap": "round", opacity: scan ? 0.6 : 0.45 });
    s += tag("path", { d: "M1840 236 Q1920 260 2000 236", stroke: C.bone, "stroke-width": 14, fill: "none", "stroke-linecap": "round", opacity: scan ? 0.6 : 0.5 });
    // the neck vertebrae behind (the original's spine starts at y 840)
    for (var vt = 1; vt <= 5; vt++) s += tag("rect", { x: MID - 46, y: 840 - vt * 92, width: 92, height: 70, rx: 18, fill: C.bone, opacity: scan ? 0.5 : 0.35 });
    // the jugular veins and the carotid arteries run down to the original's vena cava and arch
    // branches (they cross the seam unbroken)
    s += tag("path", { d: "M1770 230 Q1760 600 1860 1030 M2070 230 Q2090 700 2040 960 Q1980 1020 1870 1040", stroke: C.vein, "stroke-width": 30, fill: "none", "stroke-linecap": "round", opacity: op });
    s += tag("path", { d: "M1830 220 Q1820 700 1780 1190 M2010 220 Q2020 700 2030 1110", stroke: C.artery, "stroke-width": 22, fill: "none", "stroke-linecap": "round", opacity: op });
    s += tag("path", { d: "M1830 220 l-30 -60 M1830 220 l20 -70 M2010 220 l30 -60 M2010 220 l-20 -70", stroke: C.artery, "stroke-width": 12, fill: "none", "stroke-linecap": "round", opacity: op }); // the carotids divide under the jaw
    // the trachea: rings continued up to the larynx (Adam's apple), the thyroid gland across it
    s += tag("path", { d: "M" + MID + " 850 V250", stroke: C.trachea, "stroke-width": 70, fill: "none", "stroke-linecap": "round", opacity: op });
    for (var rg = -2; rg <= 5; rg++) s += tag("path", { d: "M" + (MID - 32) + " " + (700 - rg * 68) + " h64", stroke: scan ? C.line : "#E0B4A6", "stroke-width": 10, "stroke-linecap": "round" });
    s += tag("path", { d: "M" + (MID - 60) + " 250 L" + MID + " 330 L" + (MID + 60) + " 250 L" + (MID + 50) + " 200 H" + (MID - 50) + " Z", fill: scan ? C.trachea : "#F2C8B8", stroke: L, "stroke-width": sw, opacity: op }); // the larynx
    s += tag("path", { d: "M" + MID + " 520 C" + (MID - 40) + " 440 " + (MID - 150) + " 420 " + (MID - 140) + " 520 C" + (MID - 130) + " 600 " + (MID - 40) + " 600 " + MID + " 550 C" + (MID + 40) + " 600 " + (MID + 130) + " 600 " + (MID + 140) + " 520 C" + (MID + 150) + " 420 " + (MID + 40) + " 440 " + MID + " 520 Z",
      fill: scan ? C.liver : "#C2505A", stroke: scan ? C.liverD : "#7A2E2E", "stroke-width": sw, opacity: op }); // the thyroid
    return { defs: defs, body: s };
  }
  /* The bottom band (ground layer): the pelvis and the thighs: the body's outline widens over the
   * hips and divides into the legs; the pelvic bones and sacrum, the bladder, the large intestine's
   * ends (the caecum and appendix on the body's right, the sigmoid and rectum), the iliac arteries
   * and veins running on into the femoral ones, the femurs. */
  function drawBottomBand(P, v, C, R) {
    var scan = v === "scan", sw = scan ? 6 : 5, op = scan ? 0.85 : 1, L = C.line, s = "";
    // hips and thighs (the original's outline ends at y 3220 at x 1000 .. 2840)
    // (filled from y 2930 with the same gradient and tissue tint as the original, so it joins it;
    // only the sides are outlined, so no line runs across)
    var hips = "M1032 2930 Q1000 3100 1000 3220 Q980 3380 1060 3600 L1860 3600 Q1900 3460 1920 3420 Q1940 3460 1980 3600 L2780 3600 Q2860 3380 2840 3220 Q2840 3100 2808 2930 Z";
    s += tag("path", { d: hips, fill: "url(#" + P + "-xbody)", opacity: scan ? 0.9 : 1 });
    s += tag("path", { d: "M1032 2930 Q1000 3100 1000 3220 Q980 3380 1060 3600 M2780 3600 Q2860 3380 2840 3220 Q2840 3100 2808 2930 M1860 3600 Q1900 3460 1920 3420 Q1940 3460 1980 3600", stroke: scan ? C.line : C.bodyD, "stroke-width": scan ? 6 : 8, fill: "none", opacity: scan ? 0.9 : 1 });
    s += tag("path", { d: "M1182 2930 Q1170 3100 1260 3300 Q1600 3360 1920 3340 Q2240 3360 2580 3300 Q2670 3100 2658 2930 Z", fill: C.tissue, opacity: scan ? 0.5 : 0.55 });
    // the pelvic bones: two iliac wings, the sacrum, the pubic arch, the hip joints and femurs
    var bone = { fill: C.bone, opacity: scan ? 0.55 : 0.4 };
    s += tag("path", { d: "M1840 2980 Q1500 2880 1300 3000 Q1240 3120 1380 3200 Q1560 3260 1700 3240 Q1800 3180 1840 3100 Z", fill: bone.fill, opacity: bone.opacity });
    s += tag("path", { d: "M2000 2980 Q2340 2880 2540 3000 Q2600 3120 2460 3200 Q2280 3260 2140 3240 Q2040 3180 2000 3100 Z", fill: bone.fill, opacity: bone.opacity });
    s += tag("path", { d: "M1860 2960 H1980 L1960 3180 Q1920 3220 1880 3180 Z", fill: bone.fill, opacity: bone.opacity + 0.1 }); // the sacrum
    s += tag("path", { d: "M1560 3260 Q1920 3420 2280 3260", stroke: C.bone, "stroke-width": 40, fill: "none", opacity: bone.opacity });
    [[1430, 3300, -1], [2410, 3300, 1]].forEach(function (h) {
      s += tag("circle", { cx: h[0], cy: h[1], r: 52, fill: C.bone, opacity: bone.opacity + 0.15 });
      s += tag("path", { d: "M" + h[0] + " " + h[1] + " L" + (h[0] - h[2] * 40) + " 3360 L" + (h[0] - h[2] * 10) + " 3620", stroke: C.bone, "stroke-width": 56, fill: "none", "stroke-linecap": "round", opacity: bone.opacity + 0.05 });
    });
    // the bladder
    s += tag("path", { d: "M1790 3170 Q1780 3080 1920 3070 Q2060 3080 2050 3170 Q2040 3250 1920 3256 Q1800 3250 1790 3170 Z", fill: scan ? C.stomach : "#E9C46A", stroke: scan ? C.stomachD : "#B08A3A", "stroke-width": sw, opacity: op });
    // the large intestine's ends: the caecum and appendix (viewer's left), the sigmoid and rectum
    s += tag("path", { d: "M1300 2870 Q1300 2960 1380 2980", stroke: C.colon, "stroke-width": 90, fill: "none", "stroke-linecap": "round", opacity: op }) +
      tag("path", { d: "M1350 3010 q-20 60 10 100", stroke: C.colon, "stroke-width": 26, fill: "none", "stroke-linecap": "round", opacity: op }); // appendix
    s += tag("path", { d: "M2540 2870 Q2540 2990 2360 3000 Q2160 3010 2080 3060 Q1990 3120 1990 3300", stroke: C.colon, "stroke-width": 80, fill: "none", "stroke-linecap": "round", opacity: op });
    s += tag("path", { d: "M2540 2870 Q2540 2990 2360 3000 Q2160 3010 2080 3060 Q1990 3120 1990 3300", stroke: C.gutD, "stroke-width": 80, fill: "none", "stroke-dasharray": "6 60", opacity: 0.6 });
    // the iliac vessels running into the femoral ones (the original's aorta divides at y ~2610)
    s += tag("path", { d: "M1840 2920 Q1640 3120 1520 3350 L1480 3620 M2140 2920 Q2240 3120 2320 3350 L2360 3620", stroke: C.artery, "stroke-width": 30, fill: "none", "stroke-linecap": "round", opacity: op });
    s += tag("path", { d: "M1870 2900 Q1700 3120 1580 3350 L1550 3620 M2110 2900 Q2200 3120 2270 3350 L2300 3620", stroke: C.vein, "stroke-width": 26, fill: "none", "stroke-linecap": "round", opacity: op * 0.9 });
    // small intestine loops run on a little below the original's (they end at y ~2880)
    s += tag("path", { d: "M1460 2970 Q1900 3020 2380 2980", stroke: C.gut, "stroke-width": 64, fill: "none", "stroke-linecap": "round", opacity: op });
    return { defs: "", body: s };
  }
  function mountBands(X, P, v, C, seed) {
    var bg = bandBackground(P, v, C), top = drawTopBand(P, v, C, D.rng(seed + 31)), bot = drawBottomBand(P, v, C, D.rng(seed + 32));
    var up = bandDrift(v, D.rng(seed + 33), -100, 520), dn = bandDrift(v, D.rng(seed + 34), 3080, 3700);
    PL.band(X.over.sky, "top", bg.defs, bg.body);
    PL.band(X.over.far, "top", "", up.far); PL.band(X.over.far, "bottom", "", dn.far);
    PL.band(X.over.mid, "top", "", up.mid); PL.band(X.over.mid, "bottom", "", dn.mid);
    PL.band(X.over.ground, "top", top.defs, top.body);
    PL.band(X.over.ground, "bottom", "", bot.body);
    var c = v === "scan" ? "#3E8EC0" : "#D63A46";
    var fr = "";
    [[300, 300, 90], [3500, 500, 70], [400, 3300, 110], [3450, 3200, 90]].forEach(function (q, i) { fr += tag("g", { "data-xcell": i, transform: "translate(" + q[0] + " " + q[1] + ")" }, cell(0, 0, q[2], c, 0.85)); });
    PL.band(X.over.front, "top", "", fr);
    var cells = [].slice.call(X.over.front.querySelectorAll("[data-xcell]")).map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    return function (t) { cells.forEach(function (c2, k) { c2.e.setAttribute("transform", c2.base + " translate(" + r2(D.wobble(t, k + 20, 0.3) * 40) + " " + r2(D.wobble(t, k + 29, 0.25) * 40) + ") rotate(" + r2(t * (5 + k * 3)) + ")"); }); };
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place inside-body: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-inside-body";
    var seed = opts.seed === undefined ? 16 : opts.seed | 0;
    var C = PAL[v];
    var parts = { sky: drawSky(P, v, C, D.rng(seed + 1)), far: drawFar(P, v, C, D.rng(seed + 2)), mid: drawMid(P, v, C, D.rng(seed + 3)), ground: drawGround(P, v, C, D.rng(seed + 4)), front: drawFront(P, v, C, D.rng(seed + 5)) };
    var g = {};
    var X = PL.extendLayers(layers, opts, meta);
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(X.layers[name], "inside-body-" + name, parts[name].defs, parts[name].body); });
    var bandsUpdate = X.on ? mountBands(X, P, v, C, seed) : null; // the bands above and below (tall-world px)
    var q = function (sel) { return g.ground.querySelector('[data-part="' + sel + '"]'); };
    var heart = q("heart"), glow = q("heart-glow"), lungs = q("lungs"), stomach = q("stomach"), scanline = q("scanline");
    var cells = [].slice.call(g.front.querySelectorAll("[data-cell]")).map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    var about = function (x, y, sx, sy) { return "translate(" + x + " " + y + ") scale(" + r2(sx) + " " + r2(sy) + ") translate(" + -x + " " + -y + ")"; };

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      if (bandsUpdate) bandsUpdate(t);
      // heartbeat: about 72 a minute, a quick double thump
      var ph = (t * 1.2) % 1, beat = Math.exp(-Math.pow((ph - 0.08) / 0.05, 2)) * 0.07 + Math.exp(-Math.pow((ph - 0.28) / 0.06, 2)) * 0.045;
      heart.setAttribute("transform", about(HEART.x, HEART.y, 1 + beat, 1 + beat));
      glow.setAttribute("opacity", r2(0.6 + beat * 6));
      var br = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI / 4.5); // a breath every 4.5 s
      lungs.setAttribute("transform", about(MID, 380, 1 + 0.025 * br, 1 + 0.045 * br));
      stomach.setAttribute("transform", about(2300, 1400, 1 + 0.015 * Math.sin(t * 1.3), 1 - 0.015 * Math.sin(t * 1.3)));
      if (scanline) scanline.setAttribute("transform", "translate(0 " + r2(A.wrap(t * 260, 0, 2300)) + ")");
      cells.forEach(function (c, k) { c.e.setAttribute("transform", c.base + " translate(" + r2(D.wobble(t, k, 0.3) * 40) + " " + r2(D.wobble(t, k + 9, 0.25) * 40) + ") rotate(" + r2(t * (6 + k * 3)) + ")"); });
    }
    var a = anchorsFor(opts);
    update(0, X.ref);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places["inside-body"] = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
