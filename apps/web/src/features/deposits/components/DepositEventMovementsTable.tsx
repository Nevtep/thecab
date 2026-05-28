"use client";

import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { CabBadge, DataTable } from "@/design-system";
import type { DepositLifecycleTokenDeltaViewModel } from "@/features/deposits/deposits.mappers";

const columnHelper = createColumnHelper<DepositLifecycleTokenDeltaViewModel>();

type DepositEventMovementsTableProps = {
  items: DepositLifecycleTokenDeltaViewModel[];
  labels: {
    token: string;
    direction: string;
    amount: string;
    usdValue: string;
    priceSource: string;
  };
};

export function DepositEventMovementsTable(input: DepositEventMovementsTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.tokenLabel, {
        id: "token",
        header: () => input.labels.token,
        cell: (info) => <span>{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.directionLabel, {
        id: "direction",
        header: () => input.labels.direction,
        cell: (info) => <span>{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.amountLabel, {
        id: "amount",
        header: () => input.labels.amount,
        cell: (info) => <span>{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.usdValueLabel, {
        id: "usdValue",
        header: () => input.labels.usdValue,
        cell: (info) => <span>{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.priceSourceLabel, {
        id: "priceSource",
        header: () => input.labels.priceSource,
        cell: (info) => {
          const value = info.getValue();
          return value ? (
            <CabBadge tone={info.row.original.priceSourceTone ?? "neutral"}>{value}</CabBadge>
          ) : <span>—</span>;
        },
      }),
    ] as unknown as ColumnDef<DepositLifecycleTokenDeltaViewModel, unknown>[],
    [input.labels],
  );

  return (
    <DataTable
      data={input.items}
      columns={columns}
      rowKey={(row) => row.key}
      stickyHeader={false}
    />
  );
}