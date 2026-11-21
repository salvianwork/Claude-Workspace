/* Registry block port: scene transitions after "transitions-dissolve" (HyperFrames registry
 * 0.9.72, Apache-2.0; upstream copy in upstream/, notes in LICENSES.md): crossfade and blur
 * crossfade values from the block (blur 10 px, scale 0.97 in / 1.03 out, 0.5 s power2.inOut),
 * plus slide, zoom and cut in the same shape. No GSAP: transition(kind, u, phase) gives the
 * state for progress u (0..1) so a scene's entry/exit stays a pure function of t inside the
 * scene's own time. Classic script: load after kit.js. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K) throw new Error("transitions.js: load kit/src/kit.js first");
  K.blocks = K.blocks || {};

  var TRANSITIONS = ["cut", "fade", "blur", "slide", "zoom"];
  var DURATION = 0.5; // seconds, as in the block

  function power2InOut(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }

  /* State {opacity, x, y, scale, blur} for a scene entering (phase "in", u 0 -> 1 = hidden ->
   * shown) or leaving (phase "out", u 0 -> 1 = shown -> hidden). dir = 1 (from the right) or -1. */
  function transition(kind, u, phase, dir) {
    if (TRANSITIONS.indexOf(kind) < 0) throw new Error("unknown transition " + kind + " (have: " + TRANSITIONS.join(", ") + ")");
    u = Math.max(0, Math.min(1, u));
    var shown = phase === "out" ? 1 - power2InOut(u) : power2InOut(u); // 1 = fully shown
    var hidden = 1 - shown, d = dir || 1, out = phase === "out";
    var s = { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 };
    if (kind === "cut") { s.opacity = out ? (u >= 1 ? 0 : 1) : (u > 0 ? 1 : 0); return s; }
    s.opacity = shown;
    if (kind === "blur") { s.blur = 10 * hidden; s.scale = out ? 1 + 0.03 * hidden : 1 - 0.03 * hidden; }
    if (kind === "zoom") { s.scale = out ? 1 + 0.08 * hidden : 1 - 0.06 * hidden; s.blur = 4 * hidden; }
    if (kind === "slide") { s.x = (out ? -1 : 1) * d * 160 * hidden; s.opacity = Math.min(1, shown * 1.6); }
    return s;
  }

  /* CSS for an element from a transition state. */
  function css(s) {
    return { opacity: String(Math.round(s.opacity * 1000) / 1000), transform: "translate(" + s.x.toFixed(1) + "px," + s.y.toFixed(1) + "px) scale(" + s.scale.toFixed(4) + ")",
      filter: s.blur > 0.05 ? "blur(" + s.blur.toFixed(2) + "px)" : "none" };
  }

  K.blocks.TRANSITIONS = TRANSITIONS;
  K.blocks.TRANSITION_DURATION = DURATION;
  K.blocks.transition = transition;
  K.blocks.transitionCss = css;
})(typeof globalThis !== "undefined" ? globalThis : window);
