"use client";

import { useTranslation } from "react-i18next";

import { CabCard, CabDonutChart, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { getOverviewTimeUnit } from "@/features/overview/overviewRange.utils";
import type {
  CapitalAllocationSliceSummary,
  DistributionCompositionBreakdown,
} from "@/features/overview/capitalAllocation.utils";
import type { OverviewRange } from "@/features/overview/overview.types";
import { withAlpha } from "@/features/overview/capitalAllocation.utils";
import { formatNumber, formatPercent, formatUsd } from "@/i18n/formatters";

type ConcentricCapitalDonutProps = {
  items: CapitalAllocationSliceSummary[];
  selectedSlice: CapitalAllocationSliceSummary;
  selectedBreakdown: DistributionCompositionBreakdown | null;
  range: OverviewRange;
  onSelectSlice: (key: string) => void;
};

export function ConcentricCapitalDonut({
  items,
  selectedSlice,
  selectedBreakdown,
  range,
  onSelectSlice,
}: ConcentricCapitalDonutProps) {
  const { t, i18n } = useTranslation("overview");
  const timeUnit = getOverviewTimeUnit(range);

  const innerData = selectedBreakdown
    ? selectedBreakdown.tokens.map((token) => ({
        id: token.symbol,
        label: token.symbol,
        value: selectedBreakdown.usesEstimatedValue ? (token.estimatedValueUsd ?? token.amount) : token.amount,
        color: token.color,
        opacity: 0.96,
        strokeColor: withAlpha(token.color, 0.58),
        strokeWidth: 2,
      }))
    : selectedSlice.valueUsd > 0
      ? [{
          id: `${selectedSlice.key}-placeholder`,
          label: t("distribution.center.noBreakdown"),
          value: selectedSlice.valueUsd,
          color: withAlpha(selectedSlice.color, 0.2),
          opacity: 0.9,
          strokeColor: withAlpha(selectedSlice.color, 0.42),
          strokeWidth: 2,
        }]
      : [];

  const centerContent = (
    <div
      style={{
        width: 172,
        minHeight: 172,
        padding: "20px 18px",
        borderRadius: 999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        background: "radial-gradient(circle at top, rgba(17, 26, 39, 0.96) 0%, rgba(10, 17, 29, 0.98) 100%)",
        border: `1px solid ${withAlpha(selectedSlice.color, 0.38)}`,
        boxShadow: `0 0 28px ${withAlpha(selectedSlice.color, 0.22)}`,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: selectedSlice.color,
          marginBottom: 10,
          boxShadow: `0 0 14px ${withAlpha(selectedSlice.color, 0.46)}`,
        }}
      />
      <CabText variant="label" color={selectedSlice.color} fontSize={17}>
        {selectedSlice.label}
      </CabText>
      <CabText variant="label" color={cabColors.text.primary} fontSize={18}>
        {formatUsd(selectedSlice.valueUsd, i18n.language)}
      </CabText>
      <CabText variant="caption" color={selectedSlice.color} fontSize={14}>
        {formatPercent(selectedSlice.percentage, i18n.language)}
      </CabText>
      <CabText variant="caption" color={cabColors.text.muted} fontSize={12}>
        {selectedBreakdown
          ? t("distribution.center.ofPortfolio")
          : t("distribution.center.noBreakdown")}
      </CabText>
    </div>
  );

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
            {t("distribution.chart.title")}
          </CabText>
          <CabText variant="caption" fontSize={13} color={cabColors.text.muted}>
            {t(`distribution.chart.hint${timeUnit === "hour" ? "Hour" : "Day"}`)}
          </CabText>
        </CabStack>

        <CabDonutChart
          height={380}
          centerContent={centerContent}
          levels={[
            {
              data: items.map((item) => ({
                id: item.key,
                label: item.label,
                value: item.valueUsd,
                color: item.color,
                opacity: item.key === selectedSlice.key ? 1 : 0.42,
                strokeColor: item.key === selectedSlice.key ? withAlpha(item.color, 0.95) : withAlpha(item.color, 0.28),
                strokeWidth: item.key === selectedSlice.key ? 3 : 2,
              })),
              innerRadius: 102,
              outerRadius: 142,
              paddingAngle: 2,
              cornerRadius: 10,
              valueFormatter: (value: number) => formatUsd(value, i18n.language),
              onSlicePress: (entry) => {
                if (entry.id) {
                  onSelectSlice(entry.id);
                }
              },
            },
            ...(innerData.length > 0
              ? [{
                  data: innerData,
                  innerRadius: 66,
                  outerRadius: 92,
                  paddingAngle: 1,
                  cornerRadius: 8,
                  valueFormatter: (value: number) => selectedBreakdown?.usesEstimatedValue
                    ? formatUsd(value, i18n.language)
                    : formatNumber(value, i18n.language, { maximumFractionDigits: 4 }),
                }]
              : []),
          ]}
        />

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          }}
        >
          {items.map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: 12,
                borderRadius: 14,
                border: `1px solid ${item.key === selectedSlice.key ? withAlpha(item.color, 0.48) : cabColors.surface.border}`,
                backgroundColor: item.key === selectedSlice.key ? withAlpha(item.color, 0.12) : "rgba(15, 24, 38, 0.58)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: item.color,
                    boxShadow: `0 0 12px ${withAlpha(item.color, 0.42)}`,
                  }}
                />
                <CabText variant="label" color={cabColors.text.primary} fontSize={14}>
                  {item.label}
                </CabText>
              </div>
              <CabText variant="caption" color={cabColors.text.secondary} fontSize={12}>
                {formatPercent(item.percentage, i18n.language)}
              </CabText>
            </div>
          ))}
        </div>

        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${cabColors.surface.border}`,
            padding: 14,
            backgroundColor: "rgba(15, 24, 38, 0.56)",
          }}
        >
          <CabStack gap="$1">
            <CabText variant="caption" color={cabColors.text.secondary} fontSize={12}>
              {t("distribution.chart.legendOuter")}
            </CabText>
            <CabText variant="caption" color={cabColors.text.secondary} fontSize={12}>
              {t("distribution.chart.legendInner")}
            </CabText>
          </CabStack>
        </div>
      </CabStack>
    </CabCard>
  );
}
