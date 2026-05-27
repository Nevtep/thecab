"use client";

import { CabKpiStrip } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { OverviewImpactMetricCard } from "@/features/overview/OverviewImpactMetricCard";

import styles from "@/features/pools/components/PoolsMetricRail.module.css";

export function PoolsMetricRail(input: {
  labels: {
    poolsWithPosition: string;
    currentValue: string;
    impermanentLoss: string;
    rewards: string;
    estimatedReturn: string;
    activeInRange: string;
    activeInRangeMeta: string;
    unavailable: string;
  };
  values: {
    poolCount: string;
    activePoolCount: string;
    activeInRangePoolCount: string;
    currentAttributedValueUsd: string;
    totalRewardsUsd: string;
    weightedAnnualizedReturnPct: string | null;
    estimatedImpermanentLossUsd: string | null;
  };
  series: {
    activePoolCount: number[];
    currentAttributedValueUsd: number[];
    totalRewardsUsd: number[];
    estimatedAnnualizedReturnPct: number[];
  };
  gauge: {
    activeInRangePoolCount: number;
    activePoolCount: number;
  };
}) {
  return (
    <CabKpiStrip>
      <div className={styles.grid}>
        <OverviewImpactMetricCard
          label={input.labels.poolsWithPosition}
          value={input.values.poolCount}
          iconName="pools"
          accentColor={cabColors.brand.electricBlue}
          series={input.series.activePoolCount}
          meta={input.values.activePoolCount}
          size="compact"
        />
        <OverviewImpactMetricCard
          label={input.labels.currentValue}
          value={input.values.currentAttributedValueUsd}
          iconName="dashboard"
          accentColor={cabColors.brandExtended.signalTealUi}
          series={input.series.currentAttributedValueUsd}
          size="compact"
        />
        <OverviewImpactMetricCard
          label={input.labels.impermanentLoss}
          value={input.values.estimatedImpermanentLossUsd ?? input.labels.unavailable}
          iconName="warning"
          accentColor={cabColors.semantic.warning}
          series={[]}
          size="compact"
        />
        <OverviewImpactMetricCard
          label={input.labels.rewards}
          value={input.values.totalRewardsUsd}
          iconName="rewards"
          accentColor={cabColors.dataViz.mint}
          series={input.series.totalRewardsUsd}
          size="compact"
        />
        <OverviewImpactMetricCard
          label={input.labels.estimatedReturn}
          value={input.values.weightedAnnualizedReturnPct ?? input.labels.unavailable}
          iconName="activity"
          accentColor={cabColors.dataViz.orange}
          series={input.series.estimatedAnnualizedReturnPct}
          size="compact"
        />
        <OverviewImpactMetricCard
          label={input.labels.activeInRange}
          value={input.values.activeInRangePoolCount}
          iconName="activity"
          accentColor={cabColors.brandExtended.signalTealUi}
          series={[]}
          meta={input.labels.activeInRangeMeta}
          size="compact"
        />
      </div>
    </CabKpiStrip>
  );
}
