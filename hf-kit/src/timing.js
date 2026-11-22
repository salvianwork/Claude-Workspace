/* hf-kit timing maths: word times, camera, cues and captions. Pure functions: no DOM, no GSAP.
 * Classic-script compatible (like kit.js) so it runs in the browser and under node --test.
 * Sets globalThis.HFKitTiming and merges into globalThis.HFKit (in either load order).
 * `source` fields of words.json are ignored here; only the times matter. */
(function (root) {
  "use strict";

  var FADE = 0.25; // seconds, cue fade in/out
  var DEFAULT_LIMITS = { maxZoom: 2.5, maxPanPerSec: 0.35, maxZoomPerSec: 0.6 };
  /* World scenes (places, Task 4): a bold but calm camera. Zoom 0.6x (pull-out reveal: the whole
   * 3840 x 2160 world fills the frame) to 5x (a push-in on one detail). The pan limit is the kit's
   * (0.35 origin widths x zoom per second at the eased peak: over the 3840-px world at frame scale 1
   * that is about 0.7 frame widths a second, energetic but never a whip pan). Zoom is a
   * MULTIPLICATIVE rate here (zoomMode "log"): zoom is eased in log space, and at the eased peak
   * it changes by at most 1.6x per second, i.e. |d ln z / dt| <= ln 1.6, the same feel at every
   * zoom. So 1x -> 2x takes 4.4 s, 0.6x -> 1.2x 4.4 s, 1x -> 5x 10.3 s; a cut is instant. minZoom
   * and zoomMode are only set here: the kit camera (DEFAULT_LIMITS) keeps its additive zoom rate
   * and never zooms out past 1. */
  var WORLD_LIMITS = { minZoom: 0.6, maxZoom: 5, maxPanPerSec: 0.35, maxZoomPerSec: 1.6, zoomMode: "log" };
  var LAG_TOL = 0.002; // a follow is "on target" when it lags by less than this (origin widths x zoom)

  /* Seconds for `at` = {word:i} (that word's start) or {t:sec}. words = one scene's array. */
  function wordTime(words, at, sceneId) {
    if (at && typeof at.t === "number") return at.t;
    var i = at && at.word;
    var w = (words || []).find(function (x) { return x.i === i; });
    if (!w) throw new Error("scene " + sceneId + ": no word " + i);
    return w.start;
  }

  function easeInOutCubic(u) {
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  }
  var EASE_PEAK = 3; // max slope of easeInOutCubic: peak speed = 3 x average speed

  var STEP = 1 / 60;   // fixed integration step of the pan follower (seconds)
  var RAMP = 0.5;      // seconds a slew move takes to reach its full pan speed
  var CAP_MARGIN = 0.99;
  var MAX_ARRIVAL = 120; // give up simulating arrival after this many seconds

  function checkFrame(frame, anchors) {
    if (frame === "wide") return null;
    if (!frame || typeof frame !== "object") return "has a malformed frame";
    var name = frame.focus !== undefined ? frame.focus : frame.follow;
    if (typeof name !== "string" || !name) return "has a malformed frame (needs focus or follow)";
    if (frame.zoom !== undefined && !(typeof frame.zoom === "number" && isFinite(frame.zoom) && frame.zoom > 0))
      return "has a malformed zoom";
    if (anchors && !anchors[name]) return "names an unknown anchor " + name;
    return null;
  }

  function camKeyTime(k, words, sceneId) {
    return k && typeof k.t === "number" && !k.at ? k.t : wordTime(words, k && k.at, sceneId);
  }

  /* camera shots.json entries [{at, frame, cut?}] (or {t, frame, cut?} with t in seconds) ->
   * [{t, frame, cut?}] using one scene's words, sorted by time (stable). cut: true makes the key
   * an instant cut (see cameraAt). Throws `scene <id>: camera key <k> ...` (k = position in the
   * input) for a malformed frame or cut or, when `anchors` is given, an unknown anchor name. */
  function resolveCamera(keys, words, sceneId, anchors) {
    return (keys || []).map(function (k, idx) {
      var bad = checkFrame(k && k.frame, anchors);
      if (!bad && k.cut !== undefined && typeof k.cut !== "boolean") bad = "has a malformed cut (true or false)";
      if (bad) throw new Error("scene " + sceneId + ": camera key " + idx + " " + bad);
      return { t: camKeyTime(k, words, sceneId), frame: k.frame, cut: k.cut === true, _i: idx };
    }).sort(function (a, b) { return a.t - b.t || a._i - b._i; })
      .map(function (k) { var o = { t: k.t, frame: k.frame }; if (k.cut) o.cut = true; return o; });
  }

  function anchorOf(anchors, name) {
    var a = anchors && anchors[name];
    if (!a) throw new Error("camera: unknown anchor " + name);
    return a;
  }

  function clampZoom(z, lim) {
    return Math.min(lim.maxZoom, Math.max(lim.minZoom === undefined ? 1 : lim.minZoom, z));
  }

  /* Zoom interpolation and the time a zoom change needs (peak counted): additive (kit) or
   * multiplicative (zoomMode "log": eased in log space, peak |d ln z/dt| <= ln maxZoomPerSec). */
  function zoomLerp(z0, z1, e, lim) { return lim.zoomMode === "log" ? z0 * Math.pow(z1 / z0, e) : z0 + (z1 - z0) * e; }
  function zoomTime(z0, z1, lim) {
    return lim.zoomMode === "log" ? EASE_PEAK * Math.abs(Math.log(z1 / z0)) / Math.log(lim.maxZoomPerSec) : EASE_PEAK * Math.abs(z1 - z0) / lim.maxZoomPerSec;
  }

  /* Shortest duration an eased move may take without breaking the limits (peak speed counted). */
  function minDuration(a, b, lim) {
    var pan = Math.hypot(b.x - a.x, b.y - a.y) * Math.max(a.zoom, b.zoom); // screen widths
    return Math.max(EASE_PEAK * pan / lim.maxPanPerSec, zoomTime(a.zoom, b.zoom, lim));
  }

  /* Slew-limited follower: integrates in fixed STEP increments from `S`, moving toward
   * target(t) by at most maxPanPerSec / zoom per second (screen widths), optionally ramping
   * up over RAMP. A pure function of t (positions are cached per segment, never random). */
  function makeFollower(S, p0, target, zoomAt, lim, ramp) {
    var pts = [{ x: p0.x, y: p0.y }];
    function advance(n) {
      while (pts.length <= n) {
        var j = pts.length - 1, t0 = S + j * STEP, t1 = t0 + STEP;
        var q = target(t1), p = pts[j];
        var z = Math.max(zoomAt(t0), zoomAt(t1));
        var r = ramp ? Math.min(1, (t0 + STEP / 2 - S) / RAMP) : 1;
        var cap = CAP_MARGIN * lim.maxPanPerSec / z * STEP * r;
        var dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        pts.push(d <= cap ? { x: q.x, y: q.y } : { x: p.x + dx / d * cap, y: p.y + dy / d * cap });
      }
    }
    return {
      pts: pts,
      advance: advance,
      at: function (t) {
        if (t <= S) return pts[0];
        var u = (t - S) / STEP, n = Math.floor(u);
        advance(n + 1);
        var f = u - n, a = pts[n], b = pts[n + 1];
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      },
    };
  }

  var cache = new WeakMap(); // keys -> anchors|NONE -> limits JSON -> built camera
  var NONE = {};

  function build(keys, anchors, lim) {
    var n = keys.length;
    var info = keys.map(function (k, i) {
      var fr = k.frame, name = fr === "wide" || !fr ? null : (fr.focus !== undefined ? fr.focus : fr.follow);
      var a = name === null ? { x: 0.5, y: 0.5 } : anchorOf(anchors, name);
      var fn = typeof a === "function";
      return {
        tracking: fn || (fr && fr.follow !== undefined),
        target: fn ? a : function () { return a; },
        // follow without zoom inherits the previous key's zoom
        zoom: name === null ? 1 : fr.zoom !== undefined ? clampZoom(fr.zoom, lim)
          : fr.follow !== undefined && i > 0 ? null : 1,
      };
    });
    info.forEach(function (k, i) { if (k.zoom === null) k.zoom = info[i - 1].zoom; });

    var segs = [];
    var t0 = keys[0].t, i0 = info[0];
    var f0 = makeFollower(t0, i0.target(t0), i0.target, function () { return i0.zoom; }, lim, false);
    segs.push({ S: t0, E: t0, zoom: function () { return i0.zoom; }, pos: i0.tracking ? f0.at : function () { return i0.target(t0); },
      follower: i0.tracking ? f0 : null, target: i0.target });

    for (var k = 1; k < n; k++) {
      var prev = segs[k - 1], S = prev.E, ki = info[k], kp = info[k - 1];
      var nominalEnd = Math.max(keys[k].t, S);
      var from, zFrom, zTo = ki.zoom, seg;
      if (keys[k].cut) { // instant: snap at the key's own time, interrupting any move still running
        var T = keys[k].t;
        for (var j = 0; j < k; j++) { if (segs[j].E > T) segs[j].E = T; if (segs[j].S > T) segs[j].S = T; }
        seg = (function (T, ki, zTo) {
          var p0 = ki.target(T), fc = ki.tracking ? makeFollower(T, p0, ki.target, function () { return zTo; }, lim, false) : null;
          return { S: T, E: T, cut: true, zoom: function () { return zTo; }, pos: fc ? fc.at : function () { return p0; }, follower: fc, target: ki.target };
        })(T, ki, zTo);
        segs.push(seg);
        continue;
      }
      from = prev.pos(S); zFrom = prev.zoom(S);
      if (!ki.tracking && !kp.tracking) {
        var to = ki.target(S);
        var E = Math.max(nominalEnd, S + minDuration({ x: from.x, y: from.y, zoom: zFrom }, { x: to.x, y: to.y, zoom: zTo }, lim));
        seg = (function (S, E, from, to, zFrom, zTo) {
          var e = function (t) { return easeInOutCubic(E > S ? Math.min(1, Math.max(0, (t - S) / (E - S))) : 1); };
          return {
            S: S, E: E,
            pos: function (t) { var u = e(t); return { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }; },
            zoom: function (t) { return zoomLerp(zFrom, zTo, e(t), lim); },
          };
        })(S, E, from, to, zFrom, zTo);
      } else {
        var zEnd = S + Math.max(nominalEnd - S, zoomTime(zFrom, zTo, lim));
        var zoomAt = (function (S, zEnd, zFrom, zTo) {
          return function (t) { return zoomLerp(zFrom, zTo, easeInOutCubic(zEnd > S ? Math.min(1, Math.max(0, (t - S) / (zEnd - S))) : 1), lim); };
        })(S, zEnd, zFrom, zTo);
        var fol = makeFollower(S, from, ki.target, zoomAt, lim, true);
        var End = zEnd;
        if (!ki.tracking) { // static target: the move ends when the follower has arrived
          var goal = ki.target(S), j = 0, tgt = goal;
          for (;;) {
            fol.advance(j + 1);
            var p = fol.pts[j + 1];
            if (Math.abs(p.x - tgt.x) < 1e-12 && Math.abs(p.y - tgt.y) < 1e-12) { j++; break; }
            j++;
            if (j * STEP > MAX_ARRIVAL) break;
          }
          End = Math.max(zEnd, S + j * STEP);
        }
        seg = { S: S, E: End, pos: fol.at, zoom: zoomAt, follower: ki.tracking ? fol : null, target: ki.target };
      }
      segs.push(seg);
    }
    return segs;
  }

  function getBuilt(keys, anchors, limits) {
    var lim = Object.assign({}, DEFAULT_LIMITS, limits || {});
    var a = anchors || NONE, lk = JSON.stringify([lim.minZoom, lim.maxZoom, lim.maxPanPerSec, lim.maxZoomPerSec, lim.zoomMode]);
    var byA = cache.get(keys);
    if (!byA) cache.set(keys, (byA = new WeakMap()));
    var byL = byA.get(a);
    if (!byL) byA.set(a, (byL = {}));
    return byL[lk] || (byL[lk] = build(keys, anchors, lim));
  }

  /* Camera pose {x, y, zoom} at time t. keys = [{t, frame}] sorted by t (see resolveCamera;
   * a keys array must not be mutated after its first use: results are cached per array);
   * frame = "wide" | {focus, zoom} | {follow, zoom?} (follow without zoom keeps the previous
   * key's zoom). anchors[name] = {x,y} or (t)=>({x,y}), normalised world 0..1.
   * Key k is where the move from key k-1 arrives.
   * - Static to static: easeInOutCubic on position and zoom. Peak speed (3x average) is held
   *   to the limits; a move that would be too fast keeps its start and has its end stretched
   *   later, and the next move starts when it ends (chained). Never a jump.
   * - Any move into or out of a follow / time-varying anchor: zoom is eased (and stretched) as
   *   above, position comes from a slew-limited follower (fixed 1/60 s steps from the move
   *   start, step cap maxPanPerSec/zoom, 0.5 s speed ramp-up) chasing the anchor path. The
   *   follower keeps tracking after the last key, so a fast anchor lags behind instead of
   *   breaking the pan limit. A move into a static target ends when the follower arrives.
   * - A key with cut: true is instant: at its own time t the camera snaps to the key's pose (no
   *   slew, no ease), interrupting any move still running; a cut onto a moving anchor then follows
   *   it. Later moves chain from the cut.
   * Zoom is clamped to [limits.minZoom (default 1), limits.maxZoom]; WORLD_LIMITS allow 0.6 to 5
   *   and ease zoom in log space with a multiplicative rate cap (zoomMode "log").
   * Before the first key the first pose is held. */
  function cameraAt(keys, t, anchors, limits) {
    if (!keys || !keys.length) return { x: 0.5, y: 0.5, zoom: 1 };
    var segs = getBuilt(keys, anchors, limits), seg = segs[0];
    for (var k = segs.length - 1; k > 0; k--) if (t >= segs[k].S) { seg = segs[k]; break; }
    if (t < segs[0].S) t = segs[0].S;
    var p = seg.pos(t);
    return { x: p.x, y: p.y, zoom: seg.zoom(t) };
  }

  /* Effective [{start, end}] (seconds) of every camera move (key k-1 -> k), after stretching
   * and chaining. */
  function cameraSchedule(keys, anchors, limits) {
    if (!keys || keys.length < 2) return [];
    return getBuilt(keys, anchors, limits).slice(1).map(function (s) { return { start: s.S, end: s.E }; });
  }

  /* Seconds by which the camera finishes after the scene ends (0 if none). The build step
   * (Task 6) fails a scene whose overrun is > 0.25 s and warns when it is above 0 but not
   * more than 0.25 s. When the last key follows a moving anchor, the camera is only finished once
   * it is on its target (lag below LAG_TOL): a target faster than the pan limit allows at that
   * zoom keeps the camera lagging, and that lag counts as overrun (up to MAX_ARRIVAL s). */
  function cameraOverrun(keys, anchors, limits, sceneDuration) {
    if (!keys || !keys.length) return 0;
    var sched = cameraSchedule(keys, anchors, limits);
    var over = sched.length ? Math.max(0, sched[sched.length - 1].end - sceneDuration) : 0;
    var segs = getBuilt(keys, anchors, limits), last = segs[segs.length - 1];
    if (last.follower) {
      var lagAt = function (t) { var p = last.pos(t), q = last.target(t); return Math.hypot(p.x - q.x, p.y - q.y) * last.zoom(t); };
      var t = Math.max(sceneDuration, last.S), limit = t + MAX_ARRIVAL;
      while (lagAt(t) >= LAG_TOL && t < limit) t += STEP;
      over = Math.max(over, t - sceneDuration);
    }
    return over;
  }

  /* Cues visible at t: [{target, opacity, progress, cue}] for every cue whose start <= t.
   * Fade-in over 0.25 s from the word start (progress = same ramp 0..1). Cues stay until
   * scene end, unless cue.until ({word:i}|{t}) is set: then opacity fades to 0 over 0.25 s
   * starting at that time (entry kept with opacity 0). target = cue.target, else cue.index. */
  function cueState(cues, words, t, sceneId) {
    var out = [];
    (cues || []).forEach(function (cue) {
      var s = wordTime(words, cue.at, sceneId);
      var e = cue.until ? wordTime(words, cue.until, sceneId) : null;
      if (s > t) return;
      var progress = Math.min(1, Math.max(0, (t - s) / FADE));
      var opacity = progress;
      if (e !== null && t > e) opacity = Math.min(opacity, Math.max(0, 1 - (t - e) / FADE));
      out.push({ target: cue.target !== undefined ? cue.target : cue.index, opacity: opacity, progress: progress, cue: cue });
    });
    return out;
  }

  /* Fixed pages of maxWords consecutive words (page k = words[k*max ..]). current = last word
   * with start <= t (-1 before the first). Returns the page holding it (first page if none):
   * {words: [...page], current: index within that page, -1 if no word of it has started}. */
  function captionPage(words, t, maxWords) {
    maxWords = maxWords || 10;
    words = words || [];
    if (!words.length) return { words: [], current: -1 };
    var cur = -1;
    for (var i = 0; i < words.length; i++) if (words[i].start <= t) cur = i; else break;
    var page = cur < 0 ? 0 : Math.floor(cur / maxWords);
    var from = page * maxWords;
    return { words: words.slice(from, from + maxWords), current: cur < 0 ? -1 : cur - from };
  }

  var api = {
    wordTime: wordTime,
    cameraAt: cameraAt,
    cueState: cueState,
    captionPage: captionPage,
    resolveCamera: resolveCamera,
    cameraSchedule: cameraSchedule,
    cameraOverrun: cameraOverrun,
    easeInOutCubic: easeInOutCubic,
    CAMERA_LIMITS: DEFAULT_LIMITS,
    WORLD_LIMITS: WORLD_LIMITS,
  };
  root.HFKitTiming = api;
  if (root.HFKit) Object.assign(root.HFKit, api);
})(typeof globalThis !== "undefined" ? globalThis : window);
