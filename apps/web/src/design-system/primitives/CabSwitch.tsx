"use client";

import { Switch, XStack } from "tamagui";

import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabSwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
};

export function CabSwitch({ checked, onCheckedChange, label, disabled = false }: CabSwitchProps) {
  return (
    <XStack alignItems="center" gap="$2" opacity={disabled ? 0.6 : 1}>
      <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
        {label}
      </CabText>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        size="$2"
        backgroundColor={checked ? cabColors.brandExtended.signalTealUi : cabColors.surface.border}
        borderColor={checked ? cabColors.brandExtended.signalTealUi : cabColors.surface.border}
      >
        <Switch.Thumb
          backgroundColor={checked ? cabColors.brand.cabNight : cabColors.text.primary}
        />
      </Switch>
    </XStack>
  );
}