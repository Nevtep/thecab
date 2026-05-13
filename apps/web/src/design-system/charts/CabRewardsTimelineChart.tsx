"use client";

import { CabBarChart } from "@/design-system/charts/CabBarChart";

export type CabRewardsTimelineDatum = {
  timestamp: string;
  rewardValueUsd: number;
};

export type CabRewardsTimelineChartProps = {
  data: CabRewardsTimelineDatum[];
  title?: string;
};

export function CabRewardsTimelineChart({ data, title }: CabRewardsTimelineChartProps) {
  return (
    <CabBarChart
      data={data}
      xKey="timestamp"
      title={title}
      series={[{ key: "rewardValueUsd", label: "Rewards" }]}
    />
  );
}
