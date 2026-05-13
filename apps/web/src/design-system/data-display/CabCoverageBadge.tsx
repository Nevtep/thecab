"use client";

import { CabBadge } from "@/design-system/primitives/CabBadge";

export type CabCoverageState = "full" | "share_level" | "partial" | "unknown";

const toneByCoverage: Record<CabCoverageState, "success" | "info" | "warning" | "danger"> = {
  full: "success",
  share_level: "info",
  partial: "warning",
  unknown: "danger",
};

export function CabCoverageBadge({ state, label }: { state: CabCoverageState; label: string }) {
  return <CabBadge tone={toneByCoverage[state]}>{label}</CabBadge>;
}
