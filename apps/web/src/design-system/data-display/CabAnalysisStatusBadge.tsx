"use client";

import { CabBadge } from "@/design-system/primitives/CabBadge";

export type CabAnalysisStatus = "not_started" | "queued" | "running" | "ready" | "failed" | "stale";

const toneByStatus: Record<CabAnalysisStatus, "neutral" | "info" | "success" | "danger" | "warning"> = {
  not_started: "neutral",
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
