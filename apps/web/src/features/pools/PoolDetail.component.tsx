"use client";

import { useTranslation } from "react-i18next";

import {
  CabBadge,
  CabButton,
  CabCoverageBadge,
  CabEmptyState,
  CabErrorPanel,
  CabImpactMetricCard,
  CabLoadingPanel,
  CabRangeSelector,
  CabSectionHeader,
  CabStack,
  CabText,
} from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { PoolExposureBar } from "@/features/pools/components/PoolExposureBar";
import { PoolHistoryChart } from "@/features/pools/components/PoolHistoryChart";
import { PoolRelatedLinks } from "@/features/pools/components/PoolRelatedLinks";
import { PoolMetadataFooter } from "@/features/pools/components/PoolMetadataFooter";
import { PoolTimeline } from "@/features/pools/components/PoolTimeline";
import { buildPoolRewardsHref } from "@/features/rewards/rewards.navigation";
import { buildStrategiesListHref } from "@/features/strategies/strategies.navigation";
import { getPoolsCoverageLabelKey } from "@/features/pools/pools.mappers";
import type { PoolDetailRange, PoolDetailViewModel } from "@/features/pools/pools.types";

import styles from "@/features/pools/PoolDetail.module.css";

type PoolDetailComponentProps = {
  screenState: "loading" | "ready" | "error" | "locked";
  viewModel: PoolDetailViewModel | null;
  errorCode: string | null;
  range: PoolDetailRange;
  onClose: () => void;
  onRangeChange: (range: PoolDetailRange) => void;
  onOpenDeposits?: () => void;
  onRetry: () => void;
};

function toneForStatus(status: PoolDetailViewModel["header"]["status"]) {
  switch (status) {
    case "active":
      return "success" as const;
    case "inactive":
      return "warning" as const;
    case "closed":
      return "neutral" as const;
    default:
      return "info" as const;
  }
}

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

  const viewModel = input.viewModel;
  const header = viewModel.header;
  const detailReasonLabels = header.coverageReasonCodes.map((reasonCode) =>
    t(`coverage:reasons.${reasonCode}`, { defaultValue: reasonCode }),
  );
  const hasManualDeposits = input.viewModel.positions.manualDeposits.length > 0;
  const rangeStatusLabel = header.isInRange === null
    ? null
    : header.isInRange
      ? t("pools:values.inRange")
      : t("pools:values.outOfRange");
  const footerRows = [
    {
      key: "protocol",
      label: t("pools:detail.protocolLabel"),
      value: header.formattedProtocolFamily,
    },
    {
      key: "poolType",
      label: t("pools:detail.poolType"),
      value: header.formattedPoolType ?? t("pools:values.unavailable"),
    },
    {
      key: "feeTier",
      label: t("pools:detail.feeTier"),
      value: header.feeTierLabel ?? t("pools:values.unavailable"),
    },
    {
      key: "tokenPair",
      label: t("pools:detail.tokenPair"),
      value: header.formattedTokenPair,
    },
    {
      key: "poolAddress",
      label: t("pools:detail.poolAddress"),
      value: header.shortPoolAddress,
      href: header.explorerUrl,
      hrefLabel: t("pools:detail.viewExplorer"),
    },
  ];

  return (
    <CabStack gap="$3">
      <CabStack gap="$2">
        <CabSectionHeader
          title={header.formattedTokenPair || header.label}
          subtitle={t("pools:sections.detail")}
          actions={(
            <CabButton tone="ghost" controlSize="sm" onPress={input.onClose}>
              {t("pools:actions.closeDetail")}
            </CabButton>
          )}
        />
        <CabStack gap="$2">
          <div className={styles.headerMetaRow}>
            {header.formattedProtocolMetadata ? (
              <CabBadge tone="info" size="sm" variant="emphasis">{header.formattedProtocolMetadata}</CabBadge>
            ) : null}
            <CabCoverageBadge state={header.coverageStatus} label={t(getPoolsCoverageLabelKey(header.coverageStatus))} />
            <CabBadge tone={toneForStatus(header.status)} size="sm">{t(`pools:values.status${header.status.charAt(0).toUpperCase()}${header.status.slice(1)}`)}</CabBadge>
            {rangeStatusLabel ? <CabBadge tone={header.isInRange ? "success" : "warning"} size="sm">{rangeStatusLabel}</CabBadge> : null}
          </div>
          {detailReasonLabels.length > 0 ? (
            <CabText variant="caption" color={cabColors.text.secondary}>{detailReasonLabels.join(" • ")}</CabText>
          ) : null}
          {header.strategyLabels.length > 0 ? (
            <CabText variant="caption" color={cabColors.text.secondary}>
              {t("pools:values.strategy")}: {header.strategyLabels.join(", ")}
            </CabText>
          ) : null}
          {hasManualDeposits && input.onOpenDeposits ? (
            <CabButton tone="secondary" controlSize="sm" onPress={input.onOpenDeposits}>
              {t("pools:detail.viewDeposits")}
            </CabButton>
          ) : null}
          <div className={styles.headerRangeRow}>
            <CabText variant="caption" color={cabColors.text.secondary}>
              {input.viewModel.formattedCoveredRange
                ? `${t("pools:totals.coveredRange")}: ${input.viewModel.formattedCoveredRange}`
                : t("pools:values.unavailable")}
            </CabText>
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
          </div>
        </CabStack>
      </CabStack>
      <div className={styles.summaryGrid}>
        <CabImpactMetricCard
          label={t("pools:metrics.currentValue")}
          value={header.formattedCurrentAttributedValueUsd}
          iconName="dashboard"
          accentColor={cabColors.brand.electricBlue}
          size="compact"
        />
        <CabImpactMetricCard
          label={t("pools:metrics.totalRewards")}
          value={header.formattedTotalRewardsUsd}
          iconName="rewards"
          accentColor={cabColors.dataViz.mint}
          size="compact"
        />
        <CabImpactMetricCard
          label={t("pools:metrics.apr")}
          value={header.formattedAnnualizedReturnPct ?? t("pools:values.unavailable")}
          iconName="activity"
          accentColor={cabColors.dataViz.orange}
          meta={header.formattedTotalReturnPct}
          size="compact"
        />
        <CabImpactMetricCard
          label={t("pools:metrics.timeInvested")}
          value={header.formattedInvestedDays ?? t("pools:values.unavailable")}
          iconName="info"
          accentColor={cabColors.brandExtended.signalTealUi}
          size="compact"
        />
      </div>
      <PoolExposureBar
        title={t("pools:sections.exposure")}
        items={[
          {
            key: "manual",
            label: t("pools:values.manualExposure"),
            value: input.viewModel.segments.manual.currentValueUsd,
            formattedValue: input.viewModel.segments.manual.formattedCurrentValueUsd,
            coverageStatus: input.viewModel.segments.manual.coverageStatus,
            color: cabColors.brandExtended.signalTealUi,
          },
          {
            key: "strategy",
            label: t("pools:values.strategyExposure"),
            value: input.viewModel.segments.strategy.currentValueUsd,
            formattedValue: input.viewModel.segments.strategy.formattedCurrentValueUsd,
            coverageStatus: input.viewModel.segments.strategy.coverageStatus,
            color: cabColors.brand.electricBlue,
          },
          {
            key: "residual",
            label: t("pools:values.residualExposure"),
            value: input.viewModel.segments.residual.currentValueUsd,
            formattedValue: input.viewModel.segments.residual.formattedCurrentValueUsd,
            coverageStatus: input.viewModel.segments.residual.coverageStatus,
            color: cabColors.dataViz.orange,
          },
        ]}
      />
      {input.viewModel.related.strategies.length > 0 ? (
        <PoolRelatedLinks
          title={t("pools:sections.related")}
          labels={{
            deposit: t("pools:values.deposit"),
            strategy: t("pools:values.strategy"),
            rewards: t("navigation:items.rewards"),
          }}
          rewardsHref={buildPoolRewardsHref(viewModel.header.poolId)}
          deposits={viewModel.related.deposits}
          strategies={viewModel.related.strategies.map((strategy) => ({
            ...strategy,
            href: buildStrategiesListHref({
              chainId: viewModel.chainId,
              poolId: viewModel.header.poolId,
              selectedStrategyId: strategy.id,
            }),
          }))}
        />
      ) : null}
      <PoolHistoryChart data={input.viewModel.chart} title={t("pools:sections.performance")} />
      <PoolTimeline
        title={t("pools:sections.events")}
        emptyLabel={t("pools:messages.noRelevantEvents")}
        items={input.viewModel.timeline}
      />
      <PoolMetadataFooter
        title={t("pools:sections.metadata")}
        rows={footerRows}
        estimatedMessage={header.metricsEstimated ? t("pools:messages.estimatedMetrics") : null}
      />
    </CabStack>
  );
}
