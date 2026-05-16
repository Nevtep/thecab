"use client";

import type { PropsWithChildren, ReactNode } from "react";

import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabChartFrameProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  height?: number;
  /** Accessible name for the chart graphic */
  ariaLabel?: string;
  /** Screen-reader summary of the chart insight */
  summary?: string;
  /** Optional tabular data alternative */
  dataTable?: ReactNode;
}>;

export function CabChartFrame({
  title,
  subtitle,
  height = 280,
  ariaLabel,
  summary,
  dataTable,
  children,
}: CabChartFrameProps) {
  const accessibleName = ariaLabel ?? title ?? "Chart";

  return (
    <CabCard density="default">
      <CabStack gap="$3">
        {title ? (
          <CabText variant="label" color={cabColors.text.primary} fontSize={15}>
            {title}
          </CabText>
        ) : null}
        {subtitle ? (
          <CabText variant="caption" color={cabColors.text.muted} fontSize={13}>
            {subtitle}
          </CabText>
        ) : null}
        {summary ? (
          <p className="sr-only">{summary}</p>
        ) : null}
        <div
          role="img"
          aria-label={accessibleName}
          style={{ width: "100%", height }}
        >
          {children}
        </div>
        {dataTable ? (
          <div className="sr-only" aria-hidden={false}>
            {dataTable}
          </div>
        ) : null}
      </CabStack>
    </CabCard>
  );
}
