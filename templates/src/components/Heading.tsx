import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ease, rise } from "../anim";
import { fitSize, fontStack, TRANSITION, useScene, withAlpha } from "../theme";
import { Icon } from "./Icon";

/** Scene heading: optional icon, title text and a growing accent underline. */
export const Heading: React.FC<{ text: string; icon?: string; align?: "left" | "center"; start?: number }> = ({
  text,
  icon,
  align = "left",
  start = 2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useScene();
  const t = ease(frame, fps, start);
  const line = ease(frame, fps, start + TRANSITION / 2, 24);
  const size = fitSize(style.sizes.heading, text.length, 34, 0.7);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, ...rise(t) }}>
        {icon ? (
          <div
            style={{
              width: size * 1.25,
              height: size * 1.25,
              borderRadius: size * 0.34,
              background: withAlpha(style.colors.accent, 0.16),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name={icon} size={Math.round(size * 0.68)} color={style.colors.accent} strokeWidth={2.2} />
          </div>
        ) : null}
        <div
          style={{
            fontFamily: fontStack(style.fonts.heading),
            fontSize: size,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.015em",
            color: style.colors.text,
            textAlign: align,
            textWrap: "balance",
          }}
        >
          {text}
        </div>
      </div>
      <div
        style={{
          marginTop: 22,
          height: 6,
          width: 120 * line,
          borderRadius: 3,
          background: style.colors.accent,
        }}
      />
    </div>
  );
};
