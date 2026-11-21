/* Prop "volcano": a cut-away stratovolcano. Magma churns in a chamber under the cone, pressure
 * builds (the chamber swells, cracks glow), magma climbs the vent, bursts out of the crater as a
 * lava fountain with an ash plume, lava flows down both flanks and cools, and the cone grows by a
 * new layer. Ported from the HyperFrames spike; every moment is driven by phase times taken from
 * the narration's cues, never by fixed seconds.
 *
 * Phases (seconds, from shots.json cues {show: "phase", target: <name>} via HFKit.mountHero, or
 * params.phases): pressure, rise, burst, flow, grow. Missing ones are derived: rise = burst - 3,
 * pressure = rise - 1.5, flow = burst + 0.4; with no burst the volcano only steams (and the
 * magma, if a rise is cued, climbs and waits under the crater); grow happens only when cued.
 *
 * Contract (hf-kit/props/README.md): HFKit.props.volcano = {meta, mount(root, {params, style})
 * -> {update(t, cueState), anchors}}; anchors in world px (1920 x 1080 world; "magma-tip" is a
 * function of t). Pure function of t: seekable. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw) throw new Error("volcano/prop.js: load the kit scripts first");
  var D = K.draw, clamp = D.clamp, prog = D.prog, lerp = D.lerp, E = D.ease, r2 = D.r2;
  K.props = K.props || {};

  var PHASES = { pressure: "chamber swells and cracks glow", rise: "magma starts up the vent", burst: "eruption at the crater",
    flow: "lava runs down the flanks", grow: "the cone grows by a new layer" };

  var meta = {
    name: "volcano",
    description: "Cut-away volcano: magma chamber, vent, eruption with ash and lava bombs, lava flows, cone growth.",
    world: { width: 1920, height: 1080 },
    frame: { x: 180, y: 120, width: 1080, height: 830 }, // cone + chamber: what "wide" shows
    anchors: ["chamber", "vent", "crater", "magma-tip", "lava"],
    phases: PHASES,
    params: {
      phases: "{pressure, rise, burst, flow, grow} seconds; usually from phase cues",
      sky: "\"dusk\" (default) | \"day\"",
      intensity: "0.5..1.5 eruption size (default 1)",
      seed: "integer for the particle pattern (default 7)",
    },
  };

  /* Full phase times from partial ones (see header). */
  function phases(p) {
    p = p || {};
    var burst = num(p.burst, Infinity);
    var rise = num(p.rise, isFinite(burst) ? burst - 3 : Infinity);
    var pressure = num(p.pressure, isFinite(rise) ? Math.max(0, rise - 1.5) : Infinity);
    var flow = num(p.flow, burst + 0.4);
    var grow = num(p.grow, Infinity);
    return { pressure: pressure, rise: rise, burst: burst, flow: flow, grow: grow };
  }
  function num(v, d) { return typeof v === "number" && isFinite(v) ? v : d; }

  // ---- geometry (world px) ----------------------------------------------------------------
  var GROUND = 604;
  var CRATER = { x: 720, y: 296 };
  var CHAMBER = { x: 720, y: 860, rx: 230, ry: 90 }; // drawn at y 930, raised by DEEP
  var DEEP = -70;
  var VENT = D.path([[[720, 782], [704, 736], [745, 690], [722, 620]], [[722, 620], [699, 540], [705, 420], [720, 310]]]);
  var FLOW_L = D.path([[[688, 304], [640, 380], [560, 470], [470, 540]], [[470, 540], [400, 594], [370, 598], [318, 604]]]);
  var FLOW_R = D.path([[[754, 304], [800, 384], [900, 480], [980, 540]], [[980, 540], [1050, 592], [1090, 598], [1130, 604]]]);
  var CONE = "M290 604 C 440 566, 586 440, 652 296 L 690 304 Q 720 316 750 304 L 788 296 C 856 440, 1000 566, 1150 604 Z";
  var CONE_NEW = "M262 604 C 420 556, 572 420, 640 274 L 690 286 Q 720 298 750 286 L 800 274 C 868 420, 1020 556, 1178 604 Z";
  var CUT = "M676 306 L764 306 L905 604 L535 604 Z";

  function riseAt(ph, t) {
    var end = isFinite(ph.burst) ? ph.burst : ph.rise + 3.5;
    return E.inQuad(prog(t, ph.rise + 0.2, end));
  }

  function anchorsFor(params) {
    var ph = phases(params && params.phases);
    return {
      chamber: { x: CHAMBER.x, y: CHAMBER.y },
      vent: { x: 714, y: 640 },
      crater: { x: CRATER.x, y: CRATER.y },
      lava: { x: 930, y: 498 },
      "magma-tip": function (t) {
        var u = riseAt(ph, t);
        var q = VENT.at(Math.max(0.0001, u));
        return { x: q.x, y: q.y };
      },
    };
  }

  function mount(rootEl, opts) {
    opts = opts || {};
    var params = opts.params || {};
    var ph = phases(params.phases);
    var seed = params.seed === undefined ? 7 : params.seed | 0;
    var power = clamp(params.intensity === undefined ? 1 : params.intensity, 0.5, 1.5);
    var day = params.sky === "day";
    var R = D.rng(seed);
    var id = D.uid("volcano");
    rootEl.innerHTML = "";
    var s = D.svgRoot(rootEl, meta.world.width, meta.world.height, { style: "position:absolute;left:0;top:0;overflow:visible" });
    var svg = s.svg, defs = s.defs;
    function el(parent, tag, a) { return D.el(parent, tag, a); }

    // ---- paints ----
    var sky = D.linearGradient(defs, id + "sky", day
      ? [[0, "#38BDF8"], [0.6, "#93C5FD"], [1, "#FDE68A"]]
      : [[0, "#0F1A3A"], [0.5, "#3B2A5C"], [0.85, "#9A4F6A"], [1, "#F2A65A"]]);
    var magma = D.linearGradient(defs, id + "mg", [[0, "#FFE08A"], [0.35, "#FF8C1A"], [1, "#D1361B"]]);
    var chamberG = D.radialGradient(defs, id + "ch", [[0, "#FFF1B8"], [0.3, "#FFB23F"], [0.7, "#F2601A"], [1, "#A3261B"]], { cx: 0.45, cy: 0.4, r: 0.62 });
    var glowG = D.radialGradient(defs, id + "gl", [[0, "#FF9A3C", 0.85], [1, "#FF9A3C", 0]]);
    var puffG = D.radialGradient(defs, id + "pf", [[0, "#9C9098"], [0.65, "#6B5F68"], [1, "#4E444C", 0]], { cx: 0.42, cy: 0.38, r: 0.6 });
    var steamG = D.radialGradient(defs, id + "st", [[0, "#F3E9E4", 0.6], [1, "#F3E9E4", 0]]);
    var flankL = D.linearGradient(defs, id + "fl", [[0, "#A06A4C"], [1, "#7A4E3A"]], [0, 0, 1, 1]);
    var flankR = D.linearGradient(defs, id + "fr", [[0, "#6A4232"], [1, "#4E3026"]], [0, 0, 1, 1]);
    var cutG = D.linearGradient(defs, id + "cutg", [[0, "#5A3A2C"], [1, "#3E271E"]]);
    var soft = D.blurFilter(defs, id + "s14", 14);
    var soft5 = D.blurFilter(defs, id + "s5", 5);
    var soft30 = D.blurFilter(defs, id + "s30", 30);
    var chamberClip = el(defs, "clipPath", { id: id + "cc" });
    var blob = "M490 930 C 490 870, 600 836, 720 838 C 850 840, 952 872, 950 930 C 948 990, 850 1022, 720 1020 C 590 1018, 490 990, 490 930 Z";
    el(chamberClip, "path", { d: blob });
    var cutClip = el(defs, "clipPath", { id: id + "cut" });
    el(cutClip, "path", { d: CUT });

    var shakeG = el(svg, "g", {});
    // ---- sky and distance ----
    el(shakeG, "rect", { x: -2400, y: -2400, width: 6720, height: 2400 + GROUND, fill: sky });
    var stars = [];
    if (!day) for (var i = 0; i < 46; i++) stars.push({ el: el(shakeG, "circle", { cx: r2(-600 + R() * 3100), cy: r2(-400 + R() * 640), r: r2(1.2 + R() * 2.2), fill: "#FFF8EF" }), ph: R() * 6.28 });
    var sun = el(shakeG, "circle", { cx: 1540, cy: 420, r: day ? 80 : 96, fill: day ? "#FFF3C4" : "#FFD9A0", opacity: day ? 0.95 : 0.6 });
    el(shakeG, "circle", { cx: 1540, cy: 420, r: 220, fill: day ? "#FFF3C4" : "#FFB86B", opacity: 0.18, filter: soft30 });
    var far = el(shakeG, "g", {});
    el(far, "path", { d: "M-900 604 L-500 470 L-200 540 L60 430 L330 560 L1180 560 L1380 448 L1580 520 L1790 400 L2060 520 L2400 470 L2900 604 Z", fill: day ? "#7C8FB5" : "#5B4470", opacity: 0.8 });
    el(far, "path", { d: "M-900 604 L-300 520 L100 575 L1240 580 L1500 500 L1720 560 L2100 530 L2900 604 Z", fill: day ? "#8AA07A" : "#7A5470", opacity: 0.9 });
    var clouds = [];
    for (var c = 0; c < 5; c++) {
      var cg = el(shakeG, "g", { opacity: day ? 0.85 : 0.4 });
      var cx = -300 + c * 560 + R() * 200, cy = 120 + R() * 200, w = 140 + R() * 120;
      el(cg, "ellipse", { cx: cx, cy: cy, rx: w, ry: w * 0.22, fill: day ? "#FFFFFF" : "#F6D7C0" });
      el(cg, "ellipse", { cx: cx - w * 0.3, cy: cy - w * 0.12, rx: w * 0.45, ry: w * 0.2, fill: day ? "#FFFFFF" : "#F6D7C0" });
      clouds.push({ g: cg, speed: 5 + R() * 6 });
    }

    // ---- ground cross-section ----
    el(shakeG, "path", { d: "M-2400 " + GROUND + " L4400 " + GROUND + " L4400 3000 L-2400 3000 Z", fill: "#8E6142" });
    el(shakeG, "path", { d: "M-2400 690 C -800 676, 200 704, 760 690 S 1800 680, 4400 694 L4400 3000 L-2400 3000 Z", fill: "#7A5136" });
    el(shakeG, "path", { d: "M-2400 790 C -600 776, 500 806, 820 792 S 1900 780, 4400 796 L4400 3000 L-2400 3000 Z", fill: "#5F3C29" });
    el(shakeG, "path", { d: "M-2400 1060 C -400 1046, 600 1076, 900 1062 S 2000 1050, 4400 1066 L4400 3000 L-2400 3000 Z", fill: "#4A2E20" });
    el(shakeG, "path", { d: "M-2400 " + GROUND + " L4400 " + GROUND, stroke: day ? "#6E8F4E" : "#5A4636", "stroke-width": 10 });
    var pebbles = el(shakeG, "g", { fill: "#3E261A", opacity: 0.45 });
    for (var pb = 0; pb < 26; pb++) el(pebbles, "ellipse", { cx: r2(-200 + R() * 2300), cy: r2(640 + R() * 520), rx: r2(10 + R() * 22), ry: r2(5 + R() * 8) });

    // ---- cracks and chamber ----
    var deep = el(shakeG, "g", { transform: "translate(0 " + DEEP + ")" });
    var cracks = ["M528 912 L478 890 L448 902 L404 876 L370 884", "M915 912 L968 890 L996 902 L1046 876 L1086 886", "M610 852 L594 812 L606 784 L596 750",
      "M836 852 L856 816 L846 786 L860 752"].map(function (d) {
      var p = el(deep, "path", { d: d, fill: "none", stroke: "#FFB347", "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" });
      return { el: p, len: p.getTotalLength ? p.getTotalLength() : 200 };
    });
    var chGlow = el(deep, "ellipse", { cx: CHAMBER.x, cy: 930, rx: 360, ry: 170, fill: glowG });
    var chamber = el(deep, "g", {});
    el(chamber, "path", { d: blob, fill: "#3A2117", transform: "translate(0 4) scale(1.02)", "transform-origin": "720 930" });
    el(chamber, "path", { d: blob, fill: chamberG });
    var bubbleG = el(chamber, "g", { "clip-path": "url(#" + id + "cc)", fill: "#FFE7A3" });
    var bubbles = [];
    for (var b = 0; b < 20; b++) bubbles.push({ x: 520 + R() * 400, r: 5 + R() * 11, period: 1.6 + R() * 1.8, phase: R(), el: el(bubbleG, "circle", { r: 0, opacity: 0.8 }) });
    el(chamber, "path", { d: "M560 880 C 620 856, 720 850, 800 858", fill: "none", stroke: "#FFF6D0", "stroke-width": 8, "stroke-linecap": "round", opacity: 0.55 });

    // ---- the cone ----
    var coneG = el(shakeG, "g", {});
    var coneNew = el(coneG, "path", { d: CONE_NEW, fill: "#4A3030", opacity: 0 });
    var coneNewEdge = el(coneG, "path", { d: CONE_NEW, fill: "none", stroke: "#2E1C18", "stroke-width": 5, opacity: 0 });
    el(coneG, "path", { d: CONE, fill: flankL });
    el(coneG, "path", { d: "M720 306 C 780 430, 860 540, 930 604 L 1150 604 C 1000 566, 856 440, 788 296 L 750 304 Z", fill: flankR, opacity: 0.85 });
    // cut-away face with layered ash and lava beds
    el(coneG, "path", { d: CUT, fill: cutG });
    var beds = el(coneG, "g", { "clip-path": "url(#" + id + "cut)", fill: "none", "stroke-width": 12 });
    for (var k = 0; k < 9; k++) {
      var y = 340 + k * 34;
      el(beds, "path", { d: "M520 " + (y + 150) + " L720 " + y + " L920 " + (y + 150), stroke: k % 2 ? "#6B4636" : "#4D3127", opacity: 0.9 });
    }
    el(coneG, "path", { d: CUT, fill: "none", stroke: "#2A1812", "stroke-width": 4, opacity: 0.6 });
    el(coneG, "path", { d: CONE, fill: "none", stroke: "#3E2620", "stroke-width": 6, "stroke-linejoin": "round" });
    el(coneG, "path", { d: "M300 602 C 448 566, 590 440, 654 300", fill: "none", stroke: "#C08860", "stroke-width": 5, opacity: 0.5, "stroke-linecap": "round" });
    el(coneG, "path", { d: "M400 572 Q 450 556 500 562 M 1000 548 Q 1040 560 1080 566 M 590 452 Q 615 440 640 446", stroke: "#5E3A2C", "stroke-width": 5, fill: "none", "stroke-linecap": "round" });

    // ---- the vent ----
    var ventLen = VENT.length;
    el(shakeG, "path", { d: VENT.d, fill: "none", stroke: "#24140F", "stroke-width": 56, "stroke-linecap": "butt" });
    var ventGlow = el(shakeG, "path", { d: VENT.d, fill: "none", stroke: "#FF8C1A", "stroke-width": 60, "stroke-linecap": "round", filter: soft, opacity: 0 });
    var ventMagma = el(shakeG, "path", { d: VENT.d, fill: "none", stroke: magma, "stroke-width": 32, "stroke-linecap": "butt" });
    var tip = el(shakeG, "circle", { r: 20, fill: "#FFE08A", opacity: 0 });
    var tipGlow = el(shakeG, "circle", { r: 44, fill: "#FFB347", opacity: 0, filter: soft });

    // ---- lava flows ----
    var flows = [FLOW_L, FLOW_R].map(function (f) {
      return {
        f: f,
        glow: el(shakeG, "path", { d: f.d, fill: "none", stroke: "#FF8C1A", "stroke-width": 46, "stroke-linecap": "round", filter: soft5, opacity: 0.7 }),
        hot: el(shakeG, "path", { d: f.d, fill: "none", stroke: "#FF9F1C", "stroke-width": 28, "stroke-linecap": "round" }),
        core: el(shakeG, "path", { d: f.d, fill: "none", stroke: "#FFE08A", "stroke-width": 9, "stroke-linecap": "round" }),
        cool: el(shakeG, "path", { d: f.d, fill: "none", stroke: "#4A2A22", "stroke-width": 28, "stroke-linecap": "round", opacity: 0 }),
      };
    });

    // ---- crater: steam, plume, glow, bombs ----
    var steamLayer = el(shakeG, "g", {});
    var steamSys = D.presets.smoke(seed + 1, 9);
    var steam = steamSys.list.map(function () { return { el: el(steamLayer, "ellipse", { fill: steamG, rx: 0, ry: 0 }) }; });
    var plumeLayer = el(shakeG, "g", {});
    var nPuffs = Math.round(34 * power);
    var puffs = [];
    for (var q = 0; q < nPuffs; q++) puffs.push({ t0: q * 0.13 + R() * 0.08, vx: (R() - 0.35) * 90, vy: 220 + R() * 140, r0: 60 + R() * 40, el: el(plumeLayer, "circle", { fill: puffG, r: 0 }) });
    var craterGlow = el(shakeG, "ellipse", { cx: CRATER.x, cy: CRATER.y - 6, rx: 170, ry: 76, fill: glowG, opacity: 0 });
    var bombLayer = el(shakeG, "g", {});
    var nBombs = Math.round(150 * power);
    var bombs = [];
    for (var m = 0; m < nBombs; m++) {
      var burst = m < nBombs * 0.3;
      bombs.push({ t0: burst ? R() * 0.35 : 0.35 + R() * 3.6, vx: (R() - 0.5) * (burst ? 760 : 480), vy: ((burst ? 1000 : 700) + R() * 420) * (0.85 + 0.15 * power), r: 7 + R() * 13,
        el: el(bombLayer, "circle", { r: 0, cx: CRATER.x, cy: CRATER.y }) });
    }
    var heat = el(shakeG, "ellipse", { cx: CRATER.x, cy: 380, rx: 900, ry: 600, fill: glowG, opacity: 0, filter: soft30 });

    var anchors = anchorsFor(params);

    function update(t) {
      // tremor before the burst, kick on it
      var trem = isFinite(ph.burst) ? prog(t, ph.burst - 1.4, ph.burst) * 4 : 0;
      var kick = t >= ph.burst ? 18 * power * Math.exp(-(t - ph.burst) * 3.2) : 0;
      var amp = trem + kick;
      shakeG.setAttribute("transform", "translate(" + r2(amp * Math.sin(t * 61) + amp * 0.5 * Math.sin(t * 97)) + " " + r2(amp * Math.cos(t * 53)) + ")");
      stars.forEach(function (st) { st.el.setAttribute("opacity", r2(0.35 + 0.35 * Math.sin(t * 1.7 + st.ph))); });
      clouds.forEach(function (cl) { cl.g.setAttribute("transform", "translate(" + r2(t * cl.speed) + " 0)"); });

      // chamber: breathes, swells under pressure, bubbles churn faster
      var press = prog(t, ph.pressure, ph.pressure + 1.5);
      var relief = prog(t, ph.burst, ph.burst + 1.2);
      var swell = 1 + 0.06 * E.inOut(press) * (1 - 0.6 * relief) + 0.012 * Math.sin(t * 3.1);
      chamber.setAttribute("transform", "translate(720 930) scale(" + Math.round(swell * 10000) / 10000 + ") translate(-720 -930)");
      chGlow.setAttribute("opacity", r2(0.45 + 0.5 * press * (1 - 0.5 * relief) + 0.1 * Math.sin(t * 2.3)));
      var boil = 1 + 1.6 * press;
      bubbles.forEach(function (bb) {
        var u = ((t * boil) / bb.period + bb.phase) % 1;
        bb.el.setAttribute("cx", r2(bb.x + 10 * Math.sin(u * 6.28 + bb.phase * 6)));
        bb.el.setAttribute("cy", r2(1010 - u * 160));
        bb.el.setAttribute("r", r2(bb.r * Math.sin(u * Math.PI)));
      });
      var cr = E.inOut(prog(t, ph.pressure, ph.pressure + 0.9));
      cracks.forEach(function (ck) { D.drawOn(ck.el, ck.len, cr); ck.el.setAttribute("opacity", r2((0.6 + 0.4 * Math.sin(t * 5)) * (1 - 0.7 * relief))); });

      // magma climbs the vent (accelerating), glowing tip
      var rise = riseAt(ph, t);
      D.drawOn(ventMagma, ventLen, rise);
      ventGlow.setAttribute("opacity", r2(0.75 * clamp(rise * 3) * (1 - 0.4 * relief)));
      var tp = VENT.at(Math.max(0.0001, rise));
      var tipOn = rise > 0.001 && t < ph.burst ? 1 : 0;
      tip.setAttribute("cx", tp.x); tip.setAttribute("cy", tp.y);
      tip.setAttribute("r", r2(18 + 4 * Math.sin(t * 9)));
      tip.setAttribute("opacity", tipOn * 0.95);
      tipGlow.setAttribute("cx", tp.x); tipGlow.setAttribute("cy", tp.y); tipGlow.setAttribute("opacity", r2(tipOn * 0.8));

      // steam until the burst
      var sFade = 1 - prog(t, ph.burst, ph.burst + 0.5);
      steamSys.at(t).forEach(function (p, j) {
        var e = steam[j].el;
        e.setAttribute("cx", r2(CRATER.x + p.x * 1.4));
        e.setAttribute("cy", r2(CRATER.y - 6 + p.y * 2.6));
        e.setAttribute("rx", r2(18 + 60 * p.u)); e.setAttribute("ry", r2(12 + 34 * p.u));
        e.setAttribute("opacity", r2(Math.sin(p.u * Math.PI) * 0.85 * sFade));
      });

      // ash plume
      puffs.forEach(function (pf) {
        var a = t - ph.burst + 0.1 - pf.t0;
        if (!(a >= 0)) { pf.el.setAttribute("cx", CRATER.x); pf.el.setAttribute("cy", CRATER.y); pf.el.setAttribute("r", 0); pf.el.setAttribute("opacity", 0); return; }
        var up = pf.vy * a * (1 - 0.06 * a);
        pf.el.setAttribute("cx", r2(CRATER.x + pf.vx * a));
        pf.el.setAttribute("cy", r2(CRATER.y - 10 - up));
        pf.el.setAttribute("r", r2(pf.r0 * (0.4 + Math.min(1, a * 2.2)) + 55 * a));
        pf.el.setAttribute("opacity", r2(clamp(a * 4) * (1 - prog(a, 3.2, 4.8)) * 0.95));
      });

      var erupt = prog(t, ph.burst - 0.1, ph.burst + 0.25);
      craterGlow.setAttribute("opacity", r2(erupt * (0.85 + 0.15 * Math.sin(t * 14))));
      heat.setAttribute("opacity", r2(Math.max(0, erupt * (0.32 + 0.06 * Math.sin(t * 5)) - 0.15 * prog(t, ph.grow, ph.grow + 2))));
      sun.setAttribute("opacity", r2((day ? 0.95 : 0.6) - 0.3 * erupt));

      // lava bombs: ballistic arcs, cooling from yellow to dark red
      var G = 1500, life = 1.5;
      bombs.forEach(function (bm) {
        var a = t - ph.burst - bm.t0;
        if (!(a >= 0 && a <= life)) { bm.el.setAttribute("cx", CRATER.x); bm.el.setAttribute("cy", CRATER.y); bm.el.setAttribute("r", 0); bm.el.setAttribute("fill", "#FFE08A"); bm.el.setAttribute("opacity", 0); return; }
        bm.el.setAttribute("cx", r2(CRATER.x + bm.vx * a));
        bm.el.setAttribute("cy", r2(CRATER.y - bm.vy * a + 0.5 * G * a * a));
        bm.el.setAttribute("r", r2(bm.r * (1 - 0.35 * (a / life))));
        var h = a / life;
        bm.el.setAttribute("fill", h < 0.3 ? "#FFE08A" : h < 0.65 ? "#FF8C1A" : "#C2381C");
        bm.el.setAttribute("opacity", r2(1 - prog(a, life - 0.25, life)));
      });

      // flows run down the flanks, then cool
      var fl = E.inOut(prog(t, ph.flow, ph.flow + 2.6));
      var cool = prog(t, ph.flow + 3.2, ph.flow + 6.5);
      flows.forEach(function (f) {
        [f.glow, f.hot, f.core, f.cool].forEach(function (e) { D.drawOn(e, f.f.length, fl); });
        f.hot.setAttribute("opacity", r2(1 - 0.6 * cool));
        f.core.setAttribute("opacity", r2((0.85 + 0.15 * Math.sin(t * 7)) * (1 - cool)));
        f.glow.setAttribute("opacity", r2(0.7 * (1 - 0.7 * cool)));
        f.cool.setAttribute("opacity", r2(0.75 * cool));
      });

      // the cone grows by a new layer
      var grow = E.inOut(prog(t, ph.grow, ph.grow + 1.4));
      coneNew.setAttribute("opacity", r2(grow)); coneNewEdge.setAttribute("opacity", r2(grow * 0.8));
      coneG.setAttribute("transform", "translate(720 604) scale(" + r2(1 + 0.02 * grow) + " " + r2(1 + 0.05 * grow) + ") translate(-720 -604)");
    }
    update(0);
    return { update: function (t, cueState) { update(t); }, anchors: anchors, phases: ph };
  }

  K.props.volcano = { meta: meta, mount: mount, phases: phases, anchorsFor: anchorsFor };
})(typeof globalThis !== "undefined" ? globalThis : window);
