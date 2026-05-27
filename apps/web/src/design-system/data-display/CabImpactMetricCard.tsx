"use client";

import { CabCard } from "@/design-system/primitives/CabCard";
import { CabIcon } from "@/design-system/icons/CabIcon";
import type { CabIconName } from "@/design-system/icons/iconRegistry";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabImpactMetricCardProps = {
  label: string;
  value: string;
  iconName: CabIconName;
  accentColor: string;
  series?: Array<number | null>;
  meta?: string | null;
  size?: "default" | "compact";
};

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

function buildSparkline(series: Array<number | null>, width: number, height: number, padding: number) {
  const numericValues = series.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (numericValues.length === 0) {
    return null;
  }

  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);
  const span = maxValue - minValue || Math.max(Math.abs(maxValue), 1);
  let previousResolvedValue = numericValues[0];

  const points = series.map((value, index) => {
    const resolvedValue = typeof value === "number" && Number.isFinite(value) ? value : previousResolvedValue;
    previousResolvedValue = resolvedValue;
    const x = padding + (index * (width - padding * 2)) / Math.max(series.length - 1, 1);
    const y = height - padding - ((resolvedValue - minValue) / span) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const baselineY = height - padding;
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? width - padding} ${baselineY} L ${points[0]?.x ?? padding} ${baselineY} Z`;

  return {
    linePath,
    areaPath,
    lastPoint: points.at(-1) ?? null,
  };
}

export function CabImpactMetricCard({
  label,
  value,
  iconName,
  accentColor,
  series = [],
  meta,
  size = "default",
}: CabImpactMetricCardProps) {
  const normalizedValueLength = value.trim().length;
  const sparklineHeight = size === "default" ? 84 : 64;
  const sparkline = buildSparkline(series, 240, sparklineHeight, 8);
  const gradientId = `cab-impact-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${size}`;
  const contentPadding = size === "default" ? 18 : 14;
  const sparklineWidth = size === "default" ? 220 : 136;
  const sparklineDisplayHeight = size === "default" ? 82 : 46;
  const iconSize = size === "default" ? 32 : 28;
  const iconRadius = size === "default" ? 12 : 10;
  const iconGlyphSize = size === "default" ? 16 : 14;
  const labelFontSize = size === "default" ? 12 : 11;
  const compactValueFontSize = normalizedValueLength >= 18
    ? "clamp(16px, 0.95vw, 18px)"
    : normalizedValueLength >= 14
      ? "clamp(18px, 1vw, 20px)"
      : "clamp(21px, 1.18vw, 24px)";
  const valueFontSize = size === "default" ? "clamp(28px, 1.45vw, 32px)" : compactValueFontSize;
  const valueMaxWidth = size === "default" ? "calc(100% - 72px)" : "100%";

  return (
    <CabCard padding={0} gap={0} density={size === "default" ? "spacious" : "default"}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          minHeight: size === "default" ? 128 : 108,
          borderRadius: "inherit",
          padding: contentPadding,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(circle at top right, ${withAlpha(accentColor, 0.18)} 0%, rgba(15, 24, 38, 0) 52%)`,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: 2,
            background: `linear-gradient(90deg, ${accentColor} 0%, ${withAlpha(accentColor, 0)} 100%)`,
            opacity: 0.85,
          }}
        />

        {sparkline ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: -8,
              bottom: size === "default" ? -4 : -10,
              width: sparklineWidth,
              height: sparklineDisplayHeight,
              pointerEvents: "none",
              opacity: 0.95,
            }}
          >
            <svg viewBox={`0 0 240 ${sparklineHeight}`} width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={withAlpha(accentColor, 0.78)} />
                  <stop offset="100%" stopColor={withAlpha(accentColor, 0.08)} />
                </linearGradient>
              </defs>
              <path d={sparkline.areaPath} fill={`url(#${gradientId})`} opacity={0.28} />
              <path d={sparkline.linePath} fill="none" stroke={accentColor} strokeWidth={2.2} strokeLinecap="round" />
              {sparkline.lastPoint ? (
                <circle cx={sparkline.lastPoint.x} cy={sparkline.lastPoint.y} r={3.6} fill={accentColor} />
              ) : null}
            </svg>
          </div>
        ) : null}

        <CabStack gap={size === "default" ? "$3" : "$2.5"} style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <CabText variant="caption" fontSize={labelFontSize} color={cabColors.text.secondary}>
              {label}
            </CabText>
            <div
              aria-hidden="true"
              style={{
                width: iconSize,
                height: iconSize,
                borderRadius: iconRadius,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${withAlpha(accentColor, 0.34)}`,
                background: withAlpha(accentColor, 0.1),
                boxShadow: `0 0 18px ${withAlpha(accentColor, 0.16)}`,
                flexShrink: 0,
              }}
            >
              <CabIcon name={iconName} width={iconGlyphSize} height={iconGlyphSize} color={accentColor} />
            </div>
          </div>

          <CabText
            variant="kpi"
            fontWeight="700"
            color={cabColors.text.primary}
            style={{
              fontSize: valueFontSize,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.05,
              maxWidth: valueMaxWidth,
              marginTop: size === "compact" ? 14 : 0,
              whiteSpace: "nowrap",
            }}
          >
            {value}
          </CabText>

          {meta ? (
            <CabText
              variant="caption"
              fontSize={labelFontSize}
              color={accentColor}
              style={{ marginTop: size === "compact" ? 6 : 2 }}
            >
              {meta}
            </CabText>
          ) : null}
        </CabStack>
      </div>
    </CabCard>
  );
}