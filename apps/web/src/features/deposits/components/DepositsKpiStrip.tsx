"use client";

import { CabImpactMetricCard, cabColors } from "@/design-system";
import { formatCompactNumber, formatPercent, formatUsd } from "@/i18n/formatters";
import type { DepositsListSummary } from "@/features/deposits/deposits.types";
import styles from "@/features/deposits/DepositsWorkspace.module.css";

type DepositsKpiStripProps = {
  summary: DepositsListSummary;
  locale: string;
  labels: {
    totalDeposits: string;
    totalDepositsValue: string;
    currentValue: string;
    totalRewards: string;
    weightedAnnualizedReturn: string;
    openPositions: string;
  };
};

export function DepositsKpiStrip({ summary, locale, labels }: DepositsKpiStripProps) {
  const cards = [
    {
      label: labels.totalDeposits,
      value: labels.totalDepositsValue,
      iconName: "deposits" as const,
      accentColor: cabColors.brand.electricBlue,
      series: undefined,
    },
    {
      label: labels.currentValue,
      value: formatUsd(summary.currentValueUsd, locale),
      iconName: "wallet" as const,
      accentColor: cabColors.brand.signalTeal,
      series: [summary.currentValueUsd],
    },
    {
      label: labels.totalRewards,
      value: formatUsd(summary.totalRewardsUsd, locale),
      iconName: "rewards" as const,
      accentColor: cabColors.brandExtended.signalTealUi,
      series: [summary.totalRewardsUsd],
    },
    {
      label: labels.weightedAnnualizedReturn,
      value: summary.weightedAnnualizedReturnPct !== null
        ? formatPercent(summary.weightedAnnualizedReturnPct, locale)
        : "—",
      iconName: "activity" as const,
      accentColor: cabColors.brand.cabGold,
      series: [summary.weightedAnnualizedReturnPct],
    },
    {
      label: labels.openPositions,
      value: `${formatCompactNumber(summary.openActiveCount + summary.openOutOfRangeCount, locale)} / ${formatCompactNumber(summary.totalCount, locale)}`,
      iconName: "radar" as const,
      accentColor: summary.coverageStatus === "full" ? cabColors.semantic.success : cabColors.semantic.warning,
      series: undefined,
    },
  ];

  return (
    <div className={styles.kpiGrid}>
      {cards.map((card) => (
        <CabImpactMetricCard
          key={card.label}
          size="compact"
          label={card.label}
          value={card.value}
          iconName={card.iconName}
          accentColor={card.accentColor}
          series={card.series}
        />
      ))}
    </div>
  );
}
