"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type OnChangeFn,
  type RowData,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState, type ReactNode } from "react";

import { DataTableEmptyState } from "@/design-system/data-display/DataTableEmptyState.component";
import { DataTableHeader } from "@/design-system/data-display/DataTableHeader.component";
import { DataTableLoadingState } from "@/design-system/data-display/DataTableLoadingState.component";
import { DataTableRow } from "@/design-system/data-display/DataTableRow.component";
import type { DataTableCellAlignment } from "@/design-system/data-display/DataTableCell.component";
import { CabCard } from "@/design-system/primitives/CabCard";

import styles from "@/design-system/data-display/DataTable.module.css";

declare module "@tanstack/react-table" {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: DataTableCellAlignment;
    numeric?: boolean;
    headerClassName?: string;
    cellClassName?: string;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

export type DataTableProps<TData extends RowData> = {
  columns: Array<ColumnDef<TData, unknown>>;
  data: TData[];
  rowKey: (row: TData) => string;
  selectedRowId?: string | null;
  onRowSelect?: (rowId: string) => void;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  loading?: boolean;
  loadingState?: ReactNode;
  emptyState?: ReactNode;
  toolbar?: ReactNode;
  stickyHeader?: boolean;
  getRowCanSelect?: (row: TData) => boolean;
};

export function DataTable<TData extends RowData>({
  columns,
  data,
  rowKey,
  selectedRowId,
  onRowSelect,
  sorting,
  onSortingChange,
  loading = false,
  loadingState,
  emptyState,
  toolbar,
  stickyHeader = true,
  getRowCanSelect,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const resolvedSorting = sorting ?? internalSorting;
  const handleSortingChange = onSortingChange ?? setInternalSorting;

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => rowKey(row),
    state: {
      sorting: resolvedSorting,
    },
    onSortingChange: handleSortingChange,
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const resolvedLoadingState = loadingState ?? <DataTableLoadingState />;
  const resolvedEmptyState = emptyState ?? <DataTableEmptyState />;

  return (
    <CabCard density="compact" padding={0} gap={0}>
      {toolbar}
      {loading && isEmpty ? (
        resolvedLoadingState
      ) : isEmpty ? (
        resolvedEmptyState
      ) : (
        <div className={styles.tableShell}>
          <div className={styles.scrollArea}>
            <table className={styles.table}>
              <DataTableHeader table={table} stickyHeader={stickyHeader} />
              <tbody>
                {rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    row={row}
                    selected={selectedRowId === row.id}
                    selectable={getRowCanSelect ? getRowCanSelect(row.original) : Boolean(onRowSelect)}
                    onSelect={onRowSelect}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {loading ? <div className={styles.loadingOverlay}>{resolvedLoadingState}</div> : null}
        </div>
      )}
    </CabCard>
  );
}