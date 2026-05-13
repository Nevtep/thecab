"use client";

import type { ReactNode } from "react";

import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabSectionHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function CabSectionHeader({ title, subtitle, actions }: CabSectionHeaderProps) {
  return (
    <CabStack row justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
      <CabStack gap="$2">
        <CabText variant="heading" fontSize={16} color={cabColors.text.primary}>
          {title}
        </CabText>
        {subtitle ? (
          <CabText variant="caption" fontSize={12} color={cabColors.text.muted}>
            {subtitle}
          </CabText>
        ) : null}
      </CabStack>
      {actions}
    </CabStack>
  );
}
