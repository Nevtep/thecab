"use client";

import { CabButton, CabCard, CabStack, CabText } from "@/design-system";
import { CabTooltip } from "@/design-system/primitives/CabTooltip";

type DepositsEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionHint?: string;
};

export function DepositsEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionHint,
}: DepositsEmptyStateProps) {
  return (
    <CabCard density="spacious">
      <CabStack alignItems="center" justifyContent="center" gap="$3">
        <CabText variant="label" textAlign="center">{title}</CabText>
        <CabText variant="caption" textAlign="center">{description}</CabText>
        {actionLabel ? (
          actionDisabled ? (
            <CabTooltip label={actionHint ?? description}>
              <span>
                <CabButton tone="secondary" controlSize="md" disabled>
                  {actionLabel}
                </CabButton>
              </span>
            </CabTooltip>
          ) : onAction ? (
            <CabButton tone="secondary" controlSize="md" onPress={onAction}>
              {actionLabel}
            </CabButton>
          ) : null
        ) : null}
      </CabStack>
    </CabCard>
  );
}
