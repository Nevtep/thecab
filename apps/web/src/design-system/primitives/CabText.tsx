"use client";

import type { ComponentProps } from "react";
import { Text } from "tamagui";

import { cabFonts, cabFontWeights } from "@/design-system/tokens";

type CabTextVariant =
  | "display"
  | "heading"
  | "body"
  | "label"
  | "caption"
  | "kpi"
  | "data"
  | "mono";

export type CabTextProps = ComponentProps<typeof Text> & {
  variant?: CabTextVariant;
};

const variantStyles: Record<CabTextVariant, ComponentProps<typeof Text>> = {
  display: {
    fontFamily: cabFonts.display,
    letterSpacing: 0.2,
    fontWeight: cabFontWeights.bold,
  },
  heading: {
    fontFamily: cabFonts.heading,
    letterSpacing: 0.1,
    fontWeight: cabFontWeights.semibold,
  },
  body: { fontFamily: cabFonts.body, fontWeight: cabFontWeights.regular },
  label: { fontFamily: cabFonts.ui, fontWeight: cabFontWeights.medium },
  caption: { fontFamily: cabFonts.ui, fontWeight: cabFontWeights.regular },
  kpi: {
    fontFamily: cabFonts.ui,
    fontWeight: cabFontWeights.semibold,
    fontVariant: ["tabular-nums"],
  },
  data: {
    fontFamily: cabFonts.data,
    fontVariant: ["tabular-nums"],
  },
  mono: {
    fontFamily: cabFonts.mono,
    fontVariant: ["tabular-nums"],
  },
};

export function CabText({ variant = "body", ...props }: CabTextProps) {
  return <Text {...variantStyles[variant]} {...props} />;
}
