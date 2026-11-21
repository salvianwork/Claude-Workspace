/* Hero "cloud-formation": how a cloud forms over the sea. The Sun warms the sea; water
 * evaporates into water vapour, an invisible gas (drawn as faint, see-through wisps so the
 * viewer can follow it); the warm, moist air rises (a broad soft arrow) into cooler air higher up
 * (a dashed line marks where it is cool enough); there the vapour condenses into tiny droplets,
 * and the droplets gather into a white cloud. Rain is not shown.
 *
 * Anchors (world px, 1920 x 1080 world): sun, sea, vapour (moves: a wisp rising from the sea to
 * the cool level), cool (on the dashed cool-air line), droplets, cloud.
 * Phases (seconds, from phase cues or params.phases): warm, evaporate, rise, condense, cloud.
 * Missing ones are derived: warm = 0, evaporate = warm + 1.5, rise = evaporate + 3,
 * condense = rise + 2, cloud = condense + 1.5.
 * Params: phases, seed (integer for the wisp/droplet pattern, default 3).
 *
 * Contract (hf-kit/props/README.md): HFKit.props["cloud-formation"] = {meta, mount, anchorsFor,
 * phases}; update(t) is a pure function of t (seekable). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.draw) throw new Error("cloud-formation: load the kit scripts first");
  var D = K.draw, clamp = D.clamp, prog = D.prog, lerp = D.lerp, E = D.ease, r2 = D.r2;
  K.props = K.props || {};

  var PHASES = { warm: "the Sun warms the sea", evaporate: "vapour starts to leave the sea",
    rise: "the warm, moist air rises", condense: "vapour turns into tiny droplets in the cool air",
    cloud: "the droplets gather into a cloud" };

  var meta = {
    name: "cloud-formation",
    description: "Sun over the sea: water evaporates into invisible vapour, warm moist air rises and cools, vapour condenses into droplets that form a cloud.",
    world: { width: 1920, height: 1080 },
    frame: { x: 140, y: 70, width: 1180, height: 900 },
    anchors: ["sun", "sea", "vapour", "cool", "droplets", "cloud"],
    phases: PHASES,
    params: {
      phases: "{warm, evaporate, rise, condense, cloud} seconds; usually from phase cues",
      seed: "integer for the wisp and droplet pattern (default 3)",
    },
  };

  function num(v, d) { return typeof v === "number" && isFinite(v) ? v : d; }
  function phases(p) {
    p = p || {};
    var warm = num(p.warm, 0);
    var evaporate = num(p.evaporate, warm + 1.5);
    var rise = num(p.rise, evaporate + 3);
    var condense = num(p.condense, rise + 2);
    var cloud = num(p.cloud, condense + 1.5);
    return { warm: warm, evaporate: evaporate, rise: rise, condense: condense, cloud: cloud };
  }

  // ---- geometry (world px) ----
  var SEA = 760;          // sea surface
  var COOL = 420;         // where the rising air is cool enough for droplets
  var CLOUD = { x: 760, y: 300 };
  var SUN = { x: 320, y: 190 };
  var LEAD_X = 640;       // the wisp the camera and the label follow

  /* The lead wisp: leaves the sea at evaporate, climbs slowly, faster once the air rises, and
   * reaches the cool level by condense. */
  function leadAt(ph, t) {
    var slow = 0.5 * E.outQuad(prog(t, ph.evaporate, ph.rise));
    var fast = 0.5 * E.inOut(prog(t, ph.rise, ph.condense));
    var u = slow + fast;
    return { x: r2(LEAD_X + 30 * Math.sin(u * 5)), y: r2(lerp(SEA - 30, COOL + 20, u)) };
  }

  function anchorsFor(params) {
    var ph = phases(params && params.phases);
    return {
      sun: { x: SUN.x, y: SUN.y },
      sea: { x: 760, y: 840 },
      vapour: function (t) { return leadAt(ph, t); },
      cool: { x: 1120, y: COOL },
      droplets: { x: 900, y: 360 },
      cloud: { x: CLOUD.x, y: CLOUD.y },
    };
  }

  function mount(rootEl, opts) {
    opts = opts || {};
    var params = opts.params || {};
    var ph = phases(params.phases);
    var seed = params.seed === undefined ? 3 : params.seed | 0;
    var R = D.rng(seed);
    var id = D.uid("cloudf");
    rootEl.innerHTML = "";
    var s = D.svgRoot(rootEl, meta.world.width, meta.world.height, { style: "position:absolute;left:0;top:0;overflow:visible" });
    var svg = s.svg, defs = s.defs;
    function el(parent, tag, a) { return D.el(parent, tag, a); }

    // ---- paints ----
    var sky = D.linearGradient(defs, id + "sky", [[0, "#1E3A8A"], [0.35, "#2563EB"], [0.7, "#60A5FA"], [1, "#FDE7C2"]]);
    var seaG = D.linearGradient(defs, id + "sea", [[0, "#0EA5E9"], [0.4, "#0369A1"], [1, "#0B2A4A"]]);
    var sunG = D.radialGradient(defs, id + "sun", [[0, "#FFF7D6"], [0.55, "#FFD166"], [1, "#F59E0B"]]);
    var glowG = D.radialGradient(defs, id + "gl", [[0, "#FFD166", 0.7], [1, "#FFD166", 0]]);
    var coolG = D.linearGradient(defs, id + "cool", [[0, "#93C5FD", 0.35], [1, "#93C5FD", 0]]);
    var cloudG = D.radialGradient(defs, id + "cl", [[0, "#FFFFFF"], [0.7, "#F1F5F9"], [1, "#CBD5E1"]], { cx: 0.45, cy: 0.35, r: 0.7 });
    var arrowG = D.linearGradient(defs, id + "ar", [[0, "#FDBA74", 0.0], [0.5, "#FDE68A", 0.45], [1, "#E0F2FE", 0.0]], [0, 1, 0, 0]);
    var soft = D.blurFilter(defs, id + "s8", 8);
    var soft30 = D.blurFilter(defs, id + "s30", 30);

    // ---- sky, cool air, sun ----
    el(svg, "rect", { x: -1600, y: -1600, width: 5120, height: 1600 + SEA, fill: sky });
    var coolBand = el(svg, "rect", { x: -1600, y: -1600, width: 5120, height: 1600 + COOL, fill: coolG, opacity: 0 });
    var coolLine = el(svg, "path", { d: "M-400 " + COOL + " L2400 " + COOL, stroke: "#E0F2FE", "stroke-width": 4, "stroke-dasharray": "18 16", fill: "none", opacity: 0 });
    var sunGlow = el(svg, "circle", { cx: SUN.x, cy: SUN.y, r: 230, fill: glowG, opacity: 0.6, filter: soft30 });
    var rays = el(svg, "g", { stroke: "#FFD166", "stroke-width": 8, "stroke-linecap": "round" });
    var rayEls = [];
    for (var k = 0; k < 12; k++) {
      var a = (k / 12) * Math.PI * 2;
      rayEls.push({ a: a, el: el(rays, "line", {}) });
    }
    el(svg, "circle", { cx: SUN.x, cy: SUN.y, r: 82, fill: sunG });

    // heat from the sun to the sea: soft slanted beams
    var beams = [];
    for (var b = 0; b < 4; b++) {
      var bx = 520 + b * 170;
      beams.push(el(svg, "path", { d: "M" + (SUN.x + 60) + " " + (SUN.y + 60) + " L" + bx + " " + (SEA - 6), stroke: "#FFE7A3", "stroke-width": 10, "stroke-linecap": "round", "stroke-dasharray": "2 26", fill: "none", opacity: 0 }));
    }

    // ---- the sea ----
    el(svg, "rect", { x: -1600, y: SEA, width: 5120, height: 1600, fill: seaG });
    var shimmer = el(svg, "ellipse", { cx: 760, cy: SEA + 10, rx: 520, ry: 26, fill: "#FFE7A3", opacity: 0, filter: soft });
    var waves = [];
    for (var w = 0; w < 5; w++) {
      var wy = SEA + 40 + w * 58;
      waves.push({ y: wy, sp: 18 + w * 6, el: el(svg, "path", { fill: "none", stroke: "#BAE6FD", "stroke-width": 4, opacity: r2(0.45 - w * 0.06), "stroke-linecap": "round" }) });
    }

    // ---- warm, moist air rising: one broad soft arrow ----
    var arrow = el(svg, "path", { d: "M600 700 L600 520 L540 520 L700 400 L860 520 L800 520 L800 700 Z", fill: arrowG, opacity: 0 });

    // ---- vapour wisps (invisible gas: faint and see-through) ----
    var wispLayer = el(svg, "g", { fill: "none", stroke: "#F0F9FF", "stroke-width": 6, "stroke-linecap": "round" });
    var wisps = [];
    for (var v = 0; v < 18; v++) {
      wisps.push({ x: 420 + R() * 760, period: 3.2 + R() * 1.6, off: R(), el: el(wispLayer, "path", { d: "M0 0 c 10 -14, -10 -28, 0 -42 c 10 -14, -10 -28, 0 -42", opacity: 0 }) });
    }
    var lead = el(wispLayer, "path", { d: "M0 0 c 12 -16, -12 -32, 0 -48 c 12 -16, -12 -32, 0 -48", "stroke-width": 7, opacity: 0 });

    // ---- droplets and the cloud ----
    var dropLayer = el(svg, "g", { fill: "#F8FAFC" });
    var drops = [];
    for (var d = 0; d < 70; d++) {
      var ang = R() * Math.PI * 2, rad = Math.sqrt(R());
      drops.push({
        x0: 470 + R() * 640, y0: COOL - 10 - R() * 150,
        x1: CLOUD.x + Math.cos(ang) * rad * 250, y1: CLOUD.y + 20 + Math.sin(ang) * rad * 70,
        t0: R() * 1.2, r: 3 + R() * 3.5,
        el: el(dropLayer, "circle", { r: 0, opacity: 0 }),
      });
    }
    var cloud = el(svg, "g", { opacity: 0 });
    var puffs = [[-210, 40, 120, 70], [-90, -10, 140, 110], [60, -40, 150, 125], [190, 20, 130, 85], [0, 50, 260, 70]];
    puffs.forEach(function (p) { el(cloud, "ellipse", { cx: CLOUD.x + p[0], cy: CLOUD.y + p[1], rx: p[2], ry: p[3], fill: cloudG }); });
    el(cloud, "path", { d: "M" + (CLOUD.x - 300) + " " + (CLOUD.y + 100) + " Q " + CLOUD.x + " " + (CLOUD.y + 130) + " " + (CLOUD.x + 300) + " " + (CLOUD.y + 92), stroke: "#94A3B8", "stroke-width": 6, fill: "none", opacity: 0.35, "stroke-linecap": "round" });

    var anchors = anchorsFor(params);

    function update(t) {
      // sun: gentle pulse, rays turn slowly; the warmth shows on the sea from "warm"
      var warm = E.inOut(prog(t, ph.warm, ph.warm + 1.2));
      sunGlow.setAttribute("opacity", r2(0.45 + 0.35 * warm + 0.05 * Math.sin(t * 2)));
      rayEls.forEach(function (ry, j) {
        var a = ry.a + t * 0.12, l = 118 + 10 * Math.sin(t * 2.4 + j);
        ry.el.setAttribute("x1", r2(SUN.x + Math.cos(a) * 104)); ry.el.setAttribute("y1", r2(SUN.y + Math.sin(a) * 104));
        ry.el.setAttribute("x2", r2(SUN.x + Math.cos(a) * l)); ry.el.setAttribute("y2", r2(SUN.y + Math.sin(a) * l));
      });
      beams.forEach(function (bm, j) {
        bm.setAttribute("opacity", r2(warm * (0.45 + 0.2 * Math.sin(t * 3 + j))));
        bm.setAttribute("stroke-dashoffset", r2(-t * 60));
      });
      shimmer.setAttribute("opacity", r2(warm * (0.35 + 0.1 * Math.sin(t * 2.6))));
      waves.forEach(function (wv) {
        var dd = "M-400 " + wv.y, x;
        for (x = -400; x <= 2400; x += 80) dd += " Q " + (x + 20) + " " + r2(wv.y - 10 * Math.sin((x + t * wv.sp) / 90)) + " " + (x + 40) + " " + wv.y + " T " + (x + 80) + " " + wv.y;
        wv.el.setAttribute("d", dd);
      });

      // vapour: faint wisps leave the sea from "evaporate"; they climb faster once the air rises
      var evap = prog(t, ph.evaporate, ph.evaporate + 1);
      var up = prog(t, ph.rise, ph.rise + 1);
      wisps.forEach(function (wp) {
        var u = ((Math.max(0, t - ph.evaporate) / wp.period) * (1 + 0.8 * up) + wp.off) % 1;
        var y = lerp(SEA - 10, COOL + 30, u);
        wp.el.setAttribute("transform", "translate(" + r2(wp.x + 18 * Math.sin(u * 6 + wp.off * 9)) + " " + r2(y) + ")");
        wp.el.setAttribute("opacity", r2(evap * 0.5 * Math.sin(u * Math.PI)));
      });
      var lp = leadAt(ph, t);
      lead.setAttribute("transform", "translate(" + lp.x + " " + (lp.y + 48) + ")");
      lead.setAttribute("opacity", r2(0.75 * evap * (1 - prog(t, ph.condense, ph.condense + 0.8))));

      // warm, moist air rises
      arrow.setAttribute("opacity", r2(up * (1 - 0.6 * prog(t, ph.cloud, ph.cloud + 1))));
      arrow.setAttribute("transform", "translate(0 " + r2(-12 * Math.sin(t * 1.6)) + ")");
      // the cool air higher up
      coolBand.setAttribute("opacity", r2(up));
      coolLine.setAttribute("opacity", r2(0.7 * up));
      coolLine.setAttribute("stroke-dashoffset", r2(-t * 20));

      // condense: tiny droplets appear in the cool air, then gather into the cloud
      var gather = E.inOut(prog(t, ph.cloud, ph.cloud + 1.4));
      drops.forEach(function (dp) {
        var on = prog(t, ph.condense + dp.t0, ph.condense + dp.t0 + 0.4);
        var x = lerp(dp.x0, dp.x1, gather), y = lerp(dp.y0, dp.y1, gather);
        dp.el.setAttribute("cx", r2(x + 4 * Math.sin(t * 1.3 + dp.t0 * 7)));
        dp.el.setAttribute("cy", r2(y + 3 * Math.cos(t * 1.1 + dp.t0 * 5)));
        dp.el.setAttribute("r", r2(dp.r * on));
        dp.el.setAttribute("opacity", r2(on * (0.9 - 0.5 * gather)));
      });
      var c = E.outCubic(prog(t, ph.cloud, ph.cloud + 1.6));
      cloud.setAttribute("opacity", r2(0.95 * c));
      cloud.setAttribute("transform", "translate(" + CLOUD.x + " " + CLOUD.y + ") scale(" + r2(0.7 + 0.3 * c) + ") translate(" + -CLOUD.x + " " + -CLOUD.y + ")");
    }
    update(0);
    return { update: function (t) { update(t); }, anchors: anchors, phases: ph };
  }

  K.props["cloud-formation"] = { meta: meta, mount: mount, phases: phases, anchorsFor: anchorsFor };
})(typeof globalThis !== "undefined" ? globalThis : window);
