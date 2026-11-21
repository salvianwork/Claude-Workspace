/* hf-kit actor, part 3/3: mountActor (HFKit.mountActor). Places one actor in a side slot or at
 * a world point and redraws it from the actor state at t.
 *
 *   var a = HFKit.mountActor(el, {id: "host", character: "host", outfit, scale, start}, ctx);
 *   a.update(t, {pose, expression, cycle, phase, held, facing, x, y, ...});   // state at t
 *   a.anchors.head(t) / .hand(t) / .feet(t)  -> {x, y} screen px
 *   a.box(t)                                  -> the face box {x, y, width, height} in screen px
 *
 * spec.start: {slot: "left" | "right"} (narrator slot, feet below the frame edge) or {x, y}
 *   (feet at that screen point, for an actor in the world). spec.scale multiplies the slot / world
 *   size. ctx: {sceneId, mouth (the scene's mouth array, 30 fps), seed?, offset? (frames)}.
 * Every SVG id is "s<sceneId>-<spec.id>-<n>-..." (n counts mounts of that id in that scene), so
 * two actors, or two scenes, never share a clip or mask. Breathing and blinks are automatic;
 * state fields override them. Everything is a pure function of (t, state): seeking works. */
(function (root) {
  "use strict";
  var P = root.HFKitPresenter;
  var A = (root.HFKitActor = root.HFKitActor || {});
  if (!A.rig || !A.cast) throw new Error("actor/actor.js: load actor/rig.js and actor/host.js first");
  var rig = A.rig;

  var WORLD_K = 0.3; // px per body unit for an actor in the world at scale 1 (about 380 px tall)
  var BREATH_FRAMES = 120; // one breath every 4 s
  var counts = {};

  function hash(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return (x >>> 0) % 100000;
  }
  function px(v) { return (Math.round(v * 100) / 100) + "px"; }

  function mountActor(el, spec, ctx) {
    spec = spec || {};
    ctx = ctx || {};
    if (!spec.id || !/^[A-Za-z0-9_-]+$/.test(String(spec.id))) throw new Error("mountActor: spec.id must be a plain name, got " + spec.id);
    var character = A.cast.resolve(spec.character);
    var outfit = spec.outfit || character.defaultOutfit || "blazer";
    if (!rig.OUTFITS[outfit]) throw new Error("mountActor: unknown outfit " + outfit);
    var scene = ctx.sceneId === undefined ? 0 : ctx.sceneId;
    var key = scene + "|" + spec.id;
    var n = counts[key] || 0;
    counts[key] = n + 1;
    var prefix = "s" + scene + "-" + spec.id + "-" + n;
    var seed = ctx.seed === undefined ? hash(prefix) : ctx.seed;
    var mouth = ctx.mouth || [];
    var start = spec.start || { slot: "right" };
    var slot = start.slot === "left" || start.slot === "right" ? start.slot : null;
    if (start.slot && !slot) throw new Error("mountActor: unknown slot " + start.slot);
    if (!slot && !(Number.isFinite(start.x) && Number.isFinite(start.y))) throw new Error("mountActor: start needs {slot} or {x, y}");

    var holder = el.ownerDocument.createElement("div");
    holder.setAttribute("data-actor-id", prefix);
    holder.style.position = "absolute";
    holder.style.pointerEvents = "none";
    el.innerHTML = "";
    el.appendChild(holder);

    var last = {};
    var drawn = "";

    function frameOf(t) { return Math.max(0, Math.floor(t * 30 + 1e-6)); }

    /* Full rig state and placement at t for the caller's state s. */
    function resolve(t, s) {
      s = s || {};
      var f = frameOf(t);
      var st = Object.assign({ pose: "idle", expression: "neutral", facing: 0 }, s);
      st.character = character;
      st.outfit = s.outfit || outfit;
      st.frame = f + (ctx.offset || 0);
      st.track = mouth;
      if (s.mouth === undefined) st.mouth = mouth[f] || 0;
      if (s.blink === undefined) st.blink = P.blinkAmount(f, seed);
      if (s.breath === undefined) st.breath = Math.sin((2 * Math.PI * st.frame) / BREATH_FRAMES);
      if (slot && s.gazeBias === undefined && !s.facing) st.gazeBias = slot === "right" ? -0.25 : 0.25;
      var mult = s.scale !== undefined ? s.scale : spec.scale !== undefined ? spec.scale : 1;
      var k = (slot ? rig.SLOT.k : WORLD_K) * mult;
      var x = s.x !== undefined ? s.x : slot ? rig.SLOT[slot] : start.x;
      var y = s.y !== undefined ? s.y : slot ? rig.SLOT.feetY : start.y;
      return { st: st, k: k, x: x, y: y };
    }

    function toScreen(r, p) { return { x: r.x + p.x * r.k, y: r.y + (p.y - rig.FEET) * r.k }; }

    function update(t, s) {
      last = s || {};
      var r = resolve(t, last);
      var V = rig.VIEW;
      var svg = rig.svg(r.st, prefix);
      holder.style.left = px(r.x + V.x * r.k);
      holder.style.top = px(r.y + (V.y - rig.FEET) * r.k);
      holder.style.width = px(V.w * r.k);
      holder.style.height = px(V.h * r.k);
      if (svg !== drawn) {
        holder.innerHTML = svg.replace("<svg ", '<svg width="100%" height="100%" ');
        drawn = svg;
      }
    }

    function box(t) {
      var r = resolve(t, last);
      var b = rig.headBox(r.st);
      var p = toScreen(r, { x: b.x, y: b.y });
      return { x: p.x, y: p.y, width: b.width * r.k, height: b.height * r.k };
    }

    var anchors = {
      head: function (t) { var r = resolve(t, last); return toScreen(r, rig.head(r.st)); },
      hand: function (t) { var r = resolve(t, last); return toScreen(r, rig.hand(r.st)); },
      feet: function (t) { var r = resolve(t, last); return toScreen(r, rig.feet(r.st)); },
    };

    update(0, {});
    return { update: update, anchors: anchors, box: box, id: spec.id, prefix: prefix, character: character, el: holder };
  }

  A.mountActor = mountActor;
  A.WORLD_K = WORLD_K;
  if (root.HFKit) root.HFKit.mountActor = mountActor;
})(typeof globalThis !== "undefined" ? globalThis : window);
