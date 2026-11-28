/* hf-kit presenter, part 1/5: the look (port of templates/src/presenter/look.ts) and the name
 * lists (templates/src/schema.ts). Classic script, no DOM: sets globalThis.HFKitPresenter and
 * merges into globalThis.HFKit.presenter. Load order: look, motion, poses, parts, figure. */
(function (root) {
  "use strict";
  var P = (root.HFKitPresenter = root.HFKitPresenter || {});

  P.PRESENTER_POSES = ["idle", "talk", "point-left", "point-right", "think", "surprised", "celebrate", "wave"];
  P.PRESENTER_EXPRESSIONS = ["neutral", "happy", "curious", "surprised", "thinking"];
  P.PRESENTER_OUTFITS = ["blazer", "labcoat"];

  /* The presenter's look. Colours are hex. No orange in his clothes: orange stays reserved for
   * on-screen highlights. Same values as the Remotion look.ts. */
  P.LOOK = {
    skinTone: "#F0CDAE", // light warm peach
    hairColor: "#3B2416", // dark brown curly hair
    eyeColor: "#3A2418",
    glasses: "lime-thick", // thick lime-green acetate frames (the host's signature)
    glassesColor: "#9CD62B", // translucent lime acetate (drawn at 0.95 opacity)
    glassesEdge: "#5E9A14",
    glassesLight: "#D4F57A",
    // phone-ready refresh: the whole head (hair, ears, face, glasses) is drawn this much bigger
    // relative to the body, scaled about the chin (RIG.headScaleY), so the neck and collar still fit
    headScale: 1.2,
    outfits: {
      // Navy blazer over a light-blue collared shirt, no tie: the default "documentary host".
      blazer: {
        jacket: "#1F2A44", jacketShade: "#161E33", jacketLight: "#2E3D60", jacketLine: "#0A0F1D",
        rim: "#8FA6D6", shirt: "#CFE3F5", shirtShade: "#A8C3DE", shirtLine: "#5D7894", button: "#0E1527",
      },
      // Off-white lab coat (cool grey shading, so it never glows) over a teal shirt.
      labcoat: {
        jacket: "#E8ECF1", jacketShade: "#C0CAD6", jacketLight: "#F7F9FB", jacketLine: "#55657A",
        rim: "#C9D6E8", shirt: "#2A9D8F", shirtShade: "#21837A", shirtLine: "#124A44", button: "#B4BFCC",
      },
    },
  };

  function toRgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function toHex(rgb) {
    return "#" + rgb.map(function (v) {
      return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    }).join("");
  }

  /* Mix `hex` towards `target` by `t` (0-1). */
  function mix(hex, target, t) {
    var a = toRgb(hex);
    var b = toRgb(target);
    return toHex(a.map(function (v, i) { return v + (b[i] - v) * t; }));
  }
  /* Darker shade towards a warm near-black (shadows stay warm, not grey); lighter tint. */
  function shade(hex, t) { return mix(hex, "#1A0E14", t); }
  function tint(hex, t) { return mix(hex, "#FFF6EC", t); }

  /* Every colour the drawing uses, derived from the look and the outfit. */
  function palette(look, outfit) {
    look = look || P.LOOK;
    outfit = outfit || "blazer";
    var o = look.outfits[outfit];
    if (!o) throw new Error("presenter: unknown outfit " + outfit);
    var pal = {
      outfit: outfit,
      skin: look.skinTone,
      skinShade: shade(look.skinTone, 0.2),
      skinDeep: shade(look.skinTone, 0.38),
      skinLight: tint(look.skinTone, 0.16),
      skinLine: shade(look.skinTone, 0.5),
      hair: look.hairColor,
      hairShade: shade(look.hairColor, 0.42),
      hairLight: tint(look.hairColor, 0.22),
      hairLine: shade(look.hairColor, 0.55),
    };
    Object.keys(o).forEach(function (k) { pal[k] = o[k]; });
    pal.eye = look.eyeColor;
    pal.eyeWhite = "#FBF7F2";
    pal.lip = shade(look.skinTone, 0.45);
    pal.mouthIn = "#4A1C1C";
    pal.teeth = "#FFFBF5";
    pal.tongue = "#D9746A";
    pal.blush = "#E2725B";
    pal.pen = "#2B3A55";
    pal.glasses = look.glassesColor;
    pal.glassesEdge = look.glassesEdge;
    pal.glassesLight = look.glassesLight;
    return pal;
  }

  P.mix = mix;
  P.shade = shade;
  P.tint = tint;
  P.palette = palette;
  if (root.HFKit) { root.HFKit.presenter = P; root.HFKit.LOOK = P.LOOK; }
})(typeof globalThis !== "undefined" ? globalThis : window);
