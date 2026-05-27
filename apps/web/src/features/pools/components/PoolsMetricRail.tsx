"use client";

import { CabCard, CabGaugeChart, CabKpiStrip, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { OverviewImpactMetricCard } from "@/features/overview/OverviewImpactMetricCard";

import styles from "@/features/pools/components/PoolsMetricRail.module.css";

function withAlpha(color: string, alpha: number) {
  const normalized = color.replace("#", "");
  if (normalized.length !== 6) {
    return color;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

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
        <CabCard padding={0} gap={0} density="spacious">
          <div className={styles.gaugeCard}>
            <div
              aria-hidden="true"
              className={styles.gaugeGlow}
              style={{ background: `radial-gradient(circle at top right, ${withAlpha(cabColors.brandExtended.signalTealUi, 0.18)} 0%, rgba(15, 24, 38, 0) 52%)` }}
            />
            <div
              aria-hidden="true"
              className={styles.gaugeTopLine}
              style={{ background: `linear-gradient(90deg, ${cabColors.brandExtended.signalTealUi} 0%, ${withAlpha(cabColors.brandExtended.signalTealUi, 0)} 100%)` }}
            />
            <CabStack gap="$2.5" className={styles.gaugeContent}>
              <CabText variant="caption" className={styles.gaugeLabel} color={cabColors.text.secondary}>
                {input.labels.activeInRange}
              </CabText>
              <div className={styles.gaugeChart}>
                <CabGaugeChart
                  value={input.gauge.activeInRangePoolCount}
                  max={Math.max(input.gauge.activePoolCount, 1)}
                  color={cabColors.brandExtended.signalTealUi}
                />
              </div>
              <CabText
                variant="kpi"
                fontWeight="700"
                color={cabColors.text.primary}
                className={styles.gaugeValue}
              >
                {input.values.activeInRangePoolCount}
              </CabText>
              <CabText variant="caption" className={styles.gaugeMeta} color={cabColors.brandExtended.signalTealUi}>
                {input.labels.activeInRangeMeta}
              </CabText>
            </CabStack>
          </div>
        </CabCard>
      </div>
    </CabKpiStrip>
  );
}