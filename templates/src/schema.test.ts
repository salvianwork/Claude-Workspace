import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SceneSchema, TEMPLATE_NAMES, VideoSchema } from "./schema";

const fixturePath = fileURLToPath(new URL("../fixtures/sample-scenes.json", import.meta.url));
const loadFixture = () => JSON.parse(readFileSync(fixturePath, "utf8"));

const bulletsScene = (items: string[]) => ({
  id: 1,
  template: "Bullets",
  durationInFrames: 150,
  narration: "Some narration.",
  props: { title: "A title", items },
});

describe("schema", () => {
  it("TEMPLATE_NAMES has 9 entries", () => {
    expect(TEMPLATE_NAMES).toHaveLength(9);
    expect(new Set(TEMPLATE_NAMES).size).toBe(9);
  });

  it("rejects unknown template", () => {
    const result = SceneSchema.safeParse({ ...bulletsScene(["one"]), template: "Spinner3D" });
    expect(result.success).toBe(false);
  });

  it("rejects bullets with more than 5 items", () => {
    expect(SceneSchema.safeParse(bulletsScene(["1", "2", "3", "4", "5"])).success).toBe(true);
    expect(SceneSchema.safeParse(bulletsScene(["1", "2", "3", "4", "5", "6"])).success).toBe(false);
  });

  it("accepts sample-scenes.json", () => {
    const result = VideoSchema.safeParse(loadFixture());
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);
  });

  it("sample-scenes.json uses every template exactly once", () => {
    const templates = loadFixture().scenes.map((s: { template: string }) => s.template);
    expect([...templates].sort()).toEqual([...TEMPLATE_NAMES].sort());
  });

  it("rejects unknown lucide icon names", () => {
    const scene = {
      id: 1, template: "TitleCard", durationInFrames: 120, narration: "",
      props: { title: "Hi", icon: "definitely-not-an-icon" },
    };
    expect(SceneSchema.safeParse(scene).success).toBe(false);
    expect(SceneSchema.safeParse({ ...scene, props: { title: "Hi", icon: "flame" } }).success).toBe(true);
  });

  it("rejects diagram arrows pointing at missing nodes", () => {
    const scene = {
      id: 1, template: "Diagram", durationInFrames: 150, narration: "",
      props: {
        nodes: [
          { id: "a", label: "A", x: 0.2, y: 0.5 },
          { id: "b", label: "B", x: 0.8, y: 0.5 },
        ],
        arrows: [{ from: "a", to: "c" }],
      },
    };
    expect(SceneSchema.safeParse(scene).success).toBe(false);
    scene.props.arrows = [{ from: "a", to: "b" }];
    expect(SceneSchema.safeParse(scene).success).toBe(true);
  });

  it("rejects chart with mismatched labels and values", () => {
    const scene = {
      id: 1, template: "Chart", durationInFrames: 150, narration: "",
      props: { title: "T", type: "bar", labels: ["a", "b", "c"], values: [1, 2] },
    };
    expect(SceneSchema.safeParse(scene).success).toBe(false);
  });

  it("accepts an in-range chart highlight index and rejects an out-of-range one", () => {
    const scene = {
      id: 1, template: "Chart", durationInFrames: 150, narration: "",
      props: { title: "T", type: "line", labels: ["a", "b"], values: [1, 2], highlight: 1 },
    };
    expect(SceneSchema.safeParse(scene).success).toBe(true);
    expect(SceneSchema.safeParse({ ...scene, props: { ...scene.props, highlight: 2 } }).success).toBe(false);
  });

  it("rejects bad hex colours in style", () => {
    const video = loadFixture();
    video.style.colors.accent = "orange";
    expect(VideoSchema.safeParse(video).success).toBe(false);
  });

  it("rejects overly long titles", () => {
    const scene = {
      id: 1, template: "TitleCard", durationInFrames: 120, narration: "",
      props: { title: "x".repeat(61) },
    };
    expect(SceneSchema.safeParse(scene).success).toBe(false);
  });
});
