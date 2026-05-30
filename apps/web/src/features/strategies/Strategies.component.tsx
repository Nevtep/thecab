"use client";

import { useTranslation } from "react-i18next";

import {
  CabErrorPanel,
  CabLoadingPanel,
  CabSectionHeader,
} from "@/design-system";
import { StrategiesEmptyState } from "@/features/strategies/components/StrategiesEmptyState";
import { StrategiesFiltersBar } from "@/features/strategies/components/StrategiesFiltersBar";
import { StrategiesKpiStrip } from "@/features/strategies/components/StrategiesKpiStrip";
import { StrategiesTable } from "@/features/strategies/components/StrategiesTable";
import { StrategySelectedPanel } from "@/features/strategies/components/StrategySelectedPanel";
import { getStrategyCoverageLabelKey, type StrategiesListViewModel } from "@/features/strategies/strategies.mappers";
import type { StrategiesListUrlState } from "@/features/strategies/strategies.urlState";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategiesComponentProps = {
  screenState: "loading" | "locked" | "error" | "empty" | "ready";
  viewModel: StrategiesListViewModel | null;
  urlState: StrategiesListUrlState;
  errorCode: string | null;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StrategiesListUrlState["status"]) => void;
  onProtocolChange: (value: StrategiesListUrlState["protocol"]) => void;
  onCoverageChange: (value: StrategiesListUrlState["coverage"]) => void;
  onReturnSignChange: (value: StrategiesListUrlState["returnSign"]) => void;
  onSortChange: (value: StrategiesListUrlState["sort"]) => void;
  onClearPool: () => void;
  onClearFilters: () => void;
  onSelectStrategy: (strategyExposureId: string) => void;
  onOpenPool: (poolId: string) => void;
};

export function StrategiesComponent(input: StrategiesComponentProps) {
  const { i18n, t } = useTranslation(["strategies", "coverage"]);

  if (input.screenState === "loading") {
    return <CabLoadingPanel label={t("strategies:states.loadingTitle")} />;
  }

  if (input.screenState === "locked") {
    return (
      <StrategiesEmptyState
        title={t("strategies:states.lockedTitle")}
        description={t("strategies:subtitle")}
      />
    );
  }

  if (input.screenState === "error") {
    return (
      <CabErrorPanel
        title={t("strategies:states.emptyFilteredTitle")}
        description={t(`errors:strategies.${input.errorCode}`, { defaultValue: input.errorCode ?? "" })}
        retryLabel={t("strategies:actions.refresh")}
        onRetry={input.onRetry}
      />
    );
  }

  if (input.screenState === "empty" || !input.viewModel) {
    return (
      <StrategiesEmptyState
        title={t("strategies:states.emptyTitle")}
        description={t("strategies:states.emptyDescription")}
      />
    );
  }

  return (
    <div className={styles.workspace}>
      <CabSectionHeader title={t("strategies:title")} subtitle={t("strategies:subtitle")} />
      <StrategiesKpiStrip
        viewModel={input.viewModel}
        labels={{
          currentValue: t("strategies:kpis.currentValue"),
          activeCount: t("strategies:kpis.activeCount"),
          claimedRewards: t("strategies:kpis.claimedRewards"),
          totalReturn: t("strategies:kpis.totalReturn"),
          protocolCoverage: t("strategies:kpis.protocolCoverage"),
          coverage: t(getStrategyCoverageLabelKey(input.viewModel.kpis.coverageStatus)),
        }}
      />
      <StrategiesFiltersBar
        state={input.urlState}
        availablePools={input.viewModel.filters.availablePools}
        labels={{
          searchPlaceholder: t("strategies:filters.searchPlaceholder"),
          status: t("strategies:filters.status"),
          protocol: t("strategies:filters.protocol"),
          pool: t("strategies:filters.pool"),
          coverage: t("strategies:filters.coverage"),
          returnSign: t("strategies:filters.returnSign"),
          sort: t("strategies:filters.sort"),
          active: t("strategies:filterValues.active"),
          closed: t("strategies:filterValues.closed"),
          all: t("strategies:filterValues.all"),
          mellow: t("strategies:filterValues.mellow"),
          full: t("coverage:level.full"),
          shareLevel: t("coverage:level.share_level"),
          partial: t("coverage:level.partial"),
          unknown: t("coverage:level.unknown"),
          positive: t("strategies:filterValues.positive"),
          negative: t("strategies:filterValues.negative"),
          any: t("strategies:filterValues.any"),
          currentValueDesc: t("strategies:filterValues.currentValueDesc"),
          currentValueAsc: t("strategies:filterValues.currentValueAsc"),
          returnDesc: t("strategies:filterValues.returnDesc"),
          returnAsc: t("strategies:filterValues.returnAsc"),
          coverageDesc: t("strategies:filterValues.coverageDesc"),
          coverageAsc: t("strategies:filterValues.coverageAsc"),
          clearPool: t("strategies:actions.clearPool"),
          clearFilters: t("strategies:actions.clearFilters"),
        }}
        onSearchChange={input.onSearchChange}
        onStatusChange={input.onStatusChange}
        onProtocolChange={input.onProtocolChange}
        onCoverageChange={input.onCoverageChange}
        onReturnSignChange={input.onReturnSignChange}
        onSortChange={input.onSortChange}
        onClearPool={input.onClearPool}
        onClearFilters={() => input.onClearFilters()}
      />
      <div className={styles.dataView}>
        <StrategiesTable
          items={input.viewModel.items}
          labels={{
            strategy: t("strategies:table.columns.strategy"),
            status: t("strategies:table.columns.status"),
            currentValue: t("strategies:table.columns.currentValue"),
            shares: t("strategies:table.columns.shares"),
            rewards: t("strategies:table.columns.claimedRewards"),
            result: t("strategies:table.columns.result"),
            apr: t("strategies:table.columns.estimatedApr"),
            coverage: t("strategies:table.columns.coverage"),
            select: t("strategies:actions.openStrategy"),
          }}
          getCoverageLabel={(coverage) => t(getStrategyCoverageLabelKey(coverage))}
          onSelect={input.onSelectStrategy}
        />
        <StrategySelectedPanel
          chainId={input.viewModel.chainId}
          locale={i18n.language}
          strategy={input.viewModel.selectedStrategy}
          labels={{
            exposureSummary: t("strategies:detail.exposureSummary"),
            rewards: t("strategies:detail.rewards"),
            lifecycle: t("strategies:detail.lifecycle"),
            coverageNote: t("strategies:detail.coverageNote"),
            currentValue: t("strategies:detail.currentValue"),
            shares: t("strategies:detail.currentShares"),
            totalReturn: t("strategies:detail.totalReturn"),
            deposited: t("strategies:detail.deposited"),
            withdrawn: t("strategies:detail.withdrawn"),
            sharesReceived: t("strategies:detail.sharesReceived"),
            sharesRedeemed: t("strategies:detail.sharesRedeemed"),
            rewardsEmpty: t("strategies:detail.rewardsEmpty"),
            rewardToken: t("strategies:detail.rewardColumns.token"),
            rewardAmount: t("strategies:detail.rewardColumns.amount"),
            rewardValue: t("strategies:detail.rewardColumns.value"),
            rewardClaimedAt: t("strategies:detail.rewardColumns.claimedAt"),
            transaction: t("strategies:detail.transaction"),
            status: t("strategies:detail.status"),
            resolved: t("strategies:detail.resolution.resolved"),
            unresolved: t("strategies:detail.resolution.unresolved"),
            lifecycleEmpty: t("strategies:detail.lifecycleEmpty"),
            openPool: t("strategies:actions.openPool"),
            openRewards: t("navigation:items.rewards"),
          }}
          onOpenPool={input.onOpenPool}
          translate={(key, options) => t(key, options)}
        />
      </div>
    </div>
  );
}
