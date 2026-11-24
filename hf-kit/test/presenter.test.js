import { test } from "node:test";
import assert from "node:assert/strict";
import "../src/kit.js";
import "../src/presenter/look.js";
import "../src/presenter/motion.js";
import "../src/presenter/poses.js";
import "../src/presenter/parts.js";
import "../src/presenter/figure.js";

const P = globalThis.HFKitPresenter;

const POSES = ["idle", "talk", "point-left", "point-right", "think", "surprised", "celebrate", "wave"];
const EXPRESSIONS = ["neutral", "happy", "curious", "surprised", "thinking"];
const OUTFITS = ["blazer", "labcoat"];
const PARTS = ["torso", "collar", "neck", "head", "face", "hair-back", "hair-front", "eye-left", "eye-right",
  "brow-left", "brow-right", "nose", "mouth", "glasses", "arm-left", "arm-right"];

test("kit exposes the presenter and mountPresenter", () => {
  assert.equal(globalThis.HFKit.presenter, P);
  assert.equal(typeof globalThis.HFKit.mountPresenter, "function");
  assert.equal(globalThis.HFKit.mountPresenter, P.mountPresenter);
});

test("same names as the Remotion schema", () => {
  assert.deepEqual(P.PRESENTER_POSES, POSES);
  assert.deepEqual(P.PRESENTER_EXPRESSIONS, EXPRESSIONS);
  assert.deepEqual(P.PRESENTER_OUTFITS, OUTFITS);
  for (const p of POSES) assert.ok(P.POSES[p], p);
  for (const e of EXPRESSIONS) assert.ok(P.EXPRESSIONS[e], e);
});

test("same look values as templates/src/presenter/look.ts", () => {
  assert.equal(P.LOOK.skinTone, "#E3B28A");
  assert.equal(P.LOOK.hairColor, "#3B2416");
  assert.equal(P.LOOK.eyeColor, "#3A2418");
  assert.equal(P.LOOK.glassesColor, "#1B2130");
  assert.equal(P.LOOK.outfits.blazer.jacket, "#1F2A44");
  assert.equal(P.LOOK.outfits.blazer.shirt, "#CFE3F5");
  assert.equal(P.LOOK.outfits.labcoat.jacket, "#E8ECF1");
  assert.equal(P.LOOK.outfits.labcoat.shirt, "#2A9D8F");
  const pal = P.palette(P.LOOK, "blazer");
  assert.equal(pal.skin, "#E3B28A");
  assert.equal(pal.skinShade, P.mix("#E3B28A", "#1A0E14", 0.2));
  assert.equal(P.mix("#000000", "#FFFFFF", 0.5), "#808080");
});

test("every pose, expression and outfit renders an <svg> with every part", () => {
  for (const outfit of OUTFITS)
    for (const pose of POSES)
      for (const expression of EXPRESSIONS) {
        const svg = P.figureSVG({
          pose: P.POSES[pose], face: P.faceAt(expression, expression, 1), mouth: 0.5, blink: 0, t: 0,
          side: "center", outfit, width: 434, height: 288, still: true,
        });
        assert.match(svg, /^<svg[\s>]/);
        assert.ok(svg.endsWith("</svg>"));
        for (const part of PARTS) assert.ok(svg.includes(`data-part="${part}"`), `${outfit}/${pose}/${expression}: ${part}`);
        assert.ok(!/NaN|undefined|Infinity/.test(svg), `${outfit}/${pose}/${expression}: bad number`);
      }
});

test("head crop renders the head only", () => {
  const svg = P.figureSVG({ pose: P.POSES.idle, face: P.faceAt("happy", "happy", 1), mouth: 0, blink: 0, t: 0,
    side: "center", crop: "head", width: 150, height: 164, still: true });
  assert.ok(svg.includes('viewBox="-138 30 276 300"'));
  assert.ok(svg.includes('data-part="face"'));
  assert.ok(!svg.includes('data-part="torso"'));
});

test("mouth shape thresholds: <0.15 closed, <0.4 slight, <0.7 open, else wide", () => {
  assert.deepEqual([0, 0.14, 0.15, 0.39, 0.4, 0.69, 0.7, 1].map(P.mouthShape),
    ["closed", "closed", "slight", "slight", "open", "open", "wide", "wide"]);
});

test("the drawn mouth follows the shape", () => {
  const svgFor = (v) => P.figureSVG({ pose: P.POSES.idle, face: P.faceAt("neutral", "neutral", 1), mouth: v,
    blink: 0, t: 0, side: "center", width: 434, height: 288, still: true });
  const shown = (svg) => ["mouth-closed", "mouth-oh", "mouth-open"].filter((k) =>
    new RegExp(`data-part="${k}"(?![^>]*display="none")`).test(svg));
  assert.deepEqual(shown(svgFor(0)), ["mouth-closed"]);
  assert.deepEqual(shown(svgFor(0.3)), ["mouth-open"]);
  assert.notEqual(svgFor(0.3), svgFor(0.55));
  assert.notEqual(svgFor(0.55), svgFor(0.85));
});

test("blink schedule is deterministic per seed, every 2-5 s", () => {
  const a = P.blinkStarts(3, 1800);
  assert.deepEqual(a, P.blinkStarts(3, 1800));
  assert.notDeepEqual(a, P.blinkStarts(4, 1800));
  assert.ok(a[0] >= 15 && a[0] <= 60);
  for (let i = 1; i < a.length; i++) {
    const gap = a[i] - a[i - 1];
    assert.ok(gap >= 60 && gap <= 150, `gap ${gap}`);
  }
  // Same numbers as the Remotion helper (mulberry32 seeded with seed * 7919 + 13).
  assert.deepEqual(P.blinkStarts(1, 600), [58, 127, 256, 358, 419, 481, 582]);
  assert.deepEqual(P.blinkStarts(3, 1800).slice(0, 3), [21, 85, 180]);
  const s = a[0];
  assert.equal(P.blinkAmount(s - 1, 3), 0);
  assert.ok(P.blinkAmount(s + 3, 3) > 0.99);
  for (let f = 0; f < 400; f++) {
    const b = P.blinkAmount(f, 3);
    assert.ok(b >= 0 && b <= 1);
  }
});

test("breathing and bob are small and periodic", () => {
  for (let f = 0; f < 240; f++) {
    assert.ok(Math.abs(P.breath(f)) <= 0.015 + 1e-9);
    assert.ok(Math.abs(P.bob(f)) <= 4 + 1e-9);
  }
  assert.ok(Math.abs(P.breath(0) - P.breath(120)) < 1e-9); // 4 s period
});

test("svg structure is identical in every state (update only changes attributes)", () => {
  for (const outfit of OUTFITS) {
    let ref = null;
    for (const pose of POSES)
      for (const expression of EXPRESSIONS)
        for (const [mouth, blink] of [[0, 0], [0.3, 0.5], [0.55, 0.9], [0.9, 1]]) {
          const tree = P.figureTree({ pose: P.POSES[pose], face: P.faceAt(expression, expression, 1), mouth, blink,
            t: 17, side: "right", outfit, width: 422, height: 456 });
          const tags = P.flatten(tree).map((n) => n.tag).join(",");
          if (ref === null) ref = tags;
          assert.equal(tags, ref, `${outfit}/${pose}/${expression}/${mouth}/${blink}`);
        }
  }
});

test("presenter state is a pure function of t (seeking backwards gives the same result)", () => {
  const mouth = Array.from({ length: 300 }, (_, f) => 0.5 + 0.5 * Math.sin(f / 3));
  const cfg = P.presenterConfig({ pose: "talk", expression: "happy", outfit: "blazer", size: "small", side: "right", mouth, seed: 2 });
  const changes = [{ t: 0, pose: "talk", expression: "happy" }, { t: 2, pose: "point-left", expression: "curious" }];
  const ts = [0, 0.5, 1.9, 2, 2.1, 2.2, 2.5, 4, 9];
  const forward = ts.map((t) => P.svgOf(P.stateAt(cfg, changes, t)));
  const backward = ts.slice().reverse().map((t) => P.svgOf(P.stateAt(cfg, changes, t))).reverse();
  assert.deepEqual(forward, backward);
  assert.notEqual(forward[0], forward[1]); // he moves
});

test("pose change blends over 8 frames at 30 fps", () => {
  const cfg = P.presenterConfig({ pose: "idle", expression: "neutral", side: "left", size: "small", mouth: [], seed: 1 });
  const changes = [{ t: 0, pose: "idle", expression: "neutral" }, { t: 1, pose: "celebrate", expression: "happy" }];
  const at = (t) => P.stateAt(cfg, changes, t);
  const idle1 = P.animatedPose("idle", 30, []);
  assert.ok(Math.abs(at(1).pose.left.shoulder - idle1.left.shoulder) < 1e-9);
  const mid = at(1 + 4 / 30).pose.left.shoulder;
  assert.ok(mid > idle1.left.shoulder + 10 && mid < P.POSES.celebrate.left.shoulder - 10, `mid ${mid}`);
  const end = P.animatedPose("celebrate", 38, []);
  assert.ok(Math.abs(at(1 + 8 / 30).pose.left.shoulder - end.left.shoulder) < 1e-9);
  assert.equal(P.POSE_BLEND, 8);
  // Expression blends too.
  assert.ok(Math.abs(at(1 + 8 / 30).face.smile - P.EXPRESSIONS.happy.smile) < 1e-9);
});

test("presenter box follows the Remotion layout rule (22 % / 34 % of the width)", () => {
  assert.deepEqual(P.presenterSize("small"), { width: 422, height: 456 });
  assert.deepEqual(P.presenterSize("large"), { width: 653, height: 705 });
});

test("mountPresenter builds the svg once and update() only sets attributes", () => {
  // Minimal fake DOM: enough for the thin DOM layer (innerHTML + querySelectorAll + setAttribute).
  const nodes = [];
  const fakeEl = (tag) => {
    const el = {
      tag, attrs: {}, sets: 0,
      setAttribute(k, v) { this.attrs[k] = String(v); this.sets++; },
      removeAttribute(k) { delete this.attrs[k]; this.sets++; },
      getAttribute(k) { return this.attrs[k] ?? null; },
    };
    nodes.push(el);
    return el;
  };
  let builds = 0;
  const host = {
    set innerHTML(html) {
      builds++;
      nodes.length = 0;
      for (const m of html.matchAll(/<([a-zA-Z]+)([^>]*)>/g)) {
        const el = fakeEl(m[1]);
        for (const a of m[2].matchAll(/([\w:-]+)="([^"]*)"/g)) el.attrs[a[1]] = a[2];
      }
    },
    querySelector() { return nodes[0]; },
  };
  nodes.querySelectorAll = () => nodes.slice(1);
  const p = P.mountPresenter(host, { pose: "idle", expression: "neutral", outfit: "blazer", size: "small", side: "right",
    mouth: [0, 0.5, 0.9], fps: 30, seed: 1, _dom: { root: () => nodes[0], all: () => nodes.slice(1) } });
  assert.equal(builds, 1);
  const count = nodes.length;
  p.update(0.5);
  p.setPose("wave", 1);
  p.update(1.1);
  p.update(0.2);
  assert.equal(builds, 1);
  assert.equal(nodes.length, count);
  const expect = P.flatten(P.treeOf(P.stateAt(p.config, p.changes, 0.2), p.uid));
  expect.forEach((n, i) => {
    for (const [k, v] of Object.entries(n.a)) if (v != null) assert.equal(nodes[i].attrs[k], P.attr(v, p.uid), `${n.tag} ${k}`);
  });
});

test("a solid hair base sits behind the front curls and spans the fringe region (no skin gap)", () => {
  const svg = P.figureSVG({ pose: P.POSES.idle, face: P.faceAt("happy", "happy", 1), mouth: 0, blink: 0, t: 0,
    side: "center", width: 434, height: 288, still: true });
  const m = svg.match(/<path data-part="hair-base" d="([^"]+)" fill="#3B2416"/);
  assert.ok(m, "hair-base path in the hair colour");
  assert.ok(svg.indexOf('data-part="hair-base"') > svg.indexOf('data-part="face"'), "drawn over the face");
  assert.ok(svg.indexOf('data-part="hair-base"') < svg.indexOf("<circle", svg.indexOf('data-part="hair-front"')), "drawn under the curls");
  const nums = m[1].match(/-?\d+(\.\d+)?/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  // covers the band between the main curls (bottom edge y ~ 126) and the fringe curls (centres y ~ 136-148)
  assert.ok(Math.min(...ys) <= 100 && Math.max(...ys) >= 138, "vertical span");
  assert.ok(Math.min(...xs) <= -76 && Math.max(...xs) >= 76, "horizontal span");
});
