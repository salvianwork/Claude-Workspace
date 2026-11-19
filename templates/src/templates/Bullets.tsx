import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ease, pop, revealFrames } from "../anim";
import { Heading } from "../components/Heading";
import type { PropsOf } from "../schema";
import { fontStack, useScene, withAlpha } from "../theme";

export const Bullets: React.FC<PropsOf<"Bullets">> = ({ title, items, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, durationInFrames } = useScene();
  const { colors, fonts, sizes } = style;
  const starts = revealFrames(items.length, durationInFrames, 0.7, 14);
  const current = starts.filter((s) => frame >= s).length - 1;
  const scale = items.length >= 5 ? 0.86 : items.length === 4 ? 0.94 : 1;
  const size = Math.round(sizes.body * scale);
  const gap = items.length >= 5 ? 16 : 22;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Heading text={title} icon={icon} />
      <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap }}>
        {items.map((item, i) => {
          const t = ease(frame, fps, starts[i], 20);
          const dot = pop(frame, fps, starts[i] + 2);
          const active = i === current;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                padding: `${Math.round(size * 0.42)}px 32px`,
                borderRadius: 20,
                background: withAlpha(colors.surface, active ? 0.95 : 0.6),
                boxShadow: active ? `inset 4px 0 0 ${colors.accent}` : `inset 4px 0 0 ${withAlpha(colors.primary, 0.35)}`,
                opacity: t,
                transform: `translateX(${(1 - t) * -60}px)`,
              }}
            >
              <div
                style={{
                  width: size * 1.3,
                  height: size * 1.3,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? colors.accent : withAlpha(colors.primary, 0.18),
                  color: active ? colors.background : colors.primary,
                  fontFamily: fontStack(fonts.heading),
                  fontWeight: 700,
                  fontSize: Math.round(size * 0.7),
                  transform: `scale(${dot})`,
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  fontFamily: fontStack(fonts.body),
                  fontSize: size,
                  fontWeight: 500,
                  lineHeight: 1.28,
                  color: colors.text,
                }}
              >
                {item}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
