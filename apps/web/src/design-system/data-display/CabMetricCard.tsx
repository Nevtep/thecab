"use client";

import { CabBadge } from "@/design-system/primitives/CabBadge";
import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabMetricCardProps = {
  label: string;
  value: string;
  delta?: number;
};

export function CabMetricCard({ label, value, delta }: CabMetricCardProps) {
  return (
    <CabCard density="spacious">
      <CabStack gap="$3">
        <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
          {label}
        </CabText>
        <CabText
          variant="kpi"
          fontSize={26}
          fontWeight="700"
          color={cabColors.text.primary}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </CabText>
        {typeof delta === "number" ? (
          <CabBadge tone={delta >= 0 ? "success" : "danger"} size="md">
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(2)}%
          </CabBadge>
        ) : null}
      </CabStack>
    </CabCard>
  );
}
