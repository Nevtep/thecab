"use client";

import type { ComponentProps } from "react";
import { YStack } from "tamagui";

export type CabBoxProps = ComponentProps<typeof YStack>;

export function CabBox(props: CabBoxProps) {
  return <YStack {...props} />;
}
