"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import {
  CabBox,
  CabStack,
  CabText,
  CabTokenIcon,
  DataTable,
  DataTableEmptyState,
  DataTablePagination,
  DataTableStackedCell,
  DataTableStatusCell,
  DataTableValueCell,
} from "@/design-system";
import type { GovernanceUrlState, GovernanceViewModel } from "@/features/governance/governance.types";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type RewardRow = GovernanceViewModel["rewards"]["rows"][number];

type Props = {
  viewModel: GovernanceViewModel;
  state: GovernanceUrlState;
  loading?: boolean;
  labels: {
    title: string;
    date: string;
    rewardType: string;
    token: string;
    amount: string;
    value: string;
    epoch: string;
    pool: string;
    coverage: string;
    confidence: string;
    previous: string;
    next: string;
    page: (page: number, totalPages: number) => string;
    rowsPerPage: string;
    showing: (from: number, to: number, total: number) => string;
    emptyTitle: string;
    emptyDescription: string;
    getRewardType: (value: string) => string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
    formatDateTime: (value: string | null) => string;
    formatAmount: (value: string | null) => string;
    formatUsd: (value: string | null) => string;
  };
  onStateChange: (state: GovernanceUrlState) => void;
};

function toneForCoverage(coverage: string) {
  if (coverage === "full") return "success" as const;
  if (coverage === "partial") return "warning" as const;
  if (coverage === "excluded" || coverage === "unsupported") return "danger" as const;
  return "neutral" as const;
}

function toneForConfidence(confidence: string) {
  if (confidence === "high") return "success" as const;
  if (confidence === "medium") return "warning" as const;
  if (confidence === "low") return "danger" as const;
  return "neutral" as const;
}

export function GovernanceRewardsTable({ viewModel, state, labels, loading = false, onStateChange }: Props) {
  const columns = useMemo<Array<ColumnDef<RewardRow, unknown>>>(() => [
    {
      id: "claimedAt",
      header: labels.date,
      cell: ({ row }) => (
        <DataTableValueCell
          primary={labels.formatDateTime(row.original.claimedAt)}
          secondary={row.original.context.label}
          align="left"
        />
      ),
    },
    {
      id: "rewardType",
      header: labels.rewardType,
      cell: ({ row }) => (
        <DataTableStatusCell label={labels.getRewardType(row.original.rewardType)} tone="info" variant="emphasis" />
      ),
    },
    {
      id: "token",
      header: labels.token,
      cell: ({ row }) => (
        <CabStack row alignItems="center" gap="$2">
          <CabTokenIcon
            chainId={viewModel.chainId}
            tokenAddress={row.original.token.address}
            symbol={row.original.token.symbol}
            size="sm"
          />
          <CabText variant="label" fontSize={12}>{row.original.token.symbol}</CabText>
        </CabStack>
      ),
    },
    {
      id: "amount",
      header: labels.amount,
      meta: { numeric: true },
      cell: ({ row }) => <DataTableValueCell primary={labels.formatAmount(row.original.amount)} />,
    },
    {
      id: "value",
      header: labels.value,
      meta: { numeric: true },
      cell: ({ row }) => <DataTableValueCell primary={labels.formatUsd(row.original.valueUsdAtClaim)} />,
    },
    {
      id: "epoch",
      header: labels.epoch,
      cell: ({ row }) => (
        <DataTableStackedCell
          title={row.original.epochId ? `Epoch ${row.original.epochId}` : "n/a"}
          subtitle={row.original.pool?.label ?? labels.pool}
        />
      ),
    },
    {
      id: "coverage",
      header: labels.coverage,
      cell: ({ row }) => (
        <DataTableStatusCell
          label={labels.getCoverage(row.original.coverageState)}
          tone={toneForCoverage(row.original.coverageState)}
        />
      ),
    },
    {
      id: "confidence",
      header: labels.confidence,
      cell: ({ row }) => (
        <DataTableStatusCell
          label={labels.getConfidence(row.original.confidence)}
          tone={toneForConfidence(row.original.confidence)}
        />
      ),
    },
  ], [labels, viewModel.chainId]);

  const pagination = viewModel.rewards.pagination;
  const selectedId = state.selectedKind === "reward" ? state.selectedGovernanceId : null;

  return (
    <CabStack gap="$2">
      <DataTable
        columns={columns}
        data={viewModel.rewards.rows}
        rowKey={(row) => row.governanceRewardId}
        selectedRowId={selectedId}
        onRowSelect={(rowId) => onStateChange({ ...state, selectedKind: "reward", selectedGovernanceId: rowId })}
        loading={loading}
        emptyState={<DataTableEmptyState title={labels.emptyTitle} description={labels.emptyDescription} />}
        toolbar={
          <CabStack row alignItems="center" justifyContent="space-between" gap="$3" padding="$3">
            <CabText variant="label">{labels.title}</CabText>
            <CabText variant="caption" className={styles.mono}>
              {viewModel.rewards.pagination.totalRows}
            </CabText>
          </CabStack>
        }
      />
      <CabBox className={styles.tableFooter}>
        <DataTablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalRows={pagination.totalRows}
          totalPages={pagination.totalPages}
          pageSizeOptions={[10, 25, 50]}
          labels={labels}
          loading={loading}
          onPageChange={(page) => onStateChange({ ...state, page })}
          onPageSizeChange={(pageSize) => onStateChange({ ...state, page: 1, pageSize: pageSize as 10 | 25 | 50 })}
        />
      </CabBox>
    </CabStack>
  );
}
