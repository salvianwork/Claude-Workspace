import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import sample from "../fixtures/sample-scenes.json";
import { VideoSchema, type VideoProps } from "./schema";
import { Video } from "./Video";

/** Duration, fps and size all come from scenes.json. */
export const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => ({
  durationInFrames: props.scenes.reduce((sum, s) => sum + s.durationInFrames, 0),
  fps: props.fps,
  width: props.width,
  height: props.height,
});

export const Root: React.FC = () => (
  <Composition
    id="Video"
    component={Video}
    schema={VideoSchema}
    defaultProps={VideoSchema.parse(sample)}
    calculateMetadata={calculateMetadata}
    // Overridden by calculateMetadata; required by <Composition>.
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
  />
);
