"use client";

import { useRouter } from "next/navigation";

import { CabButton, CabDataPanel, CabStack, CabText } from "@/design-system";

export function PoolRelatedLinks(input: {
  title: string;
  labels: {
    deposit: string;
    strategy: string;
  };
  deposits: Array<{ id: string; label: string; href?: string | null }>;
  strategies: Array<{ id: string; label: string; href?: string | null }>;
}) {
  const router = useRouter();

  return (
    <CabDataPanel>
      <CabStack gap="$2">
        <CabText variant="heading">{input.title}</CabText>
        {input.deposits.map((deposit) => (
          <CabButton
            key={`deposit-${deposit.id}`}
            tone="secondary"
            disabled={!deposit.href}
            onPress={deposit.href ? () => router.push(deposit.href!) : undefined}
          >
            {input.labels.deposit}: {deposit.label}
          </CabButton>
        ))}
        {input.strategies.map((strategy) => (
          <CabButton
            key={`strategy-${strategy.id}`}
            tone="secondary"
            disabled={!strategy.href}
            onPress={strategy.href ? () => router.push(strategy.href!) : undefined}
          >
            {input.labels.strategy}: {strategy.label}
          </CabButton>
        ))}
      </CabStack>
    </CabDataPanel>
  );
}
