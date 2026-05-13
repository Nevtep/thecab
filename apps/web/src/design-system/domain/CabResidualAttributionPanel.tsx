"use client";

import type { ReactNode } from "react";

import { CabCard } from "@/design-system/primitives/CabCard";

export function CabResidualAttributionPanel({ children }: { children: ReactNode }) {
  return <CabCard>{children}</CabCard>;
}
