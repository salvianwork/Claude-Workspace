import React from "react";
import type { Palette } from "../look";
import { armPoints, RIG, type ArmPose, type HandShape } from "../poses";

const LINE = 3;
/** Line width inside a hand (it is scaled by HAND_SCALE). */
const HLINE = 2.4;

/**
 * Hands in local space: wrist at the origin, fingers towards +y. Simplified, mitten-like
 * forms with a thumb (no individual fingers except subtle separation lines).
 */
const Hand: React.FC<{ shape: HandShape; pal: Palette }> = ({ shape, pal }) => {
  const skin = { fill: pal.skin, stroke: pal.skinLine, strokeWidth: HLINE, strokeLinejoin: "round" as const };
  const crease = { fill: "none", stroke: pal.skinDeep, strokeWidth: 2, strokeLinecap: "round" as const };
  if (shape === "open") {
    return (
      <g>
        {/* thumb, spread out */}
        <path d="M -14 10 C -26 14 -38 24 -42 36 C -45 44 -36 48 -30 42 C -24 36 -18 32 -10 30 Z" {...skin} />
        <path d="M -20 -2 C -24 14 -26 32 -24 48 C -22 64 -12 72 1 72 C 15 72 24 64 25 48 C 26 32 23 12 19 -2 Z" {...skin} />
        <path d="M -10 70 L -11 50 M 2 72 L 2 50 M 14 69 L 14 50" {...crease} />
        <path d="M -12 28 C -4 34 8 34 14 28" {...crease} opacity={0.6} />
      </g>
    );
  }
  if (shape === "fist") {
    return (
      <g>
        <rect x={-24} y={0} width={48} height={50} rx={19} {...skin} />
        <path d="M -12 48 L -12 34 M 0 50 L 0 34 M 12 48 L 12 34" {...crease} />
        {/* thumb wrapped over the fingers */}
        <path d="M -24 18 C -18 12 4 14 12 22 C 16 27 10 32 4 30 C -6 28 -16 28 -22 30 Z" {...skin} />
      </g>
    );
  }
  if (shape === "point") {
    return (
      <g>
        {/* index finger leading */}
        <path d="M -16 28 L -15 82 C -15 92 -1 92 -1 82 L 0 30 Z" {...skin} />
        <path d="M -12 76 C -9 78 -6 78 -4 76" {...crease} opacity={0.7} />
        <rect x={-22} y={0} width={46} height={46} rx={18} {...skin} />
        <path d="M 4 44 L 4 32 M 15 42 L 15 32" {...crease} />
        <path d="M -22 16 C -16 10 2 12 8 20 C 12 25 6 30 0 28 C -8 26 -16 26 -20 28 Z" {...skin} />
      </g>
    );
  }
  // relaxed: fingers loosely curled, thumb on top
  return (
    <g>
      <path d="M -19 -2 C -24 14 -24 34 -18 48 C -12 58 8 60 16 52 C 23 44 23 18 19 -2 Z" {...skin} />
      <path d="M -10 52 C -6 46 -6 40 -8 34 M 4 56 C 7 50 7 42 5 36" {...crease} opacity={0.75} />
      <path d="M 14 6 C 24 12 30 26 28 36 C 26 42 18 40 17 34 C 16 26 12 18 8 14 Z" {...skin} />
    </g>
  );
};

/**
 * Tapered limb: two circles (radius ra at a, rb at b) joined by their outer tangents.
 * One closed path, so it can carry an outline.
 */
export const capsule = (ax: number, ay: number, ra: number, bx: number, by: number, rb: number) => {
  const d = Math.max(Math.hypot(bx - ax, by - ay), Math.abs(ra - rb) + 0.01);
  const t0 = Math.atan2(by - ay, bx - ax);
  const al = Math.acos((ra - rb) / d);
  const pt = (cx: number, cy: number, r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  return (
    `M ${pt(ax, ay, ra, t0 + al)} L ${pt(bx, by, rb, t0 + al)} ` +
    `A ${rb} ${rb} 0 0 0 ${pt(bx, by, rb, t0 - al)} L ${pt(ax, ay, ra, t0 - al)} ` +
    `A ${ra} ${ra} 0 1 0 ${pt(ax, ay, ra, t0 + al)} Z`
  );
};

/** Hands are drawn a little larger than life, as in most explainer illustration. */
const HAND_SCALE = 1.3;

/**
 * Bendy sleeve (phone-ready refresh): the arm runs along one smooth curve, a quadratic from the
 * shoulder to the wrist whose control point sits a little past the elbow, so a bent arm reads soft
 * and rounded rather than as two stiff tubes. BEND sets how far the elbow is rounded toward the chord.
 */
const BEND = 0.3;
/** Capsules per half arm. */
const SEG = 8;

type Pt = { x: number; y: number };

const armCurve = (p: { s: Pt; e: Pt; w: Pt }) => {
  const mx = (p.s.x + p.w.x) / 2;
  const my = (p.s.y + p.w.y) / 2;
  const c = { x: p.e.x + BEND * (p.e.x - mx), y: p.e.y + BEND * (p.e.y - my) };
  const at = (t: number): Pt => {
    const a = (1 - t) * (1 - t);
    const b = 2 * t * (1 - t);
    const d = t * t;
    return { x: a * p.s.x + b * c.x + d * p.w.x, y: a * p.s.y + b * c.y + d * p.w.y };
  };
  const tan = (t: number): Pt => {
    const x = 2 * (1 - t) * (c.x - p.s.x) + 2 * t * (p.w.x - c.x);
    const y = 2 * (1 - t) * (c.y - p.s.y) + 2 * t * (p.w.y - c.y);
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  };
  return { at, tan };
};
type Curve = ReturnType<typeof armCurve>;

/** Sleeve radius along the arm: shoulder -> elbow (t 0.5) -> wrist. */
const armRadius = (t: number) =>
  t <= 0.5
    ? RIG.shoulderWidth / 2 + (RIG.elbowWidth / 2 - RIG.shoulderWidth / 2) * (t / 0.5)
    : RIG.elbowWidth / 2 - 1 + (RIG.wristWidth / 2 - RIG.elbowWidth / 2 + 1) * ((t - 0.5) / 0.5);

/** One path of SEG capsules along the curve from t0 to t1 (same winding, so they union), each point
 * pushed off(t) along the normal on `side` (+1 / -1), with radius rad(t). */
const chain = (cv: Curve, t0: number, t1: number, rad: (t: number) => number, off?: (t: number) => number, side = 0) => {
  const pt = (t: number) => {
    const q = cv.at(t);
    const o = off ? off(t) * side : 0;
    const g = cv.tan(t);
    return { x: q.x - g.y * o, y: q.y + g.x * o, r: rad(t) };
  };
  const d: string[] = [];
  let a = pt(t0);
  for (let i = 1; i <= SEG; i++) {
    const b = pt(t0 + ((t1 - t0) * i) / SEG);
    d.push(capsule(a.x, a.y, a.r, b.x, b.y, b.r));
    a = b;
  }
  return d.join(" ");
};

/** Sleeve outline of an arm (upper arm and forearm halves of one soft curve) in body space. */
export const armShapes = (pose: ArmPose) => {
  const p = armPoints(pose);
  const curve = armCurve(p);
  return { ...p, curve, elbow: curve.at(0.5), upper: chain(curve, 0, 0.5, armRadius), fore: chain(curve, 0.5, 1, armRadius) };
};

/** One arm (jacket sleeve, shirt cuff, hand). `mirror` draws the screen-right arm. */
export const Arm: React.FC<{ pose: ArmPose; mirror: boolean; pal: Palette }> = ({ pose, mirror, pal }) => {
  const { s, w, curve: cv, elbow: e, upper, fore } = armShapes(pose);
  const len = Math.hypot(e.x - s.x, e.y - s.y) || 1;
  const flen = Math.hypot(w.x - e.x, w.y - e.y) || 1;
  const g = cv.tan(0.5);
  const fx = g.x;
  const fy = g.y;
  // Normal pointing to the shaded side.
  const nx = -fy;
  const ny = fx;
  const handAngle = pose.elbow + pose.wrist;
  const cuffW = RIG.wristWidth - 4;
  const shadeU = (t: number) => 11 - (2 * (t - 0.12)) / 0.35;
  const shadeF = (t: number) => 9 - (2 * (t - 0.62)) / 0.3;
  const el = (pose.elbow * Math.PI) / 180;
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      {/* union outline: the sleeve reads as one soft, bent arm */}
      <g fill={pal.jacketLine} stroke={pal.jacketLine} strokeWidth={LINE * 2} strokeLinejoin="round">
        <path d={upper} />
        <path d={fore} />
      </g>
      <g fill={pal.jacket}>
        <path d={upper} />
        <path d={fore} />
      </g>
      {/* shaded undersides of the upper arm and forearm, following the curve */}
      {len > 50 ? <path d={chain(cv, 0.12, 0.47, shadeU, (t) => armRadius(t) - shadeU(t), -1)} fill={pal.jacketShade} opacity={0.85} /> : null}
      {flen > 40 ? <path d={chain(cv, 0.62, 0.92, shadeF, (t) => armRadius(t) - shadeF(t) - 4, 1)} fill={pal.jacketShade} opacity={0.85} /> : null}
      {/* elbow crease, soft */}
      <path
        d={`M ${e.x + nx * 6 - fx * 4} ${e.y + ny * 6 - fy * 4} q ${fx * 10} ${fy * 10} ${nx * 16} ${ny * 16}`}
        fill="none"
        stroke={pal.jacketLine}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.4}
      />
      {/* hand, then the shirt cuff over the wrist */}
      <g transform={`translate(${w.x - Math.sin(el) * 8} ${w.y + Math.cos(el) * 8}) rotate(${handAngle}) scale(${HAND_SCALE})`}>
        <Hand shape={pose.hand} pal={pal} />
      </g>
      <g transform={`translate(${w.x} ${w.y}) rotate(${pose.elbow})`}>
        <rect x={-cuffW / 2} y={-4} width={cuffW} height={14} rx={5} fill={pal.shirt} stroke={pal.shirtLine} strokeWidth={2.5} />
        {/* sleeve hem over the cuff */}
        <path d={`M ${-RIG.wristWidth / 2 - 1} -4 L ${RIG.wristWidth / 2 + 1} -4`} stroke={pal.jacketLine} strokeWidth={LINE} strokeLinecap="round" />
      </g>
    </g>
  );
};
