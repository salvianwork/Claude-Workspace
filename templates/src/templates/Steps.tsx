import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {ease, revealFrames } from "../anim";
import { popIn } from "../alive/motion";
import { Heading } from "../components/Heading";
import { Icon } from "../components/Icon";
import type { PropsOf } from "../schema";
import { fontStack, headingHeight, pickScale, textLines, useScene, withAlpha } from "../theme";

export const Steps: React.FC<PropsOf<"Steps">> = ({ title, steps }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, durationInFrames, box } = useScene();
  const { colors, fonts, sizes } = style;
  const n = steps.length;
  const starts = revealFrames(n, durationInFrames, 0.7, 14);
  const current = starts.filter((s) => frame >= s).length - 1;

  const circle = n >= 6 ? 124 : n >= 5 ? 140 : 156;
  const colWidth = box.width / n;
  // Largest text for which the tallest step (estimated wraps) fits above the captions.
  const available = box.height - (title ? headingHeight(style, title, false, box.width) + 64 : 0);
  const stepHeight = (s: number, st: (typeof steps)[number]) => {
    const t = sizes.body * (n >= 5 ? 0.95 : 1.1) * s;
    const d = sizes.body * (n >= 5 ? 0.78 : 0.88) * s;
    return (
      circle + 30 + textLines(st.title, t, colWidth - 28, 0.55) * t * 1.18 +
      (st.description ? 12 + textLines(st.description, d, colWidth - 28) * d * 1.35 : 0)
    );
  };
  const scale = pickScale((s) => Math.max(...steps.map((st) => stepHeight(s, st))) <= available, [1, 0.95, 0.9, 0.85, 0.8]);
  const titleSize = Math.round(sizes.body * (n >= 5 ? 0.95 : 1.1) * scale);
  const descSize = Math.round(sizes.body * (n >= 5 ? 0.78 : 0.88) * scale);

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
        {/* the connector draws itself up to the current step */}
        <svg
          width={lineLen + 6}
          height={6}
          style={{ position: "absolute", top: circle / 2 - 3, left: lineStart - 3, overflow: "visible" }}
        >
          <defs>
            <linearGradient id="steps-line" x1="0" y1="0" x2={lineLen} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={colors.primary} />
              <stop offset="1" stopColor={colors.accent} />
            </linearGradient>
          </defs>
          <path
            d={`M 3 3 L ${lineLen + 3} 3`}
            stroke="url(#steps-line)"
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - fill}
            opacity={fill > 0.001 ? 1 : 0}
          />
        </svg>
        {steps.map((s, i) => {
          const t = ease(frame, fps, starts[i], 20);
          const badge = popIn(frame, starts[i]);
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
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: active ? colors.accent : colors.primary,
                      color: colors.background,
                      fontFamily: fontStack(fonts.heading),
                      fontWeight: 700,
                      fontSize: 26,
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
