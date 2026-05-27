"use client";

import { CabPoolCard, CabResidualAttributionPanel, CabStack, CabStrategyCard, CabText } from "@/design-system";

export function PoolExposureBreakdown(input: {
  labels: {
    manual: string;
    strategy: string;
    residual: string;
  };
  values: {
    manual: string;
    strategy: string;
    residual: string;
  };
}) {
  return (
    <CabStack gap="$3">
      <CabPoolCard title={input.labels.manual} value={input.values.manual} />
      <CabStrategyCard title={input.labels.strategy} value={input.values.strategy} />
      <CabResidualAttributionPanel>
        <CabStack gap="$1">
          <CabText variant="label">{input.labels.residual}</CabText>
          <CabText variant="data">{input.values.residual}</CabText>
        </CabStack>
      </CabResidualAttributionPanel>
    </CabStack>
  );
}