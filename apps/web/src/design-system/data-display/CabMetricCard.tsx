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
    <CabCard>
      <CabStack gap="$2">
        <CabText color={cabColors.text.secondary}>{label}</CabText>
        <CabText
          variant="data"
          fontSize="$6"
          fontWeight="700"
          color={cabColors.text.primary}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </CabText>
        {typeof delta === "number" ? (
          <CabBadge tone={delta >= 0 ? "success" : "danger"}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(2)}%
          </CabBadge>
        ) : null}
      </CabStack>
    </CabCard>
  );
}
