"use client";

import type { ColumnMeta } from "@tanstack/react-table";
import type { KeyboardEvent, PropsWithChildren, ReactNode } from "react";

import { CabBadge, type CabBadgeProps } from "@/design-system/primitives/CabBadge";
import { CabButton } from "@/design-system/primitives/CabButton";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

import styles from "@/design-system/data-display/DataTable.module.css";

export type DataTableCellAlignment = "left" | "center" | "right";

type DataTableCellProps = PropsWithChildren<{
  as?: "th" | "td";
  align?: DataTableCellAlignment;
  className?: string;
  stickyHeader?: boolean;
  colSpan?: number;
  ariaSort?: "none" | "ascending" | "descending";
}>;

function alignmentClassName(align: DataTableCellAlignment) {
  switch (align) {
    case "center":
      return styles.alignCenter;
    case "right":
      return styles.alignRight;
    default:
      return styles.alignLeft;
  }
}

function stackAlignmentClassName(align: DataTableCellAlignment) {
  switch (align) {
    case "center":
      return styles.alignStackCenter;
    case "right":
      return styles.alignStackRight;
    default:
      return styles.alignStackLeft;
  }
}

export function resolveDataTableAlignment(
  meta?: ColumnMeta<unknown, unknown>,
): DataTableCellAlignment {
  if (meta?.align) {
    return meta.align;
  }

  if (meta?.numeric) {
    return "right";
  }

  return "left";
}

export function DataTableCell({
  as = "td",
  align = "left",
  className,
  stickyHeader = false,
  colSpan,
  ariaSort,
  children,
}: DataTableCellProps) {
  const resolvedClassName = [
    styles.cell,
    as === "th" ? styles.headerCell : styles.bodyCell,
    alignmentClassName(align),
    as === "th" && stickyHeader ? styles.stickyHeader : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (as === "th") {
    return (
      <th scope="col" className={resolvedClassName} colSpan={colSpan} aria-sort={ariaSort}>
        <div className={styles.headerContent}>{children}</div>
      </th>
    );
  }

  return (
    <td className={resolvedClassName} colSpan={colSpan}>
      <div className={styles.cellContent}>{children}</div>
    </td>
  );
}

export function DataTableValueCell({
  primary,
  secondary,
  align = "right",
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  align?: DataTableCellAlignment;
}) {
  return (
    <div className={[styles.stackedCell, stackAlignmentClassName(align)].join(" ")}>
      <CabText variant="data" color={cabColors.text.primary} fontSize={13}>
        {primary}
      </CabText>
      {secondary ? (
        <CabText variant="caption" color={cabColors.text.muted} fontSize={11}>
          {secondary}
        </CabText>
      ) : null}
    </div>
  );
}

export function DataTablePercentCell({
  value,
  tone = "neutral",
  align = "right",
}: {
  value: ReactNode;
  tone?: "neutral" | "positive" | "negative";
  align?: DataTableCellAlignment;
}) {
  const color =
    tone === "positive"
      ? cabColors.semantic.success
      : tone === "negative"
        ? cabColors.semantic.danger
        : cabColors.text.primary;

  return (
    <div className={[styles.stackedCell, stackAlignmentClassName(align)].join(" ")}>
      <CabText variant="data" color={color} fontSize={13}>
        {value}
      </CabText>
    </div>
  );
}

export function DataTableStatusCell({
  label,
  tone = "neutral",
  variant = "status",
}: {
  label: ReactNode;
  tone?: CabBadgeProps["tone"];
  variant?: CabBadgeProps["variant"];
}) {
  return (
    <div className={styles.badgeCell}>
      <CabBadge tone={tone} size="sm" variant={variant}>
        {label}
      </CabBadge>
    </div>
  );
}

export function DataTableRowActionCell({
  label,
  onPress,
  tone = "ghost",
}: {
  label: ReactNode;
  onPress: () => void;
  tone?: "primary" | "secondary" | "technical" | "ghost" | "warning";
}) {
  function stopSelection(event: { stopPropagation: () => void }) {
    event.stopPropagation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div className={styles.actionCell} onClickCapture={stopSelection} onKeyDownCapture={handleKeyDown}>
      <CabButton tone={tone} controlSize="sm" density="compact" onPress={onPress}>
        {label}
      </CabButton>
    </div>
  );
}

export function DataTableStackedCell({
  title,
  subtitle,
  align = "left",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  align?: DataTableCellAlignment;
}) {
  return (
    <CabStack gap="$1" className={[styles.stackedCell, stackAlignmentClassName(align)].join(" ")}>
      <CabText variant="label" color={cabColors.text.primary} fontSize={13}>
        {title}
      </CabText>
      {subtitle ? (
        <CabText variant="caption" color={cabColors.text.secondary} fontSize={11}>
          {subtitle}
        </CabText>
      ) : null}
    </CabStack>
  );
}