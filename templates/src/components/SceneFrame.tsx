import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { sceneTransition } from "../anim";
import { contentBox, useScene } from "../theme";

/**
 * Wraps a template: applies the 12-frame entry/exit and confines it to the content box
 * (96 px safe margin on every side, plus room for captions at the bottom).
 */
export const SceneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, style } = useScene();
  const { opacity, translateY, scale } = sceneTransition(frame, durationInFrames);
  const box = contentBox(style);
  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${translateY}px) scale(${scale})` }}>
      <div style={{ position: "absolute", ...box, display: "flex", flexDirection: "column" }}>{children}</div>
    </AbsoluteFill>
  );
};
