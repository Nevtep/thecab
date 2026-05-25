"use client";

import { useTranslation } from "react-i18next";

import { CabCard, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import type {
  CapitalAllocationSliceSummary,
  DistributionCompositionBreakdown,
} from "@/features/overview/capitalAllocation.utils";
import {
  formatDistributionCompositionToken,
  withAlpha,
} from "@/features/overview/capitalAllocation.utils";
import { formatPercent, formatUsd } from "@/i18n/formatters";

type UnderlyingAssetsPanelProps = {
  selectedSlice: CapitalAllocationSliceSummary;
  selectedBreakdown: DistributionCompositionBreakdown | null;
};

export function UnderlyingAssetsPanel({
  selectedSlice,
  selectedBreakdown,
}: UnderlyingAssetsPanelProps) {
  const { t, i18n } = useTranslation("overview");
  const showPercentages = Boolean(selectedBreakdown?.usesEstimatedValue && selectedSlice.valueUsd > 0);

  return (
    <CabCard density="default">
      <CabStack gap="$3">
        <CabStack gap="$1">
          <CabText
            variant="mono"
            fontSize={11}
            color={cabColors.text.secondary}
            style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            {t("distribution.assetsPanel.title", { segment: selectedSlice.label })}
          </CabText>
          <CabText variant="caption" fontSize={12} color={selectedSlice.color}>
            {selectedSlice.label}
          </CabText>
        </CabStack>

        {!selectedBreakdown ? (
          <CabStack gap="$2">
            <CabText variant="label" color={cabColors.text.primary} fontSize={15}>
              {selectedSlice.dimension === "idle"
                ? t("distribution.assetsPanel.idleTitle")
                : t("distribution.assetsPanel.emptyTitle")}
            </CabText>
            <CabText variant="caption" fontSize={13} color={cabColors.text.secondary}>
              {selectedSlice.dimension === "idle"
                ? t("distribution.assetsPanel.idleEmptyDescription")
                : t("distribution.assetsPanel.emptyDescription")}
            </CabText>
          </CabStack>
        ) : (
          <CabStack gap="$2">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: showPercentages ? "minmax(0, 1.2fr) minmax(120px, 0.8fr) minmax(140px, 0.9fr)" : "minmax(0, 1.2fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr)",
                gap: 12,
                paddingBottom: 8,
                borderBottom: `1px solid ${cabColors.surface.border}`,
              }}
            >
              <CabText variant="mono" fontSize={10} color={cabColors.text.muted} style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {t("distribution.assetsPanel.columns.asset")}
              </CabText>
              <CabText variant="mono" fontSize={10} color={cabColors.text.muted} style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {t("distribution.assetsPanel.columns.amount")}
              </CabText>
              <CabText variant="mono" fontSize={10} color={cabColors.text.muted} style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {t("distribution.assetsPanel.columns.value")}
              </CabText>
            </div>

            {selectedBreakdown.tokens.map((token) => {
              const tokenPercentage = showPercentages && token.estimatedValueUsd !== null
                ? token.estimatedValueUsd / selectedSlice.valueUsd
                : null;

              return (
                <div
                  key={token.symbol}
                  style={{
                    display: "grid",
                    gridTemplateColumns: showPercentages ? "minmax(0, 1.2fr) minmax(120px, 0.8fr) minmax(140px, 0.9fr)" : "minmax(0, 1.2fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr)",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: `1px solid ${withAlpha(cabColors.surface.border, 0.65)}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: token.color,
                        boxShadow: `0 0 14px ${withAlpha(token.color, 0.36)}`,
                        flexShrink: 0,
                      }}
                    />
                    <CabText variant="label" color={cabColors.text.primary} fontSize={14}>
                      {token.symbol}
                    </CabText>
                  </div>

                  <CabText variant="caption" color={cabColors.text.secondary} fontSize={13}>
                    {formatDistributionCompositionToken(token, i18n.language, t)}
                  </CabText>

                  <CabStack gap="$1" alignItems="flex-end">
                    <CabText variant="label" color={cabColors.text.primary} fontSize={14}>
                      {token.estimatedValueUsd === null
                        ? t("states.unavailableValue")
                        : formatUsd(token.estimatedValueUsd, i18n.language)}
                    </CabText>
                    {tokenPercentage !== null ? (
                      <CabText variant="caption" color={token.color} fontSize={12}>
                        {formatPercent(tokenPercentage, i18n.language)}
                      </CabText>
                    ) : null}
                  </CabStack>
                </div>
              );
            })}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6 }}>
              <CabText variant="caption" color={cabColors.text.secondary} fontSize={13}>
                {t("distribution.assetsPanel.segmentTotal")}
              </CabText>
              <CabStack gap="$1" alignItems="flex-end">
                <CabText variant="label" color={cabColors.text.primary} fontSize={15}>
                  {formatUsd(selectedSlice.valueUsd, i18n.language)}
                </CabText>
                {showPercentages ? (
                  <CabText variant="caption" color={selectedSlice.color} fontSize={12}>
                    {formatPercent(1, i18n.language)}
                  </CabText>
                ) : null}
              </CabStack>
            </div>
          </CabStack>
        )}
      </CabStack>
    </CabCard>
  );
}