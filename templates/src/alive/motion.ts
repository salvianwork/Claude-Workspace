import { spring } from "remotion";

/**
 * Calm, deterministic motion helpers for the "alive" layer. Everything is a pure function of
 * the frame (and a seed), so every render of the same scenes.json is identical.
 */

const FPS = 30;

/** Small seeded PRNG (mulberry32): same seed -> same sequence, values in [0, 1). */
export const seededRandom = (seed: number) => {
  let a = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Springy 0 -> 1 (with a small overshoot) starting `delay` frames into the scene.
 * Used for icons, numbers and list items popping in.
 */
export const popIn = (frame: number, delay = 0) =>
  frame < delay ? 0 : spring({ frame: frame - delay, fps: FPS, config: { damping: 12, stiffness: 160, mass: 0.6 } });

/** Length of one blink in frames (close, hold, open). */
const BLINK = 7;

/** Start frames of the blinks in a scene: one every 2–5 s, seeded by the scene id. */
export const blinkStarts = (seed: number, durationInFrames: number): number[] => {
  const rnd = seededRandom(seed * 7919 + 13);
  const starts: number[] = [];
  let f = Math.round(15 + rnd() * 45);
  while (f < durationInFrames) {
    starts.push(f);
    f += Math.round(2 * FPS + rnd() * 3 * FPS);
  }
  return starts;
};

/** Eyelid closure at `frame`: 0 = open, 1 = shut. */
export const blinkAmount = (frame: number, seed: number) => {
  for (const s of blinkStarts(seed, frame + 1)) {
    const d = frame - s;
    if (d >= 0 && d < BLINK) return Math.max(0, 1 - Math.abs(d - 3) / 3.5);
  }
  return 0;
};

const wave = (frame: number, periodS: number, phase = 0) => Math.sin((2 * Math.PI * frame) / (periodS * FPS) + phase);

/** Breathing: relative torso scale offset, ±1.5 % over a 4 s cycle. */
export const breath = (frame: number) => 0.015 * wave(frame, 4);

/** Gentle vertical bob of the whole figure, ±4 px (design canvas px). */
export const bob = (frame: number) => 4 * wave(frame, 4, Math.PI / 2);

/** Curl sway in degrees, ±2°, each curl group with its own phase. */
export const sway = (frame: number, phase = 0) => 2 * wave(frame, 2.6, phase);

/** Slow head tilt in degrees (±1.2°), so he never looks frozen. */
export const headTilt = (frame: number) => 1.2 * wave(frame, 5.3, 1.1);
