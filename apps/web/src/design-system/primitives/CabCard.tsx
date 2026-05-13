"use client";

import type { PropsWithChildren } from "react";
import { YStack } from "tamagui";

import { cabColors } from "@/design-system/tokens";

export type CabCardProps = PropsWithChildren<{
  padding?: number | string;
  gap?: number | string;
}>;

export function CabCard({ padding = "$4", gap = "$3", children }: CabCardProps) {
  return (
    <YStack
      backgroundColor={cabColors.surface.darkSurface}
      borderColor={cabColors.surface.border}
      borderWidth={1}
      borderRadius="$3"
      padding={padding}
      gap={gap}
    >
      {children}
    </YStack>
  );
}
