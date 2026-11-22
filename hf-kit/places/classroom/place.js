/* Place "classroom": a bright school classroom. Two tall windows on the left (sky, the school field
 * and a tree outside, each on its own parallax layer) over a low bookcase with a globe and plants; a
 * big green chalkboard with chalk sketches at its edges (the middle kept clear) under paper bunting
 * and a clock; a pin board and a world map on the right; the teacher's desk with an apple and books;
 * rows of pupils' desks on a wooden floor; ceiling lights. Chair backs and a school bag frame the
 * foreground.
 *
 * Variants: day (default), afternoon (low golden sun, long beams across the floor). Anchors
 * (ground-layer world px, 3840 x 2160 world):
 *   board   the clear middle of the chalkboard (a diagram or a word goes here)
 *   desk    the teacher's desk top
 *   front   the floor in front of the board, where the teacher stands
 *   window  the centre of the right-hand window
 *   seats   the top of a pupil's desk in the first row
 * Path: aisle (along the front of the room, left to right).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("classroom/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "classroom",
    description: "Bright classroom: tall windows, a green chalkboard, bunting, a pin board and map, the teacher's desk, pupils' desks.",
    variants: ["day", "afternoon"],
    anchors: ["board", "desk", "front", "window", "seats"],
    paths: ["aisle"],
    actorScale: 1.6, // an actor on the floor (about 620 world px tall)
    actorLight: {
      day: { tint: "#FFF4E4", amount: 0.08 },
      afternoon: { tint: "#FFB070", amount: 0.3, rim: "#FFD08A", rimSide: -1 }, // low sun through the windows at the left
    },
  };

  var G = {
    ceiling: 170, floor: 1500,
    wins: [{ x: 110, y: 380, w: 440, h: 720 }, { x: 680, y: 380, w: 440, h: 720 }],
    board: { x: 1320, y: 430, w: 1460, h: 640 },
    pin: { x: 2960, y: 450, w: 470, h: 400 }, map: { x: 2960, y: 920, w: 470, h: 300 },
    desk: { x0: 2620, x1: 3260, top: 1380, base: 1640 },
    rows: [{ y: 1930, xs: [420, 1060, 2860, 3500] }],
  };

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    var aisle = [];
    for (var x = 260; x <= 3580; x += 332) aisle.push({ x: x, y: 1680 });
    var W = G.wins[1];
    return {
      anchors: {
        board: fixed(G.board.x + G.board.w / 2, G.board.y + G.board.h / 2), desk: fixed(2900, G.desk.top), front: fixed(1780, 1680),
        window: fixed(W.x + W.w / 2, W.y + W.h / 2), seats: fixed(1060, G.rows[0].y - 236),
      },
      paths: { aisle: aisle },
    };
  }

  var LOOK = {
    day: { sky: [[0, "#4F9FE0"], [0.6, "#A3D4F0"], [1, "#E9F6EE"]], room: function (c) { return c; }, sun: false },
    afternoon: { sky: [[0, "#4A6FB0"], [0.5, "#E9A178"], [0.85, "#FFC982"], [1, "#FFE2A8"]], room: function (c) { return D.mix(D.shade(c, 0.06), "#E8904A", 0.16); }, sun: true },
  };

  function drawSky(P, v, L, R) {
    var defs = S.lin(P + "-sky", L.sky) + S.rad(P + "-sun", [[0, "#FFF6D0", 1], [0.3, "#FFD27A", 0.6], [1, "#FFD27A", 0]]);
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: L.sky[L.sky.length - 1][1] }) + tag("rect", { x: -2600, y: -1600, width: 9040, height: 1900, fill: L.sky[0][1] });
    s += tag("rect", { x: -2600, y: 300, width: 9040, height: 1000, fill: "url(#" + P + "-sky)" });
    var sx = L.sun ? 820 : 1100, sy = L.sun ? 900 : 500;
    s += tag("circle", { cx: sx, cy: sy, r: 380, fill: "url(#" + P + "-sun)" }) + tag("circle", { cx: sx, cy: sy, r: 74, fill: "#FFF6D0" });
    var pal = L.sun ? { cloud: "#FFD1B0", cloudShade: "#D98C7A", cloudLight: "#FFE9CF" } : { cloud: "#FFFFFF", cloudShade: "#DCEBF6", cloudLight: "#FFFDF4" };
    s += A.cloud(1250, 560, 0.55, pal, 0) + A.cloud(1800, 700, 0.45, pal, 1) + A.cloud(2300, 520, 0.6, pal, 2);
    return { defs: defs, body: s };
  }
  function drawFar(P, v, L, R) {
    var s = tag("path", { d: smooth([[-600, 1060], [200, 980], [900, 1040], [1600, 960], [2400, 1050], [3200, 990]], false) + " L3200 2400 L-600 2400 Z", fill: L.room("#9CC9A8") });
    s += tag("rect", { x: -600, y: 1080, width: 3800, height: 1400, fill: L.room("#86BE63") });
    // the school field: a running track and goal posts
    s += tag("ellipse", { cx: 1100, cy: 1150, rx: 900, ry: 60, fill: "none", stroke: L.room("#D9774A"), "stroke-width": 26 }) + tag("ellipse", { cx: 1100, cy: 1150, rx: 900, ry: 60, fill: "none", stroke: "#FFFFFF", "stroke-width": 3, opacity: 0.7 });
    s += tag("path", { d: "M1700 1150 V1060 H1840 V1150", stroke: "#FFFFFF", "stroke-width": 8, fill: "none" });
    for (var i = 0; i < 12; i++) s += A.tree(-300 + i * 300 + R() * 80, 1010 + R() * 20, 40 + R() * 20, L.room, 30 + i, false);
    return { defs: "", body: s };
  }
  function drawMid(P, v, L, R) {
    return { defs: "", body: A.tree(980, 820, 200, L.room, 12, true) + A.tree(260, 980, 120, L.room, 13, true) };
  }

  function chalk(d, w) { return tag("path", { d: d, stroke: "#F4F6F0", "stroke-width": w || 6, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.85 }); }

  function drawGround(P, v, L, R) {
    var room = L.room;
    var defs = S.lin(P + "-wall", [[0, room("#F5EBD6")], [1, room("#EBDDC0")]]) + S.lin(P + "-floor", [[0, room("#D2A26E")], [1, room("#B5814E")]]) +
      S.lin(P + "-board", [[0, room("#2F6B4F")], [1, room("#255940")]]) + S.lin(P + "-beam", [[0, "#FFF1C9", L.sun ? 0.5 : 0.3], [1, "#FFF1C9", 0]], [0, 0, 1, 1]) +
      S.rad(P + "-glow", [[0, "#FFF3C4", 0.6], [1, "#FFF3C4", 0]]);
    var s = "", B = G.floor;
    var cut = G.wins.map(function (W) { return " M" + W.x + " " + W.y + " V" + (W.y + W.h) + " H" + (W.x + W.w) + " V" + W.y + " Z"; }).join("");
    s += tag("path", { d: "M-300 -300 H4140 V" + B + " H-300 Z" + cut, fill: "url(#" + P + "-wall)", "fill-rule": "evenodd" });
    s += tag("rect", { x: -300, y: 1180, width: 4440, height: B - 1180, fill: room("#E9C46A"), opacity: 0.55 }) + tag("rect", { x: -300, y: 1170, width: 4440, height: 14, fill: room("#C9A24A") });
    s += tag("rect", { x: -300, y: -300, width: 4440, height: G.ceiling + 300, fill: room("#F7F1E4") }) + tag("rect", { x: -300, y: G.ceiling - 16, width: 4440, height: 16, fill: room("#DCCDB0") });
    // ceiling lights
    [700, 2050, 3400].forEach(function (lx) {
      s += tag("rect", { x: lx - 260, y: G.ceiling, width: 520, height: 34, rx: 8, fill: room("#E9ECEF"), stroke: room("#ADB5BD"), "stroke-width": 4 }) + tag("rect", { x: lx - 240, y: G.ceiling + 28, width: 480, height: 10, rx: 4, fill: "#FFFBEA" });
      if (!L.sun) s += tag("ellipse", { cx: lx, cy: G.ceiling + 120, rx: 520, ry: 160, fill: "url(#" + P + "-glow)" });
    });
    // windows: frames, sills, a blind
    G.wins.forEach(function (W, i) {
      var fr = room("#FFFCF5");
      s += tag("rect", { x: W.x - 24, y: W.y - 24, width: W.w + 48, height: W.h + 48, rx: 6, fill: "none", stroke: fr, "stroke-width": 30 });
      s += tag("path", { d: "M" + (W.x + W.w / 2) + " " + W.y + " V" + (W.y + W.h) + " M" + W.x + " " + (W.y + W.h * 0.35) + " H" + (W.x + W.w), stroke: fr, "stroke-width": 16 });
      s += A.glint(W.x, W.y + W.h * 0.35, W.w / 2, W.h * 0.65, 0.22);
      s += tag("rect", { x: W.x - 30, y: W.y - 60, width: W.w + 60, height: 50 + (i ? 120 : 40), rx: 4, fill: room("#F2E2B8"), stroke: room("#C9B07A"), "stroke-width": 4 });
      for (var sl = W.y - 50; sl < W.y + (i ? 100 : 20); sl += 18) s += tag("path", { d: "M" + (W.x - 26) + " " + sl + " H" + (W.x + W.w + 26), stroke: room("#C9B07A"), "stroke-width": 2, opacity: 0.6 });
      s += tag("rect", { x: W.x - 50, y: W.y + W.h + 20, width: W.w + 100, height: 26, rx: 5, fill: room("#F7EEDD"), stroke: room("#C2AE8A"), "stroke-width": 4 });
    });
    // low bookcase under the windows with a globe and plants
    s += tag("rect", { x: 60, y: 1200, width: 1120, height: B - 1200, rx: 8, fill: room("#B98552"), stroke: room("#7A5230"), "stroke-width": 6 });
    s += tag("path", { d: "M80 1350 H1160", stroke: room("#7A5230"), "stroke-width": 8 });
    var bx = 90, cols = ["#C0504D", "#4F81BD", "#9BBB59", "#E8A33C", "#8064A2", "#2BA3A8"];
    while (bx < 1140) { var bw = 26 + R() * 20, bh = 100 + R() * 40; s += tag("rect", { x: bx, y: 1346 - bh, width: bw, height: bh, rx: 3, fill: room(cols[(R() * 6) | 0]), stroke: room("#3A2F28"), "stroke-width": 3 }); bx += bw + 5; if (bx > 500 && bx < 700) bx = 720; }
    bx = 90;
    while (bx < 1140) { var bw2 = 30 + R() * 22, bh2 = 90 + R() * 40; s += tag("rect", { x: bx, y: B - 20 - bh2, width: bw2, height: bh2, rx: 3, fill: room(cols[(R() * 6) | 0]), stroke: room("#3A2F28"), "stroke-width": 3 }); bx += bw2 + 5; }
    s += tag("path", { d: "M600 1200 v-30 h40 v30 M590 1172 h60", stroke: room("#6B4A2F"), "stroke-width": 8, fill: "none" }) + tag("circle", { cx: 620, cy: 1080, r: 88, fill: room("#4C9ED9"), stroke: room("#2F5E8C"), "stroke-width": 5 }) +
      tag("path", { d: "M570 1040 q30 -20 50 0 q10 30 -20 40 q-30 10 -30 -40 Z M630 1090 q40 -20 50 20 q-20 30 -40 10 Z", fill: room("#6DB552") }) + tag("path", { d: "M620 978 a102 102 0 0 1 0 204", stroke: room("#8C6A4A"), "stroke-width": 8, fill: "none" });
    [[220, 1200], [1040, 1200]].forEach(function (q) {
      s += tag("path", { d: "M" + (q[0] - 50) + " " + q[1] + " l10 -70 h80 l10 70 Z", fill: room("#E07A4F"), stroke: room("#8E4325"), "stroke-width": 4 });
      for (var lf = 0; lf < 6; lf++) s += tag("ellipse", { cx: q[0] + (lf - 2.5) * 16, cy: q[1] - 110 - (lf % 2) * 20, rx: 16, ry: 44, fill: room(lf % 2 ? "#4E9A48" : "#6DB552"), transform: "rotate(" + ((lf - 2.5) * 16) + " " + (q[0] + (lf - 2.5) * 16) + " " + (q[1] - 90) + ")" });
    });
    // paper bunting across the top of the board
    var Bd = G.board, bun = "";
    for (var f = 0; f < 15; f++) {
      var fx = Bd.x - 40 + f * 104, sag = Math.sin((f + 0.5) / 15 * Math.PI) * 40;
      bun += tag("path", { d: "M" + fx + " " + r2(340 + sag) + " l90 " + r2(Math.sin((f + 1.5) / 15 * Math.PI) * 40 - sag) + " l-40 74 Z", fill: room(["#FF6B6B", "#FFD43B", "#4DABF7", "#69DB7C", "#B197FC"][f % 5]) });
    }
    s += tag("path", { d: "M" + (Bd.x - 40) + " 340 Q" + (Bd.x + Bd.w / 2) + " 420 " + (Bd.x + Bd.w + 60) + " 340", stroke: room("#8C6A4A"), "stroke-width": 4, fill: "none" }) + bun;
    // chalkboard
    s += tag("rect", { x: Bd.x - 34, y: Bd.y - 34, width: Bd.w + 68, height: Bd.h + 68, rx: 12, fill: room("#B98552"), stroke: room("#7A5230"), "stroke-width": 6 });
    s += tag("rect", { x: Bd.x, y: Bd.y, width: Bd.w, height: Bd.h, rx: 4, fill: "url(#" + P + "-board)" });
    s += tag("path", { d: "M" + (Bd.x + 40) + " " + (Bd.y + 60) + " q300 60 600 10 M" + (Bd.x + 700) + " " + (Bd.y + 520) + " q300 -30 700 20", stroke: "#FFFFFF", "stroke-width": 40, opacity: 0.05, fill: "none" }); // old smudges
    // sketches at the left and right edges: an orbit, a plant, a triangle, a little graph
    var ox = Bd.x + 170, oy = Bd.y + 170;
    s += chalk("M" + (ox - 110) + " " + oy + " a110 50 0 1 0 220 0 a110 50 0 1 0 -220 0") + tag("circle", { cx: ox, cy: oy, r: 30, fill: "#FFD43B", opacity: 0.85 }) + tag("circle", { cx: ox + 108, cy: oy + 12, r: 14, fill: "#74C0FC", opacity: 0.9 });
    s += chalk("M" + (Bd.x + 90) + " " + (Bd.y + 540) + " L" + (Bd.x + 200) + " " + (Bd.y + 360) + " L" + (Bd.x + 310) + " " + (Bd.y + 540) + " Z") + chalk("M" + (Bd.x + 200) + " " + (Bd.y + 360) + " V" + (Bd.y + 540), 4);
    var gx = Bd.x + Bd.w - 330, gy = Bd.y + 300;
    s += chalk("M" + gx + " " + (gy - 200) + " V" + gy + " H" + (gx + 240)) + chalk("M" + (gx + 10) + " " + (gy - 20) + " Q" + (gx + 100) + " " + (gy - 40) + " " + (gx + 140) + " " + (gy - 120) + " T" + (gx + 230) + " " + (gy - 190), 5);
    s += chalk("M" + (gx + 120) + " " + (Bd.y + 560) + " v-110 M" + (gx + 120) + " " + (Bd.y + 480) + " q-50 -10 -60 -60 q50 0 60 50 M" + (gx + 120) + " " + (Bd.y + 500) + " q40 -20 60 -60 q-50 0 -60 50", 5);
    s += chalk("M" + (gx + 60) + " " + (Bd.y + 570) + " h120", 5);
    // chalk tray, chalk and a duster
    s += tag("rect", { x: Bd.x - 20, y: Bd.y + Bd.h + 30, width: Bd.w + 40, height: 22, rx: 6, fill: room("#9C6B45"), stroke: room("#6B4A2F"), "stroke-width": 4 });
    s += tag("rect", { x: Bd.x + 300, y: Bd.y + Bd.h + 18, width: 46, height: 12, rx: 6, fill: "#FFFFFF" }) + tag("rect", { x: Bd.x + 380, y: Bd.y + Bd.h + 18, width: 40, height: 12, rx: 6, fill: "#FFD43B" }) +
      tag("rect", { x: Bd.x + Bd.w - 360, y: Bd.y + Bd.h + 4, width: 120, height: 28, rx: 6, fill: room("#8C6A4A") }) + tag("rect", { x: Bd.x + Bd.w - 360, y: Bd.y + Bd.h + 20, width: 120, height: 12, fill: room("#DEE2E6") });
    // clock above the board's right end
    s += tag("circle", { cx: 2960, cy: 300, r: 62, fill: room("#FFFDF7"), stroke: room("#C0504D"), "stroke-width": 10 }) + tag("g", { "data-part": "clock" }, "");
    // pin board with papers and the world map
    var Pn = G.pin;
    s += tag("rect", { x: Pn.x, y: Pn.y, width: Pn.w, height: Pn.h, rx: 8, fill: room("#C8935C"), stroke: room("#8C5E3C"), "stroke-width": 10 });
    [[30, 30, 130, 160, "#FFF3BF", -4], [180, 24, 120, 120, "#D0EBFF", 3], [320, 40, 120, 150, "#FFDEEB", -2], [40, 220, 160, 150, "#D3F9D8", 2], [230, 180, 210, 190, "#FFFFFF", -3]].forEach(function (q, i) {
      var x = Pn.x + q[0], y = Pn.y + q[1];
      s += tag("g", { transform: "rotate(" + q[5] + " " + (x + q[2] / 2) + " " + (y + q[3] / 2) + ")" }, tag("rect", { x: x, y: y, width: q[2], height: q[3], fill: room(q[4]), stroke: room("#BFA98A"), "stroke-width": 2 }) +
        (i === 4 ? tag("path", { d: "M" + (x + 105) + " " + (y + 30) + " l24 50 l54 6 l-40 36 l12 54 l-50 -28 l-50 28 l12 -54 l-40 -36 l54 -6 Z", fill: room("#FFD43B"), stroke: room("#E8A33C"), "stroke-width": 3 }) :
          tag("path", { d: "M" + (x + 16) + " " + (y + 40) + " h" + (q[2] - 40) + " M" + (x + 16) + " " + (y + 70) + " h" + (q[2] - 60) + " M" + (x + 16) + " " + (y + 100) + " h" + (q[2] - 50), stroke: room("#868E96"), "stroke-width": 5, "stroke-linecap": "round" })) +
        tag("circle", { cx: x + q[2] / 2, cy: y + 10, r: 9, fill: room(["#E03131", "#1C7ED6", "#2F9E44", "#F08C00", "#AE3EC9"][i]) }));
    });
    var Mp = G.map;
    s += tag("rect", { x: Mp.x, y: Mp.y, width: Mp.w, height: Mp.h, rx: 6, fill: room("#A5D8FF"), stroke: room("#F8F9FA"), "stroke-width": 14 });
    s += tag("path", { d: "M" + (Mp.x + 50) + " " + (Mp.y + 70) + " q40 -40 100 -20 q30 30 10 70 q-30 40 -20 80 q-40 20 -60 -30 q-40 -40 -30 -100 Z", fill: room("#8CE99A"), stroke: room("#2F9E44"), "stroke-width": 3 }) +
      tag("path", { d: "M" + (Mp.x + 220) + " " + (Mp.y + 50) + " q60 -20 120 10 q50 10 70 50 q-30 30 -80 20 q-20 60 -70 70 q-30 -50 -20 -90 q-40 -20 -20 -60 Z", fill: room("#FFE066"), stroke: room("#E8A33C"), "stroke-width": 3 }) +
      tag("path", { d: "M" + (Mp.x + 360) + " " + (Mp.y + 200) + " q40 -10 50 30 q-20 30 -60 20 Z", fill: room("#FFA8A8"), stroke: room("#E03131"), "stroke-width": 3 });
    // door at the far right
    s += tag("rect", { x: 3560, y: 600, width: 340, height: B - 600, fill: room("#4F8F86"), stroke: room("#2F5E58"), "stroke-width": 6 }) + tag("rect", { x: 3620, y: 670, width: 220, height: 260, rx: 6, fill: room("#CDEAF5"), stroke: room("#2F5E58"), "stroke-width": 6 }) + tag("circle", { cx: 3600, cy: 1080, r: 14, fill: room("#E7C46A") });
    // floor
    s += tag("rect", { x: -300, y: B, width: 4440, height: 1000, fill: "url(#" + P + "-floor)" });
    var rows = [1530, 1575, 1630, 1700, 1790, 1900, 2040, 2210], pl = "";
    rows.forEach(function (yy, i) { pl += "M-300 " + yy + " H4140 "; var step = 280 + i * 60; for (var px = -300 + (i % 2) * step / 2; px < 4140; px += step) pl += "M" + px + " " + (i ? rows[i - 1] : B) + " V" + yy + " "; });
    s += tag("path", { d: pl, stroke: room("#9A6A3C"), "stroke-width": 3, opacity: 0.5 });
    s += tag("rect", { x: -300, y: B - 50, width: 4440, height: 50, fill: room("#8C6A4A") });
    // sunbeams through the windows across the floor
    G.wins.forEach(function (W) {
      var k = L.sun ? 1500 : 800;
      s += tag("path", { d: "M" + W.x + " " + (W.y + W.h) + " L" + (W.x + W.w) + " " + (W.y + W.h) + " L" + (W.x + W.w + k) + " 2160 L" + (W.x + k * 0.6) + " 2160 Z", fill: "url(#" + P + "-beam)" });
    });
    // the teacher's desk: apple, books, pencil cup
    var Dk = G.desk;
    s += tag("rect", { x: Dk.x0 + 20, y: Dk.base - 10, width: Dk.x1 - Dk.x0 - 40, height: 20, rx: 8, fill: "#000", opacity: 0.15 });
    s += tag("rect", { x: Dk.x0 + 30, y: Dk.top + 30, width: Dk.x1 - Dk.x0 - 60, height: Dk.base - Dk.top - 30, fill: room("#9C6B45"), stroke: room("#6B4A2F"), "stroke-width": 5 });
    s += tag("rect", { x: Dk.x1 - 240, y: Dk.top + 60, width: 180, height: 80, rx: 6, fill: room("#B98552"), stroke: room("#6B4A2F"), "stroke-width": 4 }) + tag("rect", { x: Dk.x1 - 180, y: Dk.top + 94, width: 60, height: 10, rx: 4, fill: room("#E7C46A") });
    s += tag("rect", { x: Dk.x0, y: Dk.top, width: Dk.x1 - Dk.x0, height: 36, rx: 8, fill: room("#B98552"), stroke: room("#6B4A2F"), "stroke-width": 5 });
    s += tag("circle", { cx: Dk.x0 + 90, cy: Dk.top - 34, r: 34, fill: room("#E03131"), stroke: room("#8A1C1C"), "stroke-width": 4 }) + tag("path", { d: "M" + (Dk.x0 + 90) + " " + (Dk.top - 66) + " q4 -16 14 -20 M" + (Dk.x0 + 96) + " " + (Dk.top - 76) + " q24 -10 30 6 q-20 10 -30 -6", stroke: room("#2F9E44"), "stroke-width": 5, fill: room("#51CF66") });
    s += book(Dk.x1 - 150, Dk.top, 120, 28, "#4F81BD", room) + book(Dk.x1 - 140, Dk.top - 28, 100, 26, "#E8A33C", room) + book(Dk.x1 - 160, Dk.top - 54, 130, 24, "#9BBB59", room);
    s += tag("path", { d: "M" + (Dk.x0 + 170) + " " + Dk.top + " l6 -70 h50 l6 70 Z", fill: room("#4C9ED9"), stroke: room("#2F5E8C"), "stroke-width": 4 }) + tag("path", { d: "M" + (Dk.x0 + 186) + " " + (Dk.top - 70) + " l-10 -50 M" + (Dk.x0 + 200) + " " + (Dk.top - 70) + " l4 -60 M" + (Dk.x0 + 214) + " " + (Dk.top - 70) + " l14 -44", stroke: room("#F08C00"), "stroke-width": 8, "stroke-linecap": "round" });
    // a carpet of coloured squares in the middle of the floor, in perspective
    var cy0 = 1790, cy1 = 2080, cx0 = 1420, cx1 = 2500, n = 8, m = 3, car = "";
    for (var cj = 0; cj < m; cj++) for (var ci = 0; ci < n; ci++) {
      var y0 = cy0 + (cy1 - cy0) * cj / m, y1 = cy0 + (cy1 - cy0) * (cj + 1) / m, sp = function (y) { return 1 + (y - cy0) / (cy1 - cy0) * 0.25; };
      var xa = function (k, y) { var c = (cx0 + cx1) / 2; return c + (cx0 + (cx1 - cx0) * k / n - c) * sp(y); };
      car += tag("path", { d: "M" + r2(xa(ci, y0)) + " " + r2(y0) + " L" + r2(xa(ci + 1, y0)) + " " + r2(y0) + " L" + r2(xa(ci + 1, y1)) + " " + r2(y1) + " L" + r2(xa(ci, y1)) + " " + r2(y1) + " Z",
        fill: room(["#FF8787", "#FFD43B", "#74C0FC", "#8CE99A", "#B197FC", "#FFA94D"][(ci + cj * 2) % 6]), stroke: room("#F8F1E4"), "stroke-width": 6 });
    }
    s += tag("path", { d: "M" + r2(cx0 - 30) + " " + (cy0 - 20) + " H" + r2(cx1 + 30) + " L" + r2(cx1 + 30 + (cx1 - cx0) * 0.125 + 20) + " " + (cy1 + 24) + " H" + r2(cx0 - 30 - (cx1 - cx0) * 0.125 - 20) + " Z", fill: room("#3D6E9E") }) + car;
    // pupils' desks (the middle stays clear for the teacher)
    G.rows.forEach(function (rw) {
      rw.xs.forEach(function (x, i) {
        var base = rw.y, top = base - 230;
        s += tag("ellipse", { cx: x, cy: base + 6, rx: 230, ry: 18, fill: "#000", opacity: 0.12 });
        s += tag("path", { d: "M" + (x - 170) + " " + top + " V" + base + " M" + (x + 170) + " " + top + " V" + base, stroke: room("#6C7A86"), "stroke-width": 14 });
        s += tag("rect", { x: x - 186, y: top + 20, width: 372, height: 110, rx: 6, fill: room("#6C7A86"), stroke: room("#47525C"), "stroke-width": 4 });
        s += tag("rect", { x: x - 160, y: top + 40, width: 120, height: 70, rx: 3, fill: room(["#C0504D", "#4F81BD", "#9BBB59", "#E8A33C"][i]) }) + tag("rect", { x: x - 30, y: top + 50, width: 90, height: 60, rx: 3, fill: room(["#8064A2", "#E8A33C", "#2BA3A8", "#C0504D"][i]) });
        s += tag("rect", { x: x - 210, y: top - 8, width: 420, height: 30, rx: 8, fill: room("#E2B77F"), stroke: room("#9C6B45"), "stroke-width": 5 });
        s += tag("rect", { x: x - 120, y: top - 22, width: 140, height: 14, rx: 3, fill: room(["#FFFFFF", "#FFF3BF", "#D0EBFF", "#FFDEEB"][i]), transform: "rotate(" + (i % 2 ? 3 : -4) + " " + (x - 50) + " " + top + ")" });
        s += tag("rect", { x: x + 50, y: top - 16, width: 90, height: 10, rx: 5, fill: room(["#F08C00", "#1C7ED6", "#2F9E44", "#AE3EC9"][i]) });
        // a pupil's chair beside it, three-quarter view: legs, seat, back with a curved backrest
        var cc = room(["#4DABF7", "#FF8787", "#69DB7C", "#FFD43B"][i]), cd = D.shade(cc, 0.35), steel = room("#6C7A86"), steelL = room("#8C99A3");
        var cx = x + 230;
        s += tag("path", { d: "M" + (cx + 34) + " " + (base - 20) + " L" + (cx + 40) + " " + (base - 176) + " M" + (cx + 176) + " " + (base - 20) + " L" + (cx + 170) + " " + (base - 176), stroke: steelL, "stroke-width": 9, "stroke-linecap": "round" });
        s += tag("path", { d: "M" + cx + " " + base + " L" + (cx + 6) + " " + (base - 156) + " M" + (cx + 142) + " " + base + " L" + (cx + 136) + " " + (base - 156), stroke: steel, "stroke-width": 11, "stroke-linecap": "round" });
        s += tag("path", { d: "M" + (cx - 10) + " " + (base - 150) + " L" + (cx + 150) + " " + (base - 150) + " L" + (cx + 184) + " " + (base - 182) + " L" + (cx + 24) + " " + (base - 182) + " Z", fill: cc, stroke: cd, "stroke-width": 5, "stroke-linejoin": "round" });
        s += tag("path", { d: "M" + (cx + 140) + " " + (base - 160) + " L" + (cx + 146) + " " + (base - 360) + " M" + (cx + 176) + " " + (base - 186) + " L" + (cx + 182) + " " + (base - 384), stroke: steel, "stroke-width": 10, "stroke-linecap": "round" });
        s += tag("path", { d: "M" + (cx + 130) + " " + (base - 300) + " Q" + (cx + 164) + " " + (base - 296) + " " + (cx + 196) + " " + (base - 324) + " L" + (cx + 196) + " " + (base - 400) + " Q" + (cx + 164) + " " + (base - 372) + " " + (cx + 130) + " " + (base - 376) + " Z", fill: cc, stroke: cd, "stroke-width": 5, "stroke-linejoin": "round" });
      });
    });
    return { defs: defs, body: s };
  }
  function book(x, y, w, h, c, room) { return tag("rect", { x: x, y: y - h, width: w, height: h, rx: 4, fill: room(c), stroke: room("#3A2F28"), "stroke-width": 3 }) + tag("rect", { x: x + 6, y: y - h + 4, width: w - 12, height: 5, fill: "#fff", opacity: 0.5 }); }

  function drawFront(P, v, L, R) {
    var room = L.room, s = "";
    // chair backs and a school bag in the bottom corners
    [[260, "#4DABF7"], [3620, "#FF8787"]].forEach(function (q) { // a pupil's chair seen from behind: backrest, uprights, seat, legs
      var c = room(q[1]), cd = D.shade(c, 0.35), steel = room("#6C7A86"), x = q[0];
      s += tag("path", { d: "M" + (x - 180) + " 2260 L" + (x - 170) + " 1930 M" + (x + 180) + " 2260 L" + (x + 170) + " 1930", stroke: steel, "stroke-width": 26, "stroke-linecap": "round" });
      s += tag("path", { d: "M" + (x - 230) + " 2140 H" + (x + 230) + " L" + (x + 250) + " 2180 H" + (x - 250) + " Z", fill: cd });
      s += tag("rect", { x: x - 240, y: 1860, width: 480, height: 170, rx: 40, fill: c, stroke: cd, "stroke-width": 8 });
      s += tag("rect", { x: x - 80, y: 1900, width: 160, height: 34, rx: 17, fill: cd, opacity: 0.75 });
      s += tag("path", { d: "M" + (x - 200) + " 1880 Q" + x + " 1866 " + (x + 200) + " 1880", stroke: D.tint(c, 0.35), "stroke-width": 12, fill: "none", "stroke-linecap": "round", opacity: 0.8 });
    });
    s += tag("rect", { x: 560, y: 2010, width: 250, height: 220, rx: 50, fill: room("#F08C00"), stroke: room("#9A5A00"), "stroke-width": 8 }) + tag("rect", { x: 600, y: 2090, width: 170, height: 90, rx: 20, fill: room("#FFA94D"), stroke: room("#9A5A00"), "stroke-width": 6 }) + tag("path", { d: "M620 2010 q65 -70 130 0", stroke: room("#9A5A00"), "stroke-width": 14, fill: "none" });
    s += tag("g", { "data-part": "motes" }, "");
    return { defs: "", body: s };
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place classroom: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-classroom";
    var seed = opts.seed === undefined ? 6 : opts.seed | 0;
    var L = LOOK[v];
    var parts = {
      sky: drawSky(P, v, L, D.rng(seed + 1)), far: drawFar(P, v, L, D.rng(seed + 2)), mid: drawMid(P, v, L, D.rng(seed + 3)),
      ground: drawGround(P, v, L, D.rng(seed + 4)), front: drawFront(P, v, L, D.rng(seed + 5)),
    };
    var g = {};
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(layers[name], "classroom-" + name, parts[name].defs, parts[name].body); });
    var clockG = g.ground.querySelector('[data-part="clock"]'), ink = L.room("#3A4651");
    var hh = D.el(clockG, "path", { stroke: ink, "stroke-width": 8, "stroke-linecap": "round" }), mh = D.el(clockG, "path", { stroke: ink, "stroke-width": 5, "stroke-linecap": "round" });
    var clouds = [].slice.call(g.sky.querySelectorAll("[data-cloud]")).map(function (e) { return { e: e, base: e.getAttribute("transform"), x0: +/translate\(([-\d.]+)/.exec(e.getAttribute("transform"))[1] }; });
    var moteG = g.front.querySelector('[data-part="motes"]'), MR = D.rng(seed + 21), motes = [];
    for (var i = 0; i < 18; i++) motes.push({ x: 200 + MR() * 1600, y: 1100 + MR() * 800, s: (MR() * 100) | 0, e: D.el(moteG, "circle", { r: 4 + MR() * 2, fill: "#FFF3C4", opacity: 0 }) });

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      var mins = (t / 60 + 0.15) % 1, hrs = (t / 720 + (L.sun ? 0.62 : 0.4)) % 1;
      hh.setAttribute("d", "M2960 300 L" + r2(2960 + Math.sin(hrs * 6.283) * 30) + " " + r2(300 - Math.cos(hrs * 6.283) * 30));
      mh.setAttribute("d", "M2960 300 L" + r2(2960 + Math.sin(mins * 6.283) * 46) + " " + r2(300 - Math.cos(mins * 6.283) * 46));
      clouds.forEach(function (c, k) { var x = A.wrap(c.x0 + t * (6 + k * 2), -400, 3200); c.e.setAttribute("transform", "translate(" + r2(x - c.x0) + " 0) " + c.base); });
      motes.forEach(function (m) { // dust in the sunbeams
        var lo = m.y - 500, hi = m.y + 300, my = A.wrap(m.y - t * 6, lo, hi), w = D.wobble(t, m.s, 0.4);
        m.e.setAttribute("cx", r2(m.x + w * 60 + (my - m.y) * -0.6));
        m.e.setAttribute("cy", r2(my));
        m.e.setAttribute("opacity", r2((0.3 + 0.3 * w) * A.wrapFade(my, lo, hi, 90)));
      });
    }
    var a = anchorsFor(opts);
    update(0, PL.REF);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places.classroom = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
