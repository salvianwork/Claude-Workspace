import React from "react";
import { interpolate, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import {ease, rise } from "../anim";
import { popIn } from "../alive/motion";
import { Icon } from "../components/Icon";
import type { PropsOf } from "../schema";
import { fitSize, fontStack, textLines, useScene, withAlpha } from "../theme";

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
  const { style, durationInFrames, box } = useScene();
  const { colors, fonts, sizes } = style;

  const numIn = ease(frame, fps, 2, 20);
  const count = interpolate(frame, [4, Math.min(48, durationInFrames * 0.45)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const labelIn = ease(frame, fps, 14, 20);
  const ctxIn = ease(frame, fps, 26, 20);
  const iconIn = popIn(frame, 0);
  const numPop = popIn(frame, 2);
  // Big, but never wider than the content box (digits ≈ 0.62 em in a heavy font).
  const size = Math.min(fitSize(Math.round(sizes.title * 1.9), value.length, 9, 0.7), Math.floor(box.width / (value.length * 0.62)));
  const labelSize = textLines(label, sizes.heading, box.width, 0.55) > 2 ? Math.round(sizes.heading * 0.85) : sizes.heading;

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
          transform: `scale(${0.6 + 0.4 * numPop})`,
        }}
      >
        {countUp(value, count)}
      </div>
      <div
        style={{
          marginTop: 28,
          fontFamily: fontStack(fonts.heading),
          fontSize: labelSize,
          fontWeight: 600,
          lineHeight: 1.15,
          color: colors.text,
          maxWidth: Math.min(1500, box.width),
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
            maxWidth: Math.min(1300, box.width),
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
