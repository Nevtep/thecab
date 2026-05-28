"use client";

import { useTranslation } from "react-i18next";

import { CabAccordion, CabBadge, CabCard, CabStack, CabText } from "@/design-system";
import type { DepositLifecycleEventView } from "@/features/deposits/deposits.types";
import { DepositEventMovementsTable } from "@/features/deposits/components/DepositEventMovementsTable";
import { formatDate, formatUsd } from "@/i18n/formatters";

type DepositLifecycleTimelineProps = {
  events: DepositLifecycleEventView[];
  locale: string;
  title: string;
  emptyLabel: string;
  movementLabels: {
    token: string;
    direction: string;
    amount: string;
    usdValue: string;
    priceSource: string;
    priceSourceValues: {
      event: string;
      pricePointFallback: string;
      unavailable: string;
    };
  };
};

function toneForPriceSource(value: DepositLifecycleEventView["priceSource"]) {
  switch (value) {
    case "event":
      return "success" as const;
    case "pricePointFallback":
      return "warning" as const;
    case "unavailable":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function toneForConfidence(value: DepositLifecycleEventView["confidence"]) {
  switch (value) {
    case "high":
      return "success" as const;
    case "medium":
      return "info" as const;
    case "degraded":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function DepositLifecycleTimeline(input: DepositLifecycleTimelineProps) {
  const { t } = useTranslation(["deposits", "coverage"]);

  if (input.events.length === 0) {
    return (
      <CabCard density="spacious">
        <CabStack gap="$2">
          <CabText variant="label">{input.title}</CabText>
          <CabText variant="caption">{input.emptyLabel}</CabText>
        </CabStack>
      </CabCard>
    );
  }

  return (
    <CabCard density="spacious">
      <CabStack gap="$3">
        <CabText variant="label">{input.title}</CabText>
        <CabAccordion
          items={input.events.map((event) => ({
            value: event.id,
            header: (
              <CabStack gap="$1">
                <CabText variant="label">{t(`deposits:events.${event.eventType}`, { defaultValue: event.eventType })}</CabText>
                <CabText variant="caption">
                  {formatDate(event.occurredAt, input.locale)} · {event.usdValue === null ? "—" : formatUsd(event.usdValue, input.locale)}
                </CabText>
                <CabStack row gap="$2" flexWrap="wrap">
                  {event.priceSource ? (
                    <CabBadge tone={toneForPriceSource(event.priceSource)}>
                      {t(`deposits:detail.movements.priceSourceValues.${event.priceSource}`, { defaultValue: event.priceSource })}
                    </CabBadge>
                  ) : null}
                  <CabBadge tone={toneForConfidence(event.confidence)}>
                    {t(`coverage:confidence.${event.confidence}`, { defaultValue: event.confidence })}
                  </CabBadge>
                </CabStack>
                {event.coverageReasonCodes.length > 0 ? (
                  <CabText variant="caption">
                    {event.coverageReasonCodes
                      .map((reasonCode) => t(`coverage:reasons.${reasonCode}`, { defaultValue: reasonCode }))
                      .join(" • ")}
                  </CabText>
                ) : null}
              </CabStack>
            ),
            content: (
              <DepositEventMovementsTable
                items={event.signedTokenDeltas}
                locale={input.locale}
                labels={input.movementLabels}
              />
            ),
          }))}
        />
      </CabStack>
    </CabCard>
  );
}