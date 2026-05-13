"use client";

import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";

export function CabPoolCard({ title, value }: { title: string; value: string }) {
  return (
    <CabCard>
      <CabStack>
        <CabText variant="label">{title}</CabText>
        <CabText variant="data">{value}</CabText>
      </CabStack>
    </CabCard>
  );
}
