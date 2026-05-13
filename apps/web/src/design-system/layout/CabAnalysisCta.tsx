"use client";

import { CabButton } from "@/design-system/primitives/CabButton";

export type CabAnalysisCtaProps = {
  label: string;
  disabled?: boolean;
  onPress?: () => void;
};

export function CabAnalysisCta({ label, disabled, onPress }: CabAnalysisCtaProps) {
  return (
    <CabButton tone="primary" disabled={disabled} onPress={onPress} width="100%">
      {label}
    </CabButton>
  );
}
