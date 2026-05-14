"use client";

import { CabIcon, type CabIconName } from "@/design-system/icons";
import { CabBadge } from "@/design-system/primitives/CabBadge";
import { CabButton } from "@/design-system/primitives/CabButton";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabSidebarNavItemState = "active" | "comingSoon" | "requiresAnalysis";

export type CabSidebarNavItemProps = {
  iconName: CabIconName;
  label: string;
  state: CabSidebarNavItemState;
  stateLabel?: string;
  disabled?: boolean;
  onPress?: () => void;
};

const toneByState: Record<CabSidebarNavItemState, "technical" | "secondary" | "ghost"> = {
  active: "technical",
  comingSoon: "secondary",
  requiresAnalysis: "ghost",
};

const badgeToneByState: Record<CabSidebarNavItemState, "info" | "warning" | "danger"> = {
  active: "info",
  comingSoon: "warning",
  requiresAnalysis: "danger",
};

const iconToneByState: Record<CabSidebarNavItemState, "signal" | "warning" | "danger"> = {
  active: "signal",
  comingSoon: "warning",
  requiresAnalysis: "danger",
};

export function CabSidebarNavItem({
  iconName,
  label,
  state,
  stateLabel,
  disabled,
  onPress,
}: CabSidebarNavItemProps) {
  const isDisabled = disabled && state === "requiresAnalysis";

  return (
    <CabButton
      tone={toneByState[state]}
      disabled={isDisabled}
      onPress={onPress}
      justifyContent="flex-start"
      width="100%"
      height="auto"
      minHeight={56}
      paddingVertical={12}
    >
      <CabStack row alignItems="center" justifyContent="space-between" width="100%" gap="$3">
        <CabStack row alignItems="center" gap="$3" flex={1} minWidth={0}>
          <CabStack
            alignItems="center"
            justifyContent="center"
            width={32}
            height={32}
            borderRadius="$2"
            backgroundColor={state === "active" ? cabColors.brand.controlBlue : "rgba(255,255,255,0.02)"}
            borderWidth={1}
            borderColor={state === "active" ? cabColors.action.technicalBorder : cabColors.surface.border}
          >
            <CabIcon name={iconName} tone={iconToneByState[state]} size="md" />
          </CabStack>
          <CabText variant="label" numberOfLines={1} flex={1}>
            {label}
          </CabText>
        </CabStack>
        {stateLabel ? (
          <CabBadge tone={badgeToneByState[state]} size="sm">
            {stateLabel}
          </CabBadge>
        ) : null}
      </CabStack>
    </CabButton>
  );
}
