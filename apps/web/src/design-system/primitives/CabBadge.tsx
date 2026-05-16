"use client";

import type { PropsWithChildren } from "react";
import { XStack } from "tamagui";

import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

type CabBadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneStyles: Record<
  CabBadgeTone,
  { borderColor: string; backgroundColor: string; textColor: string; dotColor: string }
> = {
  neutral: {
    borderColor: "rgba(184, 199, 230, 0.2)",
    backgroundColor: "rgba(184, 199, 230, 0.08)",
    textColor: cabColors.text.secondary,
    dotColor: cabColors.text.muted,
  },
  success: {
    borderColor: "rgba(34, 197, 94, 0.28)",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    textColor: cabColors.semantic.success,
    dotColor: cabColors.semantic.success,
  },
  warning: {
    borderColor: "rgba(251, 191, 36, 0.32)",
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    textColor: cabColors.semantic.warning,
    dotColor: cabColors.semantic.warning,
  },
  danger: {
    borderColor: "rgba(239, 68, 68, 0.32)",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    textColor: cabColors.semantic.danger,
    dotColor: cabColors.semantic.danger,
  },
  info: {
    borderColor: "rgba(56, 189, 248, 0.32)",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    textColor: cabColors.semantic.info,
    dotColor: cabColors.semantic.info,
  },
};

export type CabBadgeProps = PropsWithChildren<{
  tone?: CabBadgeTone;
  size?: "sm" | "md";
  /** Status chips (non-interactive) vs emphasis labels */
  variant?: "status" | "emphasis";
}>;

const badgeSizeStyles = {
  sm: {
    minHeight: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    dotSize: 5,
  },
  md: {
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 11,
    dotSize: 6,
  },
} as const;

export function CabBadge({
  tone = "neutral",
  size = "md",
  variant = "status",
  children,
}: CabBadgeProps) {
  const sizeStyle = badgeSizeStyles[size];
  const colors = toneStyles[tone];
  const isStatus = variant === "status";

  return (
    <XStack
      role="status"
      aria-live="off"
      alignItems="center"
      justifyContent="center"
      gap={6}
      minHeight={sizeStyle.minHeight}
      borderWidth={isStatus ? 0 : 1}
      borderColor={colors.borderColor}
      borderRadius="$pill"
      paddingHorizontal={sizeStyle.paddingHorizontal}
      paddingVertical={sizeStyle.paddingVertical}
      backgroundColor={colors.backgroundColor}
      cursor="default"
      pointerEvents="none"
      userSelect="none"
    >
      {isStatus ? (
        <XStack
          width={sizeStyle.dotSize}
          height={sizeStyle.dotSize}
          borderRadius={999}
          backgroundColor={colors.dotColor}
          flexShrink={0}
        />
      ) : null}
      <CabText
        variant="mono"
        fontSize={sizeStyle.fontSize}
        color={colors.textColor}
        style={
          isStatus
            ? {
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
              }
            : undefined
        }
      >
        {children}
      </CabText>
    </XStack>
  );
}
