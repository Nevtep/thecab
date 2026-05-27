"use client";

import type { Header, RowData } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import { DataTableCell, type DataTableCellAlignment } from "@/design-system/data-display/DataTableCell.component";
import { CabIcon } from "@/design-system/icons";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

import styles from "@/design-system/data-display/DataTable.module.css";

function toAriaSort(sortState: false | "asc" | "desc") {
  if (sortState === "asc") {
    return "ascending" as const;
  }

  if (sortState === "desc") {
    return "descending" as const;
  }

  return "none" as const;
}

export function DataTableSortHeader<TData extends RowData>({
  header,
  align,
  stickyHeader,
}: {
  header: Header<TData, unknown>;
  align: DataTableCellAlignment;
  stickyHeader: boolean;
}) {
  if (header.isPlaceholder) {
    return <DataTableCell as="th" align={align} stickyHeader={stickyHeader} />;
  }

  const sortState = header.column.getIsSorted();
  const canSort = header.column.getCanSort();
  const indicatorClassName = [
    styles.sortIndicator,
    sortState === false ? styles.sortIndicatorInactive : "",
    sortState === "asc" ? styles.sortIndicatorAsc : "",
    sortState === "desc" ? styles.sortIndicatorDesc : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <DataTableCell as="th" align={align} stickyHeader={stickyHeader} ariaSort={toAriaSort(sortState)}>
      {canSort ? (
        <button type="button" className={styles.sortButton} onClick={header.column.getToggleSortingHandler()}>
          <CabText variant="mono" color={cabColors.text.secondary} fontSize={11}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </CabText>
          <span className={indicatorClassName} aria-hidden="true">
            <CabIcon name="chevronDown" tone={sortState === false ? "muted" : "signal"} size="sm" />
          </span>
        </button>
      ) : (
        <div className={styles.headerLabel}>
          <CabText variant="mono" color={cabColors.text.secondary} fontSize={11}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </CabText>
        </div>
      )}
    </DataTableCell>
  );
}