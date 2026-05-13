"use client";

import type { ComponentProps, PropsWithChildren } from "react";
import { XStack, YStack } from "tamagui";

type CabStackProps = PropsWithChildren<{
  row?: boolean;
}> &
  ComponentProps<typeof YStack>;

export function CabStack({
  row = false,
  gap = "$3",
  children,
  ...props
}: CabStackProps) {
  if (row) {
    return (
      <XStack gap={gap} {...props}>
        {children}
      </XStack>
    );
  }

  return (
    <YStack gap={gap} {...props}>
      {children}
    </YStack>
  );
}
