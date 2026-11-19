import React from "react";
import { getIcon } from "../icons";

/** Renders a lucide icon by name; renders nothing for an unknown or missing name. */
export const Icon: React.FC<{ name?: string; size: number; color: string; strokeWidth?: number }> = ({
  name,
  size,
  color,
  strokeWidth = 2,
}) => {
  const Cmp = getIcon(name);
  if (!Cmp) return null;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} absoluteStrokeWidth={false} />;
};

/** Icon centred in a soft tinted circle. */
export const IconBadge: React.FC<{
  name?: string;
  size: number;
  color: string;
  background: string;
  ring?: string;
  style?: React.CSSProperties;
}> = ({ name, size, color, background, ring, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background,
      boxShadow: ring ? `inset 0 0 0 3px ${ring}` : undefined,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      ...style,
    }}
  >
    <Icon name={name} size={Math.round(size * 0.5)} color={color} />
  </div>
);
