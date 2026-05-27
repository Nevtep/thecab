"use client";

import { CabPoolValueChart } from "@/design-system";

export function PoolHistoryChart(input: {
  data: Array<{
    timestamp: string;
    deployedValueUsd: number;
    residualValueUsd: number;
    rewardValueUsd: number;
    cumulativeRewardsUsd: number;
  }>;
  title: string;
}) {
  return <CabPoolValueChart data={input.data} title={input.title} />;
}