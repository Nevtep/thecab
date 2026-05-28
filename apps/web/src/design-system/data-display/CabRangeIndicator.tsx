"use client";

import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

function formatRangeValue(value: number, locale: string, fractionDigits: number | null) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 6,
  }).format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const statusStyleMap = {
  active: {
    color: cabColors.brand.signalTeal,
    glow: "rgba(0, 224, 225, 0.22)",
  },
  inactive: {
    color: cabColors.dataViz.violet,
    glow: "rgba(139, 92, 246, 0.24)",
  },
  unknown: {
    color: cabColors.semantic.warning,
    glow: "rgba(251, 191, 36, 0.24)",
  },
} as const;

export type CabRangeIndicatorProps = {
  lower: number;
  upper: number;
  locale: string;
  quoteSymbol: string;
  fractionDigits?: number | null;
  markerRatio?: number | null;
  status?: "active" | "inactive" | "unknown";
  statusLabel?: string;
};

export function CabRangeIndicator({
  lower,
  upper,
  locale,
  quoteSymbol,
  fractionDigits = null,
  markerRatio = 0.5,
  status = "unknown",
  statusLabel,
}: CabRangeIndicatorProps) {
  const statusStyle = statusStyleMap[status];
  const resolvedMarkerRatio = clamp(markerRatio ?? 0.5, 0, 1);
  const rangeLabel = `${formatRangeValue(lower, locale, fractionDigits)} - ${formatRangeValue(upper, locale, fractionDigits)} ${quoteSymbol}`;

  return (
    <CabStack gap="$1" width="100%">
      <CabStack row alignItems="center" justifyContent="space-between" gap="$2" width="100%">
        <CabText
          variant="caption"
          fontSize={11}
          color={statusStyle.color}
          style={{ fontWeight: 600, whiteSpace: "nowrap" }}
        >
          {statusLabel ?? status}
        </CabText>
        <CabText
          variant="mono"
          fontSize={11}
          color={cabColors.text.secondary}
          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {rangeLabel}
        </CabText>
      </CabStack>

      <div
        aria-hidden="true"
        style={{
          position: "relative",
          width: "100%",
          height: 12,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 5,
            height: 2,
            borderRadius: 999,
            background: "rgba(132, 148, 178, 0.28)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 4,
            height: 4,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${statusStyle.glow} 0%, ${statusStyle.color} 50%, ${statusStyle.glow} 100%)`,
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 2,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: cabColors.text.secondary,
            boxShadow: "0 0 0 2px rgba(17, 26, 39, 0.95)",
            opacity: 0.8,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 2,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: cabColors.text.secondary,
            boxShadow: "0 0 0 2px rgba(17, 26, 39, 0.95)",
            opacity: 0.8,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${resolvedMarkerRatio * 100}% - 5px)`,
            top: 0,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: statusStyle.color,
            boxShadow: `0 0 0 2px rgba(17, 26, 39, 0.95), 0 0 16px ${statusStyle.glow}`,
          }}
        />
      </div>
    </CabStack>
  );
}