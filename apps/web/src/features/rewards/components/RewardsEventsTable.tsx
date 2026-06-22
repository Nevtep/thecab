"use client";

import { createColumnHelper, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useMemo } from "react";

import {
  CabBadge,
  CabStack,
  CabText,
  CabTokenIcon,
  CabTxHash,
  DataTable,
  DataTableEmptyState,
  DataTablePagination,
  DataTableStatusCell,
  DataTableToolbar,
  DataTableValueCell,
} from "@/design-system";
import { REWARDS_PAGE_SIZE_OPTIONS } from "@/features/rewards/rewards.filters";
import type { RewardEventRow, RewardsUrlState, RewardsViewModel } from "@/features/rewards/rewards.types";

import styles from "@/features/rewards/RewardsWorkspace.module.css";

const columnHelper = createColumnHelper<RewardEventRow>();

type Props = {
  viewModel: RewardsViewModel;
  state: RewardsUrlState;
  labels: {
    title: string;
    date: string;
    token: string;
    amount: string;
    value: string;
    owner: string;
    linkedEntity: string;
    pool: string;
    rewardType: string;
    poolContribution: string;
    coverage: string;
    confidence: string;
    tx: string;
    previous: string;
    next: string;
    page: (page: number, totalPages: number) => string;
    rowsPerPage: string;
    showing: (from: number, to: number, total: number) => string;
    emptyTitle: string;
    emptyDescription: string;
    formatDateTime: (value: string) => string;
    getCoverage: (coverage: string) => string;
    getConfidence: (confidence: string) => string;
    getSource: (source: string) => string;
  };
  loading?: boolean;
  onStateChange: (state: RewardsUrlState) => void;
};

function coverageTone(coverage: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (coverage === "full") return "success";
  if (coverage === "partial") return "warning";
  if (coverage === "unresolved" || coverage === "excluded") return "danger";
  return "neutral";
}

function ownerLabel(row: RewardEventRow, labels: Props["labels"]) {
  if (row.owner.status === "manual_deposit") return labels.getSource("manualDeposit");
  if (row.owner.status === "strategy") return labels.getSource("strategy");
  return labels.getSource(row.owner.status);
}

function sortKeyToColumnId(key: RewardsUrlState["sort"]["key"]) {
  if (key === "occurredAt") return "date";
  if (key === "valueUsd") return "value";
  if (key === "tokenAmount") return "amount";
  if (key === "source") return "owner";
  return key;
}

function columnIdToSortKey(id: string): RewardsUrlState["sort"]["key"] {
  if (id === "date") return "occurredAt";
  if (id === "value") return "valueUsd";
  if (id === "amount") return "tokenAmount";
  if (id === "owner") return "owner";
  if (id === "coverage") return "coverage";
  return "occurredAt";
}

export function RewardsEventsTable({ viewModel, state, labels, loading = false, onStateChange }: Props) {
  const pagination = viewModel.events.pagination;
  const from = pagination.totalRows === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const to = Math.min(pagination.totalRows, pagination.page * pagination.pageSize);
  const sorting: SortingState = [{
    id: sortKeyToColumnId(state.sort.key),
    desc: state.sort.direction === "desc",
  }];
  function handleSortingChange(updater: SortingState | ((old: SortingState) => SortingState)) {
    const nextSorting = typeof updater === "function" ? updater(sorting) : updater;
    const first = nextSorting[0];
    if (!first) return;
    onStateChange({
      ...state,
      selectedRewardEventId: null,
      sort: {
        key: columnIdToSortKey(first.id),
        direction: first.desc ? "desc" : "asc",
      },
      page: 1,
    });
  }
  const columns = useMemo<Array<ColumnDef<RewardEventRow, unknown>>>(
    () => {
      const all = [
        columnHelper.accessor("occurredAt", {
          id: "date",
          header: () => labels.date,
          meta: { numeric: true },
          cell: ({ getValue }) => (
            <DataTableValueCell primary={labels.formatDateTime(getValue())} align="left" />
          ),
        }),
        columnHelper.display({
          id: "token",
          header: () => labels.token,
          enableSorting: false,
          cell: ({ row }) => (
            <CabStack row alignItems="center" gap="$2" minWidth={0}>
              <CabTokenIcon
                chainId={viewModel.chainId}
                tokenAddress={row.original.token.address}
                symbol={row.original.token.symbol}
                size="sm"
                decorative
              />
              <CabText variant="data" fontSize={12}>
                {row.original.token.symbol ?? row.original.token.address ?? ""}
              </CabText>
            </CabStack>
          ),
        }),
        columnHelper.accessor("tokenAmount", {
          id: "amount",
          header: () => labels.amount,
          meta: { numeric: true },
          cell: ({ getValue }) => <DataTableValueCell primary={getValue() ?? ""} />,
        }),
        columnHelper.accessor("usdValueAtClaim", {
          id: "value",
          header: () => labels.value,
          meta: { numeric: true },
          cell: ({ getValue }) => <DataTableValueCell primary={getValue() ?? ""} />,
        }),
        columnHelper.display({
          id: "owner",
          header: () => labels.owner,
          cell: ({ row }) => (
            <DataTableStatusCell
              tone={row.original.owner.status === "unresolved" ? "warning" : "info"}
              label={ownerLabel(row.original, labels)}
            />
          ),
        }),
        columnHelper.display({
          id: "linkedEntity",
          header: () => labels.linkedEntity,
          enableSorting: false,
          cell: ({ row }) => (
            <CabText variant="data" fontSize={12} className={styles.mono}>
              {row.original.owner.entityLabel ?? ""}
            </CabText>
          ),
        }),
        columnHelper.display({
          id: "pool",
          header: () => labels.pool,
          enableSorting: false,
          cell: ({ row }) => (
            <CabText variant="data" fontSize={12}>
              {row.original.poolContribution.poolLabel ?? ""}
            </CabText>
          ),
        }),
        columnHelper.accessor("rewardType", {
          id: "rewardType",
          header: () => labels.rewardType,
          enableSorting: false,
          cell: ({ getValue }) => (
            <CabText variant="data" fontSize={12}>
              {getValue()}
            </CabText>
          ),
        }),
        columnHelper.display({
          id: "poolContribution",
          header: () => labels.poolContribution,
          enableSorting: false,
          cell: ({ row }) => (
            <CabBadge tone={row.original.poolContribution.status === "contributes" ? "success" : "neutral"} size="sm">
              {row.original.poolContribution.status}
            </CabBadge>
          ),
        }),
        columnHelper.accessor("coverageState", {
          id: "coverage",
          header: () => labels.coverage,
          cell: ({ getValue }) => (
            <CabBadge tone={coverageTone(getValue())} size="sm">
              {labels.getCoverage(getValue())}
            </CabBadge>
          ),
        }),
        columnHelper.accessor("confidence", {
          id: "confidence",
          header: () => labels.confidence,
          enableSorting: false,
          cell: ({ row }) => (
            <CabStack row alignItems="center" gap="$2">
              <CabText variant="data" fontSize={12} className={styles.numeric}>
                {row.original.confidenceDots}
              </CabText>
              <CabText variant="data" fontSize={12}>
                {labels.getConfidence(row.original.confidence)}
              </CabText>
            </CabStack>
          ),
        }),
        columnHelper.display({
          id: "tx",
          header: () => labels.tx,
          enableSorting: false,
          cell: ({ row }) =>
            row.original.txHash ? (
              <CabTxHash hash={row.original.txHash} href={row.original.externalTxUrl} />
            ) : (
              <CabText variant="data" fontSize={12} className={styles.mono}>
                {""}
              </CabText>
            ),
        }),
      ];

      return all as Array<ColumnDef<RewardEventRow, unknown>>;
    },
    [labels, viewModel.chainId],
  );

  return (
    <CabStack gap="$2">
      <DataTable
        columns={columns}
        data={viewModel.events.rows}
        rowKey={(row) => row.rewardEventId}
        selectedRowId={state.selectedRewardEventId ?? viewModel.selectedReward?.rewardEventId ?? null}
        onRowSelect={(rewardEventId) => onStateChange({ ...state, selectedRewardEventId: rewardEventId })}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        stickyHeader
        loading={loading}
        toolbar={
          <DataTableToolbar
            title={labels.title}
            description={labels.showing(from, to, pagination.totalRows)}
          />
        }
        emptyState={
          <DataTableEmptyState
            title={labels.emptyTitle}
            description={labels.emptyDescription}
          />
        }
      />
      <DataTablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalRows={pagination.totalRows}
        totalPages={pagination.totalPages}
        pageSizeOptions={REWARDS_PAGE_SIZE_OPTIONS}
        loading={loading}
        labels={{
          previous: labels.previous,
          next: labels.next,
          page: labels.page,
          rowsPerPage: labels.rowsPerPage,
          showing: labels.showing,
        }}
        onPageChange={(page) => onStateChange({ ...state, selectedRewardEventId: null, page })}
        onPageSizeChange={(pageSize) => onStateChange({ ...state, selectedRewardEventId: null, pageSize: pageSize as RewardsUrlState["pageSize"], page: 1 })}
      />
    </CabStack>
  );
}
