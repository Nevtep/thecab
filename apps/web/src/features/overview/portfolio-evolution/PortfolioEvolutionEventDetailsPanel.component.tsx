"use client";

import { CabCard, CabStack, CabText, CabTxHash } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { getOverviewTimeUnit } from "@/features/overview/overviewRange.utils";
import {
  portfolioEvolutionEventMeta,
  portfolioEvolutionSeriesMeta,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import { EventGlyph } from "@/features/overview/portfolio-evolution/PortfolioEvolutionEventSummary.component";
import type { OverviewRange } from "@/features/overview/overview.types";
import type { PortfolioEvolutionDatum } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import { formatDateTime, formatRelativeTime, formatUsd } from "@/i18n/formatters";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type PortfolioEvolutionEventDetailsPanelProps = {
  selectedPoint: PortfolioEvolutionDatum | null;
  latestEventOccurredAt: string | null;
  locale: string;
  range: OverviewRange;
};

export function PortfolioEvolutionEventDetailsPanel({
  selectedPoint,
  latestEventOccurredAt,
  locale,
  range,
}: PortfolioEvolutionEventDetailsPanelProps) {
  const { t } = useTranslation(["overview", "charts"]);
  const timeUnit = getOverviewTimeUnit(range);
  const timeUnitSuffix = timeUnit === "hour" ? "Hour" : "Day";

  const rows = selectedPoint ? [
    {
      label: t(portfolioEvolutionSeriesMeta.total.labelKey),
      value: selectedPoint.totalValueUsd,
      color: portfolioEvolutionSeriesMeta.total.color,
    },
    {
      label: t(portfolioEvolutionSeriesMeta.deployed.labelKey),
      value: selectedPoint.deployedValueUsd,
      color: portfolioEvolutionSeriesMeta.deployed.color,
    },
    {
      label: t(portfolioEvolutionSeriesMeta.idle.labelKey),
      value: selectedPoint.idleValueUsd,
      color: portfolioEvolutionSeriesMeta.idle.color,
    },
    {
      label: t(portfolioEvolutionSeriesMeta.rewards.labelKey),
      value: selectedPoint.cumulativeRewardValueUsd,
      color: portfolioEvolutionSeriesMeta.rewards.color,
    },
  ] : [];

  const orderedEvents = useMemo(
    () => selectedPoint ? [...selectedPoint.events].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)) : [],
    [selectedPoint],
  );

  return (
    <CabCard density="default">
      <CabStack gap="$4">
        <CabStack gap="$1.5">
          <CabText variant="label" fontSize={15}>
            {t("portfolioEvolution.selectedPoint.title")}
          </CabText>
          <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
            {selectedPoint ? formatDateTime(selectedPoint.capturedAt, locale) : t(`portfolioEvolution.selectedPoint.empty${timeUnitSuffix}`)}
          </CabText>
          {selectedPoint ? (
            <CabText variant="mono" fontSize={11} color={cabColors.text.muted}>
              {t(`portfolioEvolution.selectedPoint.eventsCount${timeUnitSuffix}`, { count: orderedEvents.length })}
            </CabText>
          ) : null}
        </CabStack>

        {selectedPoint ? (
          <CabStack gap="$2">
            {rows.map((row) => (
              <CabStack key={row.label} row justifyContent="space-between" alignItems="center" gap="$3">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: row.color,
                      boxShadow: `0 0 10px ${row.color}55`,
                    }}
                  />
                  <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                    {row.label}
                  </CabText>
                </div>
                <CabText variant="mono" fontSize={12} color={cabColors.text.primary}>
                  {row.value === null ? t("states.unavailableValue") : formatUsd(row.value, locale)}
                </CabText>
              </CabStack>
            ))}
          </CabStack>
        ) : null}

        <CabStack gap="$2.5">
          <CabText variant="caption" fontSize={11} color={cabColors.text.muted}>
            {t(`portfolioEvolution.selectedPoint.eventsTitle${timeUnitSuffix}`)}
          </CabText>
          {selectedPoint && orderedEvents.length > 0 ? (
            <div
              style={{
                display: "grid",
                gap: 6,
                maxHeight: 300,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {orderedEvents.map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 132px) minmax(88px, 120px) minmax(0, 1fr)",
                    gap: 12,
                    alignItems: "start",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${cabColors.surface.border}`,
                    background: "rgba(15, 24, 38, 0.72)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <EventGlyph type={event.type} />
                    <CabText variant="caption" fontSize={12} color={portfolioEvolutionEventMeta[event.type].color}>
                      {t(portfolioEvolutionEventMeta[event.type].labelKey)}
                    </CabText>
                  </div>
                  <CabText variant="mono" fontSize={11} color={cabColors.text.muted}>
                    {formatRelativeTime(event.occurredAt, locale)}
                  </CabText>
                  <CabStack gap="$1.5">
                    <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                      {event.detail ?? t("portfolioEvolution.selectedPoint.noEventDetail")}
                    </CabText>
                    {event.txHash ? <CabTxHash hash={event.txHash} /> : null}
                  </CabStack>
                </div>
              ))}
            </div>
          ) : (
            <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
              {t(`portfolioEvolution.selectedPoint.noEvents${timeUnitSuffix}`)}
            </CabText>
          )}
        </CabStack>

        <CabStack gap="$1">
          <CabText variant="caption" fontSize={11} color={cabColors.text.muted}>
            {t("portfolioEvolution.footer.latestEvent")}
          </CabText>
          <CabText variant="mono" fontSize={12}>
            {latestEventOccurredAt ? formatRelativeTime(latestEventOccurredAt, locale) : t("states.unavailableValue")}
          </CabText>
        </CabStack>
      </CabStack>
    </CabCard>
  );
}