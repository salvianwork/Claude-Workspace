// Checks shots.json scenes with the kit's own pure functions, so Python validation uses the same
// maths as the composition: kit scene validate / validateCues / plan, prop meta (anchors, phases),
// presenter poses and expressions, transitions, and the camera plan (resolveCamera ->
// cameraOverrun) with the limits the composition uses (kit scenes: KIT_CAMERA; heroes: defaults).
//
//   node tools/hf/kit_check.mjs < request.json > report.json
//
// request = {kit: "<hf-kit dir>", style: {...} | null, scenes: [{id, kind, scene?, prop?, module?,
//            props?, params?, cues, camera, presenter, transition?, duration, words}]}
//   module = path of the prop script to load for a hero (library prop.js or the run's
//   04-video/hf/scenes/scene-<id>.js).
// report  = {scenes: [{id, errors: [...], warnings: [...], overrun: seconds | null}]}
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

const report = { scenes: [] };
for (const s of req.scenes) {
  const out = { id: s.id, errors: [], warnings: [], overrun: null };
  s.cues = s.cues || [];
  s.camera = s.camera || [];
  checkPresenter(s.presenter, out.errors);
  if (s.transition !== undefined && !K.blocks.TRANSITIONS.includes(s.transition))
    out.errors.push(`transition must be one of ${K.blocks.TRANSITIONS.join(", ")} (got ${s.transition})`);
  try {
    if (s.kind === "kit") checkKit(s, out); else checkHero(s, out);
  } catch (e) {
    out.errors.push(String(e && e.message || e).replace(/^scene \S+: /, ""));
  }
  report.scenes.push(out);
}
process.stdout.write(JSON.stringify(report));
