"use client";

import type { RowData, Table } from "@tanstack/react-table";

import { resolveDataTableAlignment } from "@/design-system/data-display/DataTableCell.component";
import { DataTableSortHeader } from "@/design-system/data-display/DataTableSortHeader.component";

import styles from "@/design-system/data-display/DataTable.module.css";

export function DataTableHeader<TData extends RowData>({
  table,
  stickyHeader,
}: {
  table: Table<TData>;
  stickyHeader: boolean;
}) {
  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} className={styles.headerRow}>
          {headerGroup.headers.map((header) => (
            <DataTableSortHeader
              key={header.id}
              header={header}
              align={resolveDataTableAlignment(header.column.columnDef.meta)}
              stickyHeader={stickyHeader}
            />
          ))}
        </tr>
      ))}
    </thead>
  );
}