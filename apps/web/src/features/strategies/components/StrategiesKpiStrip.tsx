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
    protocolCoverage: string;
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
      series: viewModel.items.map((item) => item.currentEstimatedValueUsd),
    },
    {
      label: labels.activeCount,
      value: viewModel.formattedKpis.activeStrategyCount,
      iconName: "activity" as const,
      accentColor: cabColors.brand.electricBlue,
      series: viewModel.items.map((item) => item.status === "active" ? 1 : 0),
    },
    {
      label: labels.claimedRewards,
      value: viewModel.formattedKpis.totalClaimedRewardsUsd,
      iconName: "rewards" as const,
      accentColor: cabColors.brandExtended.signalTealUi,
      series: viewModel.items.map((item) => item.totalRewardsUsd),
    },
    {
      label: labels.totalReturn,
      value: viewModel.formattedKpis.totalReturnUsd,
      iconName: "coins" as const,
      accentColor: cabColors.brand.cabGold,
      series: viewModel.items.map((item) => item.totalReturnUsd),
    },
    {
      label: labels.protocolCoverage,
      value: viewModel.formattedKpis.protocolCoveragePct,
      iconName: "radar" as const,
      accentColor: viewModel.kpis.coverageStatus === "full" ? cabColors.semantic.success : cabColors.semantic.warning,
      series: viewModel.items.map((item) => item.coverageStatus === "full" ? 1 : item.coverageStatus === "unknown" ? 0 : 0.5),
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
