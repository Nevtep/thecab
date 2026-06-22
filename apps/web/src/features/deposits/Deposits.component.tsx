"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  CabCard,
  CabEmptyState,
  CabErrorPanel,
  CabLoadingPanel,
  CabSectionHeader,
  CabStack,
  DataTablePagination,
  DataTableEmptyState,
} from "@/design-system";
import { DepositDetailContainer } from "@/features/deposits/DepositDetail.container";
import { DepositsEmptyState } from "@/features/deposits/components/DepositsEmptyState";
import { DepositsFiltersBar } from "@/features/deposits/components/DepositsFiltersBar";
import { DepositsKpiStrip } from "@/features/deposits/components/DepositsKpiStrip";
import { DepositsTable } from "@/features/deposits/components/DepositsTable";
import { getStrategiesListHref } from "@/features/deposits/deposits.navigation";
import type { DepositsListViewModel } from "@/features/deposits/deposits.mappers";
import type {
  DepositsReturnSignFilter,
  DepositsSortDirection,
  DepositsSortField,
  DepositsStatusFilter,
  DepositSummaryStatus,
} from "@/features/deposits/deposits.types";
import type {
  DepositsTableColumnKey,
  DepositsTableDensity,
} from "@/features/deposits/deposits.viewPrefs";

import styles from "@/features/deposits/DepositsWorkspace.module.css";

export type DepositsScreenState = "loading" | "locked" | "error" | "empty" | "ready";

type DepositsComponentProps = {
  screenState: DepositsScreenState;
  viewModel: DepositsListViewModel | null;
  locale: string;
  status: DepositsStatusFilter;
  poolId: string | null;
  startDayUtc: string | null;
  endDayUtc: string | null;
  returnSign: DepositsReturnSignFilter;
  sort: DepositsSortField;
  direction: DepositsSortDirection;
  density: DepositsTableDensity;
  hiddenColumns: DepositsTableColumnKey[];
  selectedDepositId: string | null;
  selectedDepositReturnTo: string | null;
  errorCode: string | null;
  isRefreshing?: boolean;
  onRetry: () => void;
  onStatusChange: (value: DepositsStatusFilter) => void;
  onClearPool: () => void;
  onStartDayChange: (value: string | null) => void;
  onEndDayChange: (value: string | null) => void;
  onClearDateRange: () => void;
  onReturnSignChange: (value: DepositsReturnSignFilter) => void;
  onSortChange: (sort: DepositsSortField, direction: DepositsSortDirection) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSelectRow: (depositId: string) => void;
  onCloseDetail: () => void;
  onOpenStrategies: () => void;
};

export function DepositsComponent(input: DepositsComponentProps) {
  const { onCloseDetail, selectedDepositId } = input;
  const { t } = useTranslation(["deposits", "common"]);

  useEffect(() => {
    if (!selectedDepositId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onCloseDetail();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCloseDetail, selectedDepositId]);

  if (input.screenState === "loading") {
    return <CabLoadingPanel label={t("deposits:list.loading")} />;
  }

  if (input.screenState === "locked") {
    return (
      <CabEmptyState
        title={t("deposits:list.empty.title")}
        description={t("deposits:list.empty.description")}
      />
    );
  }

  if (input.screenState === "error") {
    return (
      <CabErrorPanel
        title={t("deposits:list.error.title")}
        description={t("deposits:list.error.description")}
        retryLabel={t("deposits:list.error.actionLabel")}
        onRetry={input.onRetry}
      />
    );
  }

  if (input.screenState === "empty" || !input.viewModel) {
    const hasAutomatedExposure = input.viewModel?.summary.hasAutomatedExposure ?? false;
    const strategiesHref = getStrategiesListHref();
    return (
      <DepositsEmptyState
        title={hasAutomatedExposure ? t("deposits:list.emptyAutomated.title") : t("deposits:list.empty.title")}
        description={hasAutomatedExposure ? t("deposits:list.emptyAutomated.description") : t("deposits:list.empty.description")}
        actionLabel={hasAutomatedExposure ? t("deposits:list.emptyAutomated.actionLabel") : t("deposits:list.empty.actionLabel")}
        onAction={hasAutomatedExposure && strategiesHref ? input.onOpenStrategies : input.onRetry}
        actionDisabled={hasAutomatedExposure && !strategiesHref}
        actionHint={hasAutomatedExposure ? t("deposits:strategiesCrossLink.placeholder") : undefined}
      />
    );
  }

  const totalDepositsValue = t("deposits:list.kpis.totalDepositsValue", {
    count: input.viewModel.summary.totalCount,
  });

  const statusLabels: Record<DepositSummaryStatus, string> = {
    open_active: t("deposits:status.open_active"),
    open_out_of_range: t("deposits:status.open_out_of_range"),
    closed: t("deposits:status.closed"),
  };

  const columnLabels: Record<DepositsTableColumnKey, string> = {
    position: t("deposits:list.columns.position"),
    pool: t("deposits:list.columns.pool"),
    status: t("deposits:list.columns.status"),
    opened: t("deposits:list.columns.opened"),
    closed: t("deposits:list.columns.closed"),
    openedValue: t("deposits:list.columns.openedValue"),
    currentValue: t("deposits:list.columns.currentValue"),
    totalRewards: t("deposits:list.columns.totalRewards"),
    realizedPnl: t("deposits:list.columns.realizedPnl"),
    unrealizedPnl: t("deposits:list.columns.unrealizedPnl"),
    totalReturn: t("deposits:list.columns.totalReturn"),
    estApr: t("deposits:list.columns.estApr"),
    coverage: t("deposits:list.columns.coverage"),
    confidence: t("deposits:list.columns.confidence"),
  };

  const filteredEmptyState = (
    <DataTableEmptyState
      title={t("deposits:list.filteredEmpty.title")}
      description={t("deposits:list.filteredEmpty.description")}
    />
  );

  return (
    <div className={[styles.workspace, input.selectedDepositId ? styles.withDetail : ""].filter(Boolean).join(" ")}>
      <div className={styles.listColumn}>
        <CabStack gap="$4">
          {/* Deposits keeps coverage inline per row/detail; it must not mount a duplicate global coverage banner. */}
          <CabSectionHeader title={t("deposits:title")} subtitle={t("deposits:subtitle")} />
          <DepositsKpiStrip
            summary={input.viewModel.summary}
            locale={input.locale}
            labels={{
              totalDeposits: t("deposits:list.kpis.totalDeposits"),
              totalDepositsValue,
              currentValue: t("deposits:list.kpis.currentValue"),
              totalRewards: t("deposits:list.kpis.totalRewards"),
              weightedAnnualizedReturn: t("deposits:list.kpis.weightedAnnualizedReturn"),
              openPositions: t("deposits:list.kpis.openPositions"),
            }}
          />
          <DepositsFiltersBar
            status={input.status}
            poolId={input.poolId}
            startDayUtc={input.startDayUtc}
            endDayUtc={input.endDayUtc}
            returnSign={input.returnSign}
            labels={{
              status: {
                label: t("deposits:list.filters.status.label"),
                all: t("deposits:list.filters.status.all"),
                open_active: t("deposits:list.filters.status.open_active"),
                open_out_of_range: t("deposits:list.filters.status.open_out_of_range"),
                closed: t("deposits:list.filters.status.closed"),
              },
              returnSign: {
                label: t("deposits:list.filters.returnSign.label"),
                all: t("deposits:list.filters.returnSign.all"),
                positive: t("deposits:list.filters.returnSign.positive"),
                negative: t("deposits:list.filters.returnSign.negative"),
              },
              pool: {
                label: t("deposits:list.filters.pool.label"),
                active: t("deposits:list.filters.pool.active"),
                clear: t("deposits:list.filters.pool.clear"),
                all: t("deposits:list.filters.pool.all"),
              },
              dateRange: {
                label: t("deposits:list.filters.dateRange.label"),
                start: t("deposits:list.filters.dateRange.start"),
                end: t("deposits:list.filters.dateRange.end"),
                clear: t("deposits:list.filters.dateRange.clear"),
              },
              more: {
                label: t("deposits:list.filters.more"),
              },
            }}
            onStatusChange={input.onStatusChange}
            onClearPool={input.onClearPool}
            onStartDayChange={input.onStartDayChange}
            onEndDayChange={input.onEndDayChange}
            onClearDateRange={input.onClearDateRange}
            onReturnSignChange={input.onReturnSignChange}
          />
          <DepositsTable
            items={input.viewModel.items}
            loading={input.isRefreshing}
            locale={input.locale}
            hiddenColumns={input.hiddenColumns}
            sort={input.sort}
            direction={input.direction}
            selectedDepositId={input.selectedDepositId}
            labels={{
              columns: columnLabels,
              status: statusLabels,
              transferIn: {
                badge: t("deposits:transferIn.badge"),
                tooltip: t("deposits:transferIn.tooltip"),
              },
            }}
            emptyState={filteredEmptyState}
            onSortChange={input.onSortChange}
            onSelectRow={input.onSelectRow}
          />
          <DataTablePagination
            page={input.viewModel.page.page}
            pageSize={input.viewModel.page.pageSize}
            totalRows={input.viewModel.page.totalCount}
            totalPages={Math.max(1, Math.ceil(input.viewModel.page.totalCount / input.viewModel.page.pageSize))}
            pageSizeOptions={[10, 25, 50, 100]}
            loading={input.isRefreshing}
            labels={{
              previous: t("common:previous"),
              next: t("common:next"),
              page: (page, totalPages) => t("common:pageIndicator", { page, totalPages }),
              rowsPerPage: t("common:rowsPerPage"),
              showing: (from, to, total) => t("common:showingRange", { from, to, total }),
            }}
            onPageChange={input.onPageChange}
            onPageSizeChange={input.onPageSizeChange}
          />
        </CabStack>
      </div>
      {input.selectedDepositId ? (
        <aside className={styles.detailColumn}>
          <div className={styles.detailBody}>
            <CabCard density="spacious">
              <DepositDetailContainer
                depositId={input.selectedDepositId}
                onClose={input.onCloseDetail}
                backHref={input.selectedDepositReturnTo}
              />
            </CabCard>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
