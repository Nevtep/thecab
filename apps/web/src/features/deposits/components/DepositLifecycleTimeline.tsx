"use client";

import { CabAccordion, CabBadge, CabCard, CabStack, CabText } from "@/design-system";
import type { DepositLifecycleEventViewModel } from "@/features/deposits/deposits.mappers";
import { DepositEventMovementsTable } from "@/features/deposits/components/DepositEventMovementsTable";

type DepositLifecycleTimelineProps = {
  events: DepositLifecycleEventViewModel[];
  title: string;
  emptyLabel: string;
  movementLabels: {
    token: string;
    direction: string;
    amount: string;
    usdValue: string;
    priceSource: string;
  };
};

export function DepositLifecycleTimeline(input: DepositLifecycleTimelineProps) {
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
                <CabText variant="label">{event.title}</CabText>
                <CabText variant="caption">
                  {event.occurredAtLabel} · {event.usdValueLabel}
                </CabText>
                <CabStack row gap="$2" flexWrap="wrap">
                  {event.priceSourceLabel ? (
                    <CabBadge tone={event.priceSourceTone ?? "neutral"}>
                      {event.priceSourceLabel}
                    </CabBadge>
                  ) : null}
                  <CabBadge tone={event.confidenceTone}>
                    {event.confidenceLabel}
                  </CabBadge>
                </CabStack>
                {event.coverageReasonLabels.length > 0 ? (
                  <CabText variant="caption">
                    {event.coverageReasonLabels.join(" • ")}
                  </CabText>
                ) : null}
              </CabStack>
            ),
            content: (
              <DepositEventMovementsTable
                items={event.movements}
                labels={input.movementLabels}
              />
            ),
          }))}
        />
      </CabStack>
    </CabCard>
  );
}