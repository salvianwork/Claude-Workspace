# Registry blocks in hf-kit

Added once with `npx hyperframes add` (HyperFrames CLI **0.9.72**, telemetry off) on 2026-11-21,
then ported to offline, cue-driven classic scripts. The unmodified upstream files are kept in
`upstream/` (renamed `*.html.txt` so they are never served or linted as compositions; they load
GSAP and fonts from CDNs, which the ports do not).

| Port | Upstream item | Upstream sha256 (hyperframes.lock.json) | Licence |
|---|---|---|---|
| `kinetic-center-build.js` | `kinetic-center-build` (component) | `774f75b80d82fbc0c6226b85743804fb7a2229fb038eb0d38fa2e9503072c2e0` | MIT, Copyright (c) 2026 Remocn (full text in the upstream file header, reproduced below) |
| `transitions.js` | `transitions-dissolve` (block) | `9a862ff4ffd2cf583a2877a1429965ace11096e9609ca851069a08bb44c0c954` | Apache-2.0 (see below) |

Looked at and **not adopted**: `chart-story` (fixed 3.3 s build envelope and variables, not
cue-driven; our chart scene builds each bar on its word), `animated-bar-chart` (UI card),
`text-stagger` (kinetic-center-build fits narration better), `transitions-*` showcases other than
dissolve (flashy distortion/3D moves break the calm-motion rule).

## Apache-2.0 notice (transitions-dissolve)

`transitions.js` is a derivative of the HyperFrames registry block `transitions-dissolve`,
from HyperFrames by HeyGen (https://github.com/heygen-com/hyperframes, registry of CLI 0.9.72),
licensed under the Apache License, Version 2.0. The item file carries no notice of its own; the
`hyperframes` package declares `"license": "Apache-2.0"`. Full licence text:
`LICENSE-Apache-2.0.txt` (this folder); also at https://www.apache.org/licenses/LICENSE-2.0.

Modified: ported to a cue-driven classic script, GSAP removed. Only the crossfade and blur
crossfade values (blur 10 px, scale 0.97 in / 1.03 out, 0.5 s power2.inOut) were kept; slide,
zoom and cut were added in the same shape; the showcase page, its info bars and CDN script are not
included. The unmodified original is `upstream/transitions-dissolve.html.txt`.

Distributed under the License on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

## MIT licence (kinetic-center-build)

Modified: ported to a cue-driven classic script, GSAP removed (word start times come from the
narration; layout maths kept).


MIT License

Copyright (c) 2026 Remocn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
