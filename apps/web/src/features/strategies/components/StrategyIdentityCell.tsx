"use client";

import { CabBadge, CabStack, CabText } from "@/design-system";
import type { StrategyRowViewModel } from "@/features/strategies/strategies.mappers";

export function StrategyIdentityCell({ item }: { item: StrategyRowViewModel }) {
  return (
    <CabStack gap="$1">
      <CabText variant="label">{item.strategyLabel}</CabText>
      <CabText variant="caption">{item.poolLabel ?? "—"}</CabText>
      <CabBadge size="sm" tone="info">Mellow</CabBadge>
    </CabStack>
  );
}

