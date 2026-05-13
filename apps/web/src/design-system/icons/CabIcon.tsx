"use client";

import type { ComponentProps } from "react";

import { cabIconRegistry, type CabIconName } from "@/design-system/icons/iconRegistry";
import { cabColors } from "@/design-system/tokens";

type CabIconTone = "signal" | "muted" | "warning" | "success" | "danger" | "default";
type CabIconSize = "sm" | "md" | "lg";

const toneColorMap: Record<CabIconTone, string> = {
  signal: cabColors.brand.signalTeal,
  muted: cabColors.text.muted,
  warning: cabColors.semantic.warning,
  success: cabColors.semantic.success,
  danger: cabColors.semantic.danger,
  default: cabColors.text.primary,
};

const sizeMap: Record<CabIconSize, number> = {
  sm: 14,
  md: 18,
  lg: 24,
};

export type CabIconProps = Omit<ComponentProps<"svg">, "name"> & {
  name: CabIconName;
  tone?: CabIconTone;
  size?: CabIconSize;
};

export function CabIcon({ name, tone = "default", size = "md", ...props }: CabIconProps) {
  const IconComponent = cabIconRegistry[name];
  return <IconComponent color={toneColorMap[tone]} size={sizeMap[size]} {...props} />;
}
