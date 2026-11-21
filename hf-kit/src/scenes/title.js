/* Kit scene "title": opening / chapter card. A glowing icon with a slowly turning ring, a small
 * kicker, the title rising word by word and an optional subtitle on its cue, over drifting
 * sparks. props {title (<= 60), subtitle? (<= 90), kicker? (<= 30), icon?}; cues "title",
 * "subtitle". Anchors: title, icon, subtitle. */
(function (root) {
  "use strict";
  var K = root.HFKit, S = K.sceneKit, D = K.draw;

  function geometry(p, box, style) {
    var w = Math.min(box.width, 1500);
    var cx = box.x + box.width / 2;
    var parts = [], boxes = [], fonts = [];
    var icon = p.icon ? 150 : 0;
    var kicker = p.kicker ? { size: 32, h: 56, w: Math.min(w, S.textWidth(p.kicker.toUpperCase(), 32, "body") * 1.18 + 64) } : null;
    var tf = S.fitText(p.title, w * 0.94, S.range(104, 64, 8), 2, "heading");
    var th = Math.ceil(tf.size * 1.1 * tf.lines);
    var sf = p.subtitle ? S.fitText(p.subtitle, w * 0.85, S.range(44, 34, 2), 2, "body") : null;
    var sh = sf ? Math.ceil(sf.size * 1.3 * sf.lines) : 0;
    var gaps = [icon ? 34 : 0, kicker ? 22 : 0, sf ? 26 : 0];
    var total = icon + gaps[0] + (kicker ? kicker.h + gaps[1] : 0) + th + gaps[2] + sh;
    var y = box.y + Math.max(0, (box.height - total) / 2);
    var g = { cx: cx };
    if (icon) { g.icon = { cx: cx, cy: y + icon / 2, size: icon }; boxes.push({ name: "icon", x: cx - icon / 2, y: y, width: icon, height: icon }); y += icon + gaps[0]; }
    if (kicker) { g.kicker = { x: cx - kicker.w / 2, y: y, width: kicker.w, height: kicker.h, size: kicker.size }; boxes.push(Object.assign({ name: "kicker" }, g.kicker)); fonts.push({ name: "kicker", size: 32 }); y += kicker.h + gaps[1]; }
    g.title = { x: cx - w / 2, y: y, width: w, height: th, size: tf.size };
    boxes.push(Object.assign({ name: "title" }, g.title)); fonts.push({ name: "title", size: tf.size });
    y += th + gaps[2];
    if (sf) { g.subtitle = { x: cx - w / 2, y: y, width: w, height: sh, size: sf.size }; boxes.push(Object.assign({ name: "subtitle" }, g.subtitle)); fonts.push({ name: "subtitle", size: sf.size }); }
    var anchors = { title: { x: cx, y: g.title.y + th / 2 } };
    if (g.icon) anchors.icon = { x: cx, y: g.icon.cy };
    if (g.subtitle) anchors.subtitle = { x: cx, y: g.subtitle.y + sh / 2 };
    parts.push(g);
    return { geom: g, boxes: boxes, fonts: fonts, anchors: anchors };
  }

  function render(ctx) {
    var g = ctx.plan.geom, st = ctx.style, p = ctx.props, stage = ctx.stage, rev = ctx.plan.reveal;
    var t0 = rev.title[0], ts = p.subtitle ? rev.subtitle[0] : Infinity;
    var ups = [];
    // drifting sparks behind everything
    var box = ctx.plan.box;
    var fx = D.svgRoot(stage, K.CANVAS.width, K.CANVAS.height, { style: "position:absolute;left:0;top:0" }).svg;
    var sparks = D.particles({ count: 26, seed: 11, life: 7, spawn: [0, 7], loop: true, vx: [-10, 10], vy: [-60, -30], r: [2, 5] });
    var R = D.rng(5), dots = sparks.list.map(function () {
      return { x: box.x + R() * box.width, y: box.y + box.height * (0.6 + 0.5 * R()), c: R() < 0.5 ? st.colors.accent : st.colors.primary,
        el: D.el(fx, "circle", { r: 0 }) };
    });
    ups.push(function (t) {
      var s = sparks.at(t);
      dots.forEach(function (d, i) {
        var q = s[i];
        d.el.setAttribute("cx", D.r2(d.x + q.x + 14 * Math.sin(q.age * 1.3 + q.phase * 6)));
        d.el.setAttribute("cy", D.r2(d.y + q.y));
        d.el.setAttribute("r", D.r2(q.r));
        d.el.setAttribute("fill", d.c);
        d.el.setAttribute("opacity", D.r2(0.55 * Math.sin(Math.PI * q.u) * D.prog(t, 0, 1)));
      });
    });
    if (g.icon) {
      var ic = g.icon;
      var halo = D.svgRoot(stage, ic.size * 3, ic.size * 3, { style: "position:absolute;left:" + (ic.cx - ic.size * 1.5) + "px;top:" + (ic.cy - ic.size * 1.5) + "px" }).svg;
      var c = ic.size * 1.5;
      var ring = D.el(halo, "circle", { cx: c, cy: c, r: ic.size * 0.82, fill: "none", stroke: D.alpha(st.colors.accent, 0.55), "stroke-width": 3, "stroke-dasharray": "4 14", "stroke-linecap": "round" });
      var ring2 = D.el(halo, "circle", { cx: c, cy: c, r: ic.size * 1.05, fill: "none", stroke: D.alpha(st.colors.primary, 0.3), "stroke-width": 2, "stroke-dasharray": "60 30" });
      var disc = S.iconDisc(stage, ic.cx, ic.cy, ic.size, { style: st, icon: p.icon, color: st.colors.accent });
      disc.el.dataset.key = "icon";
      ups.push(function (t) {
        var s = D.buildIn(t, Math.max(0, t0 - 0.15), 0.6, 0);
        disc.el.style.opacity = D.r2(s.opacity);
        disc.el.style.transform = "scale(" + Math.round((0.6 + 0.4 * D.ease.outBack(s.k)) * 1000) / 1000 + ") translateY(" + D.r2(5 * D.wobble(t * 0.8, 3)) + "px)";
        disc.setRing(D.ease.inOut(D.prog(t, t0 + 0.2, t0 + 1.2)));
        disc.setActive(0.7 + 0.3 * Math.sin(t * 1.6));
        ring.setAttribute("transform", "rotate(" + D.r2(t * 14) + " " + c + " " + c + ")");
        ring2.setAttribute("transform", "rotate(" + D.r2(-t * 8) + " " + c + " " + c + ")");
        halo.style.opacity = D.r2(s.opacity);
      });
    }
    if (g.kicker) {
      var kk = S.text(stage, p.kicker.toUpperCase(), g.kicker, { style: st, size: g.kicker.size, weight: 700, align: "center", valign: "center", nowrap: true, color: st.colors.accent, key: "kicker" });
      kk.style.letterSpacing = "0.12em"; kk.style.borderRadius = "999px"; kk.style.border = "2px solid " + D.alpha(st.colors.accent, 0.5);
      kk.style.background = D.alpha(st.colors.accent, 0.1);
      ups.push(function (t) { D.applyIn(kk, D.buildIn(t, t0 + 0.1, 0.5, 16)); });
    }
    // title: words rise in one after another
    var tt = S.text(stage, "", g.title, { style: st, heading: true, size: g.title.size, align: "center", weight: 800, lineHeight: 1.1, key: "title" });
    tt.style.flexWrap = "wrap"; tt.style.alignContent = "flex-start";
    tt.innerHTML = "";
    var words = p.title.split(/\s+/).map(function (w, i, all) {
      var s = ctx.stage.ownerDocument.createElement("span");
      s.textContent = w;
      s.style.display = "inline-block";
      s.style.marginRight = i < all.length - 1 ? "0.26em" : "0";
      tt.appendChild(s);
      return s;
    });
    ups.push(function (t) {
      words.forEach(function (s, i) { D.applyIn(s, D.buildIn(t, t0 + 0.08 * i, 0.55, 34)); });
    });
    if (g.subtitle) {
      var sub = S.text(stage, p.subtitle, g.subtitle, { style: st, size: g.subtitle.size, weight: 500, align: "center", color: D.alpha(st.colors.text, 0.78), lineHeight: 1.3, key: "subtitle" });
      ups.push(function (t) { D.applyIn(sub, D.buildIn(t, ts, 0.6, 20)); });
    }
    return function (t) { ups.forEach(function (u) { u(t); }); };
  }

  S.register({
    name: "title",
    meta: { description: "Opening or chapter card: glowing icon, kicker, title rising word by word, subtitle on its cue.", cues: ["title", "subtitle"],
      props: { title: "text <= 60 (required)", subtitle: "text <= 90", kicker: "text <= 30", icon: "icon name" }, anchors: ["title", "icon", "subtitle", "center"] },
    check: function (p, v) {
      v.str(p.title, "title", S.LIMITS.title, true);
      v.str(p.subtitle, "subtitle", 90);
      v.str(p.kicker, "kicker", 30);
      v.icon(p.icon, "icon");
    },
    counts: function (p) { var c = { title: 1 }; if (p && p.subtitle) c.subtitle = 1; return c; },
    geometry: geometry,
    reveal: function (o, duration) {
      var r = S.planReveals(this.counts(o.props), o.cues, o.words, duration, o.sceneId);
      var cued = function (k) { return (o.cues || []).some(function (c) { return c.show === k; }); };
      if (!cued("title")) r.title = [0.25];
      if (o.props.subtitle && !cued("subtitle")) r.subtitle = [r.title[0] + 0.9];
      return r;
    },
    render: render,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
