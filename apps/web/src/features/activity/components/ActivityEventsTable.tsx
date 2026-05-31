"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
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
import type { ActivityUrlState, ActivityViewModel } from "@/features/activity/activity.types";

import styles from "@/features/activity/ActivityWorkspace.module.css";

const columnHelper = createColumnHelper<ActivityViewModel["events"]["rows"][number]>();
const pageSizeOptions = [10, 25, 50, 100];

type Props = {
  viewModel: ActivityViewModel;
  state: ActivityUrlState;
  labels: {
    title: string;
    date: string;
    action: string;
    surface: string;
    movement: string;
    value: string;
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
    formatUsd: (value: string | null) => string;
    getAction: (value: string) => string;
    getSurface: (value: string) => string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
    getReason: (value: string) => string;
  };
  loading?: boolean;
  onStateChange: (state: ActivityUrlState) => void;
};

function coverageTone(coverage: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (coverage === "full") return "success";
  if (coverage === "partial") return "warning";
  if (coverage === "excluded" || coverage === "unresolved" || coverage === "unavailable") return "danger";
  return "neutral";
}

function confidenceTone(confidence: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "info";
  if (confidence === "low") return "warning";
  return "danger";
}

function actionTone(action: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (action === "deposit" || action === "claim" || action === "strategy") return "success";
  if (action === "swap" || action === "governance") return "info";
  if (action === "airdrop" || action === "unsupported" || action === "ambiguous") return "warning";
  if (action === "withdraw") return "danger";
  return "neutral";
}

export function ActivityEventsTable({ viewModel, state, labels, loading = false, onStateChange }: Props) {
  const pagination = viewModel.events.pagination;
  const from = pagination.totalRows === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const to = Math.min(pagination.totalRows, pagination.page * pagination.pageSize);
  const columns = useMemo<Array<ColumnDef<ActivityViewModel["events"]["rows"][number], unknown>>>(
    () => {
      const columns = [
      columnHelper.accessor("occurredAt", {
        id: "date",
        header: () => labels.date,
        enableSorting: false,
        cell: ({ getValue }) => <DataTableValueCell primary={labels.formatDateTime(getValue())} align="left" />,
      }),
      columnHelper.accessor("action", {
        id: "action",
        header: () => labels.action,
        enableSorting: false,
        cell: ({ getValue }) => (
          <DataTableStatusCell tone={actionTone(getValue())} label={labels.getAction(getValue())} />
        ),
      }),
      columnHelper.accessor("surface", {
        id: "surface",
        header: () => labels.surface,
        enableSorting: false,
        cell: ({ getValue }) => (
          <CabBadge tone="neutral" size="sm">{labels.getSurface(getValue())}</CabBadge>
        ),
      }),
      columnHelper.display({
        id: "movement",
        header: () => labels.movement,
        enableSorting: false,
        cell: ({ row }) => {
          const primaryLink = row.original.linkedEntities[0] ?? null;
          return (
            <CabStack row alignItems="center" gap="$2" minWidth={0}>
              <CabTokenIcon
                chainId={viewModel.chainId}
                tokenAddress={row.original.primaryTokenAddress}
                symbol={row.original.primaryTokenSymbol}
                size="sm"
                decorative
              />
              <CabStack gap="$1" minWidth={0}>
                <CabText variant="data" fontSize={12} className={styles.mono}>
                  {row.original.summary}
                </CabText>
                {primaryLink ? (
                  <CabText variant="caption" fontSize={11}>
                    {primaryLink.label}
                  </CabText>
                ) : null}
              </CabStack>
            </CabStack>
          );
        },
      }),
      columnHelper.accessor("valueUsd", {
        id: "value",
        header: () => labels.value,
        enableSorting: false,
        meta: { numeric: true },
        cell: ({ getValue }) => <DataTableValueCell primary={labels.formatUsd(getValue())} />,
      }),
      columnHelper.accessor("coverage", {
        id: "coverage",
        header: () => labels.coverage,
        enableSorting: false,
        cell: ({ row, getValue }) => (
          <CabStack gap="$1">
            <CabBadge tone={coverageTone(getValue())} size="sm">{labels.getCoverage(getValue())}</CabBadge>
            {row.original.reasonCodes[0] ? (
              <CabText variant="caption" fontSize={11}>
                {labels.getReason(row.original.reasonCodes[0])}
              </CabText>
            ) : null}
          </CabStack>
        ),
      }),
      columnHelper.accessor("confidence", {
        id: "confidence",
        header: () => labels.confidence,
        enableSorting: false,
        cell: ({ getValue }) => (
          <CabBadge tone={confidenceTone(getValue())} size="sm">{labels.getConfidence(getValue())}</CabBadge>
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
            <CabText variant="mono" fontSize={12}>{""}</CabText>
          ),
      }),
      ];
      return columns as Array<ColumnDef<ActivityViewModel["events"]["rows"][number], unknown>>;
    },
    [labels, viewModel.chainId],
  );

  return (
    <CabStack gap="$2">
      <DataTable
        columns={columns}
        data={viewModel.events.rows}
        rowKey={(row) => row.activityId}
        selectedRowId={state.selectedActivityId ?? viewModel.selectedActivity?.activityId ?? null}
        onRowSelect={(activityId) => onStateChange({ ...state, selectedActivityId: activityId })}
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
        pageSizeOptions={pageSizeOptions}
        loading={loading}
        labels={{
          previous: labels.previous,
          next: labels.next,
          page: labels.page,
          rowsPerPage: labels.rowsPerPage,
          showing: labels.showing,
        }}
        onPageChange={(page) => onStateChange({ ...state, page })}
        onPageSizeChange={(pageSize) => onStateChange({ ...state, pageSize: pageSize as ActivityUrlState["pageSize"], page: 1 })}
      />
    </CabStack>
  );
}
