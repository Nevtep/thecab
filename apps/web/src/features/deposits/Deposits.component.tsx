"use client";

import { useTranslation } from "react-i18next";

import {
  CabEmptyState,
  CabErrorPanel,
  CabLoadingPanel,
  CabSectionHeader,
  CabStack,
} from "@/design-system";
import { DepositsEmptyState } from "@/features/deposits/components/DepositsEmptyState";
import { DepositsFiltersBar } from "@/features/deposits/components/DepositsFiltersBar";
import { DepositsKpiStrip } from "@/features/deposits/components/DepositsKpiStrip";
import { DepositsTable } from "@/features/deposits/components/DepositsTable";
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

export type DepositsScreenState = "loading" | "locked" | "error" | "empty" | "ready";

type DepositsComponentProps = {
  screenState: DepositsScreenState;
  viewModel: DepositsListViewModel | null;
  locale: string;
  status: DepositsStatusFilter;
  returnSign: DepositsReturnSignFilter;
  sort: DepositsSortField;
  direction: DepositsSortDirection;
  density: DepositsTableDensity;
  hiddenColumns: DepositsTableColumnKey[];
  selectedDepositId: string | null;
  errorCode: string | null;
  onRetry: () => void;
  onStatusChange: (value: DepositsStatusFilter) => void;
  onReturnSignChange: (value: DepositsReturnSignFilter) => void;
  onSortChange: (sort: DepositsSortField, direction: DepositsSortDirection) => void;
  onSelectRow: (depositId: string) => void;
};

export function DepositsComponent(input: DepositsComponentProps) {
  const { t } = useTranslation(["deposits"]);

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
    return (
      <DepositsEmptyState
        title={t("deposits:list.empty.title")}
        description={t("deposits:list.empty.description")}
        actionLabel={t("deposits:list.empty.actionLabel")}
        onAction={input.onRetry}
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

  return (
    <CabStack gap="$4">
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
          capitalDeployed: t("deposits:list.kpis.capitalDeployed"),
        }}
      />
      <DepositsFiltersBar
        status={input.status}
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
        }}
        onStatusChange={input.onStatusChange}
        onReturnSignChange={input.onReturnSignChange}
      />
      <DepositsTable
        items={input.viewModel.items}
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
        onSortChange={input.onSortChange}
        onSelectRow={input.onSelectRow}
      />
    </CabStack>
  );
}
