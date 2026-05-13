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
    <CabCard density="spacious">
      <CabStack gap="$3">
        <CabBadge tone="danger">unsupported</CabBadge>
        <CabText variant="label" fontSize={13}>
          {title}
        </CabText>
        <CabText variant="caption" fontSize={12}>
          {description}
        </CabText>
      </CabStack>
    </CabCard>
  );
}
