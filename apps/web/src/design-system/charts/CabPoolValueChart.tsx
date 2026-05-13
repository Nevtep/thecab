"use client";

import { CabAreaChart } from "@/design-system/charts/CabAreaChart";

export type CabPoolValueDatum = {
  timestamp: string;
  deployedValueUsd: number;
  residualValueUsd: number;
  rewardValueUsd: number;
};

export type CabPoolValueChartProps = {
  data: CabPoolValueDatum[];
  title?: string;
};

export function CabPoolValueChart({ data, title }: CabPoolValueChartProps) {
  return (
    <CabAreaChart
      data={data}
      xKey="timestamp"
      title={title}
      series={[
        { key: "deployedValueUsd", label: "Deployed" },
        { key: "residualValueUsd", label: "Residual" },
        { key: "rewardValueUsd", label: "Rewards" },
      ]}
    />
  );
}
