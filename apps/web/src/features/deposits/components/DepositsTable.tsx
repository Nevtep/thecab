"use client";

import { createColumnHelper, type SortingState } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import {
  CabBadge,
  CabCoverageBadge,
  DataTable,
  DataTablePercentCell,
  DataTableStatusCell,
  DataTableValueCell,
} from "@/design-system";
import { formatDate, formatPercent, formatUsd } from "@/i18n/formatters";
import type { DepositSummaryRowViewModel } from "@/features/deposits/deposits.mappers";
import type {
  DepositsSortDirection,
  DepositsSortField,
  DepositSummaryStatus,
} from "@/features/deposits/deposits.types";
import type { DepositsTableColumnKey } from "@/features/deposits/deposits.viewPrefs";
import { PositionLabelCell } from "@/features/deposits/components/PositionLabelCell";

const columnHelper = createColumnHelper<DepositSummaryRowViewModel>();

function toneForStatus(status: DepositSummaryStatus) {
  switch (status) {
    case "open_active":
      return "success" as const;
    case "open_out_of_range":
      return "warning" as const;
    case "closed":
      return "neutral" as const;
  }
}

function toneForReturn(value: number) {
  if (value > 0) return "positive" as const;
  if (value < 0) return "negative" as const;
  return "neutral" as const;
}

function toneForConfidence(confidence: DepositSummaryRowViewModel["confidence"]) {
  switch (confidence) {
    case "high":
      return "success" as const;
    case "medium":
      return "info" as const;
    case "degraded":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

type DepositsTableProps = {
  items: DepositSummaryRowViewModel[];
  locale: string;
  hiddenColumns: DepositsTableColumnKey[];
  sort: DepositsSortField;
  direction: DepositsSortDirection;
  selectedDepositId?: string | null;
  labels: {
    columns: Record<DepositsTableColumnKey, string>;
    status: Record<DepositSummaryStatus, string>;
    transferIn: { badge: string; tooltip: string };
  };
  onSortChange: (sort: DepositsSortField, direction: DepositsSortDirection) => void;
  onSelectRow: (depositId: string) => void;
};

export function DepositsTable({
  items,
  locale,
  hiddenColumns,
  sort,
  direction,
  selectedDepositId,
  labels,
  onSortChange,
  onSelectRow,
}: DepositsTableProps) {
  const sorting: SortingState = useMemo(
    () => [{ id: sort, desc: direction === "desc" }],
    [sort, direction],
  );

  const columns = useMemo(() => {
    const hidden = new Set<DepositsTableColumnKey>(hiddenColumns);
    const all = [
      columnHelper.display({
        id: "position",
        header: () => labels.columns.position,
        cell: (info) => (
          <PositionLabelCell
            row={info.row.original}
            transferInLabel={labels.transferIn.badge}
            transferInTooltip={labels.transferIn.tooltip}
          />
        ),
      }),
      columnHelper.accessor((row) => row.poolLabel, {
        id: "pool",
        header: () => labels.columns.pool,
        cell: (info) => <span>{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.status, {
        id: "status",
        header: () => labels.columns.status,
        cell: (info) => (
          <DataTableStatusCell
            tone={toneForStatus(info.getValue())}
            label={labels.status[info.getValue()]}
          />
        ),
      }),
      columnHelper.accessor((row) => row.openedAt, {
        id: "opened",
        header: () => labels.columns.opened,
        cell: (info) => {
          const value = info.getValue();
          return <span>{value ? formatDate(value, locale) : "—"}</span>;
        },
      }),
      columnHelper.accessor((row) => row.closedAt, {
        id: "closed",
        header: () => labels.columns.closed,
        cell: (info) => {
          const value = info.getValue();
          return <span>{value ? formatDate(value, locale) : "—"}</span>;
        },
      }),
      columnHelper.accessor((row) => row.openedValueUsd, {
        id: "openedValue",
        header: () => labels.columns.openedValue,
        cell: (info) => <DataTableValueCell primary={formatUsd(info.getValue(), locale)} />,
      }),
      columnHelper.accessor((row) => row.currentValueUsd, {
        id: "currentValue",
        header: () => labels.columns.currentValue,
        cell: (info) => <DataTableValueCell primary={formatUsd(info.getValue(), locale)} />,
      }),
      columnHelper.accessor((row) => row.totalRewardsUsd, {
        id: "totalRewards",
        header: () => labels.columns.totalRewards,
        cell: (info) => <DataTableValueCell primary={formatUsd(info.getValue(), locale)} />,
      }),
      columnHelper.accessor((row) => row.realizedPnlUsd, {
        id: "realizedPnl",
        header: () => labels.columns.realizedPnl,
        cell: (info) => (
          <DataTablePercentCell
            value={formatUsd(info.getValue(), locale)}
            tone={toneForReturn(info.getValue())}
          />
        ),
      }),
      columnHelper.accessor((row) => row.unrealizedPnlUsd, {
        id: "unrealizedPnl",
        header: () => labels.columns.unrealizedPnl,
        cell: (info) => (
          <DataTablePercentCell
            value={formatUsd(info.getValue(), locale)}
            tone={toneForReturn(info.getValue())}
          />
        ),
      }),
      columnHelper.accessor((row) => row.totalReturnUsd, {
        id: "totalReturn",
        header: () => labels.columns.totalReturn,
        cell: (info) => (
          <DataTablePercentCell
            value={formatUsd(info.getValue(), locale)}
            tone={toneForReturn(info.getValue())}
          />
        ),
      }),
      columnHelper.accessor((row) => row.estimatedAnnualizedReturnPct, {
        id: "estApr",
        header: () => labels.columns.estApr,
        cell: (info) => {
          const value = info.getValue();
          return value === null ? (
            <span>—</span>
          ) : (
            <DataTablePercentCell value={formatPercent(value, locale)} tone={toneForReturn(value)} />
          );
        },
      }),
      columnHelper.accessor((row) => row.coverageStatus, {
        id: "coverage",
        header: () => labels.columns.coverage,
        cell: (info) => <CabCoverageBadge state={info.getValue()} label={info.getValue()} />,
      }),
      columnHelper.accessor((row) => row.confidence, {
        id: "confidence",
        header: () => labels.columns.confidence,
        cell: (info) => (
          <CabBadge tone={toneForConfidence(info.getValue())}>{info.getValue()}</CabBadge>
        ),
      }),
    ];

    return all.filter((column) => {
      const key = (column.id ?? "") as DepositsTableColumnKey;
      return !hidden.has(key);
    }) as Array<ColumnDef<DepositSummaryRowViewModel, unknown>>;
  }, [hiddenColumns, labels, locale]);

  return (
    <DataTable
      data={items}
      columns={columns}
      rowKey={(row) => row.depositId}
      sorting={sorting}
      onSortingChange={(updater) => {
        const next = typeof updater === "function" ? updater(sorting) : updater;
        const first = next[0];
        if (!first) return;
        onSortChange(first.id as DepositsSortField, first.desc ? "desc" : "asc");
      }}
      selectedRowId={selectedDepositId ?? null}
      onRowSelect={onSelectRow}
    />
  );
}
