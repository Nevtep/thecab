"use client";

import { CabImpactMetricCard, cabColors } from "@/design-system";
import type { StrategiesListViewModel } from "@/features/strategies/strategies.mappers";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategiesKpiStripProps = {
  labels: {
    currentValue: string;
    activeCount: string;
    claimedRewards: string;
    totalReturn: string;
    coverage: string;
  };
  viewModel: StrategiesListViewModel;
};

export function StrategiesKpiStrip({ labels, viewModel }: StrategiesKpiStripProps) {
  const cards = [
    {
      label: labels.currentValue,
      value: viewModel.formattedKpis.currentStrategyValueUsd,
      iconName: "strategies" as const,
      accentColor: cabColors.brand.signalTeal,
      series: undefined,
    },
    {
      label: labels.activeCount,
      value: viewModel.formattedKpis.activeStrategyCount,
      iconName: "activity" as const,
      accentColor: cabColors.brand.electricBlue,
      series: undefined,
    },
    {
      label: labels.claimedRewards,
      value: viewModel.formattedKpis.totalClaimedRewardsUsd,
      iconName: "rewards" as const,
      accentColor: cabColors.brandExtended.signalTealUi,
      series: undefined,
    },
    {
      label: labels.totalReturn,
      value: viewModel.formattedKpis.totalReturnUsd,
      iconName: "coins" as const,
      accentColor: cabColors.brand.cabGold,
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
          meta={labels.coverage}
        />
      ))}
    </div>
  );
}
