import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ease, pop, progress, revealFrames } from "../anim";
import { Heading } from "../components/Heading";
import { Icon } from "../components/Icon";
import type { PropsOf } from "../schema";
import { contentBox, fontStack, useScene, withAlpha } from "../theme";

type Node = PropsOf<"Diagram">["nodes"][number];

const CIRCLE = 124; // icon node diameter
const PILL_H = 84; // text-only node minimum height
const PILL_MAX_W = 300; // = 2 × PAD_X, so a node at x=0 or x=1 stays inside the frame
const PAD_X = 150; // keeps labels of nodes at x=0 / x=1 inside the frame
const PAD_TOP = 70;
const PAD_BOTTOM = 150;

export const Diagram: React.FC<PropsOf<"Diagram">> = ({ title, nodes, arrows, highlight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, durationInFrames } = useScene();
  const { colors, fonts, sizes } = style;

  const box = contentBox(style);
  const headingH = title ? 128 : 0;
  const W = box.width;
  const H = box.height - headingH;
  const labelSize = Math.round(sizes.body * 0.8);

  const pos = (n: Node) => ({
    x: PAD_X + n.x * (W - 2 * PAD_X),
    y: PAD_TOP + n.y * (H - PAD_TOP - PAD_BOTTOM),
  });
  const pillHalfW = (n: Node) => Math.min(PILL_MAX_W / 2, n.label.length * labelSize * 0.29 + 30);
  const pillLines = (n: Node) => (n.label.length * labelSize * 0.55 > PILL_MAX_W - 56 ? 2 : 1);

  // Reveal order: highlight order first (it follows the narration), then the remaining nodes.
  const order = [...new Set([...(highlight ?? []), ...nodes.map((n) => n.id)])];
  const revealList = revealFrames(order.length, durationInFrames, 0.45, 10);
  const reveal = new Map(order.map((id, i) => [id, revealList[i]]));

  let active: string | null = null;
  if (highlight && highlight.length) {
    const start = 12;
    const span = Math.max(1, durationInFrames * 0.85 - start);
    const idx = Math.floor(((frame - start) / span) * highlight.length);
    if (idx >= 0) active = highlight[Math.min(highlight.length - 1, idx)];
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));

  /** Distance from a node centre to its edge in direction (dx, dy). */
  const edge = (n: Node, dx: number, dy: number) => {
    if (n.icon) return CIRCLE / 2 + 14;
    const hw = pillHalfW(n) + 12;
    const hh = Math.max(PILL_H, pillLines(n) * labelSize * 1.15 + 28) / 2 + 12;
    const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
    const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
    return Math.min(tx, ty);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {title ? (
        <div style={{ height: headingH }}>
          <Heading text={title} />
        </div>
      ) : null}
      <div style={{ position: "relative", width: W, height: H }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {arrows.map((a, i) => {
            const from = byId.get(a.from)!;
            const to = byId.get(a.to)!;
            const p = pos(from);
            const q = pos(to);
            const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
            const ux = (q.x - p.x) / len;
            const uy = (q.y - p.y) / len;
            const s = edge(from, ux, uy);
            const e = edge(to, ux, uy);
            const x1 = p.x + ux * s;
            const y1 = p.y + uy * s;
            const x2 = q.x - ux * e;
            const y2 = q.y - uy * e;
            const start = Math.max(reveal.get(a.from)!, reveal.get(a.to)!) + 4;
            const t = progress(frame, start, 16);
            const hot = active === a.to;
            const color = hot ? colors.accent : withAlpha(colors.primary, 0.8);
            const ex = x1 + (x2 - x1) * t;
            const ey = y1 + (y2 - y1) * t;
            const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
            return (
              <g key={i} opacity={t > 0 ? 1 : 0}>
                <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={5} strokeLinecap="round" />
                <polygon
                  points="0,0 -22,-12 -22,12"
                  fill={color}
                  transform={`translate(${ex},${ey}) rotate(${angle}) scale(${t})`}
                />
              </g>
            );
          })}
        </svg>

        {arrows.map((a, i) => {
          if (!a.label) return null;
          const p = pos(byId.get(a.from)!);
          const q = pos(byId.get(a.to)!);
          const start = Math.max(reveal.get(a.from)!, reveal.get(a.to)!) + 12;
          const t = ease(frame, fps, start, 14);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (p.x + q.x) / 2,
                top: (p.y + q.y) / 2,
                transform: `translate(-50%, -50%) scale(${0.8 + 0.2 * t})`,
                opacity: t,
                padding: "6px 18px",
                borderRadius: 999,
                background: colors.background,
                border: `2px solid ${withAlpha(colors.primary, 0.45)}`,
                fontFamily: fontStack(fonts.body),
                fontSize: Math.round(sizes.body * 0.62),
                fontWeight: 600,
                color: withAlpha(colors.text, 0.9),
                whiteSpace: "nowrap",
              }}
            >
              {a.label}
            </div>
          );
        })}

        {nodes.map((n) => {
          const { x, y } = pos(n);
          const t = pop(frame, fps, reveal.get(n.id)!);
          const fade = ease(frame, fps, reveal.get(n.id)!, 14);
          const isActive = active === n.id;
          const ring = isActive ? colors.accent : withAlpha(colors.primary, 0.7);
          const glow = isActive ? `, 0 0 60px ${withAlpha(colors.accent, 0.5)}` : "";
          if (n.icon) {
            return (
              <div
                key={n.id}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: 0,
                  height: 0,
                  opacity: fade,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: -CIRCLE / 2,
                    top: -CIRCLE / 2,
                    width: CIRCLE,
                    height: CIRCLE,
                    borderRadius: "50%",
                    background: isActive
                  ? `linear-gradient(${withAlpha(colors.accent, 0.18)}, ${withAlpha(colors.accent, 0.18)}), ${colors.surface}`
                  : colors.surface,
                    boxShadow: `inset 0 0 0 4px ${ring}${glow}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${t * (isActive ? 1.08 : 1)})`,
                  }}
                >
                  <Icon name={n.icon} size={58} color={isActive ? colors.accent : colors.primary} strokeWidth={2} />
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: CIRCLE / 2 + 18,
                    left: -150,
                    width: 300,
                    textAlign: "center",
                    fontFamily: fontStack(fonts.heading),
                    fontSize: labelSize,
                    fontWeight: 600,
                    lineHeight: 1.15,
                    color: isActive ? colors.accent : colors.text,
                    textWrap: "balance",
                  }}
                >
                  {n.label}
                </div>
              </div>
            );
          }
          return (
            <div
              key={n.id}
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: `translate(-50%, -50%) scale(${t * (isActive ? 1.06 : 1)})`,
                opacity: fade,
                minHeight: PILL_H,
                maxWidth: PILL_MAX_W,
                width: "max-content",
                padding: "14px 28px",
                textAlign: "center",
                lineHeight: 1.15,
                borderRadius: 24,
                background: isActive
                  ? `linear-gradient(${withAlpha(colors.accent, 0.18)}, ${withAlpha(colors.accent, 0.18)}), ${colors.surface}`
                  : colors.surface,
                boxShadow: `inset 0 0 0 3px ${ring}${glow}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textWrap: "balance",
                fontFamily: fontStack(fonts.heading),
                fontSize: labelSize,
                fontWeight: 600,
                color: isActive ? colors.accent : colors.text,
              }}
            >
              {n.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};
