"use client";

import type { CSSProperties } from "react";

import { formatUsd } from "@/i18n/formatters";

import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

type CabValueWithStatusTone = "current" | "estimated" | "partial" | "unavailable";

const toneColorMap: Record<CabValueWithStatusTone, string> = {
  current: cabColors.brand.signalTeal,
  estimated: cabColors.brand.electricBlue,
  partial: cabColors.semantic.warning,
  unavailable: cabColors.text.muted,
};

export type CabValueWithStatusProps = {
  value: number | null;
  locale: string;
  statusLabel: string;
  tone?: CabValueWithStatusTone;
  align?: "start" | "end";
  fallbackLabel?: string;
  formatter?: (value: number, locale: string) => string;
};

export function CabValueWithStatus({
  value,
  locale,
  statusLabel,
  tone = "current",
  align = "start",
  fallbackLabel = "--",
  formatter = formatUsd,
}: CabValueWithStatusProps) {
  const toneColor = toneColorMap[tone];
  const alignment = align === "end" ? "flex-end" : "flex-start";
  const textAlign = align === "end" ? "right" : "left";
  const valueLabel = value === null ? fallbackLabel : formatter(value, locale);
  const statusStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  };

  return (
    <CabStack gap="$1" alignItems={alignment}>
      <CabText
        variant="label"
        color={cabColors.text.primary}
        style={{ fontVariantNumeric: "tabular-nums", textAlign, whiteSpace: "nowrap" }}
      >
        {valueLabel}
      </CabText>
      <CabText variant="caption" fontSize={11} color={toneColor} style={{ textAlign }}>
        <span style={statusStyle}>
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: toneColor,
              boxShadow: `0 0 12px ${toneColor}`,
              flexShrink: 0,
            }}
          />
          {statusLabel}
        </span>
      </CabText>
    </CabStack>
  );
}