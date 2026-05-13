"use client";

import { CabBadge } from "@/design-system/primitives/CabBadge";

export function CabRebalanceMarker({ label }: { label: string }) {
  return <CabBadge tone="info">{label}</CabBadge>;
}
