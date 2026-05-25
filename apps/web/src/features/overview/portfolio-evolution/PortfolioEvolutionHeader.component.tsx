"use client";

import { CabRangeSelector, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import type { OverviewRange, OverviewViewModel } from "@/features/overview/overview.types";
import { useTranslation } from "react-i18next";

type PortfolioEvolutionHeaderProps = {
  range: OverviewRange;
  source: OverviewViewModel["chart"]["source"];
  coverageStatus: OverviewViewModel["chart"]["coverageStatus"];
  isRefreshing: boolean;
  onRangeChange: (range: OverviewRange) => void;
};

export function PortfolioEvolutionHeader({
  range,
  source,
  coverageStatus,
  isRefreshing,
  onRangeChange,
}: PortfolioEvolutionHeaderProps) {
  const { t } = useTranslation(["overview"]);
  const rangeOptions = (["24h", "7d", "30d"] as const).map((option) => ({
    key: option,
    label: t(`ranges.${option}`),
  }));

  return (
    <CabStack gap="$3">
      <CabStack row justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
        <CabStack gap="$2" flex={1} minWidth={0}>
          <CabText variant="label" color={cabColors.text.primary} fontSize={28}>
            {t("sections.chart")}
          </CabText>
          <CabText variant="caption" color={cabColors.text.secondary} fontSize={14}>
            {t("portfolioEvolution.subtitle")}
          </CabText>
          <CabText variant="caption" color={cabColors.text.muted} fontSize={11}>
            {t(`sources.${source}`)} · {t(`coverage.status.${coverageStatus}`)}
            {isRefreshing ? ` · ${t("states.updatingChartRange", { range: t(`ranges.${range}`) })}` : ""}
          </CabText>
        </CabStack>
        <CabRangeSelector
          options={rangeOptions}
          selectedKey={range}
          onSelect={(nextRange) => onRangeChange(nextRange as OverviewRange)}
        />
      </CabStack>
    </CabStack>
  );
}