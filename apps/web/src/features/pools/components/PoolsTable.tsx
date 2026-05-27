"use client";

import { createColumnHelper, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useMemo, useState, type MouseEvent } from "react";

import {
  CabCoverageBadge,
  CabIcon,
  DataTable,
  DataTablePercentCell,
  DataTableStackedCell,
  DataTableStatusCell,
  DataTableValueCell,
} from "@/design-system";

import type { PoolsExpandedBreakdown } from "@/features/pools/Pools.component";
import type { PoolsListViewModel } from "@/features/pools/pools.types";

import styles from "@/features/pools/components/PoolsTable.module.css";

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
  expandedPoolId: string | null;
  onToggleExpand: (poolId: string) => void;
  expandedBreakdown: PoolsExpandedBreakdown | null;
  expandedBreakdownIsLoading: boolean;
  expandedBreakdownErrorCode: string | null;
  labels: {
    expandRow: string;
    collapseRow: string;
    pool: string;
    value: string;
    portfolioShare: string;
    rewards: string;
    apr: string;
    status: string;
    coverage: string;
    latestActivity: string;
    inRange: string;
    outOfRange: string;
    unknown: string;
    manualExposure: string;
    strategyExposure: string;
    residualExposure: string;
    breakdownLoading: string;
    breakdownUnavailable: string;
    strategyMetaLabel: string;
  };
  getCoverageLabel: (coverageStatus: string) => string;
  onSelect: (poolId: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "value", desc: true }]);
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "expand",
        header: () => "",
        enableSorting: false,
        meta: { align: "center" },
        cell: ({ row }) => {
          const isExpanded = input.expandedPoolId === row.original.poolId;
          const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();

            if (!isExpanded) {
              input.onSelect(row.original.poolId);
            }

            input.onToggleExpand(row.original.poolId);
          };
          return (
            <button
              type="button"
              className={styles.expandToggle}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? input.labels.collapseRow : input.labels.expandRow}
              onClick={handleClick}
            >
              <CabIcon
                name="chevronDown"
                size="sm"
                className={[styles.expandToggleIcon, isExpanded ? styles.expandToggleIconOpen : ""]
                  .filter(Boolean)
                  .join(" ")}
              />
            </button>
          );
        },
      }),
      columnHelper.accessor("label", {
        id: "pool",
        header: () => input.labels.pool,
        cell: ({ getValue, row }) => {
          const pair = row.original.tokenSymbols.length >= 2
            ? `${row.original.tokenSymbols[0]} / ${row.original.tokenSymbols[1]}`
            : null;
          const subtitle = [pair, row.original.feeTierLabel].filter(Boolean).join(" • ");
          return (
            <DataTableStackedCell
              title={getValue()}
              subtitle={subtitle.length > 0 ? subtitle : undefined}
              align="left"
            />
          );
        },
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
      columnHelper.accessor("totalRewardsUsd", {
        id: "rewards",
        header: () => input.labels.rewards,
        meta: { numeric: true },
        cell: ({ row }) => <DataTableValueCell primary={row.original.formattedTotalRewardsUsd} />,
      }),
      columnHelper.accessor("annualizedReturnPct", {
        id: "apr",
        header: () => input.labels.apr,
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
      columnHelper.display({
        id: "status",
        header: () => input.labels.status,
        cell: ({ row }) => (
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
        ),
      }),
      columnHelper.display({
        id: "coverage",
        header: () => input.labels.coverage,
        cell: ({ row }) => (
          <CabCoverageBadge
            state={row.original.coverageStatus}
            label={input.getCoverageLabel(row.original.coverageStatus)}
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
      expandedRowIds={input.expandedPoolId ? [input.expandedPoolId] : []}
      getRowCanExpand={() => true}
      renderExpandedRow={(row) => {
        if (row.poolId !== input.expandedPoolId) {
          return null;
        }

        if (input.expandedBreakdownIsLoading && !input.expandedBreakdown) {
          return <div className={styles.breakdownState}>{input.labels.breakdownLoading}</div>;
        }

        if (input.expandedBreakdownErrorCode || !input.expandedBreakdown) {
          return <div className={styles.breakdownState}>{input.labels.breakdownUnavailable}</div>;
        }

        const breakdown = input.expandedBreakdown;
        const strategyMeta = breakdown.strategyLabels.length > 0
          ? `${input.labels.strategyMetaLabel}: ${breakdown.strategyLabels.join(", ")}`
          : null;

        return (
          <div className={styles.breakdown}>
            <div className={[styles.breakdownItem, styles.breakdownItemManual].join(" ")}>
              <span className={styles.breakdownLabel}>{input.labels.manualExposure}</span>
              <span className={styles.breakdownValue}>{breakdown.manual.formattedCurrentValueUsd}</span>
              <span className={styles.breakdownMeta}>
                {input.getCoverageLabel(breakdown.manual.coverageStatus)}
              </span>
            </div>
            <div className={[styles.breakdownItem, styles.breakdownItemStrategy].join(" ")}>
              <span className={styles.breakdownLabel}>{input.labels.strategyExposure}</span>
              <span className={styles.breakdownValue}>{breakdown.strategy.formattedCurrentValueUsd}</span>
              <span className={styles.breakdownMeta}>
                {strategyMeta ?? input.getCoverageLabel(breakdown.strategy.coverageStatus)}
              </span>
            </div>
            <div className={[styles.breakdownItem, styles.breakdownItemResidual].join(" ")}>
              <span className={styles.breakdownLabel}>{input.labels.residualExposure}</span>
              <span className={styles.breakdownValue}>{breakdown.residual.formattedCurrentValueUsd}</span>
              <span className={styles.breakdownMeta}>
                {input.getCoverageLabel(breakdown.residual.coverageStatus)}
              </span>
            </div>
          </div>
        );
      }}
    />
  );
}