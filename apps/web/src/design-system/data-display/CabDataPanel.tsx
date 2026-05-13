"use client";

import type { PropsWithChildren } from "react";

import { CabCard } from "@/design-system/primitives/CabCard";

export function CabDataPanel({ children }: PropsWithChildren) {
  return <CabCard>{children}</CabCard>;
}
