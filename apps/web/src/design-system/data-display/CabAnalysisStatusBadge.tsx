"use client";

import type { AnalysisStatus } from "@/analysis/analysisStatus";
import { CabBadge } from "@/design-system/primitives/CabBadge";

export type CabAnalysisStatus = AnalysisStatus;

const toneByStatus: Record<CabAnalysisStatus, "neutral" | "info" | "success" | "danger" | "warning"> = {
  not_analyzed: "neutral",
  queued: "info",
  running: "info",
  ready: "success",
  failed: "danger",
  stale: "warning",
};

export function CabAnalysisStatusBadge({ status, label }: { status: CabAnalysisStatus; label: string }) {
  return (
    <CabBadge tone={toneByStatus[status]} size="sm">
      {label}
    </CabBadge>
  );
}
