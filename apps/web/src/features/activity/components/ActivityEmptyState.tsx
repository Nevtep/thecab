"use client";

import { CabCard, CabStack, CabText, cabColors } from "@/design-system";

type Props = {
  title: string;
  description: string;
};

export function ActivityEmptyState({ title, description }: Props) {
  return (
    <CabCard density="spacious">
      <CabStack alignItems="center" gap="$2" paddingVertical="$6">
        <CabText variant="heading" fontSize={16}>{title}</CabText>
        <CabText variant="body" fontSize={13} color={cabColors.text.secondary} textAlign="center">
          {description}
        </CabText>
      </CabStack>
    </CabCard>
  );
}
