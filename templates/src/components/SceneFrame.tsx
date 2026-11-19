import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { sceneTransition } from "../anim";
import { useScene } from "../theme";

/**
 * Wraps a template: applies the 12-frame entry/exit and confines it to the content box
 * (96 px safe margin on every side, room for captions at the bottom, beside the presenter).
 */
export const SceneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, box } = useScene();
  const { opacity, translateY, scale } = sceneTransition(frame, durationInFrames);
  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${translateY}px) scale(${scale})` }}>
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.width, height: box.height, display: "flex", flexDirection: "column" }}>{children}</div>
    </AbsoluteFill>
  );
};
