import { icons, type LucideIcon } from "lucide-react";

/**
 * Converts a lucide icon name to the key used in lucide-react's `icons` map.
 * Accepts kebab-case ("plug-zap", the name shown on lucide.dev) or PascalCase ("PlugZap").
 */
export const toIconKey = (name: string): string =>
  name
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");

export const isIconName = (name: string): boolean => toIconKey(name) in icons;

export const getIcon = (name: string | undefined): LucideIcon | null => {
  if (!name) return null;
  return (icons as Record<string, LucideIcon>)[toIconKey(name)] ?? null;
};
