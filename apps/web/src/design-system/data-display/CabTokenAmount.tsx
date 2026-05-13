"use client";

import { formatTokenAmount } from "@/i18n/formatters";

import { CabText } from "@/design-system/primitives/CabText";

export type CabTokenAmountProps = {
  value: number;
  locale: string;
  symbol?: string;
};

export function CabTokenAmount({ value, locale, symbol }: CabTokenAmountProps) {
  return (
    <CabText variant="data" style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatTokenAmount(value, locale)}
      {symbol ? ` ${symbol}` : ""}
    </CabText>
  );
}
