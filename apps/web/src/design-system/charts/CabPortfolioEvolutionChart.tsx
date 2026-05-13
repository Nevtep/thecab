"use client";

import { CabLineChart } from "@/design-system/charts/CabLineChart";

export type CabPortfolioEvolutionDatum = {
  timestamp: string;
  netValueUsd: number;
};

export type CabPortfolioEvolutionChartProps = {
  data: CabPortfolioEvolutionDatum[];
  title?: string;
};

export function CabPortfolioEvolutionChart({ data, title }: CabPortfolioEvolutionChartProps) {
  return (
    <CabLineChart
      data={data}
      xKey="timestamp"
      title={title}
      series={[{ key: "netValueUsd", label: "Net value" }]}
    />
  );
}
