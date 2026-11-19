import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ease, pop, progress, revealFrames } from "../anim";
import { Heading } from "../components/Heading";
import type { PropsOf } from "../schema";
import { CANVAS, contentBox, fontStack, headingHeight, pickScale, SAFE, textLines, useScene, withAlpha } from "../theme";

const Check: React.FC<{ t: number; size: number; color: string; stroke: string }> = ({ t, size, color, stroke }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
    <circle cx="24" cy="24" r="22" fill={color} />
    <path
      d="M14 25 l7 7 l13 -15"
      fill="none"
      stroke={stroke}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - t}
    />
  </svg>
);

export const Recap: React.FC<PropsOf<"Recap">> = ({ title, points }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, durationInFrames } = useScene();
  const { colors, fonts, sizes } = style;
  const starts = revealFrames(points.length, durationInFrames, 0.7, 14);
  const gap = points.length >= 5 ? 22 : 30;
  const headH = headingHeight(style, title, true) + 40;
  const cardHeight = (sz: number) =>
    80 +
    points.reduce((h, p) => h + textLines(p, sz, CANVAS.width - 2 * SAFE - 104 - sz * 1.3 - 28) * sz * 1.28, 0) +
    gap * (points.length - 1);
  const size = Math.round(sizes.body * pickScale((s) => headH + cardHeight(sizes.body * s) <= contentBox(style).height));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <Heading text={title} icon="list-checks" align="center" />
      <div
        style={{
          marginTop: 40,
          width: "fit-content",
          minWidth: 1000,
          maxWidth: 1728,
          padding: "40px 52px",
          borderRadius: 28,
          background: withAlpha(colors.surface, 0.72),
          border: `1.5px solid ${withAlpha(colors.primary, 0.22)}`,
          display: "flex",
          flexDirection: "column",
          gap,
        }}
      >
        {points.map((p, i) => {
          const t = ease(frame, fps, starts[i], 20);
          const badge = pop(frame, fps, starts[i]);
          const tick = progress(frame, starts[i] + 4, 12);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 28, opacity: t, transform: `translateY(${(1 - t) * 20}px)` }}>
              <div style={{ transform: `scale(${badge})` }}>
                <Check t={tick} size={Math.round(size * 1.3)} color={colors.accent} stroke={colors.background} />
              </div>
              <div style={{ fontFamily: fontStack(fonts.body), fontSize: size, fontWeight: 500, lineHeight: 1.28, color: colors.text }}>
                {p}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
