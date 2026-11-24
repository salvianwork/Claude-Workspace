import React from "react";
import type { Palette } from "../look";
import { mouthShape, type Brow, type Face as FaceParams } from "../poses";

const EYE_X = 35;
const EYE_Y = 226;
const EYE_RX = 13.5;
const EYE_RY = 13.5;

/** Flat square translucent lime acetate glasses (wayfarer-square), lenses centred on the eyes. */
const LENS_Y = EYE_Y + 1;
const LENS_IH = 37;
const LENS_TOP_W = 50;
const LENS_BOT_W = 45;
const RIM_T = 8.4;
const RIM_TOP = 11;
const RIM_NOSE = 3.5;

/** Rounded polygon path: points [x, y, radius]. */
const roundPoly = (pts: [number, number, number][]) => {
  const n = pts.length;
  let d = "";
  pts.forEach((p, i) => {
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const near = (q: [number, number, number]) => {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = Math.min(p[2], l / 2) / l;
      return [p[0] + dx * k, p[1] + dy * k];
    };
    const s0 = near(a);
    const s1 = near(b);
    d += `${i ? " L " : "M "}${s0[0].toFixed(2)} ${s0[1].toFixed(2)} Q ${p[0]} ${p[1]} ${s1[0].toFixed(2)} ${s1[1].toFixed(2)}`;
  });
  return d + " Z";
};

const Eye: React.FC<{
  pal: Palette;
  side: -1 | 1;
  face: FaceParams;
  blink: number;
  gazeX: number;
  gazeY: number;
  uid: string;
}> = ({ pal, side, face, blink, gazeX, gazeY, uid }) => {
  const cx = side * EYE_X;
  const open = face.eyeOpen * (1 - blink);
  const top = Math.max(0.6, EYE_RY * open);
  // Lower lid rises with a smile ("smiling eyes") and closes with the blink as well.
  const bottom = Math.max(0.6, EYE_RY * (1 - face.squint * 0.6) * (0.25 + 0.75 * (1 - blink)));
  const d = `M ${cx - EYE_RX} ${EYE_Y} A ${EYE_RX} ${top} 0 0 1 ${cx + EYE_RX} ${EYE_Y} A ${EYE_RX} ${bottom} 0 0 1 ${cx - EYE_RX} ${EYE_Y} Z`;
  const clip = `${uid}-eye${side}`;
  const iris = 9.5 * (face.eyeOpen > 1.15 ? 0.84 : 1);
  const ix = cx + gazeX * 4.5;
  const iy = EYE_Y + gazeY * 4.5 + 1;
  const shut = blink > 0.82;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      {shut ? null : (
        <>
          <path d={d} fill={pal.eyeWhite} />
          <g clipPath={`url(#${clip})`}>
            <circle cx={ix} cy={iy} r={iris} fill={pal.eye} />
            <circle cx={ix} cy={iy} r={iris * 0.5} fill="#120A08" />
            <circle cx={ix - iris * 0.34} cy={iy - iris * 0.38} r={iris * 0.24} fill="#FFFFFF" />
            {/* upper-lid shadow on the eyeball */}
            <ellipse cx={cx} cy={EYE_Y - top} rx={EYE_RX + 2} ry={5} fill={pal.skinDeep} opacity={0.35} />
          </g>
        </>
      )}
      {/* Upper lid line with a small lash flick at the outer corner. */}
      <path
        d={`M ${cx - EYE_RX - 1} ${EYE_Y + 1} A ${EYE_RX + 1} ${top + 1} 0 0 1 ${cx + EYE_RX + 1} ${EYE_Y + 1}`}
        fill="none"
        stroke={pal.hairLine}
        strokeWidth={shut ? 4.5 : 4}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + side * (EYE_RX + 0.5)} ${EYE_Y - (shut ? -1 : 2)} l ${side * 5} ${-4}`}
        stroke={pal.hairLine}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      {/* faint lower lid */}
      {shut ? null : (
        <path
          d={`M ${cx - EYE_RX + 3} ${EYE_Y + bottom * 0.7} Q ${cx} ${EYE_Y + bottom + 3} ${cx + EYE_RX - 3} ${EYE_Y + bottom * 0.7}`}
          fill="none"
          stroke={pal.skinDeep}
          strokeWidth={2.2}
          strokeLinecap="round"
          opacity={0.7}
        />
      )}
    </g>
  );
};

const Eyebrow: React.FC<{ pal: Palette; side: -1 | 1; b: Brow }> = ({ pal, side, b }) => {
  const inner = { x: side * 14, y: 194 + b.raise + b.inner };
  const outer = { x: side * 56, y: 196 + b.raise };
  const mid = { x: side * 35, y: 188 + b.raise - b.arch };
  // Tapered brow: thick at the inner end, thin at the outer end.
  const d =
    `M ${inner.x} ${inner.y + 4} Q ${mid.x} ${mid.y + 4} ${outer.x} ${outer.y + 1.5} ` +
    `Q ${outer.x + side * 1.5} ${outer.y - 1.5} ${outer.x - side * 1} ${outer.y - 2.5} ` +
    `Q ${mid.x} ${mid.y - 5} ${inner.x} ${inner.y - 5} Q ${inner.x - side * 4} ${inner.y} ${inner.x} ${inner.y + 4} Z`;
  return <path d={d} fill={pal.hair} stroke={pal.hairLine} strokeWidth={2} strokeLinejoin="round" />;
};

/** Mouth for loudness `v` (0–1), shaped by the expression. */
const Mouth: React.FC<{ pal: Palette; face: FaceParams; v: number; uid: string }> = ({ pal, face, v, uid }) => {
  const shape = mouthShape(v);
  const y0 = 283 - face.smile * 0.35;
  if (shape === "closed") {
    if (face.oh > 0.5) {
      return (
        <g>
          <ellipse cx={2} cy={287} rx={8} ry={10} fill={pal.mouthIn} stroke={pal.lip} strokeWidth={3} />
          <ellipse cx={2} cy={292} rx={4.5} ry={3.5} fill={pal.tongue} />
        </g>
      );
    }
    const w = 21 * face.mouthWidth;
    return (
      <g>
        <path
          d={`M ${-w + 2} ${y0} Q 2 ${y0 + face.smile * 1.6 + 2} ${w + 2} ${y0 - 1}`}
          fill="none"
          stroke={pal.lip}
          strokeWidth={5}
          strokeLinecap="round"
        />
        {/* lower lip hint */}
        <path d={`M -6 ${y0 + face.smile * 0.8 + 10} Q 2 ${y0 + face.smile * 0.8 + 13} 10 ${y0 + face.smile * 0.8 + 10}`} fill="none" stroke={pal.skinDeep} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      </g>
    );
  }
  const k = shape === "slight" ? 0 : shape === "open" ? 1 : 2;
  const h = [12, 19, 27][k] * (1 + face.oh * 0.25);
  const w = [17, 21, 25][k] * (1 - face.oh * 0.3) * (0.9 + 0.1 * face.mouthWidth);
  const lift = face.smile * 0.45;
  const top = y0 - lift * 0.3;
  const d =
    `M ${-w + 2} ${top} Q 2 ${top + 4 - face.oh * 6} ${w + 2} ${top} ` +
    `C ${w + 1} ${top + h * 1.1} ${-w + 3} ${top + h * 1.1} ${-w + 2} ${top} Z`;
  const clip = `${uid}-mouth`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={pal.mouthIn} />
      <g clipPath={`url(#${clip})`}>
        <rect x={-w} y={top - 6} width={w * 2 + 4} height={6 + Math.min(8, h * 0.32)} rx={3} fill={pal.teeth} />
        <ellipse cx={2} cy={top + h * 0.95} rx={w * 0.62} ry={h * 0.42} fill={pal.tongue} />
      </g>
      <path d={d} fill="none" stroke={pal.lip} strokeWidth={3.5} strokeLinejoin="round" />
    </g>
  );
};

/** Flat lime acetate frames: each rim is a filled band (outer shape minus the lens opening) in translucent
 * lime with a lighter inner edge and a thin darker outer edge, a straight bridge, flat temple arms and a
 * hinge rivet at each outer top corner. Lenses are clear. */
const Glasses: React.FC<{ pal: Palette }> = ({ pal }) => {
  const tw = LENS_TOP_W / 2;
  const bw = LENS_BOT_W / 2;
  const ih = LENS_IH / 2;
  const T = RIM_T;
  const TT = RIM_TOP;
  const inner = roundPoly([[-tw, -ih, 2.5], [tw, -ih, 2.5], [bw, ih, 6], [-bw, ih, 6]]);
  const op = 0.93;
  const ox = tw + T;
  return (
    <g data-glasses="lime-thick">
      {([-1, 1] as const).map((sd) => {
        const cx = sd * EYE_X;
        // the rim is thinner on the nose side so the two rims meet at the bridge without overlapping
        const lo = sd < 0 ? T : RIM_NOSE;
        const ro = sd < 0 ? RIM_NOSE : T;
        const outer = roundPoly([[-tw - lo, -ih - TT, 4], [tw + ro, -ih - TT, 4], [bw + ro, ih + (T + RIM_NOSE) / 2, 9], [-bw - lo, ih + (T + RIM_NOSE) / 2, 9]]);
        const arm = `M ${sd * (EYE_X + ox - 1)} ${LENS_Y - ih - 5} L ${sd * 90} ${LENS_Y - ih - 2} L ${sd * 90} ${LENS_Y - ih + 7} L ${sd * (EYE_X + ox - 1)} ${LENS_Y - ih + 5} Z`;
        return (
          <g key={sd}>
            <path d={arm} fill={pal.glasses} opacity={op} stroke={pal.glassesEdge} strokeWidth={1.4} strokeLinejoin="round" />
            <g transform={`translate(${cx} ${LENS_Y})`}>
              <path d={inner} fill="#DCEBFF" opacity={0.08} />
              <path d={`${outer} ${inner}`} fill={pal.glasses} opacity={op} fillRule="evenodd" />
              <path d={outer} fill="none" stroke={pal.glassesEdge} strokeWidth={1.6} strokeLinejoin="round" />
              <path d={inner} fill="none" stroke={pal.glassesLight} strokeWidth={1.5} strokeLinejoin="round" />
              <path d={`M ${-tw + 6} ${-ih - TT / 2} L ${tw - 18} ${-ih - TT / 2}`} stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" opacity={0.4} />
              <circle cx={sd * (tw + T - 3.4)} cy={-ih - TT / 2 + 0.6} r={2} fill={pal.glassesLight} stroke={pal.glassesEdge} strokeWidth={0.9} />
            </g>
          </g>
        );
      })}
      <path d={`M -10 ${LENS_Y - ih - 8} L 10 ${LENS_Y - ih - 8} L 10 ${LENS_Y - ih + 1} L -10 ${LENS_Y - ih + 1} Z`} fill={pal.glasses} opacity={op} stroke={pal.glassesEdge} strokeWidth={1.2} />
    </g>
  );
};

export const Face: React.FC<{
  pal: Palette;
  face: FaceParams;
  mouth: number;
  blink: number;
  gazeX: number;
  gazeY: number;
  glasses: "lime-thick" | false;
  uid: string;
}> = ({ pal, face, mouth, blink, gazeX, gazeY, glasses, uid }) => (
  <g>
    {/* blush */}
    <ellipse cx={-54} cy={262} rx={16} ry={9} fill={pal.blush} opacity={face.blush} />
    <ellipse cx={56} cy={262} rx={15} ry={9} fill={pal.blush} opacity={face.blush * 0.85} />
    <Eye pal={pal} side={-1} face={face} blink={blink} gazeX={gazeX} gazeY={gazeY} uid={uid} />
    <Eye pal={pal} side={1} face={face} blink={blink} gazeX={gazeX} gazeY={gazeY} uid={uid} />
    <Eyebrow pal={pal} side={-1} b={face.browL} />
    <Eyebrow pal={pal} side={1} b={face.browR} />
    {/* nose: soft shadow on the side turned from the light */}
    <path d="M 4 236 C 10 247 16 256 11 263 C 7 268 -3 268 -9 264" fill="none" stroke={pal.skinDeep} strokeWidth={4.5} strokeLinecap="round" />
    <ellipse cx={-2} cy={258} rx={5} ry={3.5} fill={pal.skinLight} opacity={0.6} />
    <g transform="translate(2 286) scale(1.22) translate(-2 -286)">
      <Mouth pal={pal} face={face} v={mouth} uid={uid} />
    </g>
    {glasses ? <Glasses pal={pal} /> : null}
  </g>
);
