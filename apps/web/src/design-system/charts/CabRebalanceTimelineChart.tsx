"use client";

import { CabLineChart } from "@/design-system/charts/CabLineChart";

export type CabRebalanceTimelineDatum = {
  timestamp: string;
  rebalancedValueUsd: number;
};

export type CabRebalanceTimelineChartProps = {
  data: CabRebalanceTimelineDatum[];
  title?: string;
};

export function CabRebalanceTimelineChart({ data, title }: CabRebalanceTimelineChartProps) {
  return (
    <CabLineChart
      data={data}
      xKey="timestamp"
      title={title}
      series={[{ key: "rebalancedValueUsd", label: "Rebalanced" }]}
    />
  );
}
