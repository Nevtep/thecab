"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CabLineChart } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { formatDateParts } from "@/i18n/formatters";

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
  const { i18n } = useTranslation();
  const chartData = useMemo(() => {
    return input.data.map((point) => ({
      dateLabel: formatDateParts(point.timestamp, i18n.language, {
        month: "short",
        day: "numeric",
      }),
      deployedValueUsd: point.deployedValueUsd,
    }));
  }, [i18n.language, input.data]);

  return (
    <CabLineChart
      data={chartData}
      xKey="dateLabel"
      series={[{ key: "deployedValueUsd", label: input.title, color: cabColors.brandExtended.signalTealUi }]}
      title={input.title}
      height={180}
      ariaLabel={input.title}
    />
  );
}
