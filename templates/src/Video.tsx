import React from "react";
import { AbsoluteFill, Easing, interpolate, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "./alive/Background";
import { Captions } from "./Captions";
import { SceneFrame } from "./components/SceneFrame";
import { loadBundledFonts } from "./fonts";
import { Presenter } from "./presenter/Presenter";
import type { Scene, Style, VideoProps } from "./schema";
import { TEMPLATES } from "./templates";
import { CANVAS, contentBox, presenterBox, SceneContext, TRANSITION, withAlpha } from "./theme";

loadBundledFonts();

const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  const Template = TEMPLATES[scene.template] as React.FC<Scene["props"]>;
  return <Template {...scene.props} />;
};

/** He stays on screen between two scenes when he keeps the same place and size. */
const stays = (a?: Scene, b?: Scene) =>
  Boolean(a && b && a.presenter.position !== "none" && a.presenter.position === b.presenter.position && a.presenter.size === b.presenter.size);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * The presenter of one scene, in his own box beside the content. He slides/fades in and out
 * within the scene's own 12-frame entry/exit (never overlapping the next scene), or simply
 * stays when the neighbouring scene has him at the same place; then the pose blends.
 */
const PresenterLayer: React.FC<{ scene: Scene; prev?: Scene; next?: Scene; offset: number; style: Style }> = ({
  scene,
  prev,
  next,
  offset,
  style,
}) => {
  const frame = useCurrentFrame();
  const box = presenterBox(style, scene.presenter);
  if (!box || scene.presenter.position === "none") return null;
  const side = scene.presenter.position;
  const d = scene.durationInFrames;
  const enter = stays(prev, scene) ? 1 : interpolate(frame, [0, TRANSITION], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const exit = stays(scene, next) ? 1 : interpolate(frame, [d - TRANSITION, d], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) });
  const v = Math.min(enter, exit);
  const dx = (1 - v) * 60 * (side === "left" ? -1 : 1);
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        opacity: v,
        transform: `translateX(${dx}px)`,
      }}
    >
      {/* soft spotlight that anchors him on the background */}
      <div
        style={{
          position: "absolute",
          left: "8%",
          right: "8%",
          top: "18%",
          bottom: 0,
          borderRadius: "50% 50% 0 0",
          background: `radial-gradient(ellipse at 50% 70%, ${withAlpha(style.colors.primary, 0.14)} 0%, ${withAlpha(style.colors.primary, 0)} 68%)`,
        }}
      />
      <div style={{ position: "absolute", inset: 0 }}>
      <Presenter
        pose={scene.presenter.pose}
        expression={scene.presenter.expression}
        mouth={scene.mouth}
        side={side}
        size={scene.presenter.size}
        width={box.width}
        height={box.height}
        outfit={style.presenterOutfit}
        seed={scene.id}
        offset={offset}
        from={
          stays(prev, scene) && prev
            ? { pose: prev.presenter.pose, expression: prev.presenter.expression, mouth: prev.mouth, durationInFrames: prev.durationInFrames }
            : undefined
        }
      />
      </div>
    </div>
  );
};

/** The whole video: continuous background, then each scene in a <Series> with presenter and captions. */
export const Video: React.FC<VideoProps> = ({ style, scenes }) => {
  const { width, height } = useVideoConfig();
  // Templates are laid out on a 1920×1080 canvas; scale it to fit the real frame size.
  const scale = Math.min(width / CANVAS.width, height / CANVAS.height);
  const offsets = scenes.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + scenes[i - 1].durationInFrames], []);
  return (
    <AbsoluteFill style={{ backgroundColor: style.colors.background }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: CANVAS.width, height: CANVAS.height, position: "relative", flexShrink: 0, transform: `scale(${scale})` }}>
          <Background style={style} />
          <Series>
            {scenes.map((scene, i) => (
              <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames} name={`${scene.id} ${scene.template}`}>
                <SceneContext.Provider
                  value={{ durationInFrames: scene.durationInFrames, style, box: contentBox(style, scene.presenter), presenter: scene.presenter }}
                >
                  <SceneFrame>
                    <SceneView scene={scene} />
                  </SceneFrame>
                  <PresenterLayer scene={scene} prev={scenes[i - 1]} next={scenes[i + 1]} offset={offsets[i]} style={style} />
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
