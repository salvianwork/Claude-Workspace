import type { PresenterExpression, PresenterPose } from "../schema";

/**
 * Rig and poses of the presenter.
 *
 * Body space: x = 0 is the body's centre line, y grows downwards; the waist crop is at y = 760.
 * Arms are described for the screen-LEFT arm; the right arm is drawn mirrored. Angles are in
 * degrees: 0 = hanging straight down, 90 = out to the side, 180 = straight up; negative values
 * swing the arm across the body. `elbow` is the forearm's absolute angle (same convention).
 */

export type HandShape = "relaxed" | "open" | "fist" | "point";

export type ArmPose = {
  shoulder: number;
  elbow: number;
  hand: HandShape;
  /** Extra hand rotation relative to the forearm, degrees. */
  wrist: number;
  /** Upper-arm length factor: < 1 when the elbow comes towards the viewer (foreshortening). */
  upper: number;
};

export type Pose = {
  left: ArmPose;
  right: ArmPose;
  /** Head tilt, degrees (positive = towards screen right). */
  tilt: number;
  /** Where the eyes look, -1..1 (x: screen right, y: down). */
  gazeX: number;
  gazeY: number;
};

export const RIG = {
  shoulderX: 148,
  shoulderY: 402,
  upperArm: 146,
  forearm: 128,
  sleeveWidth: 60,
  forearmWidth: 44,
  waist: 760,
  headPivotY: 300,
} as const;

const arm = (shoulder: number, elbow: number, hand: HandShape, wrist = 0, upper = 1): ArmPose => ({
  shoulder,
  elbow,
  hand,
  wrist,
  upper,
});

const IDLE_ARM = arm(4, -70, "relaxed", -6);

export const POSES: Record<PresenterPose, Pose> = {
  // Relaxed, hands loosely together in front of the belly.
  idle: { left: IDLE_ARM, right: IDLE_ARM, tilt: 0, gazeX: 0, gazeY: 0 },
  // Explaining: one open hand raised beside the body (the Presenter alternates the hands
  // between this and its mirror while the voice speaks).
  talk: { left: arm(22, 140, "open", -24), right: IDLE_ARM, tilt: -1.5, gazeX: 0, gazeY: 0 },
  // Arm up and out towards the content, index finger leading.
  "point-left": { left: arm(62, 112, "point", -6), right: IDLE_ARM, tilt: -3, gazeX: -1, gazeY: -0.2 },
  "point-right": { left: IDLE_ARM, right: arm(62, 112, "point", -6), tilt: 3, gazeX: 1, gazeY: -0.2 },
  // Hand on chin, other arm across the belly supporting the elbow, eyes up.
  think: { left: arm(6, -84, "relaxed", -14), right: arm(-32, -145, "fist", 4, 0.62), tilt: 5, gazeX: -0.75, gazeY: -1 },
  // Both open hands up near the chest, palms out.
  surprised: { left: arm(32, 160, "open", -8), right: arm(32, 160, "open", -8), tilt: 0, gazeX: 0, gazeY: -0.1 },
  // Both fists up above the shoulders.
  celebrate: { left: arm(118, 172, "fist", 4), right: arm(118, 172, "fist", 4), tilt: 0, gazeX: 0, gazeY: -0.3 },
  // One open hand raised high, waving (the wrist rocks in the Presenter).
  wave: { left: IDLE_ARM, right: arm(132, 168, "open", 4), tilt: 2, gazeX: 0, gazeY: 0 },
};

/** The talk pose with the hands swapped (left hand down, right hand gesturing). */
export const TALK_MIRROR: Pose = { ...POSES.talk, left: POSES.talk.right, right: POSES.talk.left, tilt: 1.5 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

const blendArm = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({
  shoulder: lerp(a.shoulder, b.shoulder, t),
  elbow: lerp(a.elbow, b.elbow, t),
  wrist: lerp(a.wrist, b.wrist, t),
  upper: lerp(a.upper, b.upper, t),
  hand: t < 0.5 ? a.hand : b.hand,
});

/** Blend two poses (t: 0 = a, 1 = b, eased). */
export const blendPoses = (a: Pose, b: Pose, t: number): Pose => {
  const s = smooth(t);
  return {
    left: blendArm(a.left, b.left, s),
    right: blendArm(a.right, b.right, s),
    tilt: lerp(a.tilt, b.tilt, s),
    gazeX: lerp(a.gazeX, b.gazeX, s),
    gazeY: lerp(a.gazeY, b.gazeY, s),
  };
};

export const poseAt = (from: PresenterPose, to: PresenterPose, t: number) => blendPoses(POSES[from], POSES[to], t);

/** Shoulder, elbow and wrist positions of an arm in body space (screen-left arm). */
export const armPoints = (a: ArmPose) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const s = { x: -RIG.shoulderX, y: RIG.shoulderY };
  const e = { x: s.x - RIG.upperArm * a.upper * Math.sin(rad(a.shoulder)), y: s.y + RIG.upperArm * a.upper * Math.cos(rad(a.shoulder)) };
  const w = { x: e.x - RIG.forearm * Math.sin(rad(a.elbow)), y: e.y + RIG.forearm * Math.cos(rad(a.elbow)) };
  return { s, e, w };
};

// ---------- face ----------

export type MouthShape = "closed" | "slight" | "open" | "wide";

/** Mouth shape for a loudness value 0–1: <0.15 closed, <0.4 slight, <0.7 open, else wide. */
export const mouthShape = (v: number): MouthShape => (v < 0.15 ? "closed" : v < 0.4 ? "slight" : v < 0.7 ? "open" : "wide");

export type Brow = { raise: number; inner: number; arch: number };

export type Face = {
  browL: Brow;
  browR: Brow;
  /** Eye opening, 1 = normal. */
  eyeOpen: number;
  /** Lower-lid lift (smiling eyes), 0–1. */
  squint: number;
  /** Mouth corner lift (smile) in body units; negative = down. */
  smile: number;
  /** Closed-mouth width factor. */
  mouthWidth: number;
  /** Closed mouth is a small "o" (surprised). */
  oh: number;
  blush: number;
};

const brow = (raise: number, inner: number, arch: number): Brow => ({ raise, inner, arch });

export const EXPRESSIONS: Record<PresenterExpression, Face> = {
  neutral: { browL: brow(0, 0, 5), browR: brow(0, 0, 5), eyeOpen: 1, squint: 0.1, smile: 4, mouthWidth: 0.9, oh: 0, blush: 0.12 },
  happy: { browL: brow(-5, -1, 8), browR: brow(-5, -1, 8), eyeOpen: 0.95, squint: 0.45, smile: 11, mouthWidth: 1.15, oh: 0, blush: 0.32 },
  curious: { browL: brow(-12, -4, 9), browR: brow(1, 3, 4), eyeOpen: 1.05, squint: 0.05, smile: 3, mouthWidth: 0.8, oh: 0, blush: 0.12 },
  surprised: { browL: brow(-15, -6, 11), browR: brow(-15, -6, 11), eyeOpen: 1.28, squint: 0, smile: 0, mouthWidth: 0.7, oh: 1, blush: 0.12 },
  thinking: { browL: brow(-7, 6, 6), browR: brow(2, 7, 3), eyeOpen: 0.86, squint: 0.15, smile: -1, mouthWidth: 0.75, oh: 0, blush: 0.08 },
};

const blendBrow = (a: Brow, b: Brow, t: number): Brow => ({
  raise: lerp(a.raise, b.raise, t),
  inner: lerp(a.inner, b.inner, t),
  arch: lerp(a.arch, b.arch, t),
});

export const faceAt = (from: PresenterExpression, to: PresenterExpression, t: number): Face => {
  const a = EXPRESSIONS[from];
  const b = EXPRESSIONS[to];
  const s = smooth(t);
  return {
    browL: blendBrow(a.browL, b.browL, s),
    browR: blendBrow(a.browR, b.browR, s),
    eyeOpen: lerp(a.eyeOpen, b.eyeOpen, s),
    squint: lerp(a.squint, b.squint, s),
    smile: lerp(a.smile, b.smile, s),
    mouthWidth: lerp(a.mouthWidth, b.mouthWidth, s),
    oh: lerp(a.oh, b.oh, s),
    blush: lerp(a.blush, b.blush, s),
  };
};
