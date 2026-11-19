import type React from "react";
import type { PropsOf, TemplateName } from "../schema";
import { BigNumber } from "./BigNumber";
import { Bullets } from "./Bullets";
import { Chart } from "./Chart";
import { Comparison } from "./Comparison";
import { Diagram } from "./Diagram";
import { Quote } from "./Quote";
import { Recap } from "./Recap";
import { Steps } from "./Steps";
import { TitleCard } from "./TitleCard";

export const TEMPLATES: { [K in TemplateName]: React.FC<PropsOf<K>> } = {
  TitleCard,
  Bullets,
  Diagram,
  Comparison,
  BigNumber,
  Steps,
  Chart,
  Quote,
  Recap,
};
