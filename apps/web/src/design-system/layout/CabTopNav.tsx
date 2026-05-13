"use client";

import type { PropsWithChildren } from "react";

import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabTopNavProps = PropsWithChildren<{
  title: string;
}>;

export function CabTopNav({ title, children }: CabTopNavProps) {
  return (
    <CabStack row justifyContent="space-between" alignItems="center" padding="$3">
      <CabText variant="heading" color={cabColors.text.primary}>
        {title}
      </CabText>
      {children}
    </CabStack>
  );
}
