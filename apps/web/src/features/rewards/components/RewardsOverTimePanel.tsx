"use client";

import { CabRewardsTimelineChart } from "@/design-system";
import type { RewardsViewModel } from "@/features/rewards/rewards.types";

type Props = {
  viewModel: RewardsViewModel;
  labels: {
    title: string;
    coverage: string;
    partial: string;
    chart: string;
    table: string;
    formatUsd: (value: number) => string;
    formatPercent: (value: number) => string;
    formatCount: (value: number) => string;
  };
};

export function RewardsOverTimePanel({ viewModel, labels }: Props) {
  const chartData = viewModel.overTime.buckets.map((bucket) => ({
    timestamp: bucket.bucketStart,
    rewardValueUsd: Number(bucket.claimedValueUsd),
    cumulativeRewardValueUsd: Number(bucket.cumulativeClaimedValueUsd),
    rewardEventCount: bucket.rewardEventCount,
  }));
  const subtitle = `${labels.coverage}: ${viewModel.overTime.coveragePercent}%`;
  const notice = viewModel.overTime.coverageState === "full" ? undefined : labels.partial;

  return (
    <CabRewardsTimelineChart
      title={labels.title}
      subtitle={subtitle}
      notice={notice}
      data={chartData}
      valueFormatter={labels.formatUsd}
      cumulativeFormatter={labels.formatUsd}
      countFormatter={labels.formatCount}
    />
  );
}
