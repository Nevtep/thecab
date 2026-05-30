"use client";

import { useRouter } from "next/navigation";

import { CabButton, CabCard, CabStack, CabText } from "@/design-system";
import { CabTooltip } from "@/design-system/primitives/CabTooltip";
import { getStrategyDetailHref } from "@/features/deposits/deposits.navigation";
import { buildDepositRewardsHref } from "@/features/rewards/rewards.navigation";

type DepositStrategiesCrossLinkProps = {
  title: string;
  description: string;
  actionLabel: string;
  rewardsActionLabel?: string;
  depositId?: string;
  strategyId: string;
};

export function DepositStrategiesCrossLink(input: DepositStrategiesCrossLinkProps) {
  const router = useRouter();
  const href = getStrategyDetailHref(input.strategyId);

  return (
    <CabCard density="spacious">
      <CabStack gap="$2">
        <CabText variant="label">{input.title}</CabText>
        <CabText variant="caption">{input.description}</CabText>
        {href ? (
          <CabButton tone="secondary" controlSize="sm" onPress={() => router.push(href)}>
            {input.actionLabel}
          </CabButton>
        ) : (
          <CabTooltip label={input.description}>
            <span>
              <CabButton tone="secondary" controlSize="sm" disabled>
                {input.actionLabel}
              </CabButton>
            </span>
          </CabTooltip>
        )}
        {input.depositId && input.rewardsActionLabel ? (
          <CabButton tone="technical" controlSize="sm" onPress={() => router.push(buildDepositRewardsHref(input.depositId!))}>
            {input.rewardsActionLabel}
          </CabButton>
        ) : null}
        <CabText variant="caption">{input.strategyId}</CabText>
      </CabStack>
    </CabCard>
  );
}
