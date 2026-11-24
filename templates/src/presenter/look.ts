import type { PresenterOutfit } from "../schema";

/**
 * The presenter's look: the one settings file to change how he looks in every video.
 * Colours are hex. The outfit is chosen per video (`style.presenterOutfit`); both are defined here.
 * No orange in his clothes: orange stays reserved for on-screen highlights.
 */
export const LOOK = {
  /** Light warm peach skin (#F0CDAE, owner update 2026-11-24). */
  skinTone: "#F0CDAE",
  /** Dark brown curly hair. */
  hairColor: "#3B2416",
  /** Iris colour. */
  eyeColor: "#3A2418",
  /** Flat square translucent lime acetate frames, the host's signature (owner update 2026-11-24). */
  glasses: "lime-thick" as "lime-thick" | false,
  glassesColor: "#B9E83A",
  glassesEdge: "#7FB51F",
  glassesLight: "#E2FA8A",
  outfits: {
    /** Navy blazer over a light-blue collared shirt, no tie: the default "documentary host". */
    blazer: {
      jacket: "#1F2A44",
      jacketShade: "#161E33",
      jacketLight: "#2E3D60",
      jacketLine: "#0A0F1D",
      /** Cool rim light along the silhouette, so the navy never melts into a dark background. */
      rim: "#8FA6D6",
      shirt: "#CFE3F5",
      shirtShade: "#A8C3DE",
      shirtLine: "#5D7894",
      button: "#0E1527",
    },
    /** Off-white lab coat (cool grey shading, so it never glows) over a teal shirt. */
    labcoat: {
      jacket: "#E8ECF1",
      jacketShade: "#C0CAD6",
      jacketLight: "#F7F9FB",
      jacketLine: "#55657A",
      rim: "#C9D6E8",
      shirt: "#2A9D8F",
      shirtShade: "#21837A",
      shirtLine: "#124A44",
      button: "#B4BFCC",
    },
  } satisfies Record<PresenterOutfit, OutfitColors>,
};

export type OutfitColors = {
  jacket: string;
  jacketShade: string;
  jacketLight: string;
  jacketLine: string;
  rim: string;
  shirt: string;
  shirtShade: string;
  shirtLine: string;
  button: string;
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

/** Every colour the drawing uses, derived from the look and the outfit (2–3 tones per material). */
export const palette = (look: Look, outfit: PresenterOutfit = "blazer") => {
  const o: OutfitColors = look.outfits[outfit];
  return {
    outfit,
    skin: look.skinTone,
    skinShade: shade(look.skinTone, 0.2),
    skinDeep: shade(look.skinTone, 0.38),
    skinLight: tint(look.skinTone, 0.16),
    skinLine: shade(look.skinTone, 0.5),
    hair: look.hairColor,
    hairShade: shade(look.hairColor, 0.42),
    hairLight: tint(look.hairColor, 0.22),
    hairLine: shade(look.hairColor, 0.55),
    ...o,
    eye: look.eyeColor,
    eyeWhite: "#FBF7F2",
    lip: shade(look.skinTone, 0.45),
    mouthIn: "#4A1C1C",
    teeth: "#FFFBF5",
    tongue: "#D9746A",
    blush: "#E2725B",
    pen: "#2B3A55",
    glasses: look.glassesColor,
    glassesEdge: look.glassesEdge,
    glassesLight: look.glassesLight,
  };
};

export type Palette = ReturnType<typeof palette>;
