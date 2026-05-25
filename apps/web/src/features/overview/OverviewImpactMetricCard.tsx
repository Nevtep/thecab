"use client";

import { CabCard, CabIcon, CabStack, CabText, type CabIconName } from "@/design-system";
import { cabColors } from "@/design-system/tokens";

type OverviewImpactMetricCardProps = {
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

export function OverviewImpactMetricCard({
  label,
  value,
  iconName,
  accentColor,
  series = [],
  meta,
  size = "default",
}: OverviewImpactMetricCardProps) {
  const sparklineHeight = size === "default" ? 84 : 64;
  const sparkline = buildSparkline(series, 240, sparklineHeight, 8);
  const gradientId = `overview-impact-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${size}`;
  const contentPadding = size === "default" ? 18 : 14;

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
              bottom: -4,
              width: size === "default" ? 220 : 170,
              height: size === "default" ? 82 : 58,
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

        <CabStack gap="$3" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
              {label}
            </CabText>
            <div
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${withAlpha(accentColor, 0.34)}`,
                background: withAlpha(accentColor, 0.1),
                boxShadow: `0 0 18px ${withAlpha(accentColor, 0.16)}`,
                flexShrink: 0,
              }}
            >
              <CabIcon name={iconName} width={16} height={16} color={accentColor} />
            </div>
          </div>

          <CabText
            variant="kpi"
            fontSize={size === "default" ? 32 : 22}
            fontWeight="700"
            color={cabColors.text.primary}
            style={{
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.05,
              maxWidth: size === "default" ? "72%" : "78%",
            }}
          >
            {value}
          </CabText>

          {meta ? (
            <CabText variant="caption" fontSize={12} color={accentColor}>
              {meta}
            </CabText>
          ) : null}
        </CabStack>
      </div>
    </CabCard>
  );
}