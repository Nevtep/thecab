"use client";

import { CabBadge, CabButton, CabStack, CabText, cabColors } from "@/design-system";
import type { ActivityViewModel } from "@/features/activity/activity.types";

type Props = {
  linkedEntities: NonNullable<ActivityViewModel["selectedActivity"]>["linkedEntities"];
  labels: {
    empty: string;
    getKind: (value: string) => string;
    getReason: (value: string) => string;
    open: string;
  };
  onOpenHref?: (href: string) => void;
};

export function ActivityLinkedEntities({ linkedEntities, labels, onOpenHref }: Props) {
  if (linkedEntities.length === 0) {
    return (
      <CabText variant="body" fontSize={12} color={cabColors.text.secondary}>
        {labels.empty}
      </CabText>
    );
  }

  return (
    <CabStack gap="$2">
      {linkedEntities.map((entity) => (
        <CabStack key={`${entity.kind}:${entity.label}`} row alignItems="center" justifyContent="space-between" gap="$2">
          <CabStack row alignItems="center" gap="$2" minWidth={0}>
            <CabBadge tone="info" size="sm">{labels.getKind(entity.kind)}</CabBadge>
            <CabStack gap="$1" minWidth={0}>
              <CabText variant="data" fontSize={12}>{entity.label}</CabText>
              {entity.reasonCode ? (
                <CabText variant="caption" fontSize={11} color={cabColors.text.secondary}>
                  {labels.getReason(entity.reasonCode)}
                </CabText>
              ) : null}
            </CabStack>
          </CabStack>
          {entity.href ? (
            <CabButton tone="ghost" controlSize="sm" onPress={() => onOpenHref?.(entity.href!)}>
              {labels.open}
            </CabButton>
          ) : null}
        </CabStack>
      ))}
    </CabStack>
  );
}
