import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {ease, progress, revealFrames } from "../anim";
import { popIn } from "../alive/motion";
import { Heading } from "../components/Heading";
import { Icon } from "../components/Icon";
import type { PropsOf } from "../schema";
import { fontStack, headingHeight, textLines, useScene, withAlpha } from "../theme";

type Node = PropsOf<"Diagram">["nodes"][number];

const CIRCLE = 180; // icon node diameter
const PILL_H = 104; // text-only node minimum height

export const Diagram: React.FC<PropsOf<"Diagram">> = ({ title, nodes, arrows, highlight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, durationInFrames, box } = useScene();
  const { colors, fonts, sizes } = style;

  const headingH = title ? headingHeight(style, title, false, box.width) + 24 : 0;
  const W = box.width;
  const H = box.height - headingH;

  // Label width: as wide as possible while leaving room for an arrow (and its label) to the
  // neighbour on the same row.
  let minGap = 1;
  for (const a of nodes) for (const b of nodes) {
    if (a !== b && Math.abs(a.y - b.y) < 0.2) minGap = Math.min(minGap, Math.abs(a.x - b.x) || 1);
  }
  const labelW = Math.round(Math.max(220, Math.min(380, minGap * (W - 400) - 130)));
  const baseLabel = sizes.body * (labelW >= 320 ? 1.1 : 0.95);

  // Node geometry at scale k (1 = full size). Shrunk only when nodes stacked in a column
  // would otherwise overlap (circle + label must fit between their centres).
  const geometry = (k: number) => {
    const circle = Math.round(CIRCLE * k);
    const labelSize = Math.round(baseLabel * Math.max(0.8, k));
    const iconLabelLines = (n: Node) => textLines(n.label, labelSize, labelW - 10, 0.55);
    const pillLines = (n: Node) => textLines(n.label, labelSize, labelW - 64, 0.55);
    const pillHeight = (n: Node) => Math.max(PILL_H * k, pillLines(n) * labelSize * 1.15 + 36);
    const extentTop = (n: Node) => (n.icon ? circle / 2 + 12 : pillHeight(n) / 2 + 8);
    const extentBottom = (n: Node) =>
      n.icon ? circle / 2 + 18 + iconLabelLines(n) * labelSize * 1.15 : pillHeight(n) / 2 + 8;
    // y is relative to the whole area, clamped so every node (with its label) stays inside.
    const rawY = (n: Node) => Math.min(Math.max(n.y * H, extentTop(n)), H - extentBottom(n));
    let fits = true;
    for (const a of nodes) for (const b of nodes) {
      if (a !== b && Math.abs(a.x - b.x) < 0.15 && a.y < b.y) {
        if (rawY(b) - rawY(a) < extentBottom(a) + extentTop(b) + 16) fits = false;
      }
      // Neighbours on the same row need room for a visible arrow between them (narrow boxes
      // beside the presenter): circle + label pill + a visible arrow (~190 px).
      const span = W - 2 * (Math.max(circle / 2, labelW / 2) + 8);
      if (a !== b && Math.abs(a.y - b.y) < 0.2 && a.x < b.x && (a.icon || b.icon)) {
        if ((b.x - a.x) * span < circle + 190) fits = false;
      }
    }
    return { circle, labelSize, pillHeight, extentTop, extentBottom, rawY, fits };
  };
  const g = [1, 0.9, 0.8, 0.7, 0.6].map(geometry).find((x) => x.fits) ?? geometry(0.6);
  const { circle, labelSize, pillHeight, extentTop, extentBottom, rawY } = g;
  // Keeps a node at x=0 or x=1 (circle and label) inside the safe margin.
  const padX = Math.max(circle / 2, labelW / 2) + 8;
  const pillHalfW = (n: Node) => Math.min(labelW / 2, n.label.length * labelSize * 0.29 + 32);
  // Centre the whole drawing vertically in the space above the captions.
  const top = Math.min(...nodes.map((n) => rawY(n) - extentTop(n)));
  const bottom = Math.max(...nodes.map((n) => rawY(n) + extentBottom(n)));
  const offsetY = (H - (bottom - top)) / 2 - top;

  const pos = (n: Node) => ({
    x: padX + n.x * (W - 2 * padX),
    y: rawY(n) + offsetY,
  });

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
    if (n.icon) return circle / 2 + 16;
    const hw = pillHalfW(n) + 12;
    const hh = pillHeight(n) / 2 + 12;
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
                {/* the line draws itself from the source node to the target */}
                <path
                  d={`M ${x1} ${y1} L ${x2} ${y2}`}
                  stroke={color}
                  strokeWidth={7}
                  strokeLinecap="round"
                  fill="none"
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - t}
                />
                <polygon
                  points="0,0 -30,-16 -30,16"
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
                padding: "8px 22px",
                borderRadius: 999,
                background: colors.background,
                border: `2px solid ${withAlpha(colors.primary, 0.45)}`,
                fontFamily: fontStack(fonts.body),
                fontSize: Math.round(sizes.body * 0.8),
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
          const t = popIn(frame, reveal.get(n.id)!);
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
                    left: -circle / 2,
                    top: -circle / 2,
                    width: circle,
                    height: circle,
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
                  <Icon name={n.icon} size={Math.round(circle * 0.48)} color={isActive ? colors.accent : colors.primary} strokeWidth={2} />
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: circle / 2 + 18,
                    left: -labelW / 2,
                    width: labelW,
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
                minHeight: PILL_H * (circle / CIRCLE),
                maxWidth: labelW,
                width: "max-content",
                padding: "18px 32px",
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
