import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PresenterSchema, StyleSchema, type Presenter } from "./schema";
import { CANVAS, captionReserve, contentBox, presenterBox, SAFE } from "./theme";

const style = StyleSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/sample-scenes.json", import.meta.url)), "utf8")).style,
);
const bigCaptions = { ...style, sizes: { ...style.sizes, caption: 64 } };

type Box = { x: number; y: number; width: number; height: number };
const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const combos: Presenter[] = (["left", "right", "none"] as const).flatMap((position) =>
  (["large", "small"] as const).map((size) => PresenterSchema.parse({ position, size })),
);

describe("layout: content box and presenter box", () => {
  it("presenter none -> content box is the full safe box above the captions", () => {
    for (const st of [style, bigCaptions]) {
      const none = PresenterSchema.parse({});
      expect(contentBox(st, none)).toEqual({
        x: SAFE,
        y: SAFE,
        width: CANVAS.width - 2 * SAFE,
        height: CANVAS.height - 2 * SAFE - captionReserve(st),
      });
      expect(contentBox(st)).toEqual(contentBox(st, none));
      expect(presenterBox(st, none)).toBeNull();
    }
  });

  it("content and presenter boxes never intersect, for every position x size", () => {
    for (const st of [style, bigCaptions]) {
      for (const p of combos) {
        const content = contentBox(st, p);
        const pres = presenterBox(st, p);
        if (p.position === "none") continue;
        expect(pres).not.toBeNull();
        expect(intersects(content, pres!)).toBe(false);
      }
    }
  });

  it("both boxes end above the caption reserve and stay on the canvas", () => {
    for (const st of [style, bigCaptions]) {
      const captionTop = CANVAS.height - SAFE - captionReserve(st);
      for (const p of combos) {
        const boxes = [contentBox(st, p), presenterBox(st, p)].filter(Boolean) as Box[];
        for (const b of boxes) {
          expect(b.y + b.height).toBeLessThanOrEqual(captionTop);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.x + b.width).toBeLessThanOrEqual(CANVAS.width);
          expect(b.width).toBeGreaterThan(0);
          expect(b.height).toBeGreaterThan(0);
        }
        // Text keeps the 96 px safe margin from every frame edge.
        const c = contentBox(st, p);
        expect(c.x).toBeGreaterThanOrEqual(SAFE);
        expect(c.x + c.width).toBeLessThanOrEqual(CANVAS.width - SAFE);
      }
    }
  });

  it("large presenter takes 34 % of the width, small 22 %, on its own side", () => {
    for (const p of combos.filter((c) => c.position !== "none")) {
      const box = presenterBox(style, p)!;
      expect(box.width).toBe(Math.round(CANVAS.width * (p.size === "large" ? 0.34 : 0.22)));
      const content = contentBox(style, p);
      if (p.position === "left") expect(box.x + box.width).toBeLessThanOrEqual(content.x);
      else expect(box.x).toBeGreaterThanOrEqual(content.x + content.width);
    }
  });
});
