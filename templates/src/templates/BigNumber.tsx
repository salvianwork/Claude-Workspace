import React from "react";
import { interpolate, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { ease, pop, rise } from "../anim";
import { Icon } from "../components/Icon";
import type { PropsOf } from "../schema";
import { fitSize, fontStack, useScene, withAlpha } from "../theme";

/**
 * Counts the first number in `value` up from zero, keeping prefix, suffix, thousands separators
 * and decimals ("$1.5M", "173,000 TW", "42%"). Non-numeric values are shown unchanged.
 */
export const countUp = (value: string, t: number): string => {
  const m = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return value;
  const [, prefix, num, suffix] = m;
  const decimals = num.includes(".") ? num.split(".")[1].length : 0;
  const target = parseFloat(num.replace(/,/g, ""));
  const current = target * t;
  const fixed = current.toFixed(decimals);
  const withCommas = num.includes(",")
    ? fixed.replace(/^(\d+)/, (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ","))
    : fixed;
  return `${prefix}${withCommas}${suffix}`;
};

export const BigNumber: React.FC<PropsOf<"BigNumber">> = ({ value, label, context, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, durationInFrames } = useScene();
  const { colors, fonts, sizes } = style;

  const numIn = ease(frame, fps, 2, 20);
  const count = interpolate(frame, [4, Math.min(48, durationInFrames * 0.45)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const labelIn = ease(frame, fps, 14, 20);
  const ctxIn = ease(frame, fps, 26, 20);
  const iconIn = pop(frame, fps, 0);
  const size = fitSize(Math.round(sizes.title * 1.9), value.length, 9, 0.7);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      {icon ? (
        <div style={{ marginBottom: 20, transform: `scale(${iconIn})`, opacity: Math.min(1, iconIn * 1.5) }}>
          <Icon name={icon} size={88} color={colors.primary} strokeWidth={1.8} />
        </div>
      ) : null}
      <div
        style={{
          fontFamily: fontStack(fonts.heading),
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: colors.accent,
          fontVariantNumeric: "tabular-nums",
          textShadow: `0 0 80px ${withAlpha(colors.accent, 0.35)}`,
          whiteSpace: "nowrap",
          opacity: numIn,
          transform: `scale(${0.85 + 0.15 * numIn})`,
        }}
      >
        {countUp(value, count)}
      </div>
      <div
        style={{
          marginTop: 28,
          fontFamily: fontStack(fonts.heading),
          fontSize: sizes.heading,
          fontWeight: 600,
          lineHeight: 1.15,
          color: colors.text,
          maxWidth: 1500,
          textWrap: "balance",
          ...rise(labelIn, 24),
        }}
      >
        {label}
      </div>
      {context ? (
        <div
          style={{
            marginTop: 24,
            fontFamily: fontStack(fonts.body),
            fontSize: sizes.body,
            fontWeight: 400,
            lineHeight: 1.35,
            color: withAlpha(colors.text, 0.8),
            maxWidth: 1300,
            textWrap: "balance",
            ...rise(ctxIn, 20),
          }}
        >
          {context}
        </div>
      ) : null}
    </div>
  );
};
