"use client";

import { Spinner } from "tamagui";

import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

import styles from "@/design-system/data-display/DataTable.module.css";

export function DataTableLoadingState({
  label = "Loading data",
}: {
  label?: string;
}) {
  return (
    <div className={styles.stateWrap}>
      <div className={styles.statePanel}>
        <CabStack row alignItems="center" gap="$2">
          <Spinner color={cabColors.brand.signalTeal} />
          <CabText variant="caption" color={cabColors.text.secondary} fontSize={11}>
            {label}
          </CabText>
        </CabStack>
      </div>
    </div>
  );
}