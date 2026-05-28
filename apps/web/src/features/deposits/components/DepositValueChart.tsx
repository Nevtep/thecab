"use client";

import { CabAreaChart, CabPartialCoverageNotice, CabStack } from "@/design-system";
import type { DepositValueChartView } from "@/features/deposits/deposits.types";
import { formatUsd } from "@/i18n/formatters";

type DepositValueChartProps = {
  chart: DepositValueChartView;
  locale: string;
  title: string;
  gapTitle: string;
  gapDescription: string;
};

export function DepositValueChart(input: DepositValueChartProps) {
  const dataMap = new Map<string, Record<string, unknown>>();
  for (const series of input.chart.series) {
    for (const point of series.points) {
      const existing = dataMap.get(point.occurredAt) ?? { occurredAt: point.occurredAt };
      existing[series.key] = point.usd;
      dataMap.set(point.occurredAt, existing);
    }
  }

  const data = Array.from(dataMap.values()).sort((left, right) =>
    String(left.occurredAt).localeCompare(String(right.occurredAt)),
  ) as Array<Record<string, number | string>>;

  return (
    <CabStack gap="$3">
      <CabAreaChart
        data={data}
        xKey="occurredAt"
        title={input.title}
        yTickFormatter={(value) => formatUsd(value, input.locale)}
        series={input.chart.series.map((series) => ({ key: series.key, label: series.key }))}
      />
      {input.chart.gaps.length > 0 ? (
        <CabPartialCoverageNotice title={input.gapTitle} description={input.gapDescription} />
      ) : null}
    </CabStack>
  );
}