import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ease, pop, rise } from "../anim";
import { Icon } from "../components/Icon";
import type { PropsOf } from "../schema";
import { fitSize, fontStack, useScene, withAlpha } from "../theme";

export const TitleCard: React.FC<PropsOf<"TitleCard">> = ({ title, subtitle, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useScene();
  const { colors, fonts, sizes } = style;

  const iconIn = pop(frame, fps, 2);
  const titleIn = ease(frame, fps, icon ? 8 : 2, 22);
  const lineIn = ease(frame, fps, 18, 24);
  const subIn = ease(frame, fps, 22, 22);
  const titleSize = fitSize(sizes.title, title.length, 24, 0.62);
  const iconSize = Math.round(sizes.title * 1.45);

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
          maxWidth: 1500,
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
            fontSize: Math.round(sizes.body * 1.1),
            fontWeight: 400,
            lineHeight: 1.35,
            color: withAlpha(colors.text, 0.78),
            maxWidth: 1300,
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
