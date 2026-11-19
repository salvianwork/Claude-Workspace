import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Style } from "../schema";
import { withAlpha } from "../theme";

/** Continuous background for the whole video: base colour, two slowly drifting glows, vignette. */
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
      <AbsoluteFill
        style={{ background: `radial-gradient(ellipse at center, transparent 55%, ${withAlpha(background, 0.7)} 100%)` }}
      />
    </AbsoluteFill>
  );
};
