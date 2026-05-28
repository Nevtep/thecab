"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { CabBadge, DataTable } from "@/design-system";
import { formatUsd } from "@/i18n/formatters";
import type { DepositLifecycleTokenDelta } from "@/server/deposits/deposits.types";

const columnHelper = createColumnHelper<DepositLifecycleTokenDelta>();

type DepositEventMovementsTableProps = {
  items: DepositLifecycleTokenDelta[];
  locale: string;
  labels: {
    token: string;
    direction: string;
    amount: string;
    usdValue: string;
    priceSource: string;
    priceSourceValues: {
      event: string;
      pricePointFallback: string;
      unavailable: string;
    };
  };
};

function toneForPriceSource(value: DepositLifecycleTokenDelta["priceSource"]) {
  switch (value) {
    case "event":
      return "success" as const;
    case "pricePointFallback":
      return "warning" as const;
    case "unavailable":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function labelForPriceSource(
  value: DepositLifecycleTokenDelta["priceSource"],
  labels: DepositEventMovementsTableProps["labels"]["priceSourceValues"],
) {
  switch (value) {
    case "event":
      return labels.event;
    case "pricePointFallback":
      return labels.pricePointFallback;
    case "unavailable":
      return labels.unavailable;
    default:
      return "—";
  }
}

export function DepositEventMovementsTable(input: DepositEventMovementsTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.symbol ?? row.tokenAddress ?? "—", {
        id: "token",
        header: () => input.labels.token,
        cell: (info) => <span>{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.direction, {
        id: "direction",
        header: () => input.labels.direction,
        cell: (info) => <span>{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.amountFormatted ?? row.amountRaw, {
        id: "amount",
        header: () => input.labels.amount,
        cell: (info) => <span>{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.usdValue, {
        id: "usdValue",
        header: () => input.labels.usdValue,
        cell: (info) => {
          const usdValue = info.getValue();
          return <span>{usdValue === null ? "—" : formatUsd(usdValue, input.locale)}</span>;
        },
      }),
      columnHelper.accessor((row) => row.priceSource, {
        id: "priceSource",
        header: () => input.labels.priceSource,
        cell: (info) => {
          const value = info.getValue();
          return value ? (
            <CabBadge tone={toneForPriceSource(value)}>{labelForPriceSource(value, input.labels.priceSourceValues)}</CabBadge>
          ) : <span>—</span>;
        },
      }),
    ] as unknown as ColumnDef<DepositLifecycleTokenDelta, unknown>[],
    [input.labels, input.locale],
  );

  return (
    <DataTable
      data={input.items}
      columns={columns}
      rowKey={(row) => `${row.tokenAddress ?? "unknown"}-${row.direction}-${row.amountRaw}`}
      stickyHeader={false}
    />
  );
}