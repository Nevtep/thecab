"use client";

import type { PropsWithChildren } from "react";

type CabTooltipProps = PropsWithChildren<{
  label: string;
}>;

export function CabTooltip({ label, children }: CabTooltipProps) {
  return <span title={label}>{children}</span>;
}
