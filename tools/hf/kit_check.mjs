// Checks shots.json scenes with the kit's own pure functions, so Python validation uses the same
// maths as the composition: kit scene validate / validateCues / plan, prop meta (anchors, phases),
// presenter poses and expressions, transitions, and the camera plan (resolveCamera ->
// cameraOverrun) with the limits the composition uses (kit scenes: KIT_CAMERA; heroes: defaults).
//
//   node tools/hf/kit_check.mjs < request.json > report.json
//
// request = {kit: "<hf-kit dir>", style: {...} | null, canvas?: {width, height}, scenes: [{id, kind, scene?, prop?, module?,
//            props?, params?, cues, camera, presenter, transition?, duration, words}]}
//   module = path of the prop script to load for a hero (library prop.js or the run's
//   04-video/hf/scenes/scene-<id>.js).
//   Schema 2 (world scenes): request.cast = the top-level cast, and scenes [{id, kind: "world",
//   world: <the shots.json scene>, words, duration, transition?, place_module, place_label,
//   scene_module?, scene_label?, customs_unchecked?}]. place_module is the library place.js or the
//   run's scenes/place-<name>.js; scene_module (scenes/scene-<id>.js) registers HFKit.customs;
//   customs_unchecked (shots validate --no-modules) accepts any custom name. Checked with
//   HFKit.validateWorld (errors, camera overrun > 0.25 s included) and HFKit.compileMoves (its
//   warnings; an overrun up to 0.25 s warns); a place with meta.notToScale needs a "not to scale"
//   tag or label. World errors already name their scene ("scene 2 beat 0 move 1 (...)").
//   canvas: the composition size (shots.json format; default 1920 x 1080), set with HFKit.setCanvas
//   after the kit scripts load, so the camera and framing maths run in the video's frame.
// report  = {scenes: [{id, errors: [...], warnings: [...], overrun: seconds | null, canvas: {width, height}}]}
// Called by tools/hf/shots.py. Kit files are classic scripts (globalThis.HFKit), loaded with vm.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const OVERRUN_FAIL = 0.25; // seconds: more than this fails the scene, above 0 warns
const LABEL_MAX = 28;

const req = JSON.parse(readFileSync(0, "utf8"));
const load = (file) => vm.runInThisContext(readFileSync(file, "utf8"), { filename: file });

// kit.js lists every kit script in load order
load(join(req.kit, "src", "kit.js"));
for (const s of globalThis.HFKit.SCRIPTS.slice(1)) load(join(req.kit, s));
const K = globalThis.HFKit;
const P = K.presenter;
K.setCanvas(req.canvas);

const loaded = new Map(); // module path -> error message | null
function loadModule(file) {
  if (!loaded.has(file)) {
    try { load(file); loaded.set(file, null); } catch (e) { loaded.set(file, String(e && e.message || e)); }
  }
  return loaded.get(file);
}

function checkPresenter(pr, errs) {
  if (pr === undefined) return;
  if (!pr || typeof pr !== "object" || Array.isArray(pr)) { errs.push("presenter must be an object"); return; }
  const pos = pr.position === undefined ? "none" : pr.position;
  if (!["left", "right", "none"].includes(pos)) errs.push(`presenter position must be left, right or none (got ${pr.position})`);
  if (pr.size !== undefined && !Object.keys(K.PRESENTER_WIDTH).includes(pr.size))
    errs.push(`presenter size must be one of ${Object.keys(K.PRESENTER_WIDTH).join(", ")} (got ${pr.size})`);
  if (pr.pose !== undefined && !P.PRESENTER_POSES.includes(pr.pose))
    errs.push(`presenter pose must be one of ${P.PRESENTER_POSES.join(", ")} (got ${pr.pose})`);
  if (pr.expression !== undefined && !P.PRESENTER_EXPRESSIONS.includes(pr.expression))
    errs.push(`presenter expression must be one of ${P.PRESENTER_EXPRESSIONS.join(", ")} (got ${pr.expression})`);
  if (pr.outfit !== undefined && !P.PRESENTER_OUTFITS.includes(pr.outfit))
    errs.push(`presenter outfit must be one of ${P.PRESENTER_OUTFITS.join(", ")} (got ${pr.outfit})`);
}

function overrunOf(keys, norm, limits, duration, out) {
  const o = K.cameraOverrun(keys, norm, limits, duration);
  out.overrun = o;
  if (o > OVERRUN_FAIL) out.errors.push(`camera finishes ${o.toFixed(2)} s after the scene ends (limit ${OVERRUN_FAIL} s): move the keys earlier or make the moves smaller`);
  else if (o > 0) out.warnings.push(`camera finishes ${o.toFixed(2)} s after the scene ends (the end of the move is cut)`);
}

function checkKit(s, out) {
  const def = K.scenes[s.scene];
  if (!def) { out.errors.push(`unknown kit scene ${s.scene} (have: ${K.SCENE_NAMES.join(", ")})`); return; }
  const errs = def.validate(s.props);
  if (!errs.length) errs.push(...def.validateCues(s.props, s.cues));
  if (errs.length) { out.errors.push(...errs); return; }
  const plan = def.plan({ props: s.props, style: req.style, words: s.words, cues: s.cues, duration: s.duration, presenter: s.presenter, sceneId: s.id });
  const norm = K.normaliseAnchors(plan.anchors, K.kitFrame().origin);
  const keys = K.resolveCamera(s.camera, s.words, s.id, norm);
  overrunOf(keys, norm, K.sceneKit.KIT_CAMERA, s.duration, out);
}

function checkHero(s, out) {
  const bad = loadModule(s.module);
  if (bad) { out.errors.push(`${s.module_label || s.module} failed to load: ${bad}`); return; }
  const prop = K.props[s.prop];
  if (!prop || !prop.meta || typeof prop.mount !== "function") {
    out.errors.push(`${s.module_label || s.module} does not register HFKit.props["${s.prop}"] = {meta, mount}`); return;
  }
  const meta = prop.meta;
  const names = Array.isArray(meta.anchors) ? meta.anchors : [];
  const phases = meta.phases && typeof meta.phases === "object" ? Object.keys(meta.phases) : null;
  s.cues.forEach((c, k) => {
    if (c.show === "label" || c.show === "highlight") {
      if (!names.includes(c.target)) out.errors.push(`cue ${k}: ${c.show} target ${c.target} is not an anchor of ${s.prop} (have: ${names.join(", ")})`);
      if (c.show === "label" && String(c.text || c.target || "").length > LABEL_MAX) out.errors.push(`cue ${k}: label text has at most ${LABEL_MAX} characters`);
    } else if (c.show === "phase") {
      if (phases && !phases.includes(c.target)) out.errors.push(`cue ${k}: phase ${c.target} is not a phase of ${s.prop} (have: ${phases.join(", ")})`);
    }
  });
  if (out.errors.length) return;
  if (typeof prop.anchorsFor !== "function") {
    // anchors only exist once mounted (DOM): check the names, not the timing
    const fake = {};
    names.forEach((n) => { fake[n] = { x: 0.5, y: 0.5 }; });
    K.resolveCamera(s.camera, s.words, s.id, fake);
    if (s.camera.length) out.warnings.push(`camera timing NOT checked (add anchorsFor): prop ${s.prop} has no anchorsFor(params)`);
    return;
  }
  const params = Object.assign({}, s.params || {});
  params.phases = Object.assign({}, params.phases || {}, K.phaseTimes(s.cues, s.words, s.id));
  const norm = K.normaliseAnchors(prop.anchorsFor(params), meta.frame);
  const keys = K.resolveCamera(s.camera, s.words, s.id, norm);
  overrunOf(keys, norm, undefined, s.duration, out);
}

const NOT_TO_SCALE = /\bnot\s+to\s+scale\b/i;

function hasNotToScale(scene) {
  return (scene.beats || []).some((b) => b && (b.moves || []).some((mv) =>
    mv && (mv.do === "tag_follow" || mv.do === "label") && NOT_TO_SCALE.test(String(mv.text || ""))));
}

function checkWorld(s, out) {
  const scene = s.world, name = scene.place;
  const bad = loadModule(s.place_module);
  if (bad) { out.errors.push(`${s.place_label} failed to load: ${bad}`); return; }
  const P = K.places[name];
  if (!P || !P.meta || typeof P.anchorsFor !== "function" || typeof P.mount !== "function") {
    out.errors.push(`${s.place_label} does not register HFKit.places["${name}"] = {meta, anchorsFor, mount}`); return;
  }
  if (s.scene_module) {
    const badMod = loadModule(s.scene_module);
    if (badMod) { out.errors.push(`${s.scene_label} failed to load: ${badMod}`); return; }
  }
  // --no-modules: custom pieces are not written yet, so any name passes
  const customs = s.customs_unchecked ? new Proxy({}, { get: (o, k) => (typeof k === "string" ? {} : undefined) }) : K.customs;
  const opts = { cast: req.cast, duration: s.duration, customs };
  out.errors.push(...K.validateWorld(scene, s.words, opts));
  const w = K.worldFor(scene, opts);
  if (!w.fatal) {
    const c = K.compileMoves(scene, s.words, w);
    out.warnings.push(...c.warnings);
    out.overrun = c.overrun;
    if (c.overrun > 0 && c.overrun <= OVERRUN_FAIL)
      out.warnings.push(`camera finishes ${c.overrun.toFixed(2)} s after the scene ends (the end of the move is cut)`);
  }
  if (K.isVertical()) { // vertical captions: at most 2 lines in 860 px (Review Focus 3); a word wider than a line can't wrap
    K.captionPages(s.words).filter((pg) => pg.over).forEach((pg) =>
      out.warnings.push(`caption word "${pg.words[0].display || pg.words[0].text}" is wider than the ${K.VERTICAL_CAPTION.maxWidth} px caption line (the pill breaks it); reword the narration`));
  }
  if (P.meta.notToScale && !hasNotToScale(scene))
    out.errors.push(`place ${name} is not to scale: add a "not to scale" tag or label to the scene`);
}

const report = { scenes: [] };
for (const s of req.scenes) {
  const out = { id: s.id, errors: [], warnings: [], overrun: null, canvas: { width: K.CANVAS.width, height: K.CANVAS.height } };
  s.cues = s.cues || [];
  s.camera = s.camera || [];
  if (s.kind !== "world") checkPresenter(s.presenter, out.errors);
  if (s.transition !== undefined && !K.blocks.TRANSITIONS.includes(s.transition))
    out.errors.push(`transition must be one of ${K.blocks.TRANSITIONS.join(", ")} (got ${s.transition})`);
  try {
    if (s.kind === "world") checkWorld(s, out); else if (s.kind === "kit") checkKit(s, out); else checkHero(s, out);
  } catch (e) {
    out.errors.push(String(e && e.message || e).replace(/^scene \S+: /, ""));
  }
  report.scenes.push(out);
}
process.stdout.write(JSON.stringify(report));
