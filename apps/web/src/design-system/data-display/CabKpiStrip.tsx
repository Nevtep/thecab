"use client";

import type { ReactNode } from "react";

import { CabStack } from "@/design-system/primitives/CabStack";

export function CabKpiStrip({ children }: { children: ReactNode }) {
  return (
    <CabStack row gap="$3">
      {children}
    </CabStack>
  );
}
