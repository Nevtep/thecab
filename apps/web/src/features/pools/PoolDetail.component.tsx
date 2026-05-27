"use client";

import { useTranslation } from "react-i18next";

import {
  CabCoverageBadge,
  CabEmptyState,
  CabErrorPanel,
  CabLoadingPanel,
  CabMetricCard,
  CabRangeSelector,
  CabSectionHeader,
  CabStack,
  CabText,
} from "@/design-system";
import { PoolCompositionPanel } from "@/features/pools/components/PoolCompositionPanel";
import { PoolExposureBreakdown } from "@/features/pools/components/PoolExposureBreakdown";
import { PoolHistoryChart } from "@/features/pools/components/PoolHistoryChart";
import { PoolRelatedLinks } from "@/features/pools/components/PoolRelatedLinks";
import { PoolTimeline } from "@/features/pools/components/PoolTimeline";
import { getPoolsCoverageLabelKey } from "@/features/pools/pools.mappers";
import type { PoolDetailRange, PoolDetailViewModel } from "@/features/pools/pools.types";

import styles from "@/features/pools/PoolDetail.module.css";

type PoolDetailComponentProps = {
  screenState: "loading" | "ready" | "error" | "locked";
  viewModel: PoolDetailViewModel | null;
  errorCode: string | null;
  range: PoolDetailRange;
  embedded?: boolean;
  onRangeChange: (range: PoolDetailRange) => void;
  onRetry: () => void;
};

export function PoolDetailComponent(input: PoolDetailComponentProps) {
  const { t } = useTranslation(["pools", "coverage"]);

  if (input.screenState === "loading") {
    return <CabLoadingPanel label={t("pools:states.loadingDetail")} />;
  }

  if (input.screenState === "locked") {
    return (
      <CabEmptyState
        title={t("pools:states.lockedTitle")}
        description={t("pools:states.lockedDescription")}
      />
    );
  }

  if (input.screenState === "error" || !input.viewModel) {
    return (
      <CabErrorPanel
        title={t("pools:states.errorTitle")}
        description={t(`pools:states.errors.${input.errorCode}`, {
          defaultValue: t("pools:states.errorDescription"),
        })}
        retryLabel={t("pools:actions.retry")}
        onRetry={input.onRetry}
      />
    );
  }

  const header = input.viewModel.header;

  return (
    <CabStack gap="$4">
      {input.embedded ? null : <CabSectionHeader title={header.label} subtitle={header.poolAddress} />}
      {input.embedded ? null : <CabCoverageBadge state={header.coverageStatus} label={t(getPoolsCoverageLabelKey(header.coverageStatus))} />}
      <div className={styles.summaryGrid}>
        <CabMetricCard label={t("pools:metrics.currentValue")} value={header.formattedCurrentAttributedValueUsd} />
        <CabMetricCard label={t("pools:metrics.capitalInvested")} value={header.formattedCapitalInvestedUsd} />
        <CabMetricCard label={t("pools:metrics.timeInvested")} value={header.formattedInvestedDays ?? t("pools:values.unavailable")} />
        <CabMetricCard label={t("pools:metrics.totalRewards")} value={header.formattedTotalRewardsUsd} />
        <CabMetricCard label={t("pools:metrics.totalReturn")} value={header.formattedTotalReturnPct ?? t("pools:values.unavailable")} />
        <CabMetricCard label={t("pools:metrics.apr")} value={header.formattedAnnualizedReturnPct ?? t("pools:values.unavailable")} />
      </div>
      <CabRangeSelector
        options={[
          { key: "30d", label: "30d" },
          { key: "90d", label: "90d" },
          { key: "180d", label: "180d" },
          { key: "1y", label: "1y" },
          { key: "covered", label: t("pools:ranges.covered") },
        ]}
        selectedKey={input.range}
        onSelect={(value) => input.onRangeChange(value as PoolDetailRange)}
      />
      <PoolHistoryChart data={input.viewModel.chart} title={t("pools:sections.history")} />
      <PoolExposureBreakdown
        labels={{
          manual: t("pools:values.manualExposure"),
          strategy: t("pools:values.strategyExposure"),
          residual: t("pools:values.residualExposure"),
        }}
        values={{
          manual: input.viewModel.segments.manual.formattedCurrentValueUsd,
          strategy: input.viewModel.segments.strategy.formattedCurrentValueUsd,
          residual: input.viewModel.segments.residual.formattedCurrentValueUsd,
        }}
      />
      <PoolCompositionPanel title={t("pools:sections.composition")} items={input.viewModel.currentComposition} />
      <PoolTimeline
        title={t("pools:sections.timeline")}
        confidenceLabel={t("pools:messages.confidence")}
        items={input.viewModel.timeline}
      />
      <PoolRelatedLinks
        title={t("pools:sections.related")}
        labels={{
          deposit: t("pools:values.deposit"),
          strategy: t("pools:values.strategy"),
        }}
        deposits={input.viewModel.related.deposits}
        strategies={input.viewModel.related.strategies}
      />
      {header.metricsEstimated ? (
        <CabText variant="caption">{t("pools:messages.estimatedMetrics")}</CabText>
      ) : null}
    </CabStack>
  );
}