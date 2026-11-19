import React, { useId } from "react";
import { useCurrentFrame } from "remotion";
import { blinkAmount, bob, breath, headTilt, sway } from "../alive/motion";
import type { PresenterExpression, PresenterPose } from "../schema";
import { LOOK, palette, type Look } from "./look";
import { Arm } from "./parts/Arms";
import { Face } from "./parts/Face";
import { HairBack, HairFront } from "./parts/Hair";
import { Head } from "./parts/Head";
import { CollarBack, Neck, Torso } from "./parts/Torso";
import { armPoints, blendPoses, faceAt, POSES, RIG, TALK_MIRROR, type Face as FaceParams, type Pose } from "./poses";

/** Drawing area in body units: x is placed per pose, y runs from the hair top to the waist crop. */
const VIEW_W = 760;
const VIEW_TOP = 8;
const VIEW_BOTTOM = RIG.waist;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;

/** Pose changes between scenes blend over this many frames. */
export const POSE_BLEND = 8;

export type Side = "left" | "right" | "center";

export type FigureProps = {
  pose: Pose;
  face: FaceParams;
  /** Mouth opening 0–1. */
  mouth: number;
  /** Eyelid closure 0–1. */
  blink: number;
  /** Frame used for breathing, bob and curl sway (0 = rest position). */
  t: number;
  /** Which side of the frame he stands on: he shifts slightly towards the content. */
  side: Side;
  accent: string;
  look?: Look;
  /** "head" crops to the head (character sheet close-ups). */
  crop?: "full" | "head";
  width: number;
  height: number;
  /** Freeze breathing/bob/sway (for the character sheet). */
  still?: boolean;
  /** Body centre in the drawing; default: fitted to `pose`. */
  centreX?: number;
};

/** Body centre for a named pose, steady over its whole motion (talk swaps hands). */
export const poseCentre = (name: PresenterPose, side: Side) =>
  bodyCentre(name === "talk" ? [POSES.talk, TALK_MIRROR] : [POSES[name]], side);

/** Horizontal position of the body centre so both hands of every given pose stay inside the drawing. */
const bodyCentre = (poses: Pose[], side: Side) => {
  const xs: number[] = [];
  for (const [p, m] of poses.flatMap((pose) => [[pose.left, -1], [pose.right, 1]] as const)) {
    const { e, w } = armPoints(p);
    const tip = (p.hand === "point" ? 92 : 72) * 1.28;
    const a = ((p.elbow + p.wrist) * Math.PI) / 180;
    const hx = w.x - Math.sin(a) * tip;
    for (const x of [e.x - 36, e.x + 36, w.x - 40, w.x + 40, hx - 22, hx + 22]) xs.push(m === -1 ? x : -x);
  }
  xs.push(-190, 190);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const preferred = VIEW_W / 2 + (side === "left" ? -24 : side === "right" ? 24 : 0);
  const lo = -min + 6;
  const hi = VIEW_W - 6 - max;
  return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, preferred));
};

/** The presenter as pure SVG for one explicit state (no hooks except an id). */
export const PresenterFigure: React.FC<FigureProps> = ({
  pose,
  face,
  mouth,
  blink,
  t,
  side,
  accent,
  look = LOOK,
  crop = "full",
  width,
  height,
  still = false,
  centreX,
}) => {
  const uid = "p" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const pal = palette(look, accent);
  const b = still ? 0 : breath(t);
  const lift = -b * (VIEW_BOTTOM - 344);
  const dy = still ? 0 : bob(t);
  const tilt = pose.tilt + (still ? 0 : headTilt(t));
  const swayFn = (phase: number) => (still ? 0 : sway(t, phase));
  const cx = crop === "head" ? 0 : (centreX ?? bodyCentre([pose], side));
  const viewBox = crop === "head" ? "-138 30 276 300" : `${-cx} ${VIEW_TOP} ${VIEW_W} ${VIEW_H}`;
  const fade = `${uid}-fade`;
  const mask = `${uid}-mask`;

  const head = (
    <g transform={`translate(0 ${lift}) rotate(${tilt} 0 ${RIG.headPivotY})`}>
      <HairBack pal={pal} sway={swayFn} />
      <Head pal={pal} uid={uid} />
      <Face pal={pal} face={face} mouth={mouth} blink={blink} gazeX={pose.gazeX} gazeY={pose.gazeY} glasses={look.glasses} uid={uid} />
      <HairFront pal={pal} sway={swayFn} />
    </g>
  );

  return (
    <svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="xMidYMax meet" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1={0} y1={VIEW_BOTTOM - 90} x2={0} y2={VIEW_BOTTOM}>
          {/* eased fade: no visible edge where it starts */}
          <stop offset="0" stopColor="#fff" stopOpacity={1} />
          <stop offset="0.3" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="0.65" stopColor="#fff" stopOpacity={0.45} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id={mask} maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={4000} height={4000}>
          {/* solid above the fade, overlapping it slightly so no seam shows */}
          <rect x={-2000} y={-2000} width={4000} height={2000 + VIEW_BOTTOM - 86} fill="#fff" />
          <rect x={-2000} y={VIEW_BOTTOM - 90} width={4000} height={90} fill={`url(#${fade})`} />
        </mask>
      </defs>
      {crop === "head" ? (
        head
      ) : (
        <g mask={`url(#${mask})`}>
          <g transform={`translate(0 ${dy})`}>
            <g transform={`translate(0 ${lift})`}>
              <CollarBack pal={pal} />
              <Neck pal={pal} uid={uid} />
            </g>
            <g transform={`translate(0 ${VIEW_BOTTOM}) scale(${1 + b * 0.4} ${1 + b}) translate(0 ${-VIEW_BOTTOM})`}>
              <Torso pal={pal} uid={uid} />
            </g>
            {head}
            <g transform={`translate(0 ${lift})`}>
              <Arm pose={pose.left} mirror={false} pal={pal} />
              <Arm pose={pose.right} mirror={true} pal={pal} />
            </g>
          </g>
        </g>
      )}
    </svg>
  );
};

// ---------- motion of a pose over time ----------

const wave = (frame: number, periodFrames: number, phase = 0) => Math.sin((2 * Math.PI * frame) / periodFrames + phase);

/** Average loudness over the last few frames (how much he is speaking right now). */
const activity = (mouth: number[], frame: number, span = 8) => {
  if (!mouth.length) return 0;
  let sum = 0;
  for (let f = frame - span + 1; f <= frame; f++) sum += mouth[f] ?? 0;
  return sum / span;
};

/**
 * The pose `name` at `frame`, with its living motion: talk alternates the gesturing hand as
 * the voice speaks (hands rest in pauses), wave rocks the wrist, celebrate pumps the fists.
 */
export const animatedPose = (name: PresenterPose, frame: number, mouth: number[]): Pose => {
  const base = POSES[name];
  const arm = (a: Pose["left"], ds: number, de: number, dw = 0) => ({ ...a, shoulder: a.shoulder + ds, elbow: a.elbow + de, wrist: a.wrist + dw });
  switch (name) {
    case "talk": {
      // Cumulative loudness drives the swap, so hands only change while he talks.
      let spoken = 0;
      for (let f = 0; f <= frame && f < mouth.length; f++) spoken += mouth[f];
      const phase = mouth.length ? spoken / 20 : frame / 75;
      const g = 0.5 - 0.5 * Math.cos(Math.PI * phase);
      const p = blendPoses(base, TALK_MIRROR, g);
      const act = mouth.length ? activity(mouth, frame) : 0.4;
      const beat = (mouth[frame] ?? 0) * 6;
      return {
        ...p,
        left: arm(p.left, act * 6 * (1 - g), -act * 10 * (1 - g) - beat * (1 - g), beat * (1 - g)),
        right: arm(p.right, act * 6 * g, -act * 10 * g - beat * g, beat * g),
      };
    }
    case "wave": {
      const w = wave(frame, 24);
      return { ...base, right: arm(base.right, 2 * w, 5 * w, 16 * w) };
    }
    case "celebrate": {
      const w = wave(frame, 26);
      return { ...base, left: arm(base.left, 5 * w, 4 * w), right: arm(base.right, -5 * w, -4 * w) };
    }
    case "point-left":
    case "point-right": {
      const w = wave(frame, 70);
      const k = name === "point-left" ? "left" : "right";
      return { ...base, [k]: arm(base[k], 1.5 * w, 3 * w) };
    }
    case "surprised": {
      const w = wave(frame, 90);
      return { ...base, left: arm(base.left, w, 2 * w), right: arm(base.right, w, 2 * w) };
    }
    case "think": {
      const w = wave(frame, 110);
      return { ...base, right: arm(base.right, 0, 1.5 * w, 3 * w), gazeX: base.gazeX + 0.1 * w };
    }
    default: {
      const w = wave(frame, 130);
      return { ...base, left: arm(base.left, w, 1.5 * w), right: arm(base.right, -w, -1.5 * w) };
    }
  }
};

export type PresenterState = {
  pose: PresenterPose;
  expression: PresenterExpression;
  mouth: number[];
  durationInFrames: number;
};

/**
 * The presenter of one scene. Pose and expression blend from the previous scene's over
 * POSE_BLEND frames; he blinks (seeded by the scene id), breathes, bobs and his curls sway.
 */
export const Presenter: React.FC<{
  pose: PresenterPose;
  expression: PresenterExpression;
  mouth: number[];
  side: "left" | "right";
  size: "large" | "small";
  width: number;
  height: number;
  accent: string;
  /** Scene id: seeds the blinks. */
  seed: number;
  /** Frame of the scene start in the video, so breathing continues across scenes. */
  offset?: number;
  /** The previous scene's presenter, to blend from. */
  from?: PresenterState;
  look?: Look;
}> = ({ pose, expression, mouth, side, width, height, accent, seed, offset = 0, from, look }) => {
  const frame = useCurrentFrame();
  const target = animatedPose(pose, frame, mouth);
  const k = from ? Math.min(1, frame / POSE_BLEND) : 1;
  const start = from ? animatedPose(from.pose, from.durationInFrames - 1, from.mouth) : target;
  const face = faceAt(from ? from.expression : expression, expression, k);
  const gazeBias = side === "left" ? 0.25 : -0.25;
  const p = blendPoses(start, target, k);
  // The body centre moves (smoothly) only when the pose needs a different amount of room.
  const s = k * k * (3 - 2 * k);
  const centreX = from ? poseCentre(from.pose, side) + (poseCentre(pose, side) - poseCentre(from.pose, side)) * s : poseCentre(pose, side);
  return (
    <PresenterFigure
      centreX={centreX}
      pose={{ ...p, gazeX: Math.max(-1, Math.min(1, p.gazeX + gazeBias)) }}
      face={face}
      mouth={mouth[frame] ?? 0}
      blink={blinkAmount(frame, seed)}
      t={frame + offset}
      side={side}
      accent={accent}
      look={look}
      width={width}
      height={height}
    />
  );
};
