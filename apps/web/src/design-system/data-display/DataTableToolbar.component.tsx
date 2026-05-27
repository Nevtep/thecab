"use client";

import type { PropsWithChildren, ReactNode } from "react";

import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

import styles from "@/design-system/data-display/DataTable.module.css";

export function DataTableToolbar({
  title,
  description,
  actions,
  children,
}: PropsWithChildren<{
  title?: string;
  description?: string;
  actions?: ReactNode;
}>) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarContent}>
        {children ??
          (title ? (
            <CabStack gap="$1">
              <CabText variant="label" color={cabColors.text.primary} fontSize={13}>
                {title}
              </CabText>
              {description ? (
                <CabText variant="caption" color={cabColors.text.secondary} fontSize={11}>
                  {description}
                </CabText>
              ) : null}
            </CabStack>
          ) : null)}
      </div>
      {actions ? <div className={styles.toolbarActions}>{actions}</div> : null}
    </div>
  );
}