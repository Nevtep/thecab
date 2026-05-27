"use client";

import { CabDataPanel, CabStack, CabText } from "@/design-system";

export function PoolCompositionPanel(input: {
  title: string;
  items: Array<{ tokenSymbol: string; amount: number | null; valueUsd: number | null; segment: string }>;
}) {
  return (
    <CabDataPanel>
      <CabStack gap="$2">
        <CabText variant="heading">{input.title}</CabText>
        {input.items.map((item, index) => (
          <CabStack key={`${item.tokenSymbol}-${index}`} row justifyContent="space-between" gap="$3">
            <CabText variant="label">{item.tokenSymbol}</CabText>
            <CabText variant="caption">{item.segment}</CabText>
          </CabStack>
        ))}
      </CabStack>
    </CabDataPanel>
  );
}