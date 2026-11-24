import React from "react";
import type { Palette } from "../look";

/** Face silhouette: wide cheekbones, softly tapering jaw, rounded chin (body space). */
export const FACE_PATH =
  "M 0 116 C 54 116 86 150 86 204 C 86 250 70 286 40 304 C 26 313 -26 313 -40 304 C -70 286 -86 250 -86 204 " +
  "C -86 150 -54 116 0 116 Z";

const Ear: React.FC<{ pal: Palette; side: -1 | 1 }> = ({ pal, side }) => (
  <g transform={`translate(${side * 84} 226) scale(${side} 1)`}>
    <ellipse cx={4} cy={0} rx={16} ry={24} fill={pal.skin} stroke={pal.skinLine} strokeWidth={3} />
    <path d="M 8 -12 C 16 -8 16 10 8 14" fill="none" stroke={pal.skinDeep} strokeWidth={4} strokeLinecap="round" />
  </g>
);

/** Ears and the face skin with its soft shading (features are drawn by <Face>). */
export const Head: React.FC<{ pal: Palette; uid: string }> = ({ pal, uid }) => {
  const clip = `${uid}-face`;
  return (
    <g>
      <Ear pal={pal} side={-1} />
      <Ear pal={pal} side={1} />
      <defs>
        <clipPath id={clip}>
          <path d={FACE_PATH} />
        </clipPath>
      </defs>
      <path d={FACE_PATH} fill={pal.skin} />
      <g clipPath={`url(#${clip})`}>
        {/* 3/4 feel: the right cheek and jaw turn away from the light. */}
        <path d="M 86 150 C 70 190 64 240 50 274 C 40 296 20 308 0 312 L 90 330 L 100 150 Z" fill={pal.skinShade} opacity={0.85} />
        <ellipse cx={0} cy={318} rx={70} ry={16} fill={pal.skinShade} opacity={0.45} />
        {/* Shadow of the curls on the forehead. */}
        <ellipse cx={0} cy={150} rx={96} ry={24} fill={pal.skinShade} />
        {/* Cheekbone highlight. */}
        <ellipse cx={-50} cy={236} rx={18} ry={12} fill={pal.skinLight} opacity={0.55} />
      </g>
      <path d={FACE_PATH} fill="none" stroke={pal.skinLine} strokeWidth={3} />
    </g>
  );
};
