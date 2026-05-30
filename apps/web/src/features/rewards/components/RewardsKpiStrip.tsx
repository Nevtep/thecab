"use client";

import { CabImpactMetricCard, cabColors } from "@/design-system";
import type { RewardsKpi, RewardsOverTimeBucket } from "@/features/rewards/rewards.types";

import styles from "@/features/rewards/RewardsWorkspace.module.css";

type Props = {
  kpis: RewardsKpi[];
  buckets: RewardsOverTimeBucket[];
  labels: {
    getLabel: (key: string) => string;
    formatValue: (kpi: RewardsKpi) => string;
    getCoverageLabel: (coverage: string) => string;
  };
};

function buildSeries(kpi: RewardsKpi, buckets: RewardsOverTimeBucket[]) {
  return buckets.map((bucket) => {
    if (kpi.id === "rewardEvents") return bucket.rewardEventCount;
    if (kpi.id === "estimatedRewardReturn") {
      return bucket.estimatedRewardReturnPct === null ? null : Number(bucket.estimatedRewardReturnPct);
    }
    if (kpi.id === "resolvedRewardsValue") return Number(bucket.resolvedValueUsd);
    if (kpi.id === "unresolvedExcludedValue") return Number(bucket.unresolvedExcludedValueUsd);
    return Number(bucket.claimedValueUsd);
  });
}

function resolveAccentColor(kpi: RewardsKpi) {
  if (kpi.id === "estimatedRewardReturn") return cabColors.brand.cabGold;
  if (kpi.id === "resolvedRewardsValue") return cabColors.brand.signalTeal;
  if (kpi.id === "unresolvedExcludedValue") return cabColors.semantic.danger;
  if (kpi.id === "rewardEvents") return cabColors.brand.electricBlue;
  return cabColors.brandExtended.signalTealUi;
}

function resolveIconName(kpi: RewardsKpi) {
  if (kpi.id === "estimatedRewardReturn") return "activity" as const;
  if (kpi.id === "unresolvedExcludedValue") return "warning" as const;
  if (kpi.id === "resolvedRewardsValue") return "radar" as const;
  if (kpi.id === "rewardEvents") return "rewards" as const;
  return "coins" as const;
}

export function RewardsKpiStrip({ kpis, buckets, labels }: Props) {
  return (
    <div className={styles.kpiGrid}>
      {kpis.map((kpi) => (
        <CabImpactMetricCard
          key={kpi.id}
          size="compact"
          label={labels.getLabel(kpi.labelKey)}
          value={labels.formatValue(kpi) || labels.getCoverageLabel("unavailable")}
          iconName={resolveIconName(kpi)}
          accentColor={resolveAccentColor(kpi)}
          series={buildSeries(kpi, buckets)}
          meta={`${labels.getLabel(kpi.context.labelKey)}${kpi.context.value === undefined ? "" : ` ${kpi.context.value}`}`}
        />
      ))}
    </div>
  );
}
