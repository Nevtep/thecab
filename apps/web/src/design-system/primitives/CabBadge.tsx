"use client";

import type { PropsWithChildren } from "react";
import { XStack } from "tamagui";

import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

type CabBadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneColors: Record<CabBadgeTone, string> = {
  neutral: cabColors.surface.border,
  success: cabColors.semantic.success,
  warning: cabColors.semantic.warning,
  danger: cabColors.semantic.danger,
  info: cabColors.semantic.info,
};

export type CabBadgeProps = PropsWithChildren<{
  tone?: CabBadgeTone;
  size?: "sm" | "md";
}>;

const badgeSizeStyles = {
  sm: {
    minHeight: 18,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 10,
  },
  md: {
    minHeight: 22,
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 11,
  },
} as const;

export function CabBadge({ tone = "neutral", size = "md", children }: CabBadgeProps) {
  const sizeStyle = badgeSizeStyles[size];

  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      minHeight={sizeStyle.minHeight}
      borderWidth={1}
      borderColor={toneColors[tone]}
      borderRadius="$pill"
      paddingHorizontal={sizeStyle.paddingHorizontal}
      paddingVertical={sizeStyle.paddingVertical}
      backgroundColor="rgba(255,255,255,0.02)"
    >
      <CabText variant="label" fontSize={sizeStyle.fontSize} color={cabColors.text.primary}>
        {children}
      </CabText>
    </XStack>
  );
}
