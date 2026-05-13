"use client";

import { Separator } from "tamagui";

import { cabColors } from "@/design-system/tokens";

export function CabSeparator() {
  return <Separator borderColor={cabColors.surface.border} />;
}
