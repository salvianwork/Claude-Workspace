import React from "react";
import { AbsoluteFill } from "remotion";
import { loadBundledFonts } from "./fonts";
import { LOOK, palette } from "./presenter/look";
import { PresenterFigure } from "./presenter/Presenter";
import { EXPRESSIONS, faceAt, POSES } from "./presenter/poses";
import { PRESENTER_EXPRESSIONS, PRESENTER_POSES, type PresenterExpression, type PresenterPose, type Style } from "./schema";
import { fontStack, withAlpha } from "./theme";

loadBundledFonts();

/** Expression and mouth used for each pose on the sheet. */
const POSE_LOOK: Record<PresenterPose, [PresenterExpression, number]> = {
  idle: ["neutral", 0],
  talk: ["happy", 0.55],
  "point-left": ["curious", 0],
  "point-right": ["happy", 0.3],
  think: ["thinking", 0],
  surprised: ["surprised", 0.5],
  celebrate: ["happy", 0.85],
  wave: ["happy", 0.3],
};

const MOUTHS: [string, string, number][] = [
  ["closed", "< 0.15", 0],
  ["slight", "0.15–0.4", 0.3],
  ["open", "0.4–0.7", 0.55],
  ["wide", "≥ 0.7", 0.85],
];

/** One-page sheet of the presenter: every pose, the four talk mouth shapes and every expression. */
export const CharacterSheet: React.FC<{ style: Style }> = ({ style }) => {
  const { colors, fonts } = style;
  const pal = palette(LOOK, colors.accent);
  const label = (text: string, sub?: string) => (
    <div style={{ textAlign: "center", lineHeight: 1.15 }}>
      <div style={{ fontFamily: fontStack(fonts.heading), fontWeight: 700, fontSize: 24, color: colors.text }}>{text}</div>
      {sub ? <div style={{ fontFamily: fontStack(fonts.body), fontSize: 17, color: withAlpha(colors.text, 0.55) }}>{sub}</div> : null}
    </div>
  );
  const card: React.CSSProperties = {
    background: withAlpha(colors.surface, 0.75),
    border: `1.5px solid ${withAlpha(colors.primary, 0.18)}`,
    borderRadius: 22,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    paddingBottom: 10,
  };
  const head = (expression: PresenterExpression, mouth: number) => (
    <PresenterFigure
      pose={POSES.idle}
      face={faceAt(expression, expression, 1)}
      mouth={mouth}
      blink={0}
      t={0}
      side="center"
      accent={colors.accent}
      crop="head"
      width={150}
      height={164}
      still
    />
  );
  return (
    <AbsoluteFill style={{ background: colors.background, padding: "26px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 56 }}>
        <div>
          <div style={{ fontFamily: fontStack(fonts.heading), fontWeight: 800, fontSize: 38, color: colors.text, letterSpacing: "-0.01em" }}>
            Presenter <span style={{ color: colors.accent }}>character sheet</span>
          </div>
          <div style={{ fontFamily: fontStack(fonts.body), fontSize: 19, color: withAlpha(colors.text, 0.6) }}>
            {PRESENTER_POSES.length} poses · 4 talk mouth shapes · {PRESENTER_EXPRESSIONS.length} expressions · look settings in
            templates/src/presenter/look.ts
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, fontFamily: fontStack(fonts.body), fontSize: 17, color: withAlpha(colors.text, 0.7) }}>
          {[
            ["skin", pal.skin],
            ["hair", pal.hair],
            ["shirt (style accent)", pal.shirt],
            ["collar", pal.shirtDark],
          ].map(([name, c]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: c, border: `2px solid ${withAlpha(colors.text, 0.25)}` }} />
              {name}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(2, 344px)", gap: 14 }}>
        {PRESENTER_POSES.map((p) => {
          const [expression, mouth] = POSE_LOOK[p];
          return (
            <div key={p} style={card}>
              <PresenterFigure
                pose={POSES[p]}
                face={faceAt(expression, expression, 1)}
                mouth={mouth}
                blink={0}
                t={0}
                side="center"
                accent={colors.accent}
                width={430}
                height={290}
                still
              />
              {label(p, expression)}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, flex: 1 }}>
        {[
          { title: "talk: mouth shapes (from voice loudness)", items: MOUTHS.map(([n, sub, v]) => ({ n, sub, el: head("neutral", v) })) },
          { title: "expressions", items: (Object.keys(EXPRESSIONS) as PresenterExpression[]).map((e) => ({ n: e, sub: "", el: head(e, 0) })) },
        ].map((group) => (
          <div key={group.title} style={{ ...card, flex: group.items.length, justifyContent: "flex-start", paddingTop: 10 }}>
            <div style={{ fontFamily: fontStack(fonts.body), fontSize: 18, fontWeight: 600, color: colors.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {group.title}
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", width: "100%", flex: 1, alignItems: "flex-end", marginTop: 4 }}>
              {group.items.map((it) => (
                <div key={it.n} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {it.el}
                  {label(it.n, it.sub || undefined)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
