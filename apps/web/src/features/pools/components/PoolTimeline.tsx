"use client";

import { CabDataPanel, CabIcon, CabStack, CabText } from "@/design-system";
import type { CabIconName } from "@/design-system/icons/iconRegistry";
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

function eventVisual(eventType: string): { icon: CabIconName; color: string } {
  const normalized = eventType.toLowerCase();

  if (normalized.includes("rebalance")) {
    return { icon: "refreshCcw", color: cabColors.dataViz.violet };
  }
  if (normalized.includes("claim") || normalized.includes("reward") || normalized.includes("collect") || normalized.includes("fee")) {
    return { icon: "rewards", color: cabColors.dataViz.mint };
  }
  if (normalized.includes("withdraw") || normalized.includes("unstake")) {
    return { icon: "arrowDownToLine", color: cabColors.dataViz.orange };
  }
  if (normalized.includes("deposit") || normalized.includes("stake") || normalized.includes("mint")) {
    return { icon: "arrowUpToLine", color: cabColors.brand.signalTeal };
  }
  if (normalized.includes("strategy")) {
    return { icon: "strategies", color: cabColors.brand.electricBlue };
  }

  return { icon: "activity", color: cabColors.text.muted };
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
  const curatedItems = input.items.filter((item) => isRelevantEventType(item.eventType)).slice(0, 12);

  return (
    <CabDataPanel>
      <CabStack gap="$3">
        <CabText variant="heading">{input.title}</CabText>
        {curatedItems.length > 0 ? (
          <div style={{ position: "relative", display: "grid", gap: 12 }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 15,
                top: 12,
                bottom: 12,
                width: 1,
                background: `linear-gradient(180deg, transparent, ${cabColors.surface.border}, transparent)`,
              }}
            />
            {curatedItems.map((item) => {
              const visual = eventVisual(item.eventType);
              return (
                <CabStack
                  key={item.eventKey}
                  row
                  alignItems="center"
                  gap="$3"
                  style={{
                    position: "relative",
                    minHeight: 44,
                    padding: "8px 10px 8px 0",
                    border: `1px solid ${cabColors.surface.border}`,
                    borderRadius: 8,
                    background: `linear-gradient(90deg, ${visual.color}16, transparent 42%)`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: `1px solid ${visual.color}88`,
                      background: cabColors.surface.elevatedSurface,
                      boxShadow: `0 0 18px ${visual.color}33`,
                      flex: "0 0 auto",
                    }}
                  >
                    <CabIcon name={visual.icon} size="sm" color={visual.color} />
                  </span>
                  <CabStack gap="$0.5" minWidth={0} flex={1}>
                    <CabText variant="label">{formatEventLabel(item.eventType)}</CabText>
                    <CabText variant="caption" color={cabColors.text.muted}>{item.formattedOccurredAt}</CabText>
                  </CabStack>
                  <CabStack gap="$0.5" alignItems="flex-end">
                    <CabText variant="mono">{item.formattedAttributedValueUsd ?? "--"}</CabText>
                    <CabText variant="caption" color={cabColors.text.muted}>{item.confidence}</CabText>
                  </CabStack>
                </CabStack>
              );
            })}
          </div>
        ) : (
          <CabText variant="caption" color={cabColors.text.secondary}>{input.emptyLabel}</CabText>
        )}
      </CabStack>
    </CabDataPanel>
  );
}
