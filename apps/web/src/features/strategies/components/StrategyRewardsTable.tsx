"use client";

import { useRouter } from "next/navigation";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import {
  CabBadge,
  CabButton,
  CabStack,
  CabText,
  CabTxHash,
  DataTable,
  DataTableEmptyState,
  DataTableToolbar,
  DataTableValueCell,
} from "@/design-system";
import { buildRewardsHref } from "@/features/rewards/rewards.navigation";
import { getStrategyTxExplorerUrl } from "@/features/strategies/strategies.mappers";
import type { StrategyRewardView } from "@/features/strategies/strategies.types";
import { formatDateTime, formatUsd } from "@/i18n/formatters";

const columnHelper = createColumnHelper<StrategyRewardView>();

type StrategyRewardsTableProps = {
  chainId: number;
  locale: string;
  rewards: StrategyRewardView[];
  labels: {
    title: string;
    empty: string;
    token: string;
    amount: string;
    value: string;
    claimedAt: string;
    transaction: string;
    status: string;
    resolved: string;
    unresolved: string;
    openRewards?: string;
  };
};

function formatAmount(reward: StrategyRewardView) {
  const amount = reward.amountFormatted ?? reward.amountRaw ?? "—";
  return reward.tokenSymbol ? `${amount} ${reward.tokenSymbol}` : amount;
}

export function StrategyRewardsTable({ chainId, labels, locale, rewards }: StrategyRewardsTableProps) {
  const router = useRouter();
  const columns = useMemo<Array<ColumnDef<StrategyRewardView, unknown>>>(() => {
    const all = [
      columnHelper.display({
        id: "token",
        header: () => labels.token,
        enableSorting: false,
        cell: ({ row }) => (
          <CabText variant="data" fontSize={12}>
            {row.original.tokenSymbol ?? row.original.tokenAddress ?? "—"}
          </CabText>
        ),
      }),
      columnHelper.display({
        id: "amount",
        header: () => labels.amount,
        enableSorting: false,
        meta: { numeric: true },
        cell: ({ row }) => <DataTableValueCell primary={formatAmount(row.original)} />,
      }),
      columnHelper.accessor("amountUsd", {
        id: "value",
        header: () => labels.value,
        enableSorting: false,
        meta: { numeric: true },
        cell: ({ getValue }) => {
          const value = getValue();
          return <DataTableValueCell primary={value === null ? "—" : formatUsd(value, locale)} />;
        },
      }),
      columnHelper.accessor("claimedAt", {
        id: "claimedAt",
        header: () => labels.claimedAt,
        enableSorting: false,
        cell: ({ getValue }) => (
          <CabText variant="data" fontSize={12}>
            {getValue() ? formatDateTime(getValue() as string, locale) : "—"}
          </CabText>
        ),
      }),
      columnHelper.display({
        id: "transaction",
        header: () => labels.transaction,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.txHash ? (
            <CabTxHash hash={row.original.txHash} href={getStrategyTxExplorerUrl(chainId, row.original.txHash)} />
          ) : (
            <CabText variant="data" fontSize={12}>—</CabText>
          ),
      }),
      columnHelper.display({
        id: "status",
        header: () => labels.status,
        enableSorting: false,
        cell: ({ row }) => (
          <CabStack row alignItems="center" gap="$2" flexWrap="wrap">
            <CabBadge tone={row.original.resolutionStatus === "resolved" ? "success" : "warning"} size="sm">
              {row.original.resolutionStatus === "resolved" ? labels.resolved : labels.unresolved}
            </CabBadge>
            {labels.openRewards ? (
              <CabButton
                tone="ghost"
                controlSize="sm"
                onPress={() => router.push(buildRewardsHref({ selectedRewardEventId: row.original.id }))}
              >
                {labels.openRewards}
              </CabButton>
            ) : null}
          </CabStack>
        ),
      }),
    ];

    return all as Array<ColumnDef<StrategyRewardView, unknown>>;
  }, [chainId, labels, locale, router]);

  return (
    <DataTable
      columns={columns}
      data={rewards}
      rowKey={(row) => row.id}
      stickyHeader
      toolbar={<DataTableToolbar title={labels.title} />}
      emptyState={<DataTableEmptyState title={labels.title} description={labels.empty} />}
    />
  );
}
