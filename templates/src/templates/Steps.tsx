import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ease, pop, revealFrames } from "../anim";
import { Heading } from "../components/Heading";
import { Icon } from "../components/Icon";
import type { PropsOf } from "../schema";
import { fontStack, useScene, withAlpha } from "../theme";

export const Steps: React.FC<PropsOf<"Steps">> = ({ title, steps }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, durationInFrames } = useScene();
  const { colors, fonts, sizes } = style;
  const n = steps.length;
  const starts = revealFrames(n, durationInFrames, 0.7, 14);
  const current = starts.filter((s) => frame >= s).length - 1;

  const circle = n >= 6 ? 104 : n >= 5 ? 116 : 128;
  const titleSize = Math.round(sizes.body * (n >= 5 ? 0.82 : 0.92));
  const descSize = Math.round(sizes.body * (n >= 5 ? 0.66 : 0.72));
  const colWidth = 1728 / n;

  // Connector line from the first to the last circle centre, filled up to the current step.
  const lineStart = colWidth / 2;
  const lineLen = colWidth * (n - 1);
  const fill = interpolate(
    frame,
    starts.map((s) => s + 6),
    starts.map((_, i) => i / (n - 1)),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title ? <Heading text={title} /> : null}
      <div style={{ marginTop: title ? 64 : 0, position: "relative", display: "flex" }}>
        <div
          style={{
            position: "absolute",
            top: circle / 2 - 3,
            left: lineStart,
            width: lineLen,
            height: 6,
            borderRadius: 3,
            background: withAlpha(colors.text, 0.12),
          }}
        />
        <div
          style={{
            position: "absolute",
            top: circle / 2 - 3,
            left: lineStart,
            width: lineLen * fill,
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
          }}
        />
        {steps.map((s, i) => {
          const t = ease(frame, fps, starts[i], 20);
          const badge = pop(frame, fps, starts[i]);
          const active = i === current;
          const done = i < current;
          const ring = active ? colors.accent : done ? colors.primary : withAlpha(colors.text, 0.2);
          return (
            <div
              key={i}
              style={{
                width: colWidth,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "0 14px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: circle,
                  height: circle,
                  borderRadius: "50%",
                  background: active
                    ? `linear-gradient(${withAlpha(colors.accent, 0.18)}, ${withAlpha(colors.accent, 0.18)}), ${colors.surface}`
                    : colors.surface,
                  boxShadow: `inset 0 0 0 4px ${ring}${active ? `, 0 0 48px ${withAlpha(colors.accent, 0.45)}` : ""}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${badge * (active ? 1.06 : 1)})`,
                }}
              >
                {s.icon ? (
                  <Icon name={s.icon} size={Math.round(circle * 0.44)} color={active ? colors.accent : colors.primary} strokeWidth={2} />
                ) : (
                  <span style={{ fontFamily: fontStack(fonts.heading), fontWeight: 700, fontSize: circle * 0.4, color: active ? colors.accent : colors.primary }}>
                    {i + 1}
                  </span>
                )}
                {s.icon ? (
                  <div
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: active ? colors.accent : colors.primary,
                      color: colors.background,
                      fontFamily: fontStack(fonts.heading),
                      fontWeight: 700,
                      fontSize: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {i + 1}
                  </div>
                ) : null}
              </div>
              <div style={{ opacity: t, transform: `translateY(${(1 - t) * 24}px)` }}>
                <div
                  style={{
                    marginTop: 30,
                    fontFamily: fontStack(fonts.heading),
                    fontSize: titleSize,
                    fontWeight: 700,
                    lineHeight: 1.18,
                    color: active ? colors.accent : colors.text,
                    textWrap: "balance",
                  }}
                >
                  {s.title}
                </div>
                {s.description ? (
                  <div
                    style={{
                      marginTop: 12,
                      fontFamily: fontStack(fonts.body),
                      fontSize: descSize,
                      fontWeight: 400,
                      lineHeight: 1.35,
                      color: withAlpha(colors.text, 0.72),
                      textWrap: "balance",
                    }}
                  >
                    {s.description}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
