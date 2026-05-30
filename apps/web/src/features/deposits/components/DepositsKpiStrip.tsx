"use client";

import { CabImpactMetricCard, CabKpiStrip, cabColors } from "@/design-system";
import { formatPercent, formatUsd } from "@/i18n/formatters";
import type { DepositsListSummary } from "@/features/deposits/deposits.types";

type DepositsKpiStripProps = {
  summary: DepositsListSummary;
  locale: string;
  labels: {
    totalDeposits: string;
    totalDepositsValue: string;
    currentValue: string;
    totalRewards: string;
    weightedAnnualizedReturn: string;
    capitalDeployed: string;
  };
};

export function DepositsKpiStrip({ summary, locale, labels }: DepositsKpiStripProps) {
  const cards = [
    {
      label: labels.totalDeposits,
      value: labels.totalDepositsValue,
      iconName: "deposits" as const,
      accentColor: cabColors.brand.electricBlue,
      series: [summary.closedCount, summary.openOutOfRangeCount, summary.openActiveCount],
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
      label: labels.capitalDeployed,
      value: summary.capitalDeployedPctOfManual !== null
        ? formatPercent(summary.capitalDeployedPctOfManual, locale)
        : "—",
      iconName: "radar" as const,
      accentColor: summary.coverageStatus === "full" ? cabColors.semantic.success : cabColors.semantic.warning,
      series: [summary.capitalDeployedPctOfManual],
    },
  ];

  return (
    <CabKpiStrip>
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
    </CabKpiStrip>
  );
}
