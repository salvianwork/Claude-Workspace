import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {ease, revealFrames } from "../anim";
import { popIn } from "../alive/motion";
import { Heading } from "../components/Heading";
import { IconBadge } from "../components/Icon";
import type { PropsOf } from "../schema";
import { fontStack, headingHeight, pickScale, useScene, withAlpha } from "../theme";

type Column = PropsOf<"Comparison">["left"];

const GAP = 72;
const PAD = 48;
const ICON = 108;
const BODY = 1.05; // point text, × style body size
const TITLE = 0.95; // column title, × style heading size

/** Rough height of a card at text scale `s` (average glyph ≈ 0.5em body, 0.55em heading). */
const cardHeight = (col: Column, body: number, heading: number, s: number, width: number) => {
  const inner = (width - GAP) / 2 - 2 * PAD;
  const size = body * BODY * s;
  const titleSize = heading * TITLE * s;
  const titleW = inner - (col.icon ? ICON + 24 : 0);
  const titleLines = Math.ceil((col.title.length * 0.55 * titleSize) / titleW);
  const pointW = inner - size * 0.42 - 20;
  const points = col.points.reduce(
    (h, p) => h + Math.ceil((p.length * 0.53 * size) / pointW) * size * 1.3,
    28 * s * (col.points.length - 1),
  );
  return 2 * 40 + Math.max(col.icon ? ICON * s : 0, titleLines * titleSize * 1.1) + 36 * s + points;
};

const Card: React.FC<{ col: Column; color: string; enter: number; starts: number[]; side: -1 | 1; scale: number }> = ({
  col,
  color,
  enter,
  starts,
  side,
  scale,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useScene();
  const { colors, fonts, sizes } = style;
  const t = ease(frame, fps, enter, 22);
  const size = Math.round(sizes.body * BODY * scale);
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 28,
        padding: `40px ${PAD}px`,
        background: withAlpha(colors.surface, 0.82),
        border: `2px solid ${withAlpha(color, 0.45)}`,
        boxShadow: `0 20px 60px ${withAlpha("#000000", 0.25)}`,
        opacity: t,
        transform: `translateX(${(1 - t) * 80 * side}px)`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: Math.round(36 * scale) }}>
        {col.icon ? <IconBadge name={col.icon} size={Math.round(ICON * Math.min(1, scale))} color={color} background={withAlpha(color, 0.16)} /> : null}
        <div
          style={{
            fontFamily: fontStack(fonts.heading),
            fontSize: Math.round(sizes.heading * TITLE * scale),
            fontWeight: 700,
            lineHeight: 1.1,
            color: colors.text,
          }}
        >
          {col.title}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: Math.round(28 * scale) }}>
        {col.points.map((p, i) => {
          const pt = ease(frame, fps, starts[i], 18);
          const dot = popIn(frame, starts[i]);
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 20, opacity: pt, transform: `translateY(${(1 - pt) * 16}px)` }}>
              <div
                style={{
                  marginTop: size * 0.42,
                  width: size * 0.42,
                  height: size * 0.42,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                  transform: `scale(${dot})`,
                }}
              />
              <div style={{ fontFamily: fontStack(fonts.body), fontSize: size, fontWeight: 500, lineHeight: 1.3, color: colors.text }}>
                {p}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Comparison: React.FC<PropsOf<"Comparison">> = ({ title, left, right }) => {
  const frame = useCurrentFrame();
  const { style, durationInFrames, box } = useScene();
  const { colors, fonts } = style;
  // Left card and its points first, then the right card and its points.
  const n = left.points.length + right.points.length;
  const all = revealFrames(n + 1, durationInFrames, 0.7, 16);
  const leftStarts = all.slice(0, left.points.length);
  const rightEnter = all[left.points.length];
  const rightStarts = all.slice(left.points.length + 1);
  const vs = popIn(frame, rightEnter);

  // Cards fill the height above the captions; text is as large as fits (estimated wraps).
  const available = box.height - (title ? headingHeight(style, title, false, box.width) + 44 : 0);
  const scale = pickScale(
    (s) => Math.max(...[left, right].map((c) => cardHeight(c, style.sizes.body, style.sizes.heading, s, box.width))) <= available - 40, // 40 px slack: estimates are rough
    [1.1, 1.05, 1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title ? <Heading text={title} /> : null}
      <div style={{ marginTop: title ? 44 : 0, height: available, display: "flex", alignItems: "stretch", gap: GAP, position: "relative" }}>
        <Card col={left} color={colors.primary} enter={4} starts={leftStarts} side={-1} scale={scale} />
        <Card col={right} color={colors.accent} enter={rightEnter - 6} starts={rightStarts.map((s) => s + 4)} side={1} scale={scale} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 96,
            height: 96,
            marginLeft: -48,
            marginTop: -48,
            borderRadius: "50%",
            background: colors.background,
            border: `3px solid ${withAlpha(colors.text, 0.25)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fontStack(fonts.heading),
            fontWeight: 800,
            fontSize: 34,
            color: colors.text,
            transform: `scale(${vs})`,
          }}
        >
          VS
        </div>
      </div>
    </div>
  );
};
