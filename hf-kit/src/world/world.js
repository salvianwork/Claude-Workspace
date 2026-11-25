/* hf-kit world scene runtime: mounts a `kind: "world"` scene (shots.json schema 2) as a drawn
 * place with actors, effects, tags and a camera, all driven by the compiled moves (moves.js).
 *
 *   var w = HFKit.mountWorld(el, scene, ctx);
 *   w.update(t);          // draw the scene at its own time t (a pure function of t: seekable)
 *   w.boxes(t)            // -> [{kind: "face" | "tag" | "label", id, x, y, w, h}] screen px at t
 *                         //    (faces of actors in view, visible tags, labels and the title), for
 *                         //    the overlap report
 *   w.camera(t)           // -> {x, y, zoom, inside?}: the view (world px at the frame centre)
 *   w.compiled            // HFKit.compileMoves output; w.shell.layers.captions: the caption slot
 *
 *   scene = the shots.json scene: {id, kind: "world", place, variant, actors, beats, ...}
 *   ctx   = {words, mouth (the narration, 30 fps: the host's mouth), duration, cast (top-level
 *            "cast"), style, captions (false: leave the caption slot empty for the composition),
 *            idPrefix?}
 *
 * Errors: an invalid scene throws one Error listing every problem (as HFKit.validateWorld names
 * them, except a camera overrun, which still renders), so the composition reports it instead of
 * rendering nothing.
 *
 * Layers (back to front), in el (the canvas, HFKit.CANVAS, clipped): the place's sky / far / mid / ground,
 * effects (world px, on the ground plane), actors (screen px, sorted by depth), the place's front
 * layer, the inside views of dives, tags / labels / the title, a cut flash, captions.
 *
 * Extended places: on a portrait (vertical) canvas a place with meta.extend mounts 3840 x 3600
 * (HFKit.placeWorld; its anchors 720 lower) and the camera is clamped to that taller world.
 *
 * Camera: HFKit.worldCamera(compiled, t) -> {x, y, zoom} world px (see moves.js for the units:
 * the camera maths runs in world px / 3840 on both axes, so WORLD_LIMITS' pan limit of 0.6 is
 * 2304 screen px/s at the eased peak, 1.2 frame widths a second, at every zoom). Places get the
 * camera as is (place.update(t, cam)); effects sit on a world layer with the ground transform.
 *
 * Actors: in the side slot an actor is drawn at the slot (feet below the frame, about 1.35x the old
 * presenter); in the world at its feet point, sized meta.actorScale x the anchor's scale x zoom,
 * and lit by the place variant's meta.actorLight. Stepping out of the slot (walk_to from a slot)
 * blends from the slot into the world over the first quarter of the walk. Ids: every SVG id is
 * "<base>-<part>-<n>-..." with base "s<scene>" (a second mount of the same scene id on one page:
 * "s<scene>w<n>"), so two world scenes never share an id. Blinks are seeded from {scene, actor}
 * only, so rebuilding a composition gives identical frames.
 * Classic script: load after moves.js and insides.js; sets HFKit.mountWorld. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K || !K.compileMoves || !K.placeLayers) throw new Error("world/world.js: load the kit scripts first (place, moves)");
  var mounts = {};
  var FLASH = 0.22;

  /* A small number from an id (FNV-1a): seeds an extra's mouth flap, so two extras never talk in step. */
  function hashId(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return (x >>> 0) % 1000;
  }
  function css(e, rules) { for (var k in rules) e.style[k] = rules[k]; return e; }
  function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function r2(v) { return Math.round(v * 100) / 100; }

  function mountWorld(el, scene, ctx) {
    ctx = ctx || {};
    scene = scene || {};
    var FRAME = K.CANVAS; // the composition canvas at mount time (HFKit.setCanvas)
    var doc = el.ownerDocument, sid = scene.id;
    var words = ctx.words || [];
    var opts = { cast: ctx.cast, duration: ctx.duration };
    // structural errors stop the mount; a camera overrun is validateWorld's business (it still renders)
    var world = K.worldFor(scene, opts);
    if (world.fatal) throw new Error(world.errors.join("; "));
    var c = K.compileMoves(scene, words, world);
    var errs = world.errors.concat(c.errors);
    if (errs.length) throw new Error(errs.join("; "));
    var P = K.places[scene.place], meta = P.meta, variant = world.variant;
    var light = (meta.actorLight || {})[variant] || null;

    var n = mounts[sid] || 0;
    mounts[sid] = n + 1;
    var base = ctx.idPrefix || ("s" + sid + (n ? "w" + n : ""));
    var R = K.rig, SLOT = R.SLOT, WK = (root.HFKitActor && root.HFKitActor.WORLD_K) || 0.3, M = K.worldMath;

    el.innerHTML = "";
    var rootEl = doc.createElement("div");
    rootEl.className = "hf-world";
    rootEl.setAttribute("data-world", base);
    css(rootEl, { position: "absolute", left: "0px", top: "0px", width: FRAME.width + "px", height: FRAME.height + "px", overflow: "hidden", background: "#0B1020" });
    el.appendChild(rootEl);
    function div(cls, parent, before) {
      var d = doc.createElement("div");
      d.className = cls;
      css(d, { position: "absolute", left: "0px", top: "0px", width: FRAME.width + "px", height: FRAME.height + "px", pointerEvents: "none" });
      if (before) (parent || rootEl).insertBefore(d, before); else (parent || rootEl).appendChild(d);
      return d;
    }
    var worldEl = div("hf-world-place");
    worldEl.style.zIndex = "0"; // its own stacking context: actors sort by depth inside it, under the tags and captions
    // a vertical canvas mounts an extended place (3840 x 3600, the original 720 lower; world.extended
    // and world.bounds come from HFKit.worldFor); a landscape canvas mounts it exactly as before
    var WB = world.bounds;
    var layers = world.extended ? K.placeLayers(worldEl, base + "-place-0", WB) : K.placeLayers(worldEl, base + "-place-0");
    var popts = { variant: variant, seed: sid, idPrefix: base + "-place-0" };
    if (world.extended) popts.extended = true;
    var place = P.mount(layers, popts);
    var fxLayer = K.draw.el(worldEl, "svg", { width: WB.width, height: WB.height, viewBox: "0 0 " + WB.width + " " + WB.height, overflow: "visible", "data-layer": "effects" });
    css(fxLayer, { position: "absolute", left: "0", top: "0", overflow: "visible", transformOrigin: "0 0", pointerEvents: "none" });
    worldEl.insertBefore(fxLayer, layers.front);
    var actorsEl = div("hf-world-actors", worldEl, layers.front);

    // actors
    var actors = Object.keys(world.actors).map(function (id) {
      var a = world.actors[id];
      var holder = doc.createElement("div");
      css(holder, { position: "absolute", left: "0px", top: "0px", width: FRAME.width + "px", height: FRAME.height + "px" });
      actorsEl.appendChild(holder);
      var api = K.mountActor(holder, { id: id, character: a.character, outfit: a.outfit, start: { x: 0, y: 0 }, light: light },
        { sceneId: sid, mouth: a.host ? (ctx.mouth || []) : [], idPrefix: base + "-" + id + "-0" });
      return { id: id, info: a, api: api, holder: holder, track: c.actors[id], seed: hashId(id), on: false };
    });

    // effects and customs (world px, on the effects layer)
    var fx = c.effects.map(function (e, i) {
      var prefix = base + "-fx-" + i;
      if (e.name === "custom") {
        var C = K.customs[e.custom], mount = typeof C === "function" ? C : C.mount;
        return mount(fxLayer, { params: e.params, at: e.at, until: e.until, idPrefix: prefix, sceneId: sid, anchors: world.anchors, paths: world.paths, scene: scene });
      }
      return K.effects[e.name](fxLayer, e.params, prefix);
    });

    var insideEls = c.dives.map(function (dv, i) {
      var d = div("hf-world-inside");
      d.style.visibility = "hidden";
      var api = K.insides[dv.into].mount(d, { params: dv.params, idPrefix: base + "-inside-" + i, seed: sid * 10 + i });
      return { el: d, api: api, dv: dv };
    });

    // tags, labels, the title
    var ovEl = div("hf-world-overlays");
    var overlays = c.overlays.map(function (o, i) {
      if (o.kind === "title") {
        var t = doc.createElement("div");
        t.className = "hf-title";
        t.textContent = o.text;
        css(t, { position: "absolute", left: "50%", top: "120px", transform: "translateX(-50%)", padding: "18px 56px 22px", borderRadius: "999px",
          background: "rgba(14,18,34,0.74)", color: "#FFF8EC", fontFamily: '"Poppins", "Inter", sans-serif', fontWeight: "700", fontSize: "88px",
          lineHeight: "1.15", whiteSpace: "nowrap", boxShadow: "0 14px 40px rgba(10,14,30,0.35), inset 0 0 0 3px rgba(255,248,236,0.18)", opacity: "0" });
        ovEl.appendChild(t);
        var w = Math.ceil(o.text.length * 88 * 0.6 + 112), h = Math.round(88 * 1.15 + 40);
        return { o: o, title: t, box: function (tt) { var op = titleOp(o, tt); return op > 0 ? { x: FRAME.width / 2 - w / 2, y: 120, width: w, height: h } : { x: 0, y: 0, width: 0, height: 0 }; } };
      }
      var api = K.overlays[o.kind](ovEl, { text: o.text, target: o.target, at: o.at, until: o.until, side: o.side }, base + "-" + o.kind + "-" + i);
      return { o: o, api: api };
    });
    function titleOp(o, t) { return Math.min(sm((t - o.at) / 0.4), 1 - sm((t - o.until) / 0.4)); }
    var flash = div("hf-world-flash");
    css(flash, { background: "#FFFDF6", opacity: "0" });
    var capEl = div("hf-captions");
    var style = K.resolveStyle(ctx.style);
    var band = K.layout(style).captionBand;
    css(capEl, { left: band.x + "px", top: band.y + "px", width: band.width + "px", height: band.height + "px" });
    var caps = ctx.captions === false ? null : K.mountCaptions(capEl, { words: words, style: ctx.style });

    function screenOf(a, cam) { // an actor's feet in screen px and its mountActor scale
      var slotMult = SLOT.k / WK;
      if (a.mode === "slot") return { x: a.screen.x, y: a.screen.y, scale: slotMult, slot: true };
      var p = M.toScreen(a, cam), s = { x: p.x, y: p.y, scale: a.scale * cam.zoom };
      if (a.mode === "step") { // blend out of the slot over the first quarter of the walk
        var w = sm(a.u / 0.25), ss = { x: SLOT[a.side], y: SLOT.feetY };
        s = { x: ss.x + (s.x - ss.x) * w, y: ss.y + (s.y - ss.y) * w, scale: slotMult + (s.scale - slotMult) * w, slot: w < 0.5 };
      }
      return s;
    }
    function targetScreen(name, t, cam) {
      var q = c.point(name, t, "top");
      if (!q) return null;
      return q.screen ? q : M.toScreen(q, cam);
    }

    var lastT = null;
    function update(t) {
      lastT = t;
      var cam = K.worldCamera(c, t), inside = cam.inside !== undefined;
      worldEl.style.visibility = inside ? "hidden" : "visible";
      if (!inside) {
        place.update(t, cam);
        fxLayer.style.transform = K.place.layerTransform(cam, 1);
        fx.forEach(function (f) { f.update(t); });
      }
      actors.forEach(function (A) {
        var a = K.actorAt(A.track, t);
        A.on = a.visible && !inside;
        A.holder.style.visibility = A.on ? "visible" : "hidden";
        if (!A.on) return;
        var s = screenOf(a, cam), st = Object.assign({}, a.state, { x: s.x, y: s.y, scale: s.scale });
        if (s.slot && !st.facing) st.gazeBias = a.side === "left" ? 0.25 : -0.25;
        if (!A.info.host) st.mouth = st.speaking ? 0.45 + 0.4 * Math.sin(t * 17 + A.seed) * Math.sin(t * 5.3 + A.seed * 2) : 0;
        delete st.speaking;
        A.holder.style.zIndex = s.slot ? "5000" : String(Math.round(s.y));
        A.api.update(t, st);
      });
      insideEls.forEach(function (I, i) {
        var on = inside && cam.dive === i;
        I.el.style.visibility = on ? "visible" : "hidden";
        if (on) I.api.update(cam.insideT);
      });
      overlays.forEach(function (O) {
        if (O.title) { O.title.style.opacity = String(r2(Math.max(0, titleOp(O.o, t)))); return; }
        var sp = inside ? null : targetScreen(O.o.target, t, cam);
        O.api.update(t, sp || { x: -2000, y: -2000 });
        if (inside) O.api.el.style.visibility = "hidden";
      });
      var f = 0;
      c.dives.forEach(function (dv) {
        if (t >= dv.t1 && t < dv.t1 + FLASH) f = Math.max(f, 1 - (t - dv.t1) / FLASH);
        if (isFinite(dv.until) && t >= dv.until && t < dv.until + FLASH) f = Math.max(f, 1 - (t - dv.until) / FLASH);
      });
      flash.style.opacity = String(r2(f * 0.85));
      if (caps) caps.update(t);
    }

    function boxes(t) {
      if (lastT !== t) update(t);
      var out = [], inFrame = function (b) { return b.width > 0 && b.x < FRAME.width && b.y < FRAME.height && b.x + b.width > 0 && b.y + b.height > 0; };
      actors.forEach(function (A) {
        if (!A.on) return;
        var b = A.api.box(t);
        if (inFrame(b)) out.push({ kind: "face", id: A.id, x: r2(b.x), y: r2(b.y), w: r2(b.width), h: r2(b.height) });
      });
      overlays.forEach(function (O) {
        if (!O.title && O.api.el.style.visibility === "hidden") return;
        var b = O.title ? O.box(t) : O.api.box(t);
        if (b.width > 0) out.push({ kind: O.title ? "label" : O.o.kind, id: O.o.id, x: r2(b.x), y: r2(b.y), w: r2(b.width), h: r2(b.height) });
      });
      return out;
    }

    update(0);
    return { update: update, boxes: boxes, camera: function (t) { return K.worldCamera(c, t); }, compiled: c, world: world, el: rootEl, prefix: base,
      shell: { layers: { captions: capEl, presenter: null } } };
  }

  K.mountWorld = mountWorld;
})(typeof globalThis !== "undefined" ? globalThis : window);
