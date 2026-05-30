"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import {
  CabBadge,
  CabButton,
  CabStack,
  CabText,
  CabTokenIcon,
  CabTxHash,
  DataTable,
  DataTableEmptyState,
  DataTableStatusCell,
  DataTableToolbar,
  DataTableValueCell,
} from "@/design-system";
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
    showing: (from: number, to: number, total: number) => string;
    emptyTitle: string;
    emptyDescription: string;
    formatDateTime: (value: string) => string;
    getCoverage: (coverage: string) => string;
    getConfidence: (confidence: string) => string;
    getSource: (source: string) => string;
  };
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

export function RewardsEventsTable({ viewModel, state, labels, onStateChange }: Props) {
  const pagination = viewModel.events.pagination;
  const from = pagination.totalRows === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const to = Math.min(pagination.totalRows, pagination.page * pagination.pageSize);
  const columns = useMemo<Array<ColumnDef<RewardEventRow, unknown>>>(
    () => {
      const all = [
        columnHelper.accessor("occurredAt", {
          id: "date",
          header: () => labels.date,
          enableSorting: false,
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
          enableSorting: false,
          meta: { numeric: true },
          cell: ({ getValue }) => <DataTableValueCell primary={getValue() ?? ""} />,
        }),
        columnHelper.accessor("usdValueAtClaim", {
          id: "value",
          header: () => labels.value,
          enableSorting: false,
          meta: { numeric: true },
          cell: ({ getValue }) => <DataTableValueCell primary={getValue() ?? ""} />,
        }),
        columnHelper.display({
          id: "owner",
          header: () => labels.owner,
          enableSorting: false,
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
          enableSorting: false,
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
        selectedRowId={viewModel.selectedReward?.rewardEventId ?? null}
        onRowSelect={(rewardEventId) => onStateChange({ ...state, selectedRewardEventId: rewardEventId })}
        stickyHeader
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
      <CabStack row className={styles.pagination}>
        <CabButton
          tone="ghost"
          controlSize="sm"
          disabled={state.page <= 1}
          onPress={() => onStateChange({ ...state, page: Math.max(1, state.page - 1) })}
        >
          {labels.previous}
        </CabButton>
        <CabText className={styles.numeric} fontSize={12}>
          {pagination.page} / {pagination.totalPages}
        </CabText>
        <CabButton
          tone="ghost"
          controlSize="sm"
          disabled={state.page >= pagination.totalPages}
          onPress={() => onStateChange({ ...state, page: state.page + 1 })}
        >
          {labels.next}
        </CabButton>
      </CabStack>
    </CabStack>
  );
}
