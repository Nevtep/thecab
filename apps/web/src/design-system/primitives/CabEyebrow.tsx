"use client";

import type { ComponentProps, PropsWithChildren } from "react";

import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

type CabEyebrowTone = "muted" | "secondary" | "signal";

const toneColorMap: Record<CabEyebrowTone, string> = {
  muted: cabColors.text.muted,
  secondary: cabColors.text.secondary,
  signal: cabColors.brand.signalTeal,
};

export type CabEyebrowProps = PropsWithChildren<
  {
    tone?: CabEyebrowTone;
  } & Omit<ComponentProps<typeof CabText>, "children" | "variant" | "color">
>;

export function CabEyebrow({
  tone = "muted",
  fontSize = 10,
  style,
  children,
  ...props
}: CabEyebrowProps) {
  return (
    <CabText
      variant="mono"
      fontSize={fontSize}
      color={toneColorMap[tone]}
      style={[
        {
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </CabText>
  );
}