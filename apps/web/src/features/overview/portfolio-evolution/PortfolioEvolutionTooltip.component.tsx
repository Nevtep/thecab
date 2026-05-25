"use client";

import { CabBadge, CabCard, CabStack, CabText, CabTxHash } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import {
  portfolioEvolutionEventMeta,
  portfolioEvolutionSeriesMeta,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import type { PortfolioEvolutionDatum } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import { formatDateTime, formatRelativeTime, formatUsd } from "@/i18n/formatters";
import { useTranslation } from "react-i18next";

type PortfolioEvolutionTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: PortfolioEvolutionDatum }>;
  label?: string;
  locale: string;
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

export function PortfolioEvolutionTooltip({ active, payload, locale }: PortfolioEvolutionTooltipProps) {
  const { t } = useTranslation(["overview", "charts"]);
  const datum = payload?.[0]?.payload;

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
          <CabStack gap="$2.5">
            <CabText variant="caption" fontSize={11} color={cabColors.text.muted}>
              {t("portfolioEvolution.legend.events")}
            </CabText>
            <div
              style={{
                display: "grid",
                gap: 8,
                maxHeight: 188,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {datum.events.map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: 10,
                    borderRadius: 12,
                    border: `1px solid ${cabColors.surface.border}`,
                    background: "rgba(15, 24, 38, 0.72)",
                  }}
                >
                  <CabStack row justifyContent="space-between" alignItems="center" gap="$2">
                    <CabStack row alignItems="center" gap="$2">
                      <ColorDot color={portfolioEvolutionEventMeta[event.type].color} />
                      <CabBadge tone={portfolioEvolutionEventMeta[event.type].tone} size="sm">
                        {t(portfolioEvolutionEventMeta[event.type].labelKey)}
                      </CabBadge>
                    </CabStack>
                    <CabText variant="caption" fontSize={11} color={cabColors.text.muted}>
                      {formatRelativeTime(event.occurredAt, locale)}
                    </CabText>
                  </CabStack>
                  <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                    {event.detail ?? t("portfolioEvolution.selectedPoint.noEventDetail")}
                  </CabText>
                  {event.txHash ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ColorDot color={portfolioEvolutionEventMeta[event.type].color} />
                      <CabTxHash hash={event.txHash} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CabStack>
        ) : null}
      </CabStack>
      </CabCard>
    </div>
  );
}