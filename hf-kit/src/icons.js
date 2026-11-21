/* hf-kit icon set: a small set of simple line icons drawn in code (24 x 24 grid, round strokes;
 * no downloads, no icon font). HFKit.icons.svg(name, size, colour) gives an <svg> string;
 * markup(name) the inner shapes. Scenes draw them inside a glowing disc.
 * Classic script: load after kit.js. */
(function (root) {
  "use strict";
  var K = root.HFKit;
  if (!K) throw new Error("icons.js: load kit/src/kit.js first");

  function p(d) { return '<path d="' + d + '"/>'; }
  function c(cx, cy, r) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>'; }
  function l(x1, y1, x2, y2) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>'; }
  function rc(x, y, w, h, r) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r || 0) + '"/>'; }

  var ICONS = {
    flame: p("M12 22c4 0 7-2.8 7-6.8 0-3.4-2.2-5.6-3.6-7.6-.6 1.6-1.5 2.6-2.6 3C13 7.2 11.6 4.2 9 2c.3 3.4-1.4 5.4-3 7.4C4.8 11 4 12.8 4 15c0 4 3.4 7 8 7z") + p("M12 22c-1.8 0-3-1.3-3-3 0-1.8 1.4-2.8 2.2-4.2.8 1.2 1.5 1.6 2.3 1.8.7.6 1.5 1.4 1.5 2.6 0 1.6-1.3 2.8-3 2.8z"),
    drop: p("M12 2.5c3.6 4.6 6.5 8.4 6.5 12A6.5 6.5 0 0 1 12 21a6.5 6.5 0 0 1-6.5-6.5c0-3.6 2.9-7.4 6.5-12z") + p("M9 15a3 3 0 0 0 3 3"),
    leaf: p("M5 19c-1-8 4-14 15-15 0 10-5 15-12 15-1 0-2-.1-3 0z") + p("M5 19c3-4 6-7 10-9"),
    sun: c(12, 12, 4.2) + l(12, 2, 12, 4.5) + l(12, 19.5, 12, 22) + l(2, 12, 4.5, 12) + l(19.5, 12, 22, 12) + l(4.9, 4.9, 6.7, 6.7) + l(17.3, 17.3, 19.1, 19.1) + l(4.9, 19.1, 6.7, 17.3) + l(17.3, 6.7, 19.1, 4.9),
    moon: p("M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"),
    bolt: p("M13.5 2 4.5 13.5H11L10 22l9.5-12H13z"),
    heart: p("M12 20.5S3 15.2 3 9a4.8 4.8 0 0 1 9-2.4A4.8 4.8 0 0 1 21 9c0 6.2-9 11.5-9 11.5z"),
    brain: p("M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1.5 5A3 3 0 0 0 9 20a2 2 0 0 0 3-1V5a2 2 0 0 0-3-1z") + p("M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1.5 5A3 3 0 0 1 15 20a2 2 0 0 1-3-1") + p("M8 10h2M14 13h2"),
    gear: c(12, 12, 3.2) + p("M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8") + c(12, 12, 7),
    check: p("M4.5 12.5 9.5 17.5 19.5 6.5"),
    cross: p("M6 6l12 12M18 6 6 18"),
    star: p("M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"),
    clock: c(12, 12, 9) + p("M12 7v5.2l3.4 2"),
    globe: c(12, 12, 9) + p("M3 12h18") + p("M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"),
    mountain: p("M2.5 20 9.5 7l4.2 7.4 2.3-3.4 5.5 9z") + p("M7.6 10.6 9.5 12l1.8-1.4"),
    atom: c(12, 12, 1.6) + '<ellipse cx="12" cy="12" rx="9.5" ry="3.8"/>' + '<ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)"/>' + '<ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(120 12 12)"/>',
    flask: p("M9 2.5h6M10 2.5v6.2L4.6 18.4A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.8-3.1L14 8.7V2.5") + p("M7 15h10"),
    cloud: p("M7 19h10.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.6-1.2A4.6 4.6 0 0 0 7 19z"),
    "arrow-up": p("M12 20.5V4M5.5 10.5 12 4l6.5 6.5"),
    "arrow-down": p("M12 3.5V20M5.5 13.5 12 20l6.5-6.5"),
    "arrow-right": p("M3.5 12H20M13.5 5.5 20 12l-6.5 6.5"),
    chart: p("M3.5 3.5v17h17") + rc(7, 12, 3, 6, 0.6) + rc(12, 8, 3, 10, 0.6) + rc(17, 5, 3, 13, 0.6),
    person: c(12, 7.5, 4) + p("M4.5 21a7.5 7.5 0 0 1 15 0"),
    house: p("M3.5 11 12 3.5l8.5 7.5") + p("M5.5 9.5V20.5h13V9.5") + p("M10 20.5v-6h4v6"),
    bulb: p("M9 17.5h6M10 21h4") + p("M12 2.5a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.4 1 2.4v1h6v-1c0-1 .3-1.8 1-2.4a6.5 6.5 0 0 0-4-11.6z"),
    magnet: p("M5 3.5h4.5v8a2.5 2.5 0 0 0 5 0v-8H19v8a7 7 0 0 1-14 0z") + p("M5 7.5h4.5M14.5 7.5H19"),
    eye: p("M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z") + c(12, 12, 3),
    battery: rc(2.5, 7, 17, 10, 2) + p("M22 10.5v3") + p("M6 10v4M9.5 10v4"),
    wave: p("M2 9c2.5 0 2.5-2.5 5-2.5S9.5 9 12 9s2.5-2.5 5-2.5S19.5 9 22 9") + p("M2 15c2.5 0 2.5-2.5 5-2.5S9.5 15 12 15s2.5-2.5 5-2.5 2.5 2.5 5 2.5"),
    coin: c(12, 12, 9) + p("M14.8 9.2c-.6-1-1.6-1.5-2.8-1.5-1.6 0-2.8.9-2.8 2.1 0 2.8 5.8 1.6 5.8 4.4 0 1.2-1.2 2.1-3 2.1-1.3 0-2.4-.6-3-1.6M12 6v1.7M12 16.3V18"),
    book: p("M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-1.5H4z") + p("M20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-1.5h6z"),
    rocket: p("M12 15.5 8.5 12C10 7 13.5 3.5 20.5 3.5 20.5 10.5 17 14 12 15.5z") + p("M8.5 12 5 12.5 3.5 15l4.2.4M12 15.5l-.5 3.5-2.5 1.5-.4-4.2") + c(15.5, 8.5, 1.6),
    shield: p("M12 2.5 4.5 5.5v6c0 4.6 3.2 8.4 7.5 10 4.3-1.6 7.5-5.4 7.5-10v-6z") + p("M8.5 12l2.5 2.5 4.5-5"),
    gauge: p("M3.5 17a8.5 8.5 0 1 1 17 0") + p("M12 17l4.2-5.2") + c(12, 17, 1.4),
    thermometer: p("M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z") + p("M12 9v7"),
    water: p("M2 7c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 12c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 17c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2"),
    tree: p("M12 21.5v-5") + p("M12 2.5 6 10h3l-4 6h14l-4-6h3z"),
    question: c(12, 12, 9.5) + p("M9.3 9.2a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9v.6") + c(12, 17, 0.4),
    target: c(12, 12, 9) + c(12, 12, 5.2) + c(12, 12, 1.6),
    layers: p("M12 3 2.5 8 12 13l9.5-5z") + p("M2.5 12.5 12 17.5l9.5-5M2.5 16.5 12 21.5l9.5-5"),
  };

  var names = Object.keys(ICONS);

  function markup(name) {
    if (!ICONS[name]) throw new Error("unknown icon " + name + " (have: " + names.join(", ") + ")");
    return ICONS[name];
  }

  /* Whole <svg> string: stroke icon at `size` px in `colour` (stroke width scales with size). */
  function svg(name, size, colour, strokeWidth) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + (colour || "currentColor") +
      '" stroke-width="' + (strokeWidth || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' + markup(name) + "</svg>";
  }

  K.icons = { names: names, has: function (n) { return !!ICONS[n]; }, markup: markup, svg: svg };
})(typeof globalThis !== "undefined" ? globalThis : window);
