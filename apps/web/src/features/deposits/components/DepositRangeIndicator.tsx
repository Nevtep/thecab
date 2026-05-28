"use client";

import { CabBadge, CabCard, CabStack, CabText } from "@/design-system";

type DepositRangeIndicatorProps = {
  title: string;
  lowerLabel: string;
  upperLabel: string;
  stateLabel: string;
  stateTone: "success" | "warning" | "neutral";
};

export function DepositRangeIndicator(input: DepositRangeIndicatorProps) {
  return (
    <CabCard density="spacious">
      <CabStack gap="$2">
        <CabText variant="label">{input.title}</CabText>
        <CabStack row gap="$3" flexWrap="wrap" alignItems="center">
          <CabText variant="caption">{input.lowerLabel}</CabText>
          <CabText variant="caption">{input.upperLabel}</CabText>
          <CabBadge tone={input.stateTone}>{input.stateLabel}</CabBadge>
        </CabStack>
      </CabStack>
    </CabCard>
  );
}