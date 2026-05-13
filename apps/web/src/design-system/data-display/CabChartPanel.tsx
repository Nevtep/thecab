"use client";

import type { PropsWithChildren } from "react";

import { CabDataPanel } from "@/design-system/data-display/CabDataPanel";

export function CabChartPanel({ children }: PropsWithChildren) {
  return <CabDataPanel>{children}</CabDataPanel>;
}
