"use client";

import { Spinner } from "tamagui";

import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabLoadingPanelProps = {
  label: string;
};

export function CabLoadingPanel({ label }: CabLoadingPanelProps) {
  return (
    <CabCard density="spacious">
      <CabStack alignItems="center" justifyContent="center" gap="$3">
        <Spinner color={cabColors.brand.signalTeal} />
        <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
          {label}
        </CabText>
      </CabStack>
    </CabCard>
  );
}
