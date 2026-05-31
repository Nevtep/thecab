"use client";

import { CabImpactMetricCard, CabKpiStrip } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import type { PortfolioEvolutionSummary } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import { formatPercent, formatUsd } from "@/i18n/formatters";
import { useTranslation } from "react-i18next";

type PortfolioEvolutionKpiStripProps = {
  summary: PortfolioEvolutionSummary;
  locale: string;
};

function formatNullableCurrency(value: number | null, locale: string, fallback: string) {
  return value === null ? fallback : formatUsd(value, locale);
}

function formatNullablePercent(value: number | null, locale: string, fallback: string) {
  return value === null ? fallback : formatPercent(value, locale);
}

export function PortfolioEvolutionKpiStrip({ summary, locale }: PortfolioEvolutionKpiStripProps) {
  const { t } = useTranslation(["overview"]);
  const fallback = t("states.unavailableValue");
  const items = [
    {
      key: "initial",
      label: t("portfolioEvolution.kpis.initialValue"),
      value: formatNullableCurrency(summary.initialValueUsd, locale, fallback),
      accentColor: cabColors.brand.electricBlue,
      iconName: "wallet" as const,
    },
    {
      key: "final",
      label: t("portfolioEvolution.kpis.finalValue"),
      value: formatNullableCurrency(summary.finalValueUsd, locale, fallback),
      accentColor: cabColors.brand.signalTeal,
      iconName: "coins" as const,
    },
    {
      key: "absolute",
      label: t("portfolioEvolution.kpis.absoluteChange"),
      value: formatNullableCurrency(summary.absoluteChangeUsd, locale, fallback),
      accentColor: summary.absoluteChangeUsd !== null && summary.absoluteChangeUsd >= 0
        ? cabColors.semantic.success
        : cabColors.semantic.danger,
      iconName: summary.absoluteChangeUsd !== null && summary.absoluteChangeUsd >= 0 ? "arrowUpToLine" as const : "arrowDownToLine" as const,
    },
    {
      key: "changePct",
      label: t("portfolioEvolution.kpis.changePct"),
      value: formatNullablePercent(summary.changePct, locale, fallback),
      accentColor: summary.changePct !== null && summary.changePct >= 0
        ? cabColors.semantic.success
        : cabColors.semantic.danger,
      iconName: "activity" as const,
    },
    {
      key: "rewards",
      label: t("portfolioEvolution.kpis.accumulatedRewards"),
      value: formatNullableCurrency(summary.accumulatedRewardsUsd, locale, fallback),
      accentColor: cabColors.brand.cabGold,
      iconName: "rewards" as const,
    },
    {
      key: "rebalances",
      label: t("portfolioEvolution.kpis.detectedRebalances"),
      value: String(summary.detectedRebalanceCount),
      accentColor: cabColors.semantic.info,
      iconName: "refreshCcw" as const,
    },
  ];

  return (
    <CabKpiStrip>
      {items.map((item) => (
        <CabImpactMetricCard
          key={item.key}
          label={item.label}
          value={item.value}
          accentColor={item.accentColor}
          iconName={item.iconName}
          size="compact"
        />
      ))}
    </CabKpiStrip>
  );
}
