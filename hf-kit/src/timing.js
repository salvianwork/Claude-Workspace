/* hf-kit timing maths: word times, camera, cues and captions. Pure functions: no DOM, no GSAP.
 * Classic-script compatible (like kit.js) so it runs in the browser and under node --test.
 * Sets globalThis.HFKitTiming and merges into globalThis.HFKit (in either load order).
 * `source` fields of words.json are ignored here; only the times matter. */
(function (root) {
  "use strict";

  var FADE = 0.25; // seconds, cue fade in/out
  var DEFAULT_LIMITS = { maxZoom: 2.5, maxPanPerSec: 0.35, maxZoomPerSec: 0.6 };

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

  /* camera shots.json entries [{at, frame}] -> [{t, frame}] using one scene's words. */
  function resolveCamera(keys, words, sceneId) {
    return (keys || []).map(function (k) {
      return { t: wordTime(words, k.at, sceneId), frame: k.frame };
    });
  }

  function anchorAt(anchors, name, t) {
    var a = anchors && anchors[name];
    if (!a) throw new Error("camera: unknown anchor " + name);
    return typeof a === "function" ? a(t) : a;
  }

  /* Pose of one key at time t (follow keys track their anchor; others are constant). */
  function poseOf(frame, t, anchors, lim) {
    if (frame === "wide" || !frame) return { x: 0.5, y: 0.5, zoom: 1 };
    if (frame.follow !== undefined) {
      var f = anchorAt(anchors, frame.follow, t);
      return { x: f.x, y: f.y, zoom: clampZoom(frame.zoom === undefined ? 1 : frame.zoom, lim) };
    }
    var p = anchorAt(anchors, frame.focus, t);
    return { x: p.x, y: p.y, zoom: clampZoom(frame.zoom === undefined ? 1 : frame.zoom, lim) };
  }

  function clampZoom(z, lim) {
    return Math.min(lim.maxZoom, Math.max(1, z));
  }

  /* Shortest duration a move may take without breaking the limits (peak speed counted). */
  function minDuration(a, b, lim) {
    var pan = Math.hypot(b.x - a.x, b.y - a.y) * Math.max(a.zoom, b.zoom); // screen widths
    var dz = Math.abs(b.zoom - a.zoom);
    return EASE_PEAK * Math.max(pan / lim.maxPanPerSec, dz / lim.maxZoomPerSec);
  }

  /* Camera pose {x, y, zoom} at time t. keys = [{t, frame}] sorted by t (see resolveCamera);
   * frame = "wide" | {focus, zoom} | {follow, zoom?}. anchors[name] = {x,y} or (t)=>({x,y}),
   * normalised world 0..1. Key k is where the move from key k-1 ARRIVES, with easeInOutCubic.
   * Limits (peak speed): a move that would be too fast keeps its start time and has its end
   * stretched later; the next move then starts when that one ends (chained), so the camera
   * never jumps and never exceeds the limits. Before the first key the first pose is held;
   * after the last, the last pose (a follow key keeps tracking). */
  function cameraAt(keys, t, anchors, limits) {
    var lim = Object.assign({}, DEFAULT_LIMITS, limits || {});
    if (!keys || !keys.length) return { x: 0.5, y: 0.5, zoom: 1 };
    var pose = function (k, at) { return poseOf(k.frame, at, anchors, lim); };
    var start = keys[0].t; // effective start of the move into key k
    if (t <= start) return pose(keys[0], t);
    for (var k = 1; k < keys.length; k++) {
      var nominalEnd = Math.max(keys[k].t, start);
      var need = minDuration(pose(keys[k - 1], start), pose(keys[k], nominalEnd), lim);
      var end = Math.max(nominalEnd, start + need);
      if (t < end) {
        var u = end > start ? (t - start) / (end - start) : 1;
        var e = easeInOutCubic(Math.min(1, Math.max(0, u)));
        var a = pose(keys[k - 1], t), b = pose(keys[k], t);
        return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, zoom: a.zoom + (b.zoom - a.zoom) * e };
      }
      start = end;
    }
    return pose(keys[keys.length - 1], t);
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
    easeInOutCubic: easeInOutCubic,
    CAMERA_LIMITS: DEFAULT_LIMITS,
  };
  root.HFKitTiming = api;
  if (root.HFKit) Object.assign(root.HFKit, api);
})(typeof globalThis !== "undefined" ? globalThis : window);
