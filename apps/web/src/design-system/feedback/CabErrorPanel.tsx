"use client";

import { CabIcon } from "@/design-system/icons/CabIcon";
import { CabButton } from "@/design-system/primitives/CabButton";
import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabErrorPanelProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function CabErrorPanel({
  title,
  description,
  retryLabel,
  onRetry,
}: CabErrorPanelProps) {
  return (
    <CabCard density="spacious">
      <CabStack alignItems="center" justifyContent="center" gap="$3">
        <CabIcon name="warning" tone="danger" size="lg" />
        <CabText variant="label" fontSize={13} color={cabColors.semantic.danger} textAlign="center">
          {title}
        </CabText>
        {description ? (
          <CabText variant="caption" fontSize={12} color={cabColors.text.secondary} textAlign="center">
            {description}
          </CabText>
        ) : null}
        {retryLabel && onRetry ? (
          <CabButton tone="secondary" controlSize="md" onPress={onRetry}>
            {retryLabel}
          </CabButton>
        ) : null}
      </CabStack>
    </CabCard>
  );
}
