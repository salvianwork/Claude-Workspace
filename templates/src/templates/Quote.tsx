import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ease, pop, rise } from "../anim";
import type { PropsOf } from "../schema";
import { fitSize, fontStack, useScene, withAlpha } from "../theme";

export const Quote: React.FC<PropsOf<"Quote">> = ({ text, attribution }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, durationInFrames } = useScene();
  const { colors, fonts, sizes } = style;

  const words = text.split(/\s+/).filter(Boolean);
  // Words fade in one after another over the first ~45 % of the scene.
  const wordsEnd = Math.max(20, durationInFrames * 0.45);
  const markIn = pop(frame, fps, 0);
  const attrStart = Math.round(wordsEnd * 0.8);
  const attrIn = ease(frame, fps, attrStart, 20);
  const line = ease(frame, fps, attrStart, 24);
  const size = fitSize(Math.round(sizes.heading * 1.0), text.length, 90, 0.72);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 260,
          lineHeight: 0.6,
          height: 120,
          color: colors.accent,
          opacity: 0.9 * Math.min(1, markIn),
          transform: `scale(${markIn})`,
        }}
      >
        “
      </div>
      <div
        style={{
          maxWidth: 1450,
          textAlign: "center",
          fontFamily: fontStack(fonts.heading),
          fontSize: size,
          fontWeight: 500,
          fontStyle: "italic",
          lineHeight: 1.3,
          color: colors.text,
          textWrap: "balance",
        }}
      >
        {words.map((w, i) => {
          const start = 6 + (i / words.length) * (wordsEnd - 6);
          const t = interpolate(frame, [start, start + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <React.Fragment key={i}>
              <span style={{ opacity: 0.12 + 0.88 * t }}>{w}</span>
              {i < words.length - 1 ? " " : null}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 22, ...rise(attrIn, 18) }}>
        <div style={{ width: 64 * line, height: 4, borderRadius: 2, background: colors.accent }} />
        <div
          style={{
            fontFamily: fontStack(fonts.body),
            fontSize: Math.round(sizes.body * 0.95),
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: withAlpha(colors.text, 0.8),
          }}
        >
          {attribution}
        </div>
      </div>
    </div>
  );
};
