/* hf-kit composition runtime: mounts a whole video from the data tools/hf/build.py writes
 * (04-video/hf/data.json, also inlined in index.html) and registers window.__timelines.main.
 *
 *   HFKit.mountComposition(data)   // data = {fps, total, canvas?, style, presenterOutfit, scenes: [...]}
 *   data.canvas = {width, height} (tools/hf/build.py writes it for a vertical video, 1080 x 1920);
 *   without it the canvas is the 1920 x 1080 default. mountComposition calls HFKit.setCanvas first,
 *   so every scene mounts in the composition's size.
 *   scene = {id, kind: "hero"|"kit"|"world", start, duration, frames, prop?, params?, scene?, props?,
 *            world?, words, cues, camera, presenter, transition, next, mouth}
 *   kind "world" (shots.json schema 2): world = the shots.json scene ({id, place, variant, actors,
 *   beats, ...}); data.cast = the top-level cast. HFKit.mountWorld draws it (src/world/world.js);
 *   the host's mouth is the scene's mouth (the narration). Captions are mounted here as for every
 *   scene; world scenes have no side presenter (the host is an actor).
 *
 * Scenes run back to back in their own clip elements (#scene-<id> > .hf-scene). A scene's
 * `transition` is how it enters (first 0.5 s of its own time); it leaves with the next scene's
 * transition kind over its last 0.3 s, so transitions stay inside scene time. Everything is a
 * pure function of t (seekable). A scene that fails to mount or update is reported once with
 * console.error("scene-<id>: ...") (HyperFrames `check` counts console errors) and left blank;
 * the other scenes still play. mountComposition returns {timeline, render(t), mounted: [{s, el, api,
 * update(t)} | null]} (api = the scene's mount: a world scene's api.boxes(t) feeds the overlap
 * report). Classic script: load after every other kit script and the props. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.blocks || !K.scenes) throw new Error("composition.js: load the kit scripts first");

  var IN = 0.5, OUT = 0.3;

  /* Transition state for a scene at its own time t: entry `kind` over min(0.5, d/4) s, exit
   * `next` (or null: none) over the last min(0.3, d/4) s. */
  function transitionAt(kind, next, t, duration) {
    var s = { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 };
    function mix(o) { s.opacity *= o.opacity; s.x += o.x; s.y += o.y; s.scale *= o.scale; s.blur = Math.max(s.blur, o.blur); }
    var dIn = Math.min(IN, duration / 4), dOut = Math.min(OUT, duration / 4);
    if (kind && kind !== "cut" && t < dIn) mix(K.blocks.transition(kind, t / dIn, "in", 1));
    if (next && next !== "cut" && t > duration - dOut) mix(K.blocks.transition(next, (t - (duration - dOut)) / dOut, "out", 1));
    return s;
  }

  function mountComposition(data, opts) {
    opts = opts || {};
    var doc = opts.document || root.document;
    var cv = K.setCanvas(data.canvas);
    var reported = {};
    function report(id, what, e) {
      var msg = "scene-" + id + ": " + what + ": " + (e && e.message ? e.message : String(e));
      if (reported[msg]) return;
      reported[msg] = true;
      (root.console || console).error(msg);
    }
    var style = data.style || undefined;
    var mounted = (data.scenes || []).map(function (s) {
      var clip = doc.getElementById("scene-" + s.id);
      if (!clip) { report(s.id, "mount failed", new Error("no element #scene-" + s.id)); return null; }
      var el = doc.createElement("div");
      el.className = "hf-scene";
      el.style.cssText = "position:absolute;left:0;top:0;width:" + cv.width + "px;height:" + cv.height + "px;overflow:hidden;transform-origin:50% 50%";
      clip.appendChild(el);
      var parts;
      try {
        var common = { words: s.words, cues: s.cues, camera: s.camera, duration: s.duration, presenter: s.presenter, style: style, sceneId: s.id };
        var api = s.kind === "world"
          ? K.mountWorld(el, s.world, Object.assign({}, common, { mouth: s.mouth || [], cast: data.cast, captions: false }))
          : s.kind === "hero"
          ? K.mountHero(el, Object.assign({ prop: s.prop, params: s.params }, common))
          : (function () {
            if (!K.scenes[s.scene]) throw new Error("unknown kit scene " + s.scene);
            return K.scenes[s.scene].mount(el, Object.assign({ props: s.props }, common));
          })();
        var pr = s.presenter || {}, pres = null;
        if ((pr.position || "none") !== "none" && api.shell.layers.presenter) {
          pres = K.mountPresenter(api.shell.layers.presenter, { pose: pr.pose || "talk", expression: pr.expression || "happy",
            outfit: pr.outfit || data.presenterOutfit || "blazer", size: pr.size || "small", side: pr.position,
            mouth: s.mouth || [], fps: data.fps || 30, seed: s.id });
        }
        var caps = K.mountCaptions(api.shell.layers.captions, { words: s.words, style: style });
        if (s.kind === "world" && typeof api.boxes === "function" && K.isVertical()) { // the caption pill counts in the safe-zone and overlap reports
          var worldBoxes = api.boxes;
          api.boxes = function (t) {
            var out = worldBoxes(t), b = caps.box(t);
            if (b.width > 0) out.push({ kind: "caption", id: "caption", x: b.x, y: b.y, w: b.width, h: b.height });
            return out;
          };
        }
        parts = { api: api, pres: pres, caps: caps };
      } catch (e) {
        report(s.id, "mount failed", e);
        el.innerHTML = "";
        return null;
      }
      return {
        s: s, el: el, api: parts.api, // api.boxes(t) of a world scene: the overlap report (tools/hf/snapshot.py)
        update: function (t) {
          try {
            parts.api.update(t);
            if (parts.pres) parts.pres.update(t);
            parts.caps.update(t);
          } catch (e) { report(s.id, "update failed at " + t.toFixed(2) + " s", e); }
          var v = K.blocks.transitionCss(transitionAt(s.transition, s.next, t, s.duration));
          el.style.opacity = v.opacity; el.style.transform = v.transform; el.style.filter = v.filter;
        },
      };
    });
    function render(t) {
      mounted.forEach(function (m) {
        if (m && t >= m.s.start && t < m.s.start + m.s.duration) m.update(t - m.s.start);
      });
    }
    var tl = K.timeline("main");
    tl.eventCallback("onUpdate", function () { render(tl.time()); });
    tl.set({}, {}, data.total);
    render(0);
    return { timeline: tl, render: render, mounted: mounted };
  }

  K.compositionTransition = transitionAt;
  K.mountComposition = mountComposition;
})(typeof globalThis !== "undefined" ? globalThis : window);
