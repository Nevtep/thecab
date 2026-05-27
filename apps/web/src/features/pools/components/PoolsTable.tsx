"use client";

import { createColumnHelper, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import {
  CabCoverageBadge,
  CabStack,
  DataTable,
  DataTablePercentCell,
  DataTableRowActionCell,
  DataTableStackedCell,
  DataTableStatusCell,
  DataTableValueCell,
} from "@/design-system";

import type { PoolsListViewModel } from "@/features/pools/pools.types";

type PoolRow = PoolsListViewModel["items"][number];

const columnHelper = createColumnHelper<PoolRow>();

function toneForStatus(status: PoolsListViewModel["items"][number]["status"]) {
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

function toneForReturn(value: number | null) {
  if (value === null) {
    return "neutral" as const;
  }

  if (value > 0) {
    return "positive" as const;
  }

  if (value < 0) {
    return "negative" as const;
  }

  return "neutral" as const;
}

export function PoolsTable(input: {
  items: PoolsListViewModel["items"];
  selectedPoolId?: string | null;
  labels: {
    open: string;
    pool: string;
    value: string;
    portfolioShare: string;
    performance: string;
    exposure: string;
    latestActivity: string;
    status: string;
    rewards: string;
    inRange: string;
    outOfRange: string;
    unknown: string;
  };
  getCoverageLabel: (coverageStatus: string) => string;
  onSelect: (poolId: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "value", desc: true }]);
  const columns = useMemo(
    () => [
      columnHelper.accessor("label", {
        id: "pool",
        header: () => input.labels.pool,
        cell: ({ getValue, row }) => (
          <DataTableStackedCell
            title={getValue()}
            subtitle={[
              row.original.tokenSymbols.join(" / ") || row.original.poolAddress,
              row.original.feeTierLabel,
            ]
              .filter(Boolean)
              .join(" • ")}
            align="left"
          />
        ),
      }),
      columnHelper.accessor("currentAttributedValueUsd", {
        id: "value",
        header: () => input.labels.value,
        meta: { numeric: true },
        cell: ({ row }) => (
          <DataTableValueCell
            primary={row.original.formattedCurrentAttributedValueUsd}
            secondary={row.original.formattedCapitalInvestedUsd}
          />
        ),
      }),
      columnHelper.accessor("currentAttributedValueUsd", {
        id: "portfolioShare",
        header: () => input.labels.portfolioShare,
        meta: { numeric: true },
        cell: ({ row }) => <DataTablePercentCell value={row.original.formattedPortfolioSharePct} />,
      }),
      columnHelper.accessor("annualizedReturnPct", {
        id: "performance",
        header: () => input.labels.performance,
        meta: { numeric: true },
        sortingFn: (left, right) => {
          const leftValue = left.original.annualizedReturnPct ?? Number.NEGATIVE_INFINITY;
          const rightValue = right.original.annualizedReturnPct ?? Number.NEGATIVE_INFINITY;

          return leftValue - rightValue;
        },
        cell: ({ row }) => (
          <DataTablePercentCell
            value={row.original.formattedAnnualizedReturnPct ?? input.labels.unknown}
            tone={toneForReturn(row.original.annualizedReturnPct)}
          />
        ),
      }),
      columnHelper.accessor("totalRewardsUsd", {
        id: "rewards",
        header: () => input.labels.rewards,
        meta: { numeric: true },
        cell: ({ row }) => <DataTableValueCell primary={row.original.formattedTotalRewardsUsd} />,
      }),
      columnHelper.accessor("exposureMix", {
        id: "exposure",
        header: () => input.labels.exposure,
        cell: ({ row }) => (
          <DataTableStackedCell
            title={row.original.exposureMix.replaceAll("_", " ")}
            subtitle={row.original.strategyLabels[0] ?? undefined}
            align="left"
          />
        ),
      }),
      columnHelper.accessor("latestActivityAt", {
        id: "latestActivity",
        header: () => input.labels.latestActivity,
        sortingFn: (left, right) => {
          const leftValue = left.original.latestActivityAt ? Date.parse(left.original.latestActivityAt) : 0;
          const rightValue = right.original.latestActivityAt ? Date.parse(right.original.latestActivityAt) : 0;

          return leftValue - rightValue;
        },
        cell: ({ row }) => (
          <DataTableStackedCell
            title={row.original.formattedLatestActivityAt ?? input.labels.unknown}
            subtitle={row.original.metricsEstimated ? input.labels.status : undefined}
            align="left"
          />
        ),
      }),
      columnHelper.display({
        id: "status",
        header: () => input.labels.status,
        cell: ({ row }) => (
          <CabStack gap="$2">
            <CabCoverageBadge
              state={row.original.coverageStatus}
              label={input.getCoverageLabel(row.original.coverageStatus)}
            />
            <DataTableStatusCell
              tone={toneForStatus(row.original.status)}
              label={
                row.original.isInRange === true
                  ? input.labels.inRange
                  : row.original.isInRange === false
                    ? input.labels.outOfRange
                    : row.original.status
              }
            />
          </CabStack>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => "",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => (
          <DataTableRowActionCell
            label={input.labels.open}
            tone={input.selectedPoolId === row.original.poolId ? "technical" : "ghost"}
            onPress={() => input.onSelect(row.original.poolId)}
          />
        ),
      }),
    ],
    [input],
  );

  return (
    <DataTable
      columns={columns as ColumnDef<PoolRow, unknown>[]}
      data={input.items}
      rowKey={(row) => row.poolId}
      selectedRowId={input.selectedPoolId}
      onRowSelect={input.onSelect}
      sorting={sorting}
      onSortingChange={setSorting}
      stickyHeader
    />
  );
}