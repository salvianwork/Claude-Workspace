import React from "react";
import type { Palette } from "../look";

type Curl = readonly [x: number, y: number, r: number];

/** Dark back layer: gives the curly mop its depth and scalloped silhouette. */
const BACK: Curl[] = [
  [-98, 152, 26], [-103, 122, 30], [-90, 90, 32], [-62, 70, 34], [-24, 60, 36], [16, 58, 36],
  [54, 66, 34], [85, 87, 31], [101, 113, 28], [103, 143, 24], [95, 168, 18],
];

/** Front curls in groups that sway with their own phase; drawn back to front. */
const CLUSTERS: { pivot: [number, number]; phase: number; curls: Curl[] }[] = [
  // Left (fuller side: the slight 3/4 turn shows more hair on the left).
  { pivot: [-62, 140], phase: 0, curls: [[-84, 112, 28], [-62, 92, 30], [-90, 141, 24], [-66, 122, 24], [-82, 166, 17]] },
  // Top.
  { pivot: [0, 124], phase: 1.7, curls: [[-28, 78, 32], [8, 73, 32], [42, 82, 30], [-34, 106, 26], [2, 99, 28], [36, 107, 26]] },
  // Right.
  { pivot: [60, 140], phase: 3.1, curls: [[69, 100, 28], [87, 126, 23], [64, 127, 22], [82, 155, 16]] },
  // Fringe along the hairline, with two curls dipping onto the forehead.
  {
    pivot: [0, 132],
    phase: 4.4,
    curls: [[-60, 149, 18], [-38, 143, 19], [-14, 139, 20], [10, 139, 19], [33, 143, 18], [54, 149, 17], [-24, 161, 11], [21, 159, 9]],
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
    <ellipse cx={0} cy={128} rx={94} ry={66} fill={pal.hairShade} />
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
        d={`M ${s * 87} 156 L ${s * 72} 156 L ${s * 76} 208 C ${s * 80} 212 ${s * 84} 212 ${s * 86} 206 Z`}
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
