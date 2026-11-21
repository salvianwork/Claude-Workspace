/* hf-kit foundation: style tokens, layout boxes and the timeline helper shared by every
 * HyperFrames composition. Plain script (no imports, no network): load it after
 * kit/vendor/gsap.min.js with <script src="kit/src/kit.js"></script>; it sets
 * globalThis.HFKit. Node tests import it for its side effect. */
(function (root) {
  "use strict";

  var CANVAS = { width: 1920, height: 1080, fps: 30 };

  /* Default look: the Remotion templates' dark navy + warm orange. */
  var tokens = {
    colors: {
      background: "#0F172A",
      surface: "#1E293B",
      primary: "#38BDF8",
      accent: "#F59E0B",
      text: "#F1F5F9",
    },
    fonts: {
      heading: '"Poppins", "Inter", sans-serif',
      body: '"Inter", "Poppins", sans-serif',
    },
    sizes: { title: 104, heading: 64, body: 40, caption: 40 },
    safe: 96, // text never comes closer than this to a frame edge
  };

  /* Height kept free at the bottom for two caption lines (same rule as Remotion). */
  function captionReserve(t) {
    t = t || tokens;
    return Math.round(t.sizes.caption * 1.35 * 2 + 28 + 36);
  }

  /* Top edge of the caption band: only captions may go below it. */
  function captionTop(t) {
    t = t || tokens;
    return CANVAS.height - t.safe - captionReserve(t);
  }

  /* Frames for a duration in seconds (ceil, guarded against float noise like 2.1 * 30). */
  function frames(seconds) {
    return Math.ceil(Math.round(seconds * CANVAS.fps * 1e6) / 1e6);
  }

  /* A paused GSAP timeline registered for the HyperFrames runtime under `id`. */
  function timeline(id, vars) {
    var g = root.gsap;
    if (!g) throw new Error("HFKit.timeline: load kit/vendor/gsap.min.js first");
    var tl = g.timeline(Object.assign({}, vars || {}, { paused: true }));
    root.__timelines = root.__timelines || {};
    root.__timelines[id] = tl;
    return tl;
  }

  /* Every kit script, in load order (paths relative to the kit folder). Props and hero modules
   * load after these (kit/props/<name>/prop.js, scenes/scene-<id>.js); composition.js only
   * needs them when mountComposition runs. */
  var SCRIPTS = [
    "src/kit.js", "src/timing.js",
    "src/presenter/look.js", "src/presenter/motion.js", "src/presenter/poses.js", "src/presenter/parts.js", "src/presenter/figure.js",
    "src/draw.js", "src/icons.js", "src/shell.js", "src/stage.js",
    "src/blocks/kinetic-center-build.js", "src/blocks/transitions.js",
    "src/scenes/common.js", "src/scenes/title.js", "src/scenes/steps.js", "src/scenes/compare.js", "src/scenes/chart.js",
    "src/scenes/kinetic.js", "src/scenes/recap.js", "src/scenes/diagram.js",
    "src/composition.js",
  ];

  root.HFKit = {
    version: "0.1.0",
    SCRIPTS: SCRIPTS,
    CANVAS: CANVAS,
    tokens: tokens,
    captionReserve: captionReserve,
    captionTop: captionTop,
    frames: frames,
    timeline: timeline,
  };
  /* timing.js (wordTime, cameraAt, cueState, captionPage) merges itself in; cover the
   * case where it was loaded first. */
  if (root.HFKitTiming) Object.assign(root.HFKit, root.HFKitTiming);
  /* Same for the presenter (src/presenter/*.js: look, motion, poses, parts, figure). */
  if (root.HFKitPresenter) {
    root.HFKit.presenter = root.HFKitPresenter;
    root.HFKit.mountPresenter = root.HFKitPresenter.mountPresenter;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
