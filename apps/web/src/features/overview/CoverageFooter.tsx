"use client";

import { useTranslation } from "react-i18next";

import { CabCard, CabIcon, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import type { OverviewExclusionSummary, OverviewViewModel } from "@/features/overview/overview.types";
import { formatUsd } from "@/i18n/formatters";

type CoverageFooterProps = {
  exclusions: OverviewExclusionSummary | null;
  coverageStatus: OverviewViewModel["distribution"]["coverageStatus"];
  source: OverviewViewModel["distribution"]["source"];
};

export function CoverageFooter({ exclusions, coverageStatus, source }: CoverageFooterProps) {
  const { t, i18n } = useTranslation("overview");
  const hasSuspiciousAssets = exclusions?.reasonCodes.includes("excludedSuspiciousAssets") ?? false;

  const tiles = [
    {
      key: "excluded-assets",
      icon: "wallet" as const,
      label: t("distribution.footer.excludedAssets", { count: exclusions?.excludedAssetCount ?? 0 }),
    },
    {
      key: "risk-filter",
      icon: "warning" as const,
      label: hasSuspiciousAssets
        ? t("distribution.footer.suspiciousAssets")
        : t("distribution.footer.lowConfidenceAssets"),
    },
    {
      key: "excluded-value",
      icon: "info" as const,
      label: typeof exclusions?.excludedValueUsd === "number"
        ? t("distribution.footer.excludedValuation", {
            value: formatUsd(exclusions.excludedValueUsd, i18n.language),
          })
        : t("distribution.footer.excludedValuationUnavailable"),
    },
    {
      key: "coverage-status",
      icon: "dashboard" as const,
      label: source !== "analyzed_history" || coverageStatus !== "recent" || exclusions?.includesUnpricedVisibleAssets
        ? t("distribution.footer.partialValuation")
        : t("distribution.footer.currentCoverage", { status: t(`coverage.status.${coverageStatus}`) }),
    },
  ];

  return (
    <CabCard density="default">
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {tiles.map((tile) => (
          <div
            key={tile.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 4px",
              color: cabColors.text.secondary,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${cabColors.surface.border}`,
                backgroundColor: "rgba(15, 24, 38, 0.58)",
                flexShrink: 0,
              }}
            >
              <CabIcon name={tile.icon} tone="muted" size="sm" />
            </div>
            <CabText variant="caption" color={cabColors.text.secondary} fontSize={13}>
              {tile.label}
            </CabText>
          </div>
        ))}
      </div>
    </CabCard>
  );
}