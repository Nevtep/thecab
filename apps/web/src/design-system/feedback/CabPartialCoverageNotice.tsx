"use client";

import { CabBadge } from "@/design-system/primitives/CabBadge";
import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";

export type CabPartialCoverageNoticeProps = {
  title: string;
  description: string;
};

export function CabPartialCoverageNotice({
  title,
  description,
}: CabPartialCoverageNoticeProps) {
  return (
    <CabCard>
      <CabStack>
        <CabBadge tone="warning">partial</CabBadge>
        <CabText variant="heading">{title}</CabText>
        <CabText>{description}</CabText>
      </CabStack>
    </CabCard>
  );
}
