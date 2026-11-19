import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ease, progress, revealFrames } from "../anim";
import { Heading } from "../components/Heading";
import type { PropsOf } from "../schema";
import { fontStack, useScene, withAlpha } from "../theme";

/** Round axis ticks covering [min, max] (always including 0). */
export const niceTicks = (min: number, max: number, target = 4): number[] => {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const span = hi - lo || 1;
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= target) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.999; v += step) {
    ticks.push(Number(v.toFixed(10)));
    if (v >= hi) break;
  }
  return ticks;
};

/** Decimals needed to show every value of the data set the same way (max 2). */
export const decimalsFor = (values: number[]) =>
  Math.min(2, Math.max(0, ...values.map((v) => (String(v).split(".")[1] ?? "").length)));

/**
 * Value label. "%" and "$" are attached to the number; any other unit is shown once, on the
 * axis, so the bars are not cluttered with it.
 */
export const formatValue = (v: number, digits: number, unit?: string) => {
  const s = v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (unit === "%") return `${s}%`;
  if (unit === "$") return `$${s}`;
  return s;
};

const W = 1728;
const PLOT_LEFT = 120;
const PLOT_RIGHT = 40;

export const Chart: React.FC<PropsOf<"Chart">> = ({ title, type, labels, values, unit, highlight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, durationInFrames } = useScene();
  const { colors, fonts, sizes } = style;
  const n = values.length;
  const abs = values.map(Math.abs);
  const hi = highlight ?? abs.indexOf(Math.max(...abs));

  const H = 480; // svg height (content box minus heading)
  const top = 56;
  const bottom = 64;
  const plotW = W - PLOT_LEFT - PLOT_RIGHT;
  const plotH = H - top - bottom;
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  const slot = plotW / n;
  const cx = (i: number) => PLOT_LEFT + slot * (i + 0.5);
  const starts = revealFrames(n, durationInFrames, 0.6, 14);
  const axisIn = ease(frame, fps, 4, 20);
  const labelSize = Math.round(sizes.body * 0.72);
  const valueSize = Math.round(sizes.body * 0.8);
  const font = fontStack(fonts.body);
  const digits = decimalsFor(values);
  const tickDigits = decimalsFor(ticks);

  // Line chart: path through all points, drawn progressively.
  const points = values.map((v, i) => [cx(i), y(v)] as const);
  const linePath = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px},${py}`).join(" ");
  const areaPath = `${linePath} L${cx(n - 1)},${y(Math.max(yMin, 0))} L${cx(0)},${y(Math.max(yMin, 0))} Z`;
  const lineT = progress(frame, starts[0], Math.max(10, starts[n - 1] - starts[0] + 10));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Heading text={title} />
      <svg width={W} height={H} style={{ marginTop: 28, overflow: "visible" }}>
        <defs>
          <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.primary} />
            <stop offset="100%" stopColor={withAlpha(colors.primary, 0.55)} />
          </linearGradient>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={withAlpha(colors.primary, 0.35)} />
            <stop offset="100%" stopColor={withAlpha(colors.primary, 0)} />
          </linearGradient>
          <clipPath id="line-clip">
            <rect x={0} y={0} width={PLOT_LEFT + plotW * lineT + 10} height={H} />
          </clipPath>
        </defs>

        {/* grid + y axis */}
        <g opacity={axisIn}>
          {ticks.map((tv) => (
            <g key={tv}>
              <line
                x1={PLOT_LEFT}
                x2={W - PLOT_RIGHT}
                y1={y(tv)}
                y2={y(tv)}
                stroke={withAlpha(colors.text, tv === 0 ? 0.35 : 0.1)}
                strokeWidth={tv === 0 ? 2 : 1.5}
                strokeDasharray={tv === 0 ? undefined : "6 8"}
              />
              <text x={PLOT_LEFT - 20} y={y(tv) + labelSize * 0.35} textAnchor="end" fill={withAlpha(colors.text, 0.6)} fontFamily={font} fontSize={labelSize}>
                {formatValue(tv, tickDigits)}
              </text>
            </g>
          ))}
          {unit ? (
            <text x={PLOT_LEFT - 20} y={top - 28} textAnchor="end" fill={withAlpha(colors.text, 0.6)} fontFamily={font} fontSize={labelSize} fontWeight={600}>
              {unit}
            </text>
          ) : null}
        </g>

        {type === "bar"
          ? values.map((v, i) => {
              const g = ease(frame, fps, starts[i], 24);
              const base = y(Math.max(yMin, 0));
              const barW = Math.min(150, slot * 0.58);
              const end = base + (y(v) - base) * g;
              const yTop = Math.min(base, end);
              const h = Math.abs(end - base);
                            return (
                <g key={i}>
                  <rect
                    x={cx(i) - barW / 2}
                    y={yTop}
                    width={barW}
                    height={Math.max(0, h)}
                    rx={Math.min(14, h / 2)}
                    fill={i === hi ? colors.accent : "url(#bar-grad)"}
                  />
                  <text
                    x={cx(i)}
                    y={v >= 0 ? end - 16 : end + valueSize + 8}
                    textAnchor="middle"
                    fill={colors.text}
                    fontFamily={font}
                    fontWeight={700}
                    fontSize={valueSize}
                    opacity={g}
                  >
                    {formatValue(v * g, digits, unit)}
                  </text>
                </g>
              );
            })
          : (
            <g>
              <path d={areaPath} fill="url(#area-grad)" clipPath="url(#line-clip)" />
              <path
                d={linePath}
                fill="none"
                stroke={colors.primary}
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
                clipPath="url(#line-clip)"
              />
              {points.map(([px, py], i) => {
                const d = ease(frame, fps, starts[i] + 4, 16);
                return (
                  <g key={i} opacity={d}>
                    <circle cx={px} cy={py} r={(i === hi ? 16 : 12) * d} fill={i === hi ? colors.accent : colors.background} stroke={i === hi ? colors.accent : colors.primary} strokeWidth={5} />
                    <text x={px} y={py - 28} textAnchor="middle" fill={colors.text} fontFamily={font} fontWeight={700} fontSize={valueSize}>
                      {formatValue(values[i], digits, unit)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

        {/* x labels */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={cx(i)}
            y={H - bottom + labelSize + 22}
            textAnchor="middle"
            fill={withAlpha(colors.text, 0.75)}
            fontFamily={font}
            fontWeight={500}
            fontSize={labelSize}
            opacity={axisIn}
          >
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
};
