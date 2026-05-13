"use client";

import type { ComponentProps, PropsWithChildren } from "react";
import { Button } from "tamagui";

import type { CabDensity } from "@/design-system/tokens";
import { cabColors } from "@/design-system/tokens";

type CabButtonSize = "sm" | "md" | "lg";

const buttonSizeStyles: Record<
  CabButtonSize,
  {
    height: number;
    paddingHorizontal: number;
    paddingVertical: number;
    fontSize: number;
    gap: number;
  }
> = {
  sm: { height: 28, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, gap: 6 },
  md: { height: 36, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, gap: 8 },
  lg: { height: 42, paddingHorizontal: 20, paddingVertical: 10, fontSize: 14, gap: 10 },
};

const densityToSize: Record<CabDensity, CabButtonSize> = {
  compact: "sm",
  default: "md",
  spacious: "lg",
};

export type CabButtonProps = PropsWithChildren<
  ComponentProps<typeof Button> & {
    tone?: "primary" | "secondary" | "technical" | "ghost" | "warning";
    controlSize?: CabButtonSize;
    density?: CabDensity;
  }
>;

const variantStyles = {
  primary: {
    backgroundColor: cabColors.action.primaryBg,
    color: cabColors.action.primaryText,
    borderColor: cabColors.action.primaryBorder,
    hoverStyle: {
      backgroundColor: cabColors.action.primaryHoverBg,
      borderColor: cabColors.action.primaryHoverBg,
    },
  },
  secondary: {
    backgroundColor: cabColors.action.secondaryBg,
    color: cabColors.action.secondaryText,
    borderColor: cabColors.action.secondaryBorder,
    hoverStyle: {
      borderColor: cabColors.action.secondaryHoverBorder,
    },
  },
  technical: {
    backgroundColor: "transparent",
    color: cabColors.action.technicalText,
    borderColor: cabColors.action.technicalBorder,
    hoverStyle: {
      borderColor: cabColors.action.technicalHoverBorder,
      shadowColor: cabColors.action.technicalGlow,
      shadowRadius: 10,
    },
  },
  ghost: {
    backgroundColor: "transparent",
    color: cabColors.text.primary,
    borderColor: cabColors.surface.border,
    hoverStyle: {
      borderColor: cabColors.action.secondaryHoverBorder,
    },
  },
  warning: {
    backgroundColor: cabColors.brand.cabGold,
    color: cabColors.brand.cabNight,
    borderColor: cabColors.brand.cabGold,
  },
} as const;

export function CabButton({
  tone = "primary",
  controlSize,
  density = "default",
  children,
  ...props
}: CabButtonProps) {
  const resolvedSize = controlSize ?? densityToSize[density];
  const sizeStyle = buttonSizeStyles[resolvedSize];

  return (
    <Button
      borderWidth={1}
      borderRadius="$1"
      height={sizeStyle.height}
      minHeight={sizeStyle.height}
      paddingHorizontal={sizeStyle.paddingHorizontal}
      paddingVertical={sizeStyle.paddingVertical}
      gap={sizeStyle.gap}
      justifyContent="center"
      {...variantStyles[tone]}
      {...props}
    >
      {children}
    </Button>
  );
}
