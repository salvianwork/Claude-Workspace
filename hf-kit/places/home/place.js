/* Place "home": a cosy open-plan living room and kitchen. On the left a tall bookshelf, a big
 * window with curtains over a sofa (a cat asleep on it), a coffee table on a rug and a floor lamp;
 * in the middle an inner door; on the right the kitchen: wall cabinets, a tiled splashback, a
 * counter with a sink, a hob with a steaming pot, a kettle, a fridge. Through the window: sky,
 * houses across the street and a garden tree, each on its own parallax layer. A big leafy plant and
 * a dining chair frame the foreground.
 *
 * Variants: day (default), evening (dusk outside, lamps on, warm pools of light). Anchors
 * (ground-layer world px, 3840 x 2160 world):
 *   sofa     the middle of the sofa seat (sit an actor here)
 *   table    the coffee table top (a prop goes here)
 *   kitchen  the clear middle of the kitchen counter
 *   window   the centre of the window
 *   door     the floor in front of the inner door (enter and leave)
 *   floor    the open floor in the middle of the room
 * Path: floor (across the room, left to right).
 *
 * Extended (vertical videos, mount with extended: true; meta.extend): 720 px drawn above and below,
 * anchors and paths 720 lower (see drawTopBand / drawBottomBand and src/world/place.js).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("home/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, A = PL.art, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "home",
    description: "Cosy living room and kitchen: bookshelf, window over a sofa, coffee table, inner door, kitchen counter, hob and fridge.",
    variants: ["day", "evening"],
    anchors: ["sofa", "table", "kitchen", "window", "door", "floor"],
    paths: ["floor"],
    actorScale: 1.6, // an actor on the floor (about 620 world px tall): the counter is hip high
    actorLight: {
      day: { tint: "#FFF4E4", amount: 0.08 },
      evening: { tint: "#FF9E5E", amount: 0.32, rim: "#FFD39A", rimSide: -1 }, // the floor lamp at the left
    },
    // the extension for vertical videos (place.js: mount with extended: true, world 3840 x 3600)
    extend: {
      top: { draws: "the ceiling continued up toward the viewer: exposed wooden rafters, a skylight over the kitchen, a turning ceiling fan with a light over the sofa, a macramé hanging plant, a smoke detector and a string of fairy lights", seamAllow: [] },
      bottom: { draws: "the plank floor continued toward the viewer (the window's sunbeam fading out in the day), a striped round rug with a dog asleep in its bed, a ball, slippers and a stack of books, and in front a knitted pouf, a floor vent and a basket with a blanket and balls of yarn", seamAllow: [] },
    },
  };

  var G = {
    ceiling: 170, floor: 1500,
    shelf: { x: 40, y: 330, w: 420, h: 1170 },
    win: { x: 820, y: 360, w: 800, h: 700 },
    sofa: { x0: 700, x1: 1740, seat: 1290, back: 1080 },
    table: { x0: 990, x1: 1460, top: 1600 },
    door: { x: 2060, y: 640, w: 360, h: 860 },
    kitchen: { x0: 2560, x1: 3440, top: 1190 },
    fridge: { x: 3480, w: 320, top: 880 },
    hob: 2760, sink: 3260,
  };

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    return PL.offsetAnchors(baseAnchors(opts), PL.extendOffset(meta, opts));
  }
  function baseAnchors(opts) {
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    var walk = [];
    for (var x = 300; x <= 3600; x += 330) walk.push({ x: x, y: 1860 });
    return {
      anchors: {
        sofa: fixed(1220, G.sofa.seat), table: fixed(1225, G.table.top), kitchen: fixed(3040, G.kitchen.top),
        window: fixed(G.win.x + G.win.w / 2, G.win.y + G.win.h / 2), door: fixed(G.door.x + G.door.w / 2, G.floor + 90), floor: fixed(1960, 1860),
      },
      paths: { floor: walk },
    };
  }

  var LOOK = {
    day: { sky: [[0, "#5AA9E6"], [0.6, "#A8D8F2"], [1, "#FFE9C2"]], room: function (c) { return c; }, lamp: false },
    evening: { sky: [[0, "#2B2F6B"], [0.45, "#7A4E8E"], [0.8, "#F08A5D"], [1, "#FFC27A"]], room: A.toner(0.2, "#7A4636", 0.2), lamp: true },
  };

  function drawSky(P, v, L, R) {
    var defs = S.lin(P + "-sky", L.sky) + S.rad(P + "-sun", [[0, "#FFF6D0", 1], [0.3, "#FFE08A", 0.6], [1, "#FFE08A", 0]]);
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: L.sky[L.sky.length - 1][1] }) + tag("rect", { x: -2600, y: -1600, width: 9040, height: 1900, fill: L.sky[0][1] });
    s += tag("rect", { x: -2600, y: 200, width: 9040, height: 1100, fill: "url(#" + P + "-sky)" });
    if (v === "day") {
      s += tag("circle", { cx: 1500, cy: 470, r: 360, fill: "url(#" + P + "-sun)" }) + tag("circle", { cx: 1500, cy: 470, r: 70, fill: "#FFF6D0" });
      s += A.cloud(1050, 560, 0.6, { cloud: "#FFFFFF", cloudShade: "#DCEBF6", cloudLight: "#FFFDF4" }, 0) + A.cloud(1950, 480, 0.5, { cloud: "#FFFFFF", cloudShade: "#DCEBF6", cloudLight: "#FFFDF4" }, 1);
    } else {
      s += A.stars(R, 50, 600, 200, 1500, 400) + tag("circle", { cx: 1650, cy: 900, r: 300, fill: "#FFB070", opacity: 0.35 });
      s += A.cloud(1100, 620, 0.55, { cloud: "#C9708A", cloudShade: "#8E4F78", cloudLight: "#FFB59A" }, 0);
    }
    return { defs: defs, body: s };
  }
  function drawFar(P, v, L, R) {
    // houses across the street, seen through the window
    var ev = v === "evening", s = tag("rect", { x: 0, y: 1060, width: 3840, height: 1400, fill: ev ? "#4A3E5C" : "#9CC9A8" });
    for (var h = 0; h < 8; h++) {
      var x = 300 + h * 240 + R() * 40, w = 180 + R() * 50, top = 860 + R() * 90, c = ["#F2D4B6", "#C9DCEB", "#F5E3A8", "#E8C0B0"][h % 4];
      s += tag("rect", { x: x, y: top, width: w, height: 1100 - top, fill: L.room(c) }) + tag("path", { d: "M" + (x - 16) + " " + top + " L" + (x + w / 2) + " " + (top - 90) + " L" + (x + w + 16) + " " + top + " Z", fill: L.room(["#A0523D", "#5E6B8C", "#8C6A4A"][h % 3]) });
      s += tag("rect", { x: x + w * 0.2, y: top + 40, width: w * 0.24, height: 52, fill: ev ? "#FFD27A" : "#BFDCEB" }) + tag("rect", { x: x + w * 0.56, y: top + 40, width: w * 0.24, height: 52, fill: ev && h % 2 ? "#FFD27A" : L.room("#BFDCEB") });
    }
    return { defs: "", body: s };
  }
  function drawMid(P, v, L, R) {
    // the garden: a hedge, a fence and a tree just outside
    var s = tag("rect", { x: 0, y: 1020, width: 3840, height: 1500, fill: L.room("#6FAE55") });
    for (var f = 400; f < 2400; f += 56) s += tag("rect", { x: f, y: 940, width: 34, height: 140, rx: 6, fill: L.room("#F4EBDC"), stroke: L.room("#B9A886"), "stroke-width": 3 });
    s += tag("path", { d: "M400 980 H2400 M400 1040 H2400", stroke: L.room("#E9DCC5"), "stroke-width": 12 });
    s += A.tree(1780, 760, 150, L.room, 4, true);
    for (var b = 0; b < 9; b++) s += tag("circle", { cx: 500 + b * 150 + R() * 40, cy: 1060 + R() * 20, r: 60 + R() * 30, fill: L.room(b % 2 ? "#4E9A48" : "#5DAA50") });
    return { defs: "", body: s };
  }

  function book(x, y, w, h, c, room) {
    return tag("rect", { x: x, y: y - h, width: w, height: h, rx: 3, fill: room(c), stroke: room("#3A2F28"), "stroke-width": 3 }) + tag("rect", { x: x + 4, y: y - h + 16, width: w - 8, height: 6, fill: "#fff", opacity: 0.45 });
  }

  function drawGround(P, v, L, R) {
    var room = L.room, ev = v === "evening";
    var defs = S.lin(P + "-wall", [[0, room("#F6E6CF")], [1, room("#EED6B6")]]) + S.lin(P + "-floor", [[0, room("#C98E5A")], [1, room("#A8703F")]]) +
      S.lin(P + "-tile", [[0, room("#E6F2EF")], [1, room("#D3E6E1")]]) + S.rad(P + "-glow", [[0, "#FFE0A0", 0.8], [1, "#FFE0A0", 0]]) +
      S.lin(P + "-beam", [[0, "#FFF1C9", ev ? 0 : 0.38], [1, "#FFF1C9", 0]], [0, 0, 1, 1]);
    var s = "", W = G.win, B = G.floor;
    // wall (window cut out), wallpaper motif, picture rail, skirting, ceiling, crown
    s += tag("path", { d: "M-300 -300 H4140 V" + B + " H-300 Z M" + W.x + " " + W.y + " V" + (W.y + W.h) + " H" + (W.x + W.w) + " V" + W.y + " Z", fill: "url(#" + P + "-wall)", "fill-rule": "evenodd" });
    for (var wx = -260; wx < 2500; wx += 90) for (var wy = 260; wy < B - 60; wy += 120) {
      var ox = (wy / 120) % 2 ? 45 : 0;
      if (wx + ox > W.x - 30 && wx + ox < W.x + W.w + 30 && wy > W.y - 30 && wy < W.y + W.h + 30) continue;
      s += tag("path", { d: "M" + (wx + ox) + " " + (wy - 10) + " l8 10 l-8 10 l-8 -10 Z", fill: room("#E2C29C"), opacity: 0.7 });
    }
    s += tag("rect", { x: -300, y: -300, width: 4440, height: G.ceiling + 300, fill: room("#F4E9D8") }) + tag("rect", { x: -300, y: G.ceiling - 20, width: 4440, height: 24, fill: room("#E2CFAE") });
    s += tag("rect", { x: -300, y: B - 60, width: 4440, height: 60, fill: room("#FFF8EC") }) + tag("rect", { x: -300, y: B - 64, width: 4440, height: 6, fill: room("#CDB58E") });
    // window: frame, sill, curtains, a plant on the sill
    var fr = room("#FFFCF5"), frL = room("#C2AE8A");
    s += tag("rect", { x: W.x - 26, y: W.y - 26, width: W.w + 52, height: W.h + 52, rx: 6, fill: "none", stroke: fr, "stroke-width": 32 });
    s += tag("path", { d: "M" + (W.x + W.w / 2) + " " + W.y + " V" + (W.y + W.h) + " M" + W.x + " " + (W.y + W.h * 0.42) + " H" + (W.x + W.w), stroke: fr, "stroke-width": 18 });
    s += tag("rect", { x: W.x - 60, y: W.y + W.h + 20, width: W.w + 120, height: 30, rx: 6, fill: room("#F7EEDD"), stroke: frL, "stroke-width": 4 });
    s += A.glint(W.x, W.y, W.w / 2, W.h * 0.42, ev ? 0.08 : 0.3);
    var curtain = function (x0, dir) {
      var c = room("#D9534F"), cd = D.shade(c, 0.25), out = "";
      out += tag("path", { d: "M" + x0 + " " + (W.y - 70) + " h" + (dir * 230) + " C" + (x0 + dir * 200) + " " + (W.y + 300) + " " + (x0 + dir * 120) + " " + (W.y + 600) + " " + (x0 + dir * 190) + " " + (W.y + W.h + 120) + " H" + x0 + " Z", fill: c, stroke: cd, "stroke-width": 5 });
      for (var k = 1; k < 4; k++) out += tag("path", { d: "M" + (x0 + dir * k * 50) + " " + (W.y - 60) + " C" + (x0 + dir * k * 46) + " " + (W.y + 300) + " " + (x0 + dir * k * 30) + " " + (W.y + 600) + " " + (x0 + dir * k * 44) + " " + (W.y + W.h + 110), stroke: cd, "stroke-width": 5, fill: "none", opacity: 0.6 });
      out += tag("path", { d: "M" + (x0 + dir * 150) + " " + (W.y + 420) + " q" + (dir * -60) + " 30 " + (dir * -150) + " 0", stroke: room("#E8B23A"), "stroke-width": 12, fill: "none" });
      return out;
    };
    s += tag("rect", { x: W.x - 120, y: W.y - 90, width: W.w + 240, height: 16, rx: 8, fill: room("#8C6A4A") });
    s += curtain(W.x - 100, 1) + curtain(W.x + W.w + 100, -1);
    var sill = W.y + W.h + 20;
    s += tag("path", { d: "M" + (W.x + 560) + " " + (sill - 50) + " h70 l-8 50 h-54 Z", fill: room("#5C9BD5"), stroke: room("#2F5E8C"), "stroke-width": 4 });
    for (var lf = 0; lf < 7; lf++) s += tag("ellipse", { cx: W.x + 595 + (lf - 3) * 14, cy: sill - 76 - (lf % 2) * 18, rx: 13, ry: 34, fill: room(lf % 2 ? "#4E9A48" : "#6DB552"), transform: "rotate(" + ((lf - 3) * 16) + " " + (W.x + 595 + (lf - 3) * 14) + " " + (sill - 70) + ")" });
    // bookshelf
    var Sh = G.shelf, wood = room("#9C6B45"), woodD = room("#6B4A2F");
    s += tag("rect", { x: Sh.x, y: Sh.y, width: Sh.w, height: Sh.h, rx: 8, fill: wood, stroke: woodD, "stroke-width": 6 });
    s += tag("rect", { x: Sh.x + 20, y: Sh.y + 20, width: Sh.w - 40, height: Sh.h - 40, fill: room("#7A5236") });
    var cols = ["#C0504D", "#4F81BD", "#9BBB59", "#E8A33C", "#8064A2", "#2BA3A8", "#F2C14E"];
    for (var k = 0; k < 5; k++) {
      var y = Sh.y + 230 + k * 220;
      s += tag("rect", { x: Sh.x + 10, y: y, width: Sh.w - 20, height: 20, fill: wood, stroke: woodD, "stroke-width": 3 });
      var bx = Sh.x + 30;
      while (bx < Sh.x + Sh.w - 60) {
        var bw = 26 + R() * 18, bh = 120 + R() * 70;
        if (k === 2 && bx > Sh.x + 220) { s += tag("circle", { cx: Sh.x + 320, cy: y - 60, r: 56, fill: room("#4C9ED9"), stroke: room("#2F5E8C"), "stroke-width": 4 }) + tag("path", { d: "M" + (Sh.x + 290) + " " + (y - 80) + " q30 -20 60 10 q-10 30 -40 26 Z", fill: room("#6DB552") }) + tag("rect", { x: Sh.x + 300, y: y - 8, width: 40, height: 8, fill: woodD }); break; }
        if (k === 4 && bx > Sh.x + 200) { s += tag("rect", { x: Sh.x + 230, y: y - 40, width: 140, height: 40, rx: 4, fill: room("#E8A33C"), stroke: room("#8A5A20"), "stroke-width": 3 }) + tag("rect", { x: Sh.x + 240, y: y - 74, width: 120, height: 34, rx: 4, fill: room("#4F81BD"), stroke: room("#2F5E8C"), "stroke-width": 3 }); break; }
        s += book(bx, y, bw, bh, cols[(R() * cols.length) | 0], room);
        bx += bw + 4;
      }
    }
    s += tag("path", { d: "M" + (Sh.x + 140) + " " + Sh.y + " h120 l-14 -90 h-92 Z", fill: room("#E07A4F"), stroke: room("#8E4325"), "stroke-width": 4 });
    for (var tv = 0; tv < 7; tv++) s += tag("path", { d: "M" + (Sh.x + 200) + " " + (Sh.y - 90) + " q" + ((tv - 3) * 40) + " -40 " + ((tv - 3) * 70) + " " + (20 + Math.abs(tv - 3) * 30), stroke: room("#3E8E41"), "stroke-width": 12, fill: "none", "stroke-linecap": "round" });
    // framed pictures and a clock
    s += tag("rect", { x: 1760, y: 470, width: 220, height: 170, rx: 6, fill: room("#FFFDF7"), stroke: room("#8C6A4A"), "stroke-width": 12 }) + tag("path", { d: "M1772 630 L1840 540 L1890 600 L1920 570 L1968 630 Z", fill: room("#6DB552") }) + tag("circle", { cx: 1920, cy: 520, r: 18, fill: room("#FFA94D") });
    s += tag("rect", { x: 1800, y: 700, width: 150, height: 190, rx: 6, fill: room("#FFFDF7"), stroke: room("#C0504D"), "stroke-width": 12 }) + tag("circle", { cx: 1875, cy: 780, r: 36, fill: room("#F2C14E") }) + tag("path", { d: "M1830 870 q45 -60 90 0 Z", fill: room("#4F81BD") });
    s += tag("circle", { cx: 2240, cy: 420, r: 76, fill: room("#FFFDF7"), stroke: room("#3A4651"), "stroke-width": 10 });
    for (var hr = 0; hr < 12; hr++) { var a = hr / 12 * Math.PI * 2; s += tag("circle", { cx: r2(2240 + Math.sin(a) * 58), cy: r2(420 - Math.cos(a) * 58), r: 4, fill: room("#3A4651") }); }
    s += tag("g", { "data-part": "clock" }, "");
    // inner door with frame
    var Dr = G.door;
    s += tag("rect", { x: Dr.x - 30, y: Dr.y - 30, width: Dr.w + 60, height: Dr.h + 30, fill: room("#FFF8EC"), stroke: room("#CDB58E"), "stroke-width": 4 });
    s += tag("rect", { x: Dr.x, y: Dr.y, width: Dr.w, height: Dr.h, fill: room("#B9825A"), stroke: room("#6B4A2F"), "stroke-width": 6 });
    s += tag("rect", { x: Dr.x + 40, y: Dr.y + 50, width: Dr.w - 80, height: 330, rx: 6, fill: "none", stroke: room("#8C5E3C"), "stroke-width": 6 }) + tag("rect", { x: Dr.x + 40, y: Dr.y + 440, width: Dr.w - 80, height: 360, rx: 6, fill: "none", stroke: room("#8C5E3C"), "stroke-width": 6 });
    s += tag("circle", { cx: Dr.x + Dr.w - 46, cy: Dr.y + 470, r: 14, fill: room("#E7C46A"), stroke: room("#8A6A20"), "stroke-width": 3 });
    // coat hooks by the door
    s += tag("path", { d: "M2470 760 h120", stroke: room("#6B4A2F"), "stroke-width": 14 }) + tag("path", { d: "M2490 760 q-50 160 10 300 q40 30 60 -20 q30 -150 -20 -280 Z", fill: room("#4F81BD"), stroke: room("#2F5E8C"), "stroke-width": 4 });
    // kitchen: splashback, wall cabinets, counter, hob, sink, fridge
    var Kc = G.kitchen;
    s += tag("rect", { x: Kc.x0, y: 720, width: Kc.x1 - Kc.x0, height: Kc.top - 720, fill: "url(#" + P + "-tile)" });
    for (var ty = 760; ty < Kc.top; ty += 60) s += tag("path", { d: "M" + Kc.x0 + " " + ty + " H" + Kc.x1, stroke: room("#B7CFC9"), "stroke-width": 3 });
    for (var tx = Kc.x0 + 40; tx < Kc.x1; tx += 80) for (var ty2 = 720; ty2 < Kc.top; ty2 += 120) s += tag("path", { d: "M" + tx + " " + ty2 + " v60 M" + (tx + 40) + " " + (ty2 + 60) + " v60", stroke: room("#B7CFC9"), "stroke-width": 3 });
    for (var c = 0; c < 4; c++) {
      var cx = Kc.x0 + c * 220;
      s += tag("rect", { x: cx + 6, y: 300, width: 208, height: 340, rx: 8, fill: room("#7FB3A8"), stroke: room("#4E7F75"), "stroke-width": 5 }) + tag("rect", { x: cx + 26, y: 320, width: 168, height: 300, rx: 6, fill: "none", stroke: room("#5E968B"), "stroke-width": 4 }) + tag("rect", { x: cx + 96, y: 590, width: 28, height: 10, rx: 4, fill: room("#E7C46A") });
    }
    s += tag("rect", { x: Kc.x0 - 10, y: 640, width: Kc.x1 - Kc.x0 + 20, height: 20, fill: room("#5E968B") });
    // hanging utensils under the cabinets
    [2980, 3040, 3100].forEach(function (ux, i) { s += tag("path", { d: "M" + ux + " 660 v80", stroke: room("#5F6E78"), "stroke-width": 6 }) + (i === 0 ? tag("ellipse", { cx: ux, cy: 760, rx: 18, ry: 26, fill: room("#8A99A3") }) : i === 1 ? tag("path", { d: "M" + (ux - 14) + " 740 h28 v40 h-28 Z", fill: room("#8A99A3") }) : tag("circle", { cx: ux, cy: 756, r: 20, fill: "none", stroke: room("#8A99A3"), "stroke-width": 6 })); });
    s += tag("rect", { x: Kc.x0, y: Kc.top + 40, width: Kc.x1 - Kc.x0, height: B - Kc.top - 40, fill: room("#7FB3A8"), stroke: room("#4E7F75"), "stroke-width": 5 });
    for (var d2 = 0; d2 < 4; d2++) s += tag("rect", { x: Kc.x0 + 16 + d2 * 220, y: Kc.top + 64, width: 188, height: B - Kc.top - 100, rx: 6, fill: room("#8DC0B5"), stroke: room("#5E968B"), "stroke-width": 4 }) + tag("rect", { x: Kc.x0 + 80 + d2 * 220, y: Kc.top + 84, width: 60, height: 10, rx: 4, fill: room("#E7C46A") });
    s += tag("rect", { x: Kc.x0 - 16, y: Kc.top, width: Kc.x1 - Kc.x0 + 32, height: 44, rx: 6, fill: room("#E8DCC6"), stroke: room("#A8957A"), "stroke-width": 5 });
    // hob with a pot, sink with a tap, kettle, chopping board
    s += tag("rect", { x: G.hob - 130, y: Kc.top - 10, width: 260, height: 12, rx: 4, fill: room("#2F3540") });
    s += tag("path", { d: "M" + (G.hob - 100) + " " + (Kc.top - 10) + " v-120 h200 v120 Z", fill: room("#D9534F"), stroke: room("#8E2E2B"), "stroke-width": 5 }) + tag("rect", { x: G.hob - 112, y: Kc.top - 142, width: 224, height: 20, rx: 8, fill: room("#B33F3B") }) + tag("rect", { x: G.hob - 20, y: Kc.top - 160, width: 40, height: 18, rx: 6, fill: room("#2F3540") });
    s += tag("path", { d: "M" + (G.hob + 100) + " " + (Kc.top - 90) + " h60", stroke: room("#2F3540"), "stroke-width": 12, "stroke-linecap": "round" });
    s += tag("g", { "data-part": "steam" }, "");
    s += tag("path", { d: "M" + (G.sink - 120) + " " + (Kc.top + 4) + " h240 v-10 h-240 Z", fill: room("#AAB7C0") }) + tag("path", { d: "M" + G.sink + " " + Kc.top + " v-110 q0 -30 -40 -30 h-30", stroke: room("#AAB7C0"), "stroke-width": 14, fill: "none", "stroke-linecap": "round" });
    s += tag("path", { d: "M2620 " + Kc.top + " l10 -110 q40 -30 80 0 l10 110 Z", fill: room("#F2F2EC"), stroke: room("#8A99A3"), "stroke-width": 5 }) + tag("path", { d: "M2720 " + (Kc.top - 90) + " q40 10 30 60", stroke: room("#8A99A3"), "stroke-width": 8, fill: "none" }) + tag("rect", { x: 2650, y: Kc.top - 134, width: 50, height: 16, rx: 6, fill: room("#2F3540") });
    s += tag("rect", { x: 3330, y: Kc.top - 14, width: 100, height: 14, rx: 4, fill: room("#C98E5A") }) + tag("circle", { cx: 3360, cy: Kc.top - 30, r: 18, fill: room("#FF6B6B") }) + tag("circle", { cx: 3400, cy: Kc.top - 28, r: 16, fill: room("#FFD43B") });
    var Fr = G.fridge;
    s += tag("rect", { x: Fr.x, y: Fr.top, width: Fr.w, height: B - Fr.top, rx: 18, fill: room("#F4F7F9"), stroke: room("#8A99A3"), "stroke-width": 6 }) + tag("path", { d: "M" + Fr.x + " " + (Fr.top + 220) + " h" + Fr.w, stroke: room("#8A99A3"), "stroke-width": 5 });
    s += tag("rect", { x: Fr.x + 24, y: Fr.top + 60, width: 14, height: 120, rx: 6, fill: room("#AAB7C0") }) + tag("rect", { x: Fr.x + 24, y: Fr.top + 260, width: 14, height: 160, rx: 6, fill: room("#AAB7C0") });
    [[Fr.x + 120, Fr.top + 320, "#FF6B6B"], [Fr.x + 200, Fr.top + 360, "#4DABF7"], [Fr.x + 150, Fr.top + 420, "#FFD43B"]].forEach(function (m) { s += tag("rect", { x: m[0], y: m[1], width: 60, height: 44, rx: 4, fill: room("#FFFFFF"), stroke: room(m[2]), "stroke-width": 6, transform: "rotate(" + (m[0] % 7 - 3) + " " + m[0] + " " + m[1] + ")" }); });
    // floor: warm planks
    s += tag("rect", { x: -300, y: B, width: 4440, height: 1000, fill: "url(#" + P + "-floor)" });
    var rows = [1530, 1570, 1620, 1680, 1750, 1835, 1940, 2070, 2230], pl = "";
    rows.forEach(function (yy, i) { pl += "M-300 " + yy + " H4140 "; var step = 300 + i * 70; for (var px = -300 + (i % 2) * step / 2; px < 4140; px += step) pl += "M" + px + " " + (i ? rows[i - 1] : B) + " V" + yy + " "; });
    s += tag("path", { d: pl, stroke: room("#8E5A30"), "stroke-width": 3, opacity: 0.55 });
    if (!ev) s += tag("path", { d: "M" + W.x + " " + (W.y + W.h) + " L" + (W.x + W.w) + " " + (W.y + W.h) + " L" + (W.x + W.w + 700) + " 2160 L" + (W.x + 200) + " 2160 Z", fill: "url(#" + P + "-beam)" });
    // rug, sofa (a sleeping cat), coffee table, floor lamp, side table
    s += tag("ellipse", { cx: 1225, cy: 1720, rx: 760, ry: 150, fill: room("#3D6E9E") }) + tag("ellipse", { cx: 1225, cy: 1720, rx: 700, ry: 124, fill: "none", stroke: room("#F2C57C"), "stroke-width": 12 }) + tag("ellipse", { cx: 1225, cy: 1720, rx: 560, ry: 90, fill: "none", stroke: room("#E8F1F8"), "stroke-width": 6, "stroke-dasharray": "24 18" });
    var Sf = G.sofa, sc = room("#E8A33C"), sd = D.shade(sc, 0.3);
    s += tag("rect", { x: Sf.x0 + 40, y: B - 30, width: Sf.x1 - Sf.x0 - 80, height: 24, rx: 10, fill: "#000", opacity: 0.15 });
    s += tag("rect", { x: Sf.x0 + 40, y: Sf.back, width: Sf.x1 - Sf.x0 - 80, height: 260, rx: 60, fill: sc, stroke: sd, "stroke-width": 6 });
    s += tag("rect", { x: Sf.x0 + 60, y: Sf.seat - 30, width: Sf.x1 - Sf.x0 - 120, height: 190, rx: 30, fill: D.tint(sc, 0.08), stroke: sd, "stroke-width": 6 });
    s += tag("path", { d: "M" + ((Sf.x0 + Sf.x1) / 2) + " " + (Sf.seat - 26) + " v150", stroke: sd, "stroke-width": 5 });
    s += tag("rect", { x: Sf.x0, y: Sf.seat - 110, width: 110, height: 300, rx: 50, fill: sc, stroke: sd, "stroke-width": 6 }) + tag("rect", { x: Sf.x1 - 110, y: Sf.seat - 110, width: 110, height: 300, rx: 50, fill: sc, stroke: sd, "stroke-width": 6 });
    s += tag("path", { d: "M" + (Sf.x0 + 30) + " " + (Sf.seat + 190) + " v30 M" + (Sf.x1 - 30) + " " + (Sf.seat + 190) + " v30", stroke: room("#5A3A22"), "stroke-width": 14, "stroke-linecap": "round" });
    s += tag("rect", { x: Sf.x0 + 140, y: Sf.back + 40, width: 150, height: 130, rx: 30, fill: room("#4F81BD"), stroke: room("#2F5E8C"), "stroke-width": 5, transform: "rotate(-8 " + (Sf.x0 + 215) + " " + (Sf.back + 100) + ")" });
    s += tag("g", { "data-part": "cat" }, "");
    var T = G.table;
    s += tag("rect", { x: T.x0, y: T.top, width: T.x1 - T.x0, height: 30, rx: 10, fill: room("#8C5E3C"), stroke: room("#5A3A22"), "stroke-width": 5 }) + tag("path", { d: "M" + (T.x0 + 40) + " " + (T.top + 30) + " v110 M" + (T.x1 - 40) + " " + (T.top + 30) + " v110", stroke: room("#5A3A22"), "stroke-width": 14 });
    s += tag("rect", { x: T.x0 + 40, y: T.top + 80, width: T.x1 - T.x0 - 80, height: 14, fill: room("#6E4528") }) + tag("rect", { x: T.x0 + 60, y: T.top - 16, width: 110, height: 16, rx: 4, fill: room("#C0504D"), transform: "rotate(-4 " + (T.x0 + 115) + " " + T.top + ")" });
    s += tag("path", { d: "M" + (T.x1 - 110) + " " + T.top + " l6 -46 h40 l6 46 Z", fill: room("#FFFFFF"), stroke: room("#8A99A3"), "stroke-width": 4 }) + tag("path", { d: "M" + (T.x1 - 58) + " " + (T.top - 38) + " q20 4 12 24", stroke: room("#8A99A3"), "stroke-width": 5, fill: "none" });
    var lx = 560;
    s += tag("path", { d: "M" + lx + " " + B + " V880", stroke: room("#3A4651"), "stroke-width": 12 }) + tag("ellipse", { cx: lx, cy: B, rx: 70, ry: 14, fill: room("#3A4651") });
    s += tag("path", { d: "M" + (lx - 100) + " 900 L" + (lx - 60) + " 740 H" + (lx + 60) + " L" + (lx + 100) + " 900 Z", fill: ev ? "#FFE0A0" : room("#F7EEDD"), stroke: room("#C2AE8A"), "stroke-width": 5 });
    if (L.lamp) s += tag("ellipse", { cx: lx, cy: 900, rx: 520, ry: 360, fill: "url(#" + P + "-glow)", opacity: 0.85 }) + tag("ellipse", { cx: lx + 60, cy: 1700, rx: 600, ry: 150, fill: "url(#" + P + "-glow)", opacity: 0.6 });
    s += tag("rect", { x: 1800, y: 1240, width: 150, height: 260, rx: 8, fill: room("#9C6B45"), stroke: room("#6B4A2F"), "stroke-width": 5 }) + tag("path", { d: "M1840 1240 l10 -110 h50 l10 110 Z", fill: room("#4C9ED9") }) + tag("path", { d: "M1830 1130 l20 -90 h50 l20 90 Z", fill: ev ? "#FFE0A0" : room("#FFF3D6"), stroke: room("#C2AE8A"), "stroke-width": 4 });
    if (L.lamp) s += tag("circle", { cx: 1875, cy: 1100, r: 220, fill: "url(#" + P + "-glow)", opacity: 0.8 });
    // pendant lamp over the kitchen
    [3000].forEach(function (px2) {
      s += tag("path", { d: "M" + px2 + " " + G.ceiling + " V300", stroke: room("#3A4651"), "stroke-width": 6 }) + tag("path", { d: "M" + (px2 - 90) + " 380 Q" + px2 + " 250 " + (px2 + 90) + " 380 Z", fill: room("#E8A33C"), stroke: room("#8A5A20"), "stroke-width": 5 });
      if (L.lamp) s += tag("ellipse", { cx: px2, cy: 480, rx: 420, ry: 260, fill: "url(#" + P + "-glow)", opacity: 0.7 });
    });
    return { defs: defs, body: s };
  }

  function drawFront(P, v, L, R) {
    var room = L.room, s = "";
    // a big leafy plant, bottom left
    var px = 140, py = 2200;
    s += tag("path", { d: "M" + (px - 140) + " " + (py - 250) + " h280 l-34 270 h-212 Z", fill: room("#F2F2EC"), stroke: room("#8A99A3"), "stroke-width": 6 }) + tag("path", { d: "M" + (px - 140) + " " + (py - 200) + " h280", stroke: room("#4C9ED9"), "stroke-width": 16 });
    for (var l = 0; l < 14; l++) {
      var a = -168 + l * 11.5 + (R() - 0.5) * 8, len = 300 + R() * 240, rad = a * Math.PI / 180, ex = px + Math.cos(rad) * len, ey = py - 260 + Math.sin(rad) * len;
      s += tag("path", { d: "M" + px + " " + (py - 260) + " Q" + r2(px + Math.cos(rad) * len * 0.5) + " " + r2(py - 260 + Math.sin(rad) * len * 0.4) + " " + r2(ex) + " " + r2(ey), stroke: room("#2E6B33"), "stroke-width": 7, fill: "none" });
      s += tag("path", { d: "M" + r2(ex) + " " + r2(ey) + " c-90 -100 -10 -200 90 -160 c100 40 90 170 -90 160 Z", fill: room(l % 2 ? "#3E8E41" : "#5DAA50"), stroke: room("#2B6A2E"), "stroke-width": 4, transform: "rotate(" + r2(a + 120) + " " + r2(ex) + " " + r2(ey) + ")" });
    }
    // a dining chair back, bottom right
    var cx = 3640;
    s += tag("path", { d: "M" + (cx - 160) + " 2200 V1760 q0 -50 50 -50 h220 q50 0 50 50 V2200", stroke: room("#8C5E3C"), "stroke-width": 34, fill: "none", "stroke-linecap": "round" });
    s += tag("path", { d: "M" + (cx - 150) + " 1830 h300 M" + (cx - 150) + " 1920 h300", stroke: room("#A0703F"), "stroke-width": 22 });
    s += tag("g", { "data-part": "motes" }, "");
    return { defs: "", body: s };
  }

  // ---- the extension for vertical videos (tall-world px: the original is 720 lower) -----------
  /* The top band (ground layer): the ceiling runs on up toward the viewer (the original's top strip
   * is its far edge): exposed rafters getting deeper as they come closer, a skylight over the
   * kitchen, a ceiling fan with a light (turning: data-part "fan"), a macramé hanging plant, a smoke
   * detector and fairy lights. Nothing has a horizontal edge on the seam row (y 720). */
  function drawTopBand(P, v, L, R) {
    var room = L.room, ev = v === "evening", s = "";
    var defs = '<linearGradient id="' + P + '-xceil" gradientUnits="userSpaceOnUse" x1="0" y1="722" x2="0" y2="0"><stop offset="0" stop-color="' + room("#F4E9D8") + '"/><stop offset="1" stop-color="' + room("#E6D3B6") + '"/></linearGradient>' +
      S.lin(P + "-xsky", ev ? [[0, "#2B2F6B"], [1, "#7A4E8E"]] : [[0, "#5AA9E6"], [1, "#A8D8F2"]]) + S.rad(P + "-xglow", [[0, "#FFE0A0", 0.8], [1, "#FFE0A0", 0]]);
    s += tag("rect", { x: -300, y: -200, width: 4440, height: 922, fill: "url(#" + P + "-xceil)" });
    // the skylight between two rafters, over the kitchen (a shaft of light falls from it by day)
    var sk = [2620, 3240, 334, 450];
    s += tag("path", { d: "M" + (sk[0] - 40) + " " + (sk[2] - 30) + " H" + (sk[1] + 40) + " L" + (sk[1] + 26) + " " + (sk[3] + 20) + " H" + (sk[0] - 26) + " Z", fill: room("#FFFCF5"), stroke: room("#C2AE8A"), "stroke-width": 5 });
    s += tag("path", { d: "M" + sk[0] + " " + sk[2] + " H" + sk[1] + " L" + (sk[1] - 10) + " " + sk[3] + " H" + (sk[0] + 10) + " Z", fill: "url(#" + P + "-xsky)" });
    if (ev) s += A.stars(R, 14, sk[0] + 20, sk[2] + 10, sk[1] - sk[0] - 40, sk[3] - sk[2] - 30);
    else s += A.cloud(2800, 400, 0.25, { cloud: "#FFFFFF", cloudShade: "#DCEBF6", cloudLight: "#FFFDF4" }, "x0") + A.glint(sk[0] + 20, sk[2], 260, sk[3] - sk[2], 0.35);
    s += tag("path", { d: "M" + ((sk[0] + sk[1]) / 2) + " " + sk[2] + " V" + sk[3] + " M" + sk[0] + " " + ((sk[2] + sk[3]) / 2) + " H" + sk[1], stroke: room("#FFFCF5"), "stroke-width": 14 });
    // rafters: beams parallel to the back wall, deeper (and further apart) as they come closer
    [[690, 16, 10], [596, 24, 14], [470, 34, 20], [310, 46, 28], [110, 62, 40]].forEach(function (b) {
      var y = b[0];
      s += tag("rect", { x: -300, y: y - b[1], width: 4440, height: b[1], fill: room("#A87449") }) + tag("rect", { x: -300, y: y, width: 4440, height: b[2], fill: room("#7E5232") }) +
        tag("path", { d: "M-300 " + r2(y - b[1] * 0.55) + " H4140", stroke: room("#C08A5A"), "stroke-width": 3, opacity: 0.6 }) + tag("rect", { x: -300, y: y + b[2], width: 4440, height: 10, fill: "#000", opacity: 0.07 });
      for (var nx = -200 + (y % 300); nx < 4140; nx += 620) s += tag("circle", { cx: nx, cy: y - b[1] / 2, r: 4 + b[1] / 14, fill: room("#5A3A22") }); // pegs
    });
    // fairy lights looped along the nearest-but-one rafter
    var fl = "", bulbs = "";
    for (var fx = -300; fx < 4140; fx += 240) {
      fl += (fx === -300 ? "M" : " ") + "Q" + (fx + 120) + " " + 266 + " " + (fx + 240) + " " + 222;
      for (var b2 = 1; b2 < 4; b2++) { var u = b2 / 4, bx = fx + 240 * u, by = 222 + 2 * u * (1 - u) * 44; bulbs += tag("circle", { cx: r2(bx), cy: r2(by + 8), r: 7, fill: ["#FFD43B", "#FF8787", "#74C0FC", "#B2F2BB"][(b2 + fx / 240 | 0) % 4], "data-xbulb": 1, opacity: ev ? 1 : 0.85 }); }
    }
    s += tag("path", { d: "M-300 222 " + fl.replace(/^M/, ""), stroke: room("#3A4651"), "stroke-width": 3, fill: "none" }) + bulbs;
    if (ev) s += tag("rect", { x: -300, y: 200, width: 4440, height: 90, fill: "#FFE0A0", opacity: 0.12 });
    // the ceiling fan over the sofa: a rod from the rafter, the motor, a light bowl; blades turn
    var fx0 = 1220, fy = 560;
    s += tag("path", { d: "M" + fx0 + " 338 V" + (fy - 30), stroke: room("#3A4651"), "stroke-width": 12 }) + tag("rect", { x: fx0 - 40, y: 330, width: 80, height: 24, rx: 8, fill: room("#3A4651") });
    s += tag("g", { "data-part": "fan" }, "");
    s += tag("path", { d: "M" + (fx0 - 70) + " " + (fy - 20) + " q0 -30 70 -30 q70 0 70 30 v22 h-140 Z", fill: room("#5A3A22"), stroke: room("#3A2416"), "stroke-width": 4 });
    s += tag("path", { d: "M" + (fx0 - 50) + " " + (fy + 2) + " q50 70 100 0 Z", fill: ev ? "#FFE0A0" : room("#F7EEDD"), stroke: room("#C2AE8A"), "stroke-width": 4 });
    s += tag("path", { d: "M" + (fx0 + 30) + " " + (fy + 30) + " v50", stroke: room("#E7C46A"), "stroke-width": 3 }) + tag("circle", { cx: fx0 + 30, cy: fy + 84, r: 6, fill: room("#E7C46A") });
    if (ev) s += tag("ellipse", { cx: fx0, cy: fy + 60, rx: 380, ry: 200, fill: "url(#" + P + "-xglow)", opacity: 0.75 });
    // a macramé plant hanger by the bookshelf; a smoke detector
    var hx = 620;
    s += tag("path", { d: "M" + hx + " 140 V430 M" + hx + " 430 l-60 120 M" + hx + " 430 l60 120 M" + hx + " 430 v120 M" + (hx - 40) + " 500 l40 30 l40 -30", stroke: room("#E9DCC5"), "stroke-width": 6, fill: "none" }) + tag("circle", { cx: hx, cy: 140, r: 10, fill: room("#8C6A4A") });
    s += tag("path", { d: "M" + (hx - 70) + " 550 h140 l-16 90 h-108 Z", fill: room("#E07A4F"), stroke: room("#8E4325"), "stroke-width": 5 });
    for (var lf = 0; lf < 9; lf++) { var a = -160 + lf * 18, rad = a * Math.PI / 180, lx = hx + Math.cos(rad) * 80, ly = 550 + Math.sin(rad) * 60 + (lf % 3) * 40 + 40; s += tag("ellipse", { cx: r2(lx), cy: r2(ly), rx: 30, ry: 14, fill: room(lf % 2 ? "#4E9A48" : "#6DB552"), stroke: room("#2E6B33"), "stroke-width": 3, transform: "rotate(" + r2(a + 90) + " " + r2(lx) + " " + r2(ly) + ")" }); }
    s += tag("ellipse", { cx: 2240, cy: 600, rx: 40, ry: 12, fill: room("#FFFDF7"), stroke: room("#A89A80"), "stroke-width": 3 }) + tag("circle", { cx: 2256, cy: 600, r: 4, fill: "#E03131", "data-blink": 0 });
    return { defs: defs, body: s };
  }

  /* The bottom band (ground layer): the planks continued toward the viewer (the window's sunbeam
   * runs on and fades by day), a striped rug with a dog asleep in its bed (data-part "dog"), a ball,
   * slippers and books, then nearer a knitted pouf, a floor vent and a basket of yarn. */
  function drawBottomBand(P, v, L, R) {
    var room = L.room, ev = v === "evening", s = "";
    var defs = S.lin(P + "-xshade", [[0, "#000000", 0], [1, "#000000", 0.24]]) + S.rad(P + "-xglow2", [[0, "#FFE0A0", 0.5], [1, "#FFE0A0", 0]]);
    var under = tag("rect", { x: -300, y: 3200, width: 4440, height: 600, fill: room("#A8703F") });
    // planks: rows getting deeper toward the viewer, with joints (the original's last row ends at y 2950)
    var rows = [2950, 3110, 3290, 3490, 3720], pl = "";
    rows.forEach(function (yy, i) { if (i) pl += "M-300 " + yy + " H4140 "; if (!i) return; var step = 300 + (i + 8) * 70; for (var px = -300 + (i % 2) * step / 2; px < 4140; px += step) pl += "M" + px + " " + rows[i - 1] + " V" + yy + " "; });
    s += tag("path", { d: pl, stroke: room("#8E5A30"), "stroke-width": 3, opacity: 0.55 });
    for (var g = 0; g < 40; g++) { var gx = -280 + R() * 4400, gy = 2960 + R() * 640; s += tag("path", { d: "M" + r2(gx) + " " + r2(gy) + " q60 -6 120 0", stroke: room("#8E5A30"), "stroke-width": 2, fill: "none", opacity: 0.35 }); } // grain
    if (!ev) { // the window's sunbeam (its last row: opacity 0.19 x (1 - u), u: 0 at x 820 .. 1 at x 2320)
      defs += '<linearGradient id="' + P + '-xbeam" gradientUnits="userSpaceOnUse" x1="820" y1="0" x2="2320" y2="0"><stop offset="0" stop-color="#FFF1C9" stop-opacity="0.19"/><stop offset="1" stop-color="#FFF1C9" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="' + P + '-xbeamfade" gradientUnits="userSpaceOnUse" x1="0" y1="2880" x2="0" y2="3300"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>' +
        '<mask id="' + P + '-xbeammask" maskUnits="userSpaceOnUse" x="-300" y="2870" width="4440" height="500"><rect x="-300" y="2870" width="4440" height="500" fill="url(#' + P + '-xbeamfade)"/></mask>';
      var bl = function (y) { return 1020 + (y - 2880) * 200 / 1100; }, br = function (y) { return 2320 + (y - 2880) * 700 / 1100; };
      s += tag("path", { d: "M1020 2880 L2320 2880 L" + r2(br(3300)) + " 3300 L" + r2(bl(3300)) + " 3300 Z", fill: "url(#" + P + "-xbeam)", mask: "url(#" + P + "-xbeammask)" });
    }
    // a striped round rug, a dog bed with a sleeping dog
    var rx = 2620, ry = 3120;
    s += tag("ellipse", { cx: rx, cy: ry, rx: 660, ry: 141, fill: room("#E9C46A") });
    [[600, "#E76F51"], [500, "#F4E3C1"], [400, "#2A9D8F"], [300, "#F4E3C1"], [200, "#E76F51"]].forEach(function (c) { s += tag("ellipse", { cx: rx, cy: ry, rx: c[0], ry: c[0] * 0.214, fill: "none", stroke: room(c[1]), "stroke-width": 16 }); });
    s += tag("ellipse", { cx: rx + 40, cy: ry + 6, rx: 230, ry: 64, fill: room("#8E5A8E"), stroke: room("#5E3A5E"), "stroke-width": 6 }) + tag("ellipse", { cx: rx + 40, cy: ry + 2, rx: 180, ry: 42, fill: room("#C9A0C9") });
    s += tag("g", { "data-part": "dog" }, "");
    // a ball, slippers, a stack of books with a mug
    s += tag("circle", { cx: 1900, cy: 3040, r: 34, fill: room("#E03131"), stroke: room("#8E1E1E"), "stroke-width": 4 }) + tag("path", { d: "M1868 3030 q32 -20 64 0", stroke: room("#FFD43B"), "stroke-width": 8, fill: "none" });
    [[1300, -8], [1390, 6]].forEach(function (q) { s += tag("ellipse", { cx: q[0], cy: 3060, rx: 56, ry: 22, fill: room("#5C7CFA"), stroke: room("#364FC7"), "stroke-width": 4, transform: "rotate(" + q[1] + " " + q[0] + " 3060)" }) + tag("ellipse", { cx: q[0] - 14, cy: 3056, rx: 28, ry: 12, fill: room("#F1F3FF"), transform: "rotate(" + q[1] + " " + q[0] + " 3060)" }); });
    [["#4F81BD", 0], ["#C0504D", 1], ["#9BBB59", 2]].forEach(function (b) { s += tag("rect", { x: 3300 - b[1] * 6, y: 3080 - b[1] * 34, width: 170 - b[1] * 12, height: 34, rx: 4, fill: room(b[0]), stroke: room("#3A2F28"), "stroke-width": 3 }); });
    s += tag("path", { d: "M3330 2978 h50 v40 q0 12 -12 12 h-26 q-12 0 -12 -12 Z", fill: room("#FFFFFF"), stroke: room("#8A99A3"), "stroke-width": 4 });
    // a toy chest with toys peeking out, a guitar on its stand, a stack of board games
    var tc = 1480, tcy = 3200;
    s += tag("rect", { x: tc - 200, y: tcy + 120, width: 400, height: 20, rx: 8, fill: "#000", opacity: 0.14 });
    s += tag("rect", { x: tc - 190, y: tcy - 60, width: 380, height: 190, rx: 12, fill: room("#B9825A"), stroke: room("#6B4A2F"), "stroke-width": 6 }) + tag("path", { d: "M" + (tc - 190) + " " + (tcy + 20) + " h380 M" + (tc - 190) + " " + (tcy + 80) + " h380", stroke: room("#8C5E3C"), "stroke-width": 5 });
    s += tag("path", { d: "M" + (tc - 200) + " " + (tcy - 60) + " l20 -150 h360 l20 150 Z", fill: room("#C98E5A"), stroke: room("#6B4A2F"), "stroke-width": 6, "stroke-linejoin": "round" });
    s += tag("circle", { cx: tc - 90, cy: tcy - 70, r: 46, fill: room("#FFD43B"), stroke: room("#B08A1A"), "stroke-width": 4 }) + tag("rect", { x: tc - 10, y: tcy - 130, width: 70, height: 70, rx: 8, fill: room("#4DABF7"), stroke: room("#1C6EA4"), "stroke-width": 4 }) + tag("rect", { x: tc + 70, y: tcy - 110, width: 70, height: 50, rx: 8, fill: room("#FF6B6B"), stroke: room("#A83232"), "stroke-width": 4 });
    s += tag("rect", { x: tc - 40, y: tcy + 30, width: 80, height: 26, rx: 6, fill: room("#E7C46A") });
    var gt = 420, gty = 3180;
    s += tag("path", { d: "M" + (gt - 60) + " " + (gty + 40) + " L" + gt + " " + (gty - 60) + " L" + (gt + 60) + " " + (gty + 40) + " M" + gt + " " + (gty - 60) + " V" + (gty - 160), stroke: room("#3A4651"), "stroke-width": 8, fill: "none" });
    s += tag("rect", { x: gt - 16, y: gty - 460, width: 32, height: 300, rx: 6, fill: room("#5A3A22") }) + tag("rect", { x: gt - 26, y: gty - 500, width: 52, height: 60, rx: 10, fill: room("#3A2416") });
    s += tag("path", { d: "M" + gt + " " + (gty - 200) + " c-110 0 -120 90 -70 120 c-60 40 -50 150 70 150 c120 0 130 -110 70 -150 c50 -30 40 -120 -70 -120 Z", fill: room("#D9822B"), stroke: room("#7A4214"), "stroke-width": 6 }) +
      tag("circle", { cx: gt, cy: gty - 90, r: 30, fill: room("#3A2416") }) + tag("rect", { x: gt - 40, y: gty, width: 80, height: 14, rx: 4, fill: room("#3A2416") }) + tag("path", { d: "M" + (gt - 6) + " " + (gty - 480) + " V" + gty + " M" + (gt + 6) + " " + (gty - 480) + " V" + gty, stroke: room("#E9ECEF"), "stroke-width": 2 });
    [["#7048E8", 0], ["#E8590C", 1], ["#2B8A3E", 2], ["#F2C14E", 3]].forEach(function (b) { s += tag("rect", { x: 1980 - b[1] * 8, y: 3250 - b[1] * 40, width: 240 - b[1] * 10, height: 40, rx: 4, fill: room(b[0]), stroke: room("#3A2F28"), "stroke-width": 3 }) + tag("rect", { x: 2020 - b[1] * 8, y: 3262 - b[1] * 40, width: 60, height: 16, rx: 3, fill: "#FFFFFF", opacity: 0.6 }); });
    // a floor vent; a knitted pouf; a basket with a blanket and yarn
    s += tag("rect", { x: 2360, y: 3420, width: 240, height: 60, rx: 6, fill: room("#D9DFE4"), stroke: room("#8A99A3"), "stroke-width": 4 }) + tag("path", { d: "M2380 3436 h200 M2380 3450 h200 M2380 3464 h200", stroke: room("#8A99A3"), "stroke-width": 4 });
    var px = 1000, py = 3440;
    s += tag("ellipse", { cx: px + 20, cy: py + 120, rx: 260, ry: 40, fill: "#000", opacity: 0.16 });
    s += tag("path", { d: "M" + (px - 250) + " " + (py - 40) + " q0 170 250 170 q250 0 250 -170 Z", fill: room("#E8A33C"), stroke: room("#9A6A20"), "stroke-width": 6 });
    s += tag("ellipse", { cx: px, cy: py - 40, rx: 250, ry: 66, fill: room("#F2B84E"), stroke: room("#9A6A20"), "stroke-width": 6 });
    var knit = "";
    for (var k = -4; k <= 4; k++) knit += "M" + (px + k * 54) + " " + (py - 30) + " q" + (k * 4) + " 80 " + (k * 6) + " " + (150 - Math.abs(k) * 8) + " ";
    s += tag("path", { d: knit, stroke: room("#C98A2A"), "stroke-width": 6, fill: "none", opacity: 0.8 }) + tag("circle", { cx: px, cy: py - 40, r: 16, fill: room("#C98A2A") });
    var bx = 3200, by = 3450;
    s += tag("ellipse", { cx: bx, cy: by + 110, rx: 230, ry: 34, fill: "#000", opacity: 0.16 });
    s += tag("path", { d: "M" + (bx - 210) + " " + (by - 60) + " Q" + (bx - 210) + " " + (by + 110) + " " + (bx - 150) + " " + (by + 110) + " H" + (bx + 150) + " Q" + (bx + 210) + " " + (by + 110) + " " + (bx + 210) + " " + (by - 60) + " Z", fill: room("#C9965C"), stroke: room("#7A5230"), "stroke-width": 6 });
    var wv = "";
    for (var wy = by - 40; wy < by + 100; wy += 26) wv += "M" + (bx - 205) + " " + wy + " H" + (bx + 205) + " ";
    for (var wx = bx - 180; wx < bx + 200; wx += 40) wv += "M" + wx + " " + (by - 60) + " V" + (by + 106) + " ";
    s += tag("path", { d: wv, stroke: room("#9C6B45"), "stroke-width": 4, opacity: 0.7 });
    s += tag("path", { d: "M" + (bx - 200) + " " + (by - 60) + " q60 -90 170 -40 q80 40 140 -20 l90 60 Z", fill: room("#3D6E9E"), stroke: room("#274A70"), "stroke-width": 5 }) + tag("path", { d: "M" + (bx - 150) + " " + (by - 82) + " q60 -40 120 0 M" + (bx + 30) + " " + (by - 70) + " q50 -20 90 -10", stroke: room("#F2C57C"), "stroke-width": 6, fill: "none" });
    [[bx - 60, by - 96, "#E76F51"], [bx + 70, by - 104, "#2A9D8F"]].forEach(function (y2) { s += tag("circle", { cx: y2[0], cy: y2[1], r: 42, fill: room(y2[2]), stroke: D.shade(room(y2[2]), 0.35), "stroke-width": 4 }) + tag("path", { d: "M" + (y2[0] - 30) + " " + (y2[1] - 10) + " q30 30 60 0 M" + (y2[0] - 24) + " " + (y2[1] + 16) + " q24 -40 48 0", stroke: D.shade(room(y2[2]), 0.3), "stroke-width": 3, fill: "none" }); });
    s += tag("path", { d: "M" + (bx + 112) + " " + (by - 100) + " q60 40 30 120 q-30 60 40 110", stroke: room("#2A9D8F"), "stroke-width": 4, fill: "none" }) + tag("path", { d: "M" + (bx + 40) + " " + (by - 150) + " l40 70 M" + (bx + 60) + " " + (by - 154) + " l30 76", stroke: room("#C0A080"), "stroke-width": 6 });
    if (ev) s += tag("ellipse", { cx: 600, cy: 2960, rx: 700, ry: 160, fill: "url(#" + P + "-xglow2)" }); // the floor lamp's pool runs on
    s += tag("rect", { x: -300, y: 3150, width: 4440, height: 450, fill: "url(#" + P + "-xshade)" });
    return { defs: defs, under: under, body: s };
  }
  function mountBands(X, P, v, L, seed) {
    var room = L.room, top = drawTopBand(P, v, L, D.rng(seed + 31)), bot = drawBottomBand(P, v, L, D.rng(seed + 32));
    var tg = PL.band(X.over.ground, "top", top.defs, top.body);
    PL.band(X.under.ground, "bottom", "", bot.under);
    var bg = PL.band(X.over.ground, "bottom", bot.defs, bot.body);
    var fanG = tg.querySelector('[data-part="fan"]'), blades = [0, 1, 2, 3].map(function () { return D.el(fanG, "path", { fill: room("#8C5E3C"), stroke: room("#5A3A22"), "stroke-width": 4 }); });
    var dog = D.el(bg.querySelector('[data-part="dog"]'), "g", {}), fur = room("#C98E5A"), furD = D.shade(fur, 0.35);
    dog.innerHTML = tag("path", { d: "M-130 0 Q-140 -70 -40 -78 Q60 -84 100 -40 Q120 0 90 0 Z", fill: fur, stroke: furD, "stroke-width": 5 }) +
      tag("ellipse", { cx: 96, cy: -30, rx: 52, ry: 40, fill: fur, stroke: furD, "stroke-width": 5 }) + tag("ellipse", { cx: 140, cy: -20, rx: 26, ry: 18, fill: D.tint(fur, 0.2), stroke: furD, "stroke-width": 4 }) + tag("circle", { cx: 160, cy: -24, r: 7, fill: "#1E1E24" }) +
      tag("path", { d: "M70 -60 q-30 10 -24 60 q20 -10 30 -50 Z", fill: room("#8E5A30"), stroke: furD, "stroke-width": 4 }) + tag("path", { d: "M92 -34 q8 6 16 0", stroke: "#1E1E24", "stroke-width": 4, fill: "none", "stroke-linecap": "round" }) +
      tag("path", { d: "M-130 -14 q-50 -10 -40 -50", stroke: fur, "stroke-width": 18, fill: "none", "stroke-linecap": "round" });
    var dogBase = "translate(2620 3132)", blink = tg.querySelector("[data-blink]"), bulbs = [].slice.call(tg.querySelectorAll("[data-xbulb]"));
    var fx0 = 1220, fy = 548;
    return function (t) {
      blades.forEach(function (b, i) { // four blades on a plane seen nearly edge-on (squashed 0.16)
        var a = t * 3.2 + i * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), L1 = 420, w = 46;
        var tip = [fx0 + c * L1, fy + sn * L1 * 0.16], side = [-sn * w, c * w * 0.16];
        b.setAttribute("d", "M" + r2(fx0 + c * 60 + side[0] * 0.5) + " " + r2(fy + sn * 9.6 + side[1] * 0.5) + " L" + r2(tip[0] + side[0]) + " " + r2(tip[1] + side[1]) + " L" + r2(tip[0] - side[0]) + " " + r2(tip[1] - side[1]) + " L" + r2(fx0 + c * 60 - side[0] * 0.5) + " " + r2(fy + sn * 9.6 - side[1] * 0.5) + " Z");
      });
      dog.setAttribute("transform", dogBase + " scale(1 " + r2(1 + 0.04 * Math.sin(t * 1.9)) + ")");
      if (blink) blink.setAttribute("opacity", (t % 2) < 0.25 ? 1 : 0.2);
      bulbs.forEach(function (e, i) { e.setAttribute("opacity", r2(0.7 + 0.3 * Math.sin(t * 2 + i * 1.7))); });
    };
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place home: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-home";
    var seed = opts.seed === undefined ? 4 : opts.seed | 0;
    var L = LOOK[v];
    var parts = {
      sky: drawSky(P, v, L, D.rng(seed + 1)), far: drawFar(P, v, L, D.rng(seed + 2)), mid: drawMid(P, v, L, D.rng(seed + 3)),
      ground: drawGround(P, v, L, D.rng(seed + 4)), front: drawFront(P, v, L, D.rng(seed + 5)),
    };
    var g = {};
    var X = PL.extendLayers(layers, opts, meta);
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(X.layers[name], "home-" + name, parts[name].defs, parts[name].body); });
    var bandsUpdate = X.on ? mountBands(X, P, v, L, seed) : null; // the bands above and below (tall-world px)
    var room = L.room;
    var clockG = g.ground.querySelector('[data-part="clock"]');
    var hourH = D.el(clockG, "path", { stroke: room("#3A4651"), "stroke-width": 9, "stroke-linecap": "round" }), minH = D.el(clockG, "path", { stroke: room("#3A4651"), "stroke-width": 6, "stroke-linecap": "round" });
    D.el(clockG, "circle", { cx: 2240, cy: 420, r: 8, fill: room("#C0504D") });
    var catG = D.el(g.ground.querySelector('[data-part="cat"]'), "g", {}), cat = room("#5A5F6B"), catD = D.shade(cat, 0.35);
    catG.innerHTML = tag("path", { d: "M-110 0 Q-120 -80 -20 -86 Q60 -90 90 -40 Q110 0 80 0 Z", fill: cat, stroke: catD, "stroke-width": 5 }) +
      tag("circle", { cx: 86, cy: -40, r: 44, fill: cat, stroke: catD, "stroke-width": 5 }) + tag("path", { d: "M58 -70 l6 -36 l24 26 M100 -76 l18 -30 l8 34", fill: cat, stroke: catD, "stroke-width": 5, "stroke-linejoin": "round" }) +
      tag("path", { d: "M70 -38 q8 6 16 0 M98 -38 q8 6 16 0", stroke: "#1E1E24", "stroke-width": 4, fill: "none", "stroke-linecap": "round" }) + tag("path", { d: "M-110 -10 q-60 10 -40 -40", stroke: cat, "stroke-width": 20, fill: "none", "stroke-linecap": "round" }) +
      tag("path", { d: "M-40 -78 q10 -6 20 0 M0 -80 q10 -6 20 0", stroke: catD, "stroke-width": 4, fill: "none" });
    var catBase = "translate(" + (G.sofa.x1 - 300) + " " + (G.sofa.seat - 28) + ")";
    var steamG = g.ground.querySelector('[data-part="steam"]'), steam = D.presets.smoke(seed + 7, 6);
    var steamEls = steam.list.map(function () { return D.el(steamG, "circle", { fill: "#FFFFFF", opacity: 0 }); });
    var moteG = g.front.querySelector('[data-part="motes"]'), MR = D.rng(seed + 21), motes = [];
    for (var i = 0; i < 14; i++) motes.push({ x: 900 + MR() * 1300, y: 1100 + MR() * 700, s: (MR() * 100) | 0, e: D.el(moteG, "circle", { r: 4, fill: L.lamp ? "#FFE3A0" : "#FFF6D8", opacity: 0 }) });

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      if (bandsUpdate) bandsUpdate(t);
      var mins = (t / 60 + 0.4) % 1, hrs = (t / 720 + 0.27) % 1;
      hourH.setAttribute("d", "M2240 420 L" + r2(2240 + Math.sin(hrs * 6.283) * 34) + " " + r2(420 - Math.cos(hrs * 6.283) * 34));
      minH.setAttribute("d", "M2240 420 L" + r2(2240 + Math.sin(mins * 6.283) * 52) + " " + r2(420 - Math.cos(mins * 6.283) * 52));
      var br = 1 + 0.035 * Math.sin(t * 2.2);
      catG.setAttribute("transform", catBase + " scale(1 " + r2(br) + ")");
      steam.at(t).forEach(function (p, j) {
        var e = steamEls[j];
        e.setAttribute("cx", r2(G.hob + p.x * 0.8 + D.wobble(t, j, 0.5) * 10));
        e.setAttribute("cy", r2(G.kitchen.top - 170 + p.y * 1.4));
        e.setAttribute("r", r2(p.r * (0.5 + 0.8 * p.u)));
        e.setAttribute("opacity", r2(p.alive ? 0.55 * Math.sin(Math.PI * p.u) : 0));
      });
      motes.forEach(function (m) {
        var lo = m.y - 600, hi = m.y + 200, my = A.wrap(m.y - t * 5, lo, hi), w = D.wobble(t, m.s, 0.4);
        m.e.setAttribute("cx", r2(m.x + w * 50));
        m.e.setAttribute("cy", r2(my));
        m.e.setAttribute("opacity", r2((0.3 + 0.25 * w) * A.wrapFade(my, lo, hi, 80)));
      });
    }
    var a = anchorsFor(opts);
    update(0, X.ref);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places.home = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
