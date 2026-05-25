"use client";

import { useTranslation } from "react-i18next";

import { CabCard, CabIcon, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import type { CapitalAllocationSliceSummary } from "@/features/overview/capitalAllocation.utils";
import { withAlpha } from "@/features/overview/capitalAllocation.utils";
import { formatPercent, formatUsd } from "@/i18n/formatters";

type AllocationSummaryCardsProps = {
  items: CapitalAllocationSliceSummary[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

export function AllocationSummaryCards({ items, selectedKey, onSelect }: AllocationSummaryCardsProps) {
  const { t, i18n } = useTranslation("overview");

  return (
    <CabCard density="default">
      <CabStack gap="$3">
        <CabText
          variant="mono"
          fontSize={11}
          color={cabColors.text.secondary}
          style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}
        >
          {t("distribution.summary.title")}
        </CabText>

        <CabStack gap="$2">
          {items.map((item) => {
            const isSelected = item.key === selectedKey;

            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(item.key)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "18px 18px",
                  borderRadius: 16,
                  border: `1px solid ${isSelected ? withAlpha(item.color, 0.72) : cabColors.surface.border}`,
                  background: isSelected
                    ? `linear-gradient(180deg, ${withAlpha(item.color, 0.18)} 0%, rgba(17, 26, 39, 0.96) 100%)`
                    : "rgba(15, 24, 38, 0.62)",
                  boxShadow: isSelected ? `0 0 24px ${withAlpha(item.color, 0.2)}` : "none",
                  cursor: "pointer",
                  color: "inherit",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: item.color,
                      boxShadow: `0 0 18px ${withAlpha(item.color, 0.4)}`,
                      flexShrink: 0,
                    }}
                  />
                  <CabText variant="label" color={cabColors.text.primary} fontSize={15}>
                    {item.label}
                  </CabText>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <CabStack gap="$1" alignItems="flex-end">
                    <CabText variant="label" color={cabColors.text.primary} fontSize={15}>
                      {formatUsd(item.valueUsd, i18n.language)}
                    </CabText>
                    <CabText variant="caption" color={isSelected ? item.color : cabColors.text.secondary} fontSize={13}>
                      {formatPercent(item.percentage, i18n.language)}
                    </CabText>
                  </CabStack>
                  <CabIcon
                    name="chevronDown"
                    tone={isSelected ? "signal" : "muted"}
                    size="sm"
                    style={{ transform: "rotate(-90deg)" }}
                  />
                </div>
              </button>
            );
          })}
        </CabStack>
      </CabStack>
    </CabCard>
  );
}