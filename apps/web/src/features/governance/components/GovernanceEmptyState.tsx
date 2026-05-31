"use client";

import { CabCard, CabIcon, CabStack, CabText, cabColors } from "@/design-system";

type Props = {
  title: string;
  description: string;
  tone?: "locked" | "empty" | "partial";
};

export function GovernanceEmptyState({ title, description, tone = "empty" }: Props) {
  const iconTone = tone === "locked" ? "warning" : tone === "partial" ? "muted" : "signal";

  return (
    <CabCard density="compact">
      <CabStack gap="$3" alignItems="center" padding="$4">
        <CabIcon name={tone === "locked" ? "lock" : "governance"} size="lg" tone={iconTone} />
        <CabStack gap="$2" alignItems="center">
          <CabText variant="label" textAlign="center">{title}</CabText>
          <CabText variant="body" color={cabColors.text.secondary} textAlign="center">
            {description}
          </CabText>
        </CabStack>
      </CabStack>
    </CabCard>
  );
}
