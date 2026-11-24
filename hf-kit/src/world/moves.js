/* hf-kit moves: the vocabulary of a world scene's beats (HFKit.MOVES) and the compiler that turns
 * them into actor tracks, effects, overlays and camera keys (HFKit.compileMoves). Pure: no DOM,
 * no randomness; runs in the browser and under node --test. Classic script: load after
 * world/effects.js and world/overlays.js; world/world.js mounts what this compiles.
 *
 *   HFKit.MOVES[name] = {group, required: [...], optional: [...], doc}     (hf-kit/MOVES.md)
 *   HFKit.worldFor(scene, {cast, duration?, customs?, effects?, places?}) -> world
 *       world = {anchors, paths, actors, effects: [names], customs, insides, place, variant, meta,
 *                duration, errors: [scene-level errors], fatal}
 *   HFKit.compileMoves(scene, words, world) -> {actors: {id: [{t, type, ...}]}, effects: [...],
 *       overlays: [...], camera: [{t, frame, cut?}], dives: [...], camAnchors, overrun, duration,
 *       errors: [...], warnings: [...] (allowed, but worth a look: an actor's head cut by the frame,
 *       a strike that slips past its word), point(name, t, part)}
 *       NOT JSON-safe: `point` and the tracking entries of `camAnchors` are functions (JSON drops
 *       them). Tools should read errors, warnings and overrun; world.js uses the rest.
 *   HFKit.actorAt(track, t) -> {visible, mode, x, y, scale, side, screen, u, state}   (the actor's
 *       position and rig state at t: a pure function of the compiled track)
 *   HFKit.worldCamera(compiled, t) -> {x, y, zoom, inside?, insideT?, params?, dive?}
 *   HFKit.validateWorld(scene, words, opts) -> errors[]   (scene checks + compile + camera overrun)
 *   HFKit.movesMarkdown() -> the text of hf-kit/MOVES.md
 *
 * Errors read "scene <id> beat <b> move <m> (<do>): <what>" (b and m count from 0).
 *
 * Timing. A beat starts at its `at` ({word: i} or {t: s}); a move's `at` defaults to its beat's.
 *  - Actor moves start at `at`; moves of one actor never overlap (a move waits for the one before).
 *    walk_to / run_to cruise at MOTION.walk (420) / MOTION.run (640) world px/s times the actor's
 *    scale, easing in and out over MOTION.ramp (0.3 s): duration = distance / speed + ramp. The
 *    walk cycle's phase advances by distance / (rig.STRIDE x px per body unit), so the feet never
 *    slide; the body turns into the walk and back to front over MOTION.turn (0.25 s).
 *  - `use` lands its action on its word (a hammer is raised 0.45 s before and strikes on it), but
 *    never before the actor has arrived: then it waits, and the beat's effects, tags and camera
 *    moves on the same word wait with it (the pulse leaves when the hammer hits).
 *    A strike that lands more than 0.5 s after its word is a warning with a fix ("start the walk_to
 *    earlier (at word N) or use run_to").
 *  - push_in / pull_out LAND on their `at` ("push in on 'fastest'"): the move starts as late as the
 *    limits allow, never before its beat starts. Without `at`, a push_in starts on its beat's strike
 *    (`use`), else with its beat, and runs alongside the action; a pull_out lands on the next beat's
 *    word (the last beat: 0.4 s before the scene ends). follow, cut and dive start at `at` (default:
 *    the beat's word).
 *  - The automatic camera: while an actor walks or runs and no camera move is running, the camera
 *    follows him; stepping out of the side slot he is framed at least 45 % of the frame height tall.
 *  - The host in the side slot talks while the narration speaks: his track carries the narration's
 *    spans ({type: "narration", spans}, from the words), and whenever no other pose runs he rests in
 *    the talk pose, gently varied (actorAt sets state.rest = {pose: "talk", k}; rig.js blends idle
 *    that far toward talk), instead of standing idle. Deterministic: a pure function of the words and t.
 *
 * Camera units (WORLD_LIMITS, confirmed): the camera works in normalised world units, world px
 * divided by 3840 on BOTH axes (so distances are isotropic and y runs 0 .. 0.5625). The pan limit
 * maxPanPerSec 0.6 x zoom is then 0.6 x 3840 = 2304 world px/s at zoom 1, which on screen is
 * 2304 px/s = 1.2 frame widths a second at the eased (sine) peak, at every zoom (world px/s =
 * 2304 / zoom). Zoom is multiplicative (<= 2.5x/s at the peak); a dive's push-in may zoom at up to
 * 4x/s (DIVE_LIMITS) because it ends in a cut. Move times come from timing.js (cameraMoveTime). The view never leaves the 3840 x 2160 world (focus points are clamped
 * for their zoom). */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.effects || !K.overlays || !K.cameraAt) throw new Error("world/moves.js: load the kit scripts first (timing, effects, overlays)");

  var WORLD = { width: 3840, height: 2160 }, NORM = 3840;
  // the frame is the composition canvas, read when the moves compile or the camera runs (not cached)
  function canvas() { return K.CANVAS; }
  var MOTION = { walk: 420, run: 640, ramp: 0.3, turn: 0.25 };
  var DIVE_LIMITS = Object.assign({}, K.WORLD_LIMITS, { maxZoomPerSec: 4 });
  var PULSE_SPEED = { slow: 600, medium: 1100, fast: 1800 }; // world px/s
  var GESTURE = 2.0, POINT = 2.2, JUMP = 1.0, POSE_IN = 0.25, POSE_OUT = 0.3, EXPR_IN = 0.3;
  var TITLE_WORDS = 6;
  // the side-slot host talks while the narration speaks: spans of words closer than TALK_GAP merge;
  // the talk rest eases in over TALK_IN before a span and out over TALK_OUT after it, at
  // TALK_K +- TALK_VARY (a slow, gentle swell, so a long talk never looks frozen)
  var TALK_GAP = 0.7, TALK_IN = 0.35, TALK_OUT = 0.45, TALK_K = 0.82, TALK_VARY = 0.18;
  var BODY = 700, TOP = 1270; // body units above the feet: the chest (camera, effects) and the head top (tags)

  // ---- the vocabulary -------------------------------------------------------------------------
  var COMMON = ["color", "size", "duration", "seed"];
  var FX = {
    burst: ["radius"],
    rings: ["count", "interval", "speed", "radius", "width", "squash", "arc"],
    pulse_along: ["trail", "ease"],
    speed_lines: ["angle", "edge", "length", "spread", "count"],
    splash: [],
    sparkle: ["radius", "count"],
    smoke: ["life", "wind", "rise"],
    glow: ["radius", "rays"],
  };
  var FX_DOC = {
    burst: "impact burst: flash, shock ring, spikes, debris",
    rings: "sound or energy waves spreading from the target",
    pulse_along: "a glowing pulse racing along a place path, `from` one anchor `to` another; `speed` slow | medium | fast | px/s. Tag it with target `pulse`",
    speed_lines: "streaks trailing a moving thing",
    splash: "a splash at a water surface",
    sparkle: "twinkling stars",
    smoke: "soft puffs rising",
    glow: "a soft breathing light",
  };
  function m(group, required, optional, doc) { return { group: group, required: required, optional: optional, doc: doc }; }
  var MOVES = {
    enter: m("actor", ["who"], ["side", "at"], "walk in from the frame edge (`side` left | right) to the actor's start; the actor is off stage until then"),
    exit: m("actor", ["who"], ["side", "at"], "walk out to the frame edge (`side` left | right) and leave"),
    walk_to: m("actor", ["who", "to"], ["at"], "walk to a place anchor (420 world px/s; feet never slide); from the side slot he steps into the world"),
    run_to: m("actor", ["who", "to"], ["at"], "run to a place anchor (640 world px/s)"),
    jump: m("actor", ["who"], ["at"], "jump in place (1 s)"),
    point: m("actor", ["who", "target"], ["at", "until"], "point at an anchor, actor or `pulse` (2.2 s)"),
    gesture: m("actor", ["who", "name"], ["at", "until"], "a pose for 2 s: " + "{GESTURES}"),
    react: m("actor", ["who", "expression"], ["at"], "change expression: " + "{EXPRESSIONS}"),
    hold: m("actor", ["who", "prop"], ["at"], "hold a prop from now on: " + "{PROPS}"),
    use: m("actor", ["who", "prop"], ["at"], "use a prop ON the word (hammer: raise, then strike on `at`). It waits until the actor has arrived; the beat's moves on the same word wait with it"),
    say: m("actor", ["who"], ["at", "until"], "talk (gestures follow the voice) until `until` or the beat's end"),
    tag_follow: m("overlay", ["target", "text"], ["at", "until"], "a data tag riding a point (an anchor, an actor, `pulse`): at most 4 words, a number and its unit count as one"),
    label: m("overlay", ["target", "text"], ["at", "until", "side"], "a name label on a thing (at most 4 words; `side` center | above | below | left | right)"),
    title: m("overlay", ["text"], ["at", "until"], "the video's one title (scene 1 only, at most 6 words)"),
    push_in: m("camera", ["target", "zoom"], ["at"], "push in on a target; it LANDS on its `at` word; without `at` it starts on the beat's strike (`use`), else with the beat, alongside the action"),
    pull_out: m("camera", ["zoom"], ["target", "from", "at"], "pull out to reveal; lands like push_in (as the scene's first move it opens tight, at `from` or 1.5x the zoom)"),
    follow: m("camera", ["target"], ["zoom", "at"], "follow a moving actor or `pulse` (slew-limited, never a whip pan). Walkers are followed by default while no camera move runs"),
    cut: m("camera", ["target"], ["zoom", "at"], "an instant cut to a target (after a dive: back out of the inside view)"),
    dive: m("camera", ["target", "into"], ["params", "zoom", "at"], "push in to zoom >= 3 (default 3.2, up to 3x/s) on the target, then cut to the inside view HFKit.insides[into]: {INSIDES}"),
    custom: m("custom", ["name"], ["params", "at", "until"], "a scene-specific piece: needs 04-video/hf/scenes/scene-<id>.js registering HFKit.customs[name]"),
  };
  Object.keys(FX).forEach(function (name) {
    var opt = name === "pulse_along" ? ["from", "to", "speed", "at"] : ["target", "path", "from", "at"];
    MOVES[name] = m("effect", name === "pulse_along" ? ["path"] : [], opt.concat(COMMON, FX[name]), FX_DOC[name] + (name === "pulse_along" ? "" : " (at `target`, or the start of `path`)"));
  });
  // the pinned table's order
  var ORDER = ["enter", "exit", "walk_to", "run_to", "jump", "point", "gesture", "react", "hold", "use", "say",
    "burst", "rings", "pulse_along", "speed_lines", "splash", "sparkle", "smoke", "glow", "tag_follow", "label", "title",
    "push_in", "pull_out", "follow", "cut", "dive", "custom"];
  var ORDERED = {};
  ORDER.forEach(function (n) { ORDERED[n] = MOVES[n]; });
  MOVES = ORDERED;

  // ---- small maths ----------------------------------------------------------------------------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sm(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function z0(v) { return v === 0 ? 0 : v; } // no -0
  function num(v) { return typeof v === "number" && isFinite(v); }
  function rig() { return K.rig; }
  function worldK() { return (root.HFKitActor && root.HFKitActor.WORLD_K) || 0.3; }
  function toScreen(p, cam) { return { x: (p.x - cam.x) * cam.zoom + canvas().width / 2, y: (p.y - cam.y) * cam.zoom + canvas().height / 2 }; }
  function unproject(s, cam) { return { x: cam.x + (s.x - canvas().width / 2) / cam.zoom, y: cam.y + (s.y - canvas().height / 2) / cam.zoom }; }
  /* The focus point a camera at zoom z may use, so the view stays inside the world. */
  function clampFocus(p, z) {
    var hx = canvas().width / 2 / z, hy = canvas().height / 2 / z;
    return { x: clamp(p.x, Math.min(hx, WORLD.width / 2), Math.max(WORLD.width - hx, WORLD.width / 2)), y: clamp(p.y, Math.min(hy, WORLD.height / 2), Math.max(WORLD.height - hy, WORLD.height / 2)) };
  }
  function norm(p) { return { x: p.x / NORM, y: p.y / NORM }; }
  function denorm(c) { return { x: c.x * NORM, y: c.y * NORM, zoom: c.zoom }; }

  /* Distance covered after tau seconds of a move of D px at cruise speed v (T = D / v + ramp):
   * smoothstep speed ramps at both ends, so the start and the stop never jerk. */
  function travelled(tau, D, v, T) {
    var R = MOTION.ramp;
    if (tau <= 0) return 0;
    if (tau >= T) return D;
    if (D < v * R) return D * sm(tau / T);
    var ramp = function (x) { return v * R * (x * x * x - x * x * x * x / 2); };
    if (tau < R) return ramp(tau / R);
    if (tau > T - R) return D - ramp((T - tau) / R);
    return v * R / 2 + v * (tau - R);
  }

  /* The narration's speaking spans [[start, end], ...] from a scene's words: words closer than
   * TALK_GAP s join one span. */
  function narrationSpans(words) {
    var spans = [];
    (words || []).filter(function (w) { return w && num(w.start); }).sort(function (a, b) { return a.start - b.start; }).forEach(function (w) {
      var end = num(w.end) ? Math.max(w.end, w.start) : w.start + 0.2, last = spans[spans.length - 1];
      if (last && w.start - last[1] < TALK_GAP) last[1] = Math.max(last[1], end);
      else spans.push([w.start, end]);
    });
    return spans;
  }
  /* How much the side-slot host talks at t (0..1): eased in before a span, out after it. */
  function talkWeight(spans, t) {
    var w = 0;
    for (var i = 0; i < spans.length; i++) w = Math.max(w, Math.min(sm((t - spans[i][0] + 0.1) / TALK_IN), sm((spans[i][1] + TALK_OUT - t) / TALK_OUT)));
    return w;
  }

  // ---- the world a scene compiles against ------------------------------------------------------
  function worldFor(scene, opts) {
    opts = opts || {};
    scene = scene || {};
    var sid = scene.id, errors = [];
    var places = opts.places || K.places || {};
    var P = places[scene.place];
    var w = {
      place: scene.place, variant: scene.variant, meta: P ? P.meta : null, anchors: {}, paths: {}, actors: {},
      effects: opts.effects || Object.keys(K.effects), customs: opts.customs || K.customs || {}, insides: opts.insides || K.insides || {},
      duration: opts.duration, errors: errors, fatal: false,
    };
    if (!P) { errors.push("scene " + sid + ": unknown place \"" + scene.place + "\""); w.fatal = true; return w; }
    var a;
    try { a = P.anchorsFor({ variant: scene.variant, seed: sid }); } catch (e) { errors.push("scene " + sid + ": " + e.message); w.fatal = true; return w; }
    w.variant = scene.variant === undefined ? P.meta.variants[0] : scene.variant;
    w.anchors = a.anchors; w.paths = a.paths;
    var cast = opts.cast;
    if (cast !== undefined && !(Array.isArray(cast) && cast.some(function (c) { return c && c.character === "host"; }))) errors.push("cast: needs the host (character \"host\")");
    var actorScale = P.meta.actorScale || 1;
    (scene.actors || []).forEach(function (sa) {
      var tag = "scene " + sid + " actor " + (sa && sa.id);
      if (!sa || typeof sa.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(sa.id)) { errors.push(tag + ": needs a plain id"); return; }
      if (w.actors[sa.id]) { errors.push(tag + ": listed twice"); return; }
      var ce = (cast || []).find(function (c) { return c && c.id === sa.id; });
      var character = sa.character || (ce && ce.character) || (cast === undefined && sa.id === "host" ? "host" : null);
      if (!character) { errors.push(tag + ": not in the cast (add it to \"cast\", or give it a character \"extra-<n>\")"); return; }
      if (character !== "host" && !/^extra-\d+$/.test(character)) { errors.push(tag + ": character must be host or extra-<n> (got \"" + character + "\")"); return; }
      var ch = K.cast.resolve(character);
      var outfit = sa.outfit || (ce && ce.outfit) || ch.defaultOutfit || "blazer";
      if (!rig().OUTFITS[outfit]) { errors.push(tag + ": unknown outfit \"" + outfit + "\""); return; }
      var start = sa.start || (character === "host" ? { slot: "right" } : null);
      if (!start) { errors.push(tag + ": needs a start ({slot} or {anchor})"); return; }
      if (start.slot !== undefined) {
        if (start.slot !== "left" && start.slot !== "right") { errors.push(tag + ": slot must be left or right (got \"" + start.slot + "\")"); return; }
      } else if (!w.anchors[start.anchor]) { errors.push(tag + ": unknown anchor \"" + start.anchor + "\""); return; }
      w.actors[sa.id] = { id: sa.id, character: character, outfit: outfit, start: start, scale: actorScale * (sa.scale || 1), host: character === "host" };
    });
    return w;
  }

  // ---- parsing and checks ---------------------------------------------------------------------
  function timeOf(at, words, duration) {
    if (at && num(at.t)) {
      if (at.t < 0) return { err: "at " + at.t + " s is before the scene starts" };
      if (at.t > duration + 1e-9) return { err: "at " + at.t.toFixed(2) + " s is after the scene ends (" + duration.toFixed(2) + " s)" };
      return { t: at.t };
    }
    if (!at || typeof at !== "object" || at.word === undefined) return { err: "at must be {word: i} or {t: seconds}" };
    var w = (words || []).find(function (x) { return x.i === at.word; });
    if (!w) return { err: "no word " + at.word + " in this scene" };
    return { t: w.start };
  }

  function sceneDuration(scene, words, world) {
    if (world && num(world.duration)) return world.duration;
    if (num(scene.duration)) return scene.duration;
    var last = (words || []).reduce(function (a, w) { return Math.max(a, num(w.end) ? w.end : w.start || 0); }, 0);
    return last + 0.5;
  }

  /* Static checks of one move; returns an error string or null. */
  function checkMove(mv, world, ctx) {
    var def = MOVES[mv.do];
    if (!def) return "unknown move \"" + mv.do + "\"";
    var allowed = ["do"].concat(def.required, def.optional);
    for (var k in mv) if (allowed.indexOf(k) < 0) return "unknown parameter \"" + k + "\"";
    for (var i = 0; i < def.required.length; i++) if (mv[def.required[i]] === undefined) return "missing \"" + def.required[i] + "\"";
    if (def.group === "effect" && world.effects.indexOf(mv.do) < 0) return "unknown effect \"" + mv.do + "\"";
    if (mv.who !== undefined && !world.actors[mv.who]) return "unknown actor \"" + mv.who + "\"";
    var anchorErr = function (n) { return world.anchors[n] ? null : "unknown anchor \"" + n + "\""; };
    var targetErr = function (n) {
      if (world.anchors[n] || world.actors[n]) return null;
      if (n === "pulse") return ctx.hasPulse ? null : "unknown target \"pulse\" (no pulse_along in this scene)";
      return "unknown target \"" + n + "\"";
    };
    var e = null, R = rig();
    switch (mv.do) {
      case "walk_to": case "run_to": e = anchorErr(mv.to); break;
      case "enter": case "exit": if (mv.side !== undefined && mv.side !== "left" && mv.side !== "right") e = "side must be left or right (got \"" + mv.side + "\")"; break;
      case "point": e = targetErr(mv.target); break;
      case "gesture": if (!R.POSES[mv.name] || mv.name === "idle") e = "unknown gesture \"" + mv.name + "\""; break;
      case "react": if (!R.EXPRESSIONS[mv.expression]) e = "unknown expression \"" + mv.expression + "\""; break;
      case "hold": case "use": if (!R.HELD[mv.prop]) e = "unknown prop \"" + mv.prop + "\""; break;
      case "tag_follow": case "label": case "title":
        if (mv.target !== undefined) e = targetErr(mv.target);
        if (!e) {
          var max = mv.do === "title" ? TITLE_WORDS : K.overlays.MAX_WORDS;
          if (typeof mv.text !== "string" || !mv.text.trim()) e = "needs text";
          else { var n = K.overlays.countWords(mv.text); if (n > max) e = "text \"" + mv.text + "\" has " + n + " words (at most " + max + ")"; }
        }
        if (!e && mv.do === "title" && ctx.sceneId !== 1) e = "a title belongs in scene 1 only";
        if (!e && mv.do === "label" && mv.side !== undefined && ["center", "above", "below", "left", "right"].indexOf(mv.side) < 0) e = "side must be center, above, below, left or right";
        break;
      case "push_in": case "pull_out": case "follow": case "cut": case "dive":
        if (mv.target !== undefined) e = targetErr(mv.target);
        if (!e && mv.zoom !== undefined && !(num(mv.zoom) && mv.zoom >= K.WORLD_LIMITS.minZoom && mv.zoom <= K.WORLD_LIMITS.maxZoom)) e = "zoom " + mv.zoom + " is outside " + K.WORLD_LIMITS.minZoom + " to " + K.WORLD_LIMITS.maxZoom;
        if (!e && mv.from !== undefined && !(num(mv.from) && mv.from >= K.WORLD_LIMITS.minZoom && mv.from <= K.WORLD_LIMITS.maxZoom)) e = "from " + mv.from + " is outside " + K.WORLD_LIMITS.minZoom + " to " + K.WORLD_LIMITS.maxZoom;
        if (!e && mv.do === "dive") {
          if (mv.zoom !== undefined && mv.zoom < 3) e = "a dive zooms to at least 3 (got " + mv.zoom + ")";
          else if (!world.insides[mv.into]) e = "unknown inside \"" + mv.into + "\"";
          else if (world.insides[mv.into].check) e = world.insides[mv.into].check(mv.params);
        }
        break;
      case "custom":
        if (!world.customs[mv.name]) e = "no HFKit.customs[\"" + mv.name + "\"] (register it in 04-video/hf/scenes/scene-" + ctx.sceneId + ".js)";
        break;
      default: // effects (jump and say need nothing more)
        if (def.group !== "effect") break;
        if (mv.target !== undefined) e = targetErr(mv.target);
        if (!e && mv.path !== undefined && !world.paths[mv.path]) e = "unknown path \"" + mv.path + "\"";
        if (!e && mv.from !== undefined) e = anchorErr(mv.from);
        if (!e && mv.to !== undefined) e = anchorErr(mv.to);
        if (!e && mv.do !== "pulse_along" && mv.target === undefined && mv.path === undefined) e = "needs a target or a path";
        if (!e && mv.do === "pulse_along" && mv.speed !== undefined && !PULSE_SPEED[mv.speed] && !(num(mv.speed) && mv.speed > 0)) e = "speed must be slow, medium, fast or px/s (got \"" + mv.speed + "\")";
    }
    return e;
  }

  // ---- actor tracks ---------------------------------------------------------------------------
  function slotScale() { return rig().SLOT.k / worldK(); }

  /* Size along a move (u = fraction of the distance): perspective-like, 1 / size changes evenly with
   * the distance; stepping out of the side slot he reaches his world size within the first 25 %. */
  function scaleOf(move, u) {
    var k0 = move.from.scale, k1 = move.to.scale;
    if (Math.abs(k1 - k0) < 1e-9) return k0;
    var e = move.step ? sm(Math.min(1, u / 0.25)) : u;
    return 1 / (1 / k0 + (1 / k1 - 1 / k0) * e);
  }
  /* Cycle phase after s px of a move: distance / (stride x px per body unit), integrated over a
   * changing size (Simpson, 32 steps), so the feet never slide. strideK = STRIDE x WORLD_K. */
  function phaseOf(move, u, s, strideK) {
    var k0 = move.from.scale, k1 = move.to.scale;
    if (Math.abs(k1 - k0) < 1e-9) return s / (strideK * k0);
    var N = 32, h = u / N, acc = 0;
    for (var i = 0; i <= N; i++) acc += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) / scaleOf(move, i * h);
    return move.dist * acc * h / 3 / strideK;
  }

  /* Position and rig state of an actor at t from its compiled track. Pure. */
  function actorAt(track, t) {
    var R = rig(), SLOT = R.SLOT, WK = worldK();
    var r = { visible: true, mode: "world", x: 0, y: 0, scale: 1, side: null, screen: null, u: 1 };
    var st = { pose: "idle", expression: "happy", facing: 0, turn: 0, cycleAmount: 0 };
    var poses = [], exprs = [], held, speaking = null, move = null, jump = null, narration = null;
    for (var i = 0; i < track.length; i++) {
      var ev = track[i];
      if (ev.t > t + 1e-12) break;
      switch (ev.type) {
        case "start":
          r.visible = !ev.hidden;
          r.scale = ev.scale;
          if (ev.mode === "slot") { r.mode = "slot"; r.side = ev.side; r.screen = { x: SLOT[ev.side], y: SLOT.feetY }; }
          else { r.mode = "world"; r.x = ev.x; r.y = ev.y; }
          if (ev.expression) st.expression = ev.expression;
          break;
        case "show": r.visible = true; break;
        case "hide": r.visible = false; break;
        case "move": move = ev; break;
        case "pose": poses.push(ev); break;
        case "expression": exprs.push(ev); break;
        case "held": held = ev.held; break;
        case "jump": jump = ev; break;
        case "say": speaking = ev; break;
        case "narration": narration = ev; break;
      }
    }
    if (move) {
      var T = move.t1 - move.t, tau = t - move.t, D = move.dist;
      var s = travelled(tau, D, move.v, T), u = D > 0 ? s / D : 1;
      var k0 = move.from.scale, k1 = move.to.scale;
      var lerp = function (a, b) { return a + (b - a) * u; };
      if (move.space === "screen") { // in the side slot (entering or leaving the frame)
        r.mode = "slot"; r.side = move.side; r.screen = { x: lerp(move.from.x, move.to.x), y: SLOT.feetY }; r.scale = k0;
      } else {
        r.mode = move.step && u < 1 ? "step" : "world"; r.side = move.step || null; r.u = u;
        r.x = lerp(move.from.x, move.to.x); r.y = lerp(move.from.y, move.to.y); r.scale = scaleOf(move, u);
      }
      var phase = phaseOf(move, u, s, R.STRIDE[move.gait] * WK);
      var turnIn = sm(tau / MOTION.turn), turnOut = 1 - sm((tau - (T - 0.05)) / MOTION.turn);
      var turn = Math.min(turnIn, turnOut);
      if (turnOut > 0) {
        st.facing = move.dir;
        st.turn = z0(move.dir * turn);
        if (tau < T) {
          st.cycle = move.gait; st.phase = phase;
          st.cycleAmount = Math.min(sm(tau / MOTION.ramp), sm((T - tau) / MOTION.ramp));
        }
      }
    }
    if (jump && t < jump.t1) {
      st.cycle = "jump"; st.phase = clamp((t - jump.t) / (jump.t1 - jump.t), 0, 1); st.cycleAmount = 1;
    }
    // pose: the latest pose event; it blends in, holds, then blends back to idle
    var pose = "idle", fromPose = "idle", kp = 1;
    if (poses.length) {
      var pe = poses[poses.length - 1], prev = poses.length > 1 ? poses[poses.length - 2] : null;
      var prevPose = prev && prev.t1 > pe.t ? prev.pose : "idle";
      if (t < pe.t1) { pose = pe.pose; fromPose = prevPose; kp = clamp((t - pe.t) / (pe.blendIn || POSE_IN), 0, 1); }
      else { pose = "idle"; fromPose = pe.pose; kp = clamp((t - pe.t1) / POSE_OUT, 0, 1); }
    }
    var expr = st.expression, fromExpr = expr, ke = 1;
    if (exprs.length) {
      var xe = exprs[exprs.length - 1];
      expr = xe.expression; fromExpr = exprs.length > 1 ? exprs[exprs.length - 2].expression : st.expression;
      ke = clamp((t - xe.t) / EXPR_IN, 0, 1);
    }
    st.pose = pose; st.expression = expr;
    var k = Math.min(kp, ke);
    if (k < 1) st.blend = { pose: kp < 1 ? fromPose : pose, expression: ke < 1 ? fromExpr : expr, k: k };
    // the side-slot host talks while the narration speaks: with no other pose running he rests in
    // the talk pose (gently varied) instead of idle; moves.js gives him the spans (see compileMoves)
    if (narration && r.mode === "slot" && r.visible && !st.cycle) {
      var tw = talkWeight(narration.spans, t);
      if (tw > 0) st.rest = { pose: "talk", k: Math.round(tw * (TALK_K + TALK_VARY * Math.sin(t * 2.1 + 0.7)) * 1000) / 1000 };
    }
    if (held) st.held = held;
    st.speaking = !!(speaking && t < speaking.t1);
    r.state = st;
    return r;
  }

  /* Build every actor's track. camFn(t) -> {x, y, zoom} (world px) places frame edges and the side
   * slot in the world. Returns {tracks, errors}. */
  function buildTracks(world, actorMoves, camFn, narration) {
    var R = rig(), SLOT = R.SLOT, WK = worldK(), tracks = {}, busy = {}, errors = [];
    Object.keys(world.actors).forEach(function (id) {
      var a = world.actors[id], st = a.start;
      var entersFirst = actorMoves.some(function (p) { return p.mv.who === id && p.mv.do === "enter"; }) &&
        actorMoves.filter(function (p) { return p.mv.who === id; })[0].mv.do === "enter";
      var ev = { t: 0, type: "start", hidden: entersFirst };
      if (st.slot) { ev.mode = "slot"; ev.side = st.slot; ev.scale = a.scale; }
      else { var p = world.anchors[st.anchor](0); ev.mode = "world"; ev.x = p.x; ev.y = p.y; ev.scale = a.scale * (p.scale || 1); }
      tracks[id] = [ev];
      if (a.host && narration && narration.length) tracks[id].push({ t: 0, type: "narration", spans: narration });
      busy[id] = 0;
    });
    function sortTrack(tr) { return tr.map(function (e, i) { return [e, i]; }).sort(function (a, b) { return a[0].t - b[0].t || a[1] - b[1]; }).map(function (x) { return x[0]; }); }
    function edgeX(cam, side, scale) { // just outside the frame, in world px
      var half = 360 * WK * scale; // half the drawn figure, so it is fully off frame
      return side === "left" ? cam.x - canvas().width / 2 / cam.zoom - half : cam.x + canvas().width / 2 / cam.zoom + half;
    }
    function moveEv(t0, gait, space, from, to, extra) {
      var dist = space === "screen" ? Math.abs(to.x - from.x) : Math.hypot(to.x - from.x, to.y - from.y);
      var speed = MOTION[gait] * (space === "screen" ? slotScale() : to.scale);
      var e = { t: t0, t1: t0 + dist / speed + MOTION.ramp, type: "move", gait: gait, space: space, from: from, to: to, dist: dist, v: speed,
        dir: to.x >= from.x ? 1 : -1 };
      return Object.assign(e, extra || {});
    }
    actorMoves.forEach(function (p) {
      var mv = p.mv, id = mv.who, tr = tracks[id];
      if (!tr) return;
      var sorted = sortTrack(tr);
      var now = function (t) { return actorAt(sorted, t); };
      var t0 = Math.max(p.t, busy[id]), cur = now(t0), cam = camFn(t0), e;
      switch (mv.do) {
        case "walk_to": case "run_to": {
          var gait = mv.do === "walk_to" ? "walk" : "run", q = world.anchors[mv.to](t0);
          var to = { x: q.x, y: q.y, scale: world.actors[id].scale * (q.scale || 1) };
          if (!cur.visible) { errors.push([p, "\"" + id + "\" is off stage (enter first)"]); return; }
          var from, extra = {};
          if (cur.mode === "slot") { // step out of the side slot into the world
            // in the world he starts under the slot, on the ground line he walks along; on screen
            // world.js blends him from the slot (feet below the frame) up into the scene
            var f = unproject(cur.screen, cam);
            from = { x: f.x, y: to.y, scale: slotScale() / cam.zoom };
            extra.step = cur.side;
          } else from = { x: cur.x, y: cur.y, scale: cur.scale };
          e = moveEv(t0, gait, "world", from, to, extra);
          if (e.dist < 1) return;
          tr.push(e); busy[id] = e.t1; p.done = e.t1;
          return;
        }
        case "enter": {
          if (cur.visible) { errors.push([p, "\"" + id + "\" is already on stage"]); return; }
          var start = sorted[0];
          if (cur.mode === "slot" || start.mode === "slot") {
            var sideS = mv.side || cur.side || start.side;
            var fx = sideS === "left" ? -420 : canvas().width + 420;
            tr.push({ t: t0, type: "show" });
            e = moveEv(t0, "walk", "screen", { x: fx, scale: slotScale() }, { x: SLOT[start.side], scale: slotScale() }, { side: start.side });
          } else {
            var dest = { x: cur.x, y: cur.y, scale: cur.scale };
            var side = mv.side || (toScreen(dest, cam).x < canvas().width / 2 ? "left" : "right");
            tr.push({ t: t0, type: "show" });
            e = moveEv(t0, "walk", "world", { x: edgeX(cam, side, dest.scale), y: dest.y, scale: dest.scale }, dest);
          }
          tr.push(e); busy[id] = e.t1; p.done = e.t1;
          return;
        }
        case "exit": {
          if (!cur.visible) { errors.push([p, "\"" + id + "\" is not on stage"]); return; }
          if (cur.mode === "slot") {
            var sx = (mv.side || cur.side) === "left" ? -420 : canvas().width + 420;
            e = moveEv(t0, "walk", "screen", { x: cur.screen.x, scale: slotScale() }, { x: sx, scale: slotScale() }, { side: cur.side });
          } else {
            var here = { x: cur.x, y: cur.y, scale: cur.scale };
            var sd = mv.side || (toScreen(here, cam).x < canvas().width / 2 ? "left" : "right");
            e = moveEv(t0, "walk", "world", here, { x: edgeX(cam, sd, cur.scale), y: cur.y, scale: cur.scale });
          }
          tr.push(e); tr.push({ t: e.t1, type: "hide" }); busy[id] = e.t1; p.done = e.t1;
          return;
        }
        case "jump":
          tr.push({ t: t0, t1: t0 + JUMP, type: "jump" }); busy[id] = t0 + JUMP; p.done = t0 + JUMP;
          return;
        case "point": {
          // another actor as the target: the first pass has no tracks yet, so use where he starts
          var tp = p.targetPoint(p.t, "body"), ta = world.actors[mv.target];
          if (!tp && ta && ta.start.anchor) tp = world.anchors[ta.start.anchor](p.t);
          var me = cur.mode === "slot" ? cur.screen : toScreen(cur, cam);
          var ts = !tp ? { x: me.x + 1 } : tp.screen ? tp : toScreen(tp, cam);
          tr.push({ t: p.t, t1: p.until || p.t + POINT, type: "pose", pose: ts.x >= me.x ? "point-right" : "point-left" });
          return;
        }
        case "gesture":
          tr.push({ t: p.t, t1: p.until || p.t + (mv.name === "wave" ? 2.4 : GESTURE), type: "pose", pose: mv.name });
          return;
        case "react": tr.push({ t: p.t, type: "expression", expression: mv.expression }); return;
        case "hold": tr.push({ t: p.t, type: "held", held: mv.prop }); return;
        case "use": {
          // he can't strike mid-walk: `use` waits for the actor's move, and compile delays the
          // beat's moves on the same word with it (the pulse leaves when the hammer hits)
          var tu = Math.max(p.t, busy[id] + 0.45);
          p.actual = tu; p.done = tu;
          if (mv.prop === "hammer") {
            var w0 = Math.max(0, tu - 0.45);
            tr.push({ t: w0, type: "held", held: "hammer" });
            tr.push({ t: w0, t1: tu, type: "pose", pose: "raise", blendIn: Math.max(0.15, tu - w0 - 0.05) });
            tr.push({ t: tu, t1: tu + 0.75, type: "pose", pose: "strike", blendIn: 0.1 });
          } else {
            tr.push({ t: Math.max(0, tu - 0.3), type: "held", held: mv.prop });
            tr.push({ t: Math.max(0, tu - 0.3), t1: tu + 1.6, type: "pose", pose: mv.prop === "pointer" ? "point-right" : "raise" });
          }
          return;
        }
        case "say": {
          var t1 = p.until || p.beatEnd;
          tr.push({ t: p.t, t1: t1, type: "say" });
          tr.push({ t: p.t, t1: t1, type: "pose", pose: "talk" });
          return;
        }
      }
    });
    Object.keys(tracks).forEach(function (id) { tracks[id] = sortTrack(tracks[id]); });
    return { tracks: tracks, errors: errors };
  }

  // ---- targets --------------------------------------------------------------------------------
  /* Resolver of a target name to a point at t: world px {x, y}, or {screen: true, x, y} for an
   * actor in the side slot. part: "body" (camera, effects) or "top" (tags). */
  function makePoints(world, tracks, pulses) {
    var R = rig(), SLOT = R.SLOT, WK = worldK();
    return function (name, t, part) {
      var off = part === "top" ? TOP : part === "feet" ? 0 : BODY;
      if (world.anchors[name]) { var q = world.anchors[name](t); return { x: q.x, y: q.y }; }
      if (tracks[name]) {
        var a = actorAt(tracks[name], t);
        if (a.mode === "slot") return { screen: true, x: a.screen.x, y: a.screen.y - off * SLOT.k };
        return { x: a.x, y: a.y - off * WK * a.scale };
      }
      if (name === "pulse" && pulses.length) {
        var pl = pulses[0];
        for (var i = 0; i < pulses.length; i++) if (pulses[i].at <= t + 1e-9) pl = pulses[i];
        return pl.anchor(t);
      }
      return null;
    };
  }

  function pulseOf(world, mv, at) {
    var pts = world.paths[mv.path].map(function (q) { return { x: q.x, y: q.y }; });
    var near = function (a) { // index of the path point nearest an anchor, and the anchor's projection
      var best = 0, bd = Infinity;
      pts.forEach(function (q, i) { var d = Math.hypot(q.x - a.x, q.y - a.y); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    var path = pts;
    if (mv.from !== undefined || mv.to !== undefined) {
      var A = mv.from !== undefined ? world.anchors[mv.from](at) : pts[0];
      var B = mv.to !== undefined ? world.anchors[mv.to](at) : pts[pts.length - 1];
      var ia = near(A), ib = near(B), rev = ia > ib;
      var lo = Math.min(ia, ib), hi = Math.max(ia, ib), mid = pts.slice(lo + 1, hi);
      // keep the path points strictly between the two anchors (along the path direction)
      var inside = mid.filter(function (q) { return rev ? q.x < A.x && q.x > B.x : q.x > A.x && q.x < B.x; });
      if (rev) inside.reverse();
      path = [{ x: A.x, y: A.y }].concat(inside, [{ x: B.x, y: B.y }]);
    }
    var speed = PULSE_SPEED[mv.speed] || (num(mv.speed) ? mv.speed : 800);
    var EP = K.effectPath, S = EP.sampled(path), L = S[S.length - 1].s;
    var duration = num(mv.duration) ? mv.duration : L / speed;
    var first = path[0], last = path[path.length - 1];
    return {
      path: path, duration: duration, at: at, length: L,
      anchor: function (t) {
        if (t <= at) return { x: first.x, y: first.y };
        if (t >= at + duration) return { x: last.x, y: last.y };
        var u = (t - at) / duration;
        if (mv.ease === "inOut") u = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        var q = EP.pointAt(S, L * u);
        return { x: q.x, y: q.y };
      },
    };
  }

  // ---- camera ---------------------------------------------------------------------------------
  function camPose(keys, anchors, t, lim) { return denorm(K.cameraAt(keys, t, anchors, lim || K.WORLD_LIMITS)); }

  /* Shortest eased move between two camera poses (world px) under the limits: timing.js's own count. */
  function moveTime(a, b, lim) {
    return K.cameraMoveTime({ x: a.x / NORM, y: a.y / NORM, zoom: a.zoom }, { x: b.x / NORM, y: b.y / NORM, zoom: b.zoom }, lim);
  }
  /* The zoom at which an actor of this scale is READABLE: at least 45 % of the frame height. */
  function readableZoom(scale) { return Math.min(K.WORLD_LIMITS.maxZoom, 0.45 * canvas().height / (TOP * worldK() * scale)); }

  /* Where the camera centres to frame a point: a ground point (an anchor, the pulse) sits a little
   * below the middle, at 55 % of the frame height, so what stands there shows and the caption band
   * stays clear of it; actors are framed by actorFocus below. */
  var AIM = 0.05; // x the frame height
  function aim(p, zoom, isActor) { return isActor ? { x: p.x, y: p.y } : { x: p.x, y: p.y - AIM * canvas().height / zoom }; }
  /* Framing an actor: when he fits (head to feet in 660 px), his feet sit at y 700, just above the
   * caption band, so what he stands on and does with his hands shows; a taller shot frames his chest. */
  var FEET_Y = 700, FIT_H = 660;
  function actorFocus(points, name, t, zoom) {
    var f = points(name, t, "feet"), top = points(name, t, "top");
    if (!f || f.screen) return null;
    return (f.y - top.y) * zoom <= FIT_H ? { x: f.x, y: f.y - (FEET_Y - canvas().height / 2) / zoom } : points(name, t, "body");
  }

  /* Camera keys from the camera moves (plus automatic follows of walkers, `autos`). points(name, t,
   * "body") resolves targets. Returns {keys, anchors, dives, errors, warnings}. */
  function buildCamera(camMoves, points, tracks, opening, actorMoves, autos) {
    var anchors = {}, keys = [], dives = [], errors = [], warnings = [], n = 0, landed = [];
    function isStatic(name) {
      if (tracks[name] || name === "pulse") return false;
      var a = points(name, 0), b = points(name, 1000);
      return a && b && a.x === b.x && a.y === b.y;
    }
    /* A named camera anchor: a fixed normalised point, or a function (tracking) clamped to the view. */
    function anchorFor(name, zoom, at) {
      var key = "cam-" + (n++);
      if (name === null) anchors[key] = norm(clampFocus(aim(at, zoom), zoom));
      else if (isStatic(name)) anchors[key] = norm(clampFocus(aim(points(name, 0, "body"), zoom), zoom));
      else {
        anchors[key] = function (t) {
          var p = points(name, t, "body");
          if (!p || p.screen) { // an actor in the side slot: aim where he will step into the world
            var tr = tracks[name], mvs = (tr || []).filter(function (e) { return e.type === "move" && e.space === "world"; });
            var nx = mvs.find(function (e) { return e.t >= t; }) || mvs[mvs.length - 1];
            p = nx ? { x: nx.to.x, y: nx.to.y - BODY * worldK() * nx.to.scale } : { x: WORLD.width / 2, y: WORLD.height / 2 };
          } else p = tracks[name] ? actorFocus(points, name, t, zoom) : aim(p, zoom, false);
          return norm(clampFocus(p, zoom));
        };
      }
      return key;
    }
    var open = opening;
    keys.push({ t: 0, frame: { focus: anchorFor(null, open.zoom, open), zoom: open.zoom } });
    var cur = { target: null, point: open, zoom: open.zoom, follow: false, name: keys[0].frame.focus };
    var prevLand = 0, inside = null;
    // a copy: timing.js caches per keys array, and this one is still growing
    function poseAt(t) { return camPose(keys.slice(), anchors, t); }
    var stream = camMoves.concat(autos || []).sort(function (a, b) { return a.t - b.t || (a.auto ? 1 : 0) - (b.auto ? 1 : 0) || a.order - b.order; });
    stream.forEach(function (p) {
      var mv = p.mv;
      if (p.auto) { // follow a walker while no camera move of the scene is running
        if (inside || prevLand > p.t + 0.3 || p.t > p.walkEnd - 0.4) return;
        if (cur.follow && cur.target === mv.target) return;
      }
      if (inside && mv.do !== "cut") { errors.push([p, "the camera is inside the " + inside + " view: cut back out first"]); return; }
      if (mv.target !== undefined && tracks[mv.target]) {
        var tp = points(mv.target, p.t, "body");
        if (tp && tp.screen) { errors.push([p, "can't frame \"" + mv.target + "\" while it is in the side slot"]); return; }
      }
      var target = mv.target !== undefined ? mv.target : cur.target;
      var zoom = mv.zoom !== undefined ? mv.zoom : cur.zoom;
      if (p.auto && p.step) zoom = Math.max(cur.zoom, p.readable); // stepping out of the slot: keep him readable
      if (mv.do === "cut") {
        var kc = anchorFor(target, zoom, cur.point);
        keys.push({ t: p.t, frame: { focus: kc, zoom: zoom }, cut: true });
        cur = { target: target, point: points(target, p.t, "body") || cur.point, zoom: zoom, follow: false, name: kc };
        prevLand = p.t; inside = null;
        return;
      }
      if (mv.do === "dive") {
        var t0 = Math.max(p.t, prevLand), from = poseAt(t0), Z = mv.zoom !== undefined ? mv.zoom : 3.2;
        var fromKey = "dive-" + dives.length + "-from";
        anchors[fromKey] = norm(from);
        var toKey = anchorFor(target, Z, cur.point);
        var dk = [{ t: t0, frame: { focus: fromKey, zoom: from.zoom } }, { t: t0, frame: { focus: toKey, zoom: Z } }];
        var t1 = Math.max(K.cameraSchedule(dk, anchors, DIVE_LIMITS)[0].end, t0 + 0.6);
        dk = [dk[0], { t: t1, frame: dk[1].frame }]; // a new array (timing.js caches per array)
        keys.push({ t: t1, frame: { focus: toKey, zoom: Z }, cut: true });
        dives.push({ t0: t0, t1: t1, into: mv.into, params: normParams(mv.params), target: target, zoom: Z, keys: dk, until: Infinity, move: p.tag });
        cur = { target: target, point: points(target, t1, "body") || cur.point, zoom: Z, follow: false, name: toKey };
        prevLand = t1; inside = mv.into;
        return;
      }
      // push_in / pull_out / follow: an eased move that lands on `at` when it is given
      var follow = mv.do === "follow" || (mv.do === "pull_out" && cur.follow && mv.target === undefined);
      var start0 = Math.max(prevLand, p.beatStart);
      // a push-in without `at` starts on its beat's strike (`use`) when there is one, else with the
      // beat, and runs alongside the action
      if (mv.do === "push_in" && !p.explicit) (actorMoves || []).forEach(function (q) { if (q.bi === p.bi && q.mv.do === "use" && q.done > start0) start0 = q.done; });
      // push_in / pull_out land on their `at`; without one, a pull-out lands on the next beat's word
      // (the scene's end for the last beat, minus a short hold) and a push-in or follow starts at once
      var landOn = mv.do === "follow" ? null : p.explicit ? p.t : mv.do !== "pull_out" ? null : p.beatEnd < p.duration - 1e-9 ? p.beatEnd : Math.max(p.beatStart, p.duration - 0.4);
      var a = poseAt(start0);
      var tp = target === null ? null : points(target, p.t, "body");
      var bp = clampFocus(tp && !tp.screen ? (tracks[target] ? actorFocus(points, target, p.t, zoom) : aim(tp, zoom, false)) : aim(cur.point, zoom), zoom);
      var d = Math.max(0.8, moveTime(a, { x: bp.x, y: bp.y, zoom: zoom }, K.WORLD_LIMITS) * 1.04);
      var land, start;
      if (landOn !== null) { start = Math.max(start0, landOn - d); land = Math.max(landOn, start + d); }
      else { start = Math.max(start0, p.t); land = start + d; }
      if (!p.auto) landed.push({ p: p, t: land });
      var last = keys[keys.length - 1];
      if (start > last.t + 1e-6) keys.push({ t: start, frame: Object.assign({}, last.frame) }); // hold until the move starts
      var kn = anchorFor(target, zoom, cur.point);
      var frame = follow ? { follow: kn, zoom: zoom } : { focus: kn, zoom: zoom };
      keys.push({ t: land, frame: frame });
      cur = { target: target, point: target === null ? cur.point : (tp && !tp.screen ? tp : cur.point), zoom: zoom, follow: follow, name: kn };
      prevLand = land;
      // a push-in on an anchor where an actor stands, so tight that the actor no longer fits above
      // the caption band, crops him: warn (the author may want it, or push in on the actor instead)
      if (mv.do === "push_in" && target !== null && !tracks[target] && tp && !tp.screen) Object.keys(tracks).forEach(function (id) {
        var a = actorAt(tracks[id], land);
        if (!a.visible || a.mode !== "world" || Math.abs(a.x - tp.x) > 160 || Math.abs(a.y - tp.y) > 120) return;
        var tall = (TOP + 30) * worldK() * a.scale, fit = (canvas().height * 0.55 - 40) / tall;
        if (zoom > fit + 1e-9) { warnings.push([p, "zoom " + zoom + " on \"" + target + "\" crops \"" + id + "\" standing there (at most " + fit.toFixed(2) + " shows all of them; or push_in on \"" + id + "\")"]); p.cropped = (p.cropped || []).concat([id]); }
      });
    });
    // an actor in view whose head the frame edge cuts (or leaves out) where a camera move lands: warn
    var final = { camera: keys.slice(), camAnchors: anchors, dives: dives };
    camMoves.forEach(function (p) { if (p.mv.do === "cut") landed.push({ p: p, t: p.t }); });
    landed.forEach(function (L) {
      var cam = worldCamera(final, L.t + 1e-6);
      if (cam.inside !== undefined) return;
      Object.keys(tracks).forEach(function (id) {
        var a = actorAt(tracks[id], L.t);
        if (!a.visible || a.mode !== "world" || (L.p.cropped || []).indexOf(id) >= 0) return;
        var k = worldK() * a.scale * cam.zoom, f = toScreen(a, cam), HB = rig().headBox({ pose: "idle", expression: "happy", mouth: 0, blink: 0, breath: 0, outfit: "blazer" });
        var x0 = f.x + HB.x * k, x1 = x0 + HB.width * k, y0 = f.y + (HB.y - rig().FEET) * k, y1 = y0 + HB.height * k;
        var inside = x0 >= 0 && x1 <= canvas().width && y0 >= 0 && y1 <= canvas().height;
        var bodyIn = f.x + 160 * k > 0 && f.x - 160 * k < canvas().width && f.y > 0 && y0 < canvas().height; // some of him shows
        if (!inside && bodyIn) warnings.push([L.p, "the frame edge cuts \"" + id + "\"'s head where the camera lands (" + L.t.toFixed(2) + " s): reframe, or zoom out a little"]);
      });
    });
    // the inside view of a dive lasts until the next cut
    dives.forEach(function (dv) {
      var c = keys.find(function (k) { return k.cut && k.t > dv.t1 + 1e-9; });
      if (c) dv.until = c.t;
    });
    return { keys: keys, anchors: anchors, dives: dives, errors: errors, warnings: warnings };
  }

  /* The automatic camera: while an actor walks or runs, the camera follows him (unless a camera move
   * of the scene is running then). Stepping out of the side slot, he is also framed at a readable
   * size (at least 45 % of the frame height), so the slot-to-world change never reads as a shrink. */
  function autoFollows(actorMoves, tracks, duration) {
    var out = [];
    actorMoves.forEach(function (p) {
      if (["walk_to", "run_to", "enter"].indexOf(p.mv.do) < 0 || !(p.done > 0)) return;
      var ev = (tracks[p.mv.who] || []).find(function (e) { return e.type === "move" && Math.abs(e.t1 - p.done) < 1e-9; });
      if (!ev || ev.space !== "world") return;
      out.push({ mv: { do: "follow", target: p.mv.who }, t: ev.t + 1e-3, auto: true, step: !!ev.step, readable: readableZoom(ev.to.scale), walkEnd: ev.t1,
        explicit: false, tag: p.tag, bi: p.bi, beatStart: ev.t, beatEnd: ev.t1, duration: duration, order: 1e6 + p.order });
    });
    return out;
  }

  function normParams(p) { return typeof p === "string" ? { state: p, type: p } : Object.assign({}, p || {}); }

  /* Camera pose at t: the main keys, a dive's own push-in, or the inside view. */
  function worldCamera(c, t) {
    for (var i = 0; i < (c.dives || []).length; i++) {
      var dv = c.dives[i];
      if (t >= dv.t0 && t < dv.t1) return clampView(camPose(dv.keys, c.camAnchors, t, DIVE_LIMITS));
      if (t >= dv.t1 && t < dv.until) {
        var at = camPose(c.camera, c.camAnchors, t);
        return Object.assign(clampView(at), { inside: dv.into, insideT: t - dv.t1, params: dv.params, dive: i });
      }
    }
    return clampView(camPose(c.camera, c.camAnchors, t));
  }
  function clampView(cam) { var p = clampFocus(cam, cam.zoom); return { x: p.x, y: p.y, zoom: cam.zoom }; }

  // ---- the compiler ---------------------------------------------------------------------------
  function compileMoves(scene, words, world) {
    scene = scene || {};
    world = world || worldFor(scene, {});
    var sid = scene.id, errors = [], duration = sceneDuration(scene, words, world);
    var out = { actors: {}, effects: [], overlays: [], camera: [], dives: [], camAnchors: {}, overrun: 0, duration: duration, errors: errors, warnings: [] };
    var beats = scene.beats;
    if (!Array.isArray(beats) || !beats.length) { errors.push("scene " + sid + ": no beats"); return out; }
    var hasPulse = beats.some(function (b) { return b && (b.moves || []).some(function (mv) { return mv && mv.do === "pulse_along"; }); });
    var ctx = { sceneId: sid, hasPulse: hasPulse };
    // beat times
    var bt = beats.map(function (b, bi) {
      var r = timeOf(b && b.at, words, duration);
      if (r.err) { errors.push("scene " + sid + " beat " + bi + ": " + r.err); return null; }
      return r.t;
    });
    var parsed = [];
    beats.forEach(function (b, bi) {
      if (bt[bi] === null) return;
      var nextT = duration;
      for (var j = bi + 1; j < beats.length; j++) if (bt[j] !== null && bt[j] > bt[bi]) { nextT = bt[j]; break; }
      if (!b.moves || !b.moves.length) { errors.push("scene " + sid + " beat " + bi + ": no moves (show, don't tell)"); return; }
      b.moves.forEach(function (mv, mi) {
        var tag = "scene " + sid + " beat " + bi + " move " + mi + " (" + (mv && mv.do) + ")";
        if (!mv || typeof mv !== "object") { errors.push(tag + ": not an object"); return; }
        var e = checkMove(mv, world, ctx);
        if (e) { errors.push(tag + ": " + e); return; }
        var tt = mv.at !== undefined ? timeOf(mv.at, words, duration) : { t: bt[bi] };
        if (tt.err) { errors.push(tag + ": " + tt.err); return; }
        var until = null;
        if (mv.until !== undefined) {
          var tu = timeOf(mv.until, words, duration);
          if (tu.err) { errors.push(tag + ": until: " + tu.err); return; }
          until = tu.t;
        }
        parsed.push({ mv: mv, bi: bi, mi: mi, tag: tag, t: tt.t, t0: tt.t, explicit: mv.at !== undefined, until: until, beatStart: bt[bi], beatEnd: nextT, duration: duration, order: parsed.length });
      });
    });
    var byTime = function (a, b) { return a.t - b.t || a.order - b.order; };
    var groupOf = function (p) { return MOVES[p.mv.do].group; };
    var actorMoves = parsed.filter(function (p) { return groupOf(p) === "actor"; }).sort(byTime);
    var camMoves = parsed.filter(function (p) { return groupOf(p) === "camera"; }).sort(byTime);
    var fxMoves = parsed.filter(function (p) { return groupOf(p) === "effect" || groupOf(p) === "custom"; }).sort(byTime);
    var ovMoves = parsed.filter(function (p) { return groupOf(p) === "overlay"; }).sort(byTime);

    // pulses first: they are targets for tags, the camera and pointing (rebuilt when a `use` delays them)
    var pulses = [];
    function makePulses() {
      pulses.length = 0;
      fxMoves.forEach(function (p) { if (p.mv.do === "pulse_along") { p.pulse = pulseOf(world, p.mv, p.t); pulses.push(p.pulse); } });
      pulses.sort(function (a, b) { return a.at - b.at; });
    }
    makePulses();
    /* A `use` that had to wait for its actor delays the moves of its beat on the same word
     * (effects, tags, camera) by as much, so cause and effect stay together. */
    var sameAt = function (a, b) { return a && b && (a.word !== undefined ? a.word === b.word : a.t === b.t); };
    function sync() {
      parsed.forEach(function (q) { if (groupOf(q) !== "actor") q.t = q.t0; });
      actorMoves.forEach(function (u) {
        if (u.mv.do !== "use" || !u.explicit || !(u.actual > u.t0 + 1e-6)) return;
        parsed.forEach(function (q) { if (q.bi === u.bi && groupOf(q) !== "actor" && q.explicit && sameAt(q.mv.at, u.mv.at)) q.t = q.t0 + (u.actual - u.t0); });
      });
      camMoves.sort(byTime); fxMoves.sort(byTime); ovMoves.sort(byTime);
      makePulses();
    }

    // opening view: the stage = the middle of the anchors the scene uses (else the world centre), at
    // 1x; tight when the scene opens on a pull-out (it reveals)
    var used = [];
    Object.keys(world.actors).forEach(function (id) { var st = world.actors[id].start; if (st.anchor) used.push(st.anchor); });
    parsed.forEach(function (p) { ["to", "from", "target"].forEach(function (k) { if (world.anchors[p.mv[k]]) used.push(p.mv[k]); }); });
    var first = camMoves[0], centre = { x: WORLD.width / 2, y: WORLD.height / 2 };
    if (used.length) {
      var ps = used.map(function (n) { return world.anchors[n](0); });
      var xs = ps.map(function (q) { return q.x; }), ys = ps.map(function (q) { return q.y; });
      centre = { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y: (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2 };
    }
    var opening = { x: centre.x, y: centre.y, zoom: 1 }; // a ground point (buildCamera frames it)
    var narration = narrationSpans(words);
    var pass = function (camFn, tracksForPoints) {
      var pts = makePoints(world, tracksForPoints || {}, pulses);
      actorMoves.forEach(function (p) { p.targetPoint = function (t, part) { return pts(p.mv.target, t, part); }; });
      return buildTracks(world, actorMoves, camFn, narration);
    };
    // pass 1: tracks with a still camera (for target positions), then the camera, then tracks again
    // with that camera (frame edges, the side slot in the world), then the final camera
    var p1 = pass(function () { return opening; });
    sync();
    if (first && first.mv.do === "pull_out" && first.t <= (bt[0] || 0) + 0.5) {
      var oz = first.mv.from !== undefined ? first.mv.from : Math.min(K.WORLD_LIMITS.maxZoom, Math.max(1.2, first.mv.zoom * 1.5));
      var of = first.mv.target !== undefined ? makePoints(world, p1.tracks, pulses)(first.mv.target, first.t, "body") : centre;
      if (of && !of.screen) opening = { x: of.x, y: of.y, zoom: oz };
      first.openedTight = true;
    }
    var c1 = buildCamera(camMoves, makePoints(world, p1.tracks, pulses), p1.tracks, opening, actorMoves, autoFollows(actorMoves, p1.tracks, duration));
    var cam1 = function (t) { return worldCamera({ camera: c1.keys, camAnchors: c1.anchors, dives: c1.dives }, t); };
    var p2 = pass(cam1, p1.tracks);
    sync();
    var points = makePoints(world, p2.tracks, pulses);
    var c2 = buildCamera(camMoves, points, p2.tracks, opening, actorMoves, autoFollows(actorMoves, p2.tracks, duration));
    p2.errors.concat(c2.errors).forEach(function (x) { errors.push(x[0].tag + ": " + x[1]); });
    c2.warnings.forEach(function (x) { out.warnings.push(x[0].tag + ": " + x[1]); });
    // a strike that had to wait for its actor more than 0.5 s after its word: say how to fix it
    actorMoves.forEach(function (u) {
      if (u.mv.do !== "use" || !(u.actual > u.t0 + 0.5)) return;
      var slip = u.actual - u.t0, mvBefore = actorMoves.filter(function (q) { return q.mv.who === u.mv.who && q.done !== undefined && q.done <= u.actual - 0.44 && ["walk_to", "run_to", "enter"].indexOf(q.mv.do) >= 0; }).pop();
      var hint = "start the actor's move earlier";
      if (mvBefore) {
        var want = mvBefore.t - slip, w = (words || []).filter(function (x) { return x.start <= want + 1e-9; }).pop();
        hint = "start the " + mvBefore.mv.do + " earlier (at word " + (w ? w.i : 0) + ")" + (mvBefore.mv.do === "walk_to" ? " or use run_to" : "");
      }
      out.warnings.push(u.tag + ": the strike lands " + slip.toFixed(2) + " s after its word (\"" + u.mv.who + "\" is still on the way): " + hint);
    });
    out.actors = p2.tracks;
    out.camera = K.resolveCamera(c2.keys, [], sid, c2.anchors);
    out.camAnchors = c2.anchors;
    out.dives = c2.dives;
    out.point = points;
    var cam = function (t) { return worldCamera(out, t); };

    // effects and customs
    fxMoves.forEach(function (p, i) {
      var mv = p.mv;
      if (mv.do === "custom") {
        out.effects.push({ name: "custom", custom: mv.name, id: i, at: p.t, until: p.until || p.beatEnd, params: Object.assign({}, mv.params || {}) });
        return;
      }
      var params = { at: p.t };
      COMMON.concat(FX[mv.do]).forEach(function (k) { if (mv[k] !== undefined) params[k] = mv[k]; });
      if (mv.do === "pulse_along") {
        params.path = p.pulse.path; params.duration = p.pulse.duration;
        if (mv.ease) params.ease = mv.ease;
      } else {
        var q;
        if (mv.target !== undefined) {
          q = points(mv.target, p.t, "body");
          if (q && q.screen) q = unproject(q, cam(p.t)); // an actor in the side slot: where he stands in the view
        } else {
          q = mv.from !== undefined ? world.anchors[mv.from](p.t) : world.paths[mv.path][0];
        }
        params.x = q.x; params.y = q.y;
      }
      out.effects.push({ name: mv.do, id: i, at: p.t, params: params });
    });

    // overlays
    ovMoves.forEach(function (p, i) {
      var mv = p.mv, at = p.t;
      if (mv.target === "pulse" && !p.explicit) { // a tag on the pulse appears with the pulse
        var pl = pulses.find(function (q) { return q.at >= p.beatStart - 1e-9; }) || pulses[pulses.length - 1];
        if (pl) at = Math.max(at, pl.at); // none when the pulse_along itself is invalid (its error is reported)
      }
      var until = p.until || Math.min(duration, Math.max(p.beatEnd, at + (mv.do === "title" ? 3 : 1.5)));
      if (mv.do === "title" && !p.until) until = Math.min(duration, at + 3.2);
      var o = { kind: mv.do === "tag_follow" ? "tag" : mv.do, id: (mv.do === "tag_follow" ? "tag-" : mv.do + "-") + i, text: mv.text, at: at, until: until };
      if (mv.target !== undefined) o.target = mv.target;
      if (mv.side !== undefined) o.side = mv.side;
      out.overlays.push(o);
    });

    // camera overrun (main keys and dives) against the scene duration
    var ov = K.cameraOverrun(out.camera, out.camAnchors, K.WORLD_LIMITS, duration);
    out.dives.forEach(function (dv) { ov = Math.max(ov, dv.t1 - duration); });
    out.overrun = Math.max(0, ov);
    return out;
  }

  /* Scene checks plus the compile errors plus the camera overrun (> 0.25 s fails). opts = {cast,
   * duration, places, customs}. */
  function validateWorld(scene, words, opts) {
    var w = worldFor(scene, opts || {});
    if (w.fatal) return w.errors.slice();
    if (scene && scene.kind !== undefined && scene.kind !== "world") w.errors.push("scene " + scene.id + ": kind must be \"world\"");
    var c = compileMoves(scene, words, w);
    var errs = w.errors.concat(c.errors);
    if (c.overrun > 0.25) errs.push("scene " + (scene && scene.id) + ": camera finishes " + c.overrun.toFixed(2) + " s after the scene ends (limit 0.25 s): land the moves earlier, make them smaller, or cut");
    return errs;
  }

  // ---- MOVES.md -------------------------------------------------------------------------------
  function movesMarkdown() {
    var R = rig();
    var fill = function (s) {
      return s.replace("{GESTURES}", Object.keys(R.POSES).filter(function (p) { return p !== "idle"; }).map(function (p) { return "`" + p + "`"; }).join(", "))
        .replace("{EXPRESSIONS}", Object.keys(R.EXPRESSIONS).map(function (p) { return "`" + p + "`"; }).join(", "))
        .replace("{PROPS}", Object.keys(R.HELD).map(function (p) { return "`" + p + "`"; }).join(", "))
        .replace("{INSIDES}", Object.keys(K.insides || {}).map(function (n) {
          var pm = K.insides[n].meta.params || {};
          return "`" + n + "`" + (Object.keys(pm).length ? " (params " + Object.keys(pm).map(function (k) { return "`" + k + "`: " + pm[k].join(" | "); }).join(", ") + ")" : "");
        }).join(", "));
    };
    var groups = [["actor", "Actor moves"], ["effect", "Effects"], ["overlay", "Overlays (on-screen text)"], ["camera", "Camera"], ["custom", "Custom"]];
    var L = [
      "# World scene moves",
      "",
      "<!-- Generated from HFKit.MOVES (hf-kit/src/world/moves.js) by `npm run moves-doc` in hf-kit/. Do not edit by hand. -->",
      "",
      "Every beat of a `kind: \"world\"` scene lists its `moves`: `{\"do\": <move>, ...parameters}`. A beat",
      "with no moves fails validation (show, don't tell). `HFKit.validateWorld` (via `shots validate`)",
      "names any problem as `scene <id> beat <b> move <m> (<do>): <what>`, counting from 0.",
      "",
      "- `at`: `{\"word\": i}` (that word's start in the scene's words.json) or `{\"t\": seconds}`; a move's",
      "  `at` defaults to its beat's. `until` takes the same form.",
      "- `who`: an id from the scene's `actors`. `to`, `from`: a place anchor (hf-kit/places/README.md).",
      "- `target`: a place anchor, an actor id, or `pulse` (the scene's pulse_along). `path`: a place path.",
      "- Actor moves of one actor never overlap: a move waits for the one before it. Walking is " + MOTION.walk + " world px/s,",
      "  running " + MOTION.run + " (times the actor's scale), with " + MOTION.ramp + " s ease in and out; feet never slide.",
      "- Camera: zoom " + K.WORLD_LIMITS.minZoom + " to " + K.WORLD_LIMITS.maxZoom + ", at most " + K.WORLD_LIMITS.maxZoomPerSec + "x zoom per second (a dive up to " + DIVE_LIMITS.maxZoomPerSec + "x), no whip pans.",
      "  Moves ease smoothly (sine). push_in and pull_out LAND on their `at` word, starting as late as the",
      "  limits allow but never before their beat. Without `at`, a push_in starts on its beat's strike",
      "  (`use`), else with the beat, alongside the action; a pull_out lands on the next beat's word. follow,",
      "  cut and dive start at `at` (default: the beat). While an actor walks or runs and no camera move",
      "  runs, the camera follows him; stepping out of the side slot he is framed at least 45 % of the",
      "  frame tall. A camera that finishes more than 0.25 s after the scene ends fails validation.",
      "- The host in the side slot talks while the narration speaks: whenever no other pose (`gesture`,",
      "  `point`, `say`, ...) runs, he uses the talk pose, gently varied, instead of standing idle. Give",
      "  him `gesture` / `point` / `react` on key words as well, so he moves on most beats.",
      "- Warnings (allowed, worth a look): the frame edge cuts an actor's head where the camera lands;",
      "  a `use` strike slips more than 0.5 s past its word because its actor is still on the way.",
      "- Text: tags and labels at most " + K.overlays.MAX_WORDS + " words (a number and its unit count as one: `343 m/s`), the title at most " + TITLE_WORDS + ".",
      "",
    ];
    groups.forEach(function (g) {
      L.push("## " + g[1], "", "| Move | Required | Optional | What it does |", "|---|---|---|---|");
      Object.keys(MOVES).forEach(function (n) {
        var d = MOVES[n];
        if (d.group !== g[0]) return;
        var list = function (a) { return a.length ? a.map(function (x) { return "`" + x + "`"; }).join(", ") : "—"; };
        L.push("| `" + n + "` | " + list(d.required) + " | " + list(d.optional) + " | " + fill(d.doc).replace(/\|/g, "\\|") + " |");
      });
      L.push("");
    });
    L.push("## Example", "", "The plan's pinned railway beat (beat 1 of its scene), as written:", "", "```json",
      "{\"at\": {\"word\": 9}, \"action\": \"host walks in and strikes the rail; a pulse races along it\",",
      " \"moves\": [{\"do\": \"walk_to\", \"who\": \"host\", \"to\": \"rail-near\"},",
      "           {\"do\": \"use\", \"who\": \"host\", \"prop\": \"hammer\", \"at\": {\"word\": 12}},",
      "           {\"do\": \"pulse_along\", \"path\": \"rail\", \"from\": \"rail-near\", \"to\": \"rail-far\", \"speed\": \"fast\", \"at\": {\"word\": 12}},",
      "           {\"do\": \"tag_follow\", \"target\": \"pulse\", \"text\": \"≈5,960 m/s\"},",
      "           {\"do\": \"push_in\", \"target\": \"rail-far\", \"zoom\": 2.2}]}",
      "```", "");
    return L.join("\n");
  }

  K.MOVES = MOVES;
  K.MOTION = MOTION;
  K.DIVE_LIMITS = DIVE_LIMITS;
  K.customs = K.customs || {};
  K.worldFor = worldFor;
  K.compileMoves = compileMoves;
  K.actorAt = actorAt;
  K.worldCamera = worldCamera;
  K.validateWorld = validateWorld;
  K.movesMarkdown = movesMarkdown;
  K.narrationSpans = narrationSpans;
  K.worldMath = { toScreen: toScreen, unproject: unproject, clampFocus: clampFocus, NORM: NORM, BODY: BODY, TOP: TOP };
})(typeof globalThis !== "undefined" ? globalThis : window);
