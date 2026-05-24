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
  actions?: ReactNode;
  notice?: string;
}>;

export function CabChartFrame({ title, subtitle, height = 280, actions, notice, children }: CabChartFrameProps) {
  return (
    <CabCard density="default">
      <CabStack gap="$3">
        {title ? (
          <CabStack row justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
            <CabStack gap="$2" flex={1} minWidth={0}>
              <CabText variant="label" color={cabColors.text.primary} fontSize={15}>
                {title}
              </CabText>
              {subtitle ? (
                <CabText variant="caption" color={cabColors.text.muted} fontSize={12}>
                  {subtitle}
                </CabText>
              ) : null}
            </CabStack>
            {actions ? (
              <CabStack row justifyContent="flex-end" alignItems="center" flexShrink={0}>
                {actions}
              </CabStack>
            ) : null}
          </CabStack>
        ) : subtitle ? (
          <CabText variant="caption" color={cabColors.text.muted} fontSize={12}>
            {subtitle}
          </CabText>
        ) : null}
        {notice ? (
          <CabText variant="caption" color={cabColors.text.secondary} fontSize={12}>
            {notice}
          </CabText>
        ) : null}
        <div style={{ width: "100%", height }}>{children}</div>
      </CabStack>
    </CabCard>
  );
}
