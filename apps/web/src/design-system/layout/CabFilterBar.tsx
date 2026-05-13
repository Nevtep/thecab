"use client";

import type { PropsWithChildren } from "react";

import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";

export function CabFilterBar({ children }: PropsWithChildren) {
  return (
    <CabCard padding="$3">
      <CabStack row gap="$2" alignItems="center">
        {children}
      </CabStack>
    </CabCard>
  );
}
