"use client";

import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";

export function CabActivityEventRow({
  left,
  right,
}: {
  left: string;
  right: string;
}) {
  return (
    <CabStack row justifyContent="space-between" alignItems="center">
      <CabText>{left}</CabText>
      <CabText variant="data">{right}</CabText>
    </CabStack>
  );
}
