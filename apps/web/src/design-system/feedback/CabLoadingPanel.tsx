"use client";

import { useId } from "react";
import { Spinner } from "tamagui";

import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabLoadingPanelProps = {
  label: string;
};

export function CabLoadingPanel({ label }: CabLoadingPanelProps) {
  const labelId = useId();

  return (
    <CabCard density="spacious">
      <div role="status" aria-live="polite" aria-busy="true" aria-labelledby={labelId}>
        <CabStack alignItems="center" justifyContent="center" gap="$3">
          <Spinner color={cabColors.brand.signalTeal} />
          <CabText id={labelId} variant="caption" fontSize={13} color={cabColors.text.secondary}>
            {label}
          </CabText>
        </CabStack>
      </div>
    </CabCard>
  );
}
