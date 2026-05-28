"use client";

import { CabCard, CabStack, CabText } from "@/design-system";

type DepositCoveredRangeNoteProps = {
  title: string;
  value: string;
  hint?: string | null;
};

export function DepositCoveredRangeNote(input: DepositCoveredRangeNoteProps) {
  return (
    <CabCard density="default">
      <CabStack gap="$1">
        <CabText variant="caption">{input.title}</CabText>
        <CabText variant="label">{input.value}</CabText>
        {input.hint ? <CabText variant="caption">{input.hint}</CabText> : null}
      </CabStack>
    </CabCard>
  );
}