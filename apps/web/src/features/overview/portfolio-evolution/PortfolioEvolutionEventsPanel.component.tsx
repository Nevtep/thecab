"use client";

import { CabBadge, CabCard, CabStack, CabText, CabTxHash } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { portfolioEvolutionEventMeta } from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import type { PortfolioEvolutionDatum } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import { formatDateTime, formatRelativeTime, formatUsd } from "@/i18n/formatters";
import { useTranslation } from "react-i18next";

type PortfolioEvolutionEventsPanelProps = {
  selectedPoint: PortfolioEvolutionDatum | null;
  latestEventOccurredAt: string | null;
  locale: string;
};

function EventColorDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        flexShrink: 0,
        background: color,
        boxShadow: `0 0 8px ${color}55`,
      }}
    />
  );
}

export function PortfolioEvolutionEventsPanel({
  selectedPoint,
  latestEventOccurredAt,
  locale,
}: PortfolioEvolutionEventsPanelProps) {
  const { t } = useTranslation(["overview", "charts"]);

  const rows = selectedPoint ? [
    { label: t("charts:series.netPortfolioValue"), value: selectedPoint.totalValueUsd },
    { label: t("charts:series.deployedValue"), value: selectedPoint.deployedValueUsd },
    { label: t("charts:series.idleValue"), value: selectedPoint.idleValueUsd },
    { label: t("charts:series.rewardsAccumulated"), value: selectedPoint.cumulativeRewardValueUsd },
  ] : [];

  return (
    <CabCard density="default">
      <CabStack gap="$4">
        <CabStack gap="$2">
          <CabText variant="label" fontSize={15}>
            {t("portfolioEvolution.selectedPoint.title")}
          </CabText>
          <CabText variant="caption" fontSize={12}>
            {selectedPoint ? formatDateTime(selectedPoint.capturedAt, locale) : t("portfolioEvolution.selectedPoint.empty")}
          </CabText>
        </CabStack>

        {selectedPoint ? (
          <CabStack gap="$2">
            {rows.map((row) => (
              <CabStack key={row.label} row justifyContent="space-between" gap="$3">
                <CabText variant="caption" fontSize={12}>
                  {row.label}
                </CabText>
                <CabText variant="mono" fontSize={12}>
                  {row.value === null ? t("states.unavailableValue") : formatUsd(row.value, locale)}
                </CabText>
              </CabStack>
            ))}
          </CabStack>
        ) : null}

        <CabStack gap="$2">
          <CabText variant="caption" fontSize={11}>
            {t("portfolioEvolution.selectedPoint.eventsTitle")}
          </CabText>
          {selectedPoint && selectedPoint.events.length > 0 ? (
            <CabStack gap="$2">
              {selectedPoint.events.map((event) => (
                <CabCard key={event.id} density="default">
                  <CabStack gap="$2">
                    <CabStack row justifyContent="space-between" alignItems="center" gap="$2">
                      <CabStack row alignItems="center" gap="$2">
                        <EventColorDot color={portfolioEvolutionEventMeta[event.type].color} />
                        <CabBadge tone={portfolioEvolutionEventMeta[event.type].tone} size="sm">
                          {t(portfolioEvolutionEventMeta[event.type].labelKey)}
                        </CabBadge>
                      </CabStack>
                      <CabText variant="caption" fontSize={11}>
                        {formatRelativeTime(event.occurredAt, locale)}
                      </CabText>
                    </CabStack>
                    <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                      {event.detail ?? t("portfolioEvolution.selectedPoint.noEventDetail")}
                    </CabText>
                    {event.txHash ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <EventColorDot color={portfolioEvolutionEventMeta[event.type].color} />
                        <CabTxHash hash={event.txHash} />
                      </div>
                    ) : null}
                  </CabStack>
                </CabCard>
              ))}
            </CabStack>
          ) : (
            <CabText variant="caption" fontSize={12}>
              {t("portfolioEvolution.selectedPoint.noEvents")}
            </CabText>
          )}
        </CabStack>

        <CabStack gap="$1">
          <CabText variant="caption" fontSize={11}>
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