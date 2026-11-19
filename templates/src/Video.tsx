import React from "react";
import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import { Captions } from "./Captions";
import { Background } from "./components/Background";
import { SceneFrame } from "./components/SceneFrame";
import { loadBundledFonts } from "./fonts";
import type { Scene, VideoProps } from "./schema";
import { TEMPLATES } from "./templates";
import { CANVAS, SceneContext } from "./theme";

loadBundledFonts();

const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  const Template = TEMPLATES[scene.template] as React.FC<Scene["props"]>;
  return <Template {...scene.props} />;
};

/** The whole video: continuous background, then each scene in a <Series> with its captions. */
export const Video: React.FC<VideoProps> = ({ style, scenes }) => {
  const { width, height } = useVideoConfig();
  // Templates are laid out on a 1920×1080 canvas; scale it to fit the real frame size.
  const scale = Math.min(width / CANVAS.width, height / CANVAS.height);
  return (
    <AbsoluteFill style={{ backgroundColor: style.colors.background }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: CANVAS.width, height: CANVAS.height, position: "relative", flexShrink: 0, transform: `scale(${scale})` }}>
          <Background style={style} />
          <Series>
            {scenes.map((scene) => (
              <Series.Sequence
                key={scene.id}
                durationInFrames={scene.durationInFrames}
                name={`${scene.id} ${scene.template}`}
              >
                <SceneContext.Provider value={{ durationInFrames: scene.durationInFrames, style }}>
                  <SceneFrame>
                    <SceneView scene={scene} />
                  </SceneFrame>
                  <Captions narration={scene.narration} durationInFrames={scene.durationInFrames} style={style} />
                </SceneContext.Provider>
              </Series.Sequence>
            ))}
          </Series>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
