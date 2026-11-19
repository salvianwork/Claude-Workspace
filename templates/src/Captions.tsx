import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { Style } from "./schema";
import { CANVAS, fontStack, SAFE, withAlpha } from "./theme";

const MAX_WORDS = 12;
const BOX_WIDTH = 1500;
const PAD_X = 32;

/**
 * Splits narration into caption pages of about 8–12 words that fit in at most two lines.
 * Exported for tests and for reuse by other tools.
 */
export const paginate = (words: string[], captionSize: number): string[][] => {
  // Average glyph width of a semi-bold sans is ~0.5em; size pages to about one line (0.55em
  // is a safe estimate), so a page wraps to a second line only with unusually wide words.
  const maxChars = Math.floor((BOX_WIDTH - 2 * PAD_X) / (captionSize * 0.55));
  const pages: string[][] = [];
  let page: string[] = [];
  let chars = 0;
  for (const w of words) {
    const add = (page.length ? 1 : 0) + w.length;
    if (page.length >= MAX_WORDS || (page.length > 0 && chars + add > maxChars)) {
      pages.push(page);
      page = [];
      chars = 0;
    }
    page.push(w);
    chars += (page.length > 1 ? 1 : 0) + w.length;
  }
  if (page.length) pages.push(page);
  // Same number of pages, but spread the words evenly so no page is tiny ("percent." alone).
  if (pages.length > 1) {
    const per = Math.ceil(words.length / pages.length);
    const balanced: string[][] = [];
    for (let i = 0; i < words.length; i += per) balanced.push(words.slice(i, i + per));
    if (balanced.length === pages.length && balanced.every((pg) => pg.join(" ").length <= maxChars)) {
      return balanced;
    }
  }
  return pages;
};

/**
 * Word-by-word captions: the narration's words are spread evenly over the scene, the current
 * page (≈8–12 words, max 2 lines) is shown bottom-centre and the current word is highlighted.
 */
export const Captions: React.FC<{ narration: string; durationInFrames: number; style: Style }> = ({
  narration,
  durationInFrames,
  style,
}) => {
  const frame = useCurrentFrame();
  const words = narration.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const size = style.sizes.caption;
  const pages = paginate(words, size);
  const current = Math.min(words.length - 1, Math.floor((frame / durationInFrames) * words.length));

  let pageIndex = 0;
  let firstWord = 0;
  for (let i = 0, count = 0; i < pages.length; i++) {
    if (current < count + pages[i].length) {
      pageIndex = i;
      firstWord = count;
      break;
    }
    count += pages[i].length;
  }
  const page = pages[pageIndex];

  const opacity = interpolate(frame, [0, 6, durationInFrames - 6, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: SAFE }}>
      <div
        style={{
          opacity,
          maxWidth: Math.min(BOX_WIDTH, CANVAS.width - 2 * SAFE),
          padding: `14px ${PAD_X}px`,
          borderRadius: 18,
          background: withAlpha(style.colors.background, 0.72),
          boxShadow: `0 8px 32px ${withAlpha("#000000", 0.25)}`,
          fontFamily: fontStack(style.fonts.body),
          fontSize: size,
          fontWeight: 600,
          lineHeight: 1.35,
          color: style.colors.text,
          textAlign: "center",
        }}
      >
        {page.map((w, i) => {
          const idx = firstWord + i;
          const isCurrent = idx === current;
          return (
            <React.Fragment key={idx}>
              <span
                style={{
                  color: isCurrent ? style.colors.accent : style.colors.text,
                  opacity: idx > current ? 0.6 : 1,
                }}
              >
                {w}
              </span>
              {i < page.length - 1 ? " " : null}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
