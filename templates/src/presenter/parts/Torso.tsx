import React from "react";
import type { Palette } from "../look";

/** Shirt silhouette, shoulders to below the waist (body space, centre line x = 0). */
export const TORSO_PATH =
  "M -46 344 C -80 349 -116 354 -140 366 C -160 378 -170 398 -170 424 C -168 470 -160 560 -146 640 L -150 820 " +
  "L 150 820 L 146 640 C 160 560 168 470 170 424 C 170 398 160 378 140 366 C 116 354 80 349 46 344 Z";

/** The collar band behind the neck (drawn before the neck). */
export const CollarBack: React.FC<{ pal: Palette }> = ({ pal }) => (
  <path d="M -52 352 C -50 322 50 322 52 352 Z" fill={pal.shirtDark} stroke={pal.shirtLine} strokeWidth={3} strokeLinejoin="round" />
);

/** Shirt body: base, soft 3/4 shading, open collar, placket with buttons, chest pocket with a pen. */
export const Torso: React.FC<{ pal: Palette; uid: string }> = ({ pal, uid }) => {
  const clip = `${uid}-torso`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={TORSO_PATH} />
        </clipPath>
      </defs>
      <path d={TORSO_PATH} fill={pal.shirt} />
      <g clipPath={`url(#${clip})`}>
        {/* Light comes from the upper left: the right side of the body is in shade. */}
        <path d="M 96 354 C 150 366 176 396 174 430 C 170 500 160 570 150 640 L 154 820 L 100 820 C 110 700 116 560 112 450 C 110 410 104 380 96 354 Z" fill={pal.shirtShade} />
        <path d="M -150 410 C -130 392 -104 384 -84 384 C -110 400 -130 430 -140 470 Z" fill={pal.shirtLight} opacity={0.55} />
        {/* Shadow cast by the head and collar. */}
        <ellipse cx={0} cy={366} rx={74} ry={26} fill={pal.shirtShade} />
        {/* Soft folds at the arm pits and the belt line. */}
        <path d="M -128 520 C -118 560 -116 600 -120 650" fill="none" stroke={pal.shirtShade} strokeWidth={5} strokeLinecap="round" />
        <path d="M 128 520 C 118 560 116 600 120 650" fill="none" stroke={pal.shirtDark} strokeWidth={5} strokeLinecap="round" opacity={0.6} />
      </g>
      <path d={TORSO_PATH} fill="none" stroke={pal.shirtLine} strokeWidth={3.5} strokeLinejoin="round" />

      {/* Chest pocket with a pen. */}
      <rect x={-106} y={452} width={8} height={36} rx={3} fill={pal.pen} stroke={pal.shirtLine} strokeWidth={2} />
      <rect x={-107} y={448} width={10} height={9} rx={3} fill={pal.glasses} />
      <path d="M -126 476 L -72 476 L -74 528 C -74 534 -78 538 -84 538 L -114 538 C -120 538 -124 534 -124 528 Z" fill={pal.shirtShade} stroke={pal.shirtLine} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M -126 476 L -72 476 L -73 488 L -125 488 Z" fill={pal.shirtDark} />

      {/* Placket and buttons. */}
      <path d="M 0 420 L 0 820" stroke={pal.shirtDark} strokeWidth={3} />
      <path d="M 9 424 L 9 820" stroke={pal.shirtShade} strokeWidth={2} />
      {[478, 556, 634, 712].map((y) => (
        <g key={y}>
          <circle cx={4.5} cy={y} r={6} fill={pal.shirtDark} />
          <circle cx={3} cy={y - 1.5} r={2} fill={pal.shirtLight} opacity={0.7} />
        </g>
      ))}

      {/* Open neck (skin V) and collar flaps. */}
      <path d="M -40 344 L 0 424 L 40 344 Z" fill={pal.skinShade} />
      <path d="M -24 368 L 0 424 L 24 368 C 10 376 -10 376 -24 368 Z" fill={pal.skin} />
      <path
        d="M -48 334 C -36 366 -20 396 -2 424 L -42 430 C -56 412 -72 388 -84 364 C -74 352 -62 340 -48 334 Z"
        fill={pal.shirtDark}
        stroke={pal.shirtLine}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d="M 48 334 C 36 366 20 396 2 424 L 42 430 C 56 412 72 388 84 364 C 74 352 62 340 48 334 Z"
        fill={pal.shirtDark}
        stroke={pal.shirtLine}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path d="M -44 344 C -34 370 -22 394 -8 416" fill="none" stroke={pal.shirtShade} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
    </g>
  );
};

/** Neck with the shadow under the jaw. */
export const Neck: React.FC<{ pal: Palette; uid: string }> = ({ pal, uid }) => {
  const clip = `${uid}-neck`;
  const d = "M -31 262 L -33 352 C -20 366 20 366 33 352 L 31 262 Z";
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={pal.skin} />
      <g clipPath={`url(#${clip})`}>
        <ellipse cx={0} cy={300} rx={40} ry={34} fill={pal.skinShade} />
        <rect x={14} y={260} width={30} height={110} fill={pal.skinShade} opacity={0.6} />
      </g>
      <path d={d} fill="none" stroke={pal.skinLine} strokeWidth={3} strokeLinejoin="round" />
    </g>
  );
};
