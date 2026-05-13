"use client";

import type { PropsWithChildren, ReactNode } from "react";

import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";

type CabSidebarProps = PropsWithChildren<{
  header?: ReactNode;
  footer?: ReactNode;
}>;

export function CabSidebar({ header, footer, children }: CabSidebarProps) {
  return (
    <CabCard>
      <CabStack gap="$3">
        {header}
        {children}
        {footer}
      </CabStack>
    </CabCard>
  );
}
