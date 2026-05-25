"use client";

import { CabIcon, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { getOverviewTimeUnit } from "@/features/overview/overviewRange.utils";
import {
  portfolioEvolutionEventIcons,
  portfolioEvolutionEventMeta,
  portfolioEvolutionEventOrder,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import type { OverviewRange } from "@/features/overview/overview.types";
import type { PortfolioEvolutionMarker } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import { formatRelativeTime } from "@/i18n/formatters";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const DENSE_EVENT_THRESHOLD = 4;

function EventGlyph({ type }: { type: PortfolioEvolutionMarker["type"] }) {
  const iconName = portfolioEvolutionEventIcons[type];
  const color = portfolioEvolutionEventMeta[type].color;

  return (
    <div
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 6,
        border: `1px solid ${color}44`,
        background: `${color}14`,
        color,
        flexShrink: 0,
      }}
    >
      <CabIcon name={iconName} size="sm" width={11} height={11} color={color} strokeWidth={2} />
    </div>
  );
}

function buildGroupedSummary(events: PortfolioEvolutionMarker[]) {
  const grouped = new Map<PortfolioEvolutionMarker["type"], number>();

  for (const event of events) {
    grouped.set(event.type, (grouped.get(event.type) ?? 0) + 1);
  }

  return portfolioEvolutionEventOrder
    .filter((type) => grouped.has(type))
    .map((type) => ({
      type,
      count: grouped.get(type) ?? 0,
    }));
}

export function PortfolioEvolutionEventSummary({
  events,
  locale,
  range,
  forceGrouped = false,
}: {
  events: PortfolioEvolutionMarker[];
  locale: string;
  range: OverviewRange;
  forceGrouped?: boolean;
}) {
  const { t } = useTranslation(["overview"]);
  const timeUnit = getOverviewTimeUnit(range);
  const orderedEvents = useMemo(
    () => [...events].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
    [events],
  );
  const groupedSummary = useMemo(() => buildGroupedSummary(orderedEvents), [orderedEvents]);
  const isDenseBucket = forceGrouped || orderedEvents.length >= DENSE_EVENT_THRESHOLD;

  if (orderedEvents.length === 0) {
    return null;
  }

  return (
    <CabStack gap="$2">
      <CabStack row justifyContent="space-between" alignItems="center" gap="$2">
        <CabText variant="caption" fontSize={11} color={cabColors.text.muted}>
          {t("portfolioEvolution.legend.events")}
        </CabText>
        <CabText variant="mono" fontSize={11} color={cabColors.text.secondary}>
          {t("portfolioEvolution.tooltip.eventCount", { count: orderedEvents.length })}
        </CabText>
      </CabStack>

      {isDenseBucket ? (
        <div style={{ display: "grid", gap: 8 }}>
          {groupedSummary.map((group) => (
            <div
              key={group.type}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${cabColors.surface.border}`,
                background: "rgba(15, 24, 38, 0.56)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <EventGlyph type={group.type} />
                <CabText variant="caption" fontSize={12} color={cabColors.text.primary}>
                  {t(portfolioEvolutionEventMeta[group.type].labelKey)}
                </CabText>
              </div>
              <CabText variant="mono" fontSize={12} color={portfolioEvolutionEventMeta[group.type].color}>
                x{group.count}
              </CabText>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {orderedEvents.slice(0, 3).map((event) => (
            <div
              key={event.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${cabColors.surface.border}`,
                background: "rgba(15, 24, 38, 0.56)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <EventGlyph type={event.type} />
                <CabText variant="caption" fontSize={12} color={cabColors.text.primary}>
                  {t(portfolioEvolutionEventMeta[event.type].labelKey)}
                </CabText>
              </div>
              <CabText variant="mono" fontSize={11} color={cabColors.text.muted}>
                {formatRelativeTime(event.occurredAt, locale)}
              </CabText>
            </div>
          ))}
        </div>
      )}
      {isDenseBucket ? (
        <CabText variant="caption" fontSize={11} color={cabColors.brandExtended.signalTealUi}>
          {t(`portfolioEvolution.tooltip.clickHint${timeUnit === "hour" ? "Hour" : "Day"}`)}
        </CabText>
      ) : null}
    </CabStack>
  );
}

export { EventGlyph };