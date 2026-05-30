"use client";

import type { ComponentProps, PropsWithChildren } from "react";
import { YStack } from "tamagui";

import { cabColors } from "@/design-system/tokens";
import type { CabDensity } from "@/design-system/tokens";

const cardDensityStyles: Record<CabDensity, { padding: string; gap: string }> = {
  compact: { padding: "$2", gap: "$1" },
  default: { padding: "$3", gap: "$2" },
  spacious: { padding: "$4", gap: "$3" },
};

export type CabCardProps = PropsWithChildren<{
  padding?: number | string;
  gap?: number | string;
  density?: CabDensity;
}> & Omit<ComponentProps<typeof YStack>, "padding" | "gap">;

export function CabCard({ padding, gap, density = "default", children, ...props }: CabCardProps) {
  const densityStyle = cardDensityStyles[density];

  return (
    <YStack
      backgroundColor={cabColors.surface.darkSurface}
      borderColor={cabColors.surface.border}
      borderWidth={1}
      borderRadius="$3"
      padding={padding ?? densityStyle.padding}
      gap={gap ?? densityStyle.gap}
      {...props}
    >
      {children}
    </YStack>
  );
}
