import React from "react";
import { Composition } from "remotion";
import sample from "../fixtures/sample-scenes.json";
import { calculateMetadata } from "./metadata";
import { VideoSchema } from "./schema";
import { Video } from "./Video";

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
