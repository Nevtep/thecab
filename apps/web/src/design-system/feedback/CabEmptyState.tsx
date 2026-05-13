"use client";

import type { ReactNode } from "react";

import { CabIcon } from "@/design-system/icons/CabIcon";
import { CabButton } from "@/design-system/primitives/CabButton";
import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabEmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
};

export function CabEmptyState({ title, description, actionLabel, onAction, icon }: CabEmptyStateProps) {
  return (
    <CabCard>
      <CabStack alignItems="center" justifyContent="center" gap="$2">
        {icon ?? <CabIcon name="info" tone="muted" size="lg" />}
        <CabText variant="heading" color={cabColors.text.primary} textAlign="center">
          {title}
        </CabText>
        {description ? (
          <CabText color={cabColors.text.secondary} textAlign="center">
            {description}
          </CabText>
        ) : null}
        {actionLabel && onAction ? (
          <CabButton tone="secondary" onPress={onAction}>
            {actionLabel}
          </CabButton>
        ) : null}
      </CabStack>
    </CabCard>
  );
}
