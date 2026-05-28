"use client";

import { CabBadge, CabChartPanel, CabImpactMetricCard, CabStack, CabText } from "@/design-system";
import { CabTooltip } from "@/design-system/primitives/CabTooltip";
import { cabColors } from "@/design-system/tokens";
import type { DepositPerformanceDecompositionViewModel } from "@/features/deposits/deposits.mappers";

type DepositPerformanceDecompositionProps = {
  viewModel: DepositPerformanceDecompositionViewModel;
};

function colorForTone(tone: DepositPerformanceDecompositionViewModel["rows"][number]["tone"]) {
  switch (tone) {
    case "success":
      return cabColors.brandExtended.signalTealRaw;
    case "danger":
      return cabColors.dataViz.orange;
    case "warning":
      return cabColors.brand.cabGold;
    case "info":
      return cabColors.brand.electricBlue;
    default:
      return cabColors.surface.border;
  }
}

export function DepositPerformanceDecomposition(input: DepositPerformanceDecompositionProps) {
  return (
    <CabChartPanel>
      <CabStack gap="$3">
        <CabStack gap="$1">
          <CabText variant="label">{input.viewModel.title}</CabText>
          <CabText variant="caption">{input.viewModel.flowContextLabel}</CabText>
        </CabStack>
        <div
          style={{
            border: `1px solid ${cabColors.surface.border}`,
            borderRadius: 20,
            padding: 16,
            background: cabColors.surface.elevatedSurface,
          }}
        >
          <CabStack gap="$2">
            <CabStack row justifyContent="space-between" alignItems="center" flexWrap="wrap">
              <CabText variant="label">{input.viewModel.flowTitle}</CabText>
              <CabBadge tone="info">{input.viewModel.flowContextLabel}</CabBadge>
            </CabStack>
            <CabStack row gap="$3" flexWrap="wrap">
              {input.viewModel.capitalEnteredTooltipLabel ? (
                <CabTooltip label={input.viewModel.capitalEnteredTooltipLabel}>
                  <span>
                    <CabImpactMetricCard
                      label={input.viewModel.capitalEnteredLabel}
                      value={input.viewModel.capitalEnteredValue}
                      iconName="dashboard"
                      accentColor={cabColors.brandExtended.signalTealRaw}
                      size="compact"
                    />
                  </span>
                </CabTooltip>
              ) : (
                <CabImpactMetricCard
                  label={input.viewModel.capitalEnteredLabel}
                  value={input.viewModel.capitalEnteredValue}
                  iconName="dashboard"
                  accentColor={cabColors.brandExtended.signalTealRaw}
                  size="compact"
                />
              )}
              {input.viewModel.capitalWithdrawnTooltipLabel ? (
                <CabTooltip label={input.viewModel.capitalWithdrawnTooltipLabel}>
                  <span>
                    <CabImpactMetricCard
                      label={input.viewModel.capitalWithdrawnLabel}
                      value={input.viewModel.capitalWithdrawnValue}
                      iconName="activity"
                      accentColor={cabColors.dataViz.orange}
                      size="compact"
                    />
                  </span>
                </CabTooltip>
              ) : (
                <CabImpactMetricCard
                  label={input.viewModel.capitalWithdrawnLabel}
                  value={input.viewModel.capitalWithdrawnValue}
                  iconName="activity"
                  accentColor={cabColors.dataViz.orange}
                  size="compact"
                />
              )}
            </CabStack>
          </CabStack>
        </div>
        <div
          style={{
            border: `1px solid ${cabColors.surface.border}`,
            borderRadius: 20,
            padding: 16,
            background: cabColors.surface.darkSurface,
          }}
        >
          <CabStack gap="$3">
            <CabText variant="label">{input.viewModel.attributionTitle}</CabText>
            <CabStack gap="$3">
              {input.viewModel.rows.map((row) => (
                <div
                  key={row.key}
                  style={{
                    display: "grid",
                    gap: 12,
                    alignItems: "center",
                    gridTemplateColumns: "minmax(120px, 160px) minmax(0, 1fr) minmax(110px, auto)",
                  }}
                >
                  {row.tooltipLabel ? (
                    <CabTooltip label={row.tooltipLabel}>
                      <span>
                        <CabText variant="caption">{row.label}</CabText>
                      </span>
                    </CabTooltip>
                  ) : (
                    <CabText variant="caption">{row.label}</CabText>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: row.valueUsd < 0 ? "flex-end" : "flex-start",
                      background: cabColors.surface.elevatedSurface,
                      border: `1px solid ${cabColors.surface.border}`,
                      borderRadius: 999,
                      minHeight: 14,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(row.barPercent, row.valueUsd === 0 ? 2 : 6)}%`,
                        minHeight: 12,
                        background: colorForTone(row.tone),
                      }}
                    />
                  </div>
                  <CabStack row gap="$2" justifyContent="flex-end" alignItems="center" flexWrap="wrap">
                    <CabText variant="label" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.valueLabel}
                    </CabText>
                    <CabBadge tone={row.tone === "danger" ? "warning" : row.tone === "success" ? "success" : "info"}>
                      {row.shareLabel}
                    </CabBadge>
                  </CabStack>
                </div>
              ))}
            </CabStack>
            <CabStack row justifyContent="space-between" alignItems="center">
              <CabText variant="label" style={{ color: cabColors.brand.cabGold }}>
                {input.viewModel.totalReturnLabel}
              </CabText>
              <CabText variant="heading" style={{ color: cabColors.brand.cabGold, fontVariantNumeric: "tabular-nums" }}>
                {input.viewModel.totalReturnValue}
              </CabText>
            </CabStack>
            <CabStack row justifyContent="space-between" alignItems="center">
              <CabText variant="caption">{input.viewModel.estAnnualizedReturnLabel}</CabText>
              <CabText variant="label" style={{ fontVariantNumeric: "tabular-nums" }}>
                {input.viewModel.estAnnualizedReturnValue}
              </CabText>
            </CabStack>
          </CabStack>
        </div>
      </CabStack>
    </CabChartPanel>
  );
}