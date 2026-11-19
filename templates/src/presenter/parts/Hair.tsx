import React from "react";
import type { Palette } from "../look";

type Curl = readonly [x: number, y: number, r: number];

/** Dark back layer: gives the (short, neat) curly crop its depth and scalloped silhouette. */
const BACK: Curl[] = [
  [-94, 166, 17], [-99, 140, 22], [-93, 112, 24], [-76, 90, 24], [-50, 76, 25], [-18, 70, 25], [16, 70, 25],
  [48, 75, 25], [75, 88, 24], [93, 110, 23], [99, 138, 21], [94, 164, 16],
];

/** Front curls in groups that sway with their own phase; drawn back to front. Small and tight. */
const CLUSTERS: { pivot: [number, number]; phase: number; curls: Curl[] }[] = [
  // Left side.
  { pivot: [-62, 140], phase: 0, curls: [[-80, 112, 19], [-62, 94, 19], [-88, 138, 16], [-68, 120, 17], [-86, 160, 12]] },
  // Top.
  { pivot: [0, 124], phase: 1.7, curls: [[-38, 86, 19], [-6, 81, 20], [26, 82, 19], [54, 93, 18], [-24, 106, 18], [8, 103, 18], [38, 108, 17]] },
  // Right side.
  { pivot: [60, 140], phase: 3.1, curls: [[74, 110, 18], [86, 134, 16], [64, 130, 15], [86, 158, 12]] },
  // Neat fringe along the hairline.
  {
    pivot: [0, 132],
    phase: 4.4,
    curls: [[-62, 146, 14], [-42, 140, 15], [-20, 137, 15], [3, 136, 15], [26, 138, 15], [48, 142, 14], [66, 148, 12]],
  },
];

const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

const CurlBlob: React.FC<{ c: Curl; pal: Palette; i: number }> = ({ c: [x, y, r], pal, i }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={pal.hair} stroke={pal.hairLine} strokeWidth={2.5} />
    {/* shade on the lower right of every curl */}
    <path d={arc(x, y, r - r * 0.18, 10, 120)} fill="none" stroke={pal.hairShade} strokeWidth={r * 0.26} strokeLinecap="round" opacity={0.9} />
    {/* highlight "C" on the upper left: this is what makes it read as curls */}
    {r > 12 ? (
      <path
        d={arc(x - r * 0.05, y - r * 0.02, r * 0.52, 175 + (i % 3) * 12, 285 + (i % 2) * 18)}
        fill="none"
        stroke={pal.hairLight}
        strokeWidth={Math.max(2.5, r * 0.15)}
        strokeLinecap="round"
      />
    ) : null}
    {r > 24 ? <circle cx={x + r * 0.08} cy={y + r * 0.06} r={r * 0.12} fill={pal.hairLight} opacity={0.7} /> : null}
  </g>
);

/** Back hair (behind the face). */
export const HairBack: React.FC<{ pal: Palette; sway: (phase: number) => number }> = ({ pal, sway }) => (
  <g transform={`rotate(${sway(0.8) * 0.5} 0 140)`}>
    <ellipse cx={0} cy={130} rx={92} ry={60} fill={pal.hairShade} />
    {BACK.map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill={pal.hairShade} stroke={pal.hairLine} strokeWidth={2.5} />
    ))}
  </g>
);

/** Sideburns and the curly top, in front of the face. */
export const HairFront: React.FC<{ pal: Palette; sway: (phase: number) => number }> = ({ pal, sway }) => (
  <g>
    {[-1, 1].map((s) => (
      <path
        key={s}
        d={`M ${s * 88} 156 L ${s * 74} 156 L ${s * 77} 196 C ${s * 80} 200 ${s * 85} 200 ${s * 87} 194 Z`}
        fill={pal.hair}
        stroke={pal.hairLine}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    ))}
    {CLUSTERS.map((cl, ci) => (
      <g key={ci} transform={`rotate(${sway(cl.phase)} ${cl.pivot[0]} ${cl.pivot[1]})`}>
        {cl.curls.map((c, i) => (
          <CurlBlob key={i} c={c} pal={pal} i={i + ci} />
        ))}
      </g>
    ))}
  </g>
);
