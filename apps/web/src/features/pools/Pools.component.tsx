"use client";

import { useTranslation } from "react-i18next";

import {
  CabCard,
  CabEmptyState,
  CabErrorPanel,
  CabLoadingPanel,
  CabSectionHeader,
  CabStack,
} from "@/design-system";
import { PoolDetailComponent } from "@/features/pools/PoolDetail.component";
import { PoolsFiltersBar } from "@/features/pools/components/PoolsFiltersBar";
import { PoolsMetricRail } from "@/features/pools/components/PoolsMetricRail";
import { PoolsTable } from "@/features/pools/components/PoolsTable";
import { getPoolsCoverageLabelKey } from "@/features/pools/pools.mappers";
import type { PoolDetailRange, PoolDetailViewModel, PoolsListFilters, PoolsListViewModel, PoolsScreenState } from "@/features/pools/pools.types";

import styles from "@/features/pools/PoolsWorkspace.module.css";

export type PoolsExpandedBreakdown = {
  poolId: string;
  manual: PoolDetailViewModel["segments"]["manual"];
  strategy: PoolDetailViewModel["segments"]["strategy"];
  residual: PoolDetailViewModel["segments"]["residual"];
  strategyLabels: string[];
};

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
  expandedPoolId: string | null;
  onToggleExpand: (poolId: string) => void;
  expandedBreakdown: PoolsExpandedBreakdown | null;
  expandedBreakdownIsLoading: boolean;
  expandedBreakdownErrorCode: string | null;
};

export function PoolsComponent(input: PoolsComponentProps) {
  const { t } = useTranslation(["pools", "coverage"]);

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
        <CabStack gap="$3">
          <CabSectionHeader title={t("pools:title")} subtitle={t("pools:subtitle")} />
          <PoolsFiltersBar
            filters={input.filters}
            searchPlaceholder={t("pools:filters.searchPlaceholder")}
            labels={{
              all: t("pools:filters.statusAll"),
              active: t("pools:filters.statusActive"),
              closed: t("pools:filters.statusClosed"),
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
            expandedPoolId={input.expandedPoolId}
            onToggleExpand={input.onToggleExpand}
            expandedBreakdown={input.expandedBreakdown}
            expandedBreakdownIsLoading={input.expandedBreakdownIsLoading}
            expandedBreakdownErrorCode={input.expandedBreakdownErrorCode}
            labels={{
              expandRow: t("pools:actions.expandRow"),
              collapseRow: t("pools:actions.collapseRow"),
              pool: t("pools:title"),
              value: t("pools:table.value"),
              portfolioShare: t("pools:table.portfolioShare"),
              rewards: t("pools:table.rewards"),
              apr: t("pools:table.apr"),
              status: t("pools:table.status"),
              coverage: t("pools:table.coverage"),
              latestActivity: t("pools:table.latestActivity"),
              inRange: t("pools:table.inRange"),
              outOfRange: t("pools:table.outOfRange"),
              unknown: t("pools:values.unavailable"),
              manualExposure: t("pools:values.manualExposure"),
              strategyExposure: t("pools:values.strategyExposure"),
              residualExposure: t("pools:values.residualExposure"),
              breakdownLoading: t("pools:states.loadingDetail"),
              breakdownUnavailable: t("pools:values.unavailable"),
              strategyMetaLabel: t("pools:values.strategy"),
            }}
            getCoverageLabel={(coverageStatus) => t(getPoolsCoverageLabelKey(coverageStatus))}
            onSelect={input.onSelectPool}
          />
        </CabStack>
      </div>
      {input.detailPanel ? (
        <aside className={styles.detailColumn}>
          <div className={styles.detailBody}>
            <CabCard density="compact">
            <PoolDetailComponent
              screenState={input.detailPanel.screenState}
              viewModel={input.detailPanel.viewModel}
              errorCode={input.detailPanel.errorCode}
              range={input.detailPanel.range}
              onClose={input.detailPanel.onClose}
              onRangeChange={input.detailPanel.onRangeChange}
              onRetry={input.detailPanel.onRetry}
            />
            </CabCard>
          </div>
        </aside>
      ) : null}
    </div>
  );
}