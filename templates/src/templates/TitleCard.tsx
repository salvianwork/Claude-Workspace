import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {ease, rise } from "../anim";
import { popIn } from "../alive/motion";
import { Icon } from "../components/Icon";
import type { PropsOf } from "../schema";
import { fitSize, fontStack, pickScale, textLines, useScene, withAlpha } from "../theme";

export const TitleCard: React.FC<PropsOf<"TitleCard">> = ({ title, subtitle, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, box } = useScene();
  const { colors, fonts, sizes } = style;

  const iconIn = popIn(frame, 2);
  const titleIn = ease(frame, fps, icon ? 8 : 2, 22);
  const lineIn = ease(frame, fps, 18, 24);
  const subIn = ease(frame, fps, 22, 22);
  const baseTitle = fitSize(sizes.title, title.length, 24, 0.62);
  const subBase = Math.round(sizes.body * 1.1);
  const maxW = Math.min(1500, box.width);
  // Largest scale at which icon, title (≤ 3 lines) and subtitle fit the content box.
  const k = pickScale(
    (s) =>
      textLines(title, baseTitle * s, maxW, 0.56) <= 3 &&
      (icon ? sizes.title * 1.45 * s + 44 : 0) +
        textLines(title, baseTitle * s, maxW, 0.56) * baseTitle * s * 1.06 +
        42 +
        (subtitle ? 32 + textLines(subtitle, subBase * s, Math.min(1300, box.width), 0.5) * subBase * s * 1.35 : 0) <=
        box.height,
    [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65],
  );
  const titleSize = Math.round(baseTitle * k);
  const iconSize = Math.round(sizes.title * 1.45 * k);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      {icon ? (
        <div
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: "50%",
            marginBottom: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `radial-gradient(circle, ${withAlpha(colors.accent, 0.28)} 0%, ${withAlpha(colors.accent, 0.08)} 70%)`,
            boxShadow: `0 0 0 3px ${withAlpha(colors.accent, 0.5)}, 0 0 80px ${withAlpha(colors.accent, 0.35)}`,
            transform: `scale(${iconIn}) rotate(${(1 - iconIn) * -40}deg)`,
            opacity: Math.min(1, iconIn * 1.5),
          }}
        >
          <Icon name={icon} size={Math.round(iconSize * 0.52)} color={colors.accent} strokeWidth={1.8} />
        </div>
      ) : null}
      <div
        style={{
          fontFamily: fontStack(fonts.heading),
          fontSize: titleSize,
          fontWeight: 800,
          lineHeight: 1.06,
          letterSpacing: "-0.025em",
          color: colors.text,
          maxWidth: maxW,
          textWrap: "balance",
          ...rise(titleIn, 40),
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 36, height: 6, width: 160 * lineIn, borderRadius: 3, background: colors.accent }} />
      {subtitle ? (
        <div
          style={{
            marginTop: 32,
            fontFamily: fontStack(fonts.body),
            fontSize: Math.round(subBase * k),
            fontWeight: 400,
            lineHeight: 1.35,
            color: withAlpha(colors.text, 0.78),
            maxWidth: Math.min(1300, box.width),
            textWrap: "balance",
            ...rise(subIn, 24),
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
