"use client";

import { CabButton, CabDataPanel, CabStack, CabText } from "@/design-system";

export function PoolRelatedLinks(input: {
  title: string;
  labels: {
    deposit: string;
    strategy: string;
  };
  deposits: Array<{ id: string; label: string }>;
  strategies: Array<{ id: string; label: string }>;
}) {
  return (
    <CabDataPanel>
      <CabStack gap="$2">
        <CabText variant="heading">{input.title}</CabText>
        {input.deposits.map((deposit) => (
          <CabButton key={`deposit-${deposit.id}`} tone="secondary" disabled>
            {input.labels.deposit}: {deposit.label}
          </CabButton>
        ))}
        {input.strategies.map((strategy) => (
          <CabButton key={`strategy-${strategy.id}`} tone="secondary" disabled>
            {input.labels.strategy}: {strategy.label}
          </CabButton>
        ))}
      </CabStack>
    </CabDataPanel>
  );
}