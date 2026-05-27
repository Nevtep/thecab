"use client";

import { CabRewardTimeline, CabStack, CabText } from "@/design-system";

export function PoolTimeline(input: {
  title: string;
  confidenceLabel: string;
  items: Array<{
    eventKey: string;
    eventType: string;
    formattedOccurredAt: string;
    formattedAttributedValueUsd: string | null;
    confidence: string;
  }>;
}) {
  return (
    <CabRewardTimeline>
      <CabStack gap="$3">
        <CabText variant="heading">{input.title}</CabText>
        {input.items.map((item) => (
          <CabStack key={item.eventKey} gap="$1">
            <CabText variant="label">{item.eventType}</CabText>
            <CabText variant="caption">{item.formattedOccurredAt}</CabText>
            {item.formattedAttributedValueUsd ? (
              <CabText variant="caption">{item.formattedAttributedValueUsd}</CabText>
            ) : null}
            <CabText variant="caption">{input.confidenceLabel}: {item.confidence}</CabText>
          </CabStack>
        ))}
      </CabStack>
    </CabRewardTimeline>
  );
}