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
