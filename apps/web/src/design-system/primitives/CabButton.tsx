"use client";

import type { ComponentProps, PropsWithChildren } from "react";
import { Button } from "tamagui";

import type { CabDensity } from "@/design-system/tokens";
import { cabColors, cabTouchTarget } from "@/design-system/tokens";

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
  sm: { height: cabTouchTarget.compact, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, gap: 6 },
  md: { height: cabTouchTarget.min, paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, gap: 8 },
  lg: { height: cabTouchTarget.comfortable, paddingHorizontal: 20, paddingVertical: 10, fontSize: 14, gap: 10 },
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
    backgroundColor: "rgba(234, 241, 255, 0.08)",
    color: cabColors.action.secondaryText,
    borderColor: "rgba(184, 199, 230, 0.28)",
    hoverStyle: {
      backgroundColor: "rgba(234, 241, 255, 0.12)",
      borderColor: cabColors.action.secondaryHoverBorder,
    },
  },
  technical: {
    backgroundColor: "rgba(0, 224, 225, 0.08)",
    color: cabColors.action.technicalText,
    borderColor: cabColors.action.technicalBorder,
    hoverStyle: {
      backgroundColor: "rgba(0, 224, 225, 0.12)",
      borderColor: cabColors.action.technicalHoverBorder,
      shadowColor: cabColors.action.technicalGlow,
      shadowRadius: 10,
    },
  },
  ghost: {
    backgroundColor: "rgba(234, 241, 255, 0.07)",
    color: cabColors.text.primary,
    borderColor: "rgba(184, 199, 230, 0.22)",
    hoverStyle: {
      backgroundColor: "rgba(234, 241, 255, 0.11)",
      borderColor: cabColors.action.secondaryHoverBorder,
    },
  },
  warning: {
    backgroundColor: cabColors.brand.cabGold,
    color: cabColors.brand.cabNight,
    borderColor: cabColors.brand.cabGold,
    hoverStyle: {
      backgroundColor: cabColors.action.primaryHoverBg,
      borderColor: cabColors.action.primaryHoverBg,
    },
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

  const variant = variantStyles[tone];

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
      cursor="pointer"
      pressStyle={{ opacity: 0.88, scale: 0.98 }}
      focusVisibleStyle={{
        outlineColor: cabColors.brand.signalTeal,
        outlineWidth: 2,
        outlineStyle: "solid",
        outlineOffset: 2,
      }}
      {...variant}
      hoverStyle={{
        ...("hoverStyle" in variant ? variant.hoverStyle : {}),
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
