import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { calculateMetadata } from "./metadata";
import { VideoSchema } from "./schema";

const fixture = () =>
  JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/sample-scenes.json", import.meta.url)), "utf8"));

// calculateMetadata receives raw --props JSON at render time; it must validate and fill defaults.
const run = (props: unknown) =>
  calculateMetadata({ props, defaultProps: props, abortSignal: new AbortController().signal, compositionId: "Video", isRendering: true } as never) as {
    props: ReturnType<typeof VideoSchema.parse>;
    durationInFrames: number;
    fps: number;
    width: number;
    height: number;
  };

describe("calculateMetadata", () => {
  it("returns parsed props with defaults and the summed duration", () => {
    const video = fixture();
    const diagram = video.scenes.find((s: { template: string }) => s.template === "Diagram");
    delete diagram.props.arrows;
    delete video.scenes[0].narration;
    const meta = run(video);
    const parsed = meta.props.scenes.find((s) => s.template === "Diagram")!;
    expect(parsed.template === "Diagram" && parsed.props.arrows).toEqual([]);
    expect(meta.props.scenes[0].narration).toBe("");
    expect(meta.durationInFrames).toBe(video.scenes.reduce((a: number, s: { durationInFrames: number }) => a + s.durationInFrames, 0));
    expect([meta.fps, meta.width, meta.height]).toEqual([30, 1920, 1080]);
  });

  it("throws a readable error naming the bad field", () => {
    const video = fixture();
    video.scenes[1].props.items = ["1", "2", "3", "4", "5", "6"];
    expect(() => run(video)).toThrow(/scenes\[1\]\.props\.items/);
  });

  it("fills fps/width/height defaults and rejects other values", () => {
    const video = fixture();
    delete video.fps;
    delete video.width;
    delete video.height;
    const meta = run(video);
    expect([meta.fps, meta.width, meta.height]).toEqual([30, 1920, 1080]);
    expect(VideoSchema.safeParse({ ...fixture(), fps: 25 }).success).toBe(false);
    expect(VideoSchema.safeParse({ ...fixture(), width: 1280 }).success).toBe(false);
  });
});
