"use client";

import { CabCard, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { getOverviewTimeUnit } from "@/features/overview/overviewRange.utils";
import {
  portfolioEvolutionSeriesMeta,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import type { OverviewRange } from "@/features/overview/overview.types";
import { PortfolioEvolutionEventSummary } from "@/features/overview/portfolio-evolution/PortfolioEvolutionEventSummary.component";
import type { PortfolioEvolutionDatum } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import { formatDateTime, formatUsd } from "@/i18n/formatters";
import { useTranslation } from "react-i18next";

type PortfolioEvolutionTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: PortfolioEvolutionDatum }>;
  label?: string;
  locale: string;
  range: OverviewRange;
};

function ColorDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        flexShrink: 0,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 10px ${color}55`,
      }}
    />
  );
}

export function PortfolioEvolutionTooltip({ active, payload, locale, range }: PortfolioEvolutionTooltipProps) {
  const { t } = useTranslation(["overview", "charts"]);
  const datum = payload?.[0]?.payload;
  const timeUnit = getOverviewTimeUnit(range);

  if (!active || !datum) {
    return null;
  }

  const rows = [
    {
      key: "total",
      label: t(portfolioEvolutionSeriesMeta.total.labelKey),
      value: datum.totalValueUsd,
      color: portfolioEvolutionSeriesMeta.total.color,
    },
    {
      key: "deployed",
      label: t(portfolioEvolutionSeriesMeta.deployed.labelKey),
      value: datum.deployedValueUsd,
      color: portfolioEvolutionSeriesMeta.deployed.color,
    },
    {
      key: "idle",
      label: t(portfolioEvolutionSeriesMeta.idle.labelKey),
      value: datum.idleValueUsd,
      color: portfolioEvolutionSeriesMeta.idle.color,
    },
    {
      key: "rewardBucket",
      label: t(`charts:series.rewards${timeUnit === "hour" ? "Hour" : "Day"}`),
      value: datum.rewardValueUsd,
      color: cabColors.dataViz.orange,
    },
    {
      key: "rewards",
      label: t(portfolioEvolutionSeriesMeta.rewards.labelKey),
      value: datum.cumulativeRewardValueUsd,
      color: portfolioEvolutionSeriesMeta.rewards.color,
    },
  ];

  return (
    <div style={{ minWidth: 316, maxWidth: 360 }}>
      <CabCard density="default">
        <CabStack gap="$3.5">
          <CabText variant="label" fontSize={13} color={cabColors.text.primary}>
            {formatDateTime(datum.capturedAt, locale)}
          </CabText>
          <CabStack gap="$2.5">
            {rows.map((row) => (
              <CabStack key={row.key} row justifyContent="space-between" alignItems="center" gap="$3">
                <CabStack row alignItems="center" gap="$2">
                  <ColorDot color={row.color} />
                  <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                    {row.label}
                  </CabText>
                </CabStack>
                <CabText variant="mono" fontSize={12} color={cabColors.text.primary}>
                  {row.value === null ? t("states.unavailableValue") : formatUsd(row.value, locale)}
                </CabText>
              </CabStack>
            ))}
          </CabStack>
          {datum.events.length > 0 ? (
            <PortfolioEvolutionEventSummary
              events={datum.events}
              locale={locale}
              range={range}
            />
          ) : null}
        </CabStack>
      </CabCard>
    </div>
  );
}