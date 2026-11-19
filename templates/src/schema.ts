import { z } from "zod";
import { isIconName } from "./icons";

export const TEMPLATE_NAMES = [
  "TitleCard",
  "Bullets",
  "Diagram",
  "Comparison",
  "BigNumber",
  "Steps",
  "Chart",
  "Quote",
  "Recap",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

// ---------- building blocks ----------

const hex = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex colour like #1E293B");

const text = (max: number) => z.string().trim().min(1).max(max);

/** A lucide icon name, e.g. "flame" or "plug-zap" (see https://lucide.dev/icons). */
const icon = z.string().refine(isIconName, { message: "unknown lucide icon name" });

/** Relative coordinate, 0 = left/top edge of the content area, 1 = right/bottom edge. */
const rel = z.number().min(0).max(1);

// ---------- style ----------

export const StyleSchema = z.object({
  colors: z.object({
    background: hex,
    surface: hex,
    primary: hex,
    accent: hex,
    text: hex,
  }),
  fonts: z.object({
    heading: text(60),
    body: text(60),
  }),
  sizes: z.object({
    title: z.number().min(40).max(200),
    heading: z.number().min(28).max(140),
    body: z.number().min(20).max(90),
    caption: z.number().min(20).max(80),
  }),
});

// ---------- per-template props ----------

export const TitleCardProps = z
  .object({
    title: text(60),
    subtitle: text(120).optional(),
    icon: icon.optional(),
  })
  .strict();

export const BulletsProps = z
  .object({
    title: text(60),
    items: z.array(text(90)).min(1).max(5),
    icon: icon.optional(),
  })
  .strict();

const DiagramNode = z
  .object({
    id: text(30),
    label: text(30),
    icon: icon.optional(),
    x: rel,
    y: rel,
  })
  .strict();

const DiagramArrow = z
  .object({
    from: text(30),
    to: text(30),
    label: text(24).optional(),
  })
  .strict();

export const DiagramProps = z
  .object({
    title: text(60).optional(),
    nodes: z.array(DiagramNode).min(2).max(8),
    arrows: z.array(DiagramArrow).max(10).default([]),
    /** Node ids to highlight one after another, spread across the scene. */
    highlight: z.array(text(30)).max(8).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    p.nodes.forEach((n, i) => {
      if (ids.has(n.id)) {
        ctx.addIssue({ code: "custom", message: `duplicate node id "${n.id}"`, path: ["nodes", i, "id"] });
      }
      ids.add(n.id);
    });
    p.arrows.forEach((a, i) => {
      for (const end of ["from", "to"] as const) {
        if (!ids.has(a[end])) {
          ctx.addIssue({ code: "custom", message: `unknown node id "${a[end]}"`, path: ["arrows", i, end] });
        }
      }
    });
    p.highlight?.forEach((h, i) => {
      if (!ids.has(h)) {
        ctx.addIssue({ code: "custom", message: `unknown node id "${h}"`, path: ["highlight", i] });
      }
    });
  });

const ComparisonColumn = z
  .object({
    title: text(30),
    icon: icon.optional(),
    points: z.array(text(60)).min(1).max(4),
  })
  .strict();

export const ComparisonProps = z
  .object({
    title: text(60).optional(),
    left: ComparisonColumn,
    right: ComparisonColumn,
  })
  .strict();

export const BigNumberProps = z
  .object({
    value: text(12),
    label: text(60),
    context: text(100).optional(),
    icon: icon.optional(),
  })
  .strict();

const Step = z
  .object({
    title: text(30),
    description: text(80).optional(),
    icon: icon.optional(),
  })
  .strict();

export const StepsProps = z
  .object({
    title: text(60).optional(),
    steps: z.array(Step).min(2).max(6),
  })
  .strict();

export const ChartProps = z
  .object({
    title: text(60),
    type: z.enum(["bar", "line"]),
    labels: z.array(text(14)).min(2).max(10),
    values: z.array(z.number().finite()).min(2).max(10),
    unit: text(10).optional(),
    /** Index of the bar/point drawn in the accent colour. Default: the largest absolute value. */
    highlight: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((p) => p.labels.length === p.values.length, {
    message: "labels and values must have the same length",
    path: ["values"],
  })
  .refine((p) => p.highlight === undefined || p.highlight < p.values.length, {
    message: "highlight must be the index of one of the values",
    path: ["highlight"],
  });

export const QuoteProps = z
  .object({
    text: text(200),
    attribution: text(60),
  })
  .strict();

export const RecapProps = z
  .object({
    title: text(60),
    points: z.array(text(90)).min(1).max(5),
  })
  .strict();

// ---------- presenter ----------

export const PRESENTER_POSES = ["idle", "talk", "point-left", "point-right", "think", "surprised", "celebrate", "wave"] as const;
export const PRESENTER_EXPRESSIONS = ["neutral", "happy", "curious", "surprised", "thinking"] as const;

export type PresenterPose = (typeof PRESENTER_POSES)[number];
export type PresenterExpression = (typeof PRESENTER_EXPRESSIONS)[number];

/** The presenter line of a scene. position "none" hides him and gives the content the full width. */
export const PresenterSchema = z
  .object({
    pose: z.enum(PRESENTER_POSES).default("idle"),
    expression: z.enum(PRESENTER_EXPRESSIONS).default("neutral"),
    position: z.enum(["left", "right", "none"]).default("none"),
    size: z.enum(["large", "small"]).default("small"),
  })
  .strict();

// ---------- scenes ----------

const sceneBase = {
  id: z.number().int().positive(),
  /** Scene length in frames. At least 30 so the 12-frame entry and exit both fit. */
  durationInFrames: z.number().int().min(30).max(30 * 60 * 5),
  /** Spoken text, shown as captions. Empty string = no captions. */
  narration: z.string().max(2000).default(""),
  presenter: PresenterSchema.default({ pose: "idle", expression: "neutral", position: "none", size: "small" }),
  /** Mouth opening per frame of the scene (0 = closed, 1 = wide), from the voice loudness. [] = closed. */
  mouth: z.array(z.number().min(0).max(1)).max(30 * 60 * 5).default([]),
};

const scene = <T extends TemplateName, P extends z.ZodType>(template: T, props: P) =>
  z.object({ ...sceneBase, template: z.literal(template), props });

export const SceneSchema = z.discriminatedUnion("template", [
  scene("TitleCard", TitleCardProps),
  scene("Bullets", BulletsProps),
  scene("Diagram", DiagramProps),
  scene("Comparison", ComparisonProps),
  scene("BigNumber", BigNumberProps),
  scene("Steps", StepsProps),
  scene("Chart", ChartProps),
  scene("Quote", QuoteProps),
  scene("Recap", RecapProps),
]);

export const VideoSchema = z.object({
  // Fixed by the project constraints: 1920×1080 at 30 fps.
  fps: z.literal(30).default(30),
  width: z.literal(1920).default(1920),
  height: z.literal(1080).default(1080),
  style: StyleSchema,
  scenes: z.array(SceneSchema).min(1),
});

export type Style = z.infer<typeof StyleSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Presenter = z.infer<typeof PresenterSchema>;
export type VideoProps = z.infer<typeof VideoSchema>;
export type PropsOf<T extends TemplateName> = Extract<Scene, { template: T }>["props"];
