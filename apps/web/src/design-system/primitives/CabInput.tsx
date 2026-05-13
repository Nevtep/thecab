"use client";

import type { ComponentProps } from "react";
import { Input } from "tamagui";

import { cabColors } from "@/design-system/tokens";

export type CabInputProps = ComponentProps<typeof Input>;

export function CabInput(props: CabInputProps) {
  return (
    <Input
      backgroundColor={cabColors.surface.elevatedSurface}
      borderColor={cabColors.surface.border}
      color={cabColors.text.primary}
      borderWidth={1}
      borderRadius="$2"
      {...props}
    />
  );
}
