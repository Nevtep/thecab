"use client";

import { useTranslation } from "react-i18next";

import { CabBadge, CabIcon, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import type { CapitalAllocationStatusBadge } from "@/features/overview/capitalAllocation.utils";
import { formatUsd } from "@/i18n/formatters";

type CapitalAllocationHeaderProps = {
  totalValueUsd: number;
  badges: CapitalAllocationStatusBadge[];
};

export function CapitalAllocationHeader({ totalValueUsd, badges }: CapitalAllocationHeaderProps) {
  const { t, i18n } = useTranslation("overview");

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <CabStack gap="$2" flex={1} minWidth={280}>
        <CabText variant="label" color={cabColors.text.primary} fontSize={28}>
          {t("sections.distribution")}
        </CabText>
        <CabText variant="caption" color={cabColors.text.secondary} fontSize={14}>
          {t("distribution.sectionSubtitle")}
        </CabText>
        {badges.length > 0 ? (
          <CabStack row gap="$2" flexWrap="wrap">
            {badges.map((badge) => (
              <CabBadge key={badge.key} tone={badge.tone} size="md">
                {badge.label}
              </CabBadge>
            ))}
          </CabStack>
        ) : null}
      </CabStack>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginLeft: "auto",
        }}
      >
        <CabStack gap="$1" alignItems="flex-end">
          <CabText
            variant="mono"
            fontSize={11}
            color={cabColors.text.muted}
            style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            {t("distribution.kpiLabel")}
          </CabText>
          <CabText variant="label" color={cabColors.text.primary} fontSize={22}>
            {formatUsd(totalValueUsd, i18n.language)}
          </CabText>
        </CabStack>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${cabColors.surface.border}`,
            background: `linear-gradient(180deg, ${cabColors.surface.elevatedSurface} 0%, rgba(21, 35, 58, 0.88) 100%)`,
            boxShadow: `0 0 0 1px ${cabColors.brandExtended.signalTealGlow}`,
          }}
        >
          <CabIcon name="rewards" tone="signal" size="md" />
        </div>
      </div>
    </div>
  );
}