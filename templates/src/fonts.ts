import { loadFont } from "@remotion/fonts";

// Bundled with npm (fontsource), so rendering works offline. Any other font name in
// style.json falls back to the system font stack in theme.ts.
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff2";
import inter500 from "@fontsource/inter/files/inter-latin-500-normal.woff2";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff2";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff2";
import inter800 from "@fontsource/inter/files/inter-latin-800-normal.woff2";
import inter500i from "@fontsource/inter/files/inter-latin-500-italic.woff2";
import poppins400 from "@fontsource/poppins/files/poppins-latin-400-normal.woff2";
import poppins500 from "@fontsource/poppins/files/poppins-latin-500-normal.woff2";
import poppins600 from "@fontsource/poppins/files/poppins-latin-600-normal.woff2";
import poppins700 from "@fontsource/poppins/files/poppins-latin-700-normal.woff2";
import poppins800 from "@fontsource/poppins/files/poppins-latin-800-normal.woff2";
import poppins500i from "@fontsource/poppins/files/poppins-latin-500-italic.woff2";
import montserrat400 from "@fontsource/montserrat/files/montserrat-latin-400-normal.woff2";
import montserrat500 from "@fontsource/montserrat/files/montserrat-latin-500-normal.woff2";
import montserrat600 from "@fontsource/montserrat/files/montserrat-latin-600-normal.woff2";
import montserrat700 from "@fontsource/montserrat/files/montserrat-latin-700-normal.woff2";
import montserrat800 from "@fontsource/montserrat/files/montserrat-latin-800-normal.woff2";
import montserrat500i from "@fontsource/montserrat/files/montserrat-latin-500-italic.woff2";
import merriweather400 from "@fontsource/merriweather/files/merriweather-latin-400-normal.woff2";
import merriweather400i from "@fontsource/merriweather/files/merriweather-latin-400-italic.woff2";
import merriweather700 from "@fontsource/merriweather/files/merriweather-latin-700-normal.woff2";
import merriweather800 from "@fontsource/merriweather/files/merriweather-latin-800-normal.woff2";

export const BUNDLED_FONTS = ["Inter", "Poppins", "Montserrat", "Merriweather"] as const;

const faces: [string, string, string, "normal" | "italic"][] = [
  ["Inter", inter400, "400", "normal"],
  ["Inter", inter500, "500", "normal"],
  ["Inter", inter600, "600", "normal"],
  ["Inter", inter700, "700", "normal"],
  ["Inter", inter800, "800", "normal"],
  ["Inter", inter500i, "500", "italic"],
  ["Poppins", poppins400, "400", "normal"],
  ["Poppins", poppins500, "500", "normal"],
  ["Poppins", poppins600, "600", "normal"],
  ["Poppins", poppins700, "700", "normal"],
  ["Poppins", poppins800, "800", "normal"],
  ["Poppins", poppins500i, "500", "italic"],
  ["Montserrat", montserrat400, "400", "normal"],
  ["Montserrat", montserrat500, "500", "normal"],
  ["Montserrat", montserrat600, "600", "normal"],
  ["Montserrat", montserrat700, "700", "normal"],
  ["Montserrat", montserrat800, "800", "normal"],
  ["Montserrat", montserrat500i, "500", "italic"],
  ["Merriweather", merriweather400, "400", "normal"],
  ["Merriweather", merriweather400i, "400", "italic"],
  ["Merriweather", merriweather700, "700", "normal"],
  ["Merriweather", merriweather800, "800", "normal"],
];

let started = false;
export const loadBundledFonts = () => {
  if (started) return;
  started = true;
  for (const [family, url, weight, style] of faces) {
    loadFont({ family, url, weight, style, format: "woff2" }).catch((err) => {
      // A missing font must not break the render: fall back to the system stack.
      console.warn(`Could not load font ${family} ${weight}`, err);
    });
  }
};
