/* SPIKE: full-body presenter ("actor") on top of the kit figure: legs + coat tails, a walk
 * cycle, extra poses (raise / strike / carry / point-across) and a held prop (sledgehammer).
 * actorSVG(state) returns an SVG string in body units; the caller places it on screen.
 * Body units: feet at y = FEET, head top ~34. Pure function of its state. */
(function (root) {
  "use strict";
  var P = root.HFKitPresenter;
  var h = P.h;
  var FEET = 1300;

  function arm(shoulder, elbow, hand, wrist, upper, fore) {
    return { shoulder: shoulder, elbow: elbow, hand: hand, wrist: wrist || 0, upper: upper === undefined ? 1 : upper, fore: fore === undefined ? 1 : fore };
  }
  var REST = P.POSES["point-left"].right;
  // right arm is mirrored: 90 = out to screen right
  P.POSES.carry = { left: P.POSES.idle.left, right: arm(14, 8, "fist", 0, 0.95, 0.95), tilt: 2, gazeX: 0.6, gazeY: 0.1 };
  P.POSES.raise = { left: arm(40, 70, "open", -10), right: arm(150, 168, "fist", 0), tilt: -4, gazeX: 0.8, gazeY: 0.4 };
  P.POSES.strike = { left: arm(40, 20, "open", -10), right: arm(25, 25, "fist", 0), tilt: 5, gazeX: 0.9, gazeY: 0.8 };
  P.POSES["carry-point"] = { left: arm(-58, -96, "point", -2), right: arm(14, 8, "fist", 0, 0.95, 0.95), tilt: 3, gazeX: 1, gazeY: -0.1 };
  P.POSES["wave-carry"] = { left: arm(128, 170, "open", 4), right: arm(14, 8, "fist", 0, 0.95, 0.95), tilt: -2, gazeX: 0, gazeY: 0 };

  function legNode(pal, side, swing, lift) {
    // side -1 = screen-left leg. swing in degrees (forward/back read as sideways in front view)
    var hipX = side * 62, hipY = 820;
    var a = (swing * Math.PI) / 180;
    var thigh = 238, shin = 236;
    var kneeBend = Math.max(0, lift) * 0.6;
    var kx = hipX + Math.sin(a) * thigh, ky = hipY + Math.cos(a) * thigh;
    var b = a - (kneeBend * Math.PI) / 180 * side * 0;
    var ax = kx + Math.sin(a * 0.4) * shin, ay = ky + Math.cos(a * 0.4) * shin - Math.max(0, lift) * 0.5;
    var trous = "#2C3550", trLine = "#151A2A";
    var w1 = 34, w2 = 28;
    function seg(x1, y1, x2, y2, ra, rb) {
      var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      return "M " + (x1 + nx * ra) + " " + (y1 + ny * ra) + " L " + (x2 + nx * rb) + " " + (y2 + ny * rb) +
        " L " + (x2 - nx * rb) + " " + (y2 - ny * rb) + " L " + (x1 - nx * ra) + " " + (y1 - ny * ra) + " Z";
    }
    return h("g", {}, [
      h("path", { d: seg(hipX, hipY, kx, ky, w1, w2 + 2), fill: trous, stroke: trLine, "stroke-width": 5, "stroke-linejoin": "round" }),
      h("path", { d: seg(kx, ky, ax, ay, w2 + 2, w2), fill: trous, stroke: trLine, "stroke-width": 5, "stroke-linejoin": "round" }),
      h("circle", { cx: kx, cy: ky, r: w2 + 1, fill: trous }),
      // shoe
      h("path", { d: "M " + (ax - 30) + " " + (ay - 6) + " C " + (ax - 34) + " " + (ay + 30) + " " + (ax + side * 70) + " " + (ay + 34) + " " + (ax + side * 76) + " " + (ay + 14) +
        " C " + (ax + side * 70) + " " + (ay - 6) + " " + (ax + 30) + " " + (ay - 14) + " " + (ax - 30) + " " + (ay - 6) + " Z",
        fill: "#3A2A22", stroke: "#1A0F0A", "stroke-width": 5, "stroke-linejoin": "round" }),
    ]);
  }

  function coatTail(pal, sway) {
    var s = sway || 0;
    return h("g", {}, [
      h("path", { d: "M -176 780 L -196 " + (1050) + " C -120 " + (1064 + s) + " -40 1060 -8 1050 L -6 800 Z", fill: pal.jacket, stroke: pal.jacketLine, "stroke-width": 6, "stroke-linejoin": "round" }),
      h("path", { d: "M 176 780 L 196 " + (1050) + " C 120 " + (1064 - s) + " 40 1060 8 1050 L 6 800 Z", fill: pal.jacket, stroke: pal.jacketLine, "stroke-width": 6, "stroke-linejoin": "round" }),
      h("path", { d: "M -150 820 L -164 1040", stroke: pal.jacketShade, "stroke-width": 14, opacity: 0.7, "stroke-linecap": "round" }),
      h("path", { d: "M 150 820 L 164 1040", stroke: pal.jacketShade, "stroke-width": 14, opacity: 0.7, "stroke-linecap": "round" }),
      h("rect", { x: -150, y: 900, width: 80, height: 60, rx: 8, fill: "none", stroke: pal.jacketLine, "stroke-width": 4, opacity: 0.6 }),
    ]);
  }

  /* sledgehammer held in the right hand: the handle continues the forearm line */
  function hammerNode(pose) {
    var pts = P.armPoints(pose.right);
    var ex = -pts.e.x, ey = pts.e.y, wx = -pts.w.x, wy = pts.w.y;
    var L = Math.hypot(wx - ex, wy - ey) || 1, ux = (wx - ex) / L, uy = (wy - ey) / L;
    var ang = Math.atan2(uy, ux) * 180 / Math.PI;
    return h("g", { transform: "translate(" + (wx - ux * 10) + " " + (wy - uy * 10) + ") rotate(" + ang + ")" }, [
      h("rect", { x: 0, y: -11, width: 420, height: 22, rx: 10, fill: "#B07A45", stroke: "#4A2E16", "stroke-width": 5 }),
      h("rect", { x: 0, y: -11, width: 420, height: 7, rx: 4, fill: "#D9A56B", opacity: 0.7 }),
      h("rect", { x: 380, y: -70, width: 96, height: 140, rx: 12, fill: "#5F6B78", stroke: "#1E242B", "stroke-width": 6 }),
      h("rect", { x: 390, y: -60, width: 26, height: 120, rx: 6, fill: "#A9B6C3", opacity: 0.8 }),
    ]);
  }

  /* state: {pose, face, mouth, blink, t, walk (phase, radians; null = standing), hammer: bool,
   *         width, height (px of the svg), crop (0 = full body, else bottom crop y)} */
  function actorSVG(st, uid) {
    var props = {
      pose: st.pose, face: st.face, mouth: st.mouth, blink: st.blink, t: st.t, side: "center",
      outfit: "labcoat", look: P.LOOK, width: st.width, height: st.height,
      frame: { x: -500, y: 0, w: 1000, h: FEET + 120 },
    };
    var tree = P.figureTree(props);
    var pal = P.palette(P.LOOK, "labcoat");
    var body = tree.c[1];
    var inner = body.c[0];
    var walking = st.walk !== null && st.walk !== undefined;
    var ph = st.walk || 0;
    var swing = walking ? 16 * Math.sin(ph) : 0;
    var lift = walking ? 30 * Math.abs(Math.cos(ph)) : 0;
    var hop = walking ? -14 * Math.abs(Math.sin(ph)) : 0;
    inner.a.transform = (inner.a.transform || "") + " translate(0 " + hop + ")";
    var legs = h("g", {}, [legNode(pal, -1, -4 + swing, walking ? lift * (Math.sin(ph) > 0 ? 1 : 0) : 0), legNode(pal, 1, 4 - swing, walking ? lift * (Math.sin(ph) < 0 ? 1 : 0) : 0)]);
    inner.c.unshift(legs, coatTail(pal, swing));
    if (st.hammer) {
      var armsG = inner.c[inner.c.length - 1];
      armsG.c.splice(1, 0, hammerNode(st.pose));
    }
    // shadow on the ground
    tree.c.splice(1, 0, h("ellipse", { cx: 0, cy: FEET + 22, rx: 230, ry: 30, fill: "#000", opacity: 0.18 }));
    return P.serialize(tree, uid || "act");
  }

  P.FEET = FEET;
  P.actorSVG = actorSVG;
})(typeof globalThis !== "undefined" ? globalThis : window);
