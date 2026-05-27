"use client";

import { CabDataPanel, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";

function isRelevantEventType(eventType: string) {
  const normalized = eventType.toLowerCase();

  return ["rebalance", "claim", "collect", "range", "manual", "strategy", "deposit", "withdraw"]
    .some((token) => normalized.includes(token));
}

function formatEventLabel(eventType: string) {
  return eventType
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function PoolTimeline(input: {
  title: string;
  emptyLabel: string;
  items: Array<{
    eventKey: string;
    eventType: string;
    formattedOccurredAt: string;
    formattedAttributedValueUsd: string | null;
    confidence: string;
  }>;
}) {
  const curatedItems = input.items.filter((item) => isRelevantEventType(item.eventType)).slice(0, 6);

  return (
    <CabDataPanel>
      <CabStack gap="$2.5">
        <CabText variant="heading">{input.title}</CabText>
        {curatedItems.length > 0 ? curatedItems.map((item, index) => (
          <CabStack
            key={item.eventKey}
            row
            justifyContent="space-between"
            alignItems="center"
            gap="$3"
            style={{
              paddingTop: index === 0 ? 0 : 10,
              borderTop: index === 0 ? "none" : `1px solid ${cabColors.surface.border}`,
            }}
          >
            <CabStack gap="$0.5" minWidth={0} flex={1}>
              <CabText variant="label">{formatEventLabel(item.eventType)}</CabText>
              <CabText variant="caption" color={cabColors.text.muted}>{item.formattedOccurredAt}</CabText>
            </CabStack>
            <CabStack gap="$0.5" alignItems="flex-end">
              <CabText variant="mono">{item.formattedAttributedValueUsd ?? "--"}</CabText>
              <CabText variant="caption" color={cabColors.text.muted}>{item.confidence}</CabText>
            </CabStack>
          </CabStack>
        )) : (
          <CabText variant="caption" color={cabColors.text.secondary}>{input.emptyLabel}</CabText>
        )}
      </CabStack>
    </CabDataPanel>
  );
}