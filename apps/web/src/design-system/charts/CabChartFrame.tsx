"use client";

import type { PropsWithChildren } from "react";

import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabChartFrameProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  height?: number;
}>;

export function CabChartFrame({ title, subtitle, height = 280, children }: CabChartFrameProps) {
  return (
    <CabCard density="default">
      <CabStack gap="$3">
        {title ? (
          <CabText variant="label" color={cabColors.text.primary} fontSize={15}>
            {title}
          </CabText>
        ) : null}
        {subtitle ? (
          <CabText variant="caption" color={cabColors.text.muted} fontSize={12}>
            {subtitle}
          </CabText>
        ) : null}
        <div style={{ width: "100%", height }}>{children}</div>
      </CabStack>
    </CabCard>
  );
}
