"use client";

import { useTranslation } from "react-i18next";

import {
  CabButton,
  CabCard,
  CabCoverageBadge,
  CabEmptyState,
  CabErrorPanel,
  CabLoadingPanel,
  CabSectionHeader,
  CabStack,
  CabText,
} from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { PoolDetailComponent } from "@/features/pools/PoolDetail.component";
import { PoolsFiltersBar } from "@/features/pools/components/PoolsFiltersBar";
import { PoolsMetricRail } from "@/features/pools/components/PoolsMetricRail";
import { PoolsTable } from "@/features/pools/components/PoolsTable";
import { getPoolsCoverageLabelKey } from "@/features/pools/pools.mappers";
import type { PoolDetailRange, PoolDetailViewModel, PoolsListFilters, PoolsListViewModel, PoolsScreenState } from "@/features/pools/pools.types";

import styles from "@/features/pools/PoolsWorkspace.module.css";

type PoolsComponentProps = {
  screenState: PoolsScreenState;
  viewModel: PoolsListViewModel | null;
  filters: PoolsListFilters;
  selectedPoolId?: string | null;
  errorCode: string | null;
  detailPanel?: {
    poolId: string;
    screenState: "loading" | "ready" | "error" | "locked";
    viewModel: PoolDetailViewModel | null;
    errorCode: string | null;
    range: PoolDetailRange;
    onRangeChange: (range: PoolDetailRange) => void;
    onRetry: () => void;
    onClose: () => void;
  } | null;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: PoolsListFilters["status"]) => void;
  onSelectPool: (poolId: string) => void;
};

export function PoolsComponent(input: PoolsComponentProps) {
  const { t } = useTranslation(["pools", "coverage"]);
  const detailReasonLabels = input.detailPanel?.viewModel?.header.coverageReasonCodes.map((reasonCode) =>
    t(`coverage:reasons.${reasonCode}`, { defaultValue: reasonCode }),
  ) ?? [];

  if (input.screenState === "loading") {
    return <CabLoadingPanel label={t("pools:states.loading")} />;
  }

  if (input.screenState === "locked") {
    return (
      <CabEmptyState
        title={t("pools:states.lockedTitle")}
        description={t("pools:states.lockedDescription")}
      />
    );
  }

  if (input.screenState === "error") {
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

  if (input.screenState === "empty" || !input.viewModel) {
    return (
      <CabEmptyState
        title={t("pools:states.emptyTitle")}
        description={t("pools:states.emptyDescription")}
      />
    );
  }

  return (
    <div className={[styles.workspace, input.detailPanel ? styles.withDetail : ""].filter(Boolean).join(" ")}>
      <div className={styles.listColumn}>
        <CabStack gap="$4">
          <CabSectionHeader title={t("pools:title")} subtitle={t("pools:subtitle")} />
          <PoolsFiltersBar
            filters={input.filters}
            searchPlaceholder={t("pools:filters.searchPlaceholder")}
            labels={{
              all: t("pools:filters.statusAll"),
              active: t("pools:filters.statusActive"),
              closed: t("pools:filters.statusClosed"),
              pools: t("pools:totals.pools"),
              totalValue: t("pools:totals.totalValue"),
              coveredRange: t("pools:totals.coveredRange"),
            }}
            summary={{
              poolCount: input.viewModel.formattedSummary.poolCount,
              currentAttributedValueUsd: input.viewModel.formattedSummary.currentAttributedValueUsd,
              coveredRange: input.viewModel.formattedCoveredRange,
            }}
            onSearchChange={input.onSearchChange}
            onStatusChange={input.onStatusChange}
          />
          <PoolsMetricRail
            labels={{
              poolsWithPosition: t("pools:metrics.poolsWithPosition"),
              currentValue: t("pools:metrics.currentValue"),
              impermanentLoss: t("pools:metrics.impermanentLoss"),
              rewards: t("pools:metrics.totalRewards"),
              estimatedReturn: t("pools:metrics.estimatedReturn"),
              activeInRange: t("pools:metrics.activeInRange"),
              activeInRangeMeta: t("pools:messages.activeInRangeMeta", {
                active: input.viewModel.formattedSummary.activeInRangePoolCount,
                total: input.viewModel.formattedSummary.activePoolCount,
              }),
              unavailable: t("pools:values.unavailable"),
            }}
            values={input.viewModel.formattedSummary}
            series={input.viewModel.summarySeries}
            gauge={{
              activeInRangePoolCount: input.viewModel.summary.activeInRangePoolCount,
              activePoolCount: input.viewModel.summary.activePoolCount,
            }}
          />
          <PoolsTable
            items={input.viewModel.items}
            selectedPoolId={input.selectedPoolId}
            labels={{
              open: t("pools:actions.open"),
              pool: t("pools:title"),
              value: t("pools:table.value"),
              portfolioShare: t("pools:table.portfolioShare"),
              performance: t("pools:table.performance"),
              exposure: t("pools:table.exposure"),
              latestActivity: t("pools:table.latestActivity"),
              status: t("pools:values.status"),
              rewards: t("pools:values.rewards"),
              inRange: t("pools:table.inRange"),
              outOfRange: t("pools:table.outOfRange"),
              unknown: t("pools:values.unavailable"),
            }}
            getCoverageLabel={(coverageStatus) => t(getPoolsCoverageLabelKey(coverageStatus))}
            onSelect={input.onSelectPool}
          />
        </CabStack>
      </div>
      {input.detailPanel ? (
        <aside className={styles.detailColumn}>
          <CabCard density="spacious">
            <CabStack gap="$3">
              <CabSectionHeader
                title={t("pools:sections.detail")}
                subtitle={input.detailPanel.viewModel?.formattedCoveredRange ? `${t("pools:totals.coveredRange")}: ${input.detailPanel.viewModel.formattedCoveredRange}` : undefined}
                actions={(
                  <CabButton tone="ghost" controlSize="sm" onPress={input.detailPanel.onClose}>
                    {t("pools:actions.closeDetail")}
                  </CabButton>
                )}
              />
              {input.detailPanel.viewModel ? (
                <CabStack gap="$2">
                  <CabStack row gap="$2" flexWrap="wrap" alignItems="center">
                    <CabCoverageBadge
                      state={input.detailPanel.viewModel.header.coverageStatus}
                      label={t(getPoolsCoverageLabelKey(input.detailPanel.viewModel.header.coverageStatus))}
                    />
                    <CabText variant="caption" color={cabColors.text.secondary}>
                      {t("pools:values.status")}: {input.detailPanel.viewModel.header.status}
                    </CabText>
                  </CabStack>
                  {detailReasonLabels.length > 0 ? (
                    <CabText variant="caption" color={cabColors.text.secondary}>
                      {detailReasonLabels.join(" • ")}
                    </CabText>
                  ) : null}
                  {input.detailPanel.viewModel.header.strategyLabels.length > 0 ? (
                    <CabText variant="caption" color={cabColors.text.secondary}>
                      {t("pools:values.strategy")}: {input.detailPanel.viewModel.header.strategyLabels.join(", ")}
                    </CabText>
                  ) : null}
                </CabStack>
              ) : null}
            </CabStack>
          </CabCard>
          <div className={styles.detailBody}>
            <PoolDetailComponent
              screenState={input.detailPanel.screenState}
              viewModel={input.detailPanel.viewModel}
              errorCode={input.detailPanel.errorCode}
              range={input.detailPanel.range}
              embedded
              onRangeChange={input.detailPanel.onRangeChange}
              onRetry={input.detailPanel.onRetry}
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}