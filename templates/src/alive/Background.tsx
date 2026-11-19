import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Style } from "../schema";
import { withAlpha } from "../theme";

type Shape = { kind: "ring" | "blob" | "square" | "dots"; x: number; y: number; size: number; color: "primary" | "accent"; alpha: number; speed: number; phase: number };

/**
 * Six soft shapes that drift slowly (a few px per second) and turn gently. Calm on purpose:
 * no fast loops, no flashing. Fixed positions keep every render identical.
 */
const SHAPES: Shape[] = [
  { kind: "ring", x: 0.08, y: 0.16, size: 220, color: "primary", alpha: 0.1, speed: 0.07, phase: 0 },
  { kind: "blob", x: 0.9, y: 0.12, size: 300, color: "accent", alpha: 0.06, speed: 0.05, phase: 1.3 },
  { kind: "square", x: 0.78, y: 0.82, size: 120, color: "primary", alpha: 0.08, speed: 0.06, phase: 2.1 },
  { kind: "dots", x: 0.2, y: 0.84, size: 150, color: "accent", alpha: 0.14, speed: 0.045, phase: 3.4 },
  { kind: "blob", x: 0.45, y: 0.05, size: 220, color: "primary", alpha: 0.05, speed: 0.04, phase: 4.2 },
  { kind: "ring", x: 0.62, y: 0.55, size: 90, color: "accent", alpha: 0.08, speed: 0.08, phase: 5.0 },
  { kind: "square", x: 0.03, y: 0.58, size: 70, color: "accent", alpha: 0.08, speed: 0.07, phase: 0.7 },
];

const DriftingShape: React.FC<{ s: Shape; t: number; style: Style }> = ({ s, t, style }) => {
  const c = withAlpha(style.colors[s.color], s.alpha);
  const x = s.x * 1920 + Math.sin(t * s.speed + s.phase) * 40;
  const y = s.y * 1080 + Math.cos(t * s.speed * 0.8 + s.phase) * 28;
  const rot = Math.sin(t * s.speed * 0.6 + s.phase) * 25;
  const half = s.size / 2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      {s.kind === "ring" ? <circle r={half - 8} fill="none" stroke={c} strokeWidth={16} /> : null}
      {s.kind === "blob" ? <circle r={half} fill={c} /> : null}
      {s.kind === "square" ? <rect x={-half} y={-half} width={s.size} height={s.size} rx={s.size * 0.24} fill="none" stroke={c} strokeWidth={10} /> : null}
      {s.kind === "dots"
        ? Array.from({ length: 16 }, (_, i) => <circle key={i} cx={-half + (i % 4) * (s.size / 3)} cy={-half + Math.floor(i / 4) * (s.size / 3)} r={6} fill={c} />)
        : null}
    </g>
  );
};

/** Continuous background for the whole video: base colour, drifting glows and shapes, vignette. */
export const Background: React.FC<{ style: Style }> = ({ style }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const { background, primary, accent } = style.colors;
  const ax = 18 + Math.sin(t * 0.13) * 6;
  const ay = 22 + Math.cos(t * 0.11) * 5;
  const bx = 82 + Math.cos(t * 0.09) * 6;
  const by = 78 + Math.sin(t * 0.12) * 5;
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(circle at ${ax}% ${ay}%, ${withAlpha(primary, 0.16)} 0%, ${withAlpha(primary, 0)} 42%)`,
            `radial-gradient(circle at ${bx}% ${by}%, ${withAlpha(accent, 0.11)} 0%, ${withAlpha(accent, 0)} 40%)`,
          ].join(", "),
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${withAlpha(style.colors.text, 0.05)} 1.5px, transparent 1.5px)`,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {SHAPES.map((sh, i) => (
          <DriftingShape key={i} s={sh} t={t} style={style} />
        ))}
      </svg>
      <AbsoluteFill
        style={{ background: `radial-gradient(ellipse at center, transparent 55%, ${withAlpha(background, 0.7)} 100%)` }}
      />
    </AbsoluteFill>
  );
};
