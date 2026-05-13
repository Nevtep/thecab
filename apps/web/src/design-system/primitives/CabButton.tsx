"use client";

import type { ComponentProps, PropsWithChildren } from "react";
import { Button } from "tamagui";

import { cabColors } from "@/design-system/tokens";

export type CabButtonProps = PropsWithChildren<
  ComponentProps<typeof Button> & {
    tone?: "primary" | "secondary" | "ghost" | "warning";
  }
>;

const variantStyles = {
  primary: {
    backgroundColor: cabColors.brand.signalTeal,
    color: cabColors.brand.cabNight,
    borderColor: cabColors.brand.signalTeal,
  },
  secondary: {
    backgroundColor: cabColors.brand.controlBlue,
    color: cabColors.text.primary,
    borderColor: cabColors.surface.border,
  },
  ghost: {
    backgroundColor: "transparent",
    color: cabColors.text.primary,
    borderColor: cabColors.surface.border,
  },
  warning: {
    backgroundColor: cabColors.brand.cabGold,
    color: cabColors.brand.cabNight,
    borderColor: cabColors.brand.cabGold,
  },
} as const;

export function CabButton({ tone = "primary", children, ...props }: CabButtonProps) {
  return (
    <Button
      borderWidth={1}
      borderRadius="$2"
      {...variantStyles[tone]}
      {...props}
    >
      {children}
    </Button>
  );
}
