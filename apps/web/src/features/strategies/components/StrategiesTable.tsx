"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import {
  CabBadge,
  DataTable,
  DataTablePercentCell,
  DataTableStatusCell,
  DataTableValueCell,
} from "@/design-system";
import { StrategyIdentityCell } from "@/features/strategies/components/StrategyIdentityCell";
import type { StrategyRowViewModel } from "@/features/strategies/strategies.mappers";

const columnHelper = createColumnHelper<StrategyRowViewModel>();

type StrategiesTableProps = {
  items: StrategyRowViewModel[];
  loading?: boolean;
  labels: {
    strategy: string;
    status: string;
    currentValue: string;
    shares: string;
    rewards: string;
    result: string;
    apr: string;
    coverage: string;
  };
  getCoverageLabel: (coverage: StrategyRowViewModel["coverageStatus"]) => string;
  onSelect: (strategyExposureId: string) => void;
};

function returnTone(sign: StrategyRowViewModel["totalReturnSign"]) {
  if (sign === "positive") return "positive" as const;
  if (sign === "negative") return "negative" as const;
  return "neutral" as const;
}

export function StrategiesTable({ items, loading = false, labels, getCoverageLabel, onSelect }: StrategiesTableProps) {
  const selectedRowId = items.find((item) => item.isSelected)?.strategyExposureId ?? null;
  const columns = useMemo<Array<ColumnDef<StrategyRowViewModel, unknown>>>(() => {
    const all = [
      columnHelper.display({
        id: "strategy",
        header: () => labels.strategy,
        cell: ({ row }) => <StrategyIdentityCell item={row.original} />,
      }),
      columnHelper.display({
        id: "status",
        header: () => labels.status,
        cell: ({ row }) => (
          <DataTableStatusCell
            tone={row.original.status === "active" ? "success" : "neutral"}
            label={row.original.status}
          />
        ),
      }),
      columnHelper.accessor("currentEstimatedValueUsd", {
        id: "currentValue",
        header: () => labels.currentValue,
        meta: { numeric: true },
        cell: ({ row }) => <DataTableValueCell primary={row.original.formattedCurrentValue} />,
      }),
      columnHelper.display({
        id: "shares",
        header: () => labels.shares,
        meta: { numeric: true },
        cell: ({ row }) => (
          <DataTableValueCell
            primary={`${row.original.currentSharesRaw} ${row.original.shareSymbol ?? ""}`.trim()}
          />
        ),
      }),
      columnHelper.accessor("totalRewardsUsd", {
        id: "rewards",
        header: () => labels.rewards,
        meta: { numeric: true },
        cell: ({ row }) => <DataTableValueCell primary={row.original.formattedRewards} />,
      }),
      columnHelper.accessor("totalReturnUsd", {
        id: "result",
        header: () => labels.result,
        meta: { numeric: true },
        cell: ({ row }) => (
          <DataTablePercentCell
            value={row.original.formattedTotalReturn}
            tone={returnTone(row.original.totalReturnSign)}
          />
        ),
      }),
      columnHelper.accessor("estimatedAnnualizedReturnPct", {
        id: "apr",
        header: () => labels.apr,
        meta: { numeric: true },
        cell: ({ row }) => (
          <DataTablePercentCell
            value={row.original.formattedApr}
            tone={returnTone(row.original.totalReturnSign)}
          />
        ),
      }),
      columnHelper.display({
        id: "coverage",
        header: () => labels.coverage,
        cell: ({ row }) => (
          <CabBadge size="sm" tone={row.original.coverageStatus === "full" ? "success" : "warning"}>
            {getCoverageLabel(row.original.coverageStatus)}
          </CabBadge>
        ),
      }),
    ];

    return all as Array<ColumnDef<StrategyRowViewModel, unknown>>;
  }, [getCoverageLabel, labels, onSelect]);

  return (
    <DataTable
      columns={columns}
      data={items}
      rowKey={(row) => row.strategyExposureId}
      selectedRowId={selectedRowId}
      onRowSelect={onSelect}
      stickyHeader
      loading={loading}
    />
  );
}
