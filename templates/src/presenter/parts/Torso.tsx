import React from "react";
import type { Palette } from "../look";

/** Jacket outline, shoulders to below the waist (body space, centre line x = 0); open at the neck. */
const TORSO_OUTLINE =
  "M -44 344 C -84 350 -128 356 -158 370 C -182 382 -192 402 -192 430 C -190 500 -180 580 -170 650 L -172 840 " +
  "L 172 840 L 170 650 C 180 580 190 500 192 430 C 192 402 182 382 158 370 C 128 356 84 350 44 344";

/** Jacket silhouette (closed behind the collar, below the neck). */
export const TORSO_PATH = TORSO_OUTLINE + " C 24 372 -24 372 -44 344 Z";

/** Per outfit: how deep the jacket opening goes, lapel width and button rows. */
const CUT = {
  blazer: { v: 592, lapel: 96, notchY: 424, buttons: [640, 742] },
  labcoat: { v: 640, lapel: 112, notchY: 436, buttons: [684, 790] },
} as const;

/** The shirt collar band behind the neck (drawn before the neck). */
export const CollarBack: React.FC<{ pal: Palette }> = ({ pal }) => (
  <path d="M -48 356 C -48 318 48 318 48 356 Z" fill={pal.shirtShade} stroke={pal.shirtLine} strokeWidth={3} strokeLinejoin="round" />
);

/** One lapel (screen-left; the right one is mirrored), from the neck down to the top button. */
const lapelPath = (v: number, w: number, notchY: number) =>
  `M -42 344 L -1 ${v} C -26 ${v - 50} -${w * 0.72} ${notchY + 70} -${w} ${notchY + 6} ` +
  `L -${w - 18} ${notchY - 8} L -${w - 6} ${notchY - 24} C -${w - 22} ${notchY - 52} -70 362 -56 344 Z`;

/** Jacket (navy blazer or lab coat) over a collared shirt, no tie. */
export const Torso: React.FC<{ pal: Palette; uid: string }> = ({ pal, uid }) => {
  const clip = `${uid}-torso`;
  const cut = CUT[pal.outfit];
  const lab = pal.outfit === "labcoat";
  const lapel = lapelPath(cut.v, cut.lapel, cut.notchY);
  const line = { stroke: pal.jacketLine, strokeWidth: 3, strokeLinejoin: "round" as const };
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={TORSO_PATH} />
        </clipPath>
      </defs>
      <path d={TORSO_PATH} fill={pal.jacket} />
      <g clipPath={`url(#${clip})`}>
        {/* Rim light along the whole silhouette: separates him from a dark background. */}
        <path d={TORSO_PATH} fill="none" stroke={pal.rim} strokeWidth={14} opacity={lab ? 0.25 : 0.4} />
        {/* Light from the upper left: the right side of the body is in shade. */}
        <path d="M 104 360 C 156 370 178 398 176 432 C 172 500 162 570 152 640 L 156 840 L 110 840 C 120 700 124 560 120 450 C 118 410 112 380 104 360 Z" fill={pal.jacketShade} />
        <path d="M -176 420 C -156 396 -130 384 -104 382 C -132 402 -152 440 -162 490 Z" fill={pal.jacketLight} opacity={0.7} />
        {/* Shirt in the opening, with a soft shadow under the collar. */}
        <path d={`M -46 340 L 0 ${cut.v + 8} L 46 340 Z`} fill={pal.shirt} />
        <path d={`M -30 360 L 0 ${cut.v + 8} L 30 360 Z`} fill={pal.shirtShade} opacity={0.35} />
        {/* Shirt placket and buttons. */}
        <path d={`M 3 420 L 3 ${cut.v}`} stroke={pal.shirtShade} strokeWidth={3} />
        {[452, 520].filter((y) => y < cut.v - 20).map((y) => (
          <circle key={y} cx={3} cy={y} r={4.5} fill={pal.shirtShade} stroke={pal.shirtLine} strokeWidth={1.2} />
        ))}
        {/* Front edge of the jacket below the top button. */}
        <path d={`M 0 ${cut.v} C 4 ${cut.v + 80} 4 ${cut.v + 160} 2 860`} fill="none" stroke={pal.jacketLine} strokeWidth={3} />
        <path d={`M -10 ${cut.v + 10} C -6 ${cut.v + 80} -6 ${cut.v + 160} -8 860`} fill="none" stroke={pal.jacketShade} strokeWidth={6} opacity={0.6} />
        {/* Soft folds at the arm pits. */}
        <path d="M -150 520 C -140 560 -138 600 -142 650" fill="none" stroke={pal.jacketShade} strokeWidth={6} strokeLinecap="round" />
        <path d="M 150 520 C 140 560 138 600 142 650" fill="none" stroke={pal.jacketLine} strokeWidth={4} strokeLinecap="round" opacity={0.4} />
      </g>
      <path d={TORSO_OUTLINE} fill="none" {...line} strokeWidth={3.5} />

      {/* Open neck (skin V; top button undone) and the shirt collar points. */}
      <path d="M -24 350 L 0 410 L 24 350 Z" fill={pal.skin} />
      <path d="M -24 350 L 0 410 L 24 350 C 10 362 -10 362 -24 350 Z" fill={pal.skinShade} opacity={0.6} />
      {[-1, 1].map((sd) => (
        <path
          key={sd}
          d={`M ${sd * 46} 330 C ${sd * 38} 360 ${sd * 22} 392 ${sd * 2} 414 L ${sd * 36} 424 C ${sd * 48} 400 ${sd * 60} 376 ${sd * 66} 352 C ${sd * 60} 342 ${sd * 54} 334 ${sd * 46} 330 Z`}
          fill={pal.shirt}
          stroke={pal.shirtLine}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      ))}

      {/* Lapels: same cloth with a lit facing on the left one; shadow under the right one. */}
      <path d={lapel} transform="scale(-1 1)" fill={pal.jacketShade} {...line} />
      <path d={lapel} fill={pal.jacket} {...line} />
      <path d={`M -40 352 L -4 ${cut.v - 14}`} stroke={pal.jacketLight} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      <path d={`M ${-cut.lapel + 8} ${cut.notchY + 10} C -${cut.lapel * 0.62} ${cut.notchY + 70} -30 ${cut.v - 60} -8 ${cut.v - 6}`} fill="none" stroke={pal.jacketShade} strokeWidth={4} strokeLinecap="round" opacity={0.7} />

      {/* Chest pocket: blazer welt; lab coat patch pocket with a pen. */}
      {lab ? (
        <g>
          <rect x={92} y={470} width={9} height={44} rx={3} fill={pal.pen} stroke={pal.jacketLine} strokeWidth={2} />
          <rect x={91} y={466} width={11} height={10} rx={3} fill={pal.shirt} />
          <path d="M 72 488 L 146 486 L 144 552 C 144 558 140 562 134 562 L 84 562 C 78 562 74 558 74 552 Z" fill={pal.jacket} {...line} strokeWidth={2.5} />
          <path d="M 72 488 L 146 486 L 146 498 L 73 500 Z" fill={pal.jacketShade} opacity={0.8} />
        </g>
      ) : (
        <path d="M 74 484 L 134 478" stroke={pal.jacketLine} strokeWidth={5} strokeLinecap="round" />
      )}

      {/* Buttons. */}
      {cut.buttons.map((y) => (
        <g key={y}>
          <circle cx={7} cy={y} r={8} fill={pal.button} stroke={pal.jacketLine} strokeWidth={2} />
          <circle cx={5} cy={y - 2} r={2.5} fill={pal.jacketLight} opacity={0.6} />
        </g>
      ))}
    </g>
  );
};

/** Neck with the shadow under the jaw. */
export const Neck: React.FC<{ pal: Palette; uid: string }> = ({ pal, uid }) => {
  const clip = `${uid}-neck`;
  const d = "M -35 262 L -37 356 C -22 370 22 370 37 356 L 35 262 Z";
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={pal.skin} />
      <g clipPath={`url(#${clip})`}>
        <ellipse cx={0} cy={298} rx={44} ry={36} fill={pal.skinShade} />
        <rect x={16} y={260} width={30} height={110} fill={pal.skinShade} opacity={0.6} />
      </g>
      <path d={d} fill="none" stroke={pal.skinLine} strokeWidth={3} strokeLinejoin="round" />
    </g>
  );
};
