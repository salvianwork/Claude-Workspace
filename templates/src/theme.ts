import { createContext, useContext } from "react";
import type { Style } from "./schema";

/** All templates are laid out on a 1920×1080 design canvas and scaled to the real size. */
export const CANVAS = { width: 1920, height: 1080 } as const;

/** Text never comes closer than this to any edge of the frame. */
export const SAFE = 96;

/** Length of the entry and exit animation of every scene, in frames. */
export const TRANSITION = 12;

/** Font stack with system-safe fallbacks (bundled fonts are loaded in fonts.ts). */
export const fontStack = (name: string) =>
  `"${name.replace(/"/g, "")}", Inter, "Segoe UI", Roboto, Arial, sans-serif`;

/** "#RRGGBB" or "#RGB" + alpha (0–1) → rgba(). */
export const withAlpha = (hex: string, alpha: number) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** Height reserved at the bottom of the frame for two lines of captions. */
export const captionReserve = (style: Style) => Math.round(style.sizes.caption * 1.35 * 2 + 28 + 36);

/** The rectangle templates may draw text in (above the caption area). */
export const contentBox = (style: Style) => {
  const top = SAFE;
  const left = SAFE;
  const width = CANVAS.width - 2 * SAFE;
  const height = CANVAS.height - SAFE - top - captionReserve(style);
  return { top, left, width, height };
};

export type SceneInfo = { durationInFrames: number; style: Style };

export const SceneContext = createContext<SceneInfo | null>(null);

export const useScene = (): SceneInfo => {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useScene() must be used inside a scene");
  return ctx;
};

/** Shrinks a font size for long strings so they stay within a sensible number of lines. */
export const fitSize = (base: number, length: number, charsAtBase: number, minScale = 0.6) =>
  length <= charsAtBase ? base : Math.round(base * Math.max(minScale, Math.sqrt(charsAtBase / length)));

/** Estimated number of lines `text` wraps to (average glyph ≈ `em` × font size). */
export const textLines = (text: string, size: number, width: number, em = 0.5) =>
  Math.max(1, Math.ceil((text.length * em * size) / Math.max(1, width)));

/** Estimated height of a <Heading> (title text + underline) for the given style. */
export const headingHeight = (style: Style, text: string, hasIcon = false) => {
  const size = fitSize(style.sizes.heading, text.length, 34, 0.7);
  const width = CANVAS.width - 2 * SAFE - (hasIcon ? size * 1.25 + 24 : 0);
  return textLines(text, size, width, 0.55) * size * 1.12 + 22 + 6;
};

/** Largest text scale (from `scales`, largest first) for which `fits(scale)` is true. */
export const pickScale = (fits: (scale: number) => boolean, scales = [1.1, 1.05, 1, 0.95, 0.9, 0.85, 0.8, 0.75]) =>
  scales.find(fits) ?? scales[scales.length - 1];
