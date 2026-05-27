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
import { Fragment, useState, type ReactNode } from "react";

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
  expandedRowIds?: string[];
  getRowCanExpand?: (row: TData) => boolean;
  renderExpandedRow?: (row: TData) => ReactNode;
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
  expandedRowIds,
  getRowCanExpand,
  renderExpandedRow,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const resolvedSorting = sorting ?? internalSorting;
  const handleSortingChange = onSortingChange ?? setInternalSorting;
  const expandedRowIdSet = new Set(expandedRowIds ?? []);

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
  const visibleColumnCount = table.getVisibleLeafColumns().length;
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
                  <Fragment key={row.id}>
                    <DataTableRow
                      row={row}
                      selected={selectedRowId === row.id}
                      selectable={getRowCanSelect ? getRowCanSelect(row.original) : Boolean(onRowSelect)}
                      expanded={Boolean(
                        renderExpandedRow &&
                        expandedRowIdSet.has(row.id) &&
                        (getRowCanExpand ? getRowCanExpand(row.original) : true),
                      )}
                      onSelect={onRowSelect}
                    />
                    {renderExpandedRow &&
                    expandedRowIdSet.has(row.id) &&
                    (getRowCanExpand ? getRowCanExpand(row.original) : true) ? (
                      <tr className={styles.expandedRow}>
                        <td className={[styles.cell, styles.expandedRowCell].join(" ")} colSpan={visibleColumnCount}>
                          <div className={styles.expandedRowContent}>{renderExpandedRow(row.original)}</div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
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