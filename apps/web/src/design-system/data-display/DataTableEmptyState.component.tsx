"use client";

import type { ReactNode } from "react";

import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

import styles from "@/design-system/data-display/DataTable.module.css";

export function DataTableEmptyState({
  title = "No data available",
  description = "Adjust the current filters or wait for a completed analysis snapshot.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.stateWrap}>
      <div className={styles.statePanel}>
        <CabStack gap="$2">
          <CabText variant="label" color={cabColors.text.primary} fontSize={13}>
            {title}
          </CabText>
          <CabText variant="caption" color={cabColors.text.secondary} fontSize={11}>
            {description}
          </CabText>
          {action}
        </CabStack>
      </div>
    </div>
  );
}