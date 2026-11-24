/* hf-kit presenter, part 4/5: the drawing (port of templates/src/presenter/parts/*.tsx).
 *
 * Every part is a pure function returning a tiny virtual SVG tree: {tag, a: attrs, c: children}.
 * The tree's STRUCTURE never depends on the animated state (pose, face, mouth, blink, t): parts
 * that come and go are always present and toggled with display="none". So the figure is built
 * once and each frame only changes attributes (figure.js). Attribute names are SVG names;
 * "{uid}" in a value is replaced by the figure's unique id (clip paths, masks). */
(function (root) {
  "use strict";
  var P = (root.HFKitPresenter = root.HFKitPresenter || {});
  var RIG = P.RIG;

  function h(tag, a, c) { return { tag: tag, a: a || {}, c: c || [] }; }
  function show(on) { return on ? undefined : "none"; }

  // ---------- arms ----------

  var LINE = 3;
  var HLINE = 2.4; // line width inside a hand (scaled by HAND_SCALE)
  var HAND_SCALE = 1.3; // hands a little larger than life
  var HAND_SHAPES = ["relaxed", "open", "fist", "point"];

  /* Hands in local space: wrist at the origin, fingers towards +y. Mitten-like with a thumb. */
  function hand(shape, pal) {
    var skin = function (d, extra) {
      return h("path", Object.assign({ d: d, fill: pal.skin, stroke: pal.skinLine, "stroke-width": HLINE, "stroke-linejoin": "round" }, extra));
    };
    var skinRect = function (a) {
      return h("rect", Object.assign(a, { fill: pal.skin, stroke: pal.skinLine, "stroke-width": HLINE, "stroke-linejoin": "round" }));
    };
    var crease = function (d, opacity) {
      return h("path", { d: d, fill: "none", stroke: pal.skinDeep, "stroke-width": 2, "stroke-linecap": "round", opacity: opacity });
    };
    if (shape === "open") return [
      skin("M -14 10 C -26 14 -38 24 -42 36 C -45 44 -36 48 -30 42 C -24 36 -18 32 -10 30 Z"),
      skin("M -20 -2 C -24 14 -26 32 -24 48 C -22 64 -12 72 1 72 C 15 72 24 64 25 48 C 26 32 23 12 19 -2 Z"),
      crease("M -10 70 L -11 50 M 2 72 L 2 50 M 14 69 L 14 50"),
      crease("M -12 28 C -4 34 8 34 14 28", 0.6),
    ];
    if (shape === "fist") return [
      skinRect({ x: -24, y: 0, width: 48, height: 50, rx: 19 }),
      crease("M -12 48 L -12 34 M 0 50 L 0 34 M 12 48 L 12 34"),
      skin("M -24 18 C -18 12 4 14 12 22 C 16 27 10 32 4 30 C -6 28 -16 28 -22 30 Z"),
    ];
    if (shape === "point") return [
      skin("M -16 28 L -15 82 C -15 92 -1 92 -1 82 L 0 30 Z"),
      crease("M -12 76 C -9 78 -6 78 -4 76", 0.7),
      skinRect({ x: -22, y: 0, width: 46, height: 46, rx: 18 }),
      crease("M 4 44 L 4 32 M 15 42 L 15 32"),
      skin("M -22 16 C -16 10 2 12 8 20 C 12 25 6 30 0 28 C -8 26 -16 26 -20 28 Z"),
    ];
    return [ // relaxed: fingers loosely curled, thumb on top
      skin("M -19 -2 C -24 14 -24 34 -18 48 C -12 58 8 60 16 52 C 23 44 23 18 19 -2 Z"),
      crease("M -10 52 C -6 46 -6 40 -8 34 M 4 56 C 7 50 7 42 5 36", 0.75),
      skin("M 14 6 C 24 12 30 26 28 36 C 26 42 18 40 17 34 C 16 26 12 18 8 14 Z"),
    ];
  }

  /* Tapered limb: two circles (ra at a, rb at b) joined by their outer tangents. */
  function capsule(ax, ay, ra, bx, by, rb) {
    var d = Math.max(Math.hypot(bx - ax, by - ay), Math.abs(ra - rb) + 0.01);
    var t0 = Math.atan2(by - ay, bx - ax);
    var al = Math.acos((ra - rb) / d);
    var pt = function (cx, cy, r, a) { return (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2); };
    return "M " + pt(ax, ay, ra, t0 + al) + " L " + pt(bx, by, rb, t0 + al) + " " +
      "A " + rb + " " + rb + " 0 0 0 " + pt(bx, by, rb, t0 - al) + " L " + pt(ax, ay, ra, t0 - al) + " " +
      "A " + ra + " " + ra + " 0 1 0 " + pt(ax, ay, ra, t0 + al) + " Z";
  }

  function armShapes(pose) {
    var p = P.armPoints(pose);
    return {
      s: p.s, e: p.e, w: p.w,
      upper: capsule(p.s.x, p.s.y, RIG.shoulderWidth / 2, p.e.x, p.e.y, RIG.elbowWidth / 2),
      fore: capsule(p.e.x, p.e.y, RIG.elbowWidth / 2 - 1, p.w.x, p.w.y, RIG.wristWidth / 2),
    };
  }

  /* One arm (jacket sleeve, shirt cuff, hand). `mirror` draws the screen-right arm. */
  function armNode(pose, mirror, pal, part) {
    var sh = armShapes(pose);
    var s = sh.s, e = sh.e, w = sh.w;
    var len = Math.hypot(e.x - s.x, e.y - s.y) || 1;
    var ux = (e.x - s.x) / len, uy = (e.y - s.y) / len;
    var flen = Math.hypot(w.x - e.x, w.y - e.y) || 1;
    var fx = (w.x - e.x) / flen, fy = (w.y - e.y) / flen;
    var nx = -fy, ny = fx; // normal to the shaded side
    var handAngle = pose.elbow + pose.wrist;
    var cuffW = RIG.wristWidth - 4;
    return h("g", { "data-part": part, transform: mirror ? "scale(-1 1)" : undefined }, [
      // union outline: the two sleeve parts read as one bent arm
      h("g", { fill: pal.jacketLine, stroke: pal.jacketLine, "stroke-width": LINE * 2, "stroke-linejoin": "round" },
        [h("path", { d: sh.upper }), h("path", { d: sh.fore })]),
      h("g", { fill: pal.jacket }, [h("path", { d: sh.upper }), h("path", { d: sh.fore })]),
      // shaded undersides of upper arm and forearm
      h("path", {
        d: capsule(s.x + ux * 30 + uy * 24, s.y + uy * 30 - ux * 24, 11, e.x - ux * 2 + uy * 19, e.y - uy * 2 - ux * 19, 9),
        fill: pal.jacketShade, opacity: 0.85, display: show(len > 50),
      }),
      h("path", {
        d: capsule(e.x + fx * 24 + nx * 14, e.y + fy * 24 + ny * 14, 9, w.x - fx * 10 + nx * 12, w.y - fy * 10 + ny * 12, 7),
        fill: pal.jacketShade, opacity: 0.85, display: show(flen > 40),
      }),
      // elbow crease
      h("path", {
        d: "M " + (e.x + nx * 6 - fx * 4) + " " + (e.y + ny * 6 - fy * 4) + " q " + fx * 10 + " " + fy * 10 + " " + nx * 16 + " " + ny * 16,
        fill: "none", stroke: pal.jacketLine, "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0.55,
      }),
      // hand (all shapes present, one shown), then the shirt cuff over the wrist
      h("g", { transform: "translate(" + (w.x + fx * 8) + " " + (w.y + fy * 8) + ") rotate(" + handAngle + ") scale(" + HAND_SCALE + ")" },
        HAND_SHAPES.map(function (shape) {
          return h("g", { "data-hand": shape, display: show(pose.hand === shape) }, hand(shape, pal));
        })),
      h("g", { transform: "translate(" + w.x + " " + w.y + ") rotate(" + pose.elbow + ")" }, [
        h("rect", { x: -cuffW / 2, y: -4, width: cuffW, height: 14, rx: 5, fill: pal.shirt, stroke: pal.shirtLine, "stroke-width": 2.5 }),
        h("path", { d: "M " + (-RIG.wristWidth / 2 - 1) + " -4 L " + (RIG.wristWidth / 2 + 1) + " -4", stroke: pal.jacketLine, "stroke-width": LINE, "stroke-linecap": "round" }),
      ]),
    ]);
  }

  // ---------- face ----------

  var EYE_X = 35, EYE_Y = 226, EYE_RX = 13.5, EYE_RY = 13.5;
  /* Thick lime-green acetate glasses: rounded-rectangle lenses centred on the eyes. */
  var LENS_W = 58, LENS_H = 42, LENS_Y = EYE_Y + 1, LENS_R = 15;
  var RIM = 8, RIM_EDGE = 11.5;

  function eyeNode(pal, side, face, blink, gazeX, gazeY) {
    var cx = side * EYE_X;
    var open = face.eyeOpen * (1 - blink);
    var top = Math.max(0.6, EYE_RY * open);
    // lower lid rises with a smile and closes with the blink as well
    var bottom = Math.max(0.6, EYE_RY * (1 - face.squint * 0.6) * (0.25 + 0.75 * (1 - blink)));
    var d = "M " + (cx - EYE_RX) + " " + EYE_Y + " A " + EYE_RX + " " + top + " 0 0 1 " + (cx + EYE_RX) + " " + EYE_Y +
      " A " + EYE_RX + " " + bottom + " 0 0 1 " + (cx - EYE_RX) + " " + EYE_Y + " Z";
    var clip = "{uid}-eye" + side;
    var iris = 9.5 * (face.eyeOpen > 1.15 ? 0.84 : 1);
    var ix = cx + gazeX * 4.5;
    var iy = EYE_Y + gazeY * 4.5 + 1;
    var shut = blink > 0.82;
    return h("g", { "data-part": side < 0 ? "eye-left" : "eye-right" }, [
      h("defs", {}, [h("clipPath", { id: clip }, [h("path", { d: d })])]),
      h("g", { display: show(!shut) }, [
        h("path", { d: d, fill: pal.eyeWhite }),
        h("g", { "clip-path": "url(#" + clip + ")" }, [
          h("circle", { cx: ix, cy: iy, r: iris, fill: pal.eye }),
          h("circle", { cx: ix, cy: iy, r: iris * 0.5, fill: "#120A08" }),
          h("circle", { cx: ix - iris * 0.34, cy: iy - iris * 0.38, r: iris * 0.24, fill: "#FFFFFF" }),
          // upper-lid shadow on the eyeball
          h("ellipse", { cx: cx, cy: EYE_Y - top, rx: EYE_RX + 2, ry: 5, fill: pal.skinDeep, opacity: 0.35 }),
        ]),
      ]),
      // upper lid line with a small lash flick at the outer corner
      h("path", {
        d: "M " + (cx - EYE_RX - 1) + " " + (EYE_Y + 1) + " A " + (EYE_RX + 1) + " " + (top + 1) + " 0 0 1 " + (cx + EYE_RX + 1) + " " + (EYE_Y + 1),
        fill: "none", stroke: pal.hairLine, "stroke-width": shut ? 4.5 : 4, "stroke-linecap": "round",
      }),
      h("path", {
        d: "M " + (cx + side * (EYE_RX + 0.5)) + " " + (EYE_Y - (shut ? -1 : 2)) + " l " + side * 5 + " " + -4,
        stroke: pal.hairLine, "stroke-width": 3.5, "stroke-linecap": "round",
      }),
      // faint lower lid
      h("path", {
        d: "M " + (cx - EYE_RX + 3) + " " + (EYE_Y + bottom * 0.7) + " Q " + cx + " " + (EYE_Y + bottom + 3) + " " + (cx + EYE_RX - 3) + " " + (EYE_Y + bottom * 0.7),
        fill: "none", stroke: pal.skinDeep, "stroke-width": 2.2, "stroke-linecap": "round", opacity: 0.7, display: show(!shut),
      }),
    ]);
  }

  function browNode(pal, side, b) {
    var inner = { x: side * 14, y: 194 + b.raise + b.inner };
    var outer = { x: side * 56, y: 196 + b.raise };
    var mid = { x: side * 35, y: 188 + b.raise - b.arch };
    // tapered: thick at the inner end, thin at the outer end
    var d = "M " + inner.x + " " + (inner.y + 4) + " Q " + mid.x + " " + (mid.y + 4) + " " + outer.x + " " + (outer.y + 1.5) + " " +
      "Q " + (outer.x + side * 1.5) + " " + (outer.y - 1.5) + " " + (outer.x - side * 1) + " " + (outer.y - 2.5) + " " +
      "Q " + mid.x + " " + (mid.y - 5) + " " + inner.x + " " + (inner.y - 5) + " Q " + (inner.x - side * 4) + " " + inner.y + " " + inner.x + " " + (inner.y + 4) + " Z";
    return h("path", { "data-part": side < 0 ? "brow-left" : "brow-right", d: d, fill: pal.hair, stroke: pal.hairLine, "stroke-width": 2, "stroke-linejoin": "round" });
  }

  /* Mouth for loudness v (0-1), shaped by the expression. Three variants, one shown. */
  function mouthNode(pal, face, v) {
    var shape = P.mouthShape(v);
    var y0 = 283 - face.smile * 0.35;
    var closed = shape === "closed";
    var oh = closed && face.oh > 0.5;
    // closed line
    var cw = 21 * face.mouthWidth;
    var ly = y0 + face.smile * 0.8;
    // open (slight / open / wide)
    var k = shape === "slight" ? 0 : shape === "open" ? 1 : 2;
    var mh = [12, 19, 27][k] * (1 + face.oh * 0.25);
    var mw = [17, 21, 25][k] * (1 - face.oh * 0.3) * (0.9 + 0.1 * face.mouthWidth);
    var lift = face.smile * 0.45;
    var top = y0 - lift * 0.3;
    var d = "M " + (-mw + 2) + " " + top + " Q 2 " + (top + 4 - face.oh * 6) + " " + (mw + 2) + " " + top + " " +
      "C " + (mw + 1) + " " + (top + mh * 1.1) + " " + (-mw + 3) + " " + (top + mh * 1.1) + " " + (-mw + 2) + " " + top + " Z";
    var clip = "{uid}-mouth";
    return h("g", { "data-part": "mouth", transform: "translate(2 286) scale(1.22) translate(-2 -286)" }, [
      h("g", { "data-part": "mouth-oh", display: show(oh) }, [
        h("ellipse", { cx: 2, cy: 287, rx: 8, ry: 10, fill: pal.mouthIn, stroke: pal.lip, "stroke-width": 3 }),
        h("ellipse", { cx: 2, cy: 292, rx: 4.5, ry: 3.5, fill: pal.tongue }),
      ]),
      h("g", { "data-part": "mouth-closed", display: show(closed && !oh) }, [
        h("path", {
          d: "M " + (-cw + 2) + " " + y0 + " Q 2 " + (y0 + face.smile * 1.6 + 2) + " " + (cw + 2) + " " + (y0 - 1),
          fill: "none", stroke: pal.lip, "stroke-width": 5, "stroke-linecap": "round",
        }),
        // lower lip hint
        h("path", { d: "M -6 " + (ly + 10) + " Q 2 " + (ly + 13) + " 10 " + (ly + 10), fill: "none", stroke: pal.skinDeep, "stroke-width": 3, "stroke-linecap": "round", opacity: 0.6 }),
      ]),
      h("g", { "data-part": "mouth-open", display: show(!closed) }, [
        h("defs", {}, [h("clipPath", { id: clip }, [h("path", { d: d })])]),
        h("path", { d: d, fill: pal.mouthIn }),
        h("g", { "clip-path": "url(#" + clip + ")" }, [
          h("rect", { x: -mw, y: top - 6, width: mw * 2 + 4, height: 6 + Math.min(8, mh * 0.32), rx: 3, fill: pal.teeth }),
          h("ellipse", { cx: 2, cy: top + mh * 0.95, rx: mw * 0.62, ry: mh * 0.42, fill: pal.tongue }),
        ]),
        h("path", { d: d, fill: "none", stroke: pal.lip, "stroke-width": 3.5, "stroke-linejoin": "round" }),
      ]),
    ]);
  }

  /* Chunky lime frames (rim lime on a darker edge), clear lenses with a faint glint, a bridge and
   * temple arms to the ears. The eyes and brows stay clear. */
  function glassesNode(pal, on) {
    if (!on) return h("g", { "data-part": "glasses", display: "none" }, []);
    var hw = LENS_W / 2, hh = LENS_H / 2;
    var lens = function (cx, extra) {
      return h("rect", Object.assign({ x: cx - hw, y: LENS_Y - hh, width: LENS_W, height: LENS_H, rx: LENS_R }, extra));
    };
    var edge = pal.glassesEdge, lime = pal.glasses;
    var line = function (d, w, color, extra) {
      return h("path", Object.assign({ d: d, fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }, extra));
    };
    var kids = [];
    [-1, 1].forEach(function (sd) {
      var cx = sd * EYE_X;
      var arm = "M " + sd * (EYE_X + hw) + " " + (LENS_Y - 9) + " L " + sd * 90 + " " + (LENS_Y - 11);
      kids.push(h("g", { "data-part": sd < 0 ? "glasses-left" : "glasses-right" }, [
        lens(cx, { fill: "#DCEBFF", opacity: 0.1 }),
        line("M " + (cx - 20) + " " + (LENS_Y + 10) + " L " + (cx - 8) + " " + (LENS_Y - 12), 3, "#FFFFFF", { opacity: 0.22 }),
        line(arm, RIM_EDGE - 1.5, edge),
        line(arm, RIM - 1.5, lime),
        lens(cx, { fill: "none", stroke: edge, "stroke-width": RIM_EDGE }),
        lens(cx, { fill: "none", stroke: lime, "stroke-width": RIM }),
        // glint on the frame, top-left corner
        line("M " + (cx - hw + 1) + " " + (LENS_Y - 2) + " Q " + (cx - hw + 1) + " " + (LENS_Y - hh + 1) + " " + (cx - hw + 12) + " " + (LENS_Y - hh + 1),
          2.4, "#FFFFFF", { opacity: 0.6 }),
      ]));
    });
    var bridge = "M " + (-EYE_X + hw) + " " + (LENS_Y - 7) + " Q 0 " + (LENS_Y - 17) + " " + (EYE_X - hw) + " " + (LENS_Y - 7);
    kids.push(line(bridge, RIM_EDGE - 1, edge));
    kids.push(line(bridge, RIM - 1.5, lime));
    return h("g", { "data-part": "glasses", "data-glasses": "lime-thick", display: show(on) }, kids);
  }

  function faceNode(pal, face, mouth, blink, gazeX, gazeY, glasses) {
    return h("g", { "data-part": "face" }, [
      h("ellipse", { cx: -54, cy: 262, rx: 16, ry: 9, fill: pal.blush, opacity: face.blush }),
      h("ellipse", { cx: 56, cy: 262, rx: 15, ry: 9, fill: pal.blush, opacity: face.blush * 0.85 }),
      eyeNode(pal, -1, face, blink, gazeX, gazeY),
      eyeNode(pal, 1, face, blink, gazeX, gazeY),
      browNode(pal, -1, face.browL),
      browNode(pal, 1, face.browR),
      // nose: soft shadow on the side turned from the light
      h("g", { "data-part": "nose" }, [
        h("path", { d: "M 4 236 C 10 247 16 256 11 263 C 7 268 -3 268 -9 264", fill: "none", stroke: pal.skinDeep, "stroke-width": 4.5, "stroke-linecap": "round" }),
        h("ellipse", { cx: -2, cy: 258, rx: 5, ry: 3.5, fill: pal.skinLight, opacity: 0.6 }),
      ]),
      mouthNode(pal, face, mouth),
      glassesNode(pal, glasses),
    ]);
  }

  // ---------- hair ----------

  /* Dark back layer: depth and the scalloped silhouette of the short curly crop. */
  var BACK = [
    [-94, 166, 17], [-99, 140, 22], [-93, 112, 24], [-76, 90, 24], [-50, 76, 25], [-18, 70, 25], [16, 70, 25],
    [48, 75, 25], [75, 88, 24], [93, 110, 23], [99, 138, 21], [94, 164, 16],
  ];

  /* Front curls in groups that sway with their own phase; drawn back to front. */
  var CLUSTERS = [
    { pivot: [-62, 140], phase: 0, curls: [[-80, 112, 19], [-62, 94, 19], [-88, 138, 16], [-68, 120, 17], [-86, 160, 12]] },
    { pivot: [0, 124], phase: 1.7, curls: [[-38, 86, 19], [-6, 81, 20], [26, 82, 19], [54, 93, 18], [-24, 106, 18], [8, 103, 18], [38, 108, 17]] },
    { pivot: [60, 140], phase: 3.1, curls: [[74, 110, 18], [86, 134, 16], [64, 130, 15], [86, 158, 12]] },
    { pivot: [0, 132], phase: 4.4, curls: [[-62, 146, 14], [-42, 140, 15], [-20, 137, 15], [3, 136, 15], [26, 138, 15], [48, 142, 14], [66, 148, 12]] },
  ];

  function arc(cx, cy, r, a0, a1) {
    var p = function (a) { return [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]; };
    var p0 = p(a0), p1 = p(a1);
    return "M " + p0[0].toFixed(1) + " " + p0[1].toFixed(1) + " A " + r + " " + r + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + p1[0].toFixed(1) + " " + p1[1].toFixed(1);
  }

  function curlNodes(c, pal, i) {
    var x = c[0], y = c[1], r = c[2];
    var out = [
      h("circle", { cx: x, cy: y, r: r, fill: pal.hair, stroke: pal.hairLine, "stroke-width": 2.5 }),
      // shade on the lower right of every curl
      h("path", { d: arc(x, y, r - r * 0.18, 10, 120), fill: "none", stroke: pal.hairShade, "stroke-width": r * 0.26, "stroke-linecap": "round", opacity: 0.9 }),
    ];
    // highlight "C" on the upper left: this is what makes it read as curls
    if (r > 12) out.push(h("path", {
      d: arc(x - r * 0.05, y - r * 0.02, r * 0.52, 175 + (i % 3) * 12, 285 + (i % 2) * 18),
      fill: "none", stroke: pal.hairLight, "stroke-width": Math.max(2.5, r * 0.15), "stroke-linecap": "round",
    }));
    if (r > 24) out.push(h("circle", { cx: x + r * 0.08, cy: y + r * 0.06, r: r * 0.12, fill: pal.hairLight, opacity: 0.7 }));
    return [h("g", {}, out)];
  }

  function hairBackNode(pal, sway) {
    return h("g", { "data-part": "hair-back", transform: "rotate(" + sway(0.8) * 0.5 + " 0 140)" },
      [h("ellipse", { cx: 0, cy: 130, rx: 92, ry: 60, fill: pal.hairShade })].concat(BACK.map(function (b) {
        return h("circle", { cx: b[0], cy: b[1], r: b[2], fill: pal.hairShade, stroke: pal.hairLine, "stroke-width": 2.5 });
      })));
  }

  /* Solid hair mass behind the front curls (crown down to the fringe centre line), so no skin
   * shows between the fringe curls and the main curls. Its lower edge stays inside the fringe curls. */
  var HAIR_BASE = "M -82 98 C -60 84 60 84 82 98 L 76 124 L 70 138 L -64 138 L -76 124 Z";

  function hairFrontNode(pal, sway) {
    var kids = [h("path", { "data-part": "hair-base", d: HAIR_BASE, fill: pal.hair })].concat([-1, 1].map(function (s) {
      return h("path", {
        d: "M " + s * 88 + " 156 L " + s * 74 + " 156 L " + s * 77 + " 196 C " + s * 80 + " 200 " + s * 85 + " 200 " + s * 87 + " 194 Z",
        fill: pal.hair, stroke: pal.hairLine, "stroke-width": 2, "stroke-linejoin": "round",
      });
    }));
    CLUSTERS.forEach(function (cl, ci) {
      var curls = [];
      cl.curls.forEach(function (c, i) { curls = curls.concat(curlNodes(c, pal, i + ci)); });
      kids.push(h("g", { transform: "rotate(" + sway(cl.phase) + " " + cl.pivot[0] + " " + cl.pivot[1] + ")" }, curls));
    });
    return h("g", { "data-part": "hair-front" }, kids);
  }

  // ---------- head ----------

  /* Face silhouette: wide cheekbones, softly tapering jaw, rounded chin. */
  var FACE_PATH =
    "M 0 116 C 54 116 86 150 86 204 C 86 250 70 286 40 304 C 26 313 -26 313 -40 304 C -70 286 -86 250 -86 204 " +
    "C -86 150 -54 116 0 116 Z";

  function earNode(pal, side) {
    return h("g", { transform: "translate(" + side * 84 + " 226) scale(" + side + " 1)" }, [
      h("ellipse", { cx: 4, cy: 0, rx: 16, ry: 24, fill: pal.skin, stroke: pal.skinLine, "stroke-width": 3 }),
      h("path", { d: "M 8 -12 C 16 -8 16 10 8 14", fill: "none", stroke: pal.skinDeep, "stroke-width": 4, "stroke-linecap": "round" }),
    ]);
  }

  /* Ears and the face skin with its soft shading (features come from faceNode). */
  function headNode(pal) {
    var clip = "{uid}-face";
    return h("g", { "data-part": "head" }, [
      earNode(pal, -1),
      earNode(pal, 1),
      h("defs", {}, [h("clipPath", { id: clip }, [h("path", { d: FACE_PATH })])]),
      h("path", { d: FACE_PATH, fill: pal.skin }),
      h("g", { "clip-path": "url(#" + clip + ")" }, [
        // 3/4 feel: the right cheek and jaw turn away from the light
        h("path", { d: "M 86 150 C 70 190 64 240 50 274 C 40 296 20 308 0 312 L 90 330 L 100 150 Z", fill: pal.skinShade, opacity: 0.85 }),
        h("ellipse", { cx: 0, cy: 318, rx: 70, ry: 16, fill: pal.skinShade, opacity: 0.45 }),
        // shadow of the curls on the forehead
        h("ellipse", { cx: 0, cy: 150, rx: 96, ry: 24, fill: pal.skinShade }),
        // cheekbone highlight
        h("ellipse", { cx: -50, cy: 236, rx: 18, ry: 12, fill: pal.skinLight, opacity: 0.55 }),
      ]),
      h("path", { d: FACE_PATH, fill: "none", stroke: pal.skinLine, "stroke-width": 3 }),
    ]);
  }

  // ---------- torso ----------

  var TORSO_OUTLINE =
    "M -44 344 C -84 350 -128 356 -158 370 C -182 382 -192 402 -192 430 C -190 500 -180 580 -170 650 L -172 840 " +
    "L 172 840 L 170 650 C 180 580 190 500 192 430 C 192 402 182 382 158 370 C 128 356 84 350 44 344";
  var TORSO_PATH = TORSO_OUTLINE + " C 24 372 -24 372 -44 344 Z";

  /* Per outfit: how deep the jacket opening goes, lapel width and button rows. */
  var CUT = {
    blazer: { v: 592, lapel: 96, notchY: 424, buttons: [640, 742] },
    labcoat: { v: 640, lapel: 112, notchY: 436, buttons: [684, 790] },
  };

  function collarBackNode(pal) {
    return h("path", { "data-part": "collar", d: "M -48 356 C -48 318 48 318 48 356 Z", fill: pal.shirtShade, stroke: pal.shirtLine, "stroke-width": 3, "stroke-linejoin": "round" });
  }

  function lapelPath(v, w, notchY) {
    return "M -42 344 L -1 " + v + " C -26 " + (v - 50) + " -" + w * 0.72 + " " + (notchY + 70) + " -" + w + " " + (notchY + 6) + " " +
      "L -" + (w - 18) + " " + (notchY - 8) + " L -" + (w - 6) + " " + (notchY - 24) + " C -" + (w - 22) + " " + (notchY - 52) + " -70 362 -56 344 Z";
  }

  /* Jacket (navy blazer or lab coat) over a collared shirt, no tie. */
  function torsoNode(pal) {
    var clip = "{uid}-torso";
    var cut = CUT[pal.outfit];
    var lab = pal.outfit === "labcoat";
    var lapel = lapelPath(cut.v, cut.lapel, cut.notchY);
    var line = function (a) { return Object.assign({ stroke: pal.jacketLine, "stroke-width": 3, "stroke-linejoin": "round" }, a); };
    var kids = [
      h("defs", {}, [h("clipPath", { id: clip }, [h("path", { d: TORSO_PATH })])]),
      h("path", { d: TORSO_PATH, fill: pal.jacket }),
      h("g", { "clip-path": "url(#" + clip + ")" }, [
        // rim light along the silhouette: separates him from a dark background
        h("path", { d: TORSO_PATH, fill: "none", stroke: pal.rim, "stroke-width": 14, opacity: lab ? 0.25 : 0.4 }),
        // light from the upper left: the right side of the body is in shade
        h("path", { d: "M 104 360 C 156 370 178 398 176 432 C 172 500 162 570 152 640 L 156 840 L 110 840 C 120 700 124 560 120 450 C 118 410 112 380 104 360 Z", fill: pal.jacketShade }),
        h("path", { d: "M -176 420 C -156 396 -130 384 -104 382 C -132 402 -152 440 -162 490 Z", fill: pal.jacketLight, opacity: 0.7 }),
        // shirt in the opening, soft shadow under the collar
        h("path", { d: "M -46 340 L 0 " + (cut.v + 8) + " L 46 340 Z", fill: pal.shirt }),
        h("path", { d: "M -30 360 L 0 " + (cut.v + 8) + " L 30 360 Z", fill: pal.shirtShade, opacity: 0.35 }),
        // shirt placket and buttons
        h("path", { d: "M 3 420 L 3 " + cut.v, stroke: pal.shirtShade, "stroke-width": 3 }),
      ].concat([452, 520].filter(function (y) { return y < cut.v - 20; }).map(function (y) {
        return h("circle", { cx: 3, cy: y, r: 4.5, fill: pal.shirtShade, stroke: pal.shirtLine, "stroke-width": 1.2 });
      })).concat([
        // front edge of the jacket below the top button
        h("path", { d: "M 0 " + cut.v + " C 4 " + (cut.v + 80) + " 4 " + (cut.v + 160) + " 2 860", fill: "none", stroke: pal.jacketLine, "stroke-width": 3 }),
        h("path", { d: "M -10 " + (cut.v + 10) + " C -6 " + (cut.v + 80) + " -6 " + (cut.v + 160) + " -8 860", fill: "none", stroke: pal.jacketShade, "stroke-width": 6, opacity: 0.6 }),
        // soft folds at the arm pits
        h("path", { d: "M -150 520 C -140 560 -138 600 -142 650", fill: "none", stroke: pal.jacketShade, "stroke-width": 6, "stroke-linecap": "round" }),
        h("path", { d: "M 150 520 C 140 560 138 600 142 650", fill: "none", stroke: pal.jacketLine, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.4 }),
      ])),
      h("path", line({ d: TORSO_OUTLINE, fill: "none", "stroke-width": 3.5 })),
      // open neck (skin V) and the shirt collar points
      h("path", { d: "M -24 350 L 0 410 L 24 350 Z", fill: pal.skin }),
      h("path", { d: "M -24 350 L 0 410 L 24 350 C 10 362 -10 362 -24 350 Z", fill: pal.skinShade, opacity: 0.6 }),
    ];
    [-1, 1].forEach(function (sd) {
      kids.push(h("path", {
        d: "M " + sd * 46 + " 330 C " + sd * 38 + " 360 " + sd * 22 + " 392 " + sd * 2 + " 414 L " + sd * 36 + " 424 C " + sd * 48 + " 400 " + sd * 60 + " 376 " + sd * 66 + " 352 C " + sd * 60 + " 342 " + sd * 54 + " 334 " + sd * 46 + " 330 Z",
        fill: pal.shirt, stroke: pal.shirtLine, "stroke-width": 2.5, "stroke-linejoin": "round",
      }));
    });
    kids.push(
      // lapels: lit facing on the left one; shadow under the right one
      h("path", line({ d: lapel, transform: "scale(-1 1)", fill: pal.jacketShade })),
      h("path", line({ d: lapel, fill: pal.jacket })),
      h("path", { d: "M -40 352 L -4 " + (cut.v - 14), stroke: pal.jacketLight, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.8 }),
      h("path", { d: "M " + (-cut.lapel + 8) + " " + (cut.notchY + 10) + " C -" + cut.lapel * 0.62 + " " + (cut.notchY + 70) + " -30 " + (cut.v - 60) + " -8 " + (cut.v - 6), fill: "none", stroke: pal.jacketShade, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.7 })
    );
    // chest pocket: blazer welt; lab coat patch pocket with a pen
    if (lab) {
      kids.push(h("g", {}, [
        h("rect", { x: 92, y: 470, width: 9, height: 44, rx: 3, fill: pal.pen, stroke: pal.jacketLine, "stroke-width": 2 }),
        h("rect", { x: 91, y: 466, width: 11, height: 10, rx: 3, fill: pal.shirt }),
        h("path", line({ d: "M 72 488 L 146 486 L 144 552 C 144 558 140 562 134 562 L 84 562 C 78 562 74 558 74 552 Z", fill: pal.jacket, "stroke-width": 2.5 })),
        h("path", { d: "M 72 488 L 146 486 L 146 498 L 73 500 Z", fill: pal.jacketShade, opacity: 0.8 }),
      ]));
    } else {
      kids.push(h("path", { d: "M 74 484 L 134 478", stroke: pal.jacketLine, "stroke-width": 5, "stroke-linecap": "round" }));
    }
    cut.buttons.forEach(function (y) {
      kids.push(h("g", {}, [
        h("circle", { cx: 7, cy: y, r: 8, fill: pal.button, stroke: pal.jacketLine, "stroke-width": 2 }),
        h("circle", { cx: 5, cy: y - 2, r: 2.5, fill: pal.jacketLight, opacity: 0.6 }),
      ]));
    });
    return h("g", { "data-part": "torso" }, kids);
  }

  /* Neck with the shadow under the jaw. */
  function neckNode(pal) {
    var clip = "{uid}-neck";
    var d = "M -35 262 L -37 356 C -22 370 22 370 37 356 L 35 262 Z";
    return h("g", { "data-part": "neck" }, [
      h("defs", {}, [h("clipPath", { id: clip }, [h("path", { d: d })])]),
      h("path", { d: d, fill: pal.skin }),
      h("g", { "clip-path": "url(#" + clip + ")" }, [
        h("ellipse", { cx: 0, cy: 298, rx: 44, ry: 36, fill: pal.skinShade }),
        h("rect", { x: 16, y: 260, width: 30, height: 110, fill: pal.skinShade, opacity: 0.6 }),
      ]),
      h("path", { d: d, fill: "none", stroke: pal.skinLine, "stroke-width": 3, "stroke-linejoin": "round" }),
    ]);
  }

  P.h = h;
  P.capsule = capsule;
  P.armShapes = armShapes;
  P.TORSO_OUTLINE = TORSO_OUTLINE; // the body silhouette, reused by the full-body actor's outfits
  P.TORSO_PATH = TORSO_PATH;
  P.parts = {
    arm: armNode, face: faceNode, hairBack: hairBackNode, hairFront: hairFrontNode,
    head: headNode, torso: torsoNode, collarBack: collarBackNode, neck: neckNode,
  };
  if (root.HFKit) root.HFKit.presenter = P;
})(typeof globalThis !== "undefined" ? globalThis : window);
