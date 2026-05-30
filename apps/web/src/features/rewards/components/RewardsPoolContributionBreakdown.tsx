"use client";

import { RewardsDistributionPanel } from "@/features/rewards/components/RewardsDistributionPanel";
import type { RewardsDistribution } from "@/features/rewards/rewards.types";

type Props = {
  distribution: RewardsDistribution;
  title: string;
  valueLabel: string;
  getLabel: (key: string) => string;
  formatUsd: (value: number) => string;
  activeFilter: {
    source: string;
    poolId: string | null;
    tokenAddress: string | null;
  };
  onOpenFilter: (target: Record<string, unknown>) => void;
};

export function RewardsPoolContributionBreakdown(props: Props) {
  return <RewardsDistributionPanel {...props} />;
}
