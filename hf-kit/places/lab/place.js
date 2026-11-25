/* Place "lab": a warm, friendly science lab. Back wall with a big window (sky, a far skyline and a
 * tree outside, each on its own parallax layer), a periodic-table-style poster, a large wall
 * screen, shelves of glassware, a door, pendant lamps, a long workbench against the wall
 * (microscope, flasks, a burner, a test-tube rack) and a tiled floor. A potted plant and a
 * glassware cart frame the foreground.
 *
 * Variants: bright (default: daylight, lamps on), dim (night outside, lamps low, the screen,
 * a desk lamp and the flasks glow). Anchors (ground-layer world px, 3840 x 2160 world):
 *   bench   the clear middle of the bench top (where a prop or an experiment goes)
 *   screen  the centre of the wall screen (for a chart or a diagram overlay)
 *   door    the floor in front of the door (where actors enter and leave)
 *   window  the centre of the window
 * Path: bench-top (along the bench top, left to right).
 * Extended (vertical videos, mount with extended: true; meta.extend): 720 px drawn above and below,
 * anchors and paths 720 lower (see drawTopBand / drawBottomBand and src/world/place.js).
 *
 * Contract: hf-kit/places/README.md and hf-kit/src/world/place.js. Pure function of (t, cam). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw || !K.place) throw new Error("lab/place.js: load the kit scripts first");
  var D = K.draw, PL = K.place, S = PL.svg, tag = S.tag, smooth = S.smooth;
  var r2 = D.r2;

  var meta = {
    name: "lab",
    description: "Warm science lab: window, wall screen, shelves of glassware, door, a long workbench, tiled floor.",
    variants: ["bright", "dim"],
    anchors: ["bench", "screen", "door", "window"],
    paths: ["bench-top"],
    actorScale: 1.6, // mountActor scale for an actor on the floor (about 620 world px tall): the bench is waist high
    // how an actor here is lit (mountActor light / rig state.light): window daylight, or the
    // desk lamp at the right of the bench in the dim lab
    actorLight: {
      bright: { tint: "#FFF4E4", amount: 0.08 },
      dim: { tint: "#4F60A0", amount: 0.68, rim: "#FFD39A", rimSide: 1 },
    },
    // the extension for vertical videos (place.js: mount with extended: true, world 3840 x 3600)
    extend: {
      top: { draws: "the room continued up: the top strip becomes a beam, then the upper wall with a high storage shelf (boxes, bottles, a globe, binders, a trailing plant), an air vent, a duct run with grilles, a sprinkler pipe, and the ceiling in perspective with light panels", seamAllow: [] },
      bottom: { draws: "the tiled floor continued in perspective with safety lines and a drain, a step stool and a bin, and in front the lower cabinets of a counter (drawers, doors) and its under-bench storage (bins, boxes, a gas bottle, a flammables cupboard)", seamAllow: [[-30, 280]] },
    },
  };

  // ---- geometry (ground-layer world px) ------------------------------------------------------
  var G = {
    ceiling: 170, floor: 1500, // ceiling band bottom, wall base
    win: { x: 200, y: 360, w: 800, h: 760 },
    poster: { x: 1090, y: 420, w: 270, h: 380 },
    screen: { x: 1450, y: 360, w: 960, h: 540 },
    shelf: { x: 2540, y: 380, w: 620, h: 680 },
    door: { x: 3320, y: 640, w: 400, h: 860 },
    bench: { x0: 1180, x1: 2780, top: 1240, front: 1290, base: 1510 },
  };

  function anchorsFor(opts) {
    PL.variantOf(meta, opts);
    return PL.offsetAnchors(baseAnchors(), PL.extendOffset(meta, opts));
  }
  function baseAnchors() {
    var fixed = function (x, y) { return function () { return { x: x, y: y }; }; };
    var top = [];
    for (var x = G.bench.x0 + 60; x <= G.bench.x1 - 60; x += 160) top.push({ x: x, y: G.bench.top });
    return {
      anchors: {
        bench: fixed(1980, G.bench.top),
        screen: fixed(G.screen.x + G.screen.w / 2, G.screen.y + G.screen.h / 2),
        door: fixed(G.door.x + G.door.w / 2, G.floor + 60),
        window: fixed(G.win.x + G.win.w / 2, G.win.y + G.win.h / 2),
      },
      paths: { "bench-top": top },
    };
  }

  // window clouds [x, y, scale] drift right and wrap round CLOUD_SPAN; motes rise and wrap
  var CLOUDS = [[300, 520, 1], [760, 700, 0.8], [1300, 450, 0.9], [-200, 640, 0.9]];
  var CLOUD_SPAN = [-900, 2000];

  var LOOK = {
    bright: { sky: [[0, "#5AA9E6"], [0.6, "#A8D8F2"], [1, "#FFE9C2"]], lamp: 1, room: function (c) { return c; } },
    dim: { sky: [[0, "#0A1030"], [0.6, "#1B2858"], [1, "#3B4578"]], lamp: 0.25, room: function (c) { return D.mix(D.shade(c, 0.4), "#16306A", 0.48); } },
  };

  function drawSky(P, v, tone, R) {
    var L = LOOK[v];
    var defs = S.lin(P + "-sky", L.sky) + S.rad(P + "-sun", [[0, "#FFF6D0", 1], [0.3, "#FFE08A", 0.6], [1, "#FFE08A", 0]]);
    var s = tag("rect", { x: -2600, y: -1600, width: 9040, height: 5400, fill: L.sky[L.sky.length - 1][1] });
    s += tag("rect", { x: -2600, y: -1600, width: 9040, height: 3000, fill: "url(#" + P + "-sky)" });
    if (v === "bright") {
      s += tag("circle", { cx: 860, cy: 380, r: 380, fill: "url(#" + P + "-sun)" }) + tag("circle", { cx: 860, cy: 380, r: 80, fill: "#FFF6D0" });
      CLOUDS.forEach(function (c, i) {
        s += tag("g", { "data-cloud": i, transform: "translate(" + c[0] + " " + c[1] + ") scale(" + c[2] + ")" },
          tag("ellipse", { cx: 0, cy: 20, rx: 150, ry: 30, fill: "#DCEBF6" }) + tag("ellipse", { cx: -60, cy: 0, rx: 80, ry: 52, fill: "#fff" }) +
          tag("ellipse", { cx: 20, cy: -26, rx: 90, ry: 70, fill: "#fff" }) + tag("ellipse", { cx: 100, cy: 4, rx: 70, ry: 46, fill: "#fff" }) + tag("ellipse", { cx: 0, cy: 18, rx: 140, ry: 26, fill: "#fff" }));
      });
    } else {
      for (var i = 0; i < 90; i++) s += tag("circle", { cx: -600 + R() * 2800, cy: -200 + R() * 1200, r: 1.5 + R() * 3, fill: "#FFF8E1", opacity: 0.4 + R() * 0.6 });
      s += tag("circle", { cx: 820, cy: 470, r: 240, fill: "#8FA6E0", opacity: 0.2 }) + tag("circle", { cx: 820, cy: 470, r: 66, fill: "#F6F2DC" }) + tag("circle", { cx: 800, cy: 456, r: 14, fill: "#DCD6BC" });
    }
    return { defs: defs, body: s };
  }

  function drawFar(P, v, tone, R) {
    // a city skyline and hills beyond the window
    var dim = v === "dim", s = "";
    s += tag("path", { d: smooth([[-900, 1020], [-300, 930], [300, 980], [900, 900], [1500, 960], [2200, 920]], false) + " L2200 2400 L-900 2400 Z", fill: dim ? "#28325C" : "#9CC9B8" });
    for (var b = 0; b < 20; b++) {
      var x = -700 + b * 150 + R() * 40, w = 90 + R() * 70, h = 160 + R() * 320, top = 1100 - h;
      var col = dim ? (b % 2 ? "#1C2448" : "#232C55") : (b % 2 ? "#B9CEDC" : "#A7BFD0");
      s += tag("rect", { x: x, y: top, width: w, height: h + 1300, fill: col });
      s += tag("rect", { x: x + w * 0.62, y: top, width: w * 0.38, height: h + 1300, fill: dim ? "#151B3A" : "#93AEC2", opacity: 0.7 });
      for (var wy = top + 24; wy < 1080; wy += 46) for (var wx = x + 14; wx < x + w - 20; wx += 30) {
        var lit = R();
        s += tag("rect", { x: wx, y: wy, width: 14, height: 20, fill: dim ? (lit > 0.55 ? "#FFD27A" : "#2E3866") : (lit > 0.7 ? "#E7F2FA" : "#8FA9BD"), opacity: dim ? 0.95 : 0.8 });
      }
    }
    return { defs: "", body: s };
  }

  function drawMid(P, v, tone, R) {
    // a tree just outside the window
    var dim = v === "dim", leaf = dim ? "#1F3B3A" : "#4E9A48", leafL = dim ? "#2C4F48" : "#7CC25A", trunk = dim ? "#2A2230" : "#6B4A2F";
    var s = tag("path", { d: "M380 2200 C390 1700 400 1300 380 1060 C370 950 340 880 300 840", stroke: trunk, "stroke-width": 40, fill: "none", "stroke-linecap": "round" });
    s += tag("path", { d: "M386 1120 C450 1060 520 1040 580 1050", stroke: trunk, "stroke-width": 18, fill: "none", "stroke-linecap": "round" });
    [[300, 800, 120], [190, 900, 100], [420, 900, 110], [560, 1010, 80], [250, 700, 80]].forEach(function (c) {
      s += tag("circle", { cx: c[0], cy: c[1], r: c[2], fill: leaf }) + tag("circle", { cx: c[0] + c[2] * 0.3, cy: c[1] - c[2] * 0.35, r: c[2] * 0.5, fill: leafL, opacity: 0.85 });
    });
    return { defs: "", body: s };
  }

  function flask(x, y, size, liquid, tone, kind) {
    var glass = "#EAF6FB", line = tone("#5B7180"), s = "";
    var h = size, w = size * 0.8;
    if (kind === "round") {
      s += tag("rect", { x: x - w * 0.12, y: y - h, width: w * 0.24, height: h * 0.45, fill: glass, stroke: line, "stroke-width": 4, opacity: 0.95 });
      s += tag("circle", { cx: x, cy: y - h * 0.3, r: h * 0.32, fill: glass, stroke: line, "stroke-width": 4, opacity: 0.95 });
      s += tag("path", { d: "M" + r2(x - h * 0.3) + " " + r2(y - h * 0.26) + " A" + r2(h * 0.32) + " " + r2(h * 0.32) + " 0 0 0 " + r2(x + h * 0.3) + " " + r2(y - h * 0.26) + " Z", fill: liquid });
    } else if (kind === "beaker") {
      s += tag("path", { d: "M" + r2(x - w / 2) + " " + r2(y - h * 0.8) + " L" + r2(x - w / 2) + " " + y + " L" + r2(x + w / 2) + " " + y + " L" + r2(x + w / 2) + " " + r2(y - h * 0.8) + " Z", fill: glass, stroke: line, "stroke-width": 4, opacity: 0.95 });
      s += tag("rect", { x: x - w / 2 + 3, y: y - h * 0.42, width: w - 6, height: h * 0.42 - 3, fill: liquid });
      s += tag("path", { d: "M" + r2(x - w / 2 + 10) + " " + r2(y - h * 0.65) + " h" + r2(w * 0.25) + " M" + r2(x - w / 2 + 10) + " " + r2(y - h * 0.52) + " h" + r2(w * 0.15), stroke: line, "stroke-width": 3 });
    } else { // conical
      s += tag("path", { d: "M" + r2(x - w * 0.12) + " " + r2(y - h) + " L" + r2(x - w * 0.12) + " " + r2(y - h * 0.62) + " L" + r2(x - w / 2) + " " + y + " L" + r2(x + w / 2) + " " + y + " L" + r2(x + w * 0.12) + " " + r2(y - h * 0.62) + " L" + r2(x + w * 0.12) + " " + r2(y - h) + " Z", fill: glass, stroke: line, "stroke-width": 4, "stroke-linejoin": "round", opacity: 0.95 });
      s += tag("path", { d: "M" + r2(x - w * 0.36) + " " + r2(y - h * 0.3) + " L" + r2(x - w / 2 + 4) + " " + r2(y - 3) + " L" + r2(x + w / 2 - 4) + " " + r2(y - 3) + " L" + r2(x + w * 0.36) + " " + r2(y - h * 0.3) + " Z", fill: liquid });
    }
    s += tag("path", { d: "M" + r2(x - w * 0.28) + " " + r2(y - h * 0.5) + " q-6 " + r2(h * 0.18) + " 0 " + r2(h * 0.34), stroke: "#FFFFFF", "stroke-width": 5, fill: "none", "stroke-linecap": "round", opacity: 0.8 });
    return s;
  }

  function drawGround(P, v, tone, R) {
    var dim = v === "dim", L = LOOK[v], room = L.room;
    var defs = S.lin(P + "-wall", [[0, room("#F4E8D4")], [1, room("#EAD9BE")]]) +
      S.lin(P + "-wain", [[0, room("#6FB3A8")], [1, room("#5A9C92")]]) +
      S.lin(P + "-floor", [[0, room("#D7CDBE")], [1, room("#BFB1A0")]]) +
      S.lin(P + "-screen", dim ? [[0, "#123B5C"], [1, "#0B2440"]] : [[0, "#1F4E6E"], [1, "#163A55"]]) +
      S.lin(P + "-top", [[0, room("#E2B77F")], [1, room("#C9965C")]]) +
      S.lin(P + "-beam", [[0, "#FFF1C9", dim ? 0 : 0.42], [1, "#FFF1C9", 0]], [0, 0, 1, 1]) +
      S.rad(P + "-glow", [[0, "#FFE3A0", 0.75], [1, "#FFE3A0", 0]]) +
      S.rad(P + "-cyan", [[0, "#7FE3FF", 0.5], [1, "#7FE3FF", 0]]);
    var s = "";
    var W = G.win;
    // wall with the window cut out (even-odd), wainscot, ceiling
    s += tag("path", { d: "M-300 -300 H4140 V" + G.floor + " H-300 Z M" + W.x + " " + W.y + " V" + (W.y + W.h) + " H" + (W.x + W.w) + " V" + W.y + " Z", fill: "url(#" + P + "-wall)", "fill-rule": "evenodd" });
    s += tag("rect", { x: -300, y: 1180, width: 4440, height: G.floor - 1180, fill: "url(#" + P + "-wain)" });
    s += tag("rect", { x: -300, y: 1170, width: 4440, height: 18, fill: room("#F7F1E4") }) + tag("rect", { x: -300, y: 1188, width: 4440, height: 6, fill: room("#4E8A81"), opacity: 0.6 });
    for (var wp = -260; wp < 4140; wp += 120) s += tag("path", { d: "M" + wp + " 1200 V" + (G.floor - 10), stroke: room("#4E8A81"), "stroke-width": 3, opacity: 0.35 });
    s += tag("rect", { x: -300, y: -300, width: 4440, height: G.ceiling + 300, fill: room("#E9DCC5") }) + tag("rect", { x: -300, y: G.ceiling - 14, width: 4440, height: 14, fill: room("#D3C0A0") });
    // window frame, sill, mullions
    var fr = room("#FBF7EF"), frL = room("#B9A886");
    s += tag("rect", { x: W.x - 28, y: W.y - 28, width: W.w + 56, height: W.h + 56, rx: 8, fill: "none", stroke: fr, "stroke-width": 36 });
    s += tag("rect", { x: W.x - 46, y: W.y - 46, width: W.w + 92, height: W.h + 92, rx: 12, fill: "none", stroke: frL, "stroke-width": 4 });
    s += tag("path", { d: "M" + (W.x + W.w / 2) + " " + W.y + " V" + (W.y + W.h) + " M" + W.x + " " + (W.y + W.h * 0.46) + " H" + (W.x + W.w), stroke: fr, "stroke-width": 20 });
    s += tag("rect", { x: W.x - 70, y: W.y + W.h + 22, width: W.w + 140, height: 34, rx: 6, fill: room("#F2E8D6"), stroke: frL, "stroke-width": 4 });
    // glass glint
    s += tag("path", { d: "M" + (W.x + 60) + " " + (W.y + 300) + " L" + (W.x + 230) + " " + (W.y + 60) + " M" + (W.x + 110) + " " + (W.y + 320) + " L" + (W.x + 250) + " " + (W.y + 120), stroke: "#FFFFFF", "stroke-width": 16, opacity: dim ? 0.08 : 0.25, "stroke-linecap": "round" });
    // a cactus and a small plant on the sill
    var sill = W.y + W.h + 22;
    s += tag("path", { d: "M" + (W.x + 90) + " " + (sill - 50) + " h70 l-8 50 h-54 Z", fill: room("#D9764A"), stroke: room("#8E4325"), "stroke-width": 4 });
    s += tag("rect", { x: W.x + 108, y: sill - 150, width: 34, height: 104, rx: 17, fill: room("#5FA04A"), stroke: room("#2E6B33"), "stroke-width": 4 }) + tag("rect", { x: W.x + 132, y: sill - 120, width: 34, height: 18, rx: 9, fill: room("#5FA04A"), stroke: room("#2E6B33"), "stroke-width": 4 });
    s += tag("path", { d: "M" + (W.x + W.w - 160) + " " + (sill - 46) + " h80 l-10 46 h-60 Z", fill: room("#4C7FB5"), stroke: room("#274A70"), "stroke-width": 4 });
    for (var lf = 0; lf < 6; lf++) s += tag("ellipse", { cx: W.x + W.w - 120 + (lf - 2.5) * 16, cy: sill - 70 - (lf % 2) * 20, rx: 14, ry: 34, fill: room("#4E9A48"), transform: "rotate(" + ((lf - 2.5) * 18) + " " + (W.x + W.w - 120 + (lf - 2.5) * 16) + " " + (sill - 70) + ")" });
    // poster: a grid of coloured element tiles (no text)
    var Po = G.poster;
    s += tag("rect", { x: Po.x, y: Po.y, width: Po.w, height: Po.h, rx: 8, fill: room("#FFFDF7"), stroke: room("#B9A886"), "stroke-width": 5 });
    var cols = ["#F08C8C", "#F5B971", "#F2DD7A", "#9ED69A", "#8CC8F0", "#B9A4F0"];
    for (var py = 0; py < 7; py++) for (var px = 0; px < 6; px++) {
      if (py === 0 && px > 0 && px < 5) continue;
      if (py === 1 && px > 1 && px < 4) continue;
      s += tag("rect", { x: Po.x + 20 + px * 39, y: Po.y + 26 + py * 46, width: 33, height: 38, rx: 4, fill: room(cols[(px + (py > 4 ? 2 : 0)) % 6]) });
    }
    // wall screen (the anchor): bezel, glowing panel, a soft grid
    var Sc = G.screen;
    s += tag("rect", { x: Sc.x - 10, y: Sc.y + Sc.h + 8, width: Sc.w + 20, height: 20, rx: 10, fill: "#000", opacity: 0.12 });
    s += tag("rect", { x: Sc.x - 26, y: Sc.y - 26, width: Sc.w + 52, height: Sc.h + 52, rx: 26, fill: room("#2A3540"), stroke: room("#141B22"), "stroke-width": 5 });
    s += tag("rect", { x: Sc.x, y: Sc.y, width: Sc.w, height: Sc.h, rx: 10, fill: "url(#" + P + "-screen)" });
    var grid = "";
    for (var gx = Sc.x + 60; gx < Sc.x + Sc.w; gx += 80) grid += "M" + gx + " " + (Sc.y + 10) + " V" + (Sc.y + Sc.h - 10) + " ";
    for (var gy = Sc.y + 60; gy < Sc.y + Sc.h; gy += 80) grid += "M" + (Sc.x + 10) + " " + gy + " H" + (Sc.x + Sc.w - 10) + " ";
    s += tag("path", { d: grid, stroke: "#5FC8F0", "stroke-width": 2, opacity: 0.16 });
    s += tag("path", { d: "M" + (Sc.x + 30) + " " + (Sc.y + 30) + " L" + (Sc.x + 300) + " " + (Sc.y + 30) + " L" + (Sc.x + 30) + " " + (Sc.y + 220) + " Z", fill: "#FFFFFF", opacity: 0.05 });
    s += tag("g", { "data-part": "screen-wave" }, "");
    s += tag("circle", { cx: Sc.x + Sc.w - 20, cy: Sc.y + Sc.h + 12, r: 5, fill: "#5FE3A0" });
    if (dim) s += tag("ellipse", { cx: Sc.x + Sc.w / 2, cy: Sc.y + Sc.h / 2, rx: Sc.w * 0.85, ry: Sc.h * 0.95, fill: "url(#" + P + "-cyan)" });
    // shelves with glassware and books
    var Sh = G.shelf, wood = room("#B98552"), woodD = room("#7A5230");
    for (var k = 0; k < 3; k++) {
      var y = Sh.y + 200 + k * 230;
      s += tag("rect", { x: Sh.x, y: y, width: Sh.w, height: 22, rx: 4, fill: wood, stroke: woodD, "stroke-width": 4 });
      s += tag("path", { d: "M" + (Sh.x + 40) + " " + (y + 22) + " l20 40 M" + (Sh.x + Sh.w - 40) + " " + (y + 22) + " l-20 40", stroke: woodD, "stroke-width": 8, "stroke-linecap": "round" });
      var liq = ["#FF7A7A", "#5FD3A0", "#7FB8FF", "#FFC94D", "#C38BFF"];
      if (k === 1) { // books
        for (var bk = 0; bk < 9; bk++) {
          var bh = 120 + (bk * 37) % 50, bw = 34 + (bk % 3) * 6;
          s += tag("rect", { x: Sh.x + 40 + bk * 46, y: y - bh, width: bw, height: bh, rx: 4, fill: room(["#C0504D", "#4F81BD", "#9BBB59", "#E8A33C", "#8064A2"][bk % 5]), stroke: room("#3A2F28"), "stroke-width": 3 });
          s += tag("rect", { x: Sh.x + 40 + bk * 46 + 6, y: y - bh + 20, width: bw - 12, height: 8, fill: "#fff", opacity: 0.5 });
        }
        s += flask(Sh.x + Sh.w - 90, y, 130, room(liq[4]), room, "round");
      } else {
        for (var fl = 0; fl < 4; fl++) s += flask(Sh.x + 80 + fl * 150, y, 120 + (fl % 2) * 40, room(liq[(fl + k * 2) % 5]), room, ["conical", "beaker", "round", "conical"][(fl + k) % 4]);
      }
    }
    // a wall clock and a hazard sign by the door
    s += tag("circle", { cx: 3240, cy: 360, r: 70, fill: room("#FFFDF7"), stroke: room("#3A4651"), "stroke-width": 10 }) + tag("path", { d: "M3240 360 V310 M3240 360 L3276 380", stroke: room("#3A4651"), "stroke-width": 8, "stroke-linecap": "round" });
    // door
    var Dr = G.door;
    s += tag("rect", { x: Dr.x - 26, y: Dr.y - 26, width: Dr.w + 52, height: Dr.h + 26, fill: room("#F7F1E4"), stroke: room("#B9A886"), "stroke-width": 4 });
    s += tag("rect", { x: Dr.x, y: Dr.y, width: Dr.w, height: Dr.h, fill: room("#4F8F86"), stroke: room("#2F5E58"), "stroke-width": 6 });
    s += tag("rect", { x: Dr.x + 30, y: Dr.y + 470, width: Dr.w - 60, height: 330, rx: 6, fill: "none", stroke: room("#3F7A72"), "stroke-width": 6 });
    s += tag("rect", { x: Dr.x + 80, y: Dr.y + 70, width: Dr.w - 160, height: 300, rx: 8, fill: dim ? "#2A3A66" : "#CDEAF5", stroke: room("#2F5E58"), "stroke-width": 8 });
    s += tag("path", { d: "M" + (Dr.x + 110) + " " + (Dr.y + 200) + " l60 -90", stroke: "#fff", "stroke-width": 12, opacity: 0.4, "stroke-linecap": "round" });
    s += tag("rect", { x: Dr.x + 30, y: Dr.y + 430, width: 70, height: 22, rx: 11, fill: room("#E7C46A"), stroke: room("#8A6A20"), "stroke-width": 4 });
    s += tag("path", { d: "M" + (Dr.x + Dr.w / 2) + " " + (Dr.y - 150) + " l44 76 h-88 Z", fill: room("#FFD43B"), stroke: room("#3A2F28"), "stroke-width": 6, "stroke-linejoin": "round" }) +
      tag("path", { d: "M" + (Dr.x + Dr.w / 2) + " " + (Dr.y - 124) + " v26 M" + (Dr.x + Dr.w / 2) + " " + (Dr.y - 88) + " v2", stroke: room("#3A2F28"), "stroke-width": 7, "stroke-linecap": "round" });
    // fire extinguisher
    s += tag("rect", { x: 3170, y: 1260, width: 60, height: 180, rx: 26, fill: room("#E03131"), stroke: room("#8A1C1C"), "stroke-width": 5 }) + tag("path", { d: "M3200 1260 v-30 h36", stroke: room("#2A2A2A"), "stroke-width": 10, fill: "none" });
    // floor: tiles in perspective toward a vanishing point
    s += tag("rect", { x: -300, y: G.floor, width: 4440, height: 1000, fill: "url(#" + P + "-floor)" });
    var VP = { x: 1920, y: 520 }, fl2 = "";
    for (var fx = -2400; fx <= 6240; fx += 240) fl2 += "M" + r2(VP.x + (fx - VP.x) * (G.floor - VP.y) / (2400 - VP.y)) + " " + G.floor + " L" + fx + " 2400 ";
    [1560, 1640, 1740, 1870, 2030, 2240].forEach(function (yy) { fl2 += "M-300 " + yy + " H4140 "; });
    s += tag("path", { d: fl2, stroke: room("#A99A86"), "stroke-width": 3, opacity: 0.55 });
    s += tag("rect", { x: -300, y: G.floor - 6, width: 4440, height: 16, fill: room("#3F6F68") });
    // sunlight from the window across the floor (bright) / a lamp pool (dim)
    if (!dim) s += tag("path", { d: "M" + W.x + " " + (W.y + W.h) + " L" + (W.x + W.w) + " " + (W.y + W.h) + " L" + (W.x + W.w + 900) + " 2160 L" + (W.x + 300) + " 2160 Z", fill: "url(#" + P + "-beam)" });
    // a warm rug in front of the bench and a lab stool
    s += tag("ellipse", { cx: 1960, cy: 1760, rx: 900, ry: 150, fill: room("#C8553D"), opacity: 0.9 }) + tag("ellipse", { cx: 1960, cy: 1760, rx: 840, ry: 124, fill: "none", stroke: room("#F2C57C"), "stroke-width": 10, "stroke-dasharray": "34 22" });
    var st = function (x, y) {
      return tag("path", { d: "M" + (x - 60) + " " + y + " L" + (x - 30) + " " + (y - 200) + " M" + (x + 60) + " " + y + " L" + (x + 30) + " " + (y - 200) + " M" + (x - 50) + " " + (y - 60) + " H" + (x + 50), stroke: room("#5F6E78"), "stroke-width": 10, "stroke-linecap": "round" }) +
        tag("ellipse", { cx: x, cy: y - 206, rx: 80, ry: 22, fill: room("#2F7F74"), stroke: room("#1E544D"), "stroke-width": 5 });
    };
    s += st(2980, 1640);
    // the bench: cabinets, worktop, then the things on it
    var B = G.bench;
    s += tag("rect", { x: B.x0 + 20, y: B.base - 4, width: B.x1 - B.x0 - 40, height: 26, rx: 10, fill: "#000", opacity: 0.14 });
    s += tag("rect", { x: B.x0 + 20, y: B.front, width: B.x1 - B.x0 - 40, height: B.base - B.front, fill: room("#E9EEF0"), stroke: room("#8A99A3"), "stroke-width": 5 });
    for (var cb = 0; cb < 6; cb++) {
      var cx = B.x0 + 40 + cb * ((B.x1 - B.x0 - 80) / 6), cw = (B.x1 - B.x0 - 80) / 6 - 16;
      s += tag("rect", { x: cx, y: B.front + 20, width: cw, height: B.base - B.front - 40, rx: 8, fill: room("#F6F8F9"), stroke: room("#A8B5BD"), "stroke-width": 4 });
      s += tag("rect", { x: cx + cw / 2 - 40, y: B.front + 44, width: 80, height: 12, rx: 6, fill: room("#8A99A3") });
    }
    s += tag("rect", { x: B.x0, y: B.top - 4, width: B.x1 - B.x0, height: B.front - B.top + 4, rx: 8, fill: "url(#" + P + "-top)", stroke: room("#8A5A2B"), "stroke-width": 5 });
    s += tag("path", { d: "M" + (B.x0 + 8) + " " + (B.top + 6) + " H" + (B.x1 - 8), stroke: room("#F6D7A8"), "stroke-width": 5 });
    // on the bench, left part: microscope, test-tube rack; right part: burner, flasks. Middle kept clear.
    var top = B.top - 2;
    var mx = 1330, mc = room("#4A6FA5"), md = room("#2C4466");
    s += "<g transform=\"translate(" + mx + " " + top + ") scale(0.72) translate(" + -mx + " " + -top + ")\">";
    s += tag("rect", { x: mx - 70, y: top - 26, width: 150, height: 26, rx: 8, fill: mc, stroke: md, "stroke-width": 4 });
    s += tag("path", { d: "M" + (mx + 40) + " " + (top - 26) + " C" + (mx + 70) + " " + (top - 120) + " " + (mx + 50) + " " + (top - 200) + " " + (mx + 10) + " " + (top - 230), stroke: mc, "stroke-width": 30, fill: "none", "stroke-linecap": "round" });
    s += tag("rect", { x: mx - 60, y: top - 110, width: 110, height: 16, rx: 6, fill: md });
    s += tag("g", { transform: "rotate(-24 " + (mx - 10) + " " + (top - 220) + ")" }, tag("rect", { x: mx - 30, y: top - 330, width: 40, height: 170, rx: 10, fill: room("#E8EDF2"), stroke: md, "stroke-width": 4 }) + tag("rect", { x: mx - 36, y: top - 350, width: 52, height: 30, rx: 8, fill: md }));
    s += "</g>";
    var rk = 1530;
    s += "<g transform=\"translate(" + rk + " " + top + ") scale(0.78) translate(" + -rk + " " + -top + ")\">";
    s += tag("rect", { x: rk - 90, y: top - 70, width: 180, height: 20, rx: 6, fill: room("#B98552"), stroke: room("#7A5230"), "stroke-width": 4 }) + tag("rect", { x: rk - 90, y: top - 14, width: 180, height: 14, rx: 4, fill: room("#B98552"), stroke: room("#7A5230"), "stroke-width": 4 });
    ["#FF7A7A", "#5FD3A0", "#7FB8FF", "#FFC94D", "#C38BFF"].forEach(function (c, i) {
      var tx = rk - 68 + i * 34;
      s += tag("rect", { x: tx - 10, y: top - 150, width: 20, height: 140, rx: 10, fill: "#EAF6FB", stroke: room("#5B7180"), "stroke-width": 3 }) + tag("rect", { x: tx - 7, y: top - 80 + (i % 3) * 14, width: 14, height: 66 - (i % 3) * 14, rx: 7, fill: room(c) });
    });
    s += "</g>";
    // burner with a flame (animated) and a flask on a tripod
    var bx = 2520;
    s += tag("path", { d: "M" + (bx - 70) + " " + top + " L" + (bx - 56) + " " + (top - 140) + " M" + (bx + 70) + " " + top + " L" + (bx + 56) + " " + (top - 140) + " M" + (bx - 64) + " " + (top - 140) + " H" + (bx + 64), stroke: room("#4B5563"), "stroke-width": 8, "stroke-linecap": "round" });
    s += tag("rect", { x: bx - 18, y: top - 70, width: 36, height: 70, rx: 8, fill: room("#8A99A3"), stroke: room("#4B5563"), "stroke-width": 4 }) + tag("rect", { x: bx - 40, y: top - 16, width: 80, height: 16, rx: 6, fill: room("#4B5563") });
    s += tag("g", { "data-part": "flame", transform: "translate(" + bx + " " + (top - 70) + ")" }, tag("path", { d: "M0 0 C-18 -22 -8 -48 0 -62 C8 -48 18 -22 0 0 Z", fill: "#4DABF7", opacity: 0.85 }) + tag("path", { d: "M0 -6 C-8 -16 -3 -30 0 -40 C3 -30 8 -16 0 -6 Z", fill: "#E7F5FF" }));
    s += flask(bx, top - 146, 130, room("#5FD3A0"), room, "round");
    s += tag("g", { "data-part": "bubbles" }, "");
    s += flask(2680, top, 120, room("#FF7A7A"), room, "conical") + flask(1720, top, 90, room("#7FB8FF"), room, "beaker");
    // a notebook and pencil near the middle (low, keeps the bench anchor clear)
    s += tag("rect", { x: 1560, y: top - 10, width: 110, height: 12, rx: 3, fill: room("#F5E9C9"), stroke: room("#9A8458"), "stroke-width": 3, transform: "rotate(-3 1615 " + top + ")" });
    // pendant lamps
    [600, 1250, 2700].forEach(function (lx, i) {
      var by = G.ceiling + 110;
      s += tag("path", { d: "M" + lx + " " + G.ceiling + " V" + (by - 70), stroke: room("#3A4651"), "stroke-width": 6 });
      s += tag("path", { d: "M" + (lx - 80) + " " + by + " Q" + lx + " " + (by - 110) + " " + (lx + 80) + " " + by + " Z", fill: room("#2F7F74"), stroke: room("#1E544D"), "stroke-width": 5 });
      s += tag("ellipse", { cx: lx, cy: by, rx: 54, ry: 14, fill: dim ? "#5A5A4A" : "#FFF3C4" });
      if (!dim) s += tag("ellipse", { cx: lx, cy: by + 90, rx: 330, ry: 210, fill: "url(#" + P + "-glow)", opacity: 0.45, "data-lamp": i });
    });
    // desk lamp at the right of the clear middle, leaning over it
    var dl = 2290, dc = room("#E8590C"), dd = room("#8A3409");
    s += tag("ellipse", { cx: dl, cy: top - 8, rx: 44, ry: 12, fill: dc, stroke: dd, "stroke-width": 4 });
    s += tag("path", { d: "M" + dl + " " + (top - 12) + " L" + (dl - 30) + " " + (top - 120) + " L" + (dl - 110) + " " + (top - 150), stroke: room("#4B5563"), "stroke-width": 9, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
    s += tag("path", { d: "M" + (dl - 100) + " " + (top - 170) + " L" + (dl - 180) + " " + (top - 120) + " L" + (dl - 132) + " " + (top - 92) + " Z", fill: dc, stroke: dd, "stroke-width": 4, "stroke-linejoin": "round" });
    if (dim) {
      s += tag("path", { d: "M" + (dl - 180) + " " + (top - 120) + " L" + (dl - 132) + " " + (top - 92) + " L" + (dl - 60) + " " + top + " L" + (dl - 420) + " " + top + " Z", fill: "#FFE3A0", opacity: 0.16 });
      s += tag("ellipse", { cx: dl - 240, cy: top, rx: 420, ry: 170, fill: "url(#" + P + "-glow)", opacity: 0.75 });
      s += tag("ellipse", { cx: dl - 240, cy: top + 6, rx: 230, ry: 30, fill: "#FFE3A0", opacity: 0.35 });
    }
    return { defs: defs, body: s };
  }

  function drawFront(P, v, tone, R) {
    var room = LOOK[v].room, s = "";
    // a big potted plant, bottom-left
    var px = 120, py = 2200;
    s += tag("path", { d: "M" + (px - 130) + " " + (py - 240) + " h260 l-30 260 h-200 Z", fill: room("#E07A4F"), stroke: room("#8E4325"), "stroke-width": 6 }) + tag("rect", { x: px - 146, y: py - 270, width: 292, height: 44, rx: 10, fill: room("#EE8C5E"), stroke: room("#8E4325"), "stroke-width": 6 });
    for (var l = 0; l < 11; l++) {
      var a = -150 + l * 12 + (R() - 0.5) * 8, len = 260 + R() * 220, rad = a * Math.PI / 180;
      var ex = px + Math.cos(rad) * len, ey = py - 270 + Math.sin(rad) * len;
      s += tag("path", { d: "M" + px + " " + (py - 270) + " Q" + r2(px + Math.cos(rad) * len * 0.4 - 30) + " " + r2(py - 270 + Math.sin(rad) * len * 0.6) + " " + r2(ex) + " " + r2(ey), stroke: room("#2E6B33"), "stroke-width": 6, fill: "none" });
      s += tag("ellipse", { cx: r2(ex), cy: r2(ey), rx: 70, ry: 30, fill: room(l % 2 ? "#4E9A48" : "#6DB552"), stroke: room("#2E6B33"), "stroke-width": 4, transform: "rotate(" + r2(a + 10) + " " + r2(ex) + " " + r2(ey) + ")" });
    }
    // a glassware cart, bottom-right
    var cx = 3700, cy = 2130, steel = room("#AAB7C0"), steelD = room("#5F6E78");
    s += tag("rect", { x: cx - 230, y: cy - 260, width: 460, height: 26, rx: 8, fill: steel, stroke: steelD, "stroke-width": 5 }) + tag("rect", { x: cx - 230, y: cy - 40, width: 460, height: 26, rx: 8, fill: steel, stroke: steelD, "stroke-width": 5 });
    s += tag("path", { d: "M" + (cx - 210) + " " + (cy - 240) + " V" + (cy + 40) + " M" + (cx + 210) + " " + (cy - 240) + " V" + (cy + 40), stroke: steelD, "stroke-width": 12 });
    s += tag("circle", { cx: cx - 210, cy: cy + 60, r: 22, fill: room("#3A4651") }) + tag("circle", { cx: cx + 210, cy: cy + 60, r: 22, fill: room("#3A4651") });
    s += flask(cx - 120, cy - 262, 170, room("#C38BFF"), room, "conical") + flask(cx + 40, cy - 262, 140, room("#FFC94D"), room, "beaker") + flask(cx + 150, cy - 262, 150, room("#5FD3A0"), room, "round");
    s += tag("g", { "data-part": "motes" }, "");
    return { defs: "", body: s };
  }

  // ---- the extension (vertical videos): a ceiling above, more floor and storage below -------
  // Band art is in the TALL world's px (3840 x 3600): the original sits at y 720 .. 2880. The
  // original's top strip (its y 0 .. 170) reads as a bulkhead beam along the wall; above it the
  // upper wall with a high storage shelf, a duct run, and the ceiling in perspective.
  var XVP = { x: 1920, y: 520 + 720 }; // the room's vanishing point (the floor's), in tall px
  var CEIL = 300; // where the ceiling meets the back wall (tall px)

  function drawTopBand(P, v, R) {
    var dim = v === "dim", room = LOOK[v].room, s = "";
    var defs = S.lin(P + "-xceil", [[0, room("#CDBD9F")], [1, room("#E4D6BC")]]) +
      S.lin(P + "-xupper", [[0, room("#E6D7BD")], [0.35, room("#F1E4CE")], [1, room("#F4E8D4")]]) +
      S.lin(P + "-xduct", [[0, room("#E3E8EC")], [0.45, room("#C3CCD3")], [1, room("#8F9AA3")]]) +
      S.lin(P + "-xpanel", dim ? [[0, "#8C93A8"], [1, "#6E7690"]] : [[0, "#FFFFFF"], [1, "#FFF4D6"]]) +
      S.rad(P + "-xglow", [[0, dim ? "#9FB4FF" : "#FFF6DA", dim ? 0.12 : 0.6], [1, "#FFF6DA", 0]]);
    // the upper back wall, from the ceiling line down to the beam
    s += tag("rect", { x: -300, y: CEIL, width: 4440, height: 700 - CEIL, fill: "url(#" + P + "-xupper)" });
    // the ceiling plane: tiles in perspective toward the vanishing point
    s += tag("rect", { x: -300, y: -200, width: 4440, height: CEIL + 200, fill: "url(#" + P + "-xceil)" });
    var lines = "", k = (XVP.y - CEIL);
    for (var gx = -2400; gx <= 6240; gx += 300) { // through x = gx at the ceiling line, out to y -200
      var x0 = XVP.x + (gx - XVP.x), x1 = XVP.x + (gx - XVP.x) * (XVP.y + 200) / k;
      lines += "M" + r2(x0) + " " + CEIL + " L" + r2(x1) + " -200 ";
    }
    [250, 186, 104, 0].forEach(function (yy) { lines += "M-300 " + yy + " H4140 "; });
    s += tag("path", { d: lines, stroke: room("#B5A588"), "stroke-width": 3, opacity: 0.6 });
    s += tag("rect", { x: -300, y: CEIL - 6, width: 4440, height: 12, fill: room("#D3C0A0") }); // the cove where ceiling meets wall
    // light fittings: long panels between the tile lines (they glow in the bright lab)
    var xOn = function (gx, y) { return XVP.x + (gx - XVP.x) * (XVP.y - y) / k; };
    [[0, 250, 186], [1200, 250, 186], [2400, 250, 186], [3600, 250, 186], [600, 186, 104], [1800, 186, 104], [3000, 186, 104], [0, 104, 0], [1200, 104, 0], [2400, 104, 0], [3600, 104, 0]].forEach(function (L, i) {
      var y0 = L[1], y1 = L[2], a = xOn(L[0], y0) + 14, b = xOn(L[0] + 600, y0) - 14, c = xOn(L[0] + 600, y1) - 18, d = xOn(L[0], y1) + 18;
      s += tag("path", { d: "M" + r2(a) + " " + (y0 - 8) + " L" + r2(b) + " " + (y0 - 8) + " L" + r2(c) + " " + (y1 + 8) + " L" + r2(d) + " " + (y1 + 8) + " Z", fill: room("#9A8E78"), opacity: 0.55 });
      s += tag("path", { d: "M" + r2(a + 8) + " " + (y0 - 14) + " L" + r2(b - 8) + " " + (y0 - 14) + " L" + r2(c - 10) + " " + (y1 + 14) + " L" + r2(d + 10) + " " + (y1 + 14) + " Z", fill: "url(#" + P + "-xpanel)" });
      s += tag("path", { d: "M" + r2((a + d) / 2 + 30) + " " + ((y0 + y1) / 2) + " L" + r2((b + c) / 2 - 30) + " " + ((y0 + y1) / 2), stroke: room("#C9BFA8"), "stroke-width": 4, opacity: dim ? 0.5 : 0.35 });
      if (!dim) s += tag("ellipse", { cx: r2((a + b) / 2), cy: r2((y0 + y1) / 2 + 40), rx: 420, ry: 150, fill: "url(#" + P + "-xglow)", "data-xlamp": i });
    });
    // a sprinkler head and a smoke detector on the ceiling
    [[1180, 220], [2860, 230]].forEach(function (q) { s += tag("path", { d: "M" + q[0] + " " + (q[1] - 18) + " v14 m-16 4 h32", stroke: room("#C23B2E"), "stroke-width": 6, "stroke-linecap": "round" }); });
    s += tag("ellipse", { cx: 2120, cy: 236, rx: 38, ry: 12, fill: room("#F7F2E6"), stroke: room("#A89A80"), "stroke-width": 3 }) + tag("circle", { cx: 2136, cy: 236, r: 4, fill: dim ? "#FF5A5A" : "#E03131", "data-blink": 0 });
    // the duct run under the ceiling line: rectangular, galvanised, hung on straps, with a grille
    var dy0 = 330, dy1 = 410, duct = "";
    for (var hx = -200; hx < 4140; hx += 520) duct += tag("path", { d: "M" + hx + " " + (CEIL + 4) + " V" + (dy0 + 6) + " M" + (hx + 60) + " " + (CEIL + 4) + " V" + (dy0 + 6), stroke: room("#6F7A82"), "stroke-width": 5 });
    duct += tag("rect", { x: -300, y: dy0 + 12, width: 4440, height: dy1 - dy0 + 6, fill: "#000", opacity: 0.08 }); // its shadow on the wall
    duct += tag("rect", { x: -300, y: dy0, width: 4440, height: dy1 - dy0, fill: "url(#" + P + "-xduct)", stroke: room("#6F7A82"), "stroke-width": 4 });
    for (var jx = -120; jx < 4140; jx += 400) duct += tag("rect", { x: jx, y: dy0 - 4, width: 16, height: dy1 - dy0 + 8, rx: 3, fill: room("#B4BEC6"), stroke: room("#6F7A82"), "stroke-width": 3 });
    duct += tag("path", { d: "M-300 " + (dy0 + 14) + " H4140", stroke: "#FFFFFF", "stroke-width": 5, opacity: 0.45 });
    [[860, 0], [2960, 1]].forEach(function (g) { // diffuser grilles on the duct's face
      var gx = g[0], gl = "";
      for (var k2 = 0; k2 < 6; k2++) gl += "M" + (gx + 14) + " " + (dy0 + 16 + k2 * 10) + " h132 ";
      duct += tag("rect", { x: gx, y: dy0 + 8, width: 160, height: dy1 - dy0 - 16, rx: 6, fill: room("#D9DFE4"), stroke: room("#6F7A82"), "stroke-width": 3 }) + tag("path", { d: gl, stroke: room("#7F8A93"), "stroke-width": 4 });
    });
    // a red sprinkler pipe and a cable tray, just below the duct
    duct += tag("path", { d: "M-300 432 H4140", stroke: room("#C23B2E"), "stroke-width": 14 }) + tag("path", { d: "M-300 428 H4140", stroke: "#FFFFFF", "stroke-width": 3, opacity: 0.35 });
    for (var cx = 140; cx < 4140; cx += 900) duct += tag("path", { d: "M" + cx + " 436 v16 m-12 0 h24", stroke: room("#9A2A20"), "stroke-width": 6, "stroke-linecap": "round" });
    s += duct;
    // the top shelf: a long high shelf on brackets with storage boxes, bottles, a globe and a plant
    var sy = 610, sx0 = 1440, sx1 = 3260, wood = room("#B98552"), woodD = room("#7A5230");
    var sh = tag("rect", { x: sx0 - 6, y: sy + 22, width: sx1 - sx0 + 12, height: 16, fill: "#000", opacity: 0.08 });
    var it = "";
    var box = function (x, w, h, c, lid) {
      return tag("rect", { x: x, y: sy - h, width: w, height: h, rx: 6, fill: room(c), stroke: room("#5E4A3A"), "stroke-width": 4 }) +
        (lid ? tag("rect", { x: x - 4, y: sy - h - 4, width: w + 8, height: 18, rx: 5, fill: room(D.shade(c, 0.12)), stroke: room("#5E4A3A"), "stroke-width": 4 }) : "") +
        tag("rect", { x: x + w / 2 - 26, y: sy - h * 0.6, width: 52, height: 30, rx: 4, fill: room("#FFFDF7"), stroke: room("#9A8458"), "stroke-width": 2 }) +
        tag("circle", { cx: x + w / 2 - 12, cy: sy - h * 0.6 + 15, r: 6, fill: room(["#F08C8C", "#8CC8F0", "#9ED69A", "#F5B971"][(x / 10 | 0) % 4]) });
    };
    it += box(1490, 170, 120, "#D9B98A", true) + box(1670, 150, 96, "#B9D3E8", true) + box(1830, 120, 150, "#D9B98A", false);
    // big reagent bottles
    [[2010, "#7A4A2A"], [2090, "#3E6B8C"], [2160, "#7A4A2A"]].forEach(function (b, i) {
      it += tag("path", { d: "M" + (b[0] - 30) + " " + sy + " v-90 q0 -26 22 -30 v-26 h16 v26 q22 4 22 30 v90 Z", fill: room(b[1]), stroke: room("#2E2420"), "stroke-width": 4, opacity: 0.92 }) +
        tag("rect", { x: b[0] - 12, y: sy - 150, width: 24, height: 14, rx: 3, fill: room("#2E2420") }) +
        tag("rect", { x: b[0] - 22, y: sy - 70, width: 44, height: 34, rx: 4, fill: room("#FFFDF7") }) + tag("path", { d: "M" + (b[0] - 20) + " " + (sy - 104) + " q-4 30 0 50", stroke: "#FFFFFF", "stroke-width": 5, fill: "none", opacity: 0.35, "stroke-linecap": "round" });
    });
    // a globe on a stand
    var gx2 = 2330;
    it += tag("path", { d: "M" + (gx2 - 40) + " " + sy + " h80 l-14 -18 h-52 Z", fill: room("#7A5230") }) + tag("path", { d: "M" + gx2 + " " + (sy - 18) + " v-16", stroke: room("#7A5230"), "stroke-width": 8 });
    it += tag("circle", { cx: gx2, cy: sy - 96, r: 62, fill: room("#5EA9E0"), stroke: room("#2F5E80"), "stroke-width": 5 }) +
      tag("path", { d: "M" + (gx2 - 40) + " " + (sy - 130) + " q20 -10 34 6 q10 16 -8 26 q-16 8 -10 26 q-20 -4 -26 -30 Z M" + (gx2 + 10) + " " + (sy - 70) + " q24 -14 36 4 q-6 18 -30 14 Z", fill: room("#7CC25A") }) +
      tag("path", { d: "M" + (gx2 - 74) + " " + (sy - 96) + " a74 74 0 0 1 148 0", fill: "none", stroke: room("#B08A3E"), "stroke-width": 6 });
    // a stack of binders and a microscope case
    for (var bd = 0; bd < 6; bd++) it += tag("rect", { x: 2440 + bd * 34, y: sy - 130 + (bd % 2) * 8, width: 30, height: 130 - (bd % 2) * 8, rx: 3, fill: room(["#4F81BD", "#C0504D", "#9BBB59", "#E8A33C", "#8064A2", "#4BACC6"][bd]), stroke: room("#3A2F28"), "stroke-width": 3 });
    it += tag("rect", { x: 2680, y: sy - 110, width: 160, height: 110, rx: 12, fill: room("#3F6F68"), stroke: room("#24443F"), "stroke-width": 4 }) + tag("rect", { x: 2740, y: sy - 126, width: 40, height: 18, rx: 8, fill: "none", stroke: room("#24443F"), "stroke-width": 6 }) +
      tag("rect", { x: 2700, y: sy - 70, width: 120, height: 8, rx: 4, fill: room("#E7C46A") });
    // a trailing plant at the shelf's right end (its leaves hang over the edge, above the beam)
    var px = 3020;
    it += tag("path", { d: "M" + (px - 60) + " " + (sy - 80) + " h120 l-14 80 h-92 Z", fill: room("#E07A4F"), stroke: room("#8E4325"), "stroke-width": 5 });
    for (var lv = 0; lv < 9; lv++) {
      var a = -150 + lv * 15, len = 70 + (lv % 3) * 26, rad = a * Math.PI / 180, lx = px + Math.cos(rad) * len, ly = sy - 80 + Math.sin(rad) * len;
      it += tag("ellipse", { cx: r2(lx), cy: r2(ly), rx: 30, ry: 15, fill: room(lv % 2 ? "#4E9A48" : "#6DB552"), stroke: room("#2E6B33"), "stroke-width": 3, transform: "rotate(" + r2(a) + " " + r2(lx) + " " + r2(ly) + ")" });
    }
    [[px + 50, 0], [px + 30, 1], [px + 66, 2]].forEach(function (vn) { // short vines over the shelf's lip (they stop above the beam)
      var vx = vn[0], vy = sy - 6, d = "M" + vx + " " + (vy - 10);
      for (var j = 0; j < 2; j++) d += " q" + (j % 2 ? -12 : 12) + " 10 0 " + (18 + vn[1] * 4);
      it += tag("path", { d: d, fill: "none", stroke: room("#2E6B33"), "stroke-width": 4 });
      for (var j2 = 0; j2 < 2; j2++) it += tag("ellipse", { cx: vx + (j2 % 2 ? -10 : 10), cy: vy + 8 + j2 * (18 + vn[1] * 4), rx: 13, ry: 7, fill: room("#5FA845") });
    });
    sh += it;
    sh += tag("rect", { x: sx0, y: sy, width: sx1 - sx0, height: 22, rx: 4, fill: wood, stroke: woodD, "stroke-width": 4 });
    for (var bk = sx0 + 80; bk + 300 < sx1; bk += 560) sh += tag("path", { d: "M" + bk + " " + (sy + 22) + " l20 34 M" + (bk + 300) + " " + (sy + 22) + " l-20 34", stroke: woodD, "stroke-width": 8, "stroke-linecap": "round" });
    s += sh;
    // a high air vent at the left, above the window
    s += tag("rect", { x: 420, y: 520, width: 300, height: 110, rx: 10, fill: room("#E9EEF0"), stroke: room("#8A99A3"), "stroke-width": 5 });
    var vl = "";
    for (var k3 = 0; k3 < 6; k3++) vl += "M436 " + (538 + k3 * 15) + " h268 ";
    s += tag("path", { d: vl, stroke: room("#8A99A3"), "stroke-width": 5 });
    // the beam: the original's top strip (its face runs on below the seam), its top edge here
    s += tag("rect", { x: -300, y: 668, width: 4440, height: 52, fill: room("#E9DCC5") });
    s += tag("rect", { x: -300, y: 664, width: 4440, height: 8, fill: room("#F7F1E4") });
    s += tag("rect", { x: -300, y: 656, width: 4440, height: 8, fill: "#000", opacity: 0.06 });
    // a grey conduit along the beam's top, with junction boxes and a cable dropping to each lamp's line
    s += tag("rect", { x: -300, y: 684, width: 4440, height: 14, rx: 7, fill: room("#B9C2C8"), stroke: room("#7F8A93"), "stroke-width": 3 });
    [300, 1250, 2200, 3150].forEach(function (jx) { s += tag("rect", { x: jx - 30, y: 676, width: 60, height: 32, rx: 5, fill: room("#D3D9DE"), stroke: room("#7F8A93"), "stroke-width": 3 }) + tag("circle", { cx: jx, cy: 692, r: 5, fill: room("#7F8A93") }); });
    return { defs: defs, body: s };
  }

  /* The bottom band: the tiled floor continued (its lines run on in perspective), a floor drain and
   * yellow safety lines, and in the foreground a counter's lower cabinets (drawers, doors) and its
   * under-bench storage (bins, boxes, a gas bottle). Starts below the seam (y 2880). */
  function drawBottomBand(P, v, R) {
    var dim = v === "dim", room = LOOK[v].room;
    var defs = "" + S.lin(P + "-xfloor", [[0, room("#BFB1A0")], [1, room("#A99B89")]]) +
      S.lin(P + "-xtop", [[0, room("#E2B77F")], [1, room("#C9965C")]]) +
      S.lin(P + "-xcab", [[0, room("#EEF2F4")], [1, room("#D7DEE2")]]) +
      S.lin(P + "-xbay", [[0, room("#5A6670")], [1, room("#3E4850")]]) +
      S.lin(P + "-xshade", [[0, "#000000", 0], [1, "#000000", 0.22]]);
    // behind the original: the floor's last colour, continued and darkening toward the viewer
    var under = tag("rect", { x: -300, y: 3200, width: 4440, height: 600, fill: "url(#" + P + "-xfloor)" });
    var s = "";
    // tile lines continued: the fan lines from where the original's stop (its y 2400), and two more rows
    var fl = "", fy0 = 2400 + 720, fy1 = 3800;
    for (var fx = -2400; fx <= 6240; fx += 240) {
      var x0 = fx, x1 = XVP.x + (fx - XVP.x) * (fy1 - XVP.y) / (fy0 - XVP.y);
      fl += "M" + x0 + " " + fy0 + " L" + r2(x1) + " " + fy1 + " ";
    }
    [3230, 3570].forEach(function (yy) { fl += "M-300 " + yy + " H4140 "; });
    s += tag("path", { d: fl, stroke: room("#A99A86"), "stroke-width": 3, opacity: 0.55 });
    // the window's sunlight on the floor (bright) runs on past the seam and fades: the original's
    // beam ends at its y 2160 with opacity 0.21 x (1 - u) across it (u: 0 at x 200 .. 1 at x 1900)
    if (!dim) {
      defs += '<linearGradient id="' + P + '-xbeam" gradientUnits="userSpaceOnUse" x1="200" y1="0" x2="1900" y2="0"><stop offset="0" stop-color="#FFF1C9" stop-opacity="0.21"/><stop offset="1" stop-color="#FFF1C9" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="' + P + '-xbeamfade" gradientUnits="userSpaceOnUse" x1="0" y1="2880" x2="0" y2="3260"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>' +
        '<mask id="' + P + '-xbeammask" maskUnits="userSpaceOnUse" x="-300" y="2870" width="4440" height="500"><rect x="-300" y="2870" width="4440" height="500" fill="url(#' + P + '-xbeamfade)"/></mask>';
      var bl = function (y) { return 500 + (y - 2880) * 300 / 1040; }, br = function (y) { return 1900 + (y - 2880) * 900 / 1040; };
      s += tag("path", { d: "M500 2880 L1900 2880 L" + r2(br(3270)) + " 3270 L" + r2(bl(3270)) + " 3270 Z", fill: "url(#" + P + "-xbeam)", mask: "url(#" + P + "-xbeammask)" });
    }
    // yellow-black safety lines on the floor, and a round drain
    s += tag("path", { d: "M1460 3060 H2560", stroke: room("#F2C230"), "stroke-width": 18 }) + tag("path", { d: "M1460 3060 H2560", stroke: room("#2E2A24"), "stroke-width": 18, "stroke-dasharray": "36 36" , opacity: 0.85 });
    s += tag("ellipse", { cx: 2010, cy: 3440, rx: 110, ry: 34, fill: room("#8E969C"), stroke: room("#5F6870"), "stroke-width": 5 });
    var dr = "";
    for (var dk = -3; dk <= 3; dk++) dr += "M" + (2010 + dk * 26) + " " + r2(3440 - Math.sqrt(1 - Math.pow(dk * 26 / 110, 2)) * 28) + " V" + r2(3440 + Math.sqrt(1 - Math.pow(dk * 26 / 110, 2)) * 28) + " ";
    s += tag("path", { d: dr, stroke: room("#4E565C"), "stroke-width": 6, "stroke-linecap": "round" });
    // a wet-floor sign (pictogram only) behind the left counter, and boxes by the right one
    s += tag("path", { d: "M1180 3150 L1236 2960 L1292 3150", fill: "none", stroke: room("#C9A21A"), "stroke-width": 8, "stroke-linejoin": "round" }) +
      tag("path", { d: "M1192 3124 L1236 2972 L1280 3124 Z", fill: room("#F2C230"), stroke: room("#9A7A1A"), "stroke-width": 5, "stroke-linejoin": "round" }) +
      tag("path", { d: "M1236 3020 v48 M1236 3088 v4", stroke: room("#2E2A24"), "stroke-width": 12, "stroke-linecap": "round" });
    [[2470, 3150, 120, 90], [2484, 3060, 92, 70]].forEach(function (b) {
      s += tag("rect", { x: b[0], y: b[1] - b[3], width: b[2], height: b[3], rx: 4, fill: room("#D9B98A"), stroke: room("#7A5A3A"), "stroke-width": 4 }) +
        tag("path", { d: "M" + b[0] + " " + (b[1] - b[3] + 16) + " h" + b[2], stroke: room("#A8844F"), "stroke-width": 4 });
    });
    // a step stool and a waste bin in the gap between the counters
    s += tag("path", { d: "M1620 3330 L1650 3220 H1790 L1820 3330", fill: "none", stroke: room("#5F6E78"), "stroke-width": 10, "stroke-linejoin": "round" }) + tag("rect", { x: 1636, y: 3204, width: 168, height: 24, rx: 8, fill: room("#2F7F74"), stroke: room("#1E544D"), "stroke-width": 4 });
    s += tag("path", { d: "M2270 3350 l-12 -150 h132 l-12 150 Z", fill: room("#4C7FB5"), stroke: room("#274A70"), "stroke-width": 5 }) + tag("rect", { x: 2248, y: 3190, width: 152, height: 18, rx: 6, fill: room("#3A6798"), stroke: room("#274A70"), "stroke-width": 4 }) +
      tag("path", { d: "M2300 3230 v90 M2324 3230 v90 M2348 3230 v90", stroke: room("#3A6798"), "stroke-width": 5, opacity: 0.7 });
    // the foreground counters: worktop top face, edge, then the cabinets (left) / storage bay (right)
    var top = 3170, edge = 3212, base = 3800;
    var counter = function (x0, x1) {
      var o = tag("rect", { x: x0 + 10, y: top - 16, width: x1 - x0 - 20, height: 24, fill: "#000", opacity: 0.1 });
      o += tag("path", { d: "M" + (x0 + 30) + " " + (top - 40) + " H" + (x1 - 30) + " L" + x1 + " " + top + " H" + x0 + " Z", fill: room("#E9C392"), stroke: room("#8A5A2B"), "stroke-width": 5, "stroke-linejoin": "round" });
      o += tag("rect", { x: x0, y: top, width: x1 - x0, height: edge - top, rx: 6, fill: "url(#" + P + "-xtop)", stroke: room("#8A5A2B"), "stroke-width": 5 });
      o += tag("path", { d: "M" + (x0 + 8) + " " + (top + 8) + " H" + (x1 - 8), stroke: room("#F6D7A8"), "stroke-width": 5 });
      o += tag("rect", { x: x0 + 20, y: edge, width: x1 - x0 - 40, height: base - edge, fill: room("#E9EEF0"), stroke: room("#8A99A3"), "stroke-width": 5 });
      return o;
    };
    // left counter: drawers over doors
    var L0 = -300, L1 = 1460, cab = counter(L0, L1);
    for (var cx = L0 + 40; cx < L1 - 60; cx += 290) {
      var w = 270;
      cab += tag("rect", { x: cx, y: edge + 20, width: w, height: 70, rx: 8, fill: "url(#" + P + "-xcab)", stroke: room("#A8B5BD"), "stroke-width": 4 }) + tag("rect", { x: cx + w / 2 - 40, y: edge + 48, width: 80, height: 12, rx: 6, fill: room("#8A99A3") });
      cab += tag("rect", { x: cx + w / 2 - 70, y: edge + 30, width: 34, height: 14, rx: 3, fill: room(["#F08C8C", "#8CC8F0", "#9ED69A", "#F5B971", "#B9A4F0"][((cx + 300) / 290 | 0) % 5]) });
      cab += tag("rect", { x: cx, y: edge + 104, width: w, height: 330, rx: 8, fill: "url(#" + P + "-xcab)", stroke: room("#A8B5BD"), "stroke-width": 4 }) + tag("rect", { x: cx + w - 40, y: edge + 130, width: 12, height: 80, rx: 6, fill: room("#8A99A3") });
    }
    // on the left worktop: a test-tube rack, a beaker, a notebook
    cab += tag("rect", { x: 300, y: top - 64, width: 170, height: 16, rx: 5, fill: room("#B98552"), stroke: room("#7A5230"), "stroke-width": 4 }) + tag("rect", { x: 300, y: top - 22, width: 170, height: 14, rx: 4, fill: room("#B98552"), stroke: room("#7A5230"), "stroke-width": 4 });
    ["#FF7A7A", "#5FD3A0", "#7FB8FF", "#FFC94D"].forEach(function (c, i) {
      cab += tag("rect", { x: 322 + i * 38, y: top - 140, width: 20, height: 128, rx: 10, fill: "#EAF6FB", stroke: room("#5B7180"), "stroke-width": 3 }) + tag("rect", { x: 325 + i * 38, y: top - 70 + (i % 2) * 14, width: 14, height: 54 - (i % 2) * 14, rx: 7, fill: room(c) });
    });
    cab += flask(760, top - 6, 140, room("#C38BFF"), room, "beaker") + tag("rect", { x: 960, y: top - 22, width: 180, height: 16, rx: 4, fill: room("#F5E9C9"), stroke: room("#9A8458"), "stroke-width": 3, transform: "rotate(-4 1050 " + (top - 14) + ")" });
    // right counter: an open under-bench storage bay (bins, boxes, a gas bottle) and a cupboard
    var R0 = 2620, R1 = 4140, st = counter(R0, R1);
    st += tag("rect", { x: R0 + 50, y: edge + 30, width: 960, height: 420, rx: 6, fill: "url(#" + P + "-xbay)", stroke: room("#8A99A3"), "stroke-width": 5 });
    st += tag("rect", { x: R0 + 50, y: edge + 210, width: 960, height: 16, fill: room("#C9D1D6"), stroke: room("#8A99A3"), "stroke-width": 3 });
    [[R0 + 80, 150, "#F2B33D"], [R0 + 250, 170, "#4FA3D9"], [R0 + 440, 150, "#E86A5A"], [R0 + 610, 170, "#6CC08A"]].forEach(function (b) { // bins on the shelf
      st += tag("path", { d: "M" + b[0] + " " + (edge + 210) + " l10 -120 h" + (b[1] - 20) + " l10 120 Z", fill: room(b[2]), stroke: room(D.shade(b[2], 0.45)), "stroke-width": 4 }) +
        tag("rect", { x: b[0] + b[1] / 2 - 24, y: edge + 130, width: 48, height: 26, rx: 4, fill: room("#FFFDF7") }) +
        tag("path", { d: "M" + (b[0] + 16) + " " + (edge + 90) + " h" + (b[1] - 32), stroke: "#FFFFFF", "stroke-width": 4, opacity: 0.3 });
    });
    [[R0 + 90, 200, 150, "#D9B98A"], [R0 + 310, 160, 110, "#C9A774"], [R0 + 490, 220, 170, "#D9B98A"]].forEach(function (b) { // cardboard boxes below
      var y = edge + 450;
      st += tag("rect", { x: b[0], y: y - b[2], width: b[1], height: b[2], rx: 4, fill: room(b[3]), stroke: room("#7A5A3A"), "stroke-width": 4 }) +
        tag("path", { d: "M" + b[0] + " " + (y - b[2] + 24) + " h" + b[1] + " M" + (b[0] + b[1] / 2) + " " + (y - b[2]) + " v24", stroke: room("#A8844F"), "stroke-width": 4 }) +
        tag("path", { d: "M" + (b[0] + b[1] / 2 - 22) + " " + (y - b[2] / 2) + " l10 -14 l10 14 M" + (b[0] + b[1] / 2) + " " + (y - b[2] / 2 - 14) + " v24", stroke: room("#7A5A3A"), "stroke-width": 4, fill: "none" });
    });
    // a gas bottle with its valve, chained in the bay
    var gx = R0 + 860;
    st += tag("rect", { x: gx - 44, y: edge + 250, width: 88, height: 230, rx: 40, fill: room("#3E8E6A"), stroke: room("#24553F"), "stroke-width": 5 }) + tag("rect", { x: gx - 16, y: edge + 228, width: 32, height: 28, rx: 6, fill: room("#8A99A3"), stroke: room("#4B5563"), "stroke-width": 4 }) +
      tag("path", { d: "M" + (gx - 40) + " " + (edge + 320) + " h80", stroke: room("#B0B7BD"), "stroke-width": 6, "stroke-dasharray": "10 6" }) + tag("rect", { x: gx - 30, y: edge + 360, width: 60, height: 40, rx: 4, fill: room("#FFFDF7") }) +
      tag("path", { d: "M" + (gx - 26) + " " + (edge + 280) + " q-6 60 0 140", stroke: "#FFFFFF", "stroke-width": 6, fill: "none", opacity: 0.3, "stroke-linecap": "round" });
    // a cupboard with a flammables diamond, at the right
    st += tag("rect", { x: R0 + 1050, y: edge + 30, width: 390, height: 420, rx: 8, fill: room("#F2C230"), stroke: room("#9A7A1A"), "stroke-width": 5 }) +
      tag("path", { d: "M" + (R0 + 1245) + " " + (edge + 80) + " l60 60 l-60 60 l-60 -60 Z", fill: room("#E8542C"), stroke: room("#FFFFFF"), "stroke-width": 6 }) +
      tag("path", { d: "M" + (R0 + 1245) + " " + (edge + 104) + " c18 22 22 40 0 58 c-22 -18 -14 -34 0 -58 Z", fill: "#FFFFFF" }) +
      tag("rect", { x: R0 + 1080, y: edge + 250, width: 14, height: 90, rx: 7, fill: room("#7A5A10") });
    // on the right worktop: a rack of flasks and a sample tray
    st += flask(2860, top - 6, 130, room("#5FD3A0"), room, "conical") + flask(3000, top - 6, 110, room("#FFC94D"), room, "round") + flask(3120, top - 6, 100, room("#7FB8FF"), room, "beaker");
    st += tag("rect", { x: 3300, y: top - 30, width: 260, height: 26, rx: 6, fill: room("#E9EEF0"), stroke: room("#8A99A3"), "stroke-width": 4 });
    for (var tw = 0; tw < 6; tw++) st += tag("circle", { cx: 3326 + tw * 42, cy: top - 30, r: 13, fill: room(["#FF7A7A", "#5FD3A0", "#7FB8FF"][tw % 3]), stroke: room("#5B7180"), "stroke-width": 3 });
    if (dim) { // an LED strip under the counters' lip glows in the dim lab
      st += tag("rect", { x: R0 + 20, y: edge + 2, width: R1 - R0 - 40, height: 8, fill: "#9FE7FF", opacity: 0.7 }) + tag("rect", { x: L0 + 20, y: edge + 2, width: L1 - L0 - 40, height: 8, fill: "#9FE7FF", opacity: 0.7 });
    }
    s += cab + st;
    // depth: the near floor and the counters' feet darken toward the bottom of the world
    s += tag("rect", { x: -300, y: 3200, width: 4440, height: 600, fill: "url(#" + P + "-xshade)" });
    return { defs: defs, under: under, body: s };
  }

  function mount(layers, opts) {
    opts = opts || {};
    var v = PL.variantOf(meta, opts);
    if (!layers || !layers.sky) throw new Error("place lab: mount needs the layers from HFKit.placeLayers");
    var P = opts.idPrefix || "place-lab";
    var seed = opts.seed === undefined ? 5 : opts.seed | 0;
    var parts = {
      sky: drawSky(P, v, null, D.rng(seed + 1)), far: drawFar(P, v, null, D.rng(seed + 2)), mid: drawMid(P, v, null, D.rng(seed + 3)),
      ground: drawGround(P, v, null, D.rng(seed + 4)), front: drawFront(P, v, null, D.rng(seed + 5)),
    };
    var X = PL.extendLayers(layers, opts, meta);
    var g = {};
    PL.LAYERS.forEach(function (name) { g[name] = PL.paint(X.layers[name], "lab-" + name, parts[name].defs, parts[name].body); });
    if (X.on) { // the bands above and below (tall-world px), on the ground layer
      var top = drawTopBand(P, v, D.rng(seed + 31)), bot = drawBottomBand(P, v, D.rng(seed + 32));
      PL.band(X.over.ground, "top", top.defs, top.body);
      PL.band(X.under.ground, "bottom", "", bot.under);
      PL.band(X.over.ground, "bottom", bot.defs, bot.body);
    }
    var xblink = X.on ? X.over.ground.querySelector("[data-blink]") : null;
    var dim = v === "dim";
    var clouds = [].slice.call(g.sky.querySelectorAll("[data-cloud]")).map(function (e) { return { e: e, base: e.getAttribute("transform") }; });
    var flame = g.ground.querySelector('[data-part="flame"]'), flameBase = flame.getAttribute("transform");
    var wave = D.el(g.ground.querySelector('[data-part="screen-wave"]'), "path", { fill: "none", stroke: "#7FE3FF", "stroke-width": 6, "stroke-linecap": "round", opacity: dim ? 0.9 : 0.7 });
    var bubG = g.ground.querySelector('[data-part="bubbles"]'), bubbles = D.presets.bubbles(seed + 9, 8);
    var bubEls = bubbles.list.map(function () { return D.el(bubG, "circle", { fill: "#E8FFF4", opacity: 0 }); });
    var moteG = g.front.querySelector('[data-part="motes"]'), MR = D.rng(seed + 21), motes = [];
    for (var i = 0; i < 16; i++) motes.push({ x: (dim ? 1500 : 500) + MR() * (dim ? 900 : 1300), y: (dim ? 1000 : 1300) + MR() * 600, y0: dim ? 1000 : 1300, s: MR() * 100 | 0,
      e: D.el(moteG, "circle", { r: 4, fill: dim ? "#FFE3A0" : "#FFF6D8", opacity: 0 }) });
    var Sc = G.screen, bx = 2520, flaskY = G.bench.top - 2 - 146 - 130 * 0.3;

    function update(t, cam) {
      PL.applyCamera(layers, cam);
      if (xblink) xblink.setAttribute("opacity", (t % 2) < 0.25 ? 1 : 0.25);
      clouds.forEach(function (c, i) {
        var x0 = CLOUDS[i][0], x = PL.art.wrap(x0 + t * (6 + i * 2), CLOUD_SPAN[0], CLOUD_SPAN[1]);
        c.e.setAttribute("transform", "translate(" + r2(x - x0) + " 0) " + c.base);
      });
      var fl = 1 + 0.12 * D.wobble(t, 4, 6);
      flame.setAttribute("transform", flameBase + " scale(" + r2(1 + 0.05 * D.wobble(t, 9, 5)) + " " + r2(fl) + ")");
      var d = "";
      for (var k = 0; k <= 48; k++) {
        var x = Sc.x + 60 + k * (Sc.w - 120) / 48;
        var y = Sc.y + Sc.h * 0.58 + Math.sin(k / 48 * Math.PI * 4 - t * 2.2) * 70 * Math.sin(k / 48 * Math.PI);
        d += (k ? " L" : "M") + r2(x) + " " + r2(y);
      }
      wave.setAttribute("d", d);
      bubbles.at(t).forEach(function (p, j) {
        var e = bubEls[j];
        e.setAttribute("cx", r2(bx + p.x * 0.9));
        e.setAttribute("cy", r2(flaskY + 16 + p.y * 0.7));
        e.setAttribute("r", r2(p.r * 0.7));
        e.setAttribute("opacity", r2(p.alive && p.u < 0.75 ? 0.8 * (1 - p.u) : 0));
      });
      motes.forEach(function (m) {
        var w = D.wobble(t, m.s, 0.4), w2 = D.wobble(t, m.s + 50, 0.3);
        var lo = m.y0 - 100, hi = m.y0 + 700, my = PL.art.wrap(m.y - t * 4, lo, hi);
        m.e.setAttribute("cx", r2(m.x + w * 50));
        m.e.setAttribute("cy", r2(my + w2 * 40));
        m.e.setAttribute("opacity", r2((0.3 + 0.3 * w) * PL.art.wrapFade(my, lo, hi, 80)));
      });
    }
    var a = anchorsFor(opts);
    update(0, X.ref);
    return { update: update, anchors: a.anchors, paths: a.paths, variant: v };
  }

  K.places = K.places || {};
  K.places.lab = { meta: meta, anchorsFor: anchorsFor, mount: mount };
})(typeof globalThis !== "undefined" ? globalThis : window);
