# Video templates (Remotion)

Nine scene templates the Animator fills with data. A video is one `scenes.json`
(see `fixtures/sample-scenes.json`); `src/schema.ts` validates it.

```bash
npm install
npx remotion studio                     # live preview of the fixture (edit props in the sidebar)
npm test                                # schema tests
npm run stills                          # out/stills/scene-<n>-<Template>.png (frame 30 of each scene)
npm run stills -- --props=path/to/scenes.json --frame=80%
npm run render -- out.mp4 --props=path/to/scenes.json   # muted MP4; audio is added later
```

Props are validated with `VideoSchema` at render time (`src/metadata.ts`): an invalid file stops
with e.g. `Invalid scenes.json: scenes[1].props.items: Too big…`; defaults are filled in.
`fps`/`width`/`height` are fixed to 30 / 1920 / 1080 (may be omitted). Duration = sum of the
scenes' `durationInFrames`. Text sizes shrink automatically (estimated wraps) to fit above the captions.
Each scene enters/exits in 12 frames, keeps text 96 px from every edge and shows captions
from `narration` (words spread evenly over the scene, current word in the accent colour).
On machines where Remotion cannot download its browser, set `REMOTION_BROWSER_EXECUTABLE`.

**Style** (`style.json`): `colors` background, surface, primary, accent, text (hex);
`fonts` heading, body (bundled offline: Inter, Poppins, Montserrat, Merriweather; anything
else falls back to Segoe UI/Arial); `sizes` title, heading, body, caption (px).

**Icons**: any [lucide](https://lucide.dev/icons) name, e.g. `"flame"`, `"plug-zap"`.

## Templates and props

| Template | Props (`?` = optional) |
|---|---|
| `TitleCard` | `title` (≤60), `subtitle?` (≤120), `icon?` |
| `Bullets` | `title` (≤60), `items` 1–5 × ≤90 chars, `icon?` |
| `Diagram` | `title?`, `nodes` 2–8 × {`id`, `label` ≤30, `icon?`, `x`, `y` in 0–1}, `arrows` ≤10 × {`from`, `to`, `label?` ≤24}, `highlight?` node ids lit one after another |
| `Comparison` | `title?`, `left` / `right`: {`title` ≤30, `icon?`, `points` 1–4 × ≤60} |
| `BigNumber` | `value` (≤12, counts up, e.g. `"173,000 TW"`), `label` (≤60), `context?` (≤100), `icon?` |
| `Steps` | `title?`, `steps` 2–6 × {`title` ≤30, `description?` ≤80, `icon?`} |
| `Chart` | `title`, `type` `bar`\|`line`, `labels` 2–10 × ≤14, `values` (same count), `unit?` (≤10), `highlight?` index |
| `Quote` | `text` (≤200), `attribution` (≤60) |
| `Recap` | `title` (≤60), `points` 1–5 × ≤90 |

Items in Bullets, Steps, Recap, Comparison and Chart appear one by one across the first
~70 % of the scene, so they roughly follow the narration.
