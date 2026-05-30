"use client";

import { CabBadge, CabCard, CabStack, CabText, CabTxHash } from "@/design-system";
import { getStrategyTxExplorerUrl } from "@/features/strategies/strategies.mappers";
import type { StrategyLifecycleEventView } from "@/features/strategies/strategies.types";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategyLifecycleTimelineProps = {
  chainId: number;
  locale: string;
  events: StrategyLifecycleEventView[];
  labels: {
    title: string;
    empty: string;
    transaction: string;
    value: string;
    shares: string;
  };
  translate: (key: string, options?: { defaultValue?: string }) => string;
};

function formatUsd(value: number | null, locale: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function badgeTone(coverageStatus: StrategyLifecycleEventView["coverageStatus"]) {
  if (coverageStatus === "full") return "success" as const;
  if (coverageStatus === "unknown") return "danger" as const;
  return "warning" as const;
}

function isInternalStrategyEvent(eventType: StrategyLifecycleEventView["eventType"]) {
  return eventType === "strategy_internal_rebalance" || eventType === "strategy_fee_dilution";
}

function canShowLifecycleAmounts(event: StrategyLifecycleEventView) {
  if (!isInternalStrategyEvent(event.eventType)) {
    return true;
  }

  return event.coverageStatus === "full" && (event.confidence === "high" || event.confidence === "medium");
}

export function StrategyLifecycleTimeline({ chainId, events, labels, locale, translate }: StrategyLifecycleTimelineProps) {
  return (
    <CabCard density="compact">
      <CabStack gap="$2">
        <CabText variant="label">{labels.title}</CabText>
        {events.length === 0 ? (
          <CabText variant="caption">{labels.empty}</CabText>
        ) : (
          <div className={styles.timeline}>
            {events.map((event) => {
              const showAmounts = canShowLifecycleAmounts(event);
              return (
                <div key={event.id} className={styles.timelineItem}>
                  <div className={styles.timelineMarker} aria-hidden="true" />
                  <div className={styles.timelineBody}>
                    <CabStack row gap="$2" alignItems="center" flexWrap="wrap">
                      <CabText variant="label">
                        {translate(`strategies:lifecycle.eventTypes.${event.eventType}`)}
                      </CabText>
                      <CabBadge tone={badgeTone(event.coverageStatus)} size="sm">
                        {translate(`coverage:level.${event.coverageStatus}`)}
                      </CabBadge>
                      <CabBadge tone={event.confidence === "high" || event.confidence === "medium" ? "success" : "warning"} size="sm">
                        {translate(`coverage:confidence.${event.confidence}`)}
                      </CabBadge>
                    </CabStack>
                    <CabText variant="caption">{formatDate(event.occurredAt, locale)}</CabText>
                    <div className={styles.timelineMeta}>
                      <span>{labels.value}: {showAmounts ? formatUsd(event.usdValue, locale) : "—"}</span>
                      <span>{labels.shares}: {showAmounts ? event.shareDeltaRaw ?? "—" : "—"}</span>
                      <span>
                        {labels.transaction}:{" "}
                        {event.txHash ? (
                          <CabTxHash hash={event.txHash} href={getStrategyTxExplorerUrl(chainId, event.txHash)} />
                        ) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CabStack>
    </CabCard>
  );
}
