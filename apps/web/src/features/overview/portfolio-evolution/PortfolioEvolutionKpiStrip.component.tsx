"use client";

import { CabCard, CabKpiStrip, CabStack, CabText } from "@/design-system";
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
      tone: "neutral" as const,
    },
    {
      key: "final",
      label: t("portfolioEvolution.kpis.finalValue"),
      value: formatNullableCurrency(summary.finalValueUsd, locale, fallback),
      tone: "neutral" as const,
    },
    {
      key: "absolute",
      label: t("portfolioEvolution.kpis.absoluteChange"),
      value: formatNullableCurrency(summary.absoluteChangeUsd, locale, fallback),
      tone: summary.absoluteChangeUsd !== null && summary.absoluteChangeUsd >= 0 ? "success" as const : "danger" as const,
    },
    {
      key: "changePct",
      label: t("portfolioEvolution.kpis.changePct"),
      value: formatNullablePercent(summary.changePct, locale, fallback),
      tone: summary.changePct !== null && summary.changePct >= 0 ? "success" as const : "danger" as const,
    },
    {
      key: "rewards",
      label: t("portfolioEvolution.kpis.accumulatedRewards"),
      value: formatNullableCurrency(summary.accumulatedRewardsUsd, locale, fallback),
      tone: "warning" as const,
    },
    {
      key: "rebalances",
      label: t("portfolioEvolution.kpis.detectedRebalances"),
      value: String(summary.detectedRebalanceCount),
      tone: "info" as const,
    },
  ];

  return (
    <CabKpiStrip>
      {items.map((item) => (
        <div key={item.key} style={{ flex: "1 1 160px", minWidth: 150 }}>
          <CabCard density="default">
            <CabStack gap="$2">
              <CabText variant="caption" fontSize={11}>
                {item.label}
              </CabText>
              <CabText
                variant="label"
                fontSize={18}
                style={{
                  color:
                    item.tone === "success"
                      ? "#22C55E"
                      : item.tone === "danger"
                        ? "#EF4444"
                        : item.tone === "warning"
                          ? "#F2C14E"
                          : item.tone === "info"
                            ? "#38BDF8"
                            : undefined,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {item.value}
              </CabText>
            </CabStack>
          </CabCard>
        </div>
      ))}
    </CabKpiStrip>
  );
}