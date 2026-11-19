import React from "react";
import { Composition, Still } from "remotion";
import sample from "../fixtures/sample-scenes.json";
import { CharacterSheet } from "./CharacterSheet";
import { calculateMetadata } from "./metadata";
import { StyleSchema, VideoSchema } from "./schema";
import { Video } from "./Video";

const defaults = VideoSchema.parse(sample);

export const Root: React.FC = () => (
  <>
    <Composition
      id="Video"
      component={Video}
      schema={VideoSchema}
      defaultProps={defaults}
      calculateMetadata={calculateMetadata}
      // Overridden by calculateMetadata; required by <Composition>.
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* One-page sheet of the presenter in every pose and expression (owner approval). */}
    <Still
      id="CharacterSheet"
      component={CharacterSheet}
      defaultProps={{ style: StyleSchema.parse(defaults.style) }}
      width={1920}
      height={1080}
    />
  </>
);
