"use client";

import { createColumnHelper, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useMemo, useState, type MouseEvent } from "react";

import {
  CabBadge,
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
type ExpandedComposition = NonNullable<PoolsExpandedBreakdown>;
type CompositionRow = ExpandedComposition["manualDeposits"][number] | ExpandedComposition["automatedStrategies"][number];

const columnHelper = createColumnHelper<PoolRow>();
const compositionColumnHelper = createColumnHelper<CompositionRow>();

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

function toneForRangeState(state: CompositionRow["rangeState"]) {
  switch (state) {
    case "active":
      return "success" as const;
    case "inactive":
      return "warning" as const;
    case "managed":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

function toneForStakingState(state: CompositionRow["stakingState"]) {
  switch (state) {
    case "staked":
      return "success" as const;
    case "unstaked":
      return "warning" as const;
    case "closed":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

function getTypeLabel(type: CompositionRow["type"], labels: PoolsTableProps["labels"]["composition"]) {
  return type === "manual" ? labels.typeManual : labels.typeAutomated;
}

function getRangeLabel(state: CompositionRow["rangeState"], labels: PoolsTableProps["labels"]["composition"]) {
  switch (state) {
    case "active":
      return labels.inRange;
    case "inactive":
      return labels.outOfRange;
    case "managed":
      return labels.managedAutomatically;
    default:
      return labels.rangeUnknown;
  }
}

function getStakingLabel(state: CompositionRow["stakingState"], labels: PoolsTableProps["labels"]["composition"]) {
  switch (state) {
    case "staked":
      return labels.staked;
    case "unstaked":
      return labels.unstaked;
    case "closed":
      return labels.closed;
    default:
      return labels.unavailable;
  }
}

type PoolsTableProps = {
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
    composition: {
      manualDeposits: string;
      automatedStrategies: string;
      loading: string;
      unavailable: string;
      columns: {
        id: string;
        type: string;
        range: string;
        staking: string;
        underlying: string;
        apr: string;
      };
      typeManual: string;
      typeAutomated: string;
      staked: string;
      unstaked: string;
      closed: string;
      managedAutomatically: string;
      inRange: string;
      outOfRange: string;
      rangeUnknown: string;
    };
  };
  getCoverageLabel: (coverageStatus: string) => string;
  onSelect: (poolId: string) => void;
};

function CompositionSection(input: {
  title: string;
  rows: CompositionRow[];
  labels: PoolsTableProps["labels"]["composition"];
}) {
  const columns = useMemo<Array<ColumnDef<CompositionRow, unknown>>>(() => [
    compositionColumnHelper.display({
      id: "id",
      header: () => input.labels.columns.id,
      cell: ({ row }) => (
        <DataTableStackedCell
          title={row.original.idLabel}
          subtitle={row.original.idMeta ?? undefined}
          align="left"
        />
      ),
    }),
    compositionColumnHelper.display({
      id: "type",
      header: () => input.labels.columns.type,
      cell: ({ row }) => (
        <CabBadge tone={row.original.type === "manual" ? "neutral" : "info"} size="sm">
          {getTypeLabel(row.original.type, input.labels)}
        </CabBadge>
      ),
    }),
    compositionColumnHelper.display({
      id: "range",
      header: () => input.labels.columns.range,
      cell: ({ row }) => (
        <DataTableValueCell
          primary={
            <CabBadge tone={toneForRangeState(row.original.rangeState)} size="sm">
              {getRangeLabel(row.original.rangeState, input.labels)}
            </CabBadge>
          }
          secondary={row.original.rangeDetail ?? undefined}
          align="left"
        />
      ),
    }),
    compositionColumnHelper.display({
      id: "staking",
      header: () => input.labels.columns.staking,
      cell: ({ row }) => (
        <DataTableStatusCell
          tone={toneForStakingState(row.original.stakingState)}
          label={getStakingLabel(row.original.stakingState, input.labels)}
        />
      ),
    }),
    compositionColumnHelper.display({
      id: "underlying",
      header: () => input.labels.columns.underlying,
      cell: ({ row }) => (
        <DataTableValueCell primary={row.original.underlyingLabel ?? input.labels.unavailable} align="left" />
      ),
    }),
    compositionColumnHelper.display({
      id: "apr",
      header: () => input.labels.columns.apr,
      meta: { numeric: true },
      cell: ({ row }) => (
        <DataTablePercentCell
          value={row.original.aprLabel ?? input.labels.unavailable}
          tone="neutral"
        />
      ),
    }),
  ], [input.labels]);

  if (input.rows.length === 0) {
    return null;
  }

  return (
    <section className={styles.compositionSection}>
      <div className={styles.compositionSectionTitle}>{input.title}</div>
      <DataTable
        columns={columns}
        data={input.rows}
        rowKey={(row) => row.rowId}
        surface="embedded"
        stickyHeader={false}
      />
    </section>
  );
}

export function PoolsTable(input: PoolsTableProps) {
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
          return <div className={styles.compositionState}>{input.labels.composition.loading}</div>;
        }

        if (input.expandedBreakdownErrorCode || !input.expandedBreakdown) {
          return <div className={styles.compositionState}>{input.labels.composition.unavailable}</div>;
        }

        const breakdown = input.expandedBreakdown;
        const hasRows = breakdown.manualDeposits.length > 0 || breakdown.automatedStrategies.length > 0;

        if (!hasRows) {
          return <div className={styles.compositionState}>{input.labels.composition.unavailable}</div>;
        }

        return (
          <div className={styles.composition}>
            <CompositionSection
              title={input.labels.composition.manualDeposits}
              rows={breakdown.manualDeposits}
              labels={input.labels.composition}
            />
            <CompositionSection
              title={input.labels.composition.automatedStrategies}
              rows={breakdown.automatedStrategies}
              labels={input.labels.composition}
            />
          </div>
        );
      }}
    />
  );
}
