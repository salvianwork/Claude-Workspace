/* SPIKE "real cartoon" composition for the speed-of-sound fixture.
 * Three drawn places, a world camera, a full-body presenter who walks into scene 1,
 * screen-space data tags riding the waves, big word-highlighted captions.
 * Everything is a pure function of t (seconds). */
(function () {
  "use strict";
  var P = window.HFKitPresenter;
  var D = window.SPIKE_DATA;
  var NS = "http://www.w3.org/2000/svg";
  var W = 1920, H = 1080;

  // ---------------------------------------------------------------- helpers
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function back(t) { t = clamp(t, 0, 1); var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function win(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function rnd(seed) { var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function f(n) { return Math.round(n * 10) / 10; }
  function wordT(scene, i) { return D.scenes[scene - 1].words[i].start; }

  /* camera keys [{t, x, y, z}] -> {x, y, z}: eased moves between keys, holds on keys */
  function camAt(keys, t) {
    if (t <= keys[0].t) return keys[0];
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (t <= b.t) {
        var s = ease((t - a.t) / (b.t - a.t));
        return { x: lerp(a.x, b.x, s), y: lerp(a.y, b.y, s), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), s)) };
      }
    }
    return keys[keys.length - 1];
  }
  function camTransform(c) { return "translate(960 540) scale(" + c.z.toFixed(4) + ") translate(" + (-c.x).toFixed(2) + " " + (-c.y).toFixed(2) + ")"; }
  function proj(c, x, y) { return { x: 960 + (x - c.x) * c.z, y: 540 + (y - c.y) * c.z }; }

  function svgEl(parent, html, attrs) {
    var g = document.createElementNS(NS, "g");
    if (attrs) for (var k in attrs) g.setAttribute(k, attrs[k]);
    if (html) g.innerHTML = html;
    parent.appendChild(g);
    return g;
  }
  function makeSvg(host) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", "0 0 " + W + " " + H);
    s.style.cssText = "position:absolute;left:0;top:0;overflow:hidden";
    host.appendChild(s);
    return s;
  }

  /* screen-space data tag: a pill with a pointer dot, fixed screen size */
  function tag(x, y, label, value, color, a, scale, dir) {
    if (a <= 0.01) return "";
    scale = (scale || 1) * (0.7 + 0.3 * back(a));
    dir = dir || "up";
    var lw = label.length * 21 + value.length * 27 + 70;
    var bh = 76;
    var ox = -lw / 2, oy = dir === "up" ? -bh - 34 : 34;
    return '<g transform="translate(' + f(x) + " " + f(y) + ") scale(" + scale.toFixed(3) + ')" opacity="' + a.toFixed(3) + '">' +
      '<circle r="11" fill="' + color + '" stroke="#fff" stroke-width="5"/>' +
      '<line x1="0" y1="0" x2="0" y2="' + (dir === "up" ? -34 : 34) + '" stroke="#fff" stroke-width="5"/>' +
      '<rect x="' + (ox + 4) + '" y="' + (oy + 7) + '" width="' + lw + '" height="' + bh + '" rx="38" fill="#0B1220" opacity="0.28"/>' +
      '<rect x="' + ox + '" y="' + oy + '" width="' + lw + '" height="' + bh + '" rx="38" fill="#fff" stroke="' + color + '" stroke-width="6"/>' +
      '<rect x="' + (ox + 8) + '" y="' + (oy + 8) + '" width="' + (label.length * 21 + 34) + '" height="' + (bh - 16) + '" rx="30" fill="' + color + '"/>' +
      '<text x="' + (ox + 25) + '" y="' + (oy + 51) + '" font-family="Poppins" font-weight="800" font-size="32" fill="#fff" letter-spacing="1">' + label + "</text>" +
      '<text x="' + (ox + label.length * 21 + 56) + '" y="' + (oy + 53) + '" font-family="Poppins" font-weight="800" font-size="40" fill="#14213D">' + value + "</text></g>";
  }

  function burst(x, y, a, s, text) {
    if (a <= 0 || a >= 1) return "";
    var k = back(win(a, 0, 0.35)) * (1 - win(a, 0.7, 1)) ;
    var out = '<g transform="translate(' + f(x) + " " + f(y) + ") scale(" + (s * k).toFixed(3) + ')">';
    var pts = [];
    for (var i = 0; i < 24; i++) { var r = i % 2 ? 60 : 120 + 20 * rnd(i); var an = (i / 24) * Math.PI * 2; pts.push(f(Math.cos(an) * r) + "," + f(Math.sin(an) * r * 0.8)); }
    out += '<polygon points="' + pts.join(" ") + '" fill="#FFE066" stroke="#F08C00" stroke-width="7" stroke-linejoin="round"/>';
    for (var j = 0; j < 8; j++) { var an2 = (j / 8) * Math.PI * 2 + 0.2; var r1 = 140 + a * 120; out += '<line x1="' + f(Math.cos(an2) * r1) + '" y1="' + f(Math.sin(an2) * r1 * 0.8) + '" x2="' + f(Math.cos(an2) * (r1 + 50)) + '" y2="' + f(Math.sin(an2) * (r1 + 50) * 0.8) + '" stroke="#FFF3BF" stroke-width="10" stroke-linecap="round"/>'; }
    if (text) out += '<text x="0" y="16" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="52" fill="#C2410C" transform="rotate(-8)">' + text + "</text>";
    return out + "</g>";
  }

  // ---------------------------------------------------------------- captions
  function pages(words) {
    var out = [], cur = [];
    words.forEach(function (w, i) {
      cur.push(w);
      var punct = /[.,!?]$/.test(w.display || w.text);
      if (cur.length >= 6 || (punct && cur.length >= 3) || i === words.length - 1) { out.push(cur); cur = []; }
    });
    return out;
  }
  function mountCaptions(host, words, centerX) {
    var box = document.createElement("div");
    box.style.cssText = "position:absolute;left:" + (centerX - 700) + "px;width:1400px;bottom:44px;display:flex;justify-content:center;pointer-events:none";
    var bar = document.createElement("div");
    bar.style.cssText = "font-family:Inter;font-weight:800;font-size:60px;line-height:1.18;color:#fff;text-align:center;padding:14px 34px 18px;border-radius:28px;" +
      "background:rgba(11,18,32,0.78);box-shadow:0 8px 30px rgba(0,0,0,0.25);max-width:1360px;letter-spacing:0.2px";
    box.appendChild(bar); host.appendChild(box);
    var pg = pages(words);
    var last = "";
    return function (t) {
      var cur = -1;
      for (var i = 0; i < words.length; i++) if (words[i].start <= t) cur = i;
      var pi = 0, idx = 0;
      for (var p = 0; p < pg.length; p++) { if (cur >= idx) pi = p; idx += pg[p].length; }
      if (cur < 0) pi = 0;
      var html = pg[pi].map(function (w) {
        var wi = words.indexOf(w);
        var col = wi === cur ? "#FFD43B" : wi < cur ? "#FFFFFF" : "rgba(255,255,255,0.55)";
        var sc = "display:inline-block;margin:0 0.17em;" + (wi === cur ? "transform:scale(1.04)" : "");
        return '<span style="color:' + col + ";" + sc + '">' + (w.display || w.text) + "</span>";
      }).join("");
      if (html !== last) { bar.innerHTML = html; last = html; }
    };
  }

  // ---------------------------------------------------------------- the actor (presenter)
  var ACT_W = 1000, ACT_H = 1420; // body-unit box of actorSVG (feet at 1300 => y offset)
  function placeActor(state, feetX, feetY, k, uid) {
    // k = screen px per body unit. actor svg box: x -500..500, y 0..1420
    var w = ACT_W * k, hgt = ACT_H * k;
    state.width = w; state.height = hgt;
    var svg = P.actorSVG(state, uid);
    var left = feetX - w / 2, top = feetY - P.FEET * k;
    return '<div style="position:absolute;left:' + left.toFixed(1) + "px;top:" + top.toFixed(1) + "px;width:" + w.toFixed(1) + "px;height:" + hgt.toFixed(1) + 'px">' + svg + "</div>";
  }
  /* pose track: [{t, pose, expr}] -> blended figure state like the kit's stateAt */
  function poseState(track, t, mouth, seed) {
    var fr = Math.floor(t * 30 + 1e-6);
    var idx = 0;
    for (var i = 0; i < track.length; i++) if (track[i].t <= t) idx = i;
    var cur = track[idx], prev = idx > 0 ? track[idx - 1] : null;
    var k = prev ? clamp((t - cur.t) / 0.27, 0, 1) : 1;
    var target = P.animatedPose(cur.pose, fr, mouth);
    var start = prev && k < 1 ? P.animatedPose(prev.pose, fr, mouth) : target;
    return {
      pose: P.blendPoses(start, target, k),
      face: P.faceAt(prev ? prev.expr : cur.expr, cur.expr, k),
      mouth: mouth[fr] || 0, blink: P.blinkAmount(fr, seed), t: fr,
    };
  }

  // ================================================================ SCENE 1: the railway world
  var S1 = { strikeX: 838, railNear: 1136, railFar: 1098, actX: 728, actY: 1196, friendX: 3420,
    vAir: 300, vWater: 300 * 1480 / 343, vSteel: 300 * 5960 / 343, lake0: 1520, lake1: 2640 };
  // strike times (scene-1 seconds): hammer lands
  var STRIKE1 = 2.52, STRIKE2 = 9.12, FROG = 6.12;

  function railStatic() {
    var s = "";
    s += '<defs>' +
      '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FB0EA"/><stop offset="0.55" stop-color="#A9DAF5"/><stop offset="1" stop-color="#FFE7BF"/></linearGradient>' +
      '<radialGradient id="sun"><stop offset="0" stop-color="#FFF7D6"/><stop offset="0.35" stop-color="#FFE9A0" stop-opacity="0.9"/><stop offset="1" stop-color="#FFE9A0" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="meadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8CCB63"/><stop offset="1" stop-color="#5A9E45"/></linearGradient>' +
      '<linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A47A52"/><stop offset="0.4" stop-color="#8A6343"/><stop offset="1" stop-color="#5E4330"/></linearGradient>' +
      '<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5CC3E6"/><stop offset="0.5" stop-color="#2E8CC0"/><stop offset="1" stop-color="#1C5B8C"/></linearGradient>' +
      '<linearGradient id="rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF3F7"/><stop offset="0.35" stop-color="#A8B4BF"/><stop offset="1" stop-color="#5A6570"/></linearGradient>' +
      '<clipPath id="above"><rect x="-2000" y="-2000" width="9000" height="3196"/></clipPath>' +
      '<clipPath id="lakeClip"><path d="' + lakePath() + '"/></clipPath>' +
      '</defs>';
    s += '<rect x="-2000" y="-1500" width="9000" height="2700" fill="url(#sky)"/>';
    s += '<circle cx="3000" cy="300" r="420" fill="url(#sun)"/><circle cx="3000" cy="300" r="105" fill="#FFF4C4"/>';
    // far hills
    s += '<path d="M -2000 900 C -1200 760 -600 820 0 780 C 600 740 1000 840 1600 790 C 2200 740 2600 700 3200 770 C 3800 840 4300 730 5000 780 L 7000 800 L 7000 1300 L -2000 1300 Z" fill="#A5CDBE"/>';
    s += '<path d="M -2000 960 C -1000 880 -300 940 400 900 C 1100 860 1500 950 2200 905 C 2900 860 3400 930 4100 890 C 4700 860 5400 920 7000 900 L 7000 1300 L -2000 1300 Z" fill="#86BC8A"/>';
    // distant trees + barn + windmill base
    for (var i = 0; i < 26; i++) {
      var tx = -800 + i * 230 + rnd(i) * 120, ty = 950 + rnd(i + 9) * 30, tr = 26 + rnd(i + 3) * 18;
      s += '<rect x="' + f(tx - 5) + '" y="' + f(ty) + '" width="10" height="' + f(tr * 1.3) + '" fill="#6B4A2F"/><circle cx="' + f(tx) + '" cy="' + f(ty) + '" r="' + f(tr) + '" fill="' + (i % 3 ? "#4F8F4A" : "#3F7F3E") + '"/>';
    }
    s += '<g transform="translate(2950 975)"><rect x="-90" y="-80" width="180" height="90" fill="#C0392B" stroke="#7B241C" stroke-width="5"/><path d="M -105 -78 L 0 -150 L 105 -78 Z" fill="#7B241C"/><rect x="-28" y="-50" width="56" height="60" fill="#F5E6CC"/></g>';
    s += '<g transform="translate(1180 985)"><path d="M -34 0 L -14 -230 L 14 -230 L 34 0 Z" fill="#EDE3D2" stroke="#8C7A62" stroke-width="5"/></g>';
    // meadow band
    s += '<path d="M -2000 1030 C -1000 1012 0 1040 1000 1022 C 2000 1006 3000 1036 4000 1018 C 5000 1004 6000 1030 7000 1020 L 7000 1206 L -2000 1206 Z" fill="url(#meadow)"/>';
    // soil cut
    s += '<rect x="-2000" y="1200" width="9000" height="1400" fill="url(#soil)"/>';
    s += '<path d="M -2000 1200 L 7000 1200" stroke="#4E8B3A" stroke-width="18"/>';
    for (var r = 0; r < 60; r++) { var rx = -1500 + r * 120 + rnd(r * 3) * 80, ry = 1290 + rnd(r * 7) * 420; s += '<ellipse cx="' + f(rx) + '" cy="' + f(ry) + '" rx="' + f(16 + rnd(r) * 24) + '" ry="' + f(10 + rnd(r + 1) * 12) + '" fill="#6E5039" opacity="0.6"/>'; }
    s += '<path d="M -2000 1330 C -800 1300 200 1370 1200 1335 C 2200 1300 3200 1370 4300 1330 C 5400 1300 6200 1350 7000 1330 L 7000 1480 C 6000 1500 5000 1450 4000 1490 C 3000 1520 2000 1460 1000 1500 C 0 1530 -1000 1470 -2000 1490 Z" fill="#94694A" opacity="0.7"/>';
    s += '<path d="M -2000 1640 C -500 1600 1500 1680 3000 1630 C 4500 1590 5500 1660 7000 1630 L 7000 2600 L -2000 2600 Z" fill="#5A3F2C" opacity="0.75"/>';
    for (var ro = 0; ro < 90; ro++) {
      var rx2 = -1200 + ro * 70 + rnd(ro * 5 + 1) * 60, ry2 = 1250 + rnd(ro * 11 + 2) * 600, rs = 10 + rnd(ro + 300) * 26;
      if (rx2 > 1480 && rx2 < 2680 && ry2 < 1620) continue;
      s += '<path d="M ' + f(rx2 - rs) + " " + f(ry2) + " Q " + f(rx2 - rs) + " " + f(ry2 - rs * 0.9) + " " + f(rx2) + " " + f(ry2 - rs * 0.8) + " Q " + f(rx2 + rs * 1.2) + " " + f(ry2 - rs * 0.7) + " " + f(rx2 + rs) + " " + f(ry2) + " Q " + f(rx2) + " " + f(ry2 + rs * 0.5) + " " + f(rx2 - rs) + " " + f(ry2) + ' Z" fill="' + (ro % 3 ? "#A08C74" : "#8A7A66") + '" stroke="#5C4A38" stroke-width="4"/>';
    }
    for (var rt = 0; rt < 40; rt++) {
      var tx2 = -1400 + rt * 170 + rnd(rt + 900) * 80; if (tx2 > 1480 && tx2 < 2680) continue;
      s += '<path d="M ' + f(tx2) + ' 1206 q -12 30 4 56 q 14 24 -6 50 M ' + f(tx2) + ' 1230 q 20 14 30 40" stroke="#6B4A2F" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.75"/>';
    }
    // lake
    s += '<path d="' + lakePath() + '" fill="url(#water)"/>';
    s += '<g clip-path="url(#lakeClip)">';
    for (var w = 0; w < 14; w++) { var wx = 1600 + w * 80 + rnd(w + 40) * 40; s += '<path d="M ' + f(wx) + ' 1640 q 18 -60 -6 -120 q -14 -40 6 -90" stroke="#2F7D4F" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.8"/>'; }
    s += '</g>';
    s += '<rect x="1505" y="1188" width="1150" height="10" fill="#B9ECFA" opacity="0.8"/>';
    // dock on the left bank
    s += '<g><rect x="1460" y="1168" width="230" height="18" rx="4" fill="#9C6B3F" stroke="#5B3A1E" stroke-width="4"/>' +
      '<rect x="1478" y="1182" width="14" height="120" fill="#7A5230"/><rect x="1660" y="1182" width="14" height="150" fill="#7A5230"/></g>';
    // track: ballast + sleepers + rails, bridge over the lake
    s += '<path d="M -2000 1162 L 1520 1162 L 1520 1078 L -2000 1078 Z" fill="#B7AB97"/>';
    s += '<path d="M 2640 1162 L 7000 1162 L 7000 1078 L 2640 1078 Z" fill="#B7AB97"/>';
    s += '<path d="M -2000 1162 L 1520 1162 M 2640 1162 L 7000 1162" stroke="#958A77" stroke-width="10"/>';
    // bridge deck + trestles
    s += '<rect x="1500" y="1146" width="1160" height="26" fill="#8B5E34" stroke="#4E3219" stroke-width="5"/>';
    for (var b = 0; b < 6; b++) { var bx = 1600 + b * 200; s += '<path d="M ' + bx + ' 1170 L ' + (bx - 30) + ' 1600 M ' + bx + ' 1170 L ' + (bx + 30) + ' 1600 M ' + (bx - 22) + ' 1360 L ' + (bx + 22) + ' 1360" stroke="#6E4824" stroke-width="16" stroke-linecap="round"/>'; }
    for (var sl = -2000; sl < 7000; sl += 46) s += '<path d="M ' + (sl + 10) + ' 1086 L ' + (sl - 2) + ' 1156 L ' + (sl + 22) + ' 1156 L ' + (sl + 32) + ' 1086 Z" fill="#6E4B32" stroke="#4A3020" stroke-width="2"/>';
    s += '<rect x="-2000" y="' + (S1.railFar - 8) + '" width="9000" height="14" fill="url(#rail)" stroke="#3D464F" stroke-width="2"/>';
    s += '<rect x="-2000" y="' + (S1.railNear - 12) + '" width="9000" height="20" fill="url(#rail)" stroke="#3D464F" stroke-width="2.5"/>';
    // foreground flowers / grass tufts on the meadow
    for (var g = 0; g < 70; g++) {
      var gx = -1500 + g * 100 + rnd(g + 100) * 70; if (gx > 1500 && gx < 2660) continue;
      var gy = 1172 + rnd(g + 200) * 26;
      s += '<path d="M ' + f(gx) + " " + f(gy) + " l -8 -26 M " + f(gx) + " " + f(gy) + " l 2 -32 M " + f(gx) + " " + f(gy) + ' l 10 -24" stroke="#3E7F32" stroke-width="5" stroke-linecap="round"/>';
      if (g % 4 === 0) s += '<circle cx="' + f(gx + 4) + '" cy="' + f(gy - 30) + '" r="8" fill="' + (g % 8 ? "#FFFFFF" : "#FFD43B") + '"/>';
    }
    // signal post near the presenter
    s += '<g transform="translate(560 1080)"><rect x="-7" y="-260" width="14" height="260" fill="#4B5563"/><rect x="-34" y="-300" width="68" height="60" rx="10" fill="#1F2937"/><circle cx="0" cy="-270" r="18" fill="#34D399"/></g>';
    return s;
  }
  function lakePath() { return "M 1520 1190 C 1600 1420 1760 1590 2080 1600 C 2400 1590 2560 1420 2640 1190 Z"; }

  function friend(t, ding) {
    // kneeling side view, facing left, ear pressed on the near rail
    var x = S1.friendX, y = S1.railNear - 12;
    var jolt = ding > 0 ? Math.sin(clamp(ding, 0, 1) * Math.PI) * 12 : 0;
    function cap(x1, y1, x2, y2, w, fill, line) { return '<path d="M ' + x1 + " " + y1 + " L " + x2 + " " + y2 + '" stroke="' + line + '" stroke-width="' + (w + 10) + '" stroke-linecap="round"/><path d="M ' + x1 + " " + y1 + " L " + x2 + " " + y2 + '" stroke="' + fill + '" stroke-width="' + w + '" stroke-linecap="round"/>'; }
    var s = '<g transform="translate(' + x + " " + y + ')">';
    s += '<ellipse cx="90" cy="76" rx="130" ry="14" fill="#000" opacity="0.16"/>';
    s += cap(150, 20, 95, 66, 50, "#2B3A55", "#141C2B");   // thigh
    s += cap(95, 68, 200, 70, 42, "#2B3A55", "#141C2B");   // shin on the ground
    s += '<path d="M 200 50 l 34 4 l 0 24 l -38 0 Z" fill="#3A2A22" stroke="#1A0F0A" stroke-width="4"/>';
    s += '<g transform="translate(0 ' + (-jolt) + ')">';
    s += cap(150, 18, 60, -14, 72, "#E8772E", "#8A3F0C");  // torso, leaning to the rail
    s += cap(70, -10, 10, 30, 30, "#E8772E", "#8A3F0C");   // arm to the rail
    s += '<circle cx="4" cy="34" r="15" fill="#8D5A3B" stroke="#4A2B18" stroke-width="4"/>';
    s += '<circle cx="10" cy="-30" r="40" fill="#8D5A3B" stroke="#4A2B18" stroke-width="5"/>'; // head
    s += '<path d="M -30 -40 C -28 -84 40 -90 52 -44 Z" fill="#2563EB" stroke="#1E3A8A" stroke-width="5"/>'; // cap
    s += '<path d="M -26 -44 L -62 -40 L -26 -34 Z" fill="#1E3A8A"/>'; // brim
    s += '<path d="M -14 -26 q 8 6 16 0" stroke="#1A0F0A" stroke-width="5" fill="none" stroke-linecap="round"/>'; // closed eye, listening
    s += '<ellipse cx="18" cy="2" rx="12" ry="9" fill="#734327" stroke="#4A2B18" stroke-width="3"/>'; // ear on the rail
    s += '</g>';
    return s + "</g>";
  }

  function rings(cx, cy, r, color, alpha, n, gap, width) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var rr = r - i * gap; if (rr <= 4) continue;
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + f(rr) + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" opacity="' + (alpha * (1 - i / n)).toFixed(3) + '"/>';
    }
    return s;
  }

  function railDynamic(t, opts) {
    var s = "";
    // clouds drifting
    for (var c = 0; c < 7; c++) {
      var cx = -600 + c * 760 + t * (10 + c * 2), cy = 260 + rnd(c + 50) * 300, sc = 0.8 + rnd(c + 60) * 0.7;
      s += '<g transform="translate(' + f(cx) + " " + f(cy) + ") scale(" + sc.toFixed(2) + ')" opacity="0.95"><ellipse cx="0" cy="0" rx="120" ry="48" fill="#fff"/><ellipse cx="-60" cy="-26" rx="70" ry="52" fill="#fff"/><ellipse cx="50" cy="-40" rx="80" ry="62" fill="#fff"/><ellipse cx="0" cy="20" rx="130" ry="26" fill="#E3F1FA"/></g>';
    }
    // windmill blades
    var a = t * 40;
    s += '<g transform="translate(1180 755) rotate(' + f(a) + ')">';
    for (var b = 0; b < 4; b++) s += '<rect x="-12" y="-150" width="24" height="150" rx="6" fill="#F7F1E6" stroke="#8C7A62" stroke-width="4" transform="rotate(' + b * 90 + ')"/>';
    s += '<circle r="14" fill="#8C7A62"/></g>';

    // --- air rings from both strikes
    var airs = "";
    [STRIKE1, STRIKE2].forEach(function (ts) {
      if (t < ts) return;
      var r = (t - ts) * S1.vAir;
      var al = 0.95 * (1 - win(r, 2600, 3100));
      airs += rings(S1.strikeX, S1.railNear - 6, r, "#FFFFFF", al, 4, 30, 9);
    });
    s += '<g clip-path="url(#above)">' + airs + "</g>";

    // --- steel pulses along the near rail
    [STRIKE1, STRIKE2].forEach(function (ts, k) {
      if (t < ts) return;
      var fx = S1.strikeX + (t - ts) * S1.vSteel;
      var fade = 1 - win(fx, 4200, 5200);
      if (fade <= 0) return;
      var bright = k === 1 ? 1 : 0.75;
      var tail = Math.min(fx - S1.strikeX, 900);
      s += '<rect x="' + f(fx - tail) + '" y="' + (S1.railNear - 16) + '" width="' + f(tail) + '" height="28" rx="14" fill="#FFB020" opacity="' + (0.35 * fade * bright).toFixed(3) + '"/>';
      for (var i = 0; i < 6; i++) {
        var x = fx - i * 70; if (x < S1.strikeX) continue;
        s += '<ellipse cx="' + f(x) + '" cy="' + (S1.railNear - 2) + '" rx="' + (26 - i * 3) + '" ry="' + (24 - i * 2) + '" fill="#FFD43B" opacity="' + (fade * bright * (1 - i / 6)).toFixed(3) + '"/>';
      }
      s += '<circle cx="' + f(fx) + '" cy="' + (S1.railNear - 2) + '" r="34" fill="#FFF3BF" opacity="' + (0.9 * fade * bright).toFixed(3) + '"/>';
    });

    // --- the lake: frog dive and fast underwater rings
    var fr = t - FROG;
    var frogX, frogY, frogRot = 0;
    if (fr < -0.5) { frogX = 1640; frogY = 1150; }
    else if (fr < 0) { var u = (fr + 0.5) / 0.5; frogX = lerp(1640, 1790, u); frogY = 1150 - Math.sin(u * Math.PI) * 120 + u * 70; frogRot = u * 70; }
    else { frogX = 1800 + fr * 60; frogY = 1250 + Math.min(fr, 1.5) * 80; frogRot = 80; }
    var underwater = "";
    if (fr >= 0) {
      for (var p = 0; p < 5; p++) {
        var tp = fr - p * 0.5; if (tp < 0) continue;
        var rr = tp * S1.vWater; // true ratio to the air rings (4.3x faster)
        underwater += rings(1800, 1240, rr, "#E0FBFF", 0.9 * (1 - win(rr, 600, 1000)), 3, 26, 9);
      }
    }
    // fish
    var fish = "";
    [[2250, 1330, 0], [2420, 1460, 1], [1950, 1480, 2]].forEach(function (q) {
      var fxp = q[0] + Math.sin(t * 0.8 + q[2]) * 30, fyp = q[1] + Math.sin(t * 1.3 + q[2]) * 8;
      var startle = fr > 0.35 + q[2] * 0.1 ? Math.min(1, (fr - 0.35 - q[2] * 0.1) * 3) : 0;
      fish += '<g transform="translate(' + f(fxp + startle * 40) + " " + f(fyp - startle * 10) + ')"><ellipse rx="44" ry="22" fill="' + (q[2] === 1 ? "#F59E0B" : "#FB7185") + '" stroke="#7C2D12" stroke-width="4"/><path d="M 40 0 L 72 -22 L 72 22 Z" fill="' + (q[2] === 1 ? "#F59E0B" : "#FB7185") + '" stroke="#7C2D12" stroke-width="4"/><circle cx="-24" cy="-5" r="6" fill="#fff"/><circle cx="-25" cy="-5" r="3" fill="#111"/></g>';
    });
    s += '<g clip-path="url(#lakeClip)">' + underwater + fish + "</g>";
    // frog
    s += '<g transform="translate(' + f(frogX) + " " + f(frogY) + ") rotate(" + f(frogRot) + ')"><ellipse rx="34" ry="24" fill="#4CAF50" stroke="#1B5E20" stroke-width="5"/><circle cx="-16" cy="-22" r="11" fill="#fff" stroke="#1B5E20" stroke-width="4"/><circle cx="14" cy="-22" r="11" fill="#fff" stroke="#1B5E20" stroke-width="4"/><circle cx="-15" cy="-22" r="5" fill="#111"/><circle cx="15" cy="-22" r="5" fill="#111"/></g>';
    if (fr >= 0 && fr < 0.6) s += '<g opacity="' + (1 - fr / 0.6).toFixed(2) + '"><ellipse cx="1800" cy="1192" rx="' + f(30 + fr * 200) + '" ry="' + f(8 + fr * 30) + '" fill="none" stroke="#fff" stroke-width="6"/></g>';

    // --- friend + strike bursts
    var ding1 = (t - (STRIKE1 + (S1.friendX - S1.strikeX) / S1.vSteel)) / 0.4;
    var ding2 = (t - (STRIKE2 + (S1.friendX - S1.strikeX) / S1.vSteel)) / 0.4;
    s += friend(t, ding2 > 0 && ding2 < 1 ? ding2 : ding1 > 0 && ding1 < 1 ? ding1 * 0.6 : 0);
    if (!opts.noBursts) {
      s += burst(S1.strikeX + 120, S1.railNear - 110, (t - STRIKE1) / 0.7, 0.6, "CLANG!");
      s += burst(S1.strikeX + 160, S1.railNear - 150, (t - STRIKE2) / 0.7, 0.95, "CLANG!");
    }
    return s;
  }

  function pfxIds(str, p) { return str.replace(/id="/g, 'id="' + p).replace(/url\(#/g, "url(#" + p); }
  function mountRailWorld(svg, pfx) {
    var cam = svgEl(svg, "", {});
    svgEl(cam, pfxIds(railStatic(), pfx));
    var dyn = svgEl(cam, "");
    return {
      update: function (t, c, opts) {
        cam.setAttribute("transform", camTransform(c));
        dyn.innerHTML = pfxIds(railDynamic(t, opts || {}), pfx);
      },
    };
  }

  // ---------------------------------------------------------------- scene 1 timing
  var w1 = function (i) { return wordT(1, i); };
  var CAM1 = [
    { t: 0.0, x: 1250, y: 960, z: 1.32 },
    { t: 1.55, x: 2120, y: 930, z: 0.62 },   // pull-out reveal: the whole line
    { t: 2.35, x: 1150, y: 1010, z: 1.02 },  // push in: he walks in and strikes
    { t: 3.3, x: 1250, y: 1000, z: 1.0 },
    { t: 4.3, x: 1320, y: 990, z: 1.24 },    // push in on "343"
    { t: 5.6, x: 1560, y: 1000, z: 1.0 },    // ride along with the ring
    { t: 6.35, x: 2020, y: 1290, z: 1.12 },  // down to the lake
    { t: 7.4, x: 2060, y: 1300, z: 1.34 },   // push in on "1,480"
    { t: 8.25, x: 2060, y: 1300, z: 1.34 },
    { t: 9.0, x: 2110, y: 960, z: 0.62 },    // pull-out: the whole line for steel
    { t: 9.9, x: 2130, y: 960, z: 0.64 },
    { t: 10.8, x: 3220, y: 1040, z: 1.2 },   // push in on the friend
    { t: 11.25, x: 3260, y: 1060, z: 1.25 },
    { t: 12.0, x: 3380, y: 1128, z: 5.0 },   // dive into the rail -> scene 2
  ];
  var POSE1 = [
    { t: 0, pose: "talk", expr: "happy" },
    { t: 1.2, pose: "wave-carry", expr: "happy" },
    { t: 1.6, pose: "carry", expr: "curious" },
    { t: STRIKE1 - 0.55, pose: "raise", expr: "curious" },
    { t: STRIKE1 - 0.2, pose: "strike", expr: "surprised" },
    { t: STRIKE1 + 0.5, pose: "carry-point", expr: "happy" },
    { t: 5.4, pose: "carry", expr: "curious" },
    { t: STRIKE2 - 0.55, pose: "raise", expr: "curious" },
    { t: STRIKE2 - 0.2, pose: "strike", expr: "surprised" },
    { t: STRIKE2 + 0.5, pose: "carry-point", expr: "happy" },
    { t: 10.75, pose: "point-right", expr: "happy" },
  ];
  var SIDE1 = { x: 300, y: 1470, k: 0.9 };
  function actorPlace1(t, c) {
    // returns {x, y, k, walk, hammer}
    var world = proj(c, S1.actX, S1.actY);
    var wk = 0.255 * c.z;
    var hammer = t > 1.25 && t < 10.6;
    var u = ease(win(t, 1.5, 2.2));
    if (t < 10.4) {
      var walk = t > 1.45 && t < 2.15 ? (t - 1.45) * 14 : null;
      return { x: lerp(SIDE1.x, world.x, u), y: lerp(SIDE1.y, world.y, u), k: lerp(SIDE1.k, wk, u), walk: walk, hammer: hammer };
    }
    // returns to the side: walks in from the left edge
    var r = ease(win(t, 10.45, 11.1));
    return { x: lerp(-380, SIDE1.x, r), y: SIDE1.y, k: SIDE1.k, walk: r < 1 ? (t - 10.45) * 12 : null, hammer: false };
  }
  function overlay1(t, c) {
    var s = "";
    // air tag rides the first ring at -28 deg
    var r = Math.max(0, (t - STRIKE1) * S1.vAir);
    var an = -28 * Math.PI / 180;
    var pa = proj(c, S1.strikeX + Math.cos(an) * r, S1.railNear + Math.sin(an) * r);
    var aa = win(t, w1(7), w1(7) + 0.3) * (1 - win(t, 6.0, 6.3)) + win(t, 9.95, 10.2) * (1 - win(t, 11.3, 11.6));
    if (r > 30) s += tag(pa.x, pa.y, "AIR", "343 m/s", "#3B82F6", aa, 1, "up");
    // water tag on the first underwater ring (slowed view)
    var fr = t - FROG;
    if (fr > 0) {
      var rw = Math.min(fr * S1.vWater, 560);
      var pw = proj(c, 1800 + rw * 0.94, 1240 + rw * 0.34);
      s += tag(pw.x, pw.y, "WATER", "≈1,480 m/s", "#0EA5E9", win(t, wordT(1, 16), wordT(1, 16) + 0.3) * (1 - win(t, 8.5, 8.8)), 1, "up");
    }
    // steel tag rides the second pulse, parks over the friend
    if (t > STRIKE2) {
      var fx = Math.min(S1.strikeX + (t - STRIKE2) * S1.vSteel, S1.friendX - 240);
      var ps = proj(c, fx, S1.railNear - 10);
      s += tag(ps.x, ps.y, "STEEL", "≈5,960 m/s", "#F08C00", win(t, w1(21), w1(21) + 0.25) * (1 - win(t, 11.4, 11.7)), 1.08, "up");
    }
    // friend's bubbles
    var tArr2 = STRIKE2 + (S1.friendX - S1.strikeX) / S1.vSteel;
    var tAir1 = STRIKE1 + (S1.friendX - S1.strikeX) / S1.vAir;
    var pf = proj(c, S1.friendX + 60, S1.railNear - 150);
    var b1 = win(t, tArr2 + 0.05, tArr2 + 0.3);
    s += bubble(pf.x + 70, pf.y - 60, "Rail: DING!", "#F08C00", b1 * (1 - win(t, tAir1 - 0.2, tAir1)));
    s += bubble(pf.x + 70, pf.y - 60, "…air: ding", "#3B82F6", win(t, tAir1, tAir1 + 0.25) * (1 - win(t, 11.6, 11.85)));
    return s;
  }
  function bubble(x, y, text, color, a) {
    if (a <= 0.01) return "";
    var w = text.length * 26 + 50;
    return '<g transform="translate(' + f(x) + " " + f(y) + ") scale(" + (0.6 + 0.4 * back(a)).toFixed(3) + ')" opacity="' + a.toFixed(3) + '">' +
      '<path d="M -20 30 L -46 70 L 10 34 Z" fill="#fff" stroke="' + color + '" stroke-width="6" stroke-linejoin="round"/>' +
      '<rect x="-40" y="-50" width="' + w + '" height="90" rx="44" fill="#fff" stroke="' + color + '" stroke-width="6"/>' +
      '<text x="' + (w / 2 - 40) + '" y="12" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="42" fill="' + color + '">' + text + "</text></g>";
  }

  // ================================================================ SCENE 2: inside the rail
  var LAT = { x0: 300, y0: 780, dx: 98, dy: 96, cols: 34, rows: 8, r: 25 };
  var AIRP = [];
  for (var i2 = 0; i2 < 30; i2++) AIRP.push({ x: 300 + (i2 % 10) * 360 + rnd(i2 + 5) * 200, y: 70 + Math.floor(i2 / 10) * 190 + rnd(i2 + 77) * 90, ph: rnd(i2 + 9) * 6 });
  var PUSH = 4.62; // "each push"
  var V2S = 1500, V2A = 1500 * 343 / 5960;
  function s2static() {
    var s = '<defs><linearGradient id="s2air" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D7EEFC"/><stop offset="1" stop-color="#9ED0F0"/></linearGradient>' +
      '<linearGradient id="s2steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8D9DAC"/><stop offset="0.5" stop-color="#6A7A89"/><stop offset="1" stop-color="#46535F"/></linearGradient>' +
      '<radialGradient id="ball" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.35" stop-color="#C9D4DE"/><stop offset="1" stop-color="#6F7F8E"/></radialGradient>' +
      '<radialGradient id="aball" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.4" stop-color="#93C5FD"/><stop offset="1" stop-color="#3B82F6"/></radialGradient></defs>';
    s += '<rect x="-3000" y="-2000" width="9000" height="2690" fill="url(#s2air)"/>';
    s += '<rect x="-3000" y="690" width="9000" height="2400" fill="url(#s2steel)"/>';
    // steel grain bands
    for (var i = 0; i < 9; i++) s += '<rect x="-3000" y="' + (720 + i * 84 - 30) + '" width="9000" height="18" fill="#FFFFFF" opacity="0.04"/>';
    // rail top surface edge with shine
    s += '<rect x="-3000" y="672" width="9000" height="30" fill="#D6DEE6"/><rect x="-3000" y="676" width="9000" height="8" fill="#FFFFFF" opacity="0.8"/>';
    s += '<rect x="-3000" y="702" width="9000" height="6" fill="#3B4650"/>';
    // faint magnifier caustics
    s += '<circle cx="1300" cy="300" r="900" fill="#FFFFFF" opacity="0.08"/>';
    return s;
  }
  function s2dynamic(t) {
    var s = "";
    var xs = V2S * Math.max(0, t - PUSH) + 280, xa = V2A * Math.max(0, t - PUSH) + 280;
    function disp(x, front, w, active) { if (!active) return 0; var d = (x - front) / w; return 24 * Math.exp(-d * d); }
    var on = t > PUSH;
    var hl = win(t, wordT(2, 13), wordT(2, 13) + 0.3) * (1 - win(t, PUSH - 0.1, PUSH + 0.2)); // "tightly linked" glow
    // lattice bonds + balls
    var pos = [];
    for (var r = 0; r < LAT.rows; r++) {
      pos.push([]);
      for (var c = 0; c < LAT.cols; c++) {
        var x = LAT.x0 + c * LAT.dx + (r % 2) * 0, y = LAT.y0 + r * LAT.dy;
        var jig = Math.sin(t * 9 + c * 1.7 + r * 2.3) * 2;
        pos[r].push({ x: x + disp(x, xs, 90, on) + jig, y: y + Math.cos(t * 8 + c + r) * 2, d: disp(x, xs, 90, on) });
      }
    }
    var bonds = "";
    for (var r2 = 0; r2 < LAT.rows; r2++) for (var c2 = 0; c2 < LAT.cols; c2++) {
      var p = pos[r2][c2];
      [[0, 1], [1, 0]].forEach(function (o) {
        var q = pos[r2 + o[0]] && pos[r2 + o[0]][c2 + o[1]]; if (!q) return;
        var g = Math.max(p.d, q.d) / 24;
        var col = g > 0.15 ? "#FFC23D" : hl > 0 ? "#FFE8A3" : "#A9B8C6";
        var wdt = 9 + g * 6 + hl * 3;
        bonds += '<line x1="' + f(p.x) + '" y1="' + f(p.y) + '" x2="' + f(q.x) + '" y2="' + f(q.y) + '" stroke="' + col + '" stroke-width="' + f(wdt) + '" stroke-linecap="round" opacity="' + (0.85).toFixed(2) + '"/>';
      });
    }
    s += bonds;
    for (var r3 = 0; r3 < LAT.rows; r3++) for (var c3 = 0; c3 < LAT.cols; c3++) {
      var b = pos[r3][c3];
      s += '<circle cx="' + f(b.x) + '" cy="' + f(b.y) + '" r="' + LAT.r + '" fill="url(#ball)" stroke="#36414B" stroke-width="3"/>';
      if (b.d > 4) s += '<circle cx="' + f(b.x) + '" cy="' + f(b.y) + '" r="' + (LAT.r + 8) + '" fill="#FFC23D" opacity="' + (b.d / 24 * 0.55).toFixed(2) + '"/>';
    }
    // air particles: drifting, far apart; the push crawls
    AIRP.forEach(function (a, i) {
      var x = a.x + Math.sin(t * 0.7 + a.ph) * 40, y = a.y + Math.cos(t * 0.9 + a.ph) * 26;
      var d = disp(x, xa, 120, on);
      x += d * 1.6;
      s += '<line x1="' + f(x - 50 - Math.cos(t + a.ph) * 20) + '" y1="' + f(y + 10) + '" x2="' + f(x - 30) + '" y2="' + f(y + 4) + '" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.6"/>';
      s += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="30" fill="url(#aball)" stroke="#1E40AF" stroke-width="3"/>';
      if (d > 4) s += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="42" fill="#FFC23D" opacity="' + (d / 24 * 0.5).toFixed(2) + '"/>';
    });
    // the push: a giant hammer face slides in from the left and taps both
    var hp = t - PUSH;
    var hx = 120 + (hp < -0.35 ? 0 : hp < 0 ? back((hp + 0.35) / 0.35) * 140 : 140 - easeOut(hp / 0.6) * 140) ;
    if (t > PUSH - 1.0) {
      var ha = win(t, PUSH - 1.0, PUSH - 0.6);
      s += '<g opacity="' + ha.toFixed(2) + '"><rect x="' + f(hx - 400) + '" y="60" width="400" height="1600" rx="40" fill="#525E6B" stroke="#1E242B" stroke-width="10"/><rect x="' + f(hx - 380) + '" y="80" width="60" height="1560" rx="20" fill="#A9B6C3" opacity="0.7"/></g>';
      if (hp > 0 && hp < 0.5) s += burst(hx + 160, 600, hp / 0.5, 1.0, "PUSH!");
    }
    return s;
  }
  var CAM2 = [
    { t: 0.0, x: 1100, y: 800, z: 2.6 },
    { t: 1.1, x: 1250, y: 360, z: 1.15 },    // up into the gas
    { t: 2.45, x: 1300, y: 330, z: 1.22 },
    { t: 3.2, x: 1100, y: 1000, z: 1.2 },    // down into the solid
    { t: 4.0, x: 1000, y: 980, z: 1.45 },    // push in on "tightly linked"
    { t: 4.85, x: 1300, y: 700, z: 0.84 },    // pull-out: both, for the push
    { t: 7.4, x: 1360, y: 710, z: 0.9 },
  ];
  var POSE2 = [
    { t: 0, pose: "point-left", expr: "curious" },
    { t: 2.5, pose: "talk", expr: "neutral" },
    { t: 3.5, pose: "point-left", expr: "happy" },
    { t: PUSH + 0.1, pose: "surprised", expr: "surprised" },
    { t: 5.6, pose: "point-left", expr: "happy" },
  ];
  var SIDE2 = { x: 1640, y: 1470, k: 0.9 };
  function overlay2(t, c) {
    var s = "";
    var pz = proj(c, 1100, 690);
    s += tag(pz.x, pz.y, "ZOOM", "inside the rail", "#64748B", win(t, 0.15, 0.45) * (1 - win(t, 1.6, 1.9)), 1, "up");
    var pa = proj(c, 1040, 250);
    s += tag(pa.x, pa.y, "GAS", "far apart", "#3B82F6", win(t, wordT(2, 6), wordT(2, 6) + 0.3) * (1 - win(t, 2.6, 2.9)), 1, "down");
    var pb = proj(c, LAT.x0 + 4 * LAT.dx, LAT.y0 + LAT.dy);
    s += tag(pb.x, pb.y, "SOLID", "tightly linked", "#F08C00", win(t, wordT(2, 13), wordT(2, 13) + 0.3) * (1 - win(t, 4.4, 4.7)), 1, "up");
    if (t > PUSH) {
      var xs = Math.min(V2S * (t - PUSH) + 280, 1640);
      var ps = proj(c, xs, 1100);
      s += tag(ps.x, ps.y, "STEEL", "fast!", "#F08C00", win(t, PUSH + 0.5, PUSH + 0.8), 1, "down");
      var xa = V2A * (t - PUSH) + 280;
      var pq = proj(c, xa + 150, 330);
      s += tag(pq.x, pq.y, "AIR", "slow…", "#3B82F6", win(t, PUSH + 0.9, PUSH + 1.2), 1, "down");
    }
    return s;
  }

  // ================================================================ SCENE 3: montage
  var SHOTS = [
    { t0: 0, t1: 0.78, wt: function (t) { return 5.0 + t * 0.6; }, cam: [{ t: 0, x: 1250, y: 960, z: 1.0 }, { t: 0.78, x: 1300, y: 960, z: 1.12 }], tag: ["AIR", "343 m/s", "#3B82F6"], at: function (wt) { var r = (wt - STRIKE1) * S1.vAir, an = -28 * Math.PI / 180; return [S1.strikeX + Math.cos(an) * r, S1.railNear + Math.sin(an) * r]; } },
    { t0: 0.78, t1: 1.5, wt: function (t) { return 7.3 + (t - 0.78) * 0.5; }, cam: [{ t: 0.78, x: 2050, y: 1300, z: 1.15 }, { t: 1.5, x: 2060, y: 1310, z: 1.3 }], tag: ["WATER", "≈1,480 m/s", "#0EA5E9"], at: function () { return [2240, 1400]; } },
    { t0: 1.5, t1: 3.4, wt: function (t) { return 9.42 + (t - 1.5) * 0.12; }, cam: [{ t: 1.5, x: 2350, y: 1040, z: 0.66 }, { t: 3.3, x: 2500, y: 1060, z: 0.86 }], tag: ["STEEL", "≈5,960 m/s · fastest", "#F08C00"], at: function (wt) { return [Math.min(S1.strikeX + (wt - STRIKE2) * S1.vSteel, S1.friendX - 60), S1.railNear - 10]; } },
  ];
  var POSE3 = [
    { t: 0, pose: "talk", expr: "happy" },
    { t: wordT(3, 4) - 0.1, pose: "celebrate", expr: "happy" },
  ];

  // ================================================================ mount
  function sceneRoot(id) {
    var clip = document.getElementById("scene-" + id);
    var el = document.createElement("div");
    el.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden";
    clip.appendChild(el);
    return el;
  }
  function layer(host, z) { var d = document.createElement("div"); d.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;z-index:" + z; host.appendChild(d); return d; }

  var sc = D.scenes;
  // scene 1
  var r1 = sceneRoot(1);
  var w1svg = makeSvg(layer(r1, 1));
  var world1 = mountRailWorld(w1svg, "w1");
  var ov1 = makeSvg(layer(r1, 3));
  var ov1g = svgEl(ov1, "");
  var act1 = layer(r1, 4);
  var cap1 = mountCaptions(layer(r1, 6), sc[0].words, 1140);
  var fade1 = layer(r1, 5);
  // scene 2
  var r2 = sceneRoot(2);
  var s2svg = makeSvg(layer(r2, 1));
  var cam2g = svgEl(s2svg, "");
  svgEl(cam2g, s2static());
  var dyn2 = svgEl(cam2g, "");
  var ov2g = svgEl(makeSvg(layer(r2, 3)), "");
  var act2 = layer(r2, 4);
  var fade2 = layer(r2, 5);
  var cap2 = mountCaptions(layer(r2, 6), sc[1].words, 780);
  // scene 3
  var r3 = sceneRoot(3);
  var world3 = mountRailWorld(makeSvg(layer(r3, 1)), "w3");
  var ov3g = svgEl(makeSvg(layer(r3, 3)), "");
  var act3 = layer(r3, 4);
  var fade3 = layer(r3, 5);
  var cap3 = mountCaptions(layer(r3, 6), sc[2].words, 1140);

  function fadeHtml(color, a) { return a > 0.001 ? '<div style="position:absolute;inset:0;background:' + color + ";opacity:" + a.toFixed(3) + '"></div>' : ""; }

  function update1(t) {
    var c = camAt(CAM1, t);
    world1.update(t, c);
    ov1g.innerHTML = overlay1(t, c);
    var pl = actorPlace1(t, c);
    var st = poseState(POSE1, t, sc[0].mouth, 1);
    st.walk = pl.walk; st.hammer = pl.hammer;
    var onScreen = pl.x > -600 && pl.x < 2500;
    act1.innerHTML = onScreen ? placeActor(st, pl.x, pl.y, pl.k, "actA") : "";
    fade1.innerHTML = fadeHtml("#8E9DAC", win(t, 11.55, 12.0));
    cap1(t);
  }
  function update2(t) {
    var c = camAt(CAM2, t);
    cam2g.setAttribute("transform", camTransform(c));
    dyn2.innerHTML = s2dynamic(t);
    ov2g.innerHTML = overlay2(t, c);
    var st = poseState(POSE2, t, sc[1].mouth, 2);
    st.walk = null; st.hammer = false;
    act2.innerHTML = placeActor(st, SIDE2.x, SIDE2.y, SIDE2.k, "actB");
    fade2.innerHTML = fadeHtml("#8E9DAC", 1 - win(t, 0, 0.4)) + fadeHtml("#FFFFFF", win(t, 7.15, 7.4));
    cap2(t);
  }
  function update3(t) {
    var sh = SHOTS[0];
    for (var i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i].t0) sh = SHOTS[i];
    var wt = sh.wt(t);
    var c = camAt(sh.cam, t);
    world3.update(wt, c, { noBursts: true });
    var at = sh.at(wt), p = proj(c, at[0], at[1]);
    var big = sh === SHOTS[2] ? 1.25 : 1.1;
    ov3g.innerHTML = tag(p.x, p.y, sh.tag[0], sh.tag[1], sh.tag[2], win(t, sh.t0 + 0.05, sh.t0 + 0.25), big, "up");
    var st = poseState(POSE3, t, sc[2].mouth, 3);
    st.walk = null; st.hammer = false;
    act3.innerHTML = placeActor(st, SIDE1.x, SIDE1.y, SIDE1.k, "actC");
    var flash = 0;
    SHOTS.forEach(function (s) { if (s.t0 > 0) flash = Math.max(flash, 1 - Math.abs(t - s.t0) / 0.12); });
    fade3.innerHTML = fadeHtml("#FFFFFF", Math.max(1 - win(t, 0, 0.3), clamp(flash, 0, 1) * 0.7)) + fadeHtml("#0B1220", win(t, 3.05, 3.3));
    cap3(t);
  }
  var ups = [update1, update2, update3];
  function render(t) {
    sc.forEach(function (s, i) {
      var on = t >= s.start && t < s.start + s.duration;
      if (on) { try { ups[i](t - s.start); } catch (e) { console.error("scene-" + s.id + ": " + e.message); } }
    });
  }
  var tl = window.HFKit.timeline("main");
  tl.eventCallback("onUpdate", function () { render(tl.time()); });
  tl.set({}, {}, D.total);
  render(0);
  window.__spikeRender = render;
})();
