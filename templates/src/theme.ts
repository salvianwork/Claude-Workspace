import { createContext, useContext } from "react";
import type { Presenter, Style } from "./schema";

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

export type Box = { x: number; y: number; width: number; height: number };

/** Share of the canvas width the presenter takes on his side. */
export const PRESENTER_WIDTH = { large: 0.34, small: 0.22 } as const;
/** Distance of the presenter box from the frame edge (he is a drawing, not text). */
const PRESENTER_EDGE = 24;
/** Free space between the presenter box and the content box. */
const PRESENTER_GAP = 40;

const NO_PRESENTER: Presenter = { pose: "idle", expression: "neutral", position: "none", size: "small" };

/** Top of the caption area: nothing but captions may go below this line. */
export const captionTop = (style: Style) => CANVAS.height - SAFE - captionReserve(style);

/**
 * Where the presenter stands, or null when he is hidden. He takes 34 % (large) or 22 % (small)
 * of the canvas width on his side and stands on the caption line (cropped at the waist there).
 */
export const presenterBox = (style: Style, presenter: Presenter = NO_PRESENTER): Box | null => {
  if (presenter.position === "none") return null;
  const width = Math.round(CANVAS.width * PRESENTER_WIDTH[presenter.size]);
  const bottom = captionTop(style);
  const height = Math.min(bottom - PRESENTER_EDGE, Math.round(width * 1.08));
  const x = presenter.position === "left" ? PRESENTER_EDGE : CANVAS.width - PRESENTER_EDGE - width;
  return { x, y: bottom - height, width, height };
};

/**
 * The rectangle templates may draw in: 96 px from every edge, above the captions, and beside
 * the presenter when he is shown (the two boxes never intersect).
 */
export const contentBox = (style: Style, presenter: Presenter = NO_PRESENTER): Box => {
  const y = SAFE;
  const height = captionTop(style) - y;
  const pres = presenterBox(style, presenter);
  if (!pres) return { x: SAFE, y, width: CANVAS.width - 2 * SAFE, height };
  if (presenter.position === "left") {
    const x = Math.max(SAFE, pres.x + pres.width + PRESENTER_GAP);
    return { x, y, width: CANVAS.width - SAFE - x, height };
  }
  const right = Math.min(CANVAS.width - SAFE, pres.x - PRESENTER_GAP);
  return { x: SAFE, y, width: right - SAFE, height };
};

export type SceneInfo = {
  durationInFrames: number;
  style: Style;
  /** Content box of this scene (depends on the presenter). Templates lay out inside it. */
  box: Box;
  presenter: Presenter;
};

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
export const headingHeight = (style: Style, text: string, hasIcon = false, boxWidth = CANVAS.width - 2 * SAFE) => {
  const size = fitSize(style.sizes.heading, text.length, 34, 0.7);
  const width = boxWidth - (hasIcon ? size * 1.25 + 24 : 0);
  return textLines(text, size, width, 0.55) * size * 1.12 + 22 + 6;
};

/** Largest text scale (from `scales`, largest first) for which `fits(scale)` is true. */
export const pickScale = (fits: (scale: number) => boolean, scales = [1.1, 1.05, 1, 0.95, 0.9, 0.85, 0.8, 0.75]) =>
  scales.find(fits) ?? scales[scales.length - 1];
