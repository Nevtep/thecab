"use client";

import { formatUsd } from "@/i18n/formatters";

import { CabText } from "@/design-system/primitives/CabText";

export function CabUsdValue({ value, locale }: { value: number; locale: string }) {
  return (
    <CabText variant="data" style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatUsd(value, locale)}
    </CabText>
  );
}
