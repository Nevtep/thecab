"use client";

import type { KeyboardEvent } from "react";
import { flexRender, type Row, type RowData } from "@tanstack/react-table";

import { DataTableCell, resolveDataTableAlignment } from "@/design-system/data-display/DataTableCell.component";

import styles from "@/design-system/data-display/DataTable.module.css";

export function DataTableRow<TData extends RowData>({
  row,
  selectable,
  selected,
  expanded = false,
  onSelect,
}: {
  row: Row<TData>;
  selectable: boolean;
  selected: boolean;
  expanded?: boolean;
  onSelect?: (rowId: string) => void;
}) {
  function handleSelect() {
    if (!selectable || !onSelect) {
      return;
    }

    onSelect(row.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (!selectable || !onSelect) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect();
    }
  }

  const rowClassName = [
    styles.bodyRow,
    selectable ? styles.bodyRowSelectable : "",
    selected ? styles.bodyRowSelected : "",
    expanded ? styles.bodyRowExpanded : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr
      className={rowClassName}
      onClick={selectable ? handleSelect : undefined}
      onKeyDown={selectable ? handleKeyDown : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-selected={selected || undefined}
    >
      {row.getVisibleCells().map((cell) => (
        <DataTableCell
          key={cell.id}
          align={resolveDataTableAlignment(cell.column.columnDef.meta)}
          className={cell.column.columnDef.meta?.cellClassName}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </DataTableCell>
      ))}
    </tr>
  );
}