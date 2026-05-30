"use client";

import { CabBadge, CabCard, CabStack, CabText } from "@/design-system";
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
    { label: labels.currentValue, value: viewModel.formattedKpis.currentStrategyValueUsd },
    { label: labels.activeCount, value: viewModel.formattedKpis.activeStrategyCount },
    { label: labels.claimedRewards, value: viewModel.formattedKpis.totalClaimedRewardsUsd },
    { label: labels.totalReturn, value: viewModel.formattedKpis.totalReturnUsd },
    { label: labels.protocolCoverage, value: viewModel.formattedKpis.protocolCoveragePct },
  ];

  return (
    <div className={styles.kpiGrid}>
      {cards.map((card) => (
        <CabCard key={card.label} density="compact">
          <CabStack gap="$2">
            <CabText variant="caption">{card.label}</CabText>
            <CabText variant="heading" className={styles.kpiValue}>{card.value}</CabText>
            <CabBadge size="sm" tone={viewModel.kpis.coverageStatus === "full" ? "success" : "warning"}>
              {labels.coverage}
            </CabBadge>
          </CabStack>
        </CabCard>
      ))}
    </div>
  );
}

