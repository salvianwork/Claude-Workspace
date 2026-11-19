import type { CalculateMetadataFunction } from "remotion";
import { VideoSchema, type VideoProps } from "./schema";

/** ["scenes", 1, "props", "items"] -> "scenes[1].props.items" */
const formatPath = (path: PropertyKey[]) =>
  path.map((k, i) => (typeof k === "number" ? `[${k}]` : `${i ? "." : ""}${String(k)}`)).join("") || "(root)";

/**
 * Remotion does not run the zod schema on --props at render time, so validate here:
 * invalid scenes.json fails with a readable message, and defaults (e.g. empty narration,
 * no arrows) are filled in before any template sees the data.
 * Duration is the sum of all scenes; fps and size come from the (validated) props.
 */
export const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => {
  const result = VideoSchema.safeParse(props);
  if (!result.success) {
    // One line, so the CLI shows every problem (it prints only the first line of the message).
    const problems = result.error.issues.map((i) => `${formatPath(i.path)}: ${i.message}`).join("; ");
    throw new Error(`Invalid scenes.json: ${problems}`);
  }
  const parsed = result.data;
  return {
    props: parsed,
    durationInFrames: parsed.scenes.reduce((sum, s) => sum + s.durationInFrames, 0),
    fps: parsed.fps,
    width: parsed.width,
    height: parsed.height,
  };
};
