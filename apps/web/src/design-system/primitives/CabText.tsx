"use client";

import type { ComponentProps } from "react";
import { Text } from "tamagui";

import { cabFonts } from "@/design-system/tokens";

type CabTextVariant = "display" | "heading" | "body" | "data";

export type CabTextProps = ComponentProps<typeof Text> & {
  variant?: CabTextVariant;
};

const variantStyles: Record<CabTextVariant, ComponentProps<typeof Text>> = {
  display: { fontFamily: cabFonts.brand, letterSpacing: 0.2 },
  heading: { fontFamily: cabFonts.heading, letterSpacing: 0.1 },
  body: { fontFamily: cabFonts.body },
  data: {
    fontFamily: cabFonts.dataAccent,
    fontVariant: ["tabular-nums"],
  },
};

export function CabText({ variant = "body", ...props }: CabTextProps) {
  return <Text {...variantStyles[variant]} {...props} />;
}
