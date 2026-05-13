"use client";

import type { PropsWithChildren } from "react";

import { CabButton } from "@/design-system/primitives/CabButton";

export type CabSidebarNavItemProps = PropsWithChildren<{
  disabled?: boolean;
  onPress?: () => void;
}>;

export function CabSidebarNavItem({ children, disabled, onPress }: CabSidebarNavItemProps) {
  return (
    <CabButton
      tone="ghost"
      disabled={disabled}
      onPress={onPress}
      justifyContent="flex-start"
      width="100%"
    >
      {children}
    </CabButton>
  );
}
