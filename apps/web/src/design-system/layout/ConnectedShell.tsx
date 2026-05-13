"use client";

import type { PropsWithChildren, ReactNode } from "react";

import { CabStack } from "@/design-system/primitives/CabStack";

export type ConnectedShellProps = PropsWithChildren<{
  sidebar: ReactNode;
  topBar?: ReactNode;
}>;

export function ConnectedShell({ sidebar, topBar, children }: ConnectedShellProps) {
  return (
    <CabStack row gap="$3" padding="$3">
      <div style={{ width: 300, minWidth: 260 }}>{sidebar}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <CabStack gap="$3">
          {topBar}
          <div>{children}</div>
        </CabStack>
      </div>
    </CabStack>
  );
}
