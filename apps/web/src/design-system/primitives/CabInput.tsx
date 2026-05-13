"use client";

import type { ComponentProps } from "react";
import { Input } from "tamagui";

import type { CabDensity } from "@/design-system/tokens";
import { cabColors } from "@/design-system/tokens";

type CabInputSize = "sm" | "md" | "lg";

const inputSizeStyles: Record<
  CabInputSize,
  {
    height: number;
    paddingHorizontal: number;
    paddingVertical: number;
    fontSize: number;
  }
> = {
  sm: { height: 30, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
  md: { height: 38, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  lg: { height: 44, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
};

const densityToSize: Record<CabDensity, CabInputSize> = {
  compact: "sm",
  default: "md",
  spacious: "lg",
};

export type CabInputProps = ComponentProps<typeof Input> & {
  controlSize?: CabInputSize;
  density?: CabDensity;
};

export function CabInput({ controlSize, density = "default", ...props }: CabInputProps) {
  const resolvedSize = controlSize ?? densityToSize[density];
  const sizeStyle = inputSizeStyles[resolvedSize];

  return (
    <Input
      backgroundColor={cabColors.surface.elevatedSurface}
      borderColor={cabColors.surface.border}
      color={cabColors.text.primary}
      placeholderTextColor="$muted"
      borderWidth={1}
      borderRadius="$2"
      height={sizeStyle.height}
      minHeight={sizeStyle.height}
      paddingHorizontal={sizeStyle.paddingHorizontal}
      paddingVertical={sizeStyle.paddingVertical}
      fontSize={sizeStyle.fontSize}
      focusStyle={{
        borderColor: cabColors.brandExtended.signalTealUi,
        shadowColor: cabColors.brandExtended.signalTealGlow,
        shadowRadius: 8,
      }}
      {...props}
    />
  );
}
