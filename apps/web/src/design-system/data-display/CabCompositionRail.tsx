"use client";

import type { CSSProperties } from "react";

import { formatPercent } from "@/i18n/formatters";

import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

function withAlpha(color: string, alpha: number) {
  const normalized = color.replace("#", "");
  if (normalized.length !== 6) {
    return color;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

type CabCompositionRailSegment = {
  id: string;
  value: number;
  color: string;
  label?: string;
  accessibleLabel?: string;
};

const railSizeStyles = {
  sm: {
    height: 22,
    borderRadius: 8,
    fontSize: 10,
  },
  md: {
    height: 30,
    borderRadius: 10,
    fontSize: 11,
  },
} as const;

export type CabCompositionRailProps = {
  segments: CabCompositionRailSegment[];
  ariaLabel: string;
  locale: string;
  total?: number;
  size?: "sm" | "md";
  showInlinePercent?: boolean;
};

export function CabCompositionRail({
  segments,
  ariaLabel,
  locale,
  total,
  size = "md",
  showInlinePercent = false,
}: CabCompositionRailProps) {
  const positiveSegments = segments.filter((segment) => segment.value > 0);
  const resolvedTotal = total ?? positiveSegments.reduce((sum, segment) => sum + segment.value, 0);
  const sizeStyle = railSizeStyles[size];

  if (positiveSegments.length === 0 || resolvedTotal <= 0) {
    return (
      <div
        aria-label={ariaLabel}
        role="img"
        style={{
          position: "relative",
          overflow: "hidden",
          height: sizeStyle.height,
          borderRadius: sizeStyle.borderRadius,
          border: `1px solid ${cabColors.surface.border}`,
          background: "linear-gradient(180deg, rgba(20, 30, 46, 0.92) 0%, rgba(10, 18, 31, 0.96) 100%)",
        }}
      />
    );
  }

  const accessibleSummary = positiveSegments
    .map((segment) => {
      const percent = segment.value / resolvedTotal;
      return `${segment.accessibleLabel ?? segment.label ?? segment.id}: ${formatPercent(percent, locale)}`;
    })
    .join("; ");

  return (
    <div
      aria-label={`${ariaLabel}. ${accessibleSummary}`}
      role="img"
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "stretch",
        width: "100%",
        height: sizeStyle.height,
        borderRadius: sizeStyle.borderRadius,
        border: `1px solid ${cabColors.surface.border}`,
        background: "linear-gradient(180deg, rgba(20, 30, 46, 0.92) 0%, rgba(10, 18, 31, 0.96) 100%)",
        boxShadow: `inset 0 1px 0 rgba(184, 199, 230, 0.08), inset 0 -10px 18px rgba(0, 0, 0, 0.14)`,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: Math.max(sizeStyle.borderRadius - 1, 0),
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0) 38%)",
          pointerEvents: "none",
        }}
      />
      {positiveSegments.map((segment, index) => {
        const percent = segment.value / resolvedTotal;
        const showPercentLabel = showInlinePercent && percent >= 0.085;
        const segmentStyle: CSSProperties = {
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexGrow: segment.value,
          flexBasis: 0,
          minWidth: showPercentLabel ? 48 : 0,
          background: `linear-gradient(180deg, ${withAlpha(segment.color, 0.92)} 0%, ${withAlpha(segment.color, 0.68)} 100%)`,
          boxShadow: `inset 0 1px 0 ${withAlpha("#FFFFFF", 0.22)}, inset 0 -10px 18px ${withAlpha(segment.color, 0.2)}`,
          borderLeft: index === 0 ? undefined : `1px solid ${withAlpha(cabColors.brand.cabNight, 0.62)}`,
        };

        return (
          <div key={segment.id} style={segmentStyle}>
            {showPercentLabel ? (
              <CabText
                variant="mono"
                fontSize={sizeStyle.fontSize}
                color={cabColors.text.primary}
                style={{
                  fontWeight: 700,
                  lineHeight: 1,
                  textShadow: "0 1px 10px rgba(4, 15, 28, 0.36)",
                }}
              >
                {formatPercent(percent, locale)}
              </CabText>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}