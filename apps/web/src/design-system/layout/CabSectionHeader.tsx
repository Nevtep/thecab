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
    <CabStack row justifyContent="space-between" alignItems="center">
      <CabStack>
        <CabText variant="heading" fontSize="$5" color={cabColors.text.primary}>
          {title}
        </CabText>
        {subtitle ? <CabText color={cabColors.text.muted}>{subtitle}</CabText> : null}
      </CabStack>
      {actions}
    </CabStack>
  );
}
