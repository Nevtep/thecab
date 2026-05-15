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
    <XStack
      alignItems="center"
      gap="$2"
      opacity={disabled ? 0.6 : 1}
      paddingVertical={6}
      paddingHorizontal={10}
      borderRadius={999}
      borderWidth={1}
      borderColor={checked ? cabColors.brandExtended.signalTealMuted : cabColors.surface.border}
      backgroundColor={checked ? cabColors.brandExtended.signalTealGlow : cabColors.surface.darkSurface}
    >
      <CabText
        variant="caption"
        fontSize={12}
        color={checked ? cabColors.text.primary : cabColors.text.secondary}
      >
        {label}
      </CabText>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        size="$4"
        width={44}
        height={26}
        padding={2}
        borderRadius={999}
        borderWidth={1}
        backgroundColor={checked ? cabColors.brandExtended.signalTealUi : cabColors.brand.controlBlue}
        borderColor={checked ? cabColors.brandExtended.signalTealUi : cabColors.surface.border}
        justifyContent="center"
        activeStyle={{
          backgroundColor: checked ? cabColors.brandExtended.signalTealUi : cabColors.brand.controlBlue,
          borderColor: checked ? cabColors.brandExtended.signalTealUi : cabColors.surface.border,
        }}
      >
        <Switch.Thumb
          width={20}
          height={20}
          borderRadius={999}
          borderWidth={1}
          borderColor={checked ? cabColors.brand.cabNight : cabColors.surface.border}
          backgroundColor={checked ? cabColors.brand.cabNight : "#F4F7FF"}
        />
      </Switch>
    </XStack>
  );
}