import { Easing, interpolate, spring } from "remotion";
import { TRANSITION } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Start frames for `count` items spread over the scene: the first appears right after the
 * entry animation, the last no later than `until` (fraction of the scene, default 70 %).
 */
export const revealFrames = (count: number, durationInFrames: number, until = 0.7, from = TRANSITION) => {
  if (count <= 0) return [];
  const end = Math.max(from + 1, durationInFrames * until);
  const step = count === 1 ? 0 : (end - from) / count;
  return Array.from({ length: count }, (_, i) => Math.round(from + i * step));
};

/** Smooth, non-bouncy 0→1 spring starting at `start`. */
export const ease = (frame: number, fps: number, start: number, durationInFrames = 18) =>
  spring({ frame: frame - start, fps, durationInFrames, config: { damping: 200 } });

/** Slightly springy 0→1 for icons and badges. */
export const pop = (frame: number, fps: number, start: number) =>
  spring({ frame: frame - start, fps, config: { damping: 12, stiffness: 160, mass: 0.6 } });

/** Linear-in-time progress with ease-in-out shape, for drawing lines and growing bars. */
export const progress = (frame: number, start: number, length: number) =>
  interpolate(frame, [start, start + length], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });

/** Whole-scene entry (first 12 frames) and exit (last 12 frames). */
export const sceneTransition = (frame: number, durationInFrames: number) => {
  const enter = interpolate(frame, [0, TRANSITION], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const exit = interpolate(frame, [durationInFrames - TRANSITION, durationInFrames], [1, 0], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  return {
    opacity: Math.min(enter, exit),
    translateY: (1 - enter) * 28 - (1 - exit) * 20,
    scale: 0.985 + 0.015 * Math.min(enter, exit),
  };
};

/** Fade + rise style for an element whose reveal value goes 0→1. */
export const rise = (t: number, distance = 30): React.CSSProperties => ({
  opacity: t,
  transform: `translateY(${(1 - t) * distance}px)`,
});
