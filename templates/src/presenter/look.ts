/**
 * The presenter's look: the one settings file to change how he looks in every video.
 * Colours are hex. Leave `shirtColor` null to use the video's style accent colour.
 */
export const LOOK = {
  /** Warm medium brown skin. */
  skinTone: "#C68A5B",
  /** Dark brown curly hair. */
  hairColor: "#3B2416",
  /** Iris colour. */
  eyeColor: "#3A2418",
  /** null = the style's accent colour. */
  shirtColor: null as string | null,
  glasses: false,
};

export type Look = typeof LOOK;

const toRgb = (hex: string) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb: number[]) =>
  "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** Mix `hex` towards `target` by `t` (0–1). */
export const mix = (hex: string, target: string, t: number) => {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex(a.map((v, i) => v + (b[i] - v) * t));
};

/** Darker shade, multiplied towards a warm near-black so shadows stay warm, not grey. */
export const shade = (hex: string, t: number) => mix(hex, "#1A0E14", t);
export const tint = (hex: string, t: number) => mix(hex, "#FFF6EC", t);

/** Every colour the drawing uses, derived from the look (2–3 tones per material). */
export const palette = (look: Look, accent: string) => {
  const shirt = look.shirtColor ?? accent;
  return {
    skin: look.skinTone,
    skinShade: shade(look.skinTone, 0.2),
    skinDeep: shade(look.skinTone, 0.38),
    skinLight: tint(look.skinTone, 0.16),
    skinLine: shade(look.skinTone, 0.5),
    hair: look.hairColor,
    hairShade: shade(look.hairColor, 0.42),
    hairLight: tint(look.hairColor, 0.24),
    hairLine: shade(look.hairColor, 0.55),
    shirt,
    shirtShade: shade(shirt, 0.16),
    shirtDark: shade(shirt, 0.34),
    shirtLight: tint(shirt, 0.18),
    shirtLine: shade(shirt, 0.5),
    eye: look.eyeColor,
    eyeWhite: "#FBF7F2",
    lip: shade(look.skinTone, 0.45),
    mouthIn: "#4A1C1C",
    teeth: "#FFFBF5",
    tongue: "#D9746A",
    blush: "#E2725B",
    pen: "#E2E8F0",
    glasses: "#1F2937",
  };
};

export type Palette = ReturnType<typeof palette>;
