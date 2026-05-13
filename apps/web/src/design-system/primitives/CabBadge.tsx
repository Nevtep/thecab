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
}>;

export function CabBadge({ tone = "neutral", children }: CabBadgeProps) {
  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      borderWidth={1}
      borderColor={toneColors[tone]}
      borderRadius="$2"
      paddingHorizontal="$2"
      paddingVertical="$1"
      backgroundColor="rgba(255,255,255,0.02)"
    >
      <CabText variant="body" fontSize="$2" color={cabColors.text.primary}>
        {children}
      </CabText>
    </XStack>
  );
}
