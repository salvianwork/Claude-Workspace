import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { blinkAmount, blinkStarts, breath, popIn } from "../alive/motion";
import { PRESENTER_EXPRESSIONS, PRESENTER_OUTFITS, PRESENTER_POSES, PresenterSchema, SceneSchema, StyleSchema, VideoSchema } from "../schema";
import { mouthShape, POSES, poseAt } from "./poses";
import { animatedPose, extent, poseFrame } from "./Presenter";

const fixture = () =>
  JSON.parse(readFileSync(fileURLToPath(new URL("../../fixtures/sample-scenes.json", import.meta.url)), "utf8"));

describe("presenter schema", () => {
  it("has the exact pose and expression lists", () => {
    expect([...PRESENTER_POSES]).toEqual(["idle", "talk", "point-left", "point-right", "think", "surprised", "celebrate", "wave"]);
    expect([...PRESENTER_EXPRESSIONS]).toEqual(["neutral", "happy", "curious", "surprised", "thinking"]);
  });

  it("defaults to an idle, neutral, hidden, small presenter", () => {
    expect(PresenterSchema.parse({})).toEqual({ pose: "idle", expression: "neutral", position: "none", size: "small" });
  });

  it("rejects an unknown pose, expression, position or size", () => {
    expect(PresenterSchema.safeParse({ pose: "dance" }).success).toBe(false);
    expect(PresenterSchema.safeParse({ expression: "angry" }).success).toBe(false);
    expect(PresenterSchema.safeParse({ position: "top" }).success).toBe(false);
    expect(PresenterSchema.safeParse({ size: "huge" }).success).toBe(false);
  });

  it("scene.presenter and scene.mouth are optional and defaulted", () => {
    const scene = SceneSchema.parse({ id: 1, template: "TitleCard", durationInFrames: 60, props: { title: "Hi" } });
    expect(scene.presenter).toEqual(PresenterSchema.parse({}));
    expect(scene.mouth).toEqual([]);
  });

  it("rejects mouth values outside 0..1", () => {
    const base = { id: 1, template: "TitleCard", durationInFrames: 60, props: { title: "Hi" } };
    expect(SceneSchema.safeParse({ ...base, mouth: [0, 0.5, 1] }).success).toBe(true);
    expect(SceneSchema.safeParse({ ...base, mouth: [1.5] }).success).toBe(false);
  });
});

describe("presenter outfit (style.presenterOutfit)", () => {
  const style = () => ({ ...fixture().style });

  it("has the exact outfit list", () => {
    expect([...PRESENTER_OUTFITS]).toEqual(["blazer", "labcoat"]);
  });

  it("defaults to the blazer when the style has no outfit", () => {
    const { presenterOutfit: _, ...rest } = style();
    expect(StyleSchema.parse(rest).presenterOutfit).toBe("blazer");
  });

  it("accepts a lab coat style and rejects an unknown outfit", () => {
    expect(StyleSchema.parse({ ...style(), presenterOutfit: "labcoat" }).presenterOutfit).toBe("labcoat");
    expect(StyleSchema.safeParse({ ...style(), presenterOutfit: "hoodie" }).success).toBe(false);
  });

  it("the fixture sets the blazer explicitly", () => {
    expect(fixture().style.presenterOutfit).toBe("blazer");
  });
});

describe("presenter animation helpers", () => {
  it("maps loudness to the four mouth shapes", () => {
    expect([0, 0.14, 0.15, 0.39, 0.4, 0.69, 0.7, 1].map(mouthShape)).toEqual([
      "closed", "closed", "slight", "slight", "open", "open", "wide", "wide",
    ]);
  });

  it("defines every pose, and pose blending passes through both ends", () => {
    for (const p of PRESENTER_POSES) expect(POSES[p]).toBeDefined();
    const a = poseAt("idle", "celebrate", 0);
    const b = poseAt("idle", "celebrate", 1);
    expect(a.left.shoulder).toBeCloseTo(POSES.idle.left.shoulder);
    // Angles blend the shortest way round, so the end may differ by a full turn.
    expect((((b.right.elbow - POSES.celebrate.right.elbow) % 360) + 360) % 360).toBeCloseTo(0);
    const mid = poseAt("idle", "celebrate", 0.5).left.shoulder;
    expect(mid).toBeGreaterThan(Math.min(POSES.idle.left.shoulder, POSES.celebrate.left.shoulder));
    expect(mid).toBeLessThan(Math.max(POSES.idle.left.shoulder, POSES.celebrate.left.shoulder));
  });

  it("blinks deterministically every 2-5 s, seeded by the scene id", () => {
    const a = blinkStarts(7, 30 * 60);
    expect(blinkStarts(7, 30 * 60)).toEqual(a);
    expect(blinkStarts(8, 30 * 60)).not.toEqual(a);
    expect(a.length).toBeGreaterThan(10);
    for (let i = 1; i < a.length; i++) {
      expect(a[i] - a[i - 1]).toBeGreaterThanOrEqual(60);
      expect(a[i] - a[i - 1]).toBeLessThanOrEqual(150);
    }
    expect(blinkAmount(a[0] + 2, 7)).toBeGreaterThan(0.5);
    expect(blinkAmount(a[0] - 10, 7)).toBe(0);
  });

  it("breathes within +-1.5 % over a 4 s cycle", () => {
    const values = Array.from({ length: 120 }, (_, f) => breath(f));
    expect(Math.max(...values)).toBeLessThanOrEqual(0.015 + 1e-9);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-0.015 - 1e-9);
    expect(breath(0)).toBeCloseTo(breath(120));
  });

  it("popIn springs from 0 to 1 after its delay", () => {
    expect(popIn(0, 10)).toBe(0);
    expect(popIn(60, 10)).toBeCloseTo(1, 2);
    expect(Math.max(...Array.from({ length: 30 }, (_, f) => popIn(f + 10, 10)))).toBeGreaterThan(1);
  });
});

describe("fixture presenter lines", () => {
  const video = VideoSchema.parse(fixture());

  it("uses at least 5 different poses", () => {
    expect(new Set(video.scenes.map((s) => s.presenter.pose)).size).toBeGreaterThanOrEqual(5);
  });

  it("follows the size rules: large on title/number/quote/recap, never large on dense scenes", () => {
    for (const s of video.scenes) {
      if (["TitleCard", "BigNumber", "Quote", "Recap"].includes(s.template)) {
        expect(s.presenter.size).toBe("large");
        expect(s.presenter.position).not.toBe("none");
      }
      if (["Diagram", "Chart", "Comparison"].includes(s.template)) expect(s.presenter.size).toBe("small");
    }
  });

  it("points toward the content and carries mouth data for every frame", () => {
    for (const s of video.scenes) {
      if (s.presenter.pose === "point-left") expect(s.presenter.position).toBe("right");
      if (s.presenter.pose === "point-right") expect(s.presenter.position).toBe("left");
      expect(s.mouth).toHaveLength(s.durationInFrames);
    }
  });
});

describe("presenter framing", () => {
  const aspects = [653 / 705, 422 / 456];

  it("calm poses get a closer framing than poses with the arms out", () => {
    for (const a of aspects) {
      const idle = poseFrame("idle", "right", a);
      expect(poseFrame("talk", "right", a).h).toBeCloseTo(idle.h);
      for (const wide of ["point-left", "point-right", "celebrate"] as const) {
        expect(poseFrame(wide, "right", a).h).toBeGreaterThan(idle.h);
      }
    }
  });

  it("keeps both hands inside the box through the whole motion of every pose", () => {
    const mouth = fixture().scenes[1].mouth as number[];
    for (const a of aspects) {
      for (const name of PRESENTER_POSES) {
        for (const side of ["left", "right"] as const) {
          const f = poseFrame(name, side, a);
          for (let frame = 0; frame < mouth.length; frame += 3) {
            const e = extent([animatedPose(name, frame, mouth)]);
            expect(e.min).toBeGreaterThanOrEqual(f.x);
            expect(e.max).toBeLessThanOrEqual(f.x + f.w);
            expect(e.top).toBeGreaterThanOrEqual(f.y);
          }
        }
      }
    }
  });
});
