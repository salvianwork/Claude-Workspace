# Vendored files

Everything a composition loads at render time lives here, so renders work offline.
Nothing in this folder is fetched at render time; refresh it by hand with `npm pack`.

| File(s) | Source (npm) | Version | Licence | Licence text |
|---|---|---|---|---|
| `gsap.min.js` (from `dist/gsap.min.js`, unmodified) | `gsap` | 3.15.1 | GreenSock Standard "no charge" licence (free, commercial use allowed) | `GSAP-LICENSE.txt` |
| `fonts/inter-latin-{400,500,600,700,800}-normal.woff2`, `fonts/inter-latin-500-italic.woff2` (from `files/`) | `@fontsource/inter` | 5.3.0 | SIL Open Font Licence 1.1 (OFL-1.1) | `fonts/OFL-Inter.txt` |
| `fonts/poppins-latin-{400,500,600,700,800}-normal.woff2`, `fonts/poppins-latin-500-italic.woff2` (from `files/`) | `@fontsource/poppins` | 5.3.0 | SIL Open Font Licence 1.1 (OFL-1.1) | `fonts/OFL-Poppins.txt` |
| `fonts/fonts.css` | written for hf-kit | — | same as hf-kit | — |

The font weights match the Remotion templates (`templates/src/fonts.ts`).
Fonts are used unmodified (no subsetting, no renaming), as the OFL requires for the
Reserved Font Names.

## How compositions use them

HyperFrames serves only files inside the composition folder, so `tools.hf.render.install_kit`
copies `vendor/` and `src/` into `<composition>/kit/`. A composition then links
`kit/vendor/fonts/fonts.css` (the compiler sees these `@font-face` rules and skips its
Google Fonts fetch) and loads `kit/vendor/gsap.min.js` instead of the CDN copy.
