"use client";

import { CabIcon } from "@/design-system/icons/CabIcon";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

import styles from "@/design-system/data-display/DataTable.module.css";

export type DataTablePaginationProps = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  pageSizeOptions: number[];
  labels: {
    previous: string;
    next: string;
    page: (page: number, totalPages: number) => string;
    rowsPerPage: string;
    showing: (from: number, to: number, total: number) => string;
  };
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

function clampPage(page: number, totalPages: number) {
  return Math.max(1, Math.min(Math.max(totalPages, 1), page));
}

export function DataTablePagination({
  page,
  pageSize,
  totalRows,
  totalPages,
  pageSizeOptions,
  labels,
  loading = false,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const safeTotalPages = Math.max(totalPages, totalRows > 0 ? 1 : 0);
  const visibleTotalPages = Math.max(safeTotalPages, 1);
  const safePage = clampPage(page, safeTotalPages);
  const from = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(totalRows, safePage * pageSize);
  const previousDisabled = loading || safePage <= 1;
  const nextDisabled = loading || safeTotalPages === 0 || safePage >= safeTotalPages;

  return (
    <nav className={styles.pagination} aria-label={labels.rowsPerPage} aria-busy={loading}>
      <div className={styles.paginationMeta}>
        <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
          {labels.showing(from, to, totalRows)}
        </CabText>
      </div>
      <div className={styles.paginationControls}>
        <button
          type="button"
          className={styles.paginationButton}
          aria-label={labels.previous}
          disabled={previousDisabled}
          onClick={() => onPageChange(clampPage(safePage - 1, safeTotalPages))}
        >
          <CabIcon name="chevronLeft" size="sm" tone={previousDisabled ? "muted" : "signal"} aria-hidden="true" />
        </button>
        <CabText variant="mono" fontSize={12}>
          {labels.page(safePage, visibleTotalPages)}
        </CabText>
        <button
          type="button"
          className={styles.paginationButton}
          aria-label={labels.next}
          disabled={nextDisabled}
          onClick={() => onPageChange(clampPage(safePage + 1, safeTotalPages))}
        >
          <CabIcon name="chevronRight" size="sm" tone={nextDisabled ? "muted" : "signal"} aria-hidden="true" />
        </button>
      </div>
      <label className={styles.paginationSize}>
        <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
          {labels.rowsPerPage}
        </CabText>
        <select
          className={styles.paginationSelect}
          aria-label={labels.rowsPerPage}
          value={pageSize}
          disabled={loading}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
