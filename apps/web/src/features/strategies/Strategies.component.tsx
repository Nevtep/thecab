"use client";

import { useTranslation } from "react-i18next";

import {
  CabDataPanel,
  CabErrorPanel,
  CabLoadingPanel,
  CabSectionHeader,
  CabStack,
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
  onSelectStrategy: (strategyExposureId: string) => void;
};

export function StrategiesComponent(input: StrategiesComponentProps) {
  const { t } = useTranslation(["strategies", "coverage"]);

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
        labels={{
          searchPlaceholder: t("strategies:filters.searchPlaceholder"),
          active: t("strategies:filterValues.active"),
          closed: t("strategies:filterValues.closed"),
          all: t("strategies:filterValues.all"),
        }}
        onSearchChange={input.onSearchChange}
        onStatusChange={input.onStatusChange}
      />
      <div className={styles.dataView}>
        <CabDataPanel>
          <CabStack gap="$3">
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
          </CabStack>
        </CabDataPanel>
        <StrategySelectedPanel
          strategy={input.viewModel.selectedStrategy}
          labels={{
            exposureSummary: t("strategies:detail.exposureSummary"),
            rewards: t("strategies:detail.rewards"),
            lifecycle: t("strategies:detail.lifecycle"),
            coverageNote: t("strategies:detail.coverageNote"),
            currentValue: t("strategies:detail.currentValue"),
            shares: t("strategies:detail.currentShares"),
          }}
          translate={(key, options) => t(key, options)}
        />
      </div>
    </div>
  );
}

