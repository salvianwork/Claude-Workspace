// Shared colours for the studio page (board now, pixel map in Task 5).
// Limited palette with hue-shifted ramps: shadows lean blue/purple, lights lean yellow.

export const PALETTE = {
  // board (dark green chalk-board look from the mockup)
  ink: "#0b1410",        // hard outlines and offset shadows
  board: "#1c3426",      // panel background
  boardDeep: "#14281d",  // inset boxes
  boardLift: "#25442f",  // raised chips
  line: "#3c6a4a",       // dashed separators
  text: "#f2ecd8",       // main text (warm off-white)
  dim: "#a8c4a6",        // secondary text
  label: "#7fc7e8",      // section labels
  waiting: "#f6c945",    // the ⚑ WAITING FOR YOU call-out
  pass: "#5fd068",
  fix: "#ff8a5c",
  paper: "#f6efd9",      // text box
  paperInk: "#1f2a24",
  // buttons: [face, light edge, dark edge]
  approve: ["#3fae55", "#7be08a", "#1f6b33"],
  changes: ["#e0604f", "#ff9a86", "#8e2c22"],
  neutral: ["#5a8fd8", "#9cc4f4", "#2c4f8a"],
  danger: ["#6b6f78", "#a3a7b0", "#3a3d44"],
  // map (Task 5 builds on these)
  mapVoid: "#151a24",
  mapFloor: "#232b3a",
  mapText: "#c9d3e6",
};

/** Copy the palette into CSS custom properties (--c-<name>) on an element. */
export function applyCssVars(el = document.documentElement) {
  for (const [name, v] of Object.entries(PALETTE)) {
    const kebab = name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    if (Array.isArray(v)) {
      el.style.setProperty(`--c-${kebab}`, v[0]);
      el.style.setProperty(`--c-${kebab}-hi`, v[1]);
      el.style.setProperty(`--c-${kebab}-lo`, v[2]);
    } else {
      el.style.setProperty(`--c-${kebab}`, v);
    }
  }
}

// ---------------------------------------------------------------------------
// Pixel studio map (studio.js / sprites.js).
// Every material is a hue-shifted ramp, darkest first: shadows lean blue/purple,
// lights lean yellow/warm (Codixel's rule). Light comes from the top left.
// ---------------------------------------------------------------------------

// The MIT permission notice applies to hueRamp/hslHex below: https://github.com/mankidev/codixel/blob/main/LICENSE
/** Hue-shifted ramp of n colours (port of Codixel's P.hueRamp, MIT, (c) 2026 mankidev). */
export function hueRamp(n, { hue = 110, shift = 40, sat = 0.5, satDrop = 0.35, light = [0.15, 0.7] } = {}) {
  const toward = (h, target, amt) => {
    const d = ((target - h + 540) % 360) - 180;
    return h + Math.sign(d) * Math.min(Math.abs(d), amt);
  };
  return Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? i / (n - 1) : 0.5, e = Math.abs(2 * t - 1);
    const h = toward(hue, t < 0.5 ? 240 : 60, shift * e);
    return hslHex(h, sat * (1 - satDrop * e), light[0] + (light[1] - light[0]) * t);
  });
}

export function hslHex(h, s, l) {
  h = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}

/** Material ramps for the map, darkest -> lightest. */
export const MAP = {
  void: "#0d1018",
  voidDot: "#1a2030",
  outline: "#120d18",
  shadow: "#1a1030",       // cast shadows blend toward this
  wallTop: ["#10131f", "#1b2133", "#283049", "#38425f"],
  // wall faces (one paint per room)
  wallWriters: ["#1b302b", "#26453b", "#335a49", "#45725a"],
  wallBooth: ["#1a1828", "#26233a", "#34304e", "#463f66"],
  wallKitchen: ["#7d8794", "#a9b4bd", "#d3dadb", "#efeee6"],
  wallArt: ["#5c302c", "#874a3c", "#b06a50", "#cf8f6a"],
  wallReview: ["#2e1a27", "#472836", "#623946", "#7e4d58"],
  wainscot: ["#2b1610", "#47261a", "#663a24", "#86542f"],
  // floors
  oak: ["#3a2116", "#5f3721", "#82512d", "#a06a39", "#bb8449"],
  carpetNavy: ["#171b33", "#1f2545", "#283058", "#333d6c"],
  tile: ["#9d8a74", "#c9b79a", "#e2d6bc", "#f2ead8"],
  tileAccent: ["#5d6f6a", "#7d938a", "#9db3a5"],
  concrete: ["#5b6268", "#7a8387", "#959e9e", "#b0b7b2"],
  carpetBlue: ["#1f2d52", "#283a66", "#31487a", "#3e5890"],
  // furniture & props
  wood: ["#2e1810", "#4d2a19", "#6e3f24", "#935a32", "#b67b45"],
  woodPale: ["#5a3b25", "#8a6040", "#b5895c", "#d6ae7a"],
  metal: ["#1f2230", "#3a3f52", "#5c6479", "#8790a6", "#bcc4d4"],
  white: ["#8b8f9e", "#b9bdc7", "#dfe1e4", "#f7f6f0"],
  paper: ["#a5a091", "#cfcab8", "#ece6d4", "#fffaee"],
  screen: ["#0f1c2e", "#1d3a5a", "#2f6a94", "#5fb0d8", "#b7eaf5"],
  screenOff: ["#121620", "#1b2230", "#283246"],
  leaf: ["#16301f", "#22492a", "#346a34", "#4f8c3c", "#7cb24a"],
  pot: ["#4a2219", "#783a27", "#a3553a", "#c97a52"],
  fabricRose: ["#3d1a2a", "#653044", "#8c4a5e", "#b06a7a"],
  fabricMustard: ["#4a3112", "#7a561c", "#a87d2a", "#cfa443"],
  rugRed: ["#3a141c", "#5c1f2a", "#7e2f36", "#9c4844"],
  rugGreen: ["#1a2e2a", "#26443a", "#355e4a", "#4a7a5a"],
  glass: ["#3a5a7a", "#6f9cbf", "#a9d2e6", "#e2f4f6"],
  sky: ["#4f86c6", "#79acd9", "#a8d1ea"],
  red: ["#4a0e18", "#8a1c26", "#c8323a", "#ee6450", "#ffb08a"],
  green: ["#0e3a22", "#1a6a32", "#2f9a44", "#5cc85a", "#a6ec7c"],
  yellow: ["#5a3a0e", "#a06a12", "#e0a81c", "#f8d64a", "#fff4a8"],
  books: ["#9c3a3a", "#3a5a9c", "#3f8a4f", "#c8962e", "#7a4a9a", "#2f7f86", "#b0583a"],
  gold: ["#5a3a10", "#946218", "#cc9a2a", "#f0cc5a", "#fff0a8"],
  tagBg: "#141826",
  tagText: "#f6f1e2",
  label: "#f2ecd8",
  labelBg: "#10131f",
};

/** Character ramps (darkest -> lightest) and the colour of each name tag. */
export const CREW = {
  story: {
    tag: "#d6ad42",
    skin: ["#7a3e33", "#bf7559", "#e8a77f", "#f7caa2"],
    hair: ["#24130e", "#45261a", "#6a3f27", "#8c5a36"],
    top: ["#4a2e12", "#7d561c", "#b08328", "#d6ad42"],       // ochre cardigan
    top2: ["#8f8c84", "#c4c0b4", "#e8e4d8", "#fbf8ee"],      // white shirt
    pants: ["#22160f", "#3d281b", "#5a3e2a", "#77563a"],
    shoe: ["#140d0c", "#2e1f1a", "#4a3328"],
    acc: ["#0e0b10", "#2a2026", "#a8c8e0", "#e8f6ff"],      // glasses: frame, frame, lens, glint
  },
  voice: {
    tag: "#a77fd0",
    skin: ["#2e1612", "#53291d", "#7e4a31", "#a06c48"],
    hair: ["#0d0b12", "#1a1524", "#2a2238", "#3f344f"],
    top: ["#241338", "#40245a", "#613c84", "#8660ad"],       // purple hoodie
    top2: ["#8a7fa0", "#c2b8d2", "#e6def0", "#faf6ff"],      // drawstrings
    pants: ["#141828", "#222a42", "#333e5c", "#485678"],
    shoe: ["#e0dcd4", "#b8b2aa", "#f6f4ee"],
    acc: ["#3d0c14", "#7e1c28", "#c8343c", "#f06a58"],      // headphones
  },
  design: {
    tag: "#e8584f",
    skin: ["#6e3a2e", "#ad6a50", "#d6946e", "#efb990"],
    hair: ["#2a0e0c", "#521a12", "#80301c", "#a8492a"],
    top: ["#0e2f33", "#185250", "#247a6c", "#3fa488"],       // teal smock
    top2: ["#a8885a", "#d8b98a", "#f0dcb4", "#fff2d6"],      // apron
    pants: ["#1c1626", "#2e2540", "#433858", "#5c4e74"],
    shoe: ["#2a0e12", "#4a1a20", "#6a2a2e"],
    acc: ["#40091a", "#7e1628", "#c02a36", "#ea5a4c"],      // red beret
  },
  animator: {
    tag: "#f0c43a",
    skin: ["#4e2a1c", "#8a5034", "#b87a50", "#d6a070"],
    hair: ["#150f0c", "#2c1e16", "#463022", "#614430"],
    top: ["#121c46", "#1f3276", "#3053ac", "#4f80d6"],       // cobalt tee
    top2: ["#121c46", "#1f3276", "#3053ac", "#4f80d6"],
    pants: ["#22222a", "#363844", "#4c5060", "#666c7e"],
    shoe: ["#7a1820", "#b8262c", "#e8483e"],
    acc: ["#5a360c", "#a06612", "#e2a81c", "#fad84a"],      // yellow cap
  },
  reviewer: {
    tag: "#9ab8a0",
    skin: ["#76403f", "#b77a6a", "#e0aa92", "#f4cdb2"],
    hair: ["#45475a", "#787c8c", "#aaaeb9", "#dadde2"],
    top: ["#1f2a24", "#34463c", "#4d6656", "#6f8a74"],       // sage-green sweater
    top2: ["#5a7090", "#8aa6c4", "#b8d0e6", "#e0eef8"],      // shirt collar
    pants: ["#24262e", "#3a3d48", "#545866", "#6e7384"],
    shoe: ["#1a1210", "#33241c", "#4e3828"],
    acc: ["#3a2214", "#6a4426", "#9c6c3c", "#c8985a"],      // clipboard
  },
};

/** The presenter on the STAR poster (same look as templates/src/presenter/look.ts). */
export const PRESENTER = {
  skin: ["#9a5f48", "#d4a07c", "#f0cdae", "#f9e0c9"],
  hair: ["#160c08", "#2a1810", "#3b2416", "#5a3a24"],
  glasses: ["#5E9A14", "#9CD62B", "#D4F57A"], // flat square lime acetate frames: edge, frame, light
  outfits: {
    blazer: { jacket: ["#0a0f1d", "#161e33", "#1f2a44", "#2e3d60"], rim: "#8fa6d6",
      shirt: ["#5d7894", "#a8c3de", "#cfe3f5"] },
    labcoat: { jacket: ["#55657a", "#c0cad6", "#e8ecf1", "#f7f9fb"], rim: "#c9d6e8",
      shirt: ["#124a44", "#21837a", "#2a9d8f"] },
  },
};
