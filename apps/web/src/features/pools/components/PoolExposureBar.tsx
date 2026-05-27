"use client";

import { CabDataPanel, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { getPoolsCoverageLabelKey } from "@/features/pools/pools.mappers";
import { useTranslation } from "react-i18next";

type ExposureItem = {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  coverageStatus: "full" | "share_level" | "partial" | "unknown";
  color: string;
};

function describeShare(value: number, total: number) {
  if (total <= 0 || value <= 0) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

export function PoolExposureBar(input: {
  title: string;
  items: ExposureItem[];
}) {
  const { t } = useTranslation(["coverage"]);
  const totalValue = input.items.reduce((sum, item) => sum + Math.max(item.value, 0), 0);

  return (
    <CabDataPanel>
      <CabStack gap="$2.5">
        <CabText variant="heading">{input.title}</CabText>
        <div
          role="img"
          aria-label={input.items.map((item) => `${item.label} ${describeShare(item.value, totalValue)}`).join(", ")}
          style={{
            display: "flex",
            width: "100%",
            height: 12,
            overflow: "hidden",
            borderRadius: 999,
            background: cabColors.surface.darkSurface,
            border: `1px solid ${cabColors.surface.border}`,
          }}
        >
          {input.items.map((item) => {
            const ratio = totalValue > 0 ? item.value / totalValue : 1 / Math.max(input.items.length, 1);
            const flexGrow = ratio > 0 ? Math.max(ratio, 0.08) : 0;

            return (
              <div
                key={item.key}
                style={{
                  flex: `${flexGrow} 1 0`,
                  background: item.color,
                  opacity: item.value > 0 ? 1 : 0.18,
                }}
              />
            );
          })}
        </div>
        <CabStack gap="$2">
          {input.items.map((item) => (
            <CabStack key={item.key} row justifyContent="space-between" alignItems="center" gap="$3">
              <CabStack row alignItems="center" gap="$2" minWidth={0} flex={1}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: item.color,
                    flexShrink: 0,
                  }}
                />
                <CabText variant="label">{item.label}</CabText>
                <CabText variant="caption" color={cabColors.text.muted}>
                  {describeShare(item.value, totalValue)}
                </CabText>
              </CabStack>
              <CabStack gap="$0.5" alignItems="flex-end">
                <CabText variant="mono">{item.formattedValue}</CabText>
                <CabText variant="caption" color={cabColors.text.muted}>
                  {t(getPoolsCoverageLabelKey(item.coverageStatus))}
                </CabText>
              </CabStack>
            </CabStack>
          ))}
        </CabStack>
      </CabStack>
    </CabDataPanel>
  );
}