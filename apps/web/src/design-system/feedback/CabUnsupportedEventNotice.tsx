"use client";

import { CabBadge } from "@/design-system/primitives/CabBadge";
import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";

export type CabUnsupportedEventNoticeProps = {
  title: string;
  description: string;
};

export function CabUnsupportedEventNotice({
  title,
  description,
}: CabUnsupportedEventNoticeProps) {
  return (
    <CabCard>
      <CabStack>
        <CabBadge tone="danger">unsupported</CabBadge>
        <CabText variant="heading">{title}</CabText>
        <CabText>{description}</CabText>
      </CabStack>
    </CabCard>
  );
}
